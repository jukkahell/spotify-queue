exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    "user_perks", {
        passcode: { type: "character(8)", notNull: true, primaryKey: true },
        user_id: { type: "varchar(100)", notNull: true, primaryKey: true },
        perk: { type: "varchar(255)", notNull: true, primaryKey: true },
        level: { type: "integer", notNull: true, default: 1 }
    }
  );
};