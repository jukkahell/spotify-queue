import * as express from "express";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import bodyParser = require("body-parser");
import * as cors from "cors";
import secrets from "./secrets";
import Spotify from "./spotify.service";
import { SpotifySearchQuery, SpotifyTrack } from "./spotify";
import Queue from "./queue";
import { env } from "process";

const clientId = "da6ea27d63384e858d12bcce0fac006d";
const redirectUri = "http://spotique.fi:8000/callback"
const secret = secrets.spotify.secret;

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/spotiqu.eu/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/spotiqu.eu/fullchain.pem')
};

const server = env.NODE_ENV === "production" ? https.createServer(options, app) : http.createServer(app);
const port = 8001;

let isPlaying = false;
let progressInterval: NodeJS.Timer;
let queueTimeout: any;
let spotify = new Spotify(clientId, secret, redirectUri);
let queue = new Queue();

app.get("/callback", (req, res) => {
    spotify.getToken(req.query.code)
        .then((response: any) => {
            console.log(response.data.access_token);
            spotify.saveToken(response.data);
            res.status(200).send("<script>window.close();</script>");
        }).catch((err: any) => {
            console.log(err);
            res.status(500).json({msg: "Failed to authenticate."});
        }
    );
});

app.get("/isAuthorized", (req, res) => {
    res.status(200).json({isAuthorized: spotify.isAuthorized(() => {})});
});

app.get("/getDevices", (req, res) => {
    spotify.getDevices()
        .then((response: any) => {
            res.status(200).json(response.data.devices.map((device: any) => {
                return {
                    id: device.id,
                    name: device.name,
                    type: device.type
                }
            }));
        }).catch((err :any) => {
            console.log(err);
            res.status(500).json({error: "Error getting available devices"});
        });
});

app.post("/setDevice", (req, res) => {
    console.log("Set device " + req.body.deviceId);
    spotify.setDevice(req.body.deviceId);
    res.status(200).json({msg: "OK"});
});

app.get("/selectedDevice", (req, res) => {
    res.status(200).json({deviceId: spotify.getDevice()});
});

app.get("/queue", (req, res) => {
    if (!queue.hasItems()) {
        res.status(200).json({tracks:[]});
    } else {
        const spotifyIds = queue.getUniqueIds();
        console.log("Search track data for ids: " + spotifyIds);
        spotify.getTracks(spotifyIds).then((response: any) => {
            // Get track info for every id
            const tracks = queue.getQueue().map((id: string) => {
                return response.data.tracks.find((track: any) => track.uri === id);
            });
            res.status(200).json({
                tracks: tracks.map((i: any) => {
                    return {
                        artist: i.artists[0].name,
                        name: i.name,
                        id: i.uri
                    };
                })
            });
        }).catch((error: any) => {
            console.log(error);
            res.status(500).json({msg: "Error when getting track info for the queued songs"});
        });
    }
});

app.get("/currentlyPlaying", (req, res) => {
    console.log("Fetching currently playing song...");
    getCurrentTrack()
        .then((track: SpotifyTrack) => {
            track.isPlaying = isPlaying;
            res.status(200).json(track);
        }).catch(() => {
            res.status(204).json({});
        });
});

app.get("/addSong", (req, res) => {
    const spotifyUri = req.query.id;
    console.log(spotifyUri + " added to queue");
    queue.push(spotifyUri);
    res.status(200).json({msg: "OK"});

    // If no song is playing
    if (!isPlaying) {
        startNextSong();
    }
});

app.get("/selectAlbum", (req, res) => {
    spotify.getAlbum(req.query.id)
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
});

app.get("/selectArtist", (req, res) => {
    spotify.getArtistTopTracks(req.query.id)
        .then((topTracks: any) => {

            spotify.getArtistAlbums(req.query.id)
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
                            } 
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
});

app.get("/search", (req, res) => {
    const query: SpotifySearchQuery = {
        q: req.query.q,
        type: req.query.type,
        market: "FI",
        limit: req.query.limit
    };

    spotify.search(query).then((response: any) => {
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
               } 
            }),
            artists: response.data.artists.items.map((artist: any) => {
                return {
                    name: artist.name,
                    id: artist.id
                } 
             })
        });
    }).catch((error: any) => {
        console.log(error);
        res.status(500).json({msg: "Error when searching for a song"});
    });
});

const getCurrentTrack = () => {
    return new Promise((resolve, reject) => {
        let currentTrack = spotify.getCurrentTrack();
        if (currentTrack) return resolve(currentTrack);

        // Wait a bit so that spotify catches up
        setTimeout(() => {
            let currentTrack = spotify.getCurrentTrack();
            console.log("Got current track: ", currentTrack);
            if (!currentTrack) {
                return reject(null);
            } else {
                return resolve(currentTrack);
            }
        }, 4000);
    });
}

const startNextSong = () => {
    if (!queue.hasItems()) return;

    console.log("Starting next song...");
    const id = queue.shift();
    isPlaying = true;
    spotify.startSong(id!).then((res: any) => {
        console.log("Song started.");
        // We need to wait a bit before we get the actual track info
        setTimeout(getTrackInfo, 2000);
    }).catch((err: any) => {
        // If device not selected
        if (err.status == 404) {
            throw new Error()
        }
        console.log(err);
    });
};

const getTrackInfo = () => {
    clearTimeout(queueTimeout);
    clearInterval(progressInterval);
    if (!spotify.isAuthorized(getTrackInfo)) {
        return;
    }

    console.log("Getting track info...");

    spotify.currentlyPlaying().then(response => {
        // If no tracks playing
        if (response.status == 204) {
            isPlaying = false;
            spotify.clearCurrentTrack();
            return;
        }

        console.log("Current track name: " + response.data.item.name);
        const currentTrack = spotify.setCurrentTrack(response.data);

        progressInterval = setInterval(() => {
            if (currentTrack) {
                currentTrack.progress += 1000;
            } else {
                clearInterval(progressInterval);
            }
        }, 1000);

        const timeLeft = currentTrack.duration-currentTrack.progress;

        // If song is almost over
        if (timeLeft < 5000) {
            // If there's still songs in the queue
            if (queue.hasItems()) {
                console.log("Less than 5 secs left...initiating timer to start the next song...");
                // Start new song after timeLeft and check for that song's duration
                setTimeout(startNextSong, timeLeft - 500);
            } else {
                isPlaying = false;
                spotify.clearCurrentTrack();
                console.log("No songs in the queue. Not going to start new timeouts...");
            }
        }
        // If there's still time, check for progress again after a while
        else {
            console.log("Song still playing for " + (timeLeft/1000) + " secs. Starting new timeout after that.");
            queueTimeout = setTimeout(getTrackInfo, timeLeft-1000);
        }

    }).catch(function(err) {
        console.log(err);
    });
};

// Initiate infinite loop to check for track info and start new songs from the queue.
queueTimeout = setTimeout(getTrackInfo, 1000);

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
    server.listen(port);
}
console.log(`Application running on port: ${port}`);

export let expressApp = app;
