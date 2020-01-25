import * as express from "express";
import config from "./config";
import { logger } from "./logger.service";
import {
  CurrentTrack,
  FullQueue,
  Perk,
  PerkName,
  QueueItem,
  User
} from "./queue";
import QueueService from "./queue.service";
import { SpotifyTrack } from "./spotify";
import SpotifyService from "./spotify.service";

export class Gamify {
  public static preMethods = {
    removeFromQueue: async (
      req: express.Request,
      res: express.Response,
      next: () => any
    ) => {
      const passcode = req.cookies.get("passcode");
      const userId = req.cookies.get("user", { signed: true });
      const isPlaying = req.body.isPlaying;
      const trackId = req.body.trackId;
      const queue = await QueueService.getFullQueue(passcode);
      const userIdx = Gamify.getUser(queue, userId);
      const user = queue.users[userIdx];
      const perks = await QueueService.getAllPerksWithUserLevel(
        passcode,
        userId
      );
      const perkLevel = isPlaying
        ? Gamify.userPerkLevel("skip_song", perks)
        : Gamify.userPerkLevel("remove_song", perks);

      logger.info(
        `${isPlaying ? "Skipping" : "Removing from queue"} track ${trackId}`,
        {
          user: userId,
          passcode
        }
      );

      if (!queue.isPlaying) {
        return next();
      }

      const queueItem = queue.tracks.find(
        queuedItem => queuedItem.id === trackId
      );

      if (!isPlaying && !queueItem) {
        return res.status(404).json({
          message: `Unable to find given song from the queue.`
        });
      }

      const playlistTrack = queue.playlistTracks.find(pt => pt.id === trackId);
      const track: QueueItem | CurrentTrack = isPlaying
        ? queue.currentTrack!
        : queueItem || playlistTrack!;

      if (isPlaying && track.playlistTrack && queue.owner === userId) {
        await QueueService.skip(passcode, userId, trackId);
        return res.status(200).json({ message: "OK" });
      }

      if (isPlaying && !queue.currentTrack) {
        return res.status(404).json({
          message: `Can't skip current song since no current song found.`
        });
      } else if (
        !isPlaying &&
        (!queue.tracks || queue.tracks.length === 0) &&
        (!queue.playlistTracks || queue.playlistTracks.length === 0)
      ) {
        return res.status(404).json({
          message: `Can't remove anything since the queue is empty.`
        });
      } else if (perkLevel <= 0 && user.id !== track!.userId) {
        return res.status(403).json({
          message: `You don't own the perk or don't have enough karma to ${
            isPlaying ? "skip this song." : "remove songs from the queue."
          }`
        });
      }
      const removeTrackId = isPlaying
        ? queue.currentTrack!.id
        : queueItem!.id || playlistTrack!.id;
      const removeTrack: SpotifyTrack = isPlaying
        ? queue.currentTrack!.track
        : queueItem!.track || playlistTrack!.track;
      removeTrack.progress = isPlaying ? queue.currentTrack!.progress : 0;
      const removeCost = Gamify.calculateSkipCost(removeTrack, perkLevel);

      // No cost for track owner
      if (track.userId === userId) {
        logger.info(`Removing/skipping own track. Let's do it...`, {
          user: userId,
          passcode
        });
        if (!isPlaying) {
          // Refund queueing cost. Current track's reward comes from trackEndReward function
          const refund = Gamify.millisToPoints(removeTrack.duration);
          logger.info(`Refunding ${refund} points`, { user: userId, passcode });
          await QueueService.addPoints(passcode, user.id, refund);
        }
        return next();
      }

      if (user.points < removeCost) {
        return res.status(403).json({
          message:
            `You don't have enough points (${user.points}). ` +
            `Removing this song from the queue costs ${removeCost} points.`
        });
      }

      if (track.protected) {
        logger.info(`Track is protected from skipping...`, {
          user: userId,
          passcode
        });
        return res.status(403).json({
          message: `Can't skip because this song is protected from skipping.`
        });
      }

      if (isPlaying) {
        logger.info(`Skipping someone else's song with cost ${removeCost}...`, {
          user: userId,
          passcode
        });
        await QueueService.skip(passcode, track.userId!, trackId);
      } else {
        logger.info(
          `Removing someone else's song from queue with cost ${removeCost}...`,
          {
            user: userId,
            passcode
          }
        );
        await QueueService.removeFromQueue(passcode, userId, removeTrackId);
      }
      await QueueService.addPoints(passcode, user.id, -removeCost);
      return res.status(200).json({ message: "OK" });
    },
    moveUpInQueue: async (
      req: express.Request,
      res: express.Response,
      next: () => any
    ) => {
      try {
        const passcode = req.cookies.get("passcode");
        const userId = req.cookies.get("user", { signed: true });
        const trackId = req.body.trackId;
        const queue = await QueueService.getFullQueue(passcode);
        const userIdx = Gamify.getUser(queue, userId);
        const user = queue.users[userIdx];
        let alreadyFirst = false;
        const perks = await QueueService.getAllPerksWithUserLevel(
          passcode,
          userId
        );
        const perkLevel = Gamify.userPerkLevel("move_up", perks);

        if (perkLevel <= 0) {
          return res.status(403).json({
            message: `You don't own the perk or don't have enough karma to move song up in the queue.`
          });
        }

        for (let i = 0; i < queue.tracks.length; i++) {
          if (queue.tracks[i].id === trackId && i === 0) {
            alreadyFirst = true;
            break;
          } else if (queue.tracks[i].id === trackId) {
            if (user.points < config.gamify.moveUpCost) {
              return res.status(403).json({
                message: `You don't have enough points (${user.points}). Moving costs ${config.gamify.moveUpCost} points.`
              });
            }
            const newIndex = i - perkLevel >= 0 ? i - perkLevel : 0;
            logger.info(`Moving track from idx ${i} to idx ${newIndex}`, {
              user: userId,
              passcode
            });
            const moveTrack = queue.tracks[i];
            const earlierTrack = queue.tracks[newIndex];
            await QueueService.switchTrackPositions(moveTrack, earlierTrack);
            await QueueService.addPoints(
              passcode,
              user.id,
              -config.gamify.moveUpCost
            );
            return res.status(200).json({ message: "OK" });
          }
        }

        if (alreadyFirst) {
          return res.status(400).json({
            message: `Track is already first in the queue. You need to skip the current song if you want to play this song now.`
          });
        } else {
          return res
            .status(404)
            .json({ message: `Given track was not found from the queue.` });
        }
      } catch (err) {
        logger.error(err);
        return res
          .status(500)
          .json({ message: `Error occurred when tried to move track up` });
      }
    },
    moveFirstInQueue: async (
      req: express.Request,
      res: express.Response,
      next: () => any
    ) => {
      try {
        const passcode = req.cookies.get("passcode");
        const userId = req.cookies.get("user", { signed: true });
        const trackId = req.body.trackId;
        const queue = await QueueService.getFullQueue(passcode);
        const userIdx = Gamify.getUser(queue, userId);
        const user = queue.users[userIdx];
        const perks = await QueueService.getAllPerksWithUserLevel(
          passcode,
          userId
        );
        const perk = perks.find(perk => perk.name === "move_first");

        if (!perk || perk.karmaAllowedLevel <= 0) {
          return res.status(403).json({
            message: `You don't own the perk or don't have enough karma to move song first in the queue.`
          });
        }

        if (queue.tracks.length === 0) {
          return res.status(400).json({
            message:
              "Queue is empty, so we can't move a song to first in queue."
          });
        } else if (queue.tracks[0].id === trackId) {
          return res.status(400).json({
            message: `Track is already first in the queue. You need to skip the current song if you want to play this song now.`
          });
        } else if (perk.cooldownLeft! > 0) {
          return res.status(400).json({
            message: `Cooldown active. You can use this again after ${perk.cooldownLeft!} minutes.`
          });
        }

        const moveTrack = queue.tracks.find(t => t.id === trackId);
        if (!moveTrack) {
          return res
            .status(404)
            .json({ message: `Given track was not found from the queue.` });
        }
        if (user.points < config.gamify.moveUpCost) {
          return res.status(403).json({
            message: `You don't have enough points (${user.points}). Moving costs ${config.gamify.moveUpCost} points.`
          });
        }

        logger.info(`Moving track ${trackId} to first in queue`, {
          user: userId,
          passcode
        });
        const firstTrack = queue.tracks[0];
        moveTrack.timestamp = firstTrack.timestamp - 10;
        await QueueService.moveTrack(moveTrack);
        await QueueService.updatePerkUsedTime(passcode, userId, "move_first");
        await QueueService.addPoints(
          passcode,
          user.id,
          -config.gamify.moveUpCost
        );
        return res.status(200).json({ message: "OK" });
      } catch (err) {
        logger.error(err);
        return res
          .status(500)
          .json({ message: `Error occurred when tried to move track up` });
      }
    },
    protectTrack: async (
      req: express.Request,
      res: express.Response,
      next: () => any
    ) => {
      const passcode = req.cookies.get("passcode");
      const userId = req.cookies.get("user", { signed: true });
      const trackId = req.body.trackId;
      const isPlaying = req.body.isPlaying;
      const queue = await QueueService.getFullQueue(passcode);
      const userIdx = Gamify.getUser(queue, userId);
      const user = queue.users[userIdx];
      const perks = await QueueService.getAllPerksWithUserLevel(
        passcode,
        userId
      );
      const perkLevel = Gamify.userPerkLevel("protect_song", perks);

      if (perkLevel <= 0) {
        return res.status(403).json({
          message: `You don't own the perk or don't have enough karma to protect songs.`
        });
      } else if (isPlaying && !queue.currentTrack) {
        return res.status(404).json({
          message: `Can't protect current song since no songs was found.`
        });
      } else if (
        !isPlaying &&
        (!queue.tracks || queue.tracks.length === 0) &&
        (!queue.playlistTracks || queue.playlistTracks.length === 0)
      ) {
        return res.status(404).json({
          message: `Can't protect anything since the queue is empty.`
        });
      }

      const queueItem = queue.tracks.find(
        queuedItem => queuedItem.id === trackId
      );
      const playlistTrack = queue.playlistTracks.find(pt => pt.id === trackId);
      if (!isPlaying && !queueItem && !playlistTrack) {
        return res.status(404).json({
          message: `Unable to find given song from the queue.`
        });
      }

      const protectTrackId = isPlaying
        ? queue.currentTrack!.id
        : queueItem!.id || playlistTrack!.id;
      const protectTrack: SpotifyTrack = isPlaying
        ? queue.currentTrack!.track
        : queueItem!.track || playlistTrack!.track;
      protectTrack.progress = isPlaying ? queue.currentTrack!.progress : 0;
      const protectCost = Gamify.calculateProtectCost(protectTrack);
      if (user.points < protectCost) {
        return res.status(403).json({
          message:
            `You don't have enough points (${user.points}). ` +
            `Protecting a song costs ${protectCost} points.`
        });
      }

      QueueService.protectTrack(passcode, protectTrackId);

      logger.info(`Protecting a song from skipping...`, {
        user: userId,
        passcode
      });
      await QueueService.addPoints(passcode, user.id, -protectCost);
      return res.status(200).json({ message: "OK" });
    }
  };

  public static postMethods = {
    // After track has been queued
    track: async (
      req: express.Request,
      res: express.Response,
      next: () => any
    ) => {
      const passcode = req.cookies.get("passcode");
      const userId = req.cookies.get("user", { signed: true });
      const trackUri = req.body.uri;
      const source = req.body.source;
      if (source === "spotify") {
        const queue = await QueueService.getFullQueue(passcode);
        const userIdx = Gamify.getUser(queue, userId);
        const queuedItem = queue.tracks.find(qi => qi.trackUri === trackUri);
        if (!queuedItem) {
          logger.info(
            `${trackUri} not found from queue. Not able to reduce points.`,
            {
              user: userId,
              passcode
            }
          );
          return next();
        }
        const millis = queuedItem.track.duration;
        const cost = Gamify.millisToPoints(millis);

        const user = queue.users[userIdx];
        if (user.points - cost >= 0) {
          logger.info(`Reducing ${cost} points from ${user.points}`, {
            user: userId,
            passcode
          });
          await QueueService.addPoints(passcode, user.id, -cost);
          return next();
        } else {
          logger.info(
            `${user.points} points is not enough to pay ${cost} points`,
            {
              user: userId,
              passcode
            }
          );
          return res.status(403).json({
            message: `You don't have enough points (${user.points}) to add this song. Song costs ${cost} points.`
          });
        }
      } else if (source === "youtube") {
        return next();
      }
    }
  };

  private static getUser = (queue: FullQueue, userId: string) => {
    const userIdx = queue.users.findIndex(user => user.id === userId);
    if (userIdx < 0) {
      throw { status: 500, message: "Unable to find user from given queue." };
    } else {
      return userIdx;
    }
  };

  public static calculateProtectCost = (track: SpotifyTrack) => {
    const millisLeft = track.duration - (track.progress || 0);
    const minutesLeft = Math.floor(millisLeft / 60000);
    return (minutesLeft + 1) * config.gamify.protectCostPerMinute;
  };

  public static calculateSkipCost = (track: SpotifyTrack, perkLevel: number) => {
    const millisLeft = track.duration - (track.progress || 0);
    const minutesLeft = Math.floor(millisLeft / 60000);
    const perkDiscount = perkLevel > 1 ? perkLevel : 0;
    return (minutesLeft + 1) * (config.gamify.skipCostPerMinute - perkDiscount);
  };

  public static millisToPoints = (millis: number) => {
    const minutes = Math.floor(millis / 60000);
    return minutes + 1;
  };

  public static userPerkLevel = (perkName: PerkName, perks: Perk[]) => {
    const perk = perks.find(perk => perk.name === perkName);
    return perk ? perk.karmaAllowedLevel : 0;
  };

  public static trackEndReward = async (
    queue: FullQueue,
    passcode: string,
    votes: number
  ) => {
    const currentTrack = queue.currentTrack;
    if (!currentTrack || currentTrack.playlistTrack || !currentTrack.userId) {
      return;
    }

    try {
      if (queue.settings.gamify) {
        const spotifyCurrentTrack = await SpotifyService.currentlyPlaying(
          queue.accessToken!,
          currentTrack.userId,
          passcode
        );
        const progress =
          spotifyCurrentTrack.item &&
          spotifyCurrentTrack.item.id === currentTrack.track.id
            ? spotifyCurrentTrack.item.progress
            : 0;
        logger.info(
          `Played ${progress}/${currentTrack.track.duration} of the song. Give reward.`,
          {
            passcode
          }
        );
        const reward = Gamify.millisToPoints(progress);
        logger.info(
          `Rewarding track owner ${currentTrack.userId} for ${reward} points`,
          { passcode }
        );
        queue.users.forEach(async (user: User) => {
          if (!currentTrack.playlistTrack) {
            if (currentTrack.userId === user.id) {
              logger.info(`${votes} vote points for user`, {
                passcode,
                user: user.id
              });
              const songFinishedKarma =
                progress / currentTrack.track.duration > 0.9 ? 1 : 0;
              await QueueService.addPoints(passcode, user.id, reward + votes);
              await QueueService.addKarma(
                passcode,
                user.id,
                votes + songFinishedKarma
              );
            } else if (queue.tracks.some(t => t.userId === user.id)) {
              // Give points only if user has queued something
              await QueueService.addPoints(passcode, user.id, 1);
            }
          }
        });
      } else if (currentTrack && currentTrack.userId) {
        await QueueService.addKarma(passcode, currentTrack.userId, votes);
      }
    } catch (err) {
      logger.error("Error while giving gamify points for users.", { passcode });
      logger.error(err);
    }
  };

  public static pre = async (
    req: express.Request,
    res: express.Response,
    next: () => any
  ) => {
    const gameEndpoints = [
      "/removeFromQueue",
      "/moveUpInQueue",
      "/moveFirstInQueue",
      "/protectTrack"
    ];
    if (gameEndpoints.includes(req.path)) {
      const passcode = req.cookies.get("passcode");
      if (passcode) {
        const settings = await QueueService.getSettings(passcode);
        if (!settings.gamify) {
          return next();
        } else {
          return Gamify.preMethods[req.path.substr(1)](req, res, next);
        }
      }
    }
    return next();
  };

  public static post = async (
    req: express.Request,
    res: express.Response,
    next: () => any
  ) => {
    const gameEndpoints = ["/track"];
    if (gameEndpoints.includes(req.path)) {
      const passcode = req.cookies.get("passcode");
      if (passcode) {
        const settings = await QueueService.getSettings(passcode);
        if (!settings.gamify) {
          return next();
        } else {
          return Gamify.postMethods[req.path.substr(1)](req, res, next);
        }
      }
    }
    return next();
  };
}
export default Gamify;
