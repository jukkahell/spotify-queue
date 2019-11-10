exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("tracks", {
    started_time: { type: "string", notNull: false },
  });
};
