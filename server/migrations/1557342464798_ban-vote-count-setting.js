exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("settings", {
    ban_vote_count: { type: "integer", default: 10, notNull: true },
  });
};
