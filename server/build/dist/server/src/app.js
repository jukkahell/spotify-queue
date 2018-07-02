"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const http = require("http");
const axios_1 = require("axios");
const Querystring = require("querystring");
const bodyParser = require("body-parser");
const secrets_1 = require("../../secrets");
const client_id = secrets_1.default.spotify.client_id;
const secret = secrets_1.default.spotify.secret;
const redirect_uri = "http://localhost:8000/callback";
const authHeader = "Basic " + Buffer.from(client_id + ":" + secret).toString('base64');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = http.createServer(app);
const port = 8000;
let access_token = "BQDQM597e11HeIMdZGg1-kkPayLxGyP_Ef83jsFcnoufLwvQtLkOsrTr5XbHKIyxQwRjLsMS2nBex-v6rQbh19qUxCxmxGFDAEfzYmHb0VugHErssLUPfS78uak08agF52YX6IvLM-mClbm04_Ugmg";
app.get("/callback", (req, res) => {
    const data = {
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: redirect_uri
    };
    axios_1.default.post("https://accounts.spotify.com/api/token", Querystring.stringify(data), {
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
    res.status(200).json({ msg: "OK" });
});
app.post("/addSong", (req, res) => {
    const spotifyUri = req.body.id;
    axios_1.default.put("https://api.spotify.com/v1/me/player/play", {
        uris: [
            spotifyUri
        ]
    }, {
        headers: {
            "Content-Type": "text/plain",
            "Authorization": "Bearer " + access_token
        }
    });
    res.status(200).json({ msg: "OK" });
});
const getTrackInfo = () => {
    axios_1.default.get("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: {
            "Content-Type": "text/plain",
            "Authorization": "Bearer " + access_token
        }
    }).then(function (response) {
        console.log(response.data);
    }).catch(function (err) {
        console.log(err);
    });
};
getTrackInfo();
app.use((error, request, response, next) => {
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
app.get("*", (request, response) => response.status(404).send());
// Do not listen if app is already running.
// This happens when running tests on watch mode.
if (!module.parent) {
    server.listen(port);
}
console.log(`Application running on port: ${port}`);
exports.expressApp = app;
//# sourceMappingURL=app.js.map