import * as express from "express";
import QueueService from "./queue.service";
import { Queue, User } from "./queue";
import { getCurrentSeconds } from "./util";
import { logger } from "./logger.service";
import SpotifyService from "./spotify.service";

export interface AuthResult {
    isAuthorized: boolean;
    passcode: string;
    isOwner: boolean;
}

class Acl {

    private static excludeEndpointsFromAuth = ["/join", "/create", "/reactivate", "/isAuthorized", "/queue", "/currentlyPlaying", "/logout", "/visitorAuth"];
    private static endpointsRequireOwnerPerm = ["/device", "/pauseResume", "/selectPlaylist", "/updateSettings", "/queuePlaylist", "/removeUser", "/resetPoints"];
    private static visitorAuthRequired = ["/playlists"];

    public static async saveAccessToken(passcode: string, userId: string, accessToken: string, expiresIn: number, refreshToken?: string) {
        const queueDao = await QueueService.getQueue(passcode, true);
        const queue = queueDao.data;
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

    public static async saveUserAccessToken(passcode: string, userId: string, accessToken: string, expiresIn: number, refreshToken?: string) {
        const queueDao = await QueueService.getQueue(passcode, true);
        const queue = queueDao.data;
        const userIdx = queue.users.findIndex((user: User) => user.id === userId);
        if (userIdx > 0) { 
            const user = queue.users[userIdx];
            user.accessToken = accessToken;
            user.expiresIn = expiresIn;
            user.accessTokenAcquired = getCurrentSeconds();
            if (refreshToken) {
                user.refreshToken = refreshToken;
            }
            queue.users[userIdx] = user;

            QueueService.updateQueueData(queue, passcode).catch(err => {
                logger.error("Failed to update queue refresh token.", { id: userId });
                logger.error(err);
            });
        }
    }

    public static async isOwner(passcode: string, userId: string) {
        if (!userId) {
            throw { status: 401, message: "Valid user required. Please login again." };
        }
        try {
            const queueDao = await QueueService.getQueue(passcode);
            if (queueDao.data.owner !== userId) {
                throw { status: 401, message: "Owner permission required for QueueService action." };
            }

            return true;
        } catch (err) {
            if (err.message) {
                throw err;
            }
            throw { status: 500, message: err.message };
        }
    }

    public static isAuthorized = async (passcode: string, userId: string) => {
        try {
            if (!passcode) {
                throw { status: 401, message: "Valid passcode required" };
            } else if (!userId) {
                throw { status: 401, message: "Valid user required. Please login again." };
            }

            const queueDao = await QueueService.getQueue(passcode);
            const queue: Queue = queueDao.data;

            // Queue is incative if we don't have accessToken nor refreshToken
            if (!queue.accessToken && !queue.refreshToken) {
                throw { status: 403, message: "Queue inactive. Owner should reactivate it." };
            } else {
                const authResponse: any = await SpotifyService.isAuthorized(passcode, userId, queue.accessTokenAcquired, queue.expiresIn, queue.refreshToken);
                if (authResponse) {
                    logger.info(`Got refresh token. Saving it...`, { user: userId, passcode });
                    Acl.saveAccessToken(passcode, userId, authResponse.access_token,
                        authResponse.expires_in, authResponse.refresh_token);
                }
                const isOwner = queue.owner === userId;
                return { isAuthorized: true, passcode, isOwner };
            }
        } catch(err) {
            if (err.message) {
                throw err;
            }
            logger.error(err, { id: userId });
            throw { status: 500, message: "Unable to get queue with given passcode" };
        }
    }

    public static isVisitorAuthorized = async (passcode: string, userId: string) => {
        try {
            if (!passcode) {
                throw { status: 401, message: "Valid passcode required" };
            } else if (!userId) {
                throw { status: 401, message: "Valid user required. Please login again." };
            }
            const queueDao = await QueueService.getQueue(passcode);
            const queue: Queue = queueDao.data;
            const user = await QueueService.getUser(passcode, userId);

            // No content if not authorized
            if (user) {
                if (!user.accessToken && !user.refreshToken) {
                    throw { status: 403, message: "You need to login with Spotify credentials for this action." };
                } else {
                    const authResponse: any = await SpotifyService.isAuthorized(passcode, userId, user.accessTokenAcquired!, user.expiresIn!, user.refreshToken!);
                    if (authResponse) {
                        logger.info(`Got refresh token. Saving it...`, { user: userId, passcode });
                        if (user.spotifyUserId !== queueDao.owner) {
                            Acl.saveUserAccessToken(passcode, userId, authResponse.access_token,
                                authResponse.expires_in, authResponse.refresh_token);
                        } else {
                            Acl.saveAccessToken(passcode, userId, authResponse.access_token,
                                authResponse.expires_in, authResponse.refresh_token);
                        }
                    }
                    const isOwner = queue.owner === userId;
                    return { isAuthorized: true, passcode, isOwner };
                }
            } else {
                throw { status: 404, message: "User not found" };
            }
        } catch(err) {
            if (err.message) {
                throw err;
            }
            logger.error(err, { id: userId });
            throw { status: 500, message: "Unable to get queue with given passcode" };
        }
    }

    public static authFilter = async (req: express.Request, res: express.Response, next: () => any) => {
        const passcode = req.cookies.get("passcode");
        const user = req.cookies.get("user", { signed: true });

        try {
            const queueDao = passcode ? await QueueService.getQueue(passcode) : null;
            if (Acl.excludeEndpointsFromAuth.includes(req.path)) {
                return next();
            } else if (Acl.visitorAuthRequired.includes(req.path) || (queueDao && queueDao.data.settings.spotifyLogin)) {
                Acl.isVisitorAuthorized(passcode, user).then(() => {
                    return next();
                }).catch(err => {
                    return res.status(err.status).json({ message: err.message });
                });
            } else {
                Acl.isAuthorized(passcode, user).then(() => {
                    return next();
                }).catch(err => {
                    return res.status(err.status).json({ message: err.message });
                });
            }
        } catch (err) {
            logger.error(err);
            return res.status(500).json({ message: "Unable to authorize user. Please try again later." });
        }
    }

    public static adminFilter = (req: express.Request, res: express.Response, next: () => any) => {
        if (Acl.endpointsRequireOwnerPerm.includes(req.path)) {
            Acl.isOwner(req.cookies.get("passcode"), req.cookies.get("user", { signed: true })).then(() => {
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
