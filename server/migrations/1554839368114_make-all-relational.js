exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    "settings", {
        passcode: { type: "character(8)", notNull: true, primaryKey: true },
        name: { type: "varchar(100)", notNull: true },
        gamify: { type: "boolean", default: false, notNull: true },
        max_duplicate_tracks: { type: "integer", default: 2, notNull: true },
        number_of_tracks_per_user: { type: "integer", default: 5, notNull: true },
        random_playlist: { type: "boolean", default: true, notNull: true },
        random_queue: { type: "boolean", default: false, notNull: true },
        skip_threshold: { type: "integer", default: 4, notNull: true },
        playlist: { type: "varchar(100)", notNull: false },
        max_sequential_tracks: { type: "integer", default: 3, notNull: true },
        spotify_login: { type: "boolean", default: false, notNull: true },
    }
  );
  pgm.createIndex("settings", "passcode");

  pgm.createTable(
    "tracks", {
        id: { type: "uuid", notNull: true, primaryKey: true },
        passcode: { type: "character(8)", notNull: true },
        user_id: { type: "varchar(100)", notNull: true },
        track_uri: { type: "varchar(255)", notNull: true },
        data: { type: "json", notNull: true },
        protected: { type: "boolean", default: false, notNull: true },
        source: { type: "varchar(50)", default: "spotify", notNull: true },
        currently_playing: { type: "boolean", default: false, notNull: true },
        progress: { type: "integer", default: 0, notNull: true },
        playlist_track: { type: "boolean", default: false, notNull: true },
        timestamp: { type: "bigint", notNull: true }
    }
  );
  pgm.createIndex("tracks", "passcode");

  pgm.createTable(
    "track_votes", {
        passcode: { type: "character(8)", notNull: true, primaryKey: true },
        user_id: { type: "varchar(100)", notNull: true, primaryKey: true },
        track_id: { type: "uuid", notNull: true, primaryKey: true },
        value: { type: "integer", notNull: true }
    }
  );

  pgm.createTable(
    "users", {
        id: { type: "varchar(100)", notNull: true, primaryKey: true },
        spotify_user_id: { type: "varchar(255)", notNull: false },
        access_token: { type: "varchar(300)", notNull: false },
        refresh_token: { type: "varchar(300)", notNull: false },
        expires_in: { type: "integer", notNull: false },
        access_token_acquired: { type: "bigint", notNull: false },
        username: { type: "varchar(100)", notNull: true },
    }
  );

  pgm.addColumns("user_queues", {
    points: { type: "integer", notNull: true, default: 10 },
    karma: { type: "integer", notNull: true, default: 0 },
  });
  pgm.dropColumns("user_queues", ["name"]);

  pgm.createTable(
    "queue", {
      id: { type: "character(8)", notNull: true, primaryKey: true },
      owner: { type: "varchar(255)", notNull: true },
      access_token: { type: "varchar(300)", notNull: false },
      access_token_acquired: { type: "bigint", notNull: false },
      refresh_token: { type: "varchar(300)", notNull: false },
      expires_in: { type: "integer", notNull: false },
      device_id: { type: "varchar(255)", notNull: false },
      is_playing: { type: "boolean", default: false, notNull: true },
    }
  );
  pgm.createIndex("queue", "owner");
};