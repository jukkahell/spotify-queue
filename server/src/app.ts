import bodyParser = require("body-parser");
import * as Cookies from "cookies";
import * as cors from "cors";
import * as express from "express";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as Keygrip from "keygrip";
import {env} from "process";
import * as randomstring from "randomstring";
import config from "./config";
import {CurrentTrack, Queue, QueueDao} from "./queue";
import QueueService from "./queue.service";
import secrets from "./secrets";
import {SpotifySearchQuery} from "./spotify";
import Spotify from "./spotify.service";
import {getCurrentSeconds} from "./util";

const keys = Array.from({length: 10}, () => randomstring.generate(15));
const keygrip = new Keygrip(keys, "sha256");

const excludeEndpointsFromAuth = ["/join", "/callback", "/isAuthorized"];
const endpointsRequireOwnerPerm = ["/device"];
const app = express();
app.use(cors(config.app.cors));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(Cookies.express(keygrip));
app.use((req, res, next) => {
    if (excludeEndpointsFromAuth.includes(req.path)) {
        return next();
    } else {
        isAuthorized(req.cookies.get("passcode"), req.cookies.get("user")).then(resp => {
            return next();
        }).catch(err => {
            return res.status(403).json({ msg: err });
        });
    }
});
app.use((req, res, next) => {
    if (endpointsRequireOwnerPerm.includes(req.path)) {
        queueService.isOwner(req.cookies.get("passcode"), req.cookies.get("user")).then(resp => {
            return next();
        }).catch(err => {
            return res.status(403).json({ msg: err });
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

const spotify = new Spotify(config.spotify.clientId, secrets.spotify.secret, config.spotify.redirectUri);
const queueService = new QueueService();

app.get("/callback", (req, res) => {
    let accessToken: string;
    let refreshToken: string;
    let expiresIn: number;

    spotify.getToken(req.query.code)
    // Token received
    .then((response: any) => {
        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token;
        expiresIn = response.data.expires_in;
        console.log(accessToken);
        return spotify.getUser(accessToken);
    })
    // User data received
    .then((response: any) => {
        const spotifyUserId = response.data.id;
        let passcode: string;
        let userId: string;

        const setCookies = (req: express.Request, res: express.Response, passcode: string, userId: string) => {
            req.cookies.set("user", userId, config.userCookieOptions);
            req.cookies.set("passcode", passcode, config.passcodeCookieOptions);
            res.status(200).send("<script>window.close();</script>");
        };

        // Check if this user already has a queue
        queueService.getQueueBySpotifyId(spotifyUserId)
        .then(result => {
            if (result.rowCount === 1) {
                const queue: QueueDao = result.rows[0];
                queue.data.refreshToken = refreshToken;
                queue.data.expiresIn = expiresIn;
                queue.data.accessTokenAcquired = getCurrentSeconds();
                passcode = queue.id;
                userId = (queue.data.users.find(user => user.spotifyUserId === spotifyUserId))!.id;
                console.log(`Found existing queue for user ${userId} and passcode ${passcode}`);
                queueService.activateQueue(queue.data, accessToken, passcode).then(() => {
                    setCookies(req, res, passcode, userId);
                });
            } else {
                queueService.generatePasscode().then(passcode => {
                    console.log(`Generated passcode ${passcode}`);
                    if (passcode) {
                        userId = randomstring.generate();
                        queueService.createQueue(spotifyUserId, accessToken, passcode, userId, refreshToken, expiresIn)
                        .then(() => {
                            setCookies(req, res, passcode, userId);
                        });
                    } else {
                        throw new Error("Unable to generate unique passcode. Please try again later");
                    }
                }).catch(err => {
                    console.log(err);
                    res.status(500).send(err.message);
                });
            }
        }).catch(err => {
            console.log(err);
            res.status(500).send("Unable to create queue. Please try again in a moment.");
        });
    }).catch((err: any) => {
        console.log(err);
        res.status(500).send("Failed to authenticate.");
    });
});

app.put("/join", (req, res) => {
    const passcode = req.body.code;
    queueService.getQueue(passcode, true)
    .then(result => {
        if (result.rowCount === 1) {
            let userId = req.cookies.get("user");
            if (!userId) {
                userId = randomstring.generate();
            }

            const queue: Queue = result.rows[0].data;
            const user = {
                id: userId,
                spotifyUserId: null,
                points: 0
            };

            if (!queue.users.find( user => user.id === userId)) {
                queue.users.push(user);
                queueService.updateQueue(queue, passcode)
                .then(() => {
                    req.cookies.set("passcode", passcode, config.passcodeCookieOptions);
                    req.cookies.set("user", userId, config.userCookieOptions);
                    res.status(200).json({msg: "OK", passcode});
                }).catch(err => {
                    console.log("Error when inserting user into queue", err);
                    res.status(500).json({msg: "Error while adding user into database. Please try again later."});
                });
            } else {
                req.cookies.set("passcode", passcode, config.passcodeCookieOptions);
                if (!req.cookies.get("user")) {
                    req.cookies.set("user", userId, config.userCookieOptions);
                }
                res.status(200).json({msg: "OK", passcode});
            }
        } else {
            res.status(404).json({msg: "Queue not found"});
        }
    }).catch(() => {
        res.status(500).json({msg: "Queue not found"});
    });
});

app.get("/isAuthorized", (req, res) => {
    if (!req.cookies.get("passcode")) {
        res.status(204).json({ msg: "No passcode" });
        return;
    }

    isAuthorized(req.cookies.get("passcode"), req.cookies.get("user")).then(authResult => {
        res.status(200).json(authResult);
    }).catch(err => {
        res.status(403).json({ isAuthorized: false, msg: err });
    })
});

app.get("/devices", (req, res) => {
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

            // If no device was active just pick the first
            if (!activeDeviceId && devices.length > 0) {
                activeDeviceId = devices[0].id;
                devices[0].isActive = true;
            } else if (!activeDeviceId && devices.length === 0) {
                res.status(404).json({ msg: "No available devices found. Please start Spotify and then refresh the page."});
                return;
            }

            res.status(200).json(devices);

            // If there was active device set it as device id for this queue
            if (activeDeviceId !== undefined) {
                const passcode = req.cookies.get("passcode");
                queueService.getQueue(passcode, true).then(resp => {
                    if (resp.rowCount === 1) {
                        const queue: Queue = resp.rows[0].data;
                        if (queue.deviceId !== activeDeviceId) {
                            queue.deviceId = activeDeviceId!;
                            queueService.updateQueue(queue, passcode).catch(err => {
                                console.log("Unable to set device id", err);
                            });
                        }
                    }
                }).catch(err => {
                    console.log(err);
                });
            }
        }).catch((err: any) => {
            console.log(err);
            res.status(500).json({error: "Error getting available devices"});
        });
    };

    queueService.getAccessToken(req.cookies.get("passcode"), callback, () => {
        res.status(500).json({error: "Error getting available devices"});
    });
});

app.put("/device", (req, res) => {
    console.log("Set device " + req.body.deviceId);
    if (req.body.deviceId) {
        queueService.setDevice(req.cookies.get("passcode"), req.body.deviceId)
        .then(resp => {
            spotify.setDevice(resp["accessToken"], resp["isPlaying"], req.body.deviceId).then(() => {
                res.status(200).json({msg: "OK"});
            }).catch(err => {
                console.log("Unable to update device to spotify.", err);
            });
        }).catch(err => {
            console.log(err);
            res.status(500).json({msg: err});
        });
    } else {
        res.status(400).json({msg: "Invalid device id"});
    }
});

app.get("/queue", (req, res) => {
    const id = req.cookies.get("passcode");
    queueService.getQueue(id).then(result => {
        if (result.rowCount === 0) {
            res.status(400).json({msg: "Invalid passcode"});
            return;
        }

        if (result.rows[0].data.queue.length === 0) {
            res.status(204).json({msg: "No messages in queue"});
            return;
        }

        res.status(200).json({
            queuedItems: result.rows[0].data.queue
        });
    }).catch((error: any) => {
        console.log(error);
        res.status(500).json({msg: "Error when getting track info for the queued songs"});
    });
});

app.get("/currentlyPlaying", (req, res) => {
    const passcode = req.cookies.get("passcode");
    console.log(`Fetching currently playing song for passcode ${passcode}...`);
    getCurrentTrack(passcode)
        .then((result) => {
            res.status(200).json(result);
        }).catch(() => {
            res.status(204).json({});
        });
});

app.post("/track", (req, res) => {
    const spotifyUri = req.body.spotifyUri;
    const passcode = req.cookies.get("passcode");
    const userId = req.cookies.get("user");

    queueService.addToQueue(userId, passcode, spotifyUri, spotify.getTrack)
    .then((queue: Queue) => {
        // If no song is playing
        if (!queue.isPlaying) {
            startPlaying(queue, passcode).then(() => {
                res.status(200).json({msg: "OK"});
            }).catch((err: any) => {
                console.log(err);
                res.status(400).json({msg: err});
            });
        } else {
            res.status(200).json({msg: "OK"});
        }
    }).catch(err => {
        console.log(err);
        res.status(500).json({msg: err});
    });
});

app.get("/selectAlbum", (req, res) => {
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
            console.log(error);
            res.status(500).json({msg: "Unable to get requested album"});
        });
    };

    queueService.getAccessToken(req.cookies.get("passcode"), callback, () => {
        res.status(500).json({error: "Error getting available devices"});
    });
});

app.get("/selectArtist", (req, res) => {
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
                    console.log(error);
                    res.status(500).json({msg: "Unable to get requested artist's albums"});
                });
        }).catch((error: any) => {
            console.log(error);
            res.status(500).json({msg: "Unable to get requested artist's top tracks"});
        });
    };

    queueService.getAccessToken(req.cookies.get("passcode"), callback, () => {
        res.status(500).json({error: "Error getting available devices"});
    });
});

app.get("/search", (req, res) => {
    const passcode = req.cookies.get("passcode");

    const query: SpotifySearchQuery = {
        q: req.query.q,
        type: req.query.type,
        market: "FI",
        limit: req.query.limit
    };

    const callback = (accessToken: string) => {
        spotify.search(accessToken, query).then((response: any) => {
            res.status(200).json({
                tracks: response.data.tracks.items.map((i: any) => {
                    return {
                        artist: i.artists[0].name,
                        name: i.name,
                        id: i.uri
                    };
                }),
                albums: response.data.albums.items.map((album: any) => {
                return {
                    artist: album.artists[0].name,
                    name: album.name,
                    id: album.id
                };
                }),
                artists: response.data.artists.items.map((artist: any) => {
                    return {
                        name: artist.name,
                        id: artist.id
                    };
                })
            });
        }).catch((error: any) => {
            console.log(error);
            res.status(500).json({msg: "Error when searching for a song"});
        });
    };

    queueService.getAccessToken(passcode, callback, (err) => {
        console.log(err);
        res.status(500).json({msg: "Error when searching for a song"});
    });
});

const isAuthorized = (passcode: string, userId: string) => {
    return new Promise((resolve, reject) => {
        queueService.getQueue(passcode)
        .then(response => {
            if (response.rowCount === 1) {
                const queue: Queue = response.rows[0].data;
                spotify.isAuthorized(queue.accessTokenAcquired, queue.expiresIn, queue.refreshToken).then((response: any) => {
                    if (response) {
                        queue.accessToken = response.access_token;
                        queue.expiresIn = response.expires_in;
                        queue.accessTokenAcquired = getCurrentSeconds();
                        if (response.refresh_token) {
                            queue.refreshToken = response.refresh_token;
                        }
                        queueService.updateQueue(queue, passcode).catch(err => {
                            console.log("Failed to update queue refresh token.", err);
                        });
                    }
                    const isOwner = queue.owner === userId;
                    resolve({ isAuthorized: true, passcode, isOwner });
                }).catch(err => {
                    reject(err);
                });
            } else {
                reject("Unable to find queues with given passcode");
            }
        }).catch(err => {
            console.log(err);
            reject("Unable to get queue with given passcode");
        });
    });
}

const getCurrentTrack = (passcode: string) => {
    return new Promise((resolve, reject) => {
        const onSuccess = (accessToken: string, currentTrack: CurrentTrack, isPlaying: boolean) => {
            if (currentTrack) {
                spotify.currentlyPlaying(accessToken).then(response => {
                    currentTrack.track.progress = response.data.progress_ms;

                    // If is playing info is out of sync with Spotify
                    if (isPlaying !== response.data.is_playing) {
                        isPlaying = response.data.is_playing;
                        queueService.getQueue(passcode, true).then(result => {
                            if (result.rowCount === 1) {
                                const queue: Queue = result.rows[0].data;
                                queue.isPlaying = isPlaying;
                                queueService.updateQueue(queue, passcode).catch(err => {
                                    console.log("Failed to update isPlaying state.", err);
                                });
                            }
                        }).catch(err => {
                            console.log("Failed to get queue when saving playing state", err);
                        });
                    }

                    return resolve({currentTrack, isPlaying});
                }).catch(() => {
                    console.log("Unable to get track progress from Spotify...resolve anyway.");
                    return resolve({currentTrack, isPlaying});
                });
            } else {
                return reject();
            }
        };

        const onError = () => {
            // Wait a bit so that spotify catches up
            setTimeout(() => {
                queueService.getCurrentTrack(passcode, onSuccess, () => {
                    return reject();
                });
            }, 4000);
        };

        queueService.getCurrentTrack(passcode, onSuccess, onError);
    });
};

const startPlaying = (queue: Queue, passcode: string) => {
    return new Promise((resolve, reject) => {
        // TODO: Check if accesstoken still valid

        const deviceId = queue.deviceId;
        if (!deviceId) {
            return reject("No device selected");
        }

        console.log(`Starting playing queue for ${passcode}...`);
        const accessToken = queue.accessToken!;
        const queuedItem = queue.queue.shift()!;
        queue.currentTrack = {
            track: queuedItem.track,
            owner: queuedItem.userId,
            votes: []
        };
        queue.isPlaying = true;

        queueService.updateQueue(queue, passcode).then(() => {
            queueService.startPlaying(accessToken, passcode, queuedItem.track, spotify, startNextTrack);

            spotify.startSong(accessToken, queuedItem.track.id, deviceId!).then(() => {
                console.log("Song started.");
                return resolve();
            }).catch((err: any) => {
                console.log(err.response.data);
                return reject("Unable to start playing");
            });
        }).catch(() => {
            return reject("Unable to update queue.");
        });
    });
};

const startNextTrack = (passcode: string, accessToken: string) => {
    queueService.getQueue(passcode, true).then(result => {
        if (result.rowCount === 0 || result.rows[0].data.queue.length === 0) {
            console.log("No more songs in queue. Stop playing.");
            queueService.stopPlaying(result.rows[0].data, accessToken, passcode);
            return;
        }
        const queue: Queue = result.rows[0].data;
        const queuedItem = queue.queue.shift()!;
        queue.currentTrack = {
            track: queuedItem.track,
            owner: queuedItem.userId,
            votes: []
        };

        queueService.updateQueue(queue, passcode).then(() => {
            queueService.startPlaying(accessToken, passcode, queuedItem.track, spotify, startNextTrack);

            spotify.startSong(accessToken, queuedItem.track.id, queue.deviceId!).then(() => {
                console.log("Song started.");
            }).catch((err: any) => {
                console.log(err.response.data);
            });
        }).catch(err => {
            console.log("Unable to update queue", err);
        });
    }).catch(err => {
        console.log("Unable to get queue when starting next track", err);
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
console.log(`Application running on port: ${config.app.port}`);
