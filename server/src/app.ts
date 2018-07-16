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
import { format } from "winston";
import * as winston from "winston";
import Acl, { AuthResult } from "./acl";
import config, { passcodeCookieExpire, userCookieExpire } from "./config";
import {Queue, QueueDao, Settings} from "./queue";
import QueueService from "./queue.service";
import secrets from "./secrets";
import {SpotifySearchQuery} from "./spotify";
import Spotify from "./spotify.service";
const DailyRotateFile = require("winston-daily-rotate-file");

const keys = Array.from({length: 10}, () => randomstring.generate(15));
const keygrip = new Keygrip(keys, "sha256");

const logFormat = format.printf(info => {
    const p = info.passcode ? info.passcode : "";
    const u = info.user ? info.user : "";
    const i = info.id ? info.id : "";
    const level = info.level.padEnd(15); // 15 because of the color bytes

    if (p || u) {
        return `${info.timestamp} ${level} - [${p}][${u}] ${info.message}`;
    } else if (i) {
        return `${info.timestamp} ${level} - [${i}] ${info.message}`;
    } else {
        return `${info.timestamp} ${level} - ${info.message}`;
    }
  });
const logger = winston.createLogger({
    level: config.app.logger.level,
    format: format.combine(
        format.colorize(),
        format.timestamp(),
        logFormat
    ),
    transports: [
      new winston.transports.Console(),
      new DailyRotateFile({
        filename: "spotiqu-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        zippedArchive: false,
        maxFiles: "14d"
      })
    ]
  });

const spotify = new Spotify(logger, config.spotify.clientId, secrets.spotify.secret, config.spotify.redirectUri);
const queueService = new QueueService(logger);
const acl = new Acl(logger, spotify, queueService);

const excludeEndpointsFromAuth = ["/join", "/create", "/reactivate", "/isAuthorized", "/queue", "/currentlyPlaying"];
const endpointsRequireOwnerPerm = ["/device", "/pauseResume", "/selectPlaylist", "/updateSettings"];

const app = express();
app.use(cors(config.app.cors));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(Cookies.express(keygrip));
app.use((req: express.Request, res: express.Response, next: () => any) => {
    if (excludeEndpointsFromAuth.includes(req.path)) {
        return next();
    } else {
        acl.isAuthorized(req.cookies.get("passcode"), req.cookies.get("user")).then(() => {
            return next();
        }).catch(err => {
            return res.status(err.status).json({ message: err.message });
        });
    }
});
app.use((req: express.Request, res: express.Response, next: () => any) => {
    if (endpointsRequireOwnerPerm.includes(req.path)) {
        queueService.isOwner(req.cookies.get("passcode"), req.cookies.get("user")).then(() => {
            return next();
        }).catch(err => {
            return res.status(err.status).json({ message: err.message });
        });
    } else {
        return next();
    }
});

const options = env.NODE_ENV === "production" ? {
    key: fs.readFileSync(secrets.certPath + "privkey.pem"),
    cert: fs.readFileSync(secrets.certPath + "fullchain.pem")
} : {};

const server = env.NODE_ENV === "production" ? https.createServer(options, app) : http.createServer(app);

app.get("/create", (req, res) => {
    queueService.create(spotify, req.query.code).then(queue => {
        config.passcodeCookieOptions.expires = passcodeCookieExpire();
        config.userCookieOptions.expires = userCookieExpire();
        req.cookies.set("user", queue.data.owner, config.userCookieOptions);
        req.cookies.set("passcode", queue.id, config.passcodeCookieOptions);
        res.status(200).send("<script>window.close();</script>");
    }).catch(err => {
        res.status(err.status).send(err.message);
    });
});

app.get("/reactivate", (req, res) => {
    const passcode = req.cookies.get("reactivate");
    const user = req.cookies.get("user");
    queueService.reactivate(spotify, passcode, user, req.query.code).then(queue => {
        config.passcodeCookieOptions.expires = passcodeCookieExpire();
        config.userCookieOptions.expires = userCookieExpire();
        req.cookies.set("user", queue.owner, config.userCookieOptions);
        req.cookies.set("passcode", passcode, config.passcodeCookieOptions);
        req.cookies.set("reactivate", "", config.passcodeCookieOptions);
        res.status(200).send("<script>window.close();</script>");
    }).catch(err => {
        res.status(err.status).send(err.message);
    });
});

app.get("/logout", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");
    logger.debug(`Logging out user...`, { user, passcode });

    queueService.logout(passcode, user).then(() => {
        req.cookies.set("passcode", "", config.passcodeCookieOptions);
        res.status(200).json({ message: "OK" });
    }).catch(err => {
        res.status(err.status).json({ message: err.message });
    });
});

app.put("/join", (req, res) => {
    const passcode = req.body.code;
    const userId = req.cookies.get("user");

    queueService.join(passcode, userId).then(isOwner => {
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

    acl.isAuthorized(req.cookies.get("passcode"), req.cookies.get("user")).then((authResult: AuthResult) => {
        res.status(200).json(authResult);
    }).catch(err => {
        res.status(err.status).json({ isAuthorized: false, message: err.message });
    });
});

app.get("/devices", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");

    queueService.getAccessToken(req.cookies.get("passcode")).then(accessToken => {
        spotify.getDevices(accessToken)
        .then((response: any) => {
            let activeDeviceId: string | undefined;
            let spotifyHasActiveDevice = true;
            const devices: any[] = response.data.devices.map((device: any) => {
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
                res.status(404).json({ message: "No available devices found. Please start a song in Spotify and then refresh the page." });
                return;
            }

            res.status(200).json(devices);

            // If there was active device set it as device id for this queue
            if (activeDeviceId !== undefined) {
                queueService.getQueue(passcode, true).then(queueDao => {
                    const queue: Queue = queueDao.data;
                    if (queue.deviceId !== activeDeviceId) {
                        logger.debug(`Different device in db...updating`, { user, passcode });
                        queue.deviceId = activeDeviceId!;
                        queueService.updateQueueData(queue, passcode).catch(err => {
                            logger.error("Unable to set device id", { user, passcode });
                            logger.error(err, { user, passcode });
                        });
                    }
                    if (!spotifyHasActiveDevice) {
                        // Set it to spotify as well
                        spotify.setDevice(accessToken, queueDao.isPlaying, activeDeviceId!).catch(err => {
                            logger.error("Unable to set device to spotify...", {user, passcode});
                            if (err.response) {
                                logger.error(err.response.data.error.message, {user, passcode});
                            }
                        });
                    }
                }).catch(err => {
                    logger.error(err, { user, passcode });
                    res.status(500).json({ message: err.message });
                });
            }
        }).catch(err => {
            logger.error(err.response.data.error.message, { user, passcode });
            res.status(500).json({ message: "Error getting available devices" });
        });
    }).catch(err => {
        res.status(500).json({ message: err });
    });
});

app.put("/device", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");

    logger.info(`Activating device ${req.body.deviceId}`, { user, passcode });
    if (req.body.deviceId) {
        queueService.setDevice(passcode, user, req.body.deviceId)
        .then(resp => {
            spotify.setDevice(resp["accessToken"], resp["isPlaying"], req.body.deviceId).then(() => {
                logger.debug(`Device set successfully to spotify.`, { user, passcode });
                res.status(200).json({ message: "OK" });
            }).catch(err => {
                logger.error("Unable to update device to spotify.", { user, passcode });
                logger.error(err.response.data.error.message, { id: user });
            });
        }).catch(err => {
            logger.error(err, { user, passcode });
            res.status(500).json({ message: err });
        });
    } else {
        res.status(400).json({ message: "Invalid device id" });
    }
});

app.get("/queue", (req, res) => {
    const passcode = req.cookies.get("passcode");

    queueService.getQueue(passcode).then(queueDao => {
        if (queueDao.data.queue.length === 0) {
            res.status(204).json({ message: "No messages in queue" });
            return;
        }

        res.status(200).json({
            queuedItems: queueDao.data.queue
        });
    }).catch(err => {
        res.status(500).json({ message: err.message });
    });
});

app.get("/currentlyPlaying", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");

    logger.debug(`Fetching currently playing song...`, { user, passcode });
    queueService.getCurrentTrack(passcode, user, spotify, acl).then(result => {
        res.status(200).json(result);
    }).catch(() => {
        res.status(204).json({});
    });
});

app.delete("/removeFromQueue", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");
    const isPlaying = req.body.isPlaying;
    const trackId = req.body.trackId;

    if (isPlaying) {
        logger.info(`Trying to skip ${trackId}`, { user, passcode });
        queueService.skip(passcode, user, trackId, spotify, acl).then(() => {
            res.status(200).json({ msg: "OK" });
        }).catch(err => {
            res.status(err.status).json({ message: err.message });
        });
    } else {
        logger.info(`Trying to remove ${trackId} from queue`, { user, passcode });
        queueService.removeFromQueue(passcode, user, trackId).then(() => {
            res.status(200).json({ msg: "OK" });
        }).catch(err => {
            res.status(err.status).json({ message: err.message });
        });
    }
});

app.post("/track", (req, res) => {
    const spotifyUri = req.body.spotifyUri;
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");

    queueService.addToQueue(user, passcode, spotifyUri, spotify.getTrack).then((queue: QueueDao) => {
        // Check playback status from spotify
        // If no song is playing
        if (!queue.isPlaying) {
            logger.info(`Queue ${passcode} is not playing...start it`, { user, passcode });
            startPlaying(queue.data, passcode, user).then(() => {
                res.status(200).json({ message: "OK" });
            }).catch(err => {
                res.status(err.status).json({ message: err.message });
            });
        } else {
            res.status(200).json({ message: "OK" });
        }
    }).catch(err => {
        res.status(500).json({ message: err.message });
    });
});

app.post("/pauseResume", (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");

    queueService.pauseResume(user, passcode, spotify, acl).then(isPlaying => {
        res.status(200).json({ isPlaying });
    }).catch(err => {
        res.status(err.status).json({ message: err.message });
    });
});

app.get("/playlists", async (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");
    try {
        const queueDao = await queueService.getQueue(req.cookies.get("passcode"));
        const playlists = await spotify.getPlaylists(queueDao.data.accessToken!, user, passcode);
        res.status(200).json(playlists);
    } catch (err) {
        res.status(err.status).json({ message: err.message });
    }
});

app.get("/settings", async (req, res) => {
    try {
        const queueDao = await queueService.getQueue(req.cookies.get("passcode"));
        res.status(200).json(queueDao.data.settings);
    } catch (err) {
        res.status(err.status).json({ message: err.message });
    }
});

app.post("/updateSettings", async (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");
    const settings: Settings = req.body.settings;
    try {
        const resp = await queueService.updateSettings(passcode, user, settings);
        res.status(200).json(resp);
    } catch (err) {
        res.status(err.status).json({ message: err.message });
    }
});

app.put("/selectPlaylist", (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");
    const playlistId = req.body.id;
    queueService.getQueue(req.cookies.get("passcode")).then(queueDao => {
        spotify.getPlaylistTracks(queueDao.data.accessToken!, queueDao.owner, playlistId, user, passcode).then(tracks => {
            queueService.addToPlaylistQueue(user, passcode, tracks, playlistId).then(() => {
                res.status(200).json({ message: "OK" });
            }).catch(err => {
                res.status(err.status).json({ message: err.message });
            });
        });
    }).catch(err => {
        res.status(err.status).json({ message: err.message });
    });
});

app.get("/selectAlbum", (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");

    queueService.getAccessToken(req.cookies.get("passcode")).then(accessToken => {
        spotify.getAlbum(accessToken, req.query.id, user, passcode).then(albums => {
            res.status(200).json(albums);
        });
    }).catch(err => {
        res.status(err.status).json({ message: err.message });
    });
});

app.get("/selectArtist", (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");

    queueService.getAccessToken(req.cookies.get("passcode")).then(accessToken => {
        spotify.getArtistTopTracks(accessToken, req.query.id, user, passcode).then((tracks: any) => {
            spotify.getArtistAlbums(accessToken, req.query.id, user, passcode).then((albums: any) => {
                res.status(200).json({ tracks, albums });
            });
        }).catch(err => {
            res.status(err.status).json({ message: err.message });
        });
    }).catch(err => {
        res.status(500).json({ message: err });
    });
});

app.get("/search", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");

    const query: SpotifySearchQuery = {
        q: req.query.q,
        type: req.query.type,
        market: "FI",
        limit: req.query.limit
    };

    queueService.getAccessToken(passcode).then(accessToken => {
        spotify.search(user, passcode, accessToken, query).then(results => {
            res.status(200).json(results);
        }).catch(err => {
            res.status(err.status).json({ message: err.message });
        });
    }).catch(err => {
        res.status(500).json({ message: err });
    });
});

const startPlaying = (queue: Queue, passcode: string, user: string) => {
    return new Promise((resolve, reject) => {
        const deviceId = queue.deviceId;
        if (!deviceId) {
            return reject({ status: 404, message: "No device selected" });
        }

        logger.info(`Starting to play queue...`, { user, passcode });
        const accessToken = queue.accessToken!;
        const queuedItem = queue.queue.shift()!;
        queue.currentTrack = {
            track: queuedItem.track,
            owner: queuedItem.userId,
            votes: []
        };

        queueService.updateQueue(queue, true, passcode).then(() => {
            logger.debug(`Current track set to ${queuedItem.track.id}`, { user, passcode });
            spotify.startSong(accessToken, [queuedItem.track.id], deviceId!).then(() => {
                queueService.startPlaying(accessToken, passcode, user, queuedItem.track, spotify, acl);
                logger.info(`Song successfully started.`, { user, passcode });
                return resolve();
            }).catch((err: any) => {
                if (err.response.data.error.status === 404) {
                    logger.warn(`No device selected`, { user, passcode });
                    return reject({ status: 404, message: "Unable to start playing. Select a playback device from bottom left icon." });
                }
                logger.error(err.response.data.error.message, { user, passcode });
                return reject({ status: err.response.data.error.status, message: "Unable to start playing" });
            });
        }).catch(err => {
            logger.error(err, { user, passcode });
            return reject({ status: 500, message: "Error occurred while to updating queue." });
        });
    });
};

queueService.startOngoingTimers(spotify, acl);

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

app.get("*", (request: express.Request, response: express.Response) => response.status(404).send());

// Do not listen if app is already running.
// This happens when running tests on watch mode.
if (!module.parent) {
    server.listen(config.app.port);
}
logger.info(`Application running on port: ${config.app.port}`);
