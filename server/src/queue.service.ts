import * as randomstring from "randomstring";
import * as winston from "winston";
import { QueryResult } from "../node_modules/@types/pg";
import { AxiosPromise } from "../node_modules/axios";
import * as db from "./db";
import { Queue, QueueItem, QueueDao } from "./queue";
import { SpotifyTrack } from "./spotify";
import SpotifyService from "./spotify.service";
import { getCurrentSeconds } from "./util";

export interface QueueTimeout {
    [accessToken: string]: NodeJS.Timer;
}

class QueueService {

    private static timeouts: QueueTimeout = {};
    private logger: winston.Logger;

    constructor (logger: winston.Logger) {
        this.logger = logger;
    }

    public async getQueue(passcode: string, forUpdate?: boolean): Promise<QueueDao> {
        let query = "SELECT * FROM queues WHERE id = $1";
        if (forUpdate) {
            query = "SELECT * FROM queues WHERE id = $1 FOR UPDATE";
        }

        try {
            const result: QueryResult = await db.query(query, [passcode]);
            if (result.rowCount === 1) {
                return result.rows[0];
            } else {
                throw Error("Unable to find queue with given passcode.");
            }
        } catch (err) {
            this.logger.error("Error occurred while fetching queue from database", { passcode });
            this.logger.error(err, { passcode });
            throw Error("Error occurred while fetching queue from database. Please try again later.");
        }
    }

    public getQueueBySpotifyId(spotifyUserId: string) {
        return db.query("SELECT * FROM queues WHERE owner = $1", [spotifyUserId]);
    }

    public create(spotify: SpotifyService, code: string) {
        return new Promise<QueueDao>((resolve, reject) => {
            let accessToken: string;
            let refreshToken: string;
            let expiresIn: number;

            this.logger.debug(`Creating new queue...`);

            spotify.getToken(code, "create")
            // Token received
            .then((response: any) => {
                accessToken = response.data.access_token;
                refreshToken = response.data.refresh_token;
                expiresIn = response.data.expires_in;
                this.logger.debug("Received access token...going to get username");
                return spotify.getUser(accessToken);
            })
            // User data received
            .then((response: any) => {
                const spotifyUserId = response.data.id;
                let passcode: string;
                let userId: string;

                this.logger.debug(`Found spotify userId...trying to find existing queues`, { id: spotifyUserId });

                // Check if this user already has a queue
                this.getQueueBySpotifyId(spotifyUserId)
                .then(result => {
                    if (result.rowCount === 1) {
                        const queue: QueueDao = result.rows[0];
                        queue.data.refreshToken = refreshToken;
                        queue.data.expiresIn = expiresIn;
                        queue.data.accessTokenAcquired = getCurrentSeconds();
                        passcode = queue.id;
                        userId = (queue.data.users.find(user => user.spotifyUserId === spotifyUserId))!.id;
                        this.logger.info(`Found existing queue`, { user: userId, passcode });
                        this.activateQueue(queue.data, accessToken, passcode).then(() => {
                            resolve(queue);
                        });
                    } else {
                        this.generatePasscode().then(passcode => {
                            userId = randomstring.generate();
                            this.logger.info(`Generated passcode`, { user: userId, passcode });
                            if (passcode) {
                                const queue: Queue = this.createQueueObject(spotifyUserId, accessToken, passcode,
                                    userId, refreshToken, expiresIn);
                                this.createQueue(passcode, spotifyUserId, queue).then(() => {
                                    resolve({ id: passcode, data: queue, owner: spotifyUserId });
                                }).catch(err => {
                                    this.logger.error(`Unable to insert queue into database`, { user: userId, passcode });
                                    this.logger.error(err, { user: userId, passcode });
                                    reject({ status: 500,
                                        message: "Error occured while inserting queue into database. Please try again later." });
                                });
                            } else {
                                throw new Error("Unable to generate unique passcode. Please try again later");
                            }
                        }).catch(err => {
                            this.logger.error(err, { user: userId, passcode });
                            reject({ status: 500, message: err.message });
                        });
                    }
                }).catch(err => {
                    this.logger.error(err);
                    reject( { status: 500, message: "Unable to create queue. Please try again in a moment." });
                });
            }).catch((err: any) => {
                this.logger.error(err.response.data);
                reject({ status: 500, message: "Failed to authenticate." });
            });
        });
    }

    public reactivate(spotify: SpotifyService, passcode: string, userId: string, code: string) {
        return new Promise<Queue>((resolve, reject) => {
            let accessToken: string;
            let refreshToken: string;
            let expiresIn: number;

            this.logger.info(`Reactivating queue...`, { user: userId, passcode });

            spotify.getToken(code, "reactivate")
            // Token received
            .then((response: any) => {
                accessToken = response.data.access_token;
                refreshToken = response.data.refresh_token;
                expiresIn = response.data.expires_in;
                this.logger.info("Access token received...going to get username", { user: userId, passcode });
                return spotify.getUser(accessToken);
            })
            // User data received
            .then((response: any) => {
                const spotifyUserId = response.data.id;
                this.logger.debug(`Found spotify userId ${spotifyUserId}...trying to reactivate`, { user: userId, passcode });

                this.getQueue(passcode, true).then(queueDao => {
                    if (queueDao.owner === spotifyUserId) {
                        queueDao.data.accessToken = accessToken;
                        queueDao.data.refreshToken = refreshToken;
                        queueDao.data.expiresIn = expiresIn;

                        if (!userId) {
                            userId = randomstring.generate();
                        }

                        // Update userId if cookie was missing or has changed
                        if (userId !== queueDao.data.owner) {
                            this.logger.info(`Queue owner's userid was missing or has changed from ${queueDao.data.owner}...syncing`,
                                { user: userId, passcode });
                            queueDao.data.owner = userId;
                            const i = queueDao.data.users.findIndex(user => user.spotifyUserId !== null);
                            const ownerUser = queueDao.data.users[i];
                            ownerUser.id = userId;
                            queueDao.data.users[i] = ownerUser;
                        }

                        this.updateQueue(queueDao.data, passcode).then(() => {
                            this.logger.debug(`Successfully reactivated`, { user: userId, passcode });
                            resolve(queueDao.data);
                        }).catch(err => {
                            this.logger.error(`Unable to reactivate queue into database`, { user: userId, passcode });
                            this.logger.error(err, { user: userId, passcode });
                            reject({ status: 500, message: "Error occured while reactivating queue. Please try again later." });
                        });
                    } else {
                        reject({ status: 500, message: "Cannot reactivate queue since you're not the owner." });
                    }
                }).catch(err => {
                    reject({ status: 500, message: err.message });
                });
            }).catch((err: any) => {
                this.logger.error(err, { user: userId, passcode });
                reject({ status: 500, message: "Unable to get data from spotify. Please try again later." });
            });
        });
    }

    public createQueueObject(spotifyUserId: string, accessToken: string, passcode: string,
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
            isPlaying: false,
            queue: [],
            settings: {
                alwaysPlay: {
                    playlistId: null,
                    random: false
                },
                gamify: false
            },
            users: [
                {
                    id: userId,
                    spotifyUserId,
                    points: 0
                }
            ]
        };
    }

    public createQueue(passcode: string, spotifyUserId: string, queue: Queue) {
        this.logger.info(`Creating new queue`, { user: queue.owner, passcode });
        return db.query("INSERT INTO queues (id, owner, data) VALUES ($1, $2, $3)", [passcode, spotifyUserId, queue]);
    }

    public async generatePasscode(): Promise<string|null> {
        let loops = 10;
        let passcode = null;

        do {
            passcode = randomstring.generate({ readable: true, length: 8, charset: "alphanumeric" });
            const results = await db.query("SELECT 1 FROM queues WHERE id = $1", [passcode]);
            if (results.rowCount === 0) {
                return passcode;
            }
            loops--;
        } while (loops > 0);

        return null;
    }

    public join(passcode: string, userId: string) {
        return new Promise<boolean>((resolve, reject) => {
            this.getQueue(passcode, true).then(queueDao => {
                const queue: Queue = queueDao.data;

                // Check if queue is active
                if (!queue.accessToken) {
                    const isOwner = queue.owner === userId;
                    this.logger.debug(`Queue is not active. Not allowed to join. Is owner: ${isOwner}.`, { user: userId, passcode });
                    return reject({ status: 403, message: "Queue not active. The owner needs to reactivate it.", isOwner });
                }

                if (!userId) {
                    userId = randomstring.generate();
                }
                this.logger.info(`User joining to queue`, { user: userId, passcode });

                const user = {
                    id: userId,
                    spotifyUserId: null,
                    points: 0
                };

                if (!queue.users.find( user => user.id === userId)) {
                    this.logger.info(`User not yet part of queue...adding`, { user: userId, passcode });
                    queue.users.push(user);
                    this.updateQueue(queue, passcode)
                    .then(() => {
                        resolve(false);
                    }).catch(err => {
                        this.logger.error("Error when inserting user into queue", { user: userId, passcode });
                        this.logger.error(err, { user: userId, passcode });
                        reject({ status: 400, message: "Error while adding user into database. Please try again later." });
                    });
                } else {
                    this.logger.info(`User already part of ${passcode}...authorize`, { user: userId, passcode });
                    resolve(queue.owner === userId);
                }
            }).catch(err => {
                reject({ status: 500, message: err.message });
            });
        });
    }

    public logout(passcode: string, user: string) {
        return new Promise((resolve, reject) => {
            this.getQueue(passcode, true).then(queueDao => {
                // Inactivate queue if logged out user is the owner
                const queue: Queue = queueDao.data;
                if (user === queue.owner) {
                    queue.isPlaying = false;
                    queue.currentTrack = null;
                    queue.accessToken = null;
                    queue.refreshToken = "";
                    this.updateQueue(queue, passcode).then(result => {
                        resolve();
                    }).catch(err => {
                        this.logger.error(err, { user, passcode });
                        reject({ status: 500, message: "Unable to save logout state to database. Please try again later." });
                    });
                } else {
                    resolve();
                }
            }).catch(err => {
                reject({ status: 500, message: err.message });
            });
        });
    }

    public isOwner(passcode: string, userId: string) {
        return new Promise((resolve, reject) => {
            this.getQueue(passcode).then(queueDao => {
                if (queueDao.data.owner === userId) {
                    resolve();
                } else {
                    reject({ status: 401, message: "Owner permission required for this action." });
                }
            }).catch(err => {
                reject({ status: 500, message: err.message });
            });
        });
    }

    public activateQueue(queue: Queue, accessToken: string, passcode: string) {
        return this.updateLoginState(queue, accessToken, passcode);
    }
    public inactivateQueue(queue: Queue, passcode: string) {
        return this.updateLoginState(queue, null, passcode);
    }

    public getCurrentTrack(passcode: string, user: string, spotify: SpotifyService) {
        return new Promise((resolve, reject) => {
            this.getQueue(passcode).then(queueDao => {
                const queue: Queue = queueDao.data;

                if (queue.currentTrack && queue.accessToken) {
                    this.logger.debug(`Getting currently playing track ${queue.currentTrack.track.id} from spotify...`, { user, passcode });

                    spotify.currentlyPlaying(queue.accessToken).then(response => {
                        queue.currentTrack!.track.progress = response.data.progress_ms;

                        this.logger.debug(`Found track. isPlaying: ${response.data.is_playing}, progress: ${response.data.progress_ms}ms`, { user, passcode });
                        
                        // If is_playing info is out of sync with Spotify
                        if (queue.isPlaying !== response.data.is_playing) {
                            this.logger.debug(`isPlaying state was out of sync...updating`, { user, passcode });
                            queue.isPlaying = response.data.is_playing;
                            this.getQueue(passcode, true).then(queueDao => {
                                const q: Queue = queueDao.data;
                                q.isPlaying = response.data.is_playing;
                                this.updateQueue(q, passcode)
                                .then(() => {
                                    this.logger.debug(`isPlaying state updated`, { user, passcode });
                                }).catch(err => {
                                    this.logger.error("Failed to update isPlaying state.", { user, passcode });
                                    this.logger.error(err, { user, passcode });
                                });
                            }).catch(err => {
                                this.logger.error("Failed to get queue when saving playing state", { user, passcode });
                            });
                        }

                        resolve({ currentTrack: queue.currentTrack, isPlaying: queue.isPlaying });
                    }).catch(() => {
                        this.logger.warn("Unable to get track progress from Spotify...resolve anyway.", { user, passcode });
                        resolve({ currentTrack: queue.currentTrack, isPlaying: queue.isPlaying });
                    });
                } else if (!queue.currentTrack) {
                    reject({ status: 204, message: "Current track not found"});
                } else {
                    reject({ status: 403, message: "Queue inactive. Owner should reactivate it." });
                }
            }).catch(() => {
                reject({ status: 500, message: "Queue not found with the given passcode." });
            });
        });
    }

    public addToQueue(user: string, passcode: string, trackUri: string,
                      getTrackInfo: (accessToken: string, trackId: string) => AxiosPromise) {
        return new Promise((resolve, reject) => {
            this.getQueue(passcode, true).then(queueDao => {
                const queue: Queue = queueDao.data;
                const trackId = trackUri.split(":")[2];
                this.logger.info(`Getting track info for ${trackId}`, { user, passcode });
                getTrackInfo(queue.accessToken!, trackId).then(trackResponse => {
                    const track: SpotifyTrack = {
                        artist: trackResponse.data.artists[0].name,
                        id: trackUri,
                        duration: trackResponse.data.duration_ms,
                        cover: trackResponse.data.album.images[1].url,
                        name: trackResponse.data.name,
                        progress: 0
                    };
                    const item: QueueItem = {
                        track,
                        userId: user
                    };

                    this.logger.info(`Found track ${track.id}... pushing to queue...`, { user, passcode });
                    queue.queue.push(item);

                    db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]).then(() => {
                        this.logger.debug(`Track ${track.id} queued successfully`, { user, passcode });
                        resolve(queue);
                    }).catch(err => {
                        this.logger.error(err, { user, passcode });
                        reject({ status: 500, message: "Error when adding song to queue" });
                    });
                }).catch(err => {
                    this.logger.error(err, { user, passcode });
                    reject({ status: 500, message: "Unable to get track info for queued song from Spotify" });
                });
            }).catch(err => {
                reject({ status: 500, message: err.message });
            });
        });
    }

    public getAccessToken(id: string) {
        return new Promise<string>((resolve, reject) => {
            this.getQueue(id).then(queueDao => {
                resolve(queueDao.data.accessToken!);
            }).catch(err => {
                reject({ status: 500, message: err });
            })
        });
    }

    public setDevice(passcode: string, user: string, deviceId: string) {
        return new Promise((resolve, reject) => {
            this.getQueue(passcode, true).then(queueDao => {
                const queue: Queue = queueDao.data;
                queue.deviceId = deviceId;
                db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]).then(() => {
                    this.logger.debug(`Device set successfully`, { user, passcode });
                    resolve({ accessToken: queue.accessToken!, isPlaying: queue.isPlaying });
                }).catch(err => {
                    reject({ status: 500, message: "Unable to update new device to database. Please try again later." });
                });
            }).catch(err => {
                reject({ status: 500, message: err.message });
            });
        });
    }

    public startPlaying(accessToken: string,
                        passcode: string,
                        user: string,
                        currentTrack: SpotifyTrack,
                        spotify: SpotifyService,
                        startNextTrack: (passcode: string, user: string, accessToken: string) => void) {
        if (QueueService.timeouts[accessToken]) {
            clearTimeout(QueueService.timeouts[accessToken]);
        }

        const timeLeft = currentTrack.duration;

        this.logger.info(`Starting ${timeLeft} second timer for ${currentTrack.id}...`, { user, passcode });
        QueueService.timeouts[accessToken] = setTimeout(() =>
            this.checkTrackStatus(accessToken, passcode, user, currentTrack, spotify, startNextTrack),
            timeLeft - 1000
        );
    }

    public stopPlaying(queue: Queue, accessToken: string, passcode: string) {
        if (QueueService.timeouts[accessToken]) {
            clearInterval(QueueService.timeouts[accessToken]);
            delete QueueService.timeouts[accessToken];
        }

        queue.isPlaying = false;
        queue.currentTrack = null;

        db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode])
        .then(() => {
            this.logger.info(`Successfully stopped playing...`, { passcode });
        }).catch(err => {
            this.logger.error(`Unable to update playback state`, { passcode });
            this.logger.error(err, { passcode });
        });
    }

    public updateLoginState(queue: Queue, accessToken: string|null, passcode: string) {
        queue.accessToken = accessToken;
        return db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]);
    }

    public updateQueue(queue: Queue, passcode: string) {
        return db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]);
    }

    private checkTrackStatus(accessToken: string,
                            passcode: string,
                            user: string,
                            currentTrack: SpotifyTrack,
                            spotify: SpotifyService,
                            startNextTrack: (passcode: string, user: string, accessToken: string) => void) {

        this.logger.info(`Checking playback state for track ${currentTrack.id}...`, { user, passcode });
        spotify.currentlyPlaying(accessToken).then(resp => {
            const timeLeft = resp.data.item.duration_ms - resp.data.progress_ms;

            // If song is already over (for some reason)
            if (!resp.data.is_playing) {
                this.logger.info(`Track ${currentTrack.id} was already over...starting next`, { user, passcode });
                startNextTrack(passcode, user, accessToken);
            } else if (timeLeft < 5000) {
                this.logger.info(`Less than 5 secs left on track ${currentTrack.id}...initiating timer to start the next song...`,
                    { user, passcode });
                // Start new song after timeLeft and check for that song's duration
                setTimeout(() => startNextTrack(passcode, user, accessToken), timeLeft - 1000);
            } else {
                // If there's still time, check for progress again after a while
                this.logger.info(`Track ${currentTrack.id} still playing for ${(timeLeft / 1000)} secs. Checking again after that.`,
                    { user, passcode });
                QueueService.timeouts[accessToken] = setTimeout(() =>
                    this.checkTrackStatus(accessToken, passcode, user, currentTrack, spotify, startNextTrack),
                    timeLeft - 1000
                );
            }
        }).catch(err => {
            this.logger.error("Unable to get currently playing track from spotify.", { user, passcode });
            this.logger.error(err, { user, passcode });
        });
    }
}

export default QueueService;
