import * as db from "./db";
import { Queue, QueueItem, CurrentTrack } from "./queue";
import { SpotifyTrack } from "./spotify";
import { AxiosPromise } from "../node_modules/axios";
import SpotifyService from "./spotify.service";
import { getCurrentSeconds } from "./util";

export interface QueueTimeout {
    [accessToken: string]: NodeJS.Timer;
}

class QueueService {

    private static timeouts: QueueTimeout = {};

    public getQueue(id: string, forUpdate?: boolean) {
        if (forUpdate) {
            return db.query("SELECT * FROM queues WHERE id = $1 FOR UPDATE", [id]);
        } else {
            return db.query("SELECT * FROM queues WHERE id = $1", [id]);
        }
    }

    public getQueueBySpotifyId(spotifyUserId: string) {
        return db.query("SELECT * FROM queues WHERE owner = $1", [spotifyUserId])
    }

    public createQueue(spotifyUserId: string, accessToken: string, passcode: string, userId: string, refreshToken: string, expiresIn: number) {
        console.log(`Creating new queue for userId ${userId}`);

        const queue: Queue = {
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
                    spotifyUserId: spotifyUserId,
                    points: 0
                }
            ]
        };
        
        return db.query("INSERT INTO queues (id, owner, data) VALUES ($1, $2, $3)", [passcode, spotifyUserId, queue]);
    }

    public activateQueue(queue: Queue, accessToken: string, passcode: string) {
        return this.updateLoginState(queue, accessToken, passcode);
    }
    public inactivateQueue(queue: Queue, passcode: string) {
        return this.updateLoginState(queue, null, passcode);
    }

    public getCurrentTrack(passcode: string, onSuccess: (accessToken: string, currentTrack: CurrentTrack, isPlaying: boolean) => void, onError: () => void) {
        this.getQueue(passcode).then(result => {
            if (result.rowCount === 1) {
                const queue: Queue = result.rows[0].data;
                if (queue.currentTrack) {
                    onSuccess(queue.accessToken!, queue.currentTrack, queue.isPlaying);
                } else {
                    onError();
                }
            }
        }).catch(err => {
            console.log(err);
            onError();
        });
    }

    public addToQueue(userId: string, id: string, trackUri: string, getTrackInfo: (accessToken:string, trackId: string) => AxiosPromise) {
        return new Promise((resolve, reject) => {
            this.getQueue(id, true).then(result => {
                if (result.rowCount === 1) {
                    const queue: Queue = result.rows[0].data;
                    const trackId = trackUri.split(":")[2];
                    getTrackInfo(queue.accessToken!, trackId).then(trackResponse => {
                        const track: SpotifyTrack = {
                            artist: trackResponse.data.artists[0].name,
                            id: trackUri,
                            duration: trackResponse.data.duration_ms,
                            cover: trackResponse.data.album.images[1].url,
                            name: trackResponse.data.name,
                            progress: 0
                        }
                        const item: QueueItem = {
                            track,
                            userId
                        }

                        queue.queue.push(item);

                        db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, id]).then(updateResult => {
                            resolve(queue);
                        }).catch(err => {
                            console.log(err);
                            reject("Error when adding song to queue");
                        });
                    }).catch(err => {
                        console.log(err);
                        reject("Unable to get track info for queued song from Spotify");
                    });
                }
            }).catch(err => {
                reject("Unable to find queue");
            });
        });
    }

    public getAccessToken(id: string, callback: (accessToken?: string) => void, onError: (err: any) => void) {
        this.getQueue(id).then(result => {
            if (result.rowCount === 1) {
                callback(result.rows[0].data.accessToken);
            } else {
                onError("Queue not found with given passcode.");
            }
        }).catch(err => {
            onError(err);
        })
    }

    public setDevice(passcode: string, deviceId: string) {
        this.getQueue(passcode, true).then(result => {
            if (result.rowCount === 1) {
                const queue: Queue = result.rows[0].data;
                queue.deviceId = deviceId;
                db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]);
            }
        }).catch(err => {
            console.log(err);
        })
    }

    public startPlaying(accessToken: string, 
                        passcode: string, 
                        currentTrack: SpotifyTrack, 
                        spotify: SpotifyService,
                        startNextTrack: (passcode: string, accessToken: string) => void) {
        if (QueueService.timeouts[accessToken]) {
            clearTimeout(QueueService.timeouts[accessToken]);
        }

        const timeLeft = currentTrack.duration;

        QueueService.timeouts[accessToken] = setTimeout(() => 
            this.checkTrackStatus(accessToken, passcode, currentTrack, spotify, startNextTrack), 
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
        db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]).catch(err => {
            console.log(`Unable to set playback state for passcode ${passcode}`, err);
        });
    }

    public updateLoginState(queue:Queue, accessToken: string|null, passcode: string) {
        queue.accessToken = accessToken;
        return db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]);
    }

    public updateQueue(queue:Queue, passcode: string) {
        return db.query("UPDATE queues SET data = $1 WHERE id = $2", [queue, passcode]);
    }

    private checkTrackStatus(accessToken: string, 
                            passcode: string, 
                            currentTrack: SpotifyTrack, 
                            spotify: SpotifyService,
                            startNextTrack: (passcode: string, accessToken: string) => void) {

        spotify.currentlyPlaying(accessToken).then(resp => {
            const timeLeft = resp.data.item.duration_ms - resp.data.progress_ms;

            // If song is almost over
            if (timeLeft < 5000) {
                console.log("Less than 5 secs left...initiating timer to start the next song...");
                // Start new song after timeLeft and check for that song's duration
                setTimeout(() => startNextTrack(passcode, accessToken), timeLeft - 500);
            } else {
                // If there's still time, check for progress again after a while
                console.log("Song still playing for " + (timeLeft / 1000) + " secs. Check again after that.");
                QueueService.timeouts[accessToken] = setTimeout(() => 
                    this.checkTrackStatus(accessToken, passcode, currentTrack, spotify, startNextTrack), 
                    timeLeft - 1000
                );
            }
        }).catch(err => {
            console.log("Unable to get currently playing track from spotify.", err);
        });
    }
}

export default QueueService;