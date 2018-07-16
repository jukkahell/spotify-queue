import { SpotifyTrack } from "./spotify";

export interface QueueDao {
    id: string;
    owner: string;
    data: Queue;
    isPlaying: boolean;
}

export interface CurrentTrack {
    track: SpotifyTrack;
    owner: string;
    votes: Vote[];
}

export interface Vote {
    userId: string;
    value: number;
}

export interface Settings {
    gamify: boolean;
    alwaysPlay: {
        playlistId: string | null;
        random: boolean;
    };
}

export interface Queue {
    name: string;
    owner: string,
    accessToken: string | null;
    accessTokenAcquired: number;
    refreshToken: string;
    expiresIn: number;
    deviceId: string | null;
    settings: Settings;
    queue: QueueItem[];
    playlistId: string | null;
    playlistTracks: QueueItem[];
    currentTrack: CurrentTrack | null;
    users: [
        {
            id: string;
            spotifyUserId: string | null; // Ensure that the owner is always found even if cookie is deleted
            points: number;
        }
    ];
}

export interface QueueItem {
    userId: string;
    track: SpotifyTrack;
}