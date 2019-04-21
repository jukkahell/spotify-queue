exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropColumns("favorites", ["passcode"]);
};