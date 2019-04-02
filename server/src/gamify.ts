import * as express from "express";
import { Queue, User } from "./queue";
import SpotifyService from "./spotify.service";
import { logger } from "./logger.service";
import QueueService from "./queue.service";
import config from "./config";

export namespace Gamify {

    const preMethods = {
        "removeFromQueue": async (req: express.Request, res: express.Response, next: () => any) => {
            const passcode = req.cookies.get("passcode");
            const user = req.cookies.get("user", { signed: true });
            const isPlaying = req.body.isPlaying;
            const trackId = req.body.trackId;
            const queueDao = await QueueService.getQueue(passcode, true);
            const userIdx = getUser(queueDao.data, user);
            const q = queueDao.data;

            if (isPlaying) {
                // No cost for track owner and queue owner if track is from playlist
                if (!q.currentTrack || q.currentTrack.userId === user || (q.owner === user && q.currentTrack.userId === null)) {
                    return next();
                }
                if (q.users[userIdx].points < config.gamify.skipCost) {
                    return res.status(403).json({ 
                        message: `You don't have enough points (${q.users[userIdx].points}). ` +
                                `Skipping a song added by someone else costs ${config.gamify.skipCost} points.` 
                    });
                }
                logger.info(`Skipping someone else's song...`, { user, passcode });

                if (q.currentTrack.protected) {
                    logger.info(`Track is protected from skipping...`, { user, passcode });
                    return res.status(403).json({ 
                        message: `Can't skip because this song is protected from skipping.`
                    });
                }

                queueDao.data.users[userIdx].points -= config.gamify.skipCost;
                await QueueService.updateQueueData(queueDao.data, passcode);
                QueueService.skip(passcode, q.currentTrack!.userId!, trackId);
                return res.status(200).json({ message: "OK" });
            } else {
                for (let i = q.queue.length - 1; i >= 0; --i) {
                    if (q.queue[i].track.id === trackId && q.queue[i].userId === user) {
                        const refund = millisToPoints(q.queue[i].track.duration);
                        logger.info(`Refunding ${refund} points`, { user, passcode });
                        queueDao.data.users[userIdx].points += refund;
                        await QueueService.updateQueueData(queueDao.data, passcode);
                        return next();
                    } else if (q.queue[i].track.id === trackId && q.queue[i].userId !== user) {
                        // Trying to remove someone else's track
                        if (q.users[userIdx].points < config.gamify.skipCost) {
                            return res.status(403).json({ 
                                message: `You don't have enough points (${q.users[userIdx].points}). ` +
                                        `Removing a song added by someone else costs ${config.gamify.skipCost} points.` 
                            });
                        }

                        logger.info(`Removing someone else's song...`, { user, passcode });

                        if (q.queue[i].protected) {
                            logger.info(`Track is protected from removal...`, { user, passcode });
                            return res.status(403).json({ 
                                message: `Can't remove because this song is protected from removal.`
                            });
                        }

                        queueDao.data.users[userIdx].points -= config.gamify.skipCost;
                        await QueueService.updateQueueData(queueDao.data, passcode);
                        QueueService.removeFromQueue(passcode, q.queue[i].userId!, trackId);
                        return res.status(200).json({ message: "OK" });
                    }
                }
            }
            return next();
        },
        "moveUpInQueue": async (req: express.Request, res: express.Response, next: () => any) => {
            const passcode = req.cookies.get("passcode");
            const user = req.cookies.get("user", { signed: true });
            const trackId = req.body.trackId;
            const queueDao = await QueueService.getQueue(passcode, true);
            const userIdx = getUser(queueDao.data, user);
            const q = queueDao.data;
            let alreadyFirst = false;
            for (let i = 0; i < q.queue.length; i++) {
                if (q.queue[i].track.id === trackId && i == 0) {
                    alreadyFirst = true;
                } else if (q.queue[i].track.id === trackId) {
                    if (q.users[userIdx].points < config.gamify.moveUpCost) {
                        return res.status(403).json({ message: `You don't have enough points (${q.users[userIdx].points}). Moving costs ${config.gamify.moveUpCost} points.` });
                    }
                    logger.info(`Moving track from idx ${i} to idx ${(i-1)}`, { user, passcode });
                    const tmp = q.queue[i];
                    q.queue[i] = q.queue[i - 1];
                    q.queue[i - 1] = tmp;
                    q.users[userIdx].points -= config.gamify.moveUpCost;
                    await QueueService.updateQueueData(q, passcode);
                    return res.status(200).json({ message: "OK" });
                }
            }

            if (alreadyFirst) {
                return res.status(400).json({ message: `Track is already first in the queue. You need to skip the current song if you want to play this song now.` });
            } else {
                return res.status(404).json({ message: `Given track was not found from the queue.` });
            }
        },
        "protectTrack": async (req: express.Request, res: express.Response, next: () => any) => {
            const passcode = req.cookies.get("passcode");
            const user = req.cookies.get("user", { signed: true });
            const trackId = req.body.trackId;
            const isPlaying = req.body.isPlaying;
            const queueDao = await QueueService.getQueue(passcode, true);
            const q = queueDao.data;
            const userIdx = getUser(queueDao.data, user);

            if (q.users[userIdx].points < config.gamify.protectCost) {
                return res.status(403).json({ 
                    message: `You don't have enough points (${q.users[userIdx].points}). ` +
                            `Protecting a song costs ${config.gamify.protectCost} points.` 
                });
            }

            if (isPlaying) {
                if (!q.currentTrack) {
                    return res.status(404).json({ 
                        message: `Can't protect currently playing track since there is nothing playing right now.` 
                    });
                }
                q.currentTrack.protected = true;
            } else {
                if (!q.queue || q.queue.length === 0) {
                    return res.status(404).json({ 
                        message: `Can't protect selected song from queue since the queue is empty.` 
                    });
                }
                const trackIdx = q.queue.findIndex(queuedItem => queuedItem.track.id === trackId);
                if (trackIdx < 0) {
                    return res.status(404).json({ 
                        message: `Unable to find given song from the queue.` 
                    });
                }

                q.queue[trackIdx].protected = true;
            }

            logger.info(`Protecting a song from skipping...`, { user, passcode });
            q.users[userIdx].points -= config.gamify.protectCost;

            await QueueService.updateQueueData(q, passcode);
            return res.status(200).json({ message: "OK" });
        }
    };

    const postMethods = {
        "track": async (req: express.Request, res: express.Response, next: () => any) => {
            const passcode = req.cookies.get("passcode");
            const userId = req.cookies.get("user", { signed: true });
            const trackUri = req.body.uri;
            const source = req.body.source;
            if (source === "spotify") {
                const queueDao = await QueueService.getQueue(passcode, true);
                const userIdx = getUser(queueDao.data, userId);
                const track = await SpotifyService.getTrack(queueDao.data.accessToken!, trackUri);
                const millis = track.duration;
                const cost = millisToPoints(millis);

                const user = queueDao.data.users[userIdx];
                if (user.points - cost >= 0) {
                    logger.info(`Reducing ${cost} points from ${user.points}`, { user: userId, passcode });
                    queueDao.data.users[userIdx].points -= cost;
                    await QueueService.updateQueueData(queueDao.data, passcode);
                    return next();
                } else {
                    logger.info(`${user.points} points is not enough to pay ${cost} points`, { user: userId, passcode });
                    return res.status(403).json({ message: `You don't have enough points (${user.points}) to add this song. Song costs ${cost} points.` });
                }
            } else if (source === "youtube") {
                return next();
            }
        },
    };

    const getUser = (queue: Queue, userId: string) => {
        const userIdx = queue.users.findIndex(user => user.id === userId);
        if (userIdx < 0) {
            throw { status: 500, message: "Unable to find user from given queue." };
        } else {
            return userIdx;
        }
    }

    const millisToPoints = (millis: number) => {
        const minutes = Math.floor(millis / 60000);
        return minutes + 1;
    }

    export const trackEndReward = async (passcode: string) => {
        // TODO: Give reward for active users. Based on recent activity.
        try {
            const queueDao = await QueueService.getQueue(passcode, true);
            const currentTrack = queueDao.data.currentTrack;
            if (queueDao.data.settings.gamify && currentTrack) {
                let reward = millisToPoints(currentTrack.track.duration);
                logger.info(`Rewarding track owner ${currentTrack.userId || "-"} for ${reward} points`, { passcode });
                queueDao.data.users = queueDao.data.users.map((user: User) => {
                    const queued = queueDao.data.queue.some(queuedItem => queuedItem.userId === user.id);
                    if (queued || currentTrack.userId === user.id) {
                        if (currentTrack.userId === user.id) {
                            user.points += reward;
                            let voteCount = currentTrack.votes.reduce((sum, v) => sum += v.value, 0);
                            logger.info(`${voteCount} vote points for user`, { passcode, user: user.id });
                            user.points += voteCount;
                        } else {
                            user.points += 1;
                        }
                    }
                    return user;
                });
                await QueueService.updateQueueData(queueDao.data, passcode);
            }
        } catch (err) {
            logger.error("Error while giving gamify points for users.", { passcode });
            logger.error(err);
        }
    }

    export const pre = async (req: express.Request, res: express.Response, next: () => any) => {
        const gameEndpoints = ["/removeFromQueue", "/moveUpInQueue", "/protectTrack"];
        if (gameEndpoints.includes(req.path)) {
            const passcode = req.cookies.get("passcode");
            if (passcode) {
                const queueDao = await QueueService.getQueue(passcode, false);
                if (!queueDao.data.settings.gamify) {
                    return next();
                } else {
                    return preMethods[req.path.substr(1)](req, res, next);
                }
            }
        }
        return next();
    }

    export const post = async (req: express.Request, res: express.Response, next: () => any) => {
        const gameEndpoints = ["/track"];
        if (gameEndpoints.includes(req.path)) {
            const passcode = req.cookies.get("passcode");
            if (passcode) {
                const queueDao = await QueueService.getQueue(passcode, false);
                if (!queueDao.data.settings.gamify) {
                    return next();
                } else {
                    return postMethods[req.path.substr(1)](req, res, next);
                }
            }
        }
        return next();
    }
}
export default Gamify;
