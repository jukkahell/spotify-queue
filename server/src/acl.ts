import QueueService from "./queue.service";
import Spotify from "./spotify.service";
import { Queue } from "./queue";
import { getCurrentSeconds } from "./util";
import * as winston from "winston";

export interface AuthResult {
    isAuthorized: boolean;
    passcode: string;
    isOwner: boolean;
}

class Acl {
    private spotify: Spotify;
    private queueService: QueueService;
    private logger: winston.Logger;

    constructor(logger: winston.Logger, spotify: Spotify, queueService: QueueService) {
        this.spotify = spotify;
        this.queueService = queueService;
        this.logger = logger;
    }

    public saveAccessToken(queue: Queue, passcode: string, userId: string, accessToken: string, expiresIn: number, refreshToken?: string) {
        queue.accessToken = accessToken;
        queue.expiresIn = expiresIn;
        queue.accessTokenAcquired = getCurrentSeconds();
        if (refreshToken) {
            queue.refreshToken = refreshToken;
        }
        this.queueService.updateQueueData(queue, passcode).catch(err => {
            this.logger.error("Failed to update queue refresh token.", { id: userId });
            this.logger.error(err);
        });
    }

    public isAuthorized = (passcode: string, userId: string) => {
        return new Promise<AuthResult>((resolve, reject) => {
            if (!passcode) {
                reject({ status: 401, message: "Valid passcode required" });
                return;
            }
            this.queueService.getQueue(passcode)
            .then(queueDao => {
                const queue: Queue = queueDao.data;

                // Queue is incative if we don't have accessToken nor refreshToken
                if (!queue.accessToken && !queue.refreshToken) {
                    reject({ status: 403, message: "Queue inactive. Owner should reactivate it." });
                } else {
                    this.spotify.isAuthorized(passcode, userId, queue.accessTokenAcquired, queue.expiresIn, queue.refreshToken)
                        .then((response: any) => {
                        if (response) {
                            this.logger.info(`Got refresh token. Saving it...`, { userId, passcode });
                            this.saveAccessToken(queue, passcode, userId, response.access_token,
                                response.expires_in, response.refresh_token);
                        }
                        const isOwner = queue.owner === userId;
                        resolve({ isAuthorized: true, passcode, isOwner });
                    }).catch(err => {
                        reject(err);
                    });
                }
            }).catch(err => {
                this.logger.error(err, { id: userId });
                reject({ status: 500, message: "Unable to get queue with given passcode" });
            });
        });
    }
}

export default Acl;
