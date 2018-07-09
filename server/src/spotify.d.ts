export interface SpotifyTrack {
    id: string;
    name: string;
    duration: number;
    progress: number;
    artist: string;
    cover: string;
}

export interface SpotifySearchQuery {
    q: string,
    type: string,
    market: string,
    limit: number
}

export interface Spotify {
    track: SpotifyTrack;
    searchQuery: SpotifySearchQuery;
}

export default Spotify;