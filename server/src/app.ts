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
import { Queue, Settings, QueueDao } from "./queue";
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
    const user = req.cookies.get("user", { signed: true });
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

app.get("/visitorAuth", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user", { signed: true });
    QueueService.visitorSpotifyLogin(passcode, user, req.query.code).then((user) => {
        config.userCookieOptions.expires = userCookieExpire();
        req.cookies.set("user", user.id, config.userCookieOptions);
        res.status(200).send("<script>window.close();</script>");
    }).catch(err => {
        res.status(err.status).send(err.message);
    });
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
        req.cookies.set("passcode", req.cookies.get("passcode"), config.passcodeCookieOptions);
        req.cookies.set("user", req.cookies.get("user"), config.userCookieOptions);
        res.status(200).json(authResult);
    }).catch(err => {
        res.status(err.status).json({ isAuthorized: false, message: err.message });
    });
});

app.get("/devices", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user", { signed: true });

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
                res.status(404).json({ message: "No available devices found. Please start Spotify and then try again." });
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
    const user = req.cookies.get("user", { signed: true });

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
    const user = req.cookies.get("user", { signed: true });

    logger.debug(`Fetching currently playing song...`, { user, passcode });
    QueueService.getCurrentTrack(passcode, user).then(result => {
        delete result.accessToken;
        res.status(200).json(result);
    }).catch(() => {
        res.status(204).json({});
    });
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

app.post("/track", (req, res) => {
    const uri = req.body.uri;
    const source = req.body.source;
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user", { signed: true });

    QueueService.addToQueue(user, passcode, uri, source).then((queue: QueueDao) => {
        // If no song is playing
        if (!queue.data.currentTrack) {
            logger.info(`Queue is not playing...start it`, { user, passcode });
            if (!queue.data.deviceId) {
                throw { status: 400, message: "No playback device selected. Please start Spotify first." };
            }
            QueueService.startNextTrack(passcode, user).then(() => {
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
        const queueDao = await QueueService.getQueue(req.cookies.get("passcode"));
        res.status(200).json(queueDao.data.settings);
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
        const user = await QueueService.updateUser(passcode, userId, username);
        res.status(200).json(user);
    } catch (err) {
        res.status(err.status).json({ message: err.message });
    }
});

app.get("/users", async (req, res) => {
    try {
        const users = await QueueService.getUsers(req.cookies.get("passcode"), req.cookies.get("user", { signed: true }));
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

app.get("/playlist", (req, res) => {
    const user = req.cookies.get("user", { signed: true });
    const passcode = req.cookies.get("passcode");
    const playlistId = req.query.id;
    QueueService.getQueue(req.cookies.get("passcode")).then(queueDao => {
        SpotifyService.getPlaylistTracks(queueDao.data.accessToken!, queueDao.owner, playlistId, user, passcode).then(tracks => {
            res.status(200).json({ tracks });
        });
    }).catch(err => {
        res.status(err.status).json({ message: err.message });
    });
});

app.put("/queuePlaylist", (req, res) => {
    const user = req.cookies.get("user", { signed: true });
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
    const user = req.cookies.get("user", { signed: true });
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
    const user = req.cookies.get("user", { signed: true });
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

app.post("/search", (req, res) => {
    const passcode = req.cookies.get("passcode");
    const user = req.cookies.get("user", { signed: true });

    const query: SpotifySearchQuery = {
        q: req.body.q,
        type: req.body.type,
        market: "FI",
        limit: req.body.limit
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

    var opts= {
        maxResults: query.limit,
        key: secrets.youtube.key,
        type: "video",
        videoSyndicated: "true",
        videoEmbeddable: "true",
        videoCategoryId: "10"
      };
 
    await youtubeSearch(query.q, opts, async (err, results) => {
        if (err) {
            const passcode = req.cookies.get("passcode");
            const user = req.cookies.get("user", { signed: true });
            logger.error(`Unable to search from YouTube`, [passcode, user]);
            logger.error(err);
            throw { status: 500, message: "Error occurred while searching from YouTube. Please try again." };
        }

        if (!results) {
            return res.status(404).json([]);
        }
       
        const ids = results!.map(v => v.id);
        const videos = await YoutubeService.getTracks(ids.join(","));
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

app.get("*", (request: express.Request, response: express.Response) => response.status(404).send());

// Do not listen if app is already running.
// This happens when running tests on watch mode.
if (!module.parent) {
    server.listen(config.app.port);
}
logger.info(`Application running on port: ${config.app.port}`);
