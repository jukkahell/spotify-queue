import axios from "axios";
import * as Querystring from "querystring";
import { getCurrentSeconds } from "./util";
import { SpotifySearchQuery } from "./spotify";
import * as winston from "winston";

export interface SearchTrack {
    id: string;
    name: string;
    artist: string;
}
export interface SearchAlbum {
    id: string;
    name: string;
    artist: string;
}
export interface SearchArtist {
    id: string;
    name: string;
}
export class SearchResults {
    public tracks: SearchTrack[];
    public albums: SearchAlbum[];
    public artists: SearchArtist[];
}

class SpotifyService {
    private readonly redirectUri: string;
    private readonly authHeader:string;
    private logger: winston.Logger;

    constructor(logger: winston.Logger, clientId: string, secret: string, redirectUri: string) {
        this.logger = logger;
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
    }

    public isAuthorized = (passcode: string, user: string, tokenAcquired: number, expiresIn: number, refreshToken: string) => {
        return new Promise((resolve, reject) => {
            if (getCurrentSeconds() - tokenAcquired >= expiresIn) {
                this.logger.info("Getting refresh token...", { user, passcode });
                this.refreshAccessToken(refreshToken)
                .then(response => {
                    return resolve(response.data);
                }).catch(err => {
                    this.logger.error("Failed to refresh token...", { user, passcode });
                    this.logger.error(err.response.data, { user, passcode });
                    return reject({ status: 500, message: "Unable to refresh expired access token" });
                });
            } else {
                return resolve(undefined);
            }
        });
    }

    public getDevices = (accessToken: string) => {
        return axios.get("https://api.spotify.com/v1/me/player/devices", {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    }

    public getTrack = (accessToken: string, id: string) => {
        return axios.get("https://api.spotify.com/v1/tracks/" + id, {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    }

    public currentlyPlaying = (accessToken: string) => {
        return axios.get(
            "https://api.spotify.com/v1/me/player",
            {
                headers: {
                    "Authorization": "Bearer " + accessToken
                }
            }
        );
    }

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
    }

    public setDevice = (accessToken: string, isPlaying: boolean, deviceId: string) => {
        return axios.put(
            "https://api.spotify.com/v1/me/player/",
            {
                device_ids: [deviceId],
                play: isPlaying
            },
            {
                headers: {
                    "Content-Type": "text/plain",
                    "Authorization": "Bearer " + accessToken
                }
            }
        );
    }

    public getArtistTopTracks = (accessToken: string, id: string) => {
        return axios.get("https://api.spotify.com/v1/artists/" + id + "/top-tracks?country=FI", {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    }

    public getArtistAlbums = (accessToken: string, id: string) => {
        return axios.get("https://api.spotify.com/v1/artists/" + id + "/albums", {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + accessToken
            }
        });
    }

    public getAlbum = (accessToken: string, id: string, user: string, passcode: string) => {
        return new Promise((resolve, reject) => {
            axios.get("https://api.spotify.com/v1/albums/" + id, {
                headers: {
                    "Content-Type": "text/plain",
                    "Authorization": "Bearer " + accessToken
                }
            }).then(response => {
                const albums = response.data.tracks.items.map((i: any) => {
                    return {
                        artist: i.artists[0].name,
                        name: i.name,
                        id: i.uri
                    };
                });
                resolve(albums);
            }).catch(err => {
                if (err.response) {
                    this.logger.error(`Unable to fetch albums from Spotify with id ${id}`, { user, passcode });
                } else {
                    this.logger.error(err);
                }
                reject({ status: 500, message: "Unable to fetch albums from Spotify. Please try again later." });
            });
        });
    }

    public search = (user: string, passcode: string, accessToken: string, query: SpotifySearchQuery) => {
        return new Promise((resolve, reject) => {
            axios.get("https://api.spotify.com/v1/search?" + Querystring.stringify(query), {
                headers: {
                    "Content-Type": "text/plain",
                    "Authorization": "Bearer " + accessToken
                }
            }).then(response => {
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
                resolve(results);
            }).catch(err => {
                if (err.response) {
                    this.logger.error(`Error with search query ${query.q}`, { user, passcode });
                    this.logger.error(err.response.data.error.message, { user, passcode });
                } else {
                    this.logger.error(err, { user, passcode });
                }
                reject({ status: err.response.status, message: "Unable to get search results from Spotify."})
            });
        });
    }

    public getToken = (code: string, callback: string) => {
        const data = {
            grant_type: "authorization_code",
            code,
            redirect_uri: this.redirectUri + callback
        };
        return axios.post("https://accounts.spotify.com/api/token", Querystring.stringify(data), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": this.authHeader
            }
        });
    }

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
    }
}

export default SpotifyService;
