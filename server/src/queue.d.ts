import { SpotifyTrack } from "./spotify";

export interface QueueDao {
    id: string;
    owner: string;
    data: Queue;
    isPlaying: boolean;
}

export interface CurrentTrack extends QueueItem {
    votes: Vote[];
}

export interface Vote {
    userId: string;
    value: number;
}

export interface Settings {
    name: string;
    gamify: boolean;
    maxDuplicateTracks: number;
    numberOfTracksPerUser: number;
    randomPlaylist: boolean;
    randomQueue: boolean;
    skipThreshold: number;
    playlist: string | null;
    maxSequentialTracks: number;
    spotifyLogin: boolean;
}

export interface Queue {
    owner: string,
    accessToken: string | null;
    accessTokenAcquired: number;
    refreshToken: string;
    expiresIn: number;
    deviceId: string | null;
    settings: Settings;
    queue: QueueItem[];
    playlistTracks: QueueItem[];
    currentTrack: CurrentTrack | null;
    users: User[];
}

export interface User {
    id: string;
    spotifyUserId: string | null; // Ensure that the owner is always found even if cookie is deleted
    points: number;
    accessToken: string | null;
    refreshToken: string | null;
    expiresIn: number | null;
    accessTokenAcquired: number | null;
    username: string;
}

export interface QueueItem {
    userId: string | null;
    track: SpotifyTrack;
    protected: boolean;
    source: string;
}