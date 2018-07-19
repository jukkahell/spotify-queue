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
                logger.info(`Reducing ${cost} points from ${user.points}`, { user, passcode });
                queueDao.data.users[userIdx].points -= cost;
                QueueService.updateQueueData(queueDao.data, passcode);
                return next();
            } else {
                logger.info(`${user.points} points is not enough to pay ${cost} points`, { user: userId, passcode });
                return res.status(403).json({ message: `Your points (${user.points}) is not enough to add this song. Song costs ${cost} points.` });
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
                        user.points += voteCount;
                    }
                }
                return user;
            });
            QueueService.updateQueueData(queueDao.data, passcode);
        }
    }

    export const express = async (req: express.Request, res: express.Response, next: () => any) => {
        const gameEndpoints = ["/track", "/removeFromQueue", "/moveUp"];
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
