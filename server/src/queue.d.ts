import { SpotifyTrack } from "./spotify";

export interface QueueDao {
  id: string;
  owner: string;
  is_playing: boolean;
  access_token: string;
  access_token_acquired: number;
  refresh_token: string;
  expires_in: number;
  device_id: string;
}

export interface CurrentState {
  accessToken: string | null;
  currentTrack: CurrentTrack | null,
  isSpotifyPlaying: boolean;
  isSpotiquPlaying: boolean;
  playlistId: string | null;
  deviceId: string | null;
}

export interface FullQueue extends Queue {
  settings: Settings;
  tracks: QueueItem[];
  playlistTracks: QueueItem[];
  currentTrack: CurrentTrack | null;
  users: User[];
}

export interface Queue {
  passcode: string;
  owner: string,
  accessToken: string | null;
  accessTokenAcquired: number;
  refreshToken: string;
  isPlaying: boolean;
  expiresIn: number;
  deviceId: string | null;
}

export interface TrackDao {
  id: string;
  passcode: string;
  user_id: string;
  data: SpotifyTrack;
  track_uri: string;
  protected: boolean;
  source: string;
  currently_playing: boolean;
  progress: number;
  timestamp: number;
  playlist_track: boolean;
}

export interface CurrentTrack extends QueueItem {
  votes: Vote[];
  progress: number;
}

export interface VoteDao {
  id: string;
  passcode: string;
  user_id: string;
  track_id: string;
  value: number;
}

export interface Vote {
  userId: string;
  value: number;
}

export interface SettingsDao {
  id: string;
  passcode: string;
  name: string;
  gamify: boolean;
  max_duplicate_tracks: number;
  number_of_tracks_per_user: number;
  random_playlist: boolean;
  random_queue: boolean;
  skip_threshold: number;
  playlist: string;
  max_sequential_tracks: number;
  spotify_login: boolean;
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

export interface UserDao {
  id: string;
  spotify_user_id: string | null;
  points: number;
  karma: number;
  access_token: string | null;
  refresh_token: string | null;
  expires_in: number | null;
  access_token_acquired: number | null;
  username: string;
}
export interface User {
  id: string;
  spotifyUserId: string | null; // Ensure that the owner is always found even if cookie is deleted
  points: number;
  karma: number;
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: number | null;
  accessTokenAcquired: number | null;
  username: string;
}

export interface QueueItem {
  id: string;
  userId: string | null;
  track: SpotifyTrack;
  trackUri: string;
  protected: boolean;
  source: string;
  currentlyPlaying: boolean;
  timestamp: number;
  playlistTrack: boolean;
}

export interface Perk {
  name: PerkName;
  price: number;
  requiredKarma: number;
  level: number;
}

export type PerkName = "move_up" | "queue_more_1" | "queue_sequential_1" | "remove_song" | "skip_song" | "queue_more_2" | "queue_sequential_2" | "move_first";