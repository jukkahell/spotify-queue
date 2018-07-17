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
import {Queue, QueueDao, Settings} from "./queue";
import QueueService from "./queue.service";
import secrets from "./secrets";
import {SpotifySearchQuery} from "./spotify";
import { logger } from "./logger.service";
import SpotifyService from "./spotify.service";
import Acl, { AuthResult } from "./acl";
import { Gamify } from "./gamify";

const keys = Array.from({length: 10}, () => randomstring.generate(15));
const keygrip = new Keygrip(keys, "sha256");

const app = express();
app.use(cors(config.app.cors));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(Cookies.express(keygrip));
app.use(Acl.authFilter);
app.use(Acl.adminFilter);
app.use(Gamify.express);

const options = env.NODE_ENV === "production" ? {
    key: fs.readFileSync(secrets.certPath + "privkey.pem"),
    cert: fs.readFileSync(secrets.certPath + "fullchain.pem")
} : {};

const server = env.NODE_ENV === "production" ? https.createServer(options, app) : http.createServer(app);

app.get("/create", (req, res) => {
    QueueService.create(req.query.code).then(queue => {
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
    QueueService.reactivate(passcode, user, req.query.code).then(queue => {
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

    QueueService.logout(passcode, user).then(() => {
        req.cookies.set("passcode", "", config.passcodeCookieOptions);
        res.status(200).json({ message: "OK" });
    }).catch(err => {
        res.status(err.status).json({ message: err.message });
    });
});

app.put("/join", (req, res) => {
    const passcode = req.body.code;
    const userId = req.cookies.get("user");

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

    Acl.isAuthorized(req.cookies.get("passcode"), req.cookies.get("user")).then((authResult: AuthResult) => {
        res.status(200).json(authResult);
    }).catch(err => {
        res.status(err.status).json({ isAuthorized: false, message: err.message });
    });
});

app.get("/devices", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");

    QueueService.getAccessToken(req.cookies.get("passcode")).then(accessToken => {
        SpotifyService.getDevices(accessToken)
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
                QueueService.getQueue(passcode, true).then(queueDao => {
                    const queue: Queue = queueDao.data;
                    if (queue.deviceId !== activeDeviceId) {
                        logger.debug(`Different device in db...updating`, { user, passcode });
                        queue.deviceId = activeDeviceId!;
                        QueueService.updateQueueData(queue, passcode).catch(err => {
                            logger.error("Unable to set device id", { user, passcode });
                            logger.error(err, { user, passcode });
                        });
                    }
                    if (!spotifyHasActiveDevice) {
                        // Set it to spotify as well
                        SpotifyService.setDevice(accessToken, queueDao.isPlaying, activeDeviceId!).catch(err => {
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
        QueueService.setDevice(passcode, user, req.body.deviceId)
        .then(resp => {
            SpotifyService.setDevice(resp["accessToken"], resp["isPlaying"], req.body.deviceId).then(() => {
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

    QueueService.getQueue(passcode).then(queueDao => {
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
    QueueService.getCurrentTrack(passcode, user).then(result => {
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

app.post("/track", (req, res) => {
    const spotifyUri = req.body.spotifyUri;
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");

    QueueService.addToQueue(user, passcode, spotifyUri).then((queue: QueueDao) => {
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

    QueueService.pauseResume(user, passcode).then(isPlaying => {
        res.status(200).json({ isPlaying });
    }).catch(err => {
        res.status(err.status).json({ message: err.message });
    });
});

app.get("/playlists", async (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");
    try {
        const queueDao = await QueueService.getQueue(req.cookies.get("passcode"));
        const playlists = await SpotifyService.getPlaylists(queueDao.data.accessToken!, user, passcode);
        res.status(200).json(playlists);
    } catch (err) {
        res.status(err.status).json({ message: err.message });
    }
});

app.get("/settings", async (req, res) => {
    try {
        const queueDao = await QueueService.getQueue(req.cookies.get("passcode"));
        res.status(200).json(queueDao.data.settings);
    } catch (err) {
        res.status(err.status).json({ message: err.message });
    }
});

app.get("/user", async (req, res) => {
    try {
        const user = await QueueService.getUser(req.cookies.get("passcode"), req.cookies.get("user"));
        res.status(200).json(user);
    } catch (err) {
        res.status(err.status).json({ message: err.message });
    }
});

app.put("/vote", async (req, res) => {
    try {
        const passcode = req.cookies.get("passcode");
        const user = req.cookies.get("user");
        const value = req.body.value;
        await QueueService.vote(passcode, user, value);
        res.status(200).json({ message: "OK" });
    } catch (err) {
        res.status(err.status).json({ message: err.message });
    }
});

app.post("/updateSettings", async (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user");
    const settings: Settings = req.body.settings;
    try {
        const resp = await QueueService.updateSettings(passcode, user, settings);
        res.status(200).json(resp);
    } catch (err) {
        res.status(err.status).json({ message: err.message });
    }
});

app.put("/selectPlaylist", (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");
    const playlistId = req.body.id;
    QueueService.getQueue(req.cookies.get("passcode")).then(queueDao => {
        SpotifyService.getPlaylistTracks(queueDao.data.accessToken!, queueDao.owner, playlistId, user, passcode).then(tracks => {
            QueueService.addToPlaylistQueue(user, passcode, tracks, playlistId).then(() => {
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

    QueueService.getAccessToken(req.cookies.get("passcode")).then(accessToken => {
        SpotifyService.getAlbum(accessToken, req.query.id, user, passcode).then(albums => {
            res.status(200).json(albums);
        });
    }).catch(err => {
        res.status(err.status).json({ message: err.message });
    });
});

app.get("/selectArtist", (req, res) => {
    const user = req.cookies.get("user");
    const passcode = req.cookies.get("passcode");

    QueueService.getAccessToken(req.cookies.get("passcode")).then(accessToken => {
        SpotifyService.getArtistTopTracks(accessToken, req.query.id, user, passcode).then((tracks: any) => {
            SpotifyService.getArtistAlbums(accessToken, req.query.id, user, passcode).then((albums: any) => {
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

    QueueService.getAccessToken(passcode).then(accessToken => {
        SpotifyService.search(user, passcode, accessToken, query).then(results => {
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

        QueueService.updateQueue(queue, true, passcode).then(() => {
            logger.debug(`Current track set to ${queuedItem.track.id}`, { user, passcode });
            SpotifyService.startSong(accessToken, [queuedItem.track.id], deviceId!).then(() => {
                QueueService.startPlaying(accessToken, passcode, user, queuedItem.track);
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

app.get("*", (request: express.Request, response: express.Response) => response.status(404).send());

// Do not listen if app is already running.
// This happens when running tests on watch mode.
if (!module.parent) {
    server.listen(config.app.port);
}
logger.info(`Application running on port: ${config.app.port}`);
