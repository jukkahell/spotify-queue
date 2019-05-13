exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("settings", {
    use_perk_shop: { type: "boolean", default: false, notNull: true },
  });
};
