import * as express from "express";
import { Queue, User, Vote, CurrentTrack } from "./queue";
import SpotifyService from "./spotify.service";
import { logger } from "./logger.service";
import QueueService from "./queue.service";

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
            const SKIP_COST = 15;
            const passcode = req.cookies.get("passcode");
            const user = req.cookies.get("user");
            const isPlaying = req.body.isPlaying;
            const trackId = req.body.trackId;
            const queueDao = await QueueService.getQueue(passcode, true);
            const userIdx = getUser(queueDao.data, user);
            const q = queueDao.data;

            if (isPlaying) {
                if (q.currentTrack && q.currentTrack.owner !== user) {
                    if (q.users[userIdx].points < SKIP_COST) {
                        return res.status(403).json({ 
                            message: `You don't have enough points (${q.users[userIdx].points}). ` +
                                    `Skipping a song added by someone else costs ${SKIP_COST} points.` 
                        });
                    }
                    logger.info(`Skipping someone else's song...`, { user, passcode });
                    queueDao.data.users[userIdx].points -= SKIP_COST;
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
            const MOVE_UP_COST = 5;

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
                    if (q.users[userIdx].points < MOVE_UP_COST) {
                        return res.status(403).json({ message: `You don't have enough points (${q.users[userIdx].points}). Moving costs ${MOVE_UP_COST} points.` });
                    }
                    logger.info(`Moving track from idx ${i} to idx ${(i-1)}`, { user, passcode });
                    const tmp = q.queue[i];
                    q.queue[i] = q.queue[i - 1];
                    q.queue[i - 1] = tmp;
                    q.users[userIdx].points -= MOVE_UP_COST;
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
        const seconds = ((millis % 60000) / 1000) > 30 ? 1 : 0;
        return minutes + seconds;
    }

    export const trackEndReward = async (passcode: string, currentTrack: CurrentTrack) => {
        // TODO: Give reward for active users. Based on recent activity.
        if (!currentTrack.owner) {
            return;
        }

        const reward = Math.ceil(millisToPoints(currentTrack.track.duration)/3);
        const queueDao = await QueueService.getQueue(passcode, true);
        if (queueDao.data.settings.gamify) {
            logger.info(`Rewarding active users for ${reward} points`, { passcode });
            queueDao.data.users = queueDao.data.users.map((user: User) => { 
                const queued = queueDao.data.queue.find(queuedItem => queuedItem.userId === user.id);
                if (queued || currentTrack.owner === user.id) {
                    user.points += reward;
                    if (currentTrack.owner === user.id) {
                        let voteCount = 0;
                        currentTrack.votes.forEach((v: Vote) => voteCount += v.value);
                        logger.info(`${voteCount} vote points for user`, { passcode, user: user.id });
                        user.points += voteCount;
                    }
                }
                return user;
            });
            QueueService.updateQueueData(queueDao.data, passcode);
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
