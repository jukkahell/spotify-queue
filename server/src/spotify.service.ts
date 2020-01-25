import axios from "axios";
import * as Querystring from "querystring";
import config from "./config";
import { logger } from "./logger.service";
import secrets from "./secrets";
import {
  SpotifyCurrentTrack,
  SpotifySearchQuery,
  SpotifyTrack
} from "./spotify";
import { getCurrentSeconds } from "./util";

export interface ISearchAlbum {
  id: string;
  name: string;
  artist: string;
}
export interface ISearchArtist {
  id: string;
  name: string;
}
export interface ISearchResults {
  tracks: SpotifyTrack[];
  albums: ISearchAlbum[];
  artists: ISearchArtist[];
}

const currentlyRefreshing: any = {};

class SpotifyService {
  private static readonly redirectUri = config.spotify.redirectUri;
  private static readonly clientId = config.spotify.clientId;
  private static readonly secret = secrets.spotify.secret;
  private static readonly authHeader =
    "Basic " +
    Buffer.from(SpotifyService.clientId + ":" + SpotifyService.secret).toString(
      "base64"
    );
  public static readonly favoritesName = "My Musifer favorites";

  public static getUser = (accessToken: string) => {
    return axios.get("https://api.spotify.com/v1/me", {
      headers: {
        "Content-Type": "text/plain",
        Authorization: "Bearer " + accessToken
      }
    });
  };

  public static isAuthorized = async (
    passcode: string,
    user: string,
    tokenAcquired: number,
    expiresIn: number,
    refreshToken: string
  ) => {
    try {
      // Refresh it 300 seconds before it goes old to prevent expirations
      if (
        getCurrentSeconds() + 300 - tokenAcquired >= expiresIn &&
        !currentlyRefreshing[passcode]
      ) {
        currentlyRefreshing[passcode] = 1;
        logger.info("Getting refresh token...", { user, passcode });
        const response: any = await SpotifyService.refreshAccessToken(
          refreshToken
        );
        setTimeout(() => delete currentlyRefreshing[passcode], 1000);
        return response.data;
      } else {
        return undefined;
      }
    } catch (err) {
      delete currentlyRefreshing[passcode];
      if (err.response) {
        err = err.response.data.error.message;
      }
      logger.error("Failed to refresh token...", { user, passcode });
      logger.error(err.response.data, { user, passcode });
      throw {
        status: 500,
        message: "Unable to get refresh token from Spotify"
      };
    }
  };

  public static getDevices = (accessToken: string) => {
    return axios.get("https://api.spotify.com/v1/me/player/devices", {
      headers: {
        "Content-Type": "text/plain",
        Authorization: "Bearer " + accessToken
      }
    });
  };

  public static getTrack = (accessToken: string, trackUri: string) => {
    const trackId = trackUri.split(":")[2];

    return axios
      .get("https://api.spotify.com/v1/tracks/" + trackId, {
        headers: {
          "Content-Type": "text/plain",
          Authorization: "Bearer " + accessToken
        }
      })
      .then(trackResponse => {
        const track: SpotifyTrack = {
          artist: trackResponse.data.artists[0].name,
          id: trackUri,
          artistId: trackResponse.data.artists[0].id,
          duration: trackResponse.data.duration_ms,
          cover: trackResponse.data.album.images[1].url,
          name: trackResponse.data.name,
          progress: 0,
          isFavorite: false,
          source: "spotify"
        };
        return track;
      })
      .catch(err => {
        throw {
          status: 500,
          message: "Unable to get requested track from Spotify"
        };
      });
  };

  public static currentlyPlaying = (
    accessToken: string,
    user: string,
    passcode: string
  ) => {
    return new Promise<SpotifyCurrentTrack>((resolve, reject) => {
      axios
        .get("https://api.spotify.com/v1/me/player", {
          headers: {
            Authorization: "Bearer " + accessToken
          }
        })
        .then(response => {
          if (response.data) {
            let item = null;
            if (response.data.item) {
              item = {
                artist: response.data.item.artists[0].name,
                cover: response.data.item.album.images[1].url,
                duration: response.data.item.duration_ms,
                id: response.data.item.uri,
                artistId: response.data.item.artists[0].id,
                name: response.data.item.name,
                progress: response.data.progress_ms,
                isFavorite: false,
                source: "spotify"
              };
            }
            const track: SpotifyCurrentTrack = {
              device: response.data.device,
              is_playing: response.data.is_playing,
              progress_ms: response.data.progress_ms,
              item
            };
            resolve(track);
          } else {
            logger.warn("No song playing currently", { user, passcode });
            reject({ status: 404, message: "No song playing currently." });
          }
        })
        .catch(err => {
          if (err.response) {
            logger.error(`Error when getting currently playing song`, {
              user,
              passcode
            });
            logger.error(err.response.data.error.message, { user, passcode });
          } else {
            logger.error(err, { user, passcode });
          }
          reject({
            status: 500,
            message: "Unable to get currently playing song from Spotify."
          });
        });
    });
  };

  public static getPlaylists = (
    accessToken: string,
    user: string,
    passcode: string
  ) => {
    return axios
      .get("https://api.spotify.com/v1/me/playlists?limit=50", {
        headers: {
          "Content-Type": "text/plain",
          Authorization: "Bearer " + accessToken
        }
      })
      .then(response => {
        return response.data.items.map((i: any) => {
          return {
            id: i.id,
            name: i.name
          };
        });
      })
      .catch(err => {
        if (err.response) {
          logger.error(`Error when getting playlists`, { user, passcode });
          logger.error(err.response.data.error.message, { user, passcode });
        } else {
          logger.error(err, { user, passcode });
        }
        throw { status: 500, message: "Unable to get playlists from Spotify." };
      });
  };

  public static getPlaylistTracks = (
    accessToken: string,
    spotifyUserId: string,
    id: string,
    user: string,
    passcode: string
  ) => {
    return new Promise<SpotifyTrack[]>((resolve, reject) => {
      axios
        .get(
          "https://api.spotify.com/v1/users/" +
            spotifyUserId +
            "/playlists/" +
            id +
            "/tracks",
          {
            headers: {
              "Content-Type": "text/plain",
              Authorization: "Bearer " + accessToken
            }
          }
        )
        .then(response => {
          const tracks: SpotifyTrack[] = response.data.items.map((i: any) => {
            return {
              artist: i.track.artists[0].name,
              artistId: i.track.artists[0].id,
              name: i.track.name,
              id: i.track.uri,
              duration: i.track.duration_ms,
              progress: 0,
              source: "spotify",
              cover: i.track.album.images[1].url,
              isFavorite: false
            };
          });
          resolve(tracks);
        })
        .catch(err => {
          if (err.response) {
            logger.error(`Unable to fetch albums from Spotify with id ${id}`, {
              user,
              passcode
            });
          } else {
            logger.error(err);
          }
          reject({
            status: 500,
            message:
              "Unable to fetch albums from Spotify. Please try again later."
          });
        });
    });
  };

  public static createFavoritesPlaylist = (
    accessToken: string,
    spotifyUserId: string
  ) => {
    return axios.post(
      `https://api.spotify.com/v1/users/${spotifyUserId}/playlists`,
      {
        name: SpotifyService.favoritesName,
        public: false,
        description: "Songs marked as favorite in Musifer app"
      },
      {
        headers: {
          "Content-Type": "text/plain",
          Authorization: "Bearer " + accessToken
        }
      }
    );
  };

  public static updateFavoriteTracks = (
    accessToken: string,
    playlistId: string,
    trackIds: string[]
  ) => {
    return axios.put(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        uris: trackIds
      },
      {
        headers: {
          "Content-Type": "text/plain",
          Authorization: "Bearer " + accessToken
        }
      }
    );
  };

  public static startSong = (
    accessToken: string,
    ids: string[],
    deviceId: string
  ) => {
    return axios.put(
      "https://api.spotify.com/v1/me/player/play?device_id=" + deviceId,
      {
        uris: ids
      },
      {
        headers: {
          "Content-Type": "text/plain",
          Authorization: "Bearer " + accessToken
        }
      }
    );
  };

  public static resume = (
    accessToken: string,
    ids: string[],
    progress: number,
    deviceId: string
  ) => {
    return axios
      .put(
        "https://api.spotify.com/v1/me/player/play?device_id=" + deviceId,
        {
          uris: ids
        },
        {
          headers: {
            "Content-Type": "text/plain",
            Authorization: "Bearer " + accessToken
          }
        }
      )
      .then(() => {
        return axios.put(
          "https://api.spotify.com/v1/me/player/seek?position_ms=" + progress,
          {},
          {
            headers: {
              "Content-Type": "text/plain",
              Authorization: "Bearer " + accessToken
            }
          }
        );
      });
  };

  public static pause = (accessToken: string) => {
    return axios.put(
      "https://api.spotify.com/v1/me/player/pause",
      {},
      {
        headers: {
          "Content-Type": "text/plain",
          Authorization: "Bearer " + accessToken
        }
      }
    );
  };

  public static setDevice = (
    accessToken: string,
    isPlaying: boolean,
    deviceId: string
  ) => {
    return axios.put(
      "https://api.spotify.com/v1/me/player/",
      {
        device_ids: [deviceId],
        play: isPlaying
      },
      {
        headers: {
          "Content-Type": "text/plain",
          Authorization: "Bearer " + accessToken
        }
      }
    );
  };

  public static getArtistTopTracks = (
    accessToken: string,
    id: string,
    user: string,
    passcode: string
  ) => {
    return new Promise<SpotifyTrack[]>((resolve, reject) => {
      axios
        .get(
          "https://api.spotify.com/v1/artists/" + id + "/top-tracks?country=FI",
          {
            headers: {
              "Content-Type": "text/plain",
              Authorization: "Bearer " + accessToken
            }
          }
        )
        .then(response => {
          const topTracks: SpotifyTrack[] = response.data.tracks.map(
            (i: any) => {
              return {
                artist: i.artists[0].name,
                name: i.name,
                id: i.uri,
                artistId: i.artists[0].id,
                duration: i.duration_ms,
                isFavorite: false,
                source: "spotify"
              };
            }
          );
          resolve(topTracks);
        })
        .catch(err => {
          if (err.response) {
            logger.error(
              `Unable to fetch top tracks from Spotify with id ${id}`,
              { user, passcode }
            );
          } else {
            logger.error(err);
          }
          reject({
            status: 500,
            message:
              "Unable to fetch top tracks from Spotify. Please try again later."
          });
        });
    });
  };

  public static getArtistAlbums = (
    accessToken: string,
    id: string,
    user: string,
    passcode: string
  ) => {
    return new Promise((resolve, reject) => {
      axios
        .get("https://api.spotify.com/v1/artists/" + id + "/albums", {
          headers: {
            "Content-Type": "text/plain",
            Authorization: "Bearer " + accessToken
          }
        })
        .then(response => {
          const albums = response.data.items.map((album: any) => {
            return {
              artist: album.artists[0].name,
              name: album.name,
              id: album.id,
              artistId: album.artists[0].id
            };
          });
          resolve(albums);
        })
        .catch(err => {
          if (err.response) {
            logger.error(
              `Unable to fetch artist's albums from Spotify with id ${id}`,
              { user, passcode }
            );
          } else {
            logger.error(err);
          }
          reject({
            status: 500,
            message:
              "Unable to fetch artist's albums from Spotify. Please try again later."
          });
        });
    });
  };

  public static getAlbum = (
    accessToken: string,
    id: string,
    user: string,
    passcode: string
  ) => {
    return new Promise<SpotifyTrack[]>((resolve, reject) => {
      axios
        .get("https://api.spotify.com/v1/albums/" + id, {
          headers: {
            "Content-Type": "text/plain",
            Authorization: "Bearer " + accessToken
          }
        })
        .then(response => {
          const albums = response.data.tracks.items.map((i: any) => {
            return {
              artist: i.artists[0].name,
              artistId: i.artists[0].id,
              name: i.name,
              id: i.uri,
              duration: i.duration_ms
            };
          });
          resolve(albums);
        })
        .catch(err => {
          if (err.response) {
            logger.error(`Unable to fetch albums from Spotify with id ${id}`, {
              user,
              passcode
            });
          } else {
            logger.error(err);
          }
          reject({
            status: 500,
            message:
              "Unable to fetch albums from Spotify. Please try again later."
          });
        });
    });
  };

  public static search = (
    user: string,
    passcode: string,
    accessToken: string,
    query: SpotifySearchQuery
  ) => {
    return new Promise<ISearchResults>((resolve, reject) => {
      axios
        .get(
          "https://api.spotify.com/v1/search?" +
            Querystring.stringify(query as any),
          {
            headers: {
              "Content-Type": "text/plain",
              Authorization: "Bearer " + accessToken
            }
          }
        )
        .then(response => {
          const results: ISearchResults = {
            tracks: [],
            albums: [],
            artists: []
          };
          if (query.type.indexOf("track") >= 0) {
            results.tracks = response.data.tracks.items.map((i: any) => {
              return {
                artist: i.artists[0].name,
                artistId: i.artists[0].id,
                name: i.name,
                id: i.uri,
                duration: i.duration_ms,
                isFavorite: false,
                source: "spotify"
              };
            });
          }

          if (query.type.indexOf("album") >= 0) {
            results.albums = response.data.albums.items.map((album: any) => {
              return {
                artist: album.artists[0].name,
                artistId: album.artists[0].id,
                name: album.name,
                id: album.id
              };
            });
          }

          if (query.type.indexOf("artist") >= 0) {
            results.artists = response.data.artists.items.map((artist: any) => {
              return {
                name: artist.name,
                id: artist.id
              };
            });
          }

          resolve(results);
        })
        .catch(err => {
          if (err.response) {
            const errorMessage = err.response.data.error.message;
            logger.error(`Error with search query ${query.q}`, {
              user,
              passcode
            });
            logger.error(errorMessage, { user, passcode });
            if (errorMessage.indexOf("access token expired") >= 0) {
              reject({
                status: err.response.status,
                message:
                  "Unable to search from Spotify. Queue owner needs to refresh the access token."
              });
            } else {
              reject({
                status: err.response.status,
                message:
                  "Unable to get search results from Spotify. Error: " +
                  err.response.data.error.message
              });
            }
          } else {
            logger.error(err, { user, passcode });
            reject({
              status: err.response.status,
              message: "Unable to get search results from Spotify"
            });
          }
        });
    });
  };

  public static getToken = (code: string, callback: string) => {
    const data = {
      grant_type: "authorization_code",
      code,
      redirect_uri: SpotifyService.redirectUri + callback
    };
    return axios.post(
      "https://accounts.spotify.com/api/token",
      Querystring.stringify(data),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: SpotifyService.authHeader
        }
      }
    );
  };

  private static refreshAccessToken = (refreshToken: string) => {
    const data = {
      grant_type: "refresh_token",
      refresh_token: refreshToken
    };
    return axios.post(
      "https://accounts.spotify.com/api/token",
      Querystring.stringify(data),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: SpotifyService.authHeader
        }
      }
    );
  };
}

export default SpotifyService;
