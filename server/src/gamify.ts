import * as express from "express";
import { User, FullQueue } from "./queue";
import SpotifyService from "./spotify.service";
import { logger } from "./logger.service";
import QueueService from "./queue.service";
import config from "./config";

export namespace Gamify {

  const preMethods = {
    "removeFromQueue": async (req: express.Request, res: express.Response, next: () => any) => {
      const passcode = req.cookies.get("passcode");
      const userId = req.cookies.get("user", { signed: true });
      const isPlaying = req.body.isPlaying;
      const trackId = req.body.trackId;
      const queue = await QueueService.getFullQueue(passcode);
      const userIdx = getUser(queue, userId);
      const user = queue.users[userIdx];

      if (!queue.isPlaying) {
        return next();
      }

      if (isPlaying) {
        // No cost for track owner
        if (!queue.currentTrack || queue.currentTrack.userId === userId) {
          return next();
        }
        if (user.points < config.gamify.skipCost) {
          return res.status(403).json({
            message: `You don't have enough points (${queue.users[userIdx].points}). ` +
              `Skipping a song added by someone else costs ${config.gamify.skipCost} points.`
          });
        }
        logger.info(`Skipping someone else's song...`, { user: userId, passcode });

        if (queue.currentTrack.protected) {
          logger.info(`Track is protected from skipping...`, { user: userId, passcode });
          return res.status(403).json({
            message: `Can't skip because this song is protected from skipping.`
          });
        }

        if (queue.owner !== userId || queue.currentTrack.playlistTrack) {
          QueueService.addPoints(passcode, user.id, -config.gamify.skipCost);
        }
        QueueService.skip(passcode, queue.currentTrack!.userId!, trackId);
        return res.status(200).json({ message: "OK" });
      } else {
        for (let i = queue.tracks.length - 1; i >= 0; --i) {
          // Removing own track
          if (queue.tracks[i].track.id === trackId && queue.tracks[i].userId === userId) {
            const refund = millisToPoints(queue.tracks[i].track.duration);
            logger.info(`Refunding ${refund} points`, { user: userId, passcode });
            QueueService.addPoints(passcode, user.id, refund);
            return next();
          } else if (queue.tracks[i].track.id === trackId && queue.tracks[i].userId !== userId) {
            // Trying to remove someone else's track
            if (user.points < config.gamify.skipCost) {
              return res.status(403).json({
                message: `You don't have enough points (${user.points}). ` +
                  `Removing a song added by someone else costs ${config.gamify.skipCost} points.`
              });
            }

            logger.info(`Removing someone else's song...`, { user: userId, passcode });

            if (queue.tracks[i].protected) {
              logger.info(`Track is protected from removal...`, { user: userId, passcode });
              return res.status(403).json({
                message: `Can't remove because this song is protected from removal.`
              });
            }
            QueueService.addPoints(passcode, user.id, -config.gamify.skipCost);
            QueueService.removeFromQueue(passcode, queue.tracks[i].userId!, trackId);
            return res.status(200).json({ message: "OK" });
          }
        }
      }
      return next();
    },
    "moveUpInQueue": async (req: express.Request, res: express.Response, next: () => any) => {
      try {
        const passcode = req.cookies.get("passcode");
        const userId = req.cookies.get("user", { signed: true });
        const trackId = req.body.trackId;
        const queue = await QueueService.getFullQueue(passcode);
        const userIdx = getUser(queue, userId);
        const user = queue.users[userIdx];
        let alreadyFirst = false;
        for (let i = 0; i < queue.tracks.length; i++) {
          if (queue.tracks[i].id === trackId && i == 0) {
            alreadyFirst = true;
            break;
          } else if (queue.tracks[i].id === trackId) {
            if (user.points < config.gamify.moveUpCost) {
              return res.status(403).json({ message: `You don't have enough points (${user.points}). Moving costs ${config.gamify.moveUpCost} points.` });
            }
            logger.info(`Moving track from idx ${i} to idx ${(i - 1)}`, { user: userId, passcode });
            const moveTrack = queue.tracks[i];
            const earlierTrack = queue.tracks[i - 1];
            QueueService.switchTrackPositions(moveTrack, earlierTrack);
            QueueService.addPoints(passcode, user.id, -config.gamify.moveUpCost);
            return res.status(200).json({ message: "OK" });
          }
        }

        if (alreadyFirst) {
          return res.status(400).json({ message: `Track is already first in the queue. You need to skip the current song if you want to play this song now.` });
        } else {
          return res.status(404).json({ message: `Given track was not found from the queue.` });
        }
      } catch (err) {
        logger.error(err);
        return res.status(500).json({ message: `Error occurred when tried to move track up` });
      }
    },
    "protectTrack": async (req: express.Request, res: express.Response, next: () => any) => {
      const passcode = req.cookies.get("passcode");
      const userId = req.cookies.get("user", { signed: true });
      const trackId = req.body.trackId;
      const isPlaying = req.body.isPlaying;
      const queue = await QueueService.getFullQueue(passcode);
      const userIdx = getUser(queue, userId);
      const user = queue.users[userIdx];
      if (user.points < config.gamify.protectCost) {
        return res.status(403).json({
          message: `You don't have enough points (${user.points}). ` +
            `Protecting a song costs ${config.gamify.protectCost} points.`
        });
      }

      if (isPlaying) {
        if (!queue.currentTrack) {
          return res.status(404).json({
            message: `Can't protect currently playing track since there is nothing playing right now.`
          });
        }
        QueueService.protectTrack(passcode, queue.currentTrack.id);
      } else {
        if (!queue.tracks || queue.tracks.length === 0) {
          return res.status(404).json({
            message: `Can't protect selected song from queue since the queue is empty.`
          });
        }
        const trackIdx = queue.tracks.findIndex(queuedItem => queuedItem.id === trackId);
        if (trackIdx < 0) {
          return res.status(404).json({
            message: `Unable to find given song from the queue.`
          });
        }

        QueueService.protectTrack(passcode, queue.tracks[trackIdx].id);
      }

      logger.info(`Protecting a song from skipping...`, { user: userId, passcode });
      QueueService.addPoints(passcode, user.id, -config.gamify.protectCost);
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
        const queue = await QueueService.getFullQueue(passcode);
        const userIdx = getUser(queue, userId);
        const track = await SpotifyService.getTrack(queue.accessToken!, trackUri);
        const millis = track.duration;
        const cost = millisToPoints(millis);

        const user = queue.users[userIdx];
        if (user.points - cost >= 0) {
          logger.info(`Reducing ${cost} points from ${user.points}`, { user: userId, passcode });
          QueueService.addPoints(passcode, user.id, -cost);
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

  const getUser = (queue: FullQueue, userId: string) => {
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

  export const trackEndReward = async (queue: FullQueue, passcode: string, votes: number) => {
    const currentTrack = queue.currentTrack;
    if (!currentTrack || currentTrack.playlistTrack || !currentTrack.userId) {
      return;
    }

    try {
      if (queue.settings.gamify) {
        const spotifyCurrentTrack = await SpotifyService.currentlyPlaying(queue.accessToken!, currentTrack.userId, passcode);
        const progress = spotifyCurrentTrack.item && spotifyCurrentTrack.item.id === currentTrack.track.id ? spotifyCurrentTrack.item.progress : 0;
        logger.info(`Played ${progress}/${currentTrack.track.duration} of the song. Give reward.`, { passcode });
        let reward = millisToPoints(progress);
        logger.info(`Rewarding track owner ${currentTrack.userId} for ${reward} points`, { passcode });
        queue.users.forEach(async (user: User) => {
          if (!currentTrack.playlistTrack) {
            if (currentTrack.userId === user.id) {
              logger.info(`${votes} vote points for user`, { passcode, user: user.id });
              QueueService.addPoints(passcode, user.id, reward + votes);
              QueueService.addKarma(passcode, user.id, votes);
            } else {
              QueueService.addPoints(passcode, user.id, 1);
            }
          }
        });
      } else if (currentTrack && currentTrack.userId) {
        QueueService.addKarma(passcode, currentTrack.userId, votes);
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
        const settings = await QueueService.getSettings(passcode);
        if (!settings.gamify) {
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
        const settings = await QueueService.getSettings(passcode);
        if (!settings.gamify) {
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
