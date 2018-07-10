import { SpotifyTrack } from "./spotify";

export interface QueueDao {
    id: string;
    owner: string;
    data: Queue;
}

export interface CurrentTrack {
    track: SpotifyTrack;
    owner: string;
    votes: [
        {
            userId: string;
            vote: number;
        }
    ] | never[];
}

export interface Queue {
    name: string;
    owner: string,
    accessToken: string | null;
    accessTokenAcquired: number;
    refreshToken: string;
    expiresIn: number;
    deviceId: string | null;
    isPlaying: boolean;
    settings: {
        gamify: boolean;
        alwaysPlay: {
            playlistId: string | null;
            random: boolean;
        }
    };
    queue: QueueItem[];
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