export interface SpotifyTrack {
  id: string;
  artistId: string;
  name: string;
  duration: number;
  progress: number;
  artist: string;
  cover: string;
  isFavorite: boolean;
  source: string;
  votes?: number;
}

export interface SpotifyCurrentTrack {
  timestamp?: number;
  device: {
    id: string;
    is_active: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number;
  };
  progress_ms: number;
  is_playing: boolean;
  item: SpotifyTrack | null;
  shuffle_state?: boolean;
  repeat_state?: "on" | "off";
  context?: {
    external_urls: {
      spotify: string;
    };
    href: string;
    type: string;
    uri: string;
  };
}

export interface SpotifySearchQuery {
  q: string;
  type: string;
  market: string;
  limit: number;
}

export interface Spotify {
  track: SpotifyTrack;
  searchQuery: SpotifySearchQuery;
}

export interface SpotifyTrackResponse {
  name: string;
  artists: SpotifyTrackArtist[];
  duration_ms: number;
  album: {
    images: SpotifyTrackAlbum[]
  }
}

export interface SpotifyTrackArtist {
  id: string;
  name: string;
}

export interface SpotifyTrackAlbum {
  url: string;
}

export default Spotify;
