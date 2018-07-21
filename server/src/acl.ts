import * as express from "express";
import QueueService from "./queue.service";
import { Queue } from "./queue";
import { getCurrentSeconds } from "./util";
import { logger } from "./logger.service";
import SpotifyService from "./spotify.service";

export interface AuthResult {
    isAuthorized: boolean;
    passcode: string;
    isOwner: boolean;
}

class Acl {

    private static excludeEndpointsFromAuth = ["/join", "/create", "/reactivate", "/isAuthorized", "/queue", "/currentlyPlaying"];
    private static endpointsRequireOwnerPerm = ["/device", "/pauseResume", "/selectPlaylist", "/updateSettings", "/queuePlaylist"];

    public static saveAccessToken(queue: Queue, passcode: string, userId: string, accessToken: string, expiresIn: number, refreshToken?: string) {
        queue.accessToken = accessToken;
        queue.expiresIn = expiresIn;
        queue.accessTokenAcquired = getCurrentSeconds();
        if (refreshToken) {
            queue.refreshToken = refreshToken;
        }
        QueueService.updateQueueData(queue, passcode).catch(err => {
            logger.error("Failed to update queue refresh token.", { id: userId });
            logger.error(err);
        });
    }

    public static isAuthorized = (passcode: string, userId: string) => {
        return new Promise<AuthResult>((resolve, reject) => {
            if (!passcode) {
                reject({ status: 401, message: "Valid passcode required" });
                return;
            }
            QueueService.getQueue(passcode)
            .then(queueDao => {
                const queue: Queue = queueDao.data;

                // Queue is incative if we don't have accessToken nor refreshToken
                if (!queue.accessToken && !queue.refreshToken) {
                    reject({ status: 403, message: "Queue inactive. Owner should reactivate it." });
                } else {
                    SpotifyService.isAuthorized(passcode, userId, queue.accessTokenAcquired, queue.expiresIn, queue.refreshToken)
                        .then((response: any) => {
                        if (response) {
                            logger.info(`Got refresh token. Saving it...`, { userId, passcode });
                            Acl.saveAccessToken(queue, passcode, userId, response.access_token,
                                response.expires_in, response.refresh_token);
                        }
                        const isOwner = queue.owner === userId;
                        resolve({ isAuthorized: true, passcode, isOwner });
                    }).catch(err => {
                        reject(err);
                    });
                }
            }).catch(err => {
                logger.error(err, { id: userId });
                reject({ status: 500, message: "Unable to get queue with given passcode" });
            });
        });
    }

    public static authFilter = (req: express.Request, res: express.Response, next: () => any) => {
        if (Acl.excludeEndpointsFromAuth.includes(req.path)) {
            return next();
        } else {
            Acl.isAuthorized(req.cookies.get("passcode"), req.cookies.get("user")).then(() => {
                return next();
            }).catch(err => {
                return res.status(err.status).json({ message: err.message });
            });
        }
    }

    public static adminFilter = (req: express.Request, res: express.Response, next: () => any) => {
        if (Acl.endpointsRequireOwnerPerm.includes(req.path)) {
            QueueService.isOwner(req.cookies.get("passcode"), req.cookies.get("user")).then(() => {
                return next();
            }).catch(err => {
                return res.status(err.status).json({ message: err.message });
            });
        } else {
            return next();
        }
    }
}

export default Acl;
