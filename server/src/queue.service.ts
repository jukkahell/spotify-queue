import * as randomstring from "randomstring";
import { QueryResult } from "../node_modules/@types/pg";
import * as db from "./db";
import { QueueDao, QueueItem, FullQueue, Queue, CurrentTrack, Settings, Vote, User, UserDao, TrackDao, SettingsDao, VoteDao, CurrentState, Perk, PerkName } from "./queue";
import { SpotifyTrack } from "./spotify";
import SpotifyService from "./spotify.service";
import { getCurrentSeconds } from "./util";
import Acl from "./acl";
import { logger } from "./logger.service";
import { Gamify } from "./gamify";
import config from "./config";
import YoutubeService from "./youtube.service";
import * as uuid from "uuid/v1";

export interface QueueTimeout {
  [accessToken: string]: NodeJS.Timer;
}

class QueueService {

  private static timeouts: QueueTimeout = {};

  public static async getQueue(passcode: string): Promise<Queue> {
    let query = "SELECT * FROM queue WHERE id = $1";
    try {
      const result: QueryResult = await db.query(query, [passcode]);
      if (result.rowCount === 1) {
        return QueueService.mapQueue(result.rows[0]);
      } else {
        throw Error("Unable to find queue with given passcode.");
      }
    } catch (err) {
      logger.error("Error occurred while fetching queue from database", { passcode });
      logger.error(err, { passcode });
      throw Error("Error occurred while fetching queue from database. Please try again later.");
    }
  }

  public static async getFullQueue(passcode: string, userId?: string): Promise<FullQueue> {
    try {
      const queue: Queue = await QueueService.getQueue(passcode);
      const settings = await QueueService.getSettings(passcode);
      const users = await QueueService.getUsers(passcode);
      const currentTrack = await QueueService.getCurrentTrack(passcode, userId);
      const playlistTracks = await QueueService.getTracks(passcode, userId, true);
      const tracks = await QueueService.getTracks(passcode, userId, false);
      return {
        settings,
        users,
        currentTrack,
        playlistTracks,
        tracks,
        ...queue,
      };
    } catch (err) {
      logger.error("Error occurred while fetching the full queue from database", { passcode });
      logger.error(err, { passcode });
      throw Error("Error occurred while fetching full queue object from database. Please try again later.");
    }
  }

  public static async getQueueBySpotifyId(spotifyUserId: string): Promise<Queue | null> {
    try {
      const user = await QueueService.findUserBySpotifyId(spotifyUserId);
      const queues = await db.query("SELECT * FROM queue WHERE owner = $1", [user.id]);
      if (queues.rowCount > 0) {
        return QueueService.mapQueue(queues.rows[0]);
      }
    } catch (err) {}
    return null;
  }

  public static mapQueue(queueDao: QueueDao): Queue {
    return {
      passcode: queueDao.id,
      isPlaying: queueDao.is_playing,
      owner: queueDao.owner,
      accessToken: queueDao.access_token,
      accessTokenAcquired: queueDao.access_token_acquired,
      refreshToken: queueDao.refresh_token,
      expiresIn: queueDao.expires_in,
      deviceId: queueDao.device_id,
    };
  }

  public static async findUser(passcode: string, userId: string): Promise<User | null> {
    logger.debug(`Find user...`, { user: userId, passcode });
    try {
      return await this.getUser(passcode, userId);
    } catch (err) {
      return null;
    }
  }

  public static async findUserById(id: string): Promise<User | null> {
    logger.debug(`Find user by id...`, { user: id });
    const query = "SELECT * FROM users u WHERE id = $1";
    const users = await db.query(query, [id]);
    if (users && users.rowCount === 1) {
      return QueueService.mapUserDao(users.rows[0]);
    }
    return null;
  }

  public static async getUser(passcode: string, userId: string): Promise<User> {
    logger.debug(`Get user...`, { user: userId, passcode });
    const query = "SELECT u.*, uq.points, uq.karma FROM users u JOIN user_queues uq ON u.id = uq.user_id WHERE (u.id = $1 OR u.spotify_user_id = $1) AND uq.passcode = $2";
    const users = await db.query(query, [userId, passcode]);
    if (users && users.rowCount === 1) {
      return QueueService.mapUserDao(users.rows[0]);
    }
    let message = "User not found with given id."
    if (userId) {
      message += " Maybe try logging in again."
    }
    throw { status: 404, message };
  }

  public static async findUserBySpotifyId(spotifyUserId: string): Promise<User> {
    const query = "SELECT * FROM users WHERE spotify_user_id = $1";
    const users = await db.query(query, [spotifyUserId]);
    if (users && users.rowCount === 1) {
      return QueueService.mapUserDao(users.rows[0]);
    }
    throw { status: 404, message: "User not found with given spotify id" };
  }

  public static async getOrCreateUser(spotifyUserId: string, accessToken: string, refreshToken: string, expiresIn: number, accessTokenAcquired: number): Promise<User> {
    const query = "SELECT * FROM users WHERE spotify_user_id = $1";
    const users = await db.query(query, [spotifyUserId]);
    if (users && users.rowCount === 1) {
      return QueueService.mapUserDao(users.rows[0]);
    } else {
      const user: User = {
        id: randomstring.generate(),
        accessToken,
        refreshToken,
        expiresIn,
        accessTokenAcquired,
        karma: 0,
        points: config.gamify.initialPoints,
        spotifyUserId,
        username: spotifyUserId,
      }
      const createQuery = "INSERT INTO users (id, access_token, refresh_token, expires_in, access_token_acquired, spotify_user_id, username) VALUES ($1, $2, $3, $4, $5, $6, $7)"
      db.query(createQuery, [user.id, user.accessToken, user.refreshToken, user.expiresIn, user.accessTokenAcquired, user.spotifyUserId, user.username]);
      return user;
    }
  }

  public static async setActiveDevice(passcode: string, deviceId: string) {
    db.query("UPDATE queue SET device_id = $1 WHERE id = $2", [deviceId, passcode]);
  }

  public static async getUsers(passcode: string) {
    const query = "SELECT u.*, uq.points, uq.karma FROM users u JOIN user_queues uq ON u.id = uq.user_id WHERE uq.passcode = $1";
    const users = await db.query(query, [passcode]);
    return users.rows.map(QueueService.mapUserDao);
  }

  public static mapUserDao(userDao: UserDao): User {
    return {
      id: userDao.id,
      spotifyUserId: userDao.spotify_user_id,
      points: userDao.points,
      karma: userDao.karma,
      accessToken: userDao.access_token,
      refreshToken: userDao.refresh_token,
      expiresIn: userDao.expires_in,
      accessTokenAcquired: userDao.access_token_acquired,
      username: userDao.username,
    }
  }

  public static async getUserQueues(passcode: string, user: string) {
    let query = "SELECT s.name, s.passcode, q.owner FROM user_queues uq JOIN settings s ON s.passcode = uq.passcode JOIN queue q ON q.id = s.passcode WHERE uq.user_id = $1";
    try {
      logger.debug(`Getting user's queues...`, { user, passcode });
      const result: QueryResult = await db.query(query, [user]);
      if (result.rowCount > 0) {
        return result.rows.map(row => {
          return { "name": row.name, "passcode": row.passcode, "owner": row.owner }
        });
      } else {
        return [];
      }
    } catch (err) {
      logger.error("Error occurred while fetching user queues from database", { passcode });
      logger.error(err, { user, passcode });
      throw Error("Error occurred while fetching user queues from database. Please try again later.");
    }
  }

  public static async getSettings(passcode: string) {
    let query = "SELECT * FROM settings WHERE passcode = $1";
    try {
      logger.debug(`Getting settings...`, { passcode });
      const settingsRow: QueryResult = await db.query(query, [passcode]);
      if (settingsRow.rowCount === 1) {
        return QueueService.mapSettings(settingsRow.rows[0]);
      } else {
        throw { status: 404, message: "No settings found for queue" };
      }
    } catch (err) {
      logger.error("Error occurred while fetching settings from database", { passcode });
      logger.error(err, { passcode });
      throw err;
    }
  }

  public static mapSettings(settingsDao: SettingsDao): Settings {
    return {
      name: settingsDao.name,
      gamify: settingsDao.gamify,
      maxDuplicateTracks: settingsDao.max_duplicate_tracks,
      numberOfTracksPerUser: settingsDao.number_of_tracks_per_user,
      randomPlaylist: settingsDao.random_playlist,
      randomQueue: settingsDao.random_queue,
      skipThreshold: settingsDao.skip_threshold,
      playlist: settingsDao.playlist,
      maxSequentialTracks: settingsDao.max_sequential_tracks,
      spotifyLogin: settingsDao.spotify_login,
      banVoteCount: settingsDao.ban_vote_count,
      usePerkShop: settingsDao.use_perk_shop,
    };
  }

  public static async getTracks(passcode: string, userId: string | undefined, isPlaylistTrack: boolean): Promise<CurrentTrack[]> {
    try {
      const query = "SELECT * FROM tracks WHERE passcode = $1 AND playlist_track = $2 AND currently_playing = false ORDER BY timestamp ASC";
      logger.debug(`Getting playlist tracks...`, { passcode });
      const trackRows: QueryResult = await db.query(query, [passcode, isPlaylistTrack]);
      const tracks: TrackDao[] = trackRows.rows;
      return Promise.all(
        tracks.map(async t => {
          const isFavorite = await QueueService.isFavorite(passcode, userId, t.track_uri);
          return QueueService.mapTrack(t, isFavorite);
        })
      );
    } catch (err) {
      logger.error("Error occurred while fetching playlist tracks from database", { passcode });
      logger.error(err, { passcode });
      throw err;
    }
  }

  public static async getCurrentTrack(passcode: string, userId?: string): Promise<CurrentTrack | null> {
    let query = "SELECT * FROM tracks WHERE passcode = $1 AND currently_playing = true";
    try {
      logger.debug(`Getting current track...`, { passcode });
      const trackRow: QueryResult = await db.query(query, [passcode]);
      if (trackRow.rowCount === 1) {
        const track: TrackDao = trackRow.rows[0];
        const isFavorite = await QueueService.isFavorite(passcode, userId, track.track_uri);
        return QueueService.mapTrack(track, isFavorite);
      } else {
        return null;
      }
    } catch (err) {
      logger.error("Error occurred while fetching current track from database", { passcode });
      logger.error(err, { passcode });
      throw { status: 500, message: "Unable to fetch current track from database" };
    }
  }

  public static async moveTrack(track: QueueItem) {
    await db.query("UPDATE tracks SET timestamp = $1 WHERE id = $2", [track.timestamp, track.id]);
  }

  public static async switchTrackPositions(moveTrack: QueueItem, earlierTrack: QueueItem) {
    const tmp = moveTrack.timestamp;
    moveTrack.timestamp = earlierTrack.timestamp;
    earlierTrack.timestamp = tmp;
    await QueueService.moveTrack(moveTrack);
    await QueueService.moveTrack(earlierTrack);
  }

  public static protectTrack(passcode: string, trackId: string) {
    const query = "UPDATE tracks SET protected = true WHERE id = $1 AND passcode = $2";
    db.query(query, [trackId, passcode]);
  }

  public static async getTrackVotes(passcode: string, trackId: string) {
    const trackVotesQuery = "SELECT * FROM track_votes WHERE passcode = $1 AND track_id = $2";
    const trackVotesRows = await db.query(trackVotesQuery, [passcode, trackId]);
    if (trackVotesRows && trackVotesRows.rowCount > 0) {
      return trackVotesRows.rows.map(QueueService.mapTrackVote);
    }
    return [];
  }

  public static async resetPoints(passcode: string, userId: string, resetId: string) {
    logger.info(`Resetting user's ${resetId} points...`, { passcode, user: userId });
    const query = "UPDATE user_queues SET points = $1 WHERE user_id = $2 AND passcode = $3";
    await db.query(query, [config.gamify.initialPoints, resetId, passcode]);
    return await QueueService.getUser(passcode, resetId);
  }

  public static addPoints(passcode: string, userId: string, points: number) {
    logger.info(`Adding ${points} points...`, { passcode, user: userId });
    const query = "UPDATE user_queues SET points = points + $1 WHERE user_id = $2 AND passcode = $3";
    db.query(query, [points, userId, passcode]);
  }

  public static addKarma(passcode: string, userId: string, karma: number) {
    logger.info(`Adding ${karma} karma...`, { passcode, user: userId });
    const query = "UPDATE user_queues SET karma = karma + $1 WHERE user_id = $2 AND passcode = $3 AND karma > 0";
    db.query(query, [karma, userId, passcode]);
  }

  public static async removeUser(passcode: string, userId: string, removeId: string) {
    logger.info(`Removing user ${removeId}...`, { passcode, user: userId });
    const query = "DELETE FROM user_queues WHERE passcode = $1 AND user_id = $2";
    db.query(query, [passcode, removeId]);
  }

  public static async vote(passcode: string, user: string, value: number) {
    if (value !== 1 && value !== -1) {
      throw { status: 400, message: "Nice try. Vote value must be either -1 or 1." };
    } else if (!user) {
      throw { status: 401, message: "User not provided" };
    }

    try {
      const queue = await QueueService.getQueue(passcode);
      if (!queue) {
        throw { status: 404, message: "Queue not found with the given passcode" };
      } else if (!queue.isPlaying) {
        throw { status: 403, message: "Cannot vote if the queue is not playing." };
      }

      const currentTrack = await QueueService.getCurrentTrack(passcode, user);
      if (!currentTrack) {
        throw { status: 404, message: "Current song not found. Vote not added." };
      } else if (currentTrack.userId === user) {
        throw { status: 403, message: "Can't vote for own songs." };
      }

      const query = `
        INSERT INTO
          track_votes (passcode, value, user_id, track_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (passcode, user_id, track_id)
        DO UPDATE SET value = $2`;
      await db.query(query, [passcode, value, user, currentTrack.id]);

      // Skip the song if enough downvotes
      const votes = await QueueService.getTrackVotes(passcode, currentTrack.id);
      const settings = await QueueService.getSettings(passcode);
      await QueueService.addPoints(passcode, user, 1);
      const voteSum = votes.reduce((sum, v) => sum + v.value, 0);
      if (voteSum <= -settings.skipThreshold) {
        logger.info(`Got downvote form ${Math.abs(voteSum)}/${settings.skipThreshold} users. Skipping this song...`, { user, passcode });
        currentTrack.votes = votes;
        QueueService.startNextTrack(passcode, user, currentTrack);
      }
    } catch(err) {
      logger.error(err);
      throw { status: err.status || 500, message: err.message || "Error occurred while trying to save the vote" };
    }
  }

  public static async create(code: string, orReactivate: boolean) {
    let accessToken: string;
    let refreshToken: string;
    let expiresIn: number;

    logger.debug(`Creating new queue...`);

    try {
      const tokenResponse = await SpotifyService.getToken(code, orReactivate ? "createOrReactivate" : "create");
      accessToken = tokenResponse.data.access_token;
      refreshToken = tokenResponse.data.refresh_token;
      expiresIn = tokenResponse.data.expires_in;

      logger.debug("Received access token...going to get username");
      const spotifyUserResponse = await SpotifyService.getUser(accessToken);

      const spotifyUserId = spotifyUserResponse.data.id;
      let passcode: string;

      // User must have premium account
      if (spotifyUserResponse.data.product !== "premium") {
        throw { status: 403, message: "You must have Spotify Premium to use Spotiqu." };
      }

      logger.debug(`Found spotify userId...trying to find existing queues`, { id: spotifyUserId });

      // Check if QueueService user already has a queue
      const queue = await QueueService.getQueueBySpotifyId(spotifyUserId);
      if (queue && orReactivate) {
        queue.refreshToken = refreshToken;
        queue.expiresIn = expiresIn;
        queue.accessTokenAcquired = getCurrentSeconds();
        queue.accessToken = accessToken;
        passcode = queue.passcode;
        logger.info(`Found existing queue`, { passcode });
        QueueService.activateQueue(queue);
        
        const user = await QueueService.findUserBySpotifyId(spotifyUserId);
        user.accessToken = accessToken;
        user.refreshToken = refreshToken;
        user.expiresIn = expiresIn;
        user.accessTokenAcquired = getCurrentSeconds();
        await QueueService.updateUserCredentials(user);

        return queue;
      } else {
        const user = await QueueService.getOrCreateUser(spotifyUserId, accessToken, refreshToken, expiresIn, getCurrentSeconds());
        const passcode = await QueueService.generatePasscode();
        await QueueService.createSettings(passcode);
        const newQueue = await QueueService.createNewQueue(passcode, accessToken, refreshToken, expiresIn, user.id);
        await QueueService.addUserToQueue(user, newQueue, []);
        logger.info(`Generated passcode`, { user: user.id, passcode });
        return newQueue;
      }
    } catch (err) {
      logger.error(err);
      throw { status: 500, message: "Unable to create queue. Please try again in a moment." };
    }
  }

  public static async createNewQueue(passcode: string, accessToken: string, refreshToken: string, expiresIn: number, userId: string) {
    const newQueue: Queue = {
      accessToken,
      accessTokenAcquired: getCurrentSeconds(),
      expiresIn,
      passcode,
      refreshToken,
      owner: userId,
      deviceId: null,
      isPlaying: false,
    };

    const createQueueQuery = `
      INSERT INTO queue (id, owner, access_token, access_token_acquired, refresh_token, expires_in, device_id, is_playing)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

    await db.query(createQueueQuery, [newQueue.passcode, newQueue.owner, newQueue.accessToken, newQueue.accessTokenAcquired, newQueue.refreshToken, newQueue.expiresIn, null, false]);

    return newQueue;
  }

  public static async createSettings(passcode: string) {
    const settings: Settings = {
      gamify: false,
      maxDuplicateTracks: 2,
      maxSequentialTracks: 3,
      name: "Queue 1",
      numberOfTracksPerUser: 5,
      playlist: null,
      randomPlaylist: true,
      randomQueue: false,
      skipThreshold: 5,
      spotifyLogin: false,
      banVoteCount: 10,
      usePerkShop: false,
    };

    const createSettingsQuery = `
      INSERT INTO settings (
        passcode, name, gamify, max_duplicate_tracks, number_of_tracks_per_user, random_playlist, 
        random_queue, skip_threshold, max_sequential_tracks, spotify_login, ban_vote_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;

    await db.query(createSettingsQuery, [
      passcode, settings.name, settings.gamify, settings.maxDuplicateTracks, settings.numberOfTracksPerUser,
      settings.randomPlaylist, settings.randomQueue, settings.skipThreshold, settings.maxSequentialTracks, settings.spotifyLogin,
      settings.banVoteCount,
    ]);

    return settings;
  }

  public static async reactivate(passcode: string, userId: string, code: string) {
    let accessToken: string;
    let refreshToken: string;
    let expiresIn: number;

    logger.info(`Reactivating queue...`, { user: userId, passcode });

    try {
      const tokenResponse = await SpotifyService.getToken(code, "reactivate");
      accessToken = tokenResponse.data.access_token;
      refreshToken = tokenResponse.data.refresh_token;
      expiresIn = tokenResponse.data.expires_in;
      logger.info("Access token received...going to get username", { user: userId, passcode });
      const userReponse = await SpotifyService.getUser(accessToken);
      const spotifyUserId = userReponse.data.id;
      logger.debug(`Found spotify userId ${spotifyUserId}...trying to reactivate`, { user: userId, passcode });

      const queue = await QueueService.getQueue(passcode);
      const queueOwner = await QueueService.getUser(passcode, queue.owner);
      if (queueOwner.id === userId || queueOwner.spotifyUserId === spotifyUserId) {
        queue.accessToken = accessToken;
        queue.refreshToken = refreshToken;
        queue.expiresIn = expiresIn;
        await QueueService.activateQueue(queue);

        queueOwner.accessToken = accessToken;
        queueOwner.refreshToken = refreshToken;
        queueOwner.expiresIn = expiresIn;
        queueOwner.accessTokenAcquired = getCurrentSeconds();
        await QueueService.updateUserCredentials(queueOwner);

        logger.debug(`Successfully reactivated`, { user: userId, passcode });
        return queue;
      } else {
        throw { status: 401, message: "Cannot reactivate queue since you're not the owner." };
      }
    } catch (err) {
      if (err.response) {
        err = err.response.data.error.message;
      }
      logger.error(err, { user: userId, passcode });
      throw { status: 500, message: "Unable to get data from spotify. Please try again later." };
    }
  }



  public static async visitorSpotifyLogin(passcode: string, userId: string, code: string) {
    try {
      logger.info(`Logging visitor to Spotify...`, { user: userId, passcode });
      const tokenResponse = await SpotifyService.getToken(code, "visitorAuth");

      logger.info("Access token received...going to get username", { user: userId, passcode });
      const spotifyUser = await SpotifyService.getUser(tokenResponse.data.access_token);
      const spotifyUserId = spotifyUser.data.id;
      logger.debug(`Found spotify userId ${spotifyUserId}...saving data for the visitor`, { user: userId, passcode });

      let realUser: User;
      try {
        realUser = await QueueService.findUserBySpotifyId(spotifyUserId);
        // UserId has changed. Update points to old user and remove current.
        if (realUser.id !== userId) {
          logger.info(`Found existing user with spotify id ${spotifyUserId}...remove old user and use current instead.`, { passcode, user: userId });
          const wrongUser = await QueueService.getUser(passcode, userId);
          realUser.points += (wrongUser.points - config.gamify.initialPoints);
          realUser.karma += wrongUser.karma;
          logger.info(`User ${realUser.id} old points was ${realUser.points}, old karma was ${realUser.karma}`, { passcode, user: userId });
          db.query("DELETE FROM users WHERE id = $1", [wrongUser.id]);
          await db.query("DELETE FROM user_queues WHERE user_id = $1 AND passcode = $2", [wrongUser.id, passcode]);
          await db.query("UPDATE user_queues SET user_id = $1 WHERE user_id = $2", [realUser.id, wrongUser.id]);
          await db.query("UPDATE user_queues SET points = $1, karma = $2 WHERE user_id = $3 AND passcode = $4", [realUser.points, realUser.karma, realUser.id, passcode]);
          await db.query("UPDATE queue SET owner = $1 WHERE owner = $2", [realUser.id, wrongUser.id]);
          await db.query("UPDATE tracks SET user_id = $1 WHERE user_id = $2", [realUser, wrongUser.id]);
        }
        realUser.id = userId;
      } catch (err) {
        logger.error(err);
        realUser = await QueueService.getUser(passcode, userId);
      }
      
      if (!realUser) {
        throw { status: 401, message: "User not in queue." };
      }

      realUser.spotifyUserId = spotifyUserId;
      realUser.accessToken = tokenResponse.data.access_token;
      realUser.refreshToken = tokenResponse.data.refresh_token;
      realUser.expiresIn = tokenResponse.data.expires_in;
      realUser.accessTokenAcquired = getCurrentSeconds();

      const updateUserQuery = "UPDATE users SET spotify_user_id = $1, access_token = $2, refresh_token = $3, expires_in = $4, access_token_acquired = $5 WHERE id = $6";
      db.query(updateUserQuery, [realUser.spotifyUserId, realUser.accessToken, realUser.refreshToken, realUser.expiresIn, realUser.accessTokenAcquired, userId]);
      return realUser;
    } catch (err) {
      if (err.response) {
        err = err.response.data.error.message;
      } else if (err.message) {
        err = err.message;
      }
      logger.error(err, { user: userId, passcode });
      throw { status: 500, message: "Error occurred while getting access token from Spotify." };
    }
  }

  public static async generatePasscode() {
    let loops = 10;

    do {
      let passcode = randomstring.generate({ readable: true, length: 8, charset: "alphanumeric" });
      const results = await db.query("SELECT 1 FROM queue WHERE id = $1", [passcode]);
      if (results.rowCount === 0) {
        return passcode;
      }
      loops--;
    } while (loops > 0);

    throw { status: 500, message: "Passcode wtf!?" };
  }

  public static async join(passcode: string, userId: string): Promise<boolean> {
    try {
      const queue = await QueueService.getQueue(passcode);
      const users = await QueueService.getUsers(passcode);
      let user = await QueueService.findUserById(userId);
      // Check if queue is active
      if (!queue.accessToken) {
        const isOwner = queue.owner === userId;
        if (!isOwner) {
          logger.debug(`Queue is not active. Not allowed to join. Is owner: ${isOwner}.`, { user: userId, passcode });
          throw { status: 403, message: "Queue not active. The owner needs to reactivate it.", isOwner };
        }

        if (user && user.accessToken) {
          queue.accessToken = user.accessToken;
          queue.refreshToken = user.refreshToken!;
          queue.accessTokenAcquired = user.accessTokenAcquired!;
          queue.expiresIn = user.expiresIn!;
          QueueService.activateQueue(queue);
          return true;
        } else {
          throw { status: 403, message: "Queue not active. Try again after logging in with Spotify.", isOwner };
        }
      }
      logger.info(`User joining to queue`, { user: userId, passcode });

      if (!user) {
        user = {
          id: userId,
          spotifyUserId: null,
          points: config.gamify.initialPoints,
          accessToken: null,
          refreshToken: null,
          expiresIn: null,
          accessTokenAcquired: null,
          username: userId,
          karma: 0
        };
        await db.query("INSERT INTO users (id, username) VALUES ($1, $2)", [user.id, user.username]);
      }

      return await QueueService.addUserToQueue(user, queue, users);
    } catch (err) {
      throw { status: err.status || 500, message: err.message };
    }
  }

  public static async leave(passcode: string, userId: string) {
    await db.query("DELETE FROM user_queues WHERE passcode =$1 AND user_id = $2", [passcode, userId]);
    const userQueues = await QueueService.getUserQueues(passcode, userId);
    const owned = userQueues.find(q => q.owner === userId);
    return owned
      ? { passcode: owned.passcode, isOwner: true }
      : userQueues.length > 0
        ? { passcode: userQueues[0].passcode, isOwner: false }
        : null;
  }

  public static async remove(passcode: string, userId: string) {
    await db.query("DELETE FROM user_queues WHERE passcode =$1 AND user_id = $2", [passcode, userId]);
    await db.query("DELETE FROM tracks WHERE passcode = $1", [passcode]);
    await db.query("DELETE FROM track_votes WHERE passcode = $1", [passcode]);
    await db.query("DELETE FROM history WHERE passcode = $1", [passcode]);
    await db.query("DELETE FROM settings WHERE passcode = $1", [passcode]);
    await db.query("DELETE FROM queue WHERE id = $1", [passcode]);
    const userQueues = await QueueService.getUserQueues(passcode, userId);
    const owned = userQueues.find(q => q.owner === userId);
    return owned
      ? { passcode: owned.passcode, isOwner: true }
      : userQueues.length > 0
        ? { passcode: userQueues[0].passcode, isOwner: false }
        : null;
  }

  public static async addUserToQueue(user: User, queue: Queue, users: User[]) {
    if (!users.find(u => user.id === u.id)) {
      logger.info(`User not yet part of queue...adding`, { user: user.id, passcode: queue.passcode });

      try {
        const query = "INSERT INTO user_queues (id, user_id, passcode, points) VALUES (default, $1, $2, $3) ON CONFLICT (user_id, passcode) DO NOTHING";
        await db.query(query, [user.id, queue.passcode, config.gamify.initialPoints]);
        return false;
      } catch (err) {
        logger.error("Error when inserting user into queue", { user: user.id, passcode: queue.passcode });
        logger.error(err, { user: user.id, passcode: queue.passcode });
        throw { status: 400, message: "Error while adding user into database. Please try again later." };
      }
    } else {
      logger.info(`User already part of ${queue.passcode}...authorize`, { user: user.id, passcode: queue.passcode });
      return (queue.owner === user.id);
    }
  }

  public static async logout(passcode: string, userId: string) {
    // Needed if user removes her last queue and logout happens.
    if (!passcode || passcode === "") {
      return;
    }
    try {
      const queue = await QueueService.getQueue(passcode);
      // Inactivate queue if logged out user is the owner
      if (userId === queue.owner) {
        if (queue.isPlaying) {
          await QueueService.stopPlaying(queue, userId);
        }
        db.query("UPDATE queue SET access_token = null, refresh_token = '', is_playing = false WHERE id = $1", [passcode]);
      }
      db.query("UPDATE users SET access_token = null, refresh_token = null, expires_in = null, access_token_acquired = null WHERE id = $1", [userId]);
      return;
    } catch (err) {
      throw { status: 500, message: err.message };
    }
  }

  public static async activateQueue(queue: Queue) {
    const query = "UPDATE queue SET access_token = $1, refresh_token = $2, access_token_acquired = $3, expires_in = $4 WHERE id = $5";
    await db.query(query, [queue.accessToken, queue.refreshToken, queue.accessTokenAcquired, queue.expiresIn, queue.passcode]);
  }

  public static async updateUserCredentials(user: User) {
    const query = "UPDATE users SET access_token = $1, refresh_token = $2, access_token_acquired = $3, expires_in = $4 WHERE id = $5";
    await db.query(query, [user.accessToken, user.refreshToken, user.accessTokenAcquired, user.expiresIn, user.id]);
  }

  public static mapTrack(trackDao: TrackDao, isFavorite: boolean): CurrentTrack {
    return {
      id: trackDao.id,
      userId: trackDao.user_id,
      track: { ...trackDao.data, isFavorite },
      trackUri: trackDao.data.id,
      protected: trackDao.protected,
      source: trackDao.source,
      currentlyPlaying: trackDao.currently_playing,
      progress: trackDao.progress,
      timestamp: trackDao.timestamp,
      votes: [],
      playlistTrack: trackDao.playlist_track,
    };
  }

  public static mapTrackVote(voteDao: VoteDao): Vote {
    return {
      userId: voteDao.user_id,
      value: voteDao.value,
    };
  }

  public static async getTop(passcode: string, userId: string): Promise<SpotifyTrack[]> {
    try {
      logger.info(`Getting top songs...`, { passcode, user: userId });
      const tracks = await db.query("SELECT * FROM history WHERE passcode = $1 AND votes >= 0 ORDER BY votes DESC, times_played DESC LIMIT 100", [passcode]);
      if (tracks.rowCount > 0) {
        const top: SpotifyTrack[] = tracks.rows.map(t => ({ ...t.data, votes: t.votes }));
        return await QueueService.markFavorites(passcode, userId, top);
      }
      return [];
    } catch (err) {
      throw { status: 500, message: err };
    }
  }

  public static async getFavorites(userId: string): Promise<SpotifyTrack[]> {
    try {
      const tracks = await db.query("SELECT * FROM favorites WHERE user_id = $1", [userId]);
      if (tracks.rowCount > 0) {
        const spotifyTracks = tracks.rows.map(t => QueueService.mapTrack(t, true));
        return spotifyTracks.map(t => ({ ...t.track, isFavorite: true }));
      }
      return [];
    } catch (err) {
      throw { status: 500, message: err };
    }
  }

  public static async markFavorites(passcode: string, userId: string, tracks: SpotifyTrack[]): Promise<SpotifyTrack[]> {
    return Promise.all(
      tracks.map(async (t) => {
        const isFavorite = await QueueService.isFavorite(passcode, userId, t.id);
        return { ...t, isFavorite }
      })
    );
  }
  public static async isFavorite(passcode: string, userId: string | undefined, trackId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }
    const favorites = await QueueService.getFavorites(userId);
    return favorites.some(f => f.id === trackId);
  }

  public static async addToFavorites(passcode: string, userId: string, trackUri: string, source: string) {
    let track: SpotifyTrack;
    if (source === "spotify") {
      const queue = await QueueService.getQueue(passcode);
      track = await SpotifyService.getTrack(queue.accessToken!, trackUri);
    } else if (source === "youtube") {
      const tracks = await YoutubeService.getTracks(trackUri);
      track = tracks[0]!;
    } else {
      throw { status: 400, message: "Cannot queue because of invalid source. Must be either spotify or youtube." };
    }

    track.isFavorite = true;

    const query = `
      INSERT INTO 
        favorites (
          user_id, track_uri, data, source
        ) 
      VALUES (
        $1, $2, $3, $4
      )
      ON CONFLICT DO NOTHING`;
    await db.query(query, [userId, trackUri, track, source]);
  }

  public static async removeFromFavorites(userId: string, trackUri: string) {
    await db.query("DELETE FROM favorites WHERE user_id = $1 AND track_uri = $2", [userId, trackUri]);
  }

  public static getAllPerks(): Perk[] {
    return [
      { name: "move_up", price: 50, requiredKarma: 50, level: 0, maxLevel: 2, karmaAllowedLevel: 0, cooldown: 0 },
      { name: "queue_more_1", price: 100, requiredKarma: 100, level: 0, maxLevel: 5, karmaAllowedLevel: 0, cooldown: 0 },
      { name: "queue_sequential_1", price: 150, requiredKarma: 150, level: 0, maxLevel: 3, karmaAllowedLevel: 0, cooldown: 0 },
      { name: "protect_song", price: 150, requiredKarma: 150, level: 0, maxLevel: 1, karmaAllowedLevel: 0, cooldown: 0 },
      { name: "remove_song", price: 200, requiredKarma: 200, level: 0, maxLevel: 2, karmaAllowedLevel: 0, cooldown: 0 },
      { name: "skip_song", price: 200, requiredKarma: 200, level: 0, maxLevel: 2, karmaAllowedLevel: 0, cooldown: 0 },
      { name: "move_first", price: 300, requiredKarma: 300, level: 0, maxLevel: 4, karmaAllowedLevel: 0, cooldown: 45 },
    ];
  }

  public static async getAllPerksWithUserLevel(passcode: string, userId: string): Promise<Perk[]> {
    const all = QueueService.getAllPerks();
    const userPerks = await QueueService.getUserPerks(passcode, userId);
    const user = await QueueService.getUser(passcode, userId);
    const settings = await QueueService.getSettings(passcode);
    return all.map(p => {
      const userPerk = userPerks.find(up => up.name === p.name);
      const userLevel = settings.usePerkShop
        ? userPerk ? userPerk.level : 0
        : 1;
      const karmaAllowedLevel = settings.usePerkShop
        ? Math.min(Math.floor(user.karma / p.requiredKarma), userLevel)
        : 1;
      return { 
        ...p,
        level: userLevel,
        upgradeKarma: p.requiredKarma * (userLevel + 1),
        price: p.price * (userLevel + 1),
        karmaAllowedLevel,
        lastUsed: userPerk ? userPerk.lastUsed : undefined,
        cooldownLeft: userPerk ? QueueService.perkCooldownLeft(userPerk, karmaAllowedLevel) : undefined,
      };
    });
  }

  public static perkCooldownLeft(perk: Perk, level: number) {
    if (!perk.lastUsed) {
      return 100000;
    }
    const now = new Date();
    const diff = Math.abs(now.getTime() - perk.lastUsed.getTime());
    const minutesSinceLastUsage = Math.floor((diff / 1000) / 60);
    const COOLDOWN = perk.cooldown - (level * 5);
    return Math.max(0, COOLDOWN - minutesSinceLastUsage);
  }

  public static async updatePerkUsedTime(passcode: string, userId: string, name: PerkName) {
    const query = "UPDATE user_perks SET last_used = $1 WHERE perk = $2 AND user_id = $3 AND passcode = $4";
    await db.query(query, [new Date().toISOString(), name, userId, passcode]);
  }

  public static getPerk(name: PerkName) {
    return QueueService.getAllPerks().find(perk => perk.name === name);
  }

  public static async getUserPerks(passcode: string, userId: string): Promise<Perk[]> {
    const query = "SELECT * FROM user_perks WHERE user_id = $1 AND passcode = $2";
    const userPerkRows = await db.query(query, [userId, passcode]);
    if (userPerkRows.rowCount > 0) {
      return userPerkRows.rows.map(userPerk => ({
        ...QueueService.getPerk(userPerk.perk) as Perk,
        level: userPerk.level,
        lastUsed: new Date(Date.parse(userPerk.last_used)) 
      }));
    }
    return [];
  }

  public static async buyPerk(passcode: string, userId: string, perkName: PerkName) {
    const user = await QueueService.getUser(passcode, userId);
    const perk = QueueService.getPerk(perkName);
    logger.info(`Buying ${perkName}...`, { passcode, user: userId });

    if (!perk) {
      throw { status: 400, message: "Given perk not found" };
    }

    if (user.points >= perk.price) {
      QueueService.addPoints(passcode, userId, -perk.price);
      logger.info(`Adding ${perkName} for user...`, { passcode, user: userId });
      const query = "INSERT INTO user_perks (perk, user_id, passcode, level) VALUES ($1, $2, $3, $4)";
      await db.query(query, [perk.name, userId, passcode, 1]);
    } else {
      throw { status: 403, message: "Not enough points to buy this perk" }
    }
  }

  public static async upgradePerk(passcode: string, userId: string, perkName: PerkName) {
    const user = await QueueService.getUser(passcode, userId);
    const perks = await QueueService.getAllPerksWithUserLevel(passcode, userId);
    logger.info(`Trying to upgrade ${perkName}...`, { passcode, user: userId });

    const perk = perks.find(p => p.name === perkName);
    if (!perk) {
      throw { status: 400, message: "Given perk not found" };
    }

    if (user.points >= perk.price) {
      QueueService.addPoints(passcode, userId, -perk.price);
      logger.info(`Upgrading ${perkName} for user...`, { passcode, user: userId });
      const query = "UPDATE user_perks SET level = $1 WHERE passcode = $2 AND user_id = $3 AND perk = $4";
      await db.query(query, [perk.level + 1, passcode, userId, perk.name]);
    } else {
      throw { status: 403, message: "Not enough points to upgrade this perk" }
    }
  }

  public static async removeFromQueue(passcode: string, userId: string, trackId: string) {
    try {
      const queue = await QueueService.getQueue(passcode);
      if (!queue.isPlaying) {
        throw { status: 403, message: "Can't remove when the queue is not playing." };
      }
      const query = "DELETE FROM tracks WHERE id = $1 AND currently_playing = false RETURNING id";
      const deletedRows = await db.query(query, [trackId]);

      if (deletedRows.rowCount === 0) {
        throw { status: 404, message: "Cannot remove selected song. Only own queued songs can be removed." };
      }
    } catch (err) {
      logger.error(err, { user: userId, passcode });
      throw { status: err.status || 500, message: err.message };
    }
  }

  public static async skip(passcode: string, userId: string, trackId: string) {
    try {
      const queue = await QueueService.getQueue(passcode);
      if (!queue.isPlaying) {
        throw { status: 403, message: "Can't skip when the queue is not playing." };
      }
      const currentTrack = await QueueService.getCurrentTrack(passcode, userId);

      if (currentTrack &&
        queue.accessToken &&
        currentTrack.id === trackId &&
        (
          (currentTrack.playlistTrack && queue.owner === userId) ||
          currentTrack.userId === userId
        )) {
        QueueService.startNextTrack(passcode, userId, currentTrack);
        return;
      } else {
        throw { status: 404, message: "Cannot skip current song. Only own songs can be skipped." };
      }
    } catch (err) {
      logger.error(err, { user: userId, passcode });
      throw { status: err.status || 500, message: err.message };
    }
  }

  public static async addToPlaylistQueue(user: string, passcode: string, tracks: SpotifyTrack[], playlistId: string) {
    try {
      const queue = await QueueService.getQueue(passcode);
      logger.info(`Adding ${tracks.length} tracks to playlist queue...`, { user, passcode });
      const trackQueries = tracks.map(track => {
        const item: QueueItem = {
          id: uuid(),
          userId: "",
          track,
          trackUri: track.id,
          protected: false,
          source: "spotify",
          currentlyPlaying: false,
          timestamp: Date.now(),
          playlistTrack: true,
        };
        return `(
          '${passcode}', '${item.id}', '${item.userId}', '${JSON.stringify(track).replace(/'/g, "''")}'::json, '${item.trackUri}',
          ${item.protected}, '${item.source}', ${item.currentlyPlaying}, ${item.timestamp}, ${item.playlistTrack}
        )`;
      });
      await db.query("DELETE FROM tracks WHERE passcode = $1 AND currently_playing = false AND playlist_track = true", [passcode]);
      const query = `INSERT INTO tracks (passcode, id, user_id, data, track_uri, protected, source, currently_playing, timestamp, playlist_track) VALUES ${trackQueries.join(",")}`;
      await db.query(query);
      await db.query("UPDATE settings SET playlist = $1 WHERE passcode = $2", [playlistId, passcode]);
      logger.debug(`Tracks added to playlist queue successfully`, { user, passcode });
      return queue;
    } catch (err) {
      logger.error(err, { user, passcode });
      throw { status: 500, message: err.message };
    }
  }

  public static async addFavoritesToPlaylistQueue(userId: string, passcode: string) {
    const favorites = await QueueService.getFavorites(userId);
    await QueueService.addToPlaylistQueue(userId, passcode, favorites, "favorites");
  }

  public static async exportFavoritesToSpotify(passcode: string, userId: string) {
    const user = await QueueService.getUser(passcode, userId);
    if (!user.accessToken || !user.spotifyUserId) {
      throw { status: 401, message: "Login with spotify to export favorites"};
    }

    const playlists = await SpotifyService.getPlaylists(user.accessToken, userId, passcode);
    const favoritesPlaylist = playlists.find((p: any) => p.name === SpotifyService.favoritesName);
    let favoritesId = favoritesPlaylist ? favoritesPlaylist.id : null;
    if (!favoritesId) {
      try {
        const createResponse = await SpotifyService.createFavoritesPlaylist(user.accessToken, user.spotifyUserId);
        favoritesId = createResponse.data.id;
      } catch (err) {
        logger.error("Unable to create favorites playlist", { passcode, user: userId });
        logger.error(err.response.data);
        throw { status: err.response.status, message: "Unable to create favorites playlist" };
      }
    }

    const favorites = await QueueService.getFavorites(userId);
    const trackIds = favorites.map(f => f.id);
    await SpotifyService.updateFavoriteTracks(user.accessToken, favoritesId, trackIds);
  }

  public static async addToQueue(userId: string, passcode: string, trackUri: string, source: string): Promise<FullQueue> {
    try {
      const queue = await QueueService.getFullQueue(passcode, userId);
      const perks = await QueueService.getAllPerksWithUserLevel(passcode, userId);
      const queuePerkLevel = Gamify.userPerkLevel("queue_more_1", perks);
      const sequentialPerkLevel = Gamify.userPerkLevel("queue_sequential_1", perks);

      const settings = queue.settings;
      if (settings.maxDuplicateTracks) {
        const duplicateCountQuery = "SELECT COUNT(*) as count FROM tracks WHERE currently_playing = false AND playlist_track = false AND track_uri = $1 AND passcode = $2";
        const duplicateCountResult = await db.query(duplicateCountQuery, [trackUri, passcode]);
        const duplicateCount = duplicateCountResult.rowCount === 1 ? duplicateCountResult.rows[0].count : 0;
        logger.info(`${duplicateCount}/${settings.maxDuplicateTracks} duplicate songs in queue...`, { passcode, user: userId });
        if (duplicateCount >= settings.maxDuplicateTracks) {
          throw {
            status: 403,
            message: `Queuing failed. Max duplicate song count is set to ${settings.maxDuplicateTracks}.`
          };
        }
      }

      const tracks = queue.tracks;
      // If total number of tracks per user is restricted. Start from 1 if current song is this user's.
      const startFrom = queue.currentTrack && queue.currentTrack.userId === userId ? 1 : 0;
      const userAddedTracks = tracks.reduce((sum, track) => track.userId === userId ? sum + 1 : sum, startFrom);
      if (settings.numberOfTracksPerUser + queuePerkLevel <= userAddedTracks) {
        throw {
          status: 403,
          message: `Queuing failed. Max queued songs per user is set to ${settings.numberOfTracksPerUser}.`
        };
      }

      let sequentialCount = 0;
      for (let i = tracks.length - 1; i >= 0; i--) {
        if (tracks[i].userId === userId) {
          sequentialCount++;
        } else {
          break;
        }
      }
      logger.info(`${sequentialCount}/${settings.maxSequentialTracks} sequential songs for user...`, { passcode, user: userId });
      if (sequentialCount >= settings.maxSequentialTracks + sequentialPerkLevel) {
        throw {
          status: 403,
          message: `Queuing failed. Max sequential songs per user is set to ${settings.maxSequentialTracks}.`
        };
      }

      // If track is banned due too many downvotes
      const trackVotesResult = await db.query("SELECT votes FROM history WHERE track_uri = $1", [trackUri]);
      if (trackVotesResult.rowCount > 0 && -settings.banVoteCount >= trackVotesResult.rows[0].votes) {
        throw {
          status: 403,
          message: `Queuing failed. Song is banned due to too many (${trackVotesResult.rows[0].votes}) downvotes.`
        };
      }

      logger.info(`Getting track info for ${trackUri}`, { user: userId, passcode });
      let track: SpotifyTrack;
      if (source === "spotify") {
        track = await SpotifyService.getTrack(queue.accessToken!, trackUri);
      } else if (source === "youtube") {
        const tracks = await YoutubeService.getTracks(trackUri);
        track = tracks[0]!;
      } else {
        throw { status: 400, message: "Cannot queue because of invalid source. Must be either spotify or youtube." };
      }

      const item: QueueItem = {
        track,
        source,
        userId: userId,
        protected: false,
        currentlyPlaying: false,
        id: uuid(),
        timestamp: Date.now(),
        trackUri: track.id,
        playlistTrack: false,
      };

      logger.info(`Found track ${track.id}... pushing to queue...`, { user: userId, passcode });
      const query = `
        INSERT INTO 
          tracks (
            passcode, id, user_id, data, track_uri, protected, source, currently_playing, timestamp
          ) 
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )`;
      await db.query(query, [passcode, item.id, item.userId, item.track, item.trackUri, item.protected, item.source, item.currentlyPlaying, item.timestamp]);
      tracks.push(item);
      logger.debug(`Track ${track.id} queued successfully`, { user: userId, passcode });
      return queue;
    } catch (err) {
      throw { status: 500, message: err.message };
    }
  }

  public static async getAccessToken(id: string) {
    try {
      const queue = await QueueService.getQueue(id);
      return queue.accessToken!;
    } catch (err) {
      throw { status: 500, message: err };
    }
  }

  public static async setDevice(passcode: string, user: string, deviceId: string) {
    try {
      await db.query("UPDATE queue SET device_id = $1 WHERE id = $2", [deviceId, passcode]);
    } catch (err) {
      throw { status: 500, message: err };
    }
  }

  public static async startPlaying(accessToken: string,
    passcode: string,
    userId: string,
    currentTrack: CurrentTrack) {
    if (QueueService.timeouts[accessToken]) {
      clearTimeout(QueueService.timeouts[accessToken]);
    }

    const timeLeft = currentTrack.track.duration - currentTrack.progress;
    await db.query("UPDATE queue SET is_playing = true WHERE id = $1", [passcode]);
    await db.query("UPDATE tracks SET currently_playing = true WHERE passcode = $1 AND id = $2", [passcode, currentTrack.id]);

    logger.info(`Starting ${Math.round(timeLeft / 1000)} second timer for ${currentTrack.id}...`, { user: userId, passcode });
    const queue = await QueueService.getQueue(passcode);
    QueueService.timeouts[accessToken] = setTimeout(() =>
      QueueService.checkTrackStatus(queue.passcode, queue.owner),
      timeLeft - 1000
    );
  }

  public static async stopPlaying(queue: Queue, userId: string) {
    if (QueueService.timeouts[queue.accessToken!]) {
      clearInterval(QueueService.timeouts[queue.accessToken!]);
      delete QueueService.timeouts[queue.accessToken!];
    }

    const updateToDb = async () => {
      try {
        await db.query("UPDATE queue SET is_playing = false WHERE id = $1", [queue.passcode]);
        logger.info(`Successfully stopped playing...`, { user: userId, passcode: queue.passcode });
        return true;
      } catch(err) {
        logger.error(`Unable to update playback state`, { user: userId, passcode: queue.passcode });
        logger.error(err, { passcode: queue.passcode });
        return false;
      }
    };

    try {
      await SpotifyService.pause(queue.accessToken!);
      return updateToDb();
    } catch(err) {
      if (err.response) {
        if (err.response.status === 403 && err.response.data.error.message.indexOf("Already paused") >= 0) {
          return updateToDb();
        }
        logger.error(err.response.data.error.message, { user: userId, passcode: queue.passcode });
      } else {
        logger.error(err);
      }
    }

    return false;
  }

  public static async startOngoingTimers() {
    try {
      const res = await db.query("SELECT * FROM queue WHERE is_playing = true", []);
      if (res.rowCount === 0) {
        return;
      }
      const queues = res.rows.map(q => QueueService.mapQueue(q));
      queues.forEach((queue: Queue) => {
        if (queue.accessToken) {
          QueueService.checkTrackStatus(queue.passcode, queue.owner);
        }
      });
    } catch(err) {
      logger.error(err);
    }
  }

  public static async pauseResume(user: string, passcode: string) {
    try {
      const queue = await QueueService.getQueue(passcode);
      if (queue.isPlaying) {
        logger.debug(`Pausing playback...`, { user, passcode });
        const stopped = await QueueService.stopPlaying(queue, user);
        return !stopped;
      } else {
        logger.debug(`Resuming playback...`, { user, passcode });
        if (!queue.deviceId) {
          throw { status: 400, message: "No playback device selected. Please start Spotify and try again." };
        }

        const tracks = await QueueService.getTracks(passcode, user, false);
        const currentTrack = await QueueService.getCurrentTrack(passcode, user);
        if (currentTrack) {
          try {
            await SpotifyService.resume(queue.accessToken!, [currentTrack.track.id], currentTrack.progress, queue.deviceId!);
            QueueService.startPlaying(queue.accessToken!, passcode, user, currentTrack);
          } catch(err) {
            if (err.response) {
              if (err.response.data.error.status === 404) {
                logger.info("No device selected when trying to resume.", { user, passcode });
                throw { status: 404, message: "No device selected. Please select a device from bottom left corner." };
              } else if (err.response.status === 403 && err.response.data.error.message.indexOf("Not paused") >= 0) {
                QueueService.startPlaying(queue.accessToken!, passcode, user, currentTrack);
                return true;
              } else {
                logger.error(err.response.data.error.message, { user, passcode });
              }
            } else {
              logger.error(err);
            }
            throw { status: 500, message: "Unable to resume playback. Please try again later." };
          }
        } else if (tracks.length > 0) {
          QueueService.startNextTrack(passcode, user, currentTrack);
        } else {
          logger.info(`Current track not found and queue empty. Unable to resume.`, { user, passcode });
          throw { status: 500, message: "Spotify didn't start playing. Please try again later." };
        }
      }
      return true;
    } catch(err) {
      throw { status: 500, message: err.message };
    }
  }

  public static async updateUser(userId: string, username: string, passcode: string) {
    if (!username || username.length > 50) {
      throw { status: 400, message: "Invalid username." };
    }

    const userResult = await db.query("UPDATE users SET username = $1 WHERE id = $2 RETURNING *", [username, userId]);
    if (userResult.rowCount === 1) {
      return QueueService.getUser(passcode, userId);
    }
    throw { status: 404, message: "User not found" };
  }

  public static async updateSettings(passcode: string, user: string, settings: Settings, updatedFields?: string[]) {
    try {
      if (!settings.name || settings.name.length > 50) {
        throw { status: 400, message: "Invalid queue name." };
      }
      const updateQuery = `
      UPDATE 
        settings 
      SET
        name = $1,
        gamify = $2,
        max_duplicate_tracks = $3,
        number_of_tracks_per_user = $4,
        random_playlist = $5,
        random_queue = $6,
        skip_threshold = $7,
        max_sequential_tracks = $8,
        spotify_login = $9,
        ban_vote_count = $10,
        use_perk_shop = $11
      WHERE passcode = $12`;
      db.query(updateQuery, [
        settings.name, settings.gamify, settings.maxDuplicateTracks, 
        settings.numberOfTracksPerUser, settings.randomPlaylist, settings.randomQueue, 
        settings.skipThreshold, settings.maxSequentialTracks, settings.spotifyLogin,
        settings.banVoteCount, settings.usePerkShop,
        passcode,
      ]);
      return settings;
    } catch (err) {
      if (err.message) {
        throw { status: err.status, message: err.message };
      }
      logger.error(err, { user, passcode });
      throw { status: 500, message: "Unexpected error occurred while saving the settings." };
    }
  }

  public static async startNextTrack(passcode: string, user: string, endedTrack?: CurrentTrack | null) {
    logger.info(`Starting next track`, { user, passcode });
    try {
      const queue = await QueueService.getFullQueue(passcode, user);
      // Save history data
      if (endedTrack) {
        if (endedTrack.userId) {
          const votes = endedTrack.votes.reduce((sum, v) => sum + v.value, 0);
          await Gamify.trackEndReward(queue, passcode, votes);

          const insertHistoryQuery = `
          INSERT INTO 
            history (passcode, track_uri, data, source, votes) 
          VALUES ($1, $2, $3, $4, $5) 
          ON CONFLICT (passcode, track_uri) 
          DO UPDATE SET votes = history.votes + EXCLUDED.votes, times_played = history.times_played + 1`;
          await db.query(insertHistoryQuery, [passcode, endedTrack.trackUri, endedTrack.track, endedTrack.source, votes]);
        }
        db.query("DELETE FROM track_votes WHERE passcode = $1 AND track_id = $2", [passcode, endedTrack.id]);
      }

      // Delete finished track
      await db.query("DELETE FROM tracks WHERE currently_playing = true AND passcode = $1", [passcode]);
      if (queue.tracks.length === 0 && queue.playlistTracks.length === 0) {
        logger.info("No more songs in queue. Stop playing.", { user, passcode });
        await QueueService.stopPlaying(queue, user);
        await db.query("UPDATE settings SET playlist = null WHERE passcode = $1", [passcode]);
        return;
      }
      const nextIndex = (queue.tracks.length > 0) ?
        QueueService.getNextTrackIdx(queue.tracks, queue.settings.randomQueue) :
        QueueService.getNextTrackIdx(queue.playlistTracks, queue.settings.randomPlaylist);
      const queuedItem = (queue.tracks.length > 0) ?
        queue.tracks.splice(nextIndex, 1)[0] :
        queue.playlistTracks.splice(nextIndex, 1)[0];

      logger.info(`Next track is ${queuedItem.track.id}`, { user, passcode });
      if (queuedItem.source === "spotify") {
        try {
          SpotifyService.startSong(queue.accessToken!, [queuedItem.track.id], queue.deviceId!);
          await QueueService.startPlaying(queue.accessToken!, passcode, user, { ...queuedItem, progress: 0, currentlyPlaying: false, votes: [] });
          logger.info(`Track ${queuedItem.track.id} successfully started.`, { user, passcode });
        } catch(err) {
          logger.error(err.response.data.error.message, { user, passcode });
          logger.error(`Unable to start track on Spotify.`, { user, passcode });
        }
      } else {
        logger.info(`YouTube track ${queuedItem.track.id} started. Client will trigger the next song.`, { user, passcode });
        await QueueService.startPlaying(queue.accessToken!, passcode, user, { ...queuedItem, progress: 0, currentlyPlaying: false, votes: [] });
      }
    } catch (err) {
      logger.error("Error occurred while starting next track", { user, passcode });
      logger.error(err);
    }
  }

  private static getNextTrackIdx(queue: QueueItem[], random: boolean) {
    if (random) {
      return (Math.random() * queue.length);
    } else {
      return 0;
    }
  }

  private static async checkTrackStatus(passcode: string, userId: string) {
    logger.info(`Checking playback state for currently playing track...`, { user: userId, passcode });
    try {
      const currentState = await QueueService.getCurrentState(passcode, userId);
      if (!currentState.isSpotiquPlaying) {
        logger.info(`We are paused so no need to do it...`, { user: userId, passcode });
        return;
      }

      const timeLeft = currentState.currentTrack ?
        currentState.currentTrack.track.duration - currentState.currentTrack.track.progress : 0;

      // We can start next if spotify isn't playing anymore
      if (!currentState.isSpotifyPlaying && currentState.isSpotiquPlaying) {
        logger.info(`Track was already over...starting next`, { user: userId, passcode });
        QueueService.startNextTrack(passcode, "-", currentState.currentTrack);
      } else if (timeLeft < 5000) {
        logger.info(`Less than 5 secs left...initiating timer to start the next song...`, { user: userId, passcode });
        // Start new song after timeLeft and check for that song's duration
        setTimeout(() => QueueService.startNextTrack(passcode, "-", currentState.currentTrack), timeLeft - 1000);
      } else {
        // If there's still time, check for progress again after a while
        const seconds = Math.round(timeLeft / 1000);
        logger.info(
          `Track ${currentState.currentTrack!.track.id} still playing for ${seconds} secs. Checking again after that.`,
          { user: userId, passcode });

        if (QueueService.timeouts[currentState.accessToken!]) {
          clearTimeout(QueueService.timeouts[currentState.accessToken!]);
        }
        QueueService.timeouts[currentState.accessToken!] = setTimeout(() =>
          QueueService.checkTrackStatus(passcode, "-"),
          timeLeft - 1000
        );
      }
    } catch (err) {
      if (err.status === 404) {
        logger.info(err.message, { user: userId, passcode });
      } else {
        logger.error("Unable to get currently playing track from spotify.", { user: userId, passcode });
        logger.error(err, { user: userId, passcode });
      }
    }
  }

  public static async getCurrentState(passcode: string, userId: string) {
    try {
      const queue = await QueueService.getQueue(passcode);
      // Check that access token is still valid.
      // This function is called from playback loop so we need this to be here
      await Acl.isAuthorized(passcode, queue.owner);

      const settings = await QueueService.getSettings(passcode);
      const currentTrack = await QueueService.getCurrentTrack(passcode, userId);
      if (currentTrack) {
        currentTrack.votes = await QueueService.getTrackVotes(passcode, currentTrack.id);
      }

      const currentState: CurrentState = {
        accessToken: queue.accessToken,
        currentTrack,
        isSpotiquPlaying: queue.isPlaying,
        isSpotifyPlaying: queue.isPlaying,
        playlistId: settings.playlist,
        deviceId: queue.deviceId
      };
      // Get response if Spotify is playing
      try {
        const spotifyCurrentTrack = await SpotifyService.currentlyPlaying(queue.accessToken!, userId, passcode);

        // Go with spotify's data if our current track equals to spotify's current track
        const spotiquCurrenTrack = currentTrack;
        if (spotifyCurrentTrack.item && spotiquCurrenTrack && spotifyCurrentTrack.item.id === spotiquCurrenTrack.track.id) {
          db.query("UPDATE queue SET device_id = $1 WHERE id = $2", [spotifyCurrentTrack.device.id, passcode]);
          db.query("UPDATE tracks SET progress = $1 WHERE id = $2", [spotifyCurrentTrack.item.progress, spotiquCurrenTrack.id]);
          queue.deviceId = spotifyCurrentTrack.device.id;
          currentTrack!.track.progress = spotifyCurrentTrack.item.progress;
        }

        currentState.isSpotifyPlaying = spotifyCurrentTrack.is_playing;

        if (spotifyCurrentTrack.item) {
          logger.debug(
            `Spotify state ${spotifyCurrentTrack.item.id}. ` +
            `isPlaying: ${spotifyCurrentTrack.is_playing}, ` +
            `progress: ${spotifyCurrentTrack.progress_ms}ms`, { user: userId, passcode });
        } else {
          logger.debug(
            `Spotify has no current track. ` +
            `isPlaying: ${spotifyCurrentTrack.is_playing}, ` +
            `progress: ${spotifyCurrentTrack.progress_ms}ms`, { user: userId, passcode });
        }

        if (spotiquCurrenTrack) {
          logger.debug(
            `Spotiqu state ${spotiquCurrenTrack.track.id}. ` +
            `isPlaying: ${queue.isPlaying}, ` +
            `progress: ${spotiquCurrenTrack.track.progress}ms`, { user: userId, passcode });
        } else {
          logger.debug(
            `Spotiqu has no current track. ` +
            `isPlaying: ${queue.isPlaying}.`, { user: userId, passcode });
        }
        return currentState;
      } catch (err) {
        if (err.status === 404) {
          throw { status: 204, message: "" }
        }
        logger.warn(err);
        logger.warn("Unable to get track progress from Spotify...mobile device?", { user: userId, passcode });
        // If we think we are playing, just start playing
        if (queue.isPlaying && queue.deviceId) {
          SpotifyService.setDevice(queue.accessToken!, queue.isPlaying, queue.deviceId).catch(err => {
            logger.error("Unable to select device...", { user: userId, passcode });
            logger.error(err.response.data.error.message, { user: userId, passcode });
            throw { status: 204, message: "" }
          });
        } else {
          logger.warn("Stop playback timer if we ever get here...Strange state we have.", { user: userId, passcode });
          QueueService.stopPlaying(queue, userId);
          throw { status: 204, message: "" }
        }

        currentState.isSpotifyPlaying = false;
        return currentState;
      }
    } catch (err) {
      logger.error(err, { userId, passcode });
      throw { status: err.status || 500, message: "Failed to get currently playing track." };
    }
  }
}

export default QueueService;
