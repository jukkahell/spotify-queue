exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    "favorites", {
        passcode: { type: "character(8)", notNull: true, primaryKey: true },
        user_id: { type: "varchar(100)", notNull: true, primaryKey: true },
        track_uri: { type: "varchar(255)", notNull: true, primaryKey: true },
        data: { type: "json", notNull: true },
        source: { type: "varchar(50)", default: "spotify", notNull: true }
    }
  );

  pgm.createTable(
    "history", {
        passcode: { type: "character(8)", notNull: true, primaryKey: true },
        track_uri: { type: "varchar(255)", notNull: true, primaryKey: true },
        data: { type: "json", notNull: true },
        source: { type: "varchar(50)", default: "spotify", notNull: true },
        times_played: { type: "integer", default: 1, notNull: true },
        votes: { type: "integer", default: 1, notNull: true }
    }
  );
};
