exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("user_perks", {
    last_used: { type: "timestamp", notNull: false },
  });
};
