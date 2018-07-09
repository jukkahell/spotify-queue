import axios from "axios";
import * as Querystring from "querystring";
import { getCurrentSeconds } from "./util";
import { SpotifySearchQuery } from "./spotify";

class SpotifyService {
    private readonly redirectUri: string;
    private readonly authHeader:string;

    constructor(clientId: string, secret: string, redirectUri: string) {
        this.redirectUri = redirectUri;
        this.authHeader = "Basic " + Buffer.from(clientId + ":" + secret).toString('base64');
    }

    public getUser = (accessToken: string) => {
        return axios.get("https://api.spotify.com/v1/me", {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    };

    public isAuthorized = (tokenAcquired: number, expiresIn: number, refreshToken: string) => {
        return new Promise((resolve, reject) => {
            if (getCurrentSeconds() - tokenAcquired >= expiresIn) {
                console.log("Getting refresh token...");
                this.refreshAccessToken(refreshToken)
                    .then(response => {
                        return resolve(response.data);
                    }).catch(err => {
                        console.log("Failed to refresh token...", err);
                        return reject("Unable to refresh expired access token");
                    });
            } else {
                return resolve(undefined);
            }
        });  
    };

    public getDevices = (accessToken: string) => {
        return axios.get("https://api.spotify.com/v1/me/player/devices", {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    };
    
    public getTrack = (accessToken: string, id: string) => {
        return axios.get("https://api.spotify.com/v1/tracks/" + id, {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    };

    public currentlyPlaying = (accessToken: string) => {
        return axios.get(
            "https://api.spotify.com/v1/me/player",
            {
                headers: {
                    "Authorization": "Bearer " + accessToken
                }
            }
        )
    };

    public startSong = (accessToken: string, id: string, deviceId: string) => {
        return axios.put(
            "https://api.spotify.com/v1/me/player/play?device_id=" + deviceId,
            {
                uris: [id]
            },
            {
                headers: {
                    "Content-Type": "text/plain",
                    "Authorization": "Bearer " + accessToken
                }
            }
        );
    };

    public getArtistTopTracks = (accessToken: string, id: string) => {
        return axios.get("https://api.spotify.com/v1/artists/" + id + "/top-tracks?country=FI", {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    };

    public getArtistAlbums = (accessToken: string, id: string) => {
        return axios.get("https://api.spotify.com/v1/artists/" + id + "/albums", {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    };

    public getAlbum = (accessToken: string, id: string) => {
        return axios.get("https://api.spotify.com/v1/albums/" + id, {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    };

    public search = (accessToken: string, query: SpotifySearchQuery) => {
        return axios.get("https://api.spotify.com/v1/search?" + Querystring.stringify(query), {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    };

    public getToken = (code: string) => {
        const data = {
            grant_type: "authorization_code",
            code: code,
            redirect_uri: this.redirectUri
        };
    
        return axios.post("https://accounts.spotify.com/api/token", Querystring.stringify(data), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": this.authHeader
            }
        });
    };

    private refreshAccessToken = (refreshToken: string) => {
        const data = {
            grant_type: "refresh_token",
            refresh_token: refreshToken
        };
    
        return axios.post("https://accounts.spotify.com/api/token", Querystring.stringify(data), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": this.authHeader
            }
        });
    };
}

export default SpotifyService;