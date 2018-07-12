exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns("queues", {
      is_playing: { type: "boolean", notNull: true, default: false }
    });
  };