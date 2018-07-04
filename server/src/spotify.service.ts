import axios from "axios";
import * as Querystring from "querystring";
import { getCurrentSeconds } from "./util";
import { SpotifySearchQuery, SpotifyTrack } from "./spotify";

class SpotifyService {
    private accessToken: string;
    private redirectUri: string;
    private authHeader:string;
    private deviceId:string;
    private refreshToken: string;
    private tokenExpires: number;
    private tokenAquired: number;
    private currentTrack: SpotifyTrack | null;

    constructor(clientId: string, secret: string, redirectUri: string) {
        this.redirectUri = redirectUri;
        this.authHeader = "Basic " + Buffer.from(clientId + ":" + secret).toString('base64');
    }

    public getCurrentTrack() {
        return this.currentTrack;
    }

    public clearCurrentTrack() {
        this.currentTrack = null;
    }

    public setCurrentTrack(data: any): SpotifyTrack {
        this.currentTrack = {
            name: data.item.name,
            artist: data.item.artists[0].name,
            duration: data.item.duration_ms,
            progress: data.progress_ms,
            cover: data.item.album.images[1].url,
            isPlaying: data.item.is_playing
        }

        return this.currentTrack;
    }

    public saveToken = (data: any) => {
        this.accessToken = data.access_token;
        this.tokenExpires = data.expires_in;

        if (data.refresh_token) {
            this.refreshToken = data.refresh_token;
        }

        this.tokenAquired = getCurrentSeconds();
    };

    public isAuthorized = () => {
        console.log((getCurrentSeconds() - this.tokenAquired));
        if (this.tokenAquired && getCurrentSeconds() - this.tokenAquired >= this.tokenExpires) {
            console.log("Getting refresh token...");
            this.refreshAccessToken()
                .then(response => {
                    this.saveToken(response);
                }).catch(err => {
                    console.log("Failed to refresh token...", err);
                });
            
            return true;
        }
    
        return this.accessToken != null;
    }

    public getDevices = () => {
        return axios.get("https://api.spotify.com/v1/me/player/devices", {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + this.accessToken
            }
        });
    }

    public getDevice = () => {
        return this.deviceId;
    }

    public setDevice = (deviceId:string) => {
        this.deviceId = deviceId;
    }
    
    public getTracks = (ids: string) => {
        return axios.get("https://api.spotify.com/v1/tracks?ids=" + ids, {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + this.accessToken
            }
        });
    }

    public currentlyPlaying = () => {
        return axios.get(
            "https://api.spotify.com/v1/me/player",
            {
                headers: {
                    "Authorization": "Bearer " + this.accessToken
                }
            }
        )
    }

    public startSong = (id: string) => {
        return axios.put(
            "https://api.spotify.com/v1/me/player/play?device_id=" + this.deviceId,
            {
                uris: [id]
            },
            {
                headers: {
                    "Content-Type": "text/plain",
                    "Authorization": "Bearer " + this.accessToken
                }
            }
        );
    }

    public search = (query: SpotifySearchQuery) => {
        return axios.get("https://api.spotify.com/v1/search?" + Querystring.stringify(query), {
            headers: {
                "Content-Type": "text/plain",
                "Authorization": "Bearer " + this.accessToken
            }
        });
    }

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

    private refreshAccessToken = () => {
        const data = {
            grant_type: "refresh_token",
            refresh_token: this.refreshToken
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