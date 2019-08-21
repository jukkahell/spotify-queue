exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropColumns("user_perks", ["last_used"]);
  pgm.addColumns("user_perks", {
    last_used: { type: "string", notNull: false },
  });
};
