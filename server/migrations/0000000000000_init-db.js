exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable(
        "queues", {
            id: { type: "character(8)", notNull: true, primaryKey: true },
            owner: { type: "varchar(100)", notNull: true },
            data: { type: "json", notNull: true }
        }
    );
    pgm.createIndex("queues", "owner");
};
