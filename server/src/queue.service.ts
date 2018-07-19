import * as randomstring from "randomstring";
import { QueryResult } from "../node_modules/@types/pg";
import * as db from "./db";
import {Queue, QueueItem, QueueDao, CurrentTrack, Settings, Vote} from "./queue";
import { SpotifyTrack } from "./spotify";
import SpotifyService from "./spotify.service";
import { getCurrentSeconds } from "./util";
import Acl from "./acl";
import { logger } from "./logger.service";
import { Gamify } from "./gamify";
import config from "./config";

export interface QueueTimeout {
    [accessToken: string]: NodeJS.Timer;
}

export interface CurrentState {
    accessToken: string | null;
    currentTrack: CurrentTrack | null,
    isSpotifyPlaying: boolean;
    isSpotiquPlaying: boolean;
    playlistId: string | null;
    deviceId: string | null;
}

class QueueService {

    private static timeouts: QueueTimeout = {};

    public static async getQueue(passcode: string, forUpdate?: boolean): Promise<QueueDao> {
        let query = "SELECT * FROM queues WHERE id = $1";
        if (forUpdate) {
            query = "SELECT * FROM queues WHERE id = $1 FOR UPDATE";
        }

        try {
            const result: QueryResult = await db.query(query, [passcode]);
            if (result.rowCount === 1) {
                const queueDao: QueueDao = {
                    data: result.rows[0].data,
                    id: result.rows[0].id,
                    isPlaying: result.rows[0].is_playing,
                    owner: result.rows[0].owner
                }
                return queueDao;
            } else {
                throw Error("Unable to find queue with given passcode.");
            }
        } catch (err) {
            logger.error("Error occurred while fetching queue from database", { passcode });
            logger.error(err, { passcode });
            throw Error("Error occurred while fetching queue from database. Please try again later.");
        }
    }

    public static getQueueBySpotifyId(spotifyUserId: string) {
        return db.query("SELECT * FROM queues WHERE owner = $1", [spotifyUserId]);
    }

    public static async getUser(passcode: string, userId: string) {
        const queueDao = await QueueService.getQueue(passcode, false);
        const user = queueDao.data.users.find(user => user.id === userId);
        if (!user) {
            throw { status: 404, message: "User not found with given id" };
        }
        return user;
    }

    public static async vote(passcode: string, user: string, value: number) {
        const queueDao = await QueueService.getQueue(passcode, false);
        if (value !== 1 && value !== -1) {
            throw { status: 400, message: "Nice try. Vote value must be either -1 or 1." };
        } else if (!user) {
            throw { status: 404, message: "User not found with the given user id" };
        } else if (!queueDao.data.currentTrack) {
            throw { status: 404, message: "Current song not found. Vote not added." };
        } else if (queueDao.data.currentTrack.votes.find((vote: Vote) => vote.userId === user)) {
            throw { status: 403, message: "You have already voted for this song. Only one vote per user." };
        } else if (queueDao.data.currentTrack.owner === user) {
            throw { status: 403, message: "Can't vote for own songs." };
        }
        
        const vote: Vote = {
            userId: user,
            value
        }
        queueDao.data.currentTrack.votes.push(vote);
        await QueueService.updateQueueData(queueDao.data, passcode);

        // Skip the song if enough downvotes
        let voteSum = queueDao.data.currentTrack.votes.reduce((prev, cur) => prev + cur.value, 0);
        if (voteSum < 0) {
            if (Math.abs(voteSum) >= queueDao.data.settings.skipThreshold) {
                logger.info(`Got downvote form ${Math.abs(voteSum)}/${queueDao.data.settings.skipThreshold} users. Skipping this song...`, { user, passcode });
                QueueService.startNextTrack(passcode, user, queueDao.data.accessToken!);
            }
        }
    }

    public static create(code: string) {
        return new Promise<QueueDao>((resolve, reject) => {
            let accessToken: string;
            let refreshToken: string;
            let expiresIn: number;

            logger.debug(`Creating new queue...`);

            SpotifyService.getToken(code, "create")
            // Token received
            .then((response: any) => {
                accessToken = response.data.access_token;
                refreshToken = response.data.refresh_token;
                expiresIn = response.data.expires_in;
                logger.debug("Received access token...going to get username");
                return SpotifyService.getUser(accessToken);
            })
            // User data received
            .then((response: any) => {
                const spotifyUserId = response.data.id;
                let passcode: string;
                let userId: string;

                logger.debug(`Found spotify userId...trying to find existing queues`, { id: spotifyUserId });

                // Check if QueueService user already has a queue
                QueueService.getQueueBySpotifyId(spotifyUserId)
                .then(result => {
                    if (result.rowCount === 1) {
                        const queue: QueueDao = result.rows[0];
                        queue.data.refreshToken = refreshToken;
                        queue.data.expiresIn = expiresIn;
                        queue.data.accessTokenAcquired = getCurrentSeconds();
                        passcode = queue.id;
                        userId = (queue.data.users.find(user => user.spotifyUserId === spotifyUserId))!.id;
                        logger.info(`Found existing queue`, { user: userId, passcode });
                        QueueService.activateQueue(queue.data, accessToken, passcode).then(() => {
                            resolve(queue);
                        });
                    } else {
                        QueueService.generatePasscode().then(passcode => {
                            userId = randomstring.generate();
                            logger.info(`Generated passcode`, { user: userId, passcode });
                            if (passcode) {
                                const queue: Queue = QueueService.createQueueObject(spotifyUserId, accessToken,
                                    userId, refreshToken, expiresIn);
                                QueueService.createQueue(passcode, spotifyUserId, queue).then(() => {
                                    resolve({ id: passcode, data: queue, isPlaying: false, owner: spotifyUserId });
                                }).catch(err => {
                                    logger.error(`Unable to insert queue into database`, { user: userId, passcode });
                                    logger.error(err, { user: userId, passcode });
                                    reject({ status: 500,
                                        message: "Error occured while inserting queue into database. Please try again later." });
                                });
                            } else {
                                throw new Error("Unable to generate unique passcode. Please try again later");
                            }
                        }).catch(err => {
                            logger.error(err, { user: userId, passcode });
                            reject({ status: 500, message: err.message });
                        });
                    }
                }).catch(err => {
                    logger.error(err);
                    reject( { status: 500, message: "Unable to create queue. Please try again in a moment." });
                });
            }).catch((err: any) => {
                logger.error(err.response.data);
                reject({ status: 500, message: "Failed to authenticate." });
            });
        });
    }

    public static reactivate(passcode: string, userId: string, code: string) {
        return new Promise<Queue>((resolve, reject) => {
            let accessToken: string;
            let refreshToken: string;
            let expiresIn: number;

            logger.info(`Reactivating queue...`, { user: userId, passcode });

            SpotifyService.getToken(code, "reactivate")
            // Token received
            .then((response: any) => {
                accessToken = response.data.access_token;
                refreshToken = response.data.refresh_token;
                expiresIn = response.data.expires_in;
                logger.info("Access token received...going to get username", { user: userId, passcode });
                return SpotifyService.getUser(accessToken);
            })
            // User data received
            .then((response: any) => {
                const spotifyUserId = response.data.id;
                logger.debug(`Found spotify userId ${spotifyUserId}...trying to reactivate`, { user: userId, passcode });

                QueueService.getQueue(passcode, true).then(queueDao => {
                    if (queueDao.owner === spotifyUserId) {
                        queueDao.data.accessToken = accessToken;
                        queueDao.data.refreshToken = refreshToken;
                        queueDao.data.expiresIn = expiresIn;

                        if (!userId) {
                            userId = randomstring.generate();
                        }

                        // Update userId if cookie was missing or has changed
                        if (userId !== queueDao.data.owner) {
                            logger.info(`Queue owner's userid was missing or has changed from ${queueDao.data.owner}...syncing`,
                                { user: userId, passcode });
                            queueDao.data.owner = userId;
                            const i = queueDao.data.users.findIndex(user => user.spotifyUserId !== null);
                            const ownerUser = queueDao.data.users[i];
                            ownerUser.id = userId;
                            queueDao.data.users[i] = ownerUser;
                        }

                        QueueService.updateQueue(queueDao.data, queueDao.isPlaying, passcode).then(() => {
                            logger.debug(`Successfully reactivated`, { user: userId, passcode });
                            resolve(queueDao.data);
                        }).catch(err => {
                            logger.error(`Unable to reactivate queue into database`, { user: userId, passcode });
                            logger.error(err, { user: userId, passcode });
                            reject({ status: 500, message: "Error occured while reactivating queue. Please try again later." });
                        });
                    } else {
                        reject({ status: 500, message: "Cannot reactivate queue since you're not the owner." });
                    }
                }).catch(err => {
                    reject({ status: 500, message: err.message });
                });
            }).catch((err: any) => {
                logger.error(err, { user: userId, passcode });
                reject({ status: 500, message: "Unable to get data from spotify. Please try again later." });
            });
        });
    }

    public static createQueueObject(spotifyUserId: string, accessToken: string,
                             userId: string, refreshToken: string, expiresIn: number): Queue {
        return {
            owner: userId,
            accessToken,
            refreshToken,
            expiresIn,
            accessTokenAcquired: getCurrentSeconds(),
            currentTrack: null,
            name: "Queue 1",
            deviceId: null,
            queue: [],
            playlistId: null,
            playlistTracks: [],
            settings: {
                gamify: false,
                maxDuplicateTracks: 2,
                numberOfTracksPerUser: 5,
                randomPlaylist: false,
                randomQueue: false,
                skipThreshold: 5
            },
            users: [
                {
                    id: userId,
                    spotifyUserId,
                    points: config.gamify.initialPoints
                }
            ]
        };
    }

    public static createQueue(passcode: string, spotifyUserId: string, queue: Queue) {
        logger.info(`Creating new queue`, { user: queue.owner, passcode });
        return db.query("INSERT INTO queues (id, owner, data) VALUES ($1, $2, $3)", [passcode, spotifyUserId, queue]);
    }

    public static async generatePasscode() {
        let loops = 10;

        do {
            let passcode = randomstring.generate({ readable: true, length: 8, charset: "alphanumeric" });
            const results = await db.query("SELECT 1 FROM queues WHERE id = $1", [passcode]);
            if (results.rowCount === 0) {
                return passcode;
            }
            loops--;
        } while (loops > 0);

        return null;
    }

    public static async join(passcode: string, userId: string) {
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            const queue: Queue = queueDao.data;

            // Check if queue is active
            if (!queue.accessToken) {
                const isOwner = queue.owner === userId;
                logger.debug(`Queue is not active. Not allowed to join. Is owner: ${isOwner}.`, { user: userId, passcode });
                throw { status: 403, message: "Queue not active. The owner needs to reactivate it.", isOwner };
            }

            if (!userId) {
                userId = randomstring.generate();
            }
            logger.info(`User joining to queue`, { user: userId, passcode });

            const user = {
                id: userId,
                spotifyUserId: null,
                points: config.gamify.initialPoints
            };

            if (!queue.users.find( user => user.id === userId)) {
                logger.info(`User not yet part of queue...adding`, { user: userId, passcode });
                queue.users.push(user);
                
                try {
                    await QueueService.updateQueueData(queue, passcode);
                    return false;
                } catch (err) {
                    logger.error("Error when inserting user into queue", { user: userId, passcode });
                    logger.error(err, { user: userId, passcode });
                    throw { status: 400, message: "Error while adding user into database. Please try again later." };
                }
            } else {
                logger.info(`User already part of ${passcode}...authorize`, { user: userId, passcode });
                return (queue.owner === userId);
            }
        } catch (err) {
            throw { status: 500, message: err.message };
        }
    }

    public static async logout(passcode: string, user: string) {
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            // Inactivate queue if logged out user is the owner
            const queue: Queue = queueDao.data;
            if (user === queue.owner) {
                queue.currentTrack = null;
                queue.accessToken = null;
                queue.refreshToken = "";
                QueueService.updateQueue(queue, false, passcode).catch(err => {
                    logger.error(err, { user, passcode });
                    throw { status: 500, message: "Unable to save logout state to database. Please try again later." };
                });
            }
            return;
        } catch (err) {
            throw { status: 500, message: err.message };
        }
    }

    public static async isOwner(passcode: string, userId: string) {
        try {
            const queueDao = await QueueService.getQueue(passcode);
            if (queueDao.data.owner !== userId) {
                throw { status: 401, message: "Owner permission required for QueueService action." };
            }

            return true;
        } catch (err) {
            throw { status: 500, message: err.message };
        }
    }

    public static activateQueue(queue: Queue, accessToken: string, passcode: string) {
        return QueueService.updateLoginState(queue, accessToken, passcode);
    }

    public static async getCurrentTrack(passcode: string, user: string) {
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            const queue: Queue = queueDao.data;

            // Check that access token is still valid.
            // This function is called from playback loop so we need this to be here
            await Acl.isAuthorized(passcode, user);

            const currentState: CurrentState = {
                accessToken: queue.accessToken,
                currentTrack: queue.currentTrack,
                isSpotiquPlaying: queueDao.isPlaying,
                isSpotifyPlaying: queueDao.isPlaying,
                playlistId: queue.playlistId,
                deviceId: queue.deviceId
            };
            // Get response if Spotify is playing
            try {
                const spotifyCurrentTrack = await SpotifyService.currentlyPlaying(queue.accessToken!, user, passcode);

                // Go with spotify's data if our current track equals to spotify's current track
                const spotiquCurrenTrack = queue.currentTrack;
                if (spotifyCurrentTrack.item) {
                    const owner = (queue.currentTrack && queue.currentTrack.track.id === spotifyCurrentTrack.item.id) ?
                        queue.currentTrack.owner : user;
                    const votes = (queue.currentTrack) ? queue.currentTrack.votes : [];
                    queue.currentTrack = {
                        owner,
                        track: spotifyCurrentTrack.item,
                        votes
                    };
                }
                queue.deviceId = spotifyCurrentTrack.device.id;

                currentState.currentTrack = queue.currentTrack;
                currentState.deviceId = queue.deviceId;
                currentState.isSpotifyPlaying = spotifyCurrentTrack.is_playing;

                if (spotifyCurrentTrack.item) {
                    logger.debug(
                        `Spotify state ${spotifyCurrentTrack.item.id}. ` +
                        `isPlaying: ${spotifyCurrentTrack.is_playing}, ` +
                        `progress: ${spotifyCurrentTrack.progress_ms}ms`, { user, passcode });
                } else {
                    logger.debug(
                        `Spotify has no current track. ` +
                        `isPlaying: ${spotifyCurrentTrack.is_playing}, ` +
                        `progress: ${spotifyCurrentTrack.progress_ms}ms`, { user, passcode });
                }

                if (spotiquCurrenTrack) {
                    logger.debug(
                        `Spotiqu state ${spotiquCurrenTrack.track.id}. ` +
                        `isPlaying: ${queueDao.isPlaying}, ` +
                        `progress: ${spotiquCurrenTrack.track.progress}ms`, { user, passcode });
                } else {
                    logger.debug(
                        `Spotiqu has no current track. ` +
                        `isPlaying: ${queueDao.isPlaying}.`, { user, passcode });
                }
                // Sync with Spotify
                logger.debug(`Syncing current track data and device id with Spotify...`, { user, passcode });
                QueueService.updateQueueData(queue, passcode);

                return currentState;
            } catch (err) {
                if (err.status === 404) {
                    throw { status: 404, message: "" }
                }

                logger.warn("Unable to get track progress from Spotify...mobile device?", { user, passcode });
                // If we think we are playing, just start playing
                if (queueDao.isPlaying && queue.deviceId) {
                    SpotifyService.setDevice(queue.accessToken!, queueDao.isPlaying, queue.deviceId).catch(err => {
                        logger.error("Unable to select device...", { user, passcode });
                        logger.error(err.response.data.error.message, { user, passcode });
                        throw { status: 204, message: "" }
                    });
                } else {
                    logger.warn("Stop playback timer if we ever get here...Strange state we have.", { user, passcode });
                    QueueService.stopPlaying(queue, queue.accessToken!, passcode, user);
                    throw { status: 204, message: "" }
                }

                currentState.isSpotifyPlaying = false;
                return currentState;
            }
        } catch(err) {
            logger.error(err, { user, passcode });
            throw { status: err.status || 500, message: "Failed to get currently playing track." };
        }
    }

    public static async removeFromQueue(passcode: string, user: string, trackId: string) {
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            const q = queueDao.data;
            let found = false;
            for (let i = q.queue.length - 1; i >= 0; --i) {
                if (q.queue[i].track.id === trackId && q.queue[i].userId === user) {
                    q.queue.splice(i, 1);
                    found = true;
                    break;
                }
            }

            if (found) {
                QueueService.updateQueueData(q, passcode).catch(err => {
                    logger.error(err, { user, passcode });
                    throw { status: 500, message: "Error occurred while removing song from queue. Please try again later." };
                });
            } else {
                throw { status: 404, message: "Cannot remove selected song. Only own songs can be removed." };
            }
        } catch (err) {
            throw { status: 500, message: err.message };
        }
    }

    public static async skip(passcode: string, user: string, trackId: string) {
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            if (queueDao.data.currentTrack &&
                queueDao.data.accessToken &&
                queueDao.data.currentTrack.track.id === trackId &&
                queueDao.data.currentTrack.owner === user) {
                    QueueService.startNextTrack(passcode, user, queueDao.data.accessToken);
                    return;
            } else {
                throw { status: 404, message: "Cannot skip current song. Only own songs can be skipped." };
            }
        } catch (err) {
            throw { status: 500, message: err.message };
        }
    }

    public static async addToPlaylistQueue(user: string, passcode: string, tracks: SpotifyTrack[], playlistId: string) {
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            const queue: Queue = queueDao.data;

            logger.info(`Adding ${tracks.length} tracks to playlist queue...`, { user, passcode });
            queue.playlistId = playlistId;
            queue.playlistTracks = [];
            tracks.forEach(track => {
                const item: QueueItem = {
                    track,
                    userId: null
                };
                queue.playlistTracks.push(item);
            });

            await db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]);
            logger.debug(`Tracks added to playlist queue successfully`, { user, passcode });
            return queueDao;
        } catch(err) {
            logger.error(err, { user, passcode });
            throw { status: 500, message: err.message };
        }
    }

    public static async addToQueue(user: string, passcode: string, trackUri: string) {
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            const queue: Queue = queueDao.data;
            logger.info(`Getting track info for ${trackUri}`, { user, passcode });
            const track = await SpotifyService.getTrack(queue.accessToken!, trackUri);
            
            const item: QueueItem = {
                track,
                userId: user
            };

            logger.info(`Found track ${track.id}... pushing to queue...`, { user, passcode });
            queue.queue.push(item);

            await db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]);
            logger.debug(`Track ${track.id} queued successfully`, { user, passcode });

            return queueDao;
        } catch (err) {
            throw { status: 500, message: err.message };
        }
    }

    public static async getAccessToken(id: string) {
        try {
            const queueDao = await QueueService.getQueue(id);
            return queueDao.data.accessToken!;
        } catch (err) {
            throw { status: 500, message: err };
        }
    }

    public static async setDevice(passcode: string, user: string, deviceId: string) {
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            const queue: Queue = queueDao.data;
            queue.deviceId = deviceId;
            db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]).then(() => {
                logger.debug(`Device set successfully`, { user, passcode });
                return { accessToken: queue.accessToken!, isPlaying: queueDao.isPlaying };
            }).catch(err => {
                throw { status: 500, message: "Unable to update new device to database. Please try again later." };
            });
        } catch (err) {
            throw { status: 500, message: err.message };
        }
    }

    public static startPlaying(accessToken: string,
                        passcode: string,
                        user: string,
                        currentTrack: SpotifyTrack) {
        if (QueueService.timeouts[accessToken]) {
            clearTimeout(QueueService.timeouts[accessToken]);
        }

        const timeLeft = currentTrack.duration - currentTrack.progress;

        logger.info(`Starting ${Math.round(timeLeft / 1000)} second timer for ${currentTrack.id}...`, { user, passcode });
        QueueService.timeouts[accessToken] = setTimeout(() =>
            QueueService.checkTrackStatus(passcode, user),
            timeLeft - 1000
        );
    }

    public static stopPlaying(queue: Queue, accessToken: string, passcode: string, user: string) {
        if (QueueService.timeouts[accessToken]) {
            clearInterval(QueueService.timeouts[accessToken]);
            delete QueueService.timeouts[accessToken];
        }

        queue.currentTrack = null;

        db.query("UPDATE queues SET data = $1, is_playing=$2 WHERE id = $3", [queue, false, passcode])
        .then(() => {
            logger.info(`Successfully stopped playing...`, { user, passcode });
        }).catch(err => {
            logger.error(`Unable to update playback state`, { user, passcode });
            logger.error(err, { passcode });
        });
    }

    public static startOngoingTimers() {
        db.query("SELECT * FROM queues WHERE is_playing=true", []).then(res => {
            res.rows.forEach((row: QueueDao) => {
                if (row.data.accessToken) {
                    QueueService.checkTrackStatus(row.id, row.data.owner);
                }
            });
        }).catch(err => {
            logger.error(err);
        });
    }

    public static updateLoginState(queue: Queue, accessToken: string|null, passcode: string) {
        queue.accessToken = accessToken;
        return db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]);
    }

    public static updateQueue(queue: Queue, isPlaying: boolean, passcode: string) {
        return db.query("UPDATE queues SET data = $1, is_playing=$2 WHERE id = $3", [queue, isPlaying, passcode]);
    }
    public static updateQueueData(queue: Queue, passcode: string) {
        return db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]);
    }

    public static pauseResume(user: string, passcode: string) {
        return new Promise<boolean>((resolve, reject) => {
            QueueService.getQueue(passcode).then(queueDao => {
                if (queueDao.isPlaying) {
                    logger.debug(`Pausing playback...`, { user, passcode });
                    SpotifyService.pause(queueDao.data.accessToken!).then(() => {
                        QueueService.stopPlaying(queueDao.data, queueDao.data.accessToken!, passcode, user);
                        resolve(false);
                    }).catch(err => {
                        if (err.response) {
                            logger.error(err.response.data.error.message, { user, passcode });
                        } else {
                            logger.error(err);
                        }
                        reject({ status: 500, message: "Unable to pause playback. Please try again later." });
                    });
                } else {
                    logger.debug(`Resuming playback...`, { user, passcode });
                    if (queueDao.data.currentTrack) {
                        SpotifyService.resume(queueDao.data.accessToken!, queueDao.data.deviceId!).then(() => {
                            QueueService.startPlaying(queueDao.data.accessToken!, passcode, user, queueDao.data.currentTrack!.track);
                            QueueService.updateQueue(queueDao.data, true, passcode).then(() => {
                                resolve(true);
                            }).catch(() => {
                                reject({ status: 500, message: "Unable to save playback state. Please try again later." });
                            });
                        }).catch(err => {
                            if (err.response) {
                                if (err.response.data.error.status === 404) {
                                    logger.info("No device selected when trying to resume.", {user, passcode});
                                    reject({ status: 404, message: "No device selected. Please select a device from bottom left corner." });
                                    return;
                                } else {
                                    logger.error(err.response.data.error.message, {user, passcode});
                                }
                            } else {
                                logger.error(err);
                            }
                            reject({ status: 500, message: "Unable to resume playback. Please try again later." });
                        });
                    } else if (queueDao.data.queue.length > 0) {
                        QueueService.startNextTrack(passcode, user, queueDao.data.accessToken!);
                    } else {
                        logger.info(`Current track not found and queue empty. Unable to resume.`, { user, passcode });
                        reject({ status: 500, message: "Spotify didn't start playing. Please try again later." });
                    }
                }
            }).catch(err => {
                reject({ status: 500, message: err.message });
            });
        });
    }

    public static async updateSettings(passcode: string, user: string, settings: Settings) {
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            queueDao.data.settings = settings;
            await QueueService.updateQueueData(queueDao.data, passcode);
            return settings;
        } catch (err) {
            logger.error(err, { user, passcode });
            throw { status: 500, message: "Unexpected error occurred while saving the settings." };
        }
    }

    private static startNextTrack(passcode: string, user: string, accessToken: string) {
        logger.info(`Starting next track`, { user, passcode });
        QueueService.getQueue(passcode, true).then(queueDao => {
            if (queueDao.data.queue.length === 0 && queueDao.data.playlistTracks.length === 0) {
                logger.info("No more songs in queue. Stop playing.", { user, passcode });
                QueueService.stopPlaying(queueDao.data, accessToken, passcode, user);
                return;
            }
            const queue: Queue = queueDao.data;
            const nextIndex = (queue.queue.length > 0) ? 
                QueueService.getNextTrackIdx(queue.queue, queue.settings.randomQueue) :
                QueueService.getNextTrackIdx(queue.playlistTracks, queue.settings.randomPlaylist);
            const queuedItem = (queue.queue.length > 0) ?
                queue.queue.splice(nextIndex, 1)[0] :
                queue.playlistTracks.splice(nextIndex, 1)[0];
            const trackIds = [queuedItem.track.id];
            const previousTrack = queue.currentTrack;

            queue.currentTrack = {
                track: queuedItem.track,
                owner: queuedItem.userId,
                votes: []
            };

            logger.info(`Next track is ${queuedItem.track.id}`, { user, passcode });
            QueueService.updateQueue(queue, true, passcode).then(() => {
                SpotifyService.startSong(accessToken, trackIds, queue.deviceId!).then(() => {
                    QueueService.startPlaying(accessToken, passcode, user, queuedItem.track);
                    logger.info(`Track ${queuedItem.track.id} successfully started.`, { user, passcode });
                    if (previousTrack) {
                        Gamify.trackEndReward(passcode, previousTrack);
                    }
                }).catch((err: any) => {
                    logger.error(err.response.data.error.message, { user, passcode });
                    logger.error(`Unable to start track on Spotify.`, { user, passcode });
                });
            }).catch(err => {
                logger.error("Unable to update queue", { user, passcode });
                logger.error(err, { user, passcode });
            });
        }).catch(() => {
            logger.error("Unable to get queue when starting next track", { user, passcode });
        });
    }

    private static getNextTrackIdx(queue: QueueItem[], random: boolean) {
        if (random) {
            return (Math.random() * queue.length);
        } else {
            return 0;
        }
    }

    private static checkTrackStatus(passcode: string, user: string) {
        logger.info(`Checking playback state for currently playing track...`, { user, passcode });
        QueueService.getCurrentTrack(passcode, user).then((currentState: CurrentState) => {
            if (!currentState.isSpotiquPlaying) {
                logger.info(`We are paused so no need to do it...`, { user, passcode });
                return;
            }

            const timeLeft = currentState.currentTrack ?
                currentState.currentTrack.track.duration - currentState.currentTrack.track.progress : 0;

            // We can start next if spotify isn't playing anymore
            if (!currentState.isSpotifyPlaying && currentState.isSpotiquPlaying) {
                logger.info(`Track was already over...starting next`, { user, passcode });
                QueueService.startNextTrack(passcode, "", currentState.accessToken!);
            } else if (timeLeft < 5000) {
                logger.info(`Less than 5 secs left...initiating timer to start the next song...`, { user, passcode });
                // Start new song after timeLeft and check for that song's duration
                setTimeout(() => QueueService.startNextTrack(passcode, "", currentState.accessToken!), timeLeft - 1000);
            } else {
                // If there's still time, check for progress again after a while
                const seconds = Math.round(timeLeft / 1000);
                logger.info(
                    `Track ${currentState.currentTrack!.track.id} still playing for ${seconds} secs. Checking again after that.`,
                    { user, passcode });
                QueueService.timeouts[currentState.accessToken!] = setTimeout(() =>
                    QueueService.checkTrackStatus(passcode, ""),
                    timeLeft - 1000
                );
            }
        }).catch(err => {
            if (err.status === 404) {
                logger.info(err.message, { user, passcode });
            } else {
                logger.error("Unable to get currently playing track from spotify.", { user, passcode });
                logger.error(err, { user, passcode });
            }
        });
    }
}

export default QueueService;
