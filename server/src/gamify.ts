import * as express from "express";
import { Queue, User } from "./queue";
import SpotifyService from "./spotify.service";
import { logger } from "./logger.service";
import QueueService from "./queue.service";
import config from "./config";

export namespace Gamify {

    const methods = {
        "track": async (req: express.Request, res: express.Response, next: () => any) => {
            const passcode = req.cookies.get("passcode");
            const userId = req.cookies.get("user");
            const trackUri = req.body.spotifyUri;
            const queueDao = await QueueService.getQueue(passcode, true);
            const userIdx = getUser(queueDao.data, userId);
            const track = await SpotifyService.getTrack(queueDao.data.accessToken!, trackUri);
            const millis = track.duration;
            const cost = millisToPoints(millis);

            const user = queueDao.data.users[userIdx];
            if (user.points - cost >= 0) {
                logger.info(`Reducing ${cost} points from ${user.points}`, { userId, passcode });
                queueDao.data.users[userIdx].points -= cost;
                QueueService.updateQueueData(queueDao.data, passcode);
                return next();
            } else {
                logger.info(`${user.points} points is not enough to pay ${cost} points`, { user: userId, passcode });
                return res.status(403).json({ message: `You don't have enough points (${user.points}) to add this song. Song costs ${cost} points.` });
            }
        },
        "removeFromQueue": async (req: express.Request, res: express.Response, next: () => any) => {
            const passcode = req.cookies.get("passcode");
            const user = req.cookies.get("user");
            const isPlaying = req.body.isPlaying;
            const trackId = req.body.trackId;
            const queueDao = await QueueService.getQueue(passcode, true);
            const userIdx = getUser(queueDao.data, user);
            const q = queueDao.data;

            if (isPlaying) {
                if (q.currentTrack && q.currentTrack.owner !== user) {
                    if (q.users[userIdx].points < config.gamify.skipCost) {
                        return res.status(403).json({ 
                            message: `You don't have enough points (${q.users[userIdx].points}). ` +
                                    `Skipping a song added by someone else costs ${config.gamify.skipCost} points.` 
                        });
                    }
                    logger.info(`Skipping someone else's song...`, { user, passcode });
                    queueDao.data.users[userIdx].points -= config.gamify.skipCost;
                    await QueueService.updateQueueData(queueDao.data, passcode);
                    QueueService.skip(passcode, q.currentTrack!.owner!, trackId);
                    return res.status(200).json({ message: "OK" });
                }
            } else {
                for (let i = q.queue.length - 1; i >= 0; --i) {
                    if (q.queue[i].track.id === trackId && q.queue[i].userId === user) {
                        const refund = millisToPoints(q.queue[i].track.duration);
                        logger.info(`Refunding ${refund} points`, { user, passcode });
                        queueDao.data.users[userIdx].points += refund;
                        QueueService.updateQueueData(queueDao.data, passcode);
                        return next();
                    }
                }
            }
            return next();
        },
        "moveUpInQueue": async (req: express.Request, res: express.Response, next: () => any) => {
            const passcode = req.cookies.get("passcode");
            const user = req.cookies.get("user");
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
                    QueueService.updateQueueData(q, passcode);
                    return res.status(200).json({ message: "OK" });
                }
            }

            if (alreadyFirst) {
                return res.status(400).json({ message: `Track is already first in the queue. You need to skip the current song if you want to play this song now.` });
            } else {
                return res.status(404).json({ message: `Given track was not found from the queue.` });
            }
        }
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
            logger.info(`Rewarding active users for ${reward} points`, { passcode });
            queueDao.data.users = queueDao.data.users.map((user: User) => { 
                const queued = queueDao.data.queue.some(queuedItem => queuedItem.userId === user.id);
                if (queued || currentTrack.owner === user.id) {
                    if (currentTrack.owner === user.id) {
                        user.points += reward;
                        let voteCount = currentTrack.votes.reduce((sum, v) => sum += v.value, 0);
                        logger.info(`${voteCount} vote points for user`, { passcode, user: user.id });
                        user.points += voteCount;
                    } else {
                            if (currentTrack.owner !== null) {
                                // Give 1/3 points if someone else's song
                                user.points += Math.ceil(reward/3);
                            } else {
                                // Give 1 point if playlist track
                                user.points += 1;
                            }
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

    export const express = async (req: express.Request, res: express.Response, next: () => any) => {
        const gameEndpoints = ["/track", "/removeFromQueue", "/moveUpInQueue"];
        if (gameEndpoints.includes(req.path)) {
            const passcode = req.cookies.get("passcode");
            if (passcode) {
                const queueDao = await QueueService.getQueue(passcode, false);
                if (!queueDao.data.settings.gamify) {
                    return next();
                } else {
                    return methods[req.path.substr(1)](req, res, next);
                }
            }
        }
        return next();
    }
}
export default Gamify;
