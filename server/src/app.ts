import * as express from "express";
import * as http from "http";
import axios from "axios";
import * as Querystring from "querystring";
import bodyParser = require("body-parser");
import * as cors from "cors";
import secrets from "./secrets";

const client_id = "da6ea27d63384e858d12bcce0fac006d";
const secret = secrets.spotify.secret;
const redirect_uri = "http://localhost:8000/callback";
const authHeader = "Basic " + Buffer.from(client_id + ":" + secret).toString('base64');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = http.createServer(app);
const port = 8000;

let access_token: string;

let isPlaying = false;
let queue: Array<string> = [];
let queueTimeout: any;

app.get("/callback", (req, res) => {
    const data = {
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: redirect_uri
    };

    axios.post("https://accounts.spotify.com/api/token", Querystring.stringify(data), {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": authHeader
        }
    }).then(function (response) {
        console.log(response.data.access_token);
        access_token = response.data.access_token;
    }).catch(function (error) {
        console.log(error);
    });

    res.status(200).json({msg: "OK"});
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
        type: "artist,track",
        market: "FI"
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
        res.status(500).json(error);
    });
});

const startNextSong = () => {
    const id = queue.pop();
    isPlaying = true;
    axios.put(
        "https://api.spotify.com/v1/me/player/play",
        {
            uris: [
                id
            ]
        },
        {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + access_token
            }
        }
    ).then(function(res) {
        getTrackInfo();
    });
};

const getTrackInfo = () => {
    clearTimeout(queueTimeout);
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
    ).then(function(response) {
        // If no tracks playing
        if (response.status == 204) {
            isPlaying = false;
            return;
        }

        const duration = response.data.item.duration_ms;
        const progress = response.data.progress_ms;
        const timeLeft = duration-progress;

        // If song is almost over
        if (timeLeft < 5000) {
            // If there's still songs in the queue
            if (queue.length > 0) {
                console.log("Less than 5 secs left...initiating timer to start the next song...");
                // Start new song after timeLeft and check for that song's duration
                setTimeout(startNextSong, timeLeft - 500);
            } else {
                isPlaying = false;
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
