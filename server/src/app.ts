import * as bodyParser from "body-parser";
import * as Cookies from "cookies";
import * as cors from "cors";
import * as express from "express";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as Keygrip from "keygrip";
import { env } from "process";
import * as randomstring from "randomstring";
import config, { passcodeCookieExpire, userCookieExpire } from "./config";
import { Settings, PerkName } from "./queue";
import QueueService from "./queue.service";
import secrets from "./secrets";
import { SpotifySearchQuery } from "./spotify";
import { logger } from "./logger.service";
import SpotifyService from "./spotify.service";
import Acl, { AuthResult } from "./acl";
import Gamify from "./gamify";
import { YoutubeSearchQuery } from "./youtube";
import * as youtubeSearch from "youtube-search";
import YoutubeService from "./youtube.service";

const keys = secrets.cookie.signKeys;
const keygrip = Keygrip(keys, "sha256");

const app = express();
app.use(express.static("public"));
app.use(cors(config.app.cors));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(Cookies.express(keygrip));
app.use(Acl.authFilter);
app.use(Acl.adminFilter);
app.use(Gamify.pre);

const options = env.NODE_ENV === "production" ? {
  key: fs.readFileSync(secrets.certPath + "privkey.pem"),
  cert: fs.readFileSync(secrets.certPath + "fullchain.pem")
} : {};

const server = env.NODE_ENV === "production" ? https.createServer(options, app) : http.createServer(app);

app.get("/createOrReactivate", async (req, res) => {
  try {
    const queue = await QueueService.create(req.query.code, true);
    config.passcodeCookieOptions.expires = passcodeCookieExpire();
    config.userCookieOptions.expires = userCookieExpire();
    req.cookies.set("user", queue.owner, config.userCookieOptions);
    req.cookies.set("passcode", queue.passcode, config.passcodeCookieOptions);
    res.status(200).send("<script>window.close();</script>");
  } catch (err) {
    res.status(err.status).send(err.message);
  }
});

app.get("/create", async (req, res) => {
  try {
    const queue = await QueueService.create(req.query.code, false);
    config.passcodeCookieOptions.expires = passcodeCookieExpire();
    config.userCookieOptions.expires = userCookieExpire();
    req.cookies.set("user", queue.owner, config.userCookieOptions);
    req.cookies.set("passcode", queue.passcode, config.passcodeCookieOptions);
    res.status(200).send("<script>window.close();</script>");
  } catch (err) {
    res.status(err.status).send(err.message);
  }
});

app.get("/reactivate", async (req, res) => {
  const passcode = req.cookies.get("reactivate");
  const user = req.cookies.get("user", { signed: true });
  try {
    const queue = await QueueService.reactivate(passcode, user, req.query.code);
    config.passcodeCookieOptions.expires = passcodeCookieExpire();
    config.userCookieOptions.expires = userCookieExpire();
    req.cookies.set("user", queue.owner, config.userCookieOptions);
    req.cookies.set("passcode", passcode, config.passcodeCookieOptions);
    req.cookies.set("reactivate", "", config.passcodeCookieOptions);
    res.status(200).send("<script>window.close();</script>");
  } catch (err) {
    res.status(err.status).send(err.message);
  }
});

app.get("/visitorAuth", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const userId = req.cookies.get("user", { signed: true });
  try {
    const user = await QueueService.visitorSpotifyLogin(passcode, userId, req.query.code);
    config.userCookieOptions.expires = userCookieExpire();
    req.cookies.set("user", user.id, config.userCookieOptions);
    res.status(200).send("<script>window.close();</script>");
  } catch (err) {
    res.status(err.status).send(err.message);
  }
});

app.get("/logout", (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });
  logger.debug(`Logging out user...`, { user, passcode });

  QueueService.logout(passcode, user).then(() => {
    req.cookies.set("passcode", "", config.passcodeCookieOptions);
    res.status(200).json({ message: "OK" });
  }).catch(err => {
    res.status(err.status).json({ message: err.message });
  });
});

app.put("/join", (req, res) => {
  const passcode = req.body.code;
  let userId = req.cookies.get("user", { signed: true });

  if (!userId) {
    userId = randomstring.generate();
  }
  QueueService.join(passcode, userId).then(isOwner => {
    req.cookies.set("passcode", passcode, config.passcodeCookieOptions);
    req.cookies.set("user", userId, config.userCookieOptions);
    res.status(200).json({ message: "OK", passcode, isOwner });
  }).catch(err => {
    if (err.status === 403) {
      req.cookies.set("reactivate", passcode, config.passcodeCookieOptions);
    }
    res.status(err.status).json({ message: err.message });
  });
});

app.get("/isAuthorized", (req, res) => {
  if (!req.cookies.get("passcode")) {
    res.status(204).json({ message: "No passcode" });
    return;
  }

  Acl.isAuthorized(req.cookies.get("passcode"), req.cookies.get("user", { signed: true })).then((authResult: AuthResult) => {
    config.passcodeCookieOptions.expires = passcodeCookieExpire();
    config.userCookieOptions.expires = userCookieExpire();
    req.cookies.set("passcode", req.cookies.get("passcode"), config.passcodeCookieOptions);
    req.cookies.set("user", req.cookies.get("user"), config.userCookieOptions);
    res.status(200).json(authResult);
  }).catch(err => {
    res.status(err.status).json({ isAuthorized: false, message: err.message });
  });
});

app.get("/devices", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });

  try {
    const accessToken = await QueueService.getAccessToken(req.cookies.get("passcode"));
    try {
      const devicesResponse = await SpotifyService.getDevices(accessToken);
      let activeDeviceId: string | undefined;
      let spotifyHasActiveDevice = true;
      const devices: any[] = devicesResponse.data.devices.map((device: any) => {
        if (device.is_active) {
          activeDeviceId = device.id;
        }
        return {
          id: device.id,
          name: device.name,
          type: device.type,
          isActive: device.is_active
        };
      });

      logger.debug(`Found ${devices.length} devices`, { user, passcode });

      // If no device was active just pick the first
      if (!activeDeviceId && devices.length > 0) {
        logger.debug(`None of the devices was active...activating`, { user, passcode });
        activeDeviceId = devices[0].id;
        devices[0].isActive = true;
        spotifyHasActiveDevice = false;
      } else if (!activeDeviceId && devices.length === 0) {
        logger.debug(`No available devices found...giving info for user`, { user, passcode });
        res.status(404).json({ message: "No available devices found. Please start Spotify and then try again." });
        return;
      }

      res.status(200).json(devices);

      // If there was active device set it as device id for this queue
      if (activeDeviceId !== undefined) {
        QueueService.setActiveDevice(passcode, activeDeviceId);
        if (!spotifyHasActiveDevice) {
          const queue = await QueueService.getQueue(passcode);
          // Set it to spotify as well
          SpotifyService.setDevice(accessToken, queue.isPlaying, activeDeviceId!).catch(err => {
            logger.error("Unable to set device to spotify...", { user, passcode });
            if (err.response) {
              logger.error(err.response.data.error.message, { user, passcode });
            }
          });
        }
      }
    } catch (err) {
      logger.error(err.response.data.error.message, { user, passcode });
      res.status(500).json({ message: "Error getting available devices" });
    }
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

app.put("/device", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });

  logger.info(`Activating device ${req.body.deviceId}`, { user, passcode });
  if (req.body.deviceId) {
    try {
      const queue = await QueueService.getQueue(passcode);
      QueueService.setDevice(passcode, user, req.body.deviceId);
      SpotifyService.setDevice(queue.accessToken!, queue.isPlaying, req.body.deviceId).then(() => {
        logger.debug(`Device set successfully to spotify.`, { user, passcode });
        res.status(200).json({ message: "OK" });
      }).catch(err => {
        logger.error("Unable to update device to spotify.", { user, passcode });
        logger.error(err.response.data.error.message, { id: user });
      });
    } catch(err) {
      logger.error(err, { user, passcode });
      res.status(500).json({ message: err });
    }
  } else {
    res.status(400).json({ message: "Invalid device id" });
  }
});

app.get("/queue", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const userId = req.cookies.get("user", { signed: true });
  try {
    const tracks = await QueueService.getTracks(passcode, userId, false);
    if (tracks.length === 0) {
      res.status(204).json({ message: "No messages in queue" });
      return;
    }

    res.status(200).json({
      queuedItems: tracks,
    });
  } catch(err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/leaveQueue", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const userId = req.cookies.get("user", { signed: true });
  try {
    const newQueue = await QueueService.leave(passcode, userId);
    if (!newQueue) {
      logger.info(`Leaving queue ${passcode}. New queue not found.`, { passcode });
      req.cookies.set("passcode", "", config.passcodeCookieOptions);
      res.status(204).json({});
      return;
    }
    logger.info(`Leaving queue ${passcode}. New queue:`, { passcode, user: userId });
    logger.info(newQueue);
    req.cookies.set("passcode", newQueue.passcode, config.passcodeCookieOptions);
    res.status(200).json({ passcode: newQueue.passcode, isOwner: newQueue.isOwner });
  } catch(err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

app.post("/removeQueue", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const userId = req.cookies.get("user", { signed: true });
  try {
    const newQueue = await QueueService.remove(passcode, userId);
    if (!newQueue) {
      logger.info(`Removed queue ${passcode}. New queue not found.`, { passcode });
      req.cookies.set("passcode", "", config.passcodeCookieOptions);
      res.status(204).json({});
      return;
    }
    logger.info(`Removed queue ${passcode}. New queue:`, { passcode, user: userId });
    logger.info(newQueue);
    req.cookies.set("passcode", newQueue.passcode, config.passcodeCookieOptions);
    res.status(200).json({ passcode: newQueue.passcode, isOwner: newQueue.isOwner });
  } catch(err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

app.get("/currentlyPlaying", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const userId = req.cookies.get("user", { signed: true });

  logger.debug(`Fetching currently playing song...`, { user: userId, passcode });
  try {
    const currentState = await QueueService.getCurrentState(passcode, userId);
    if (currentState) {
      res.status(200).json(currentState);
    } else {
      res.status(204).json({});
    }
  } catch(err) {
    res.status(err.status).json({ message: err.message});
  }
});

app.get("/top", async (req, res) => {
  const userId = req.cookies.get("user", { signed: true });
  const passcode = req.cookies.get("passcode");
  try {
    const top = await QueueService.getTop(passcode, userId);
    res.status(200).json({ tracks: top });
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.get("/favorites", async (req, res) => {
  const userId = req.cookies.get("user", { signed: true });
  try {
    const favorites = await QueueService.getFavorites(userId);
    res.status(200).json({ tracks: favorites });
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.post("/exportFavorites", async (req, res) => {
  const userId = req.cookies.get("user", { signed: true });
  const passcode = req.cookies.get("passcode");
  try {
    await QueueService.exportFavoritesToSpotify(passcode, userId);
    res.status(200).json({ message: "Favorites exported successfully" });
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.post("/addToFavorites", (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });
  const trackId = req.body.trackId;
  const source = req.body.source;

  logger.info(`Adding ${trackId} to favorites`, { user, passcode });
  QueueService.addToFavorites(passcode, user, trackId, source).then(() => {
    res.status(200).json({ msg: "OK" });
  }).catch(err => {
    res.status(err.status).json({ message: err.message });
  });
});

app.post("/removeFromFavorites", (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });
  const trackId = req.body.trackId;

  logger.info(`Removing ${trackId} from favorites`, { user, passcode });
  QueueService.removeFromFavorites(user, trackId).then(() => {
    res.status(200).json({ msg: "OK" });
  }).catch(err => {
    res.status(err.status).json({ message: err.message });
  });
});

app.get("/getAllPerks", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });
  try {
    const perks = await QueueService.getAllPerksWithUserLevel(passcode, user);
    res.status(200).json(perks);
  } catch(err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.get("/getUserPerks", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });

  try {
    const perks = await QueueService.getUserPerks(passcode, user);
    res.status(200).json(perks);
  } catch(err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.post("/buyPerk", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });
  const perk: PerkName = req.body.perk;

  try {
    await QueueService.buyPerk(passcode, user, perk);
    res.status(200).json("OK");
  } catch(err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.put("/upgradePerk", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });
  const perk: PerkName = req.body.perk;

  try {
    await QueueService.upgradePerk(passcode, user, perk);
    res.status(200).json("OK");
  } catch(err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.delete("/removeFromQueue", (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });
  const isPlaying = req.body.isPlaying;
  const trackId = req.body.trackId;

  if (isPlaying) {
    logger.info(`Trying to skip ${trackId}`, { user, passcode });
    QueueService.skip(passcode, user, trackId).then(() => {
      res.status(200).json({ msg: "OK" });
    }).catch(err => {
      res.status(err.status).json({ message: err.message });
    });
  } else {
    logger.info(`Trying to remove ${trackId} from queue`, { user, passcode });
    QueueService.removeFromQueue(passcode, user, trackId).then(() => {
      res.status(200).json({ msg: "OK" });
    }).catch(err => {
      res.status(err.status).json({ message: err.message });
    });
  }
});

app.post("/track", async (req, res, next) => {
  const uri = req.body.uri;
  const source = req.body.source;
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });

  try {
    const queue = await QueueService.addToQueue(user, passcode, uri, source);
    // If no song is playing
    if (!queue.currentTrack) {
      logger.info(`Queue is not playing...start it`, { user, passcode });
      if (!queue.deviceId) {
        throw { status: 400, message: "No playback device selected. Please start Spotify first." };
      }
      try {
        await QueueService.startNextTrack(passcode, user);
        res.status(200).json({ message: "OK" });
      } catch(err) {
        return res.status(err.status).json({ message: err.message });
      }
    } else {
      res.status(200).json({ message: "OK" });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  return next();
});

app.post("/pauseResume", (req, res) => {
  const user = req.cookies.get("user", { signed: true });
  const passcode = req.cookies.get("passcode");

  QueueService.pauseResume(user, passcode).then(isPlaying => {
    res.status(200).json({ isPlaying });
  }).catch(err => {
    res.status(err.status).json({ message: err.message });
  });
});

app.get("/playlists", async (req, res) => {
  const userId = req.cookies.get("user", { signed: true });
  const passcode = req.cookies.get("passcode");
  try {
    const user = await QueueService.getUser(passcode, userId);
    if (user && user.accessToken) {
      const playlists = await SpotifyService.getPlaylists(user.accessToken, userId, passcode);
      res.status(200).json(playlists);
    } else {
      res.status(403).json({ message: "Can't get playlists. Please login with Spotify first." });
    }
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.get("/settings", async (req, res) => {
  try {
    const settings = await QueueService.getSettings(req.cookies.get("passcode"));
    res.status(200).json(settings);
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.get("/user", async (req, res) => {
  try {
    const user = await QueueService.getUser(req.cookies.get("passcode"), req.cookies.get("user", { signed: true }));
    delete user.accessToken;
    delete user.refreshToken;
    delete user.expiresIn;
    delete user.accessTokenAcquired;
    res.status(200).json(user);
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.post("/user", async (req, res) => {
  try {
    const passcode = req.cookies.get("passcode");
    const userId = req.cookies.get("user", { signed: true });
    const username = req.body.username;
    const user = await QueueService.updateUser(userId, username, passcode);
    res.status(200).json(user);
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await QueueService.getUsers(req.cookies.get("passcode"));
    res.status(200).json(users);
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.get("/userQueues", async (req, res) => {
  try {
    const queues = await QueueService.getUserQueues(req.cookies.get("passcode"), req.cookies.get("user", { signed: true }));
    res.status(200).json(queues);
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.delete("/removeUser", async (req, res) => {
  try {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user", { signed: true });
    const removeUser = req.body.userId;
    await QueueService.removeUser(passcode, user, removeUser);
    res.status(200).json({ msg: "OK" });
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.put("/resetPoints", async (req, res) => {
  try {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user", { signed: true });
    const resetUser = req.body.userId;
    await QueueService.resetPoints(passcode, user, resetUser);
    res.status(200).json({ msg: "OK" });
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.put("/vote", async (req, res) => {
  try {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user", { signed: true });
    const value = req.body.value;
    await QueueService.vote(passcode, user, value);
    res.status(200).json({ message: "OK" });
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.post("/updateSettings", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });
  const settings: Settings = req.body.settings;
  const updatedFields: string[] = req.body.updatedFields;
  try {
    const resp = await QueueService.updateSettings(passcode, user, settings, updatedFields);
    res.status(200).json(resp);
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.get("/playlist", async (req, res) => {
  const user = req.cookies.get("user", { signed: true });
  const passcode = req.cookies.get("passcode");
  const playlistId = req.query.id;
  try {
    const queue = await QueueService.getQueue(passcode);
    const tracks = await SpotifyService.getPlaylistTracks(queue.accessToken!, queue.owner, playlistId, user, passcode);
    res.status(200).json({ tracks: await QueueService.markFavorites(passcode, user, tracks) });
  } catch(err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.put("/queuePlaylist", async (req, res) => {
  const user = req.cookies.get("user", { signed: true });
  const passcode = req.cookies.get("passcode");
  const playlistId = req.body.id;
  try {
    const queueDao = await QueueService.getQueue(req.cookies.get("passcode"));
    const tracks = playlistId === "top"
      ? await QueueService.getTop(passcode, user)
      : playlistId === "favorites"
        ? await QueueService.getFavorites(user)
        : await SpotifyService.getPlaylistTracks(queueDao.accessToken!, queueDao.owner, playlistId, user, passcode);
    QueueService.addToPlaylistQueue(user, passcode, tracks, playlistId).then(() => {
      res.status(200).json({ message: "OK" });
    }).catch(err => {
      res.status(err.status).json({ message: err.message });
    });
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.put("/queueFavorites", async (req, res) => {
  const user = req.cookies.get("user", { signed: true });
  const passcode = req.cookies.get("passcode");
  try {
    QueueService.addFavoritesToPlaylistQueue(user, passcode).then(() => {
      res.status(200).json({ message: "OK" });
    }).catch(err => {
      res.status(err.status).json({ message: err.message });
    });
  } catch (err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.get("/selectAlbum", async (req, res) => {
  const user = req.cookies.get("user", { signed: true });
  const passcode = req.cookies.get("passcode");

  try {
    const accessToken = await QueueService.getAccessToken(req.cookies.get("passcode"));
    const albumTracks = await SpotifyService.getAlbum(accessToken, req.query.id, user, passcode);
    res.status(200).json(await QueueService.markFavorites(passcode, user, albumTracks));
  } catch(err) {
    res.status(err.status).json({ message: err.message });
  }
});

app.get("/selectArtist", async (req, res) => {
  const user = req.cookies.get("user", { signed: true });
  const passcode = req.cookies.get("passcode");

  try {
    const accessToken = await QueueService.getAccessToken(req.cookies.get("passcode"));
    const tracks = await SpotifyService.getArtistTopTracks(accessToken, req.query.id, user, passcode);
    const albums = await SpotifyService.getArtistAlbums(accessToken, req.query.id, user, passcode);
    res.status(200).json({ 
      tracks: await QueueService.markFavorites(passcode, user, tracks),
      albums 
    });
  } catch(err) {
    res.status(err.status || 500).json({ message: err });
  }
});

app.post("/search", async (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });

  const query: SpotifySearchQuery = {
    q: req.body.q,
    type: req.body.type,
    market: "FI",
    limit: req.body.limit
  };

  try {
    const accessToken = await QueueService.getAccessToken(passcode);
    const searchResults = await SpotifyService.search(user, passcode, accessToken, query);
    searchResults.tracks = await QueueService.markFavorites(passcode, user, searchResults.tracks);
    res.status(200).json(searchResults);
  } catch(err) {
    res.status(500).json({ message: err });
  }
});

app.get("/youtubeEnd", (req, res) => {
  const passcode = req.cookies.get("passcode");
  const user = req.cookies.get("user", { signed: true });
  QueueService.startNextTrack(passcode, user);
  res.status(200).json({ message: "OK" });
});

app.post("/youtubeSearch", async (req, res) => {
  const query: YoutubeSearchQuery = {
    q: req.body.q,
    limit: req.body.limit
  };

  var opts = {
    maxResults: query.limit,
    key: secrets.youtube.key,
    type: "video",
    videoSyndicated: "true",
    videoEmbeddable: "true",
    videoCategoryId: "10"
  };

  await youtubeSearch(query.q, opts, async (err, results) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user", { signed: true });
    if (err) {
      logger.error(`Unable to search from YouTube`, [passcode, user]);
      logger.error(err);
      return res.status(500).json({ message: "Error occurred while searching from YouTube. Please try again." });
    }

    if (!results) {
      return res.status(404).json([]);
    }

    const ids = results!.map(v => v.id);
    let videos = await YoutubeService.getTracks(ids.join(","));
    if (videos) {
      videos = await QueueService.markFavorites(passcode, user, videos!);
    }
    return res.status(200).json(videos);
  });
});

QueueService.startOngoingTimers();

app.use((error: any, request: express.Request, response: express.Response, next: (error: any) => any) => {
  if (response.headersSent) {
    return next(error);
  }
  // Return errors as JSON.
  response
    .status(error.status || 500)
    .json({
      name: error.name || "Error",
      message: error.message || error
    });
});
app.use(Gamify.post);

app.get("*", (request: express.Request, response: express.Response) => response.status(404).send());

// Do not listen if app is already running.
// This happens when running tests on watch mode.
if (!module.parent) {
  server.listen(config.app.port);
}
logger.info(`Application running on port: ${config.app.port}`);
