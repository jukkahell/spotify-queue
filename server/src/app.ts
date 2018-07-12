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
import config from "./config";
import { CurrentTrack, Queue } from "./queue";
import QueueService from "./queue.service";
import secrets from "./secrets";
import {SpotifySearchQuery} from "./spotify";
import Spotify, { SearchResults } from "./spotify.service";
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

const excludeEndpointsFromAuth = ["/join", "/create", "/reactivate", "/isAuthorized", "/queue"];
const endpointsRequireOwnerPerm = ["/device"];

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

    const callback = (accessToken: string) => {
        spotify.getDevices(accessToken)
        .then((response: any) => {
            let activeDeviceId: string | undefined;
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
            } else if (!activeDeviceId && devices.length === 0) {
                logger.debug(`No available devices found...giving info for user`, { user, passcode });
                res.status(404).json({ message: "No available devices found. Please start Spotify and then refresh the page." });
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
                        queueService.updateQueue(queue, passcode).catch(err => {
                            logger.error("Unable to set device id", { user, passcode });
                            logger.error(err, { user, passcode });
                        });
                    }
                }).catch(err => {
                    logger.error(err, { user, passcode });
                    res.status(500).json({ message: err.message });
                });
            }
        }).catch((err: any) => {
            logger.error(err.response.data.error.message, { user, passcode });
            res.status(500).json({ message: "Error getting available devices" });
        });
    };

    queueService.getAccessToken(req.cookies.get("passcode"), callback, (err) => {
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
    getCurrentTrack(user, passcode)
        .then((result) => {
            res.status(200).json(result);
        }).catch(() => {
            res.status(204).json({});
        });
});

app.post("/track", (req, res) => {
    const spotifyUri = req.body.spotifyUri;
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");

    queueService.addToQueue(user, passcode, spotifyUri, spotify.getTrack)
    .then((queue: Queue) => {
        // If no song is playing
        if (!queue.isPlaying) {
            logger.info(`Queue ${passcode} is not playing...start it`, { user, passcode });
            startPlaying(queue, passcode, user).then(() => {
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

app.get("/selectAlbum", (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");

    const callback = (accessToken: string) => {
        spotify.getAlbum(accessToken, req.query.id)
        .then((response: any) => {
            res.status(200).json(
                response.data.tracks.items.map((i: any) => {
                    return {
                        artist: i.artists[0].name,
                        name: i.name,
                        id: i.uri
                    };
                })
            );
        }).catch((error: any) => {
            logger.error(error.response.data, { user, passcode });
            res.status(500).json({ message: "Unable to get requested album" });
        });
    };

    queueService.getAccessToken(req.cookies.get("passcode"), callback, err => {
        res.status(500).json({ message: err });
    });
});

app.get("/selectArtist", (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");

    const callback = (accessToken: string) => {
        spotify.getArtistTopTracks(accessToken, req.query.id)
        .then((topTracks: any) => {

            spotify.getArtistAlbums(accessToken, req.query.id)
            .then((albums: any) => {
                res.status(200).json({
                    tracks: topTracks.data.tracks.map((i: any) => {
                        return {
                            artist: i.artists[0].name,
                            name: i.name,
                            id: i.uri
                        };
                    }),
                    albums: albums.data.items.map((album: any) => {
                        return {
                            artist: album.artists[0].name,
                            name: album.name,
                            id: album.id
                        };
                        })
                });
            }).catch((error: any) => {
                logger.error(error.response.data, { user, passcode });
                res.status(500).json({ message: "Unable to get requested artist's albums" });
            });
        }).catch((error: any) => {
            logger.error(error.response.data, { user, passcode });
            res.status(500).json({ message: "Unable to get requested artist's top tracks" });
        });
    };

    queueService.getAccessToken(req.cookies.get("passcode"), callback, err => {
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

    const callback = (accessToken: string) => {
        spotify.search(accessToken, query).then((response: any) => {
            const results = new SearchResults();
            if (query.type.indexOf("track") >= 0) {
                results.tracks = response.data.tracks.items.map((i: any) => {
                    return {
                        artist: i.artists[0].name,
                        name: i.name,
                        id: i.uri
                    };
                });
            } else {
                results.tracks = [];
            }
            if (query.type.indexOf("album") >= 0) {
                results.albums = response.data.albums.items.map((album: any) => {
                    return {
                        artist: album.artists[0].name,
                        name: album.name,
                        id: album.id
                    };
                });
            } else {
                results.albums = [];
            }
            if (query.type.indexOf("artist") >= 0) {
                results.artists = response.data.artists.items.map((artist: any) => {
                    return {
                        name: artist.name,
                        id: artist.id
                    };
                });
            } else {
                results.artists = [];
            }
            res.status(200).json(results);
        }).catch(err => {
            if (err.response) {
                logger.error(`Error with search query ${req.query.q}`, { user, passcode });
                logger.error(err.response.data.error.message, { user, passcode });
            } else {
                logger.error(err, { user, passcode });
            }
            res.status(500).json({ message: "Error when searching for a song" });
        });
    };

    queueService.getAccessToken(passcode, callback, err => {
        res.status(500).json({ message: err });
    });
});

const getCurrentTrack = (user: string, passcode: string) => {
    return new Promise((resolve, reject) => {
        const onSuccess = (accessToken: string, currentTrack: CurrentTrack, isPlaying: boolean) => {
            if (currentTrack) {
                logger.debug(`Getting currently playing track ${currentTrack.track.id} from spotify...`, { user, passcode });
                spotify.currentlyPlaying(accessToken).then(response => {
                    currentTrack.track.progress = response.data.progress_ms;

                    logger.debug(`Found track. isPlaying: ${response.data.is_playing}, progress: ${response.data.progress_ms}ms`,
                        { user, passcode });
                    // If is playing info is out of sync with Spotify
                    if (isPlaying !== response.data.is_playing) {
                        logger.debug(`isPlaying state was out of sync...updating`, { user, passcode });
                        isPlaying = response.data.is_playing;
                        queueService.getQueue(passcode, true).then(queueDao => {
                            const queue: Queue = queueDao.data;
                            queue.isPlaying = isPlaying;
                            queueService.updateQueue(queue, passcode)
                            .then(() => {
                                logger.debug(`isPlaying state updated`, { user, passcode });
                            }).catch(err => {
                                logger.error("Failed to update isPlaying state.", { user, passcode });
                                logger.error(err, { user, passcode });
                            });
                        }).catch(err => {
                            logger.error("Failed to get queue when saving playing state", { user, passcode });
                        });
                    }

                    return resolve({currentTrack, isPlaying});
                }).catch(() => {
                    logger.warn("Unable to get track progress from Spotify...resolve anyway.", { user, passcode });
                    return resolve({currentTrack, isPlaying});
                });
            } else {
                return reject();
            }
        };

        const onError = () => {
            // Wait a bit so that spotify catches up
            setTimeout(() => {
                queueService.getCurrentTrack(passcode, user, onSuccess, () => {
                    return reject();
                });
            }, 4000);
        };

        queueService.getCurrentTrack(passcode, user, onSuccess, onError);
    });
};

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
        queue.isPlaying = true;

        queueService.updateQueue(queue, passcode).then(() => {
            logger.debug(`Current track set to ${queuedItem.track.id}`, { user, passcode });
            spotify.startSong(accessToken, queuedItem.track.id, deviceId!).then(() => {
                queueService.startPlaying(accessToken, passcode, user, queuedItem.track, spotify, startNextTrack);
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

const startNextTrack = (passcode: string, user: string, accessToken: string) => {
    logger.info(`Starting next track`, { user, passcode });
    queueService.getQueue(passcode, true).then(queueDao => {
        if (queueDao.data.queue.length === 0) {
            logger.info("No more songs in queue. Stop playing.", { user, passcode });
            queueService.stopPlaying(queueDao.data, accessToken, passcode);
            return;
        }
        const queue: Queue = queueDao.data;
        const queuedItem = queue.queue.shift()!;
        queue.currentTrack = {
            track: queuedItem.track,
            owner: queuedItem.userId,
            votes: []
        };

        logger.info(`Next track is ${queuedItem.track.id}`, { user, passcode });
        queueService.updateQueue(queue, passcode).then(() => {
            // Check that access token is still valid
            spotify.isAuthorized(passcode, user, queue.accessTokenAcquired, queue.expiresIn, queue.refreshToken).then((response: any) => {
                if (response) {
                    acl.saveAccessToken(queue, passcode, user, response.access_token, response.expires_in, response.refresh_token);
                    accessToken = response.access_token;
                }
                spotify.startSong(accessToken, queuedItem.track.id, queue.deviceId!).then(() => {
                    queueService.startPlaying(accessToken, passcode, user, queuedItem.track, spotify, startNextTrack);
                    logger.info(`Track ${queuedItem.track.id} successfully started.`, { user, passcode });
                }).catch((err: any) => {
                    logger.info(err.response.data.error.message, { user, passcode });
                });
            }).catch(err => {
                logger.error(err, { user, passcode });
            });
        }).catch(err => {
            logger.error("Unable to update queue", { user, passcode });
            logger.error(err, { user, passcode });
        });
    }).catch(() => {
        logger.error("Unable to get queue when starting next track", { user, passcode });
    });
};

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
