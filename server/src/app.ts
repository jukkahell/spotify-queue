import * as express from "express";
import * as http from "http";
import axios from "axios";
import * as Querystring from "querystring";
import bodyParser = require("body-parser");
import * as cors from "cors";
import secrets from "./secrets";
import { getCurrentSeconds } from "./util";
import { SpotifyTrack } from "./spotify-track";

const client_id = "da6ea27d63384e858d12bcce0fac006d";
const secret = secrets.spotify.secret;
const redirect_uri = "http://spotique.fi:8000/callback";
const authHeader = "Basic " + Buffer.from(client_id + ":" + secret).toString('base64');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = http.createServer(app);
const port = 8000;

let access_token: string;
let refresh_token: string;
let token_expires: number;
let token_aquired: number;

let currentTrack: SpotifyTrack | null;
let isPlaying = false;
let progressInterval: NodeJS.Timer;
let queue: Array<string> = [];
let queueTimeout: any;

app.get("/callback", (req, res) => {
    getToken(req.query.code)
        .then(response => {
            console.log(response.data.access_token);
            saveToken(response.data);
            res.status(200).send("<script>window.close();</script>");
        }).catch(err => {
            res.status(500).json({msg: "Failed to authenticate."});
        }
    );
});

app.get("/isAuthorized", (req, res) => {
    res.status(200).json({isAuthorized: isAuthorized()});
});

app.get("/queue", (req, res) => {
    if (queue.length == 0) {
        res.status(200).json({tracks:[]});
    } else {
        const spotifyIds = queue.map(uri => uri.split(':')[2]).join(',');
        console.log("Search track data for ids: " + spotifyIds);
        axios.get("https://api.spotify.com/v1/tracks?ids=" + spotifyIds, {
        headers: {
            "Content-Type": "text/plain",
            "Authorization": "Bearer " + access_token
        }
    }).then(response => {
        res.status(200).json({
            tracks: response.data.tracks.map((i: any) => {
                return {
                    artist: i.artists[0].name,
                    name: i.name,
                    id: i.uri
                };
            })
        });
    }).catch(error => {
        console.log(error);
        res.status(500).json({msg: "Unable to get track data for queued ids"});
    });
    }
});

app.get("/currentlyPlaying", (req, res) => {
    if (!currentTrack) {
        res.status(204).json({});
        return;
    }

    return res.status(200).json(currentTrack);
});

app.get("/addSong", (req, res) => {
    const spotifyUri = req.query.id;
    console.log(spotifyUri + " added to queue");
    queue.push(spotifyUri);res.status(200).json({msg: "OK"});

    // If no song is playing
    if (!isPlaying) {
        startNextSong();
    }
});

app.get("/search", (req, res) => {
    const query = {
        q: req.query.q,
        type: "track",
        market: "FI",
        limit: 50
    };

    axios.get("https://api.spotify.com/v1/search?" + Querystring.stringify(query), {
        headers: {
            "Content-Type": "text/plain",
            "Authorization": "Bearer " + access_token
        }
    }).then(response => {
        res.status(200).json({
            tracks: response.data.tracks.items.map((i: any) => {
                return {
                    artist: i.artists[0].name,
                    name: i.name,
                    id: i.uri
                };
            })
        });
    }).catch(error => {
        res.status(500).send(error);
    });
});

const getToken = (code: string) => {
    const data = {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri
    };

    return axios.post("https://accounts.spotify.com/api/token", Querystring.stringify(data), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": authHeader
        }
    });
};

const saveToken = (data: any) => {
    access_token = data.access_token;
    refresh_token = data.refresh_token;
    token_expires = data.expires_in;

    token_aquired = getCurrentSeconds();
};

const isAuthorized = () => {
    if (token_aquired && getCurrentSeconds() - token_aquired >= token_expires) {
        getToken(refresh_token)
            .then(response => {
                saveToken(response);
            }).catch(err => {
                console.log("Failed to refresh token...", err);
            });
        
        return true;
    }

    return access_token != null;
};

const startNextSong = () => {
    const id = queue.pop();
    isPlaying = true;
    axios.put(
        "https://api.spotify.com/v1/me/player/play",
        {
            uris: [id]
        },
        {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + access_token
            }
        }
    ).then(function(res) {
        getTrackInfo();
    }).catch(err => {
        console.log(err);
    });
};

const getTrackInfo = () => {
    clearTimeout(queueTimeout);
    clearInterval(progressInterval);
    if (!access_token) {
        return;
    }

    console.log("Getting track info...");

    axios.get(
        "https://api.spotify.com/v1/me/player/currently-playing",
        {
            headers: {
                "Authorization": "Bearer " + access_token
            }
        }
    ).then(response => {
        // If no tracks playing
        if (response.status == 204) {
            isPlaying = false;
            currentTrack = null;
            return;
        }

        currentTrack = {
            name: response.data.item.name,
            artist: response.data.item.artists[0].name,
            duration: response.data.item.duration_ms,
            progress: response.data.progress_ms,
            cover: response.data.item.album.images[1].url
        }

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
            if (queue.length > 0) {
                console.log("Less than 5 secs left...initiating timer to start the next song...");
                // Start new song after timeLeft and check for that song's duration
                setTimeout(startNextSong, timeLeft - 500);
            } else {
                isPlaying = false;
                currentTrack = null;
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
