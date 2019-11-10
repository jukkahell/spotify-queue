exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("settings", {
    repeat_playlist: { type: "boolean", default: true, notNull: true },
  });
};
