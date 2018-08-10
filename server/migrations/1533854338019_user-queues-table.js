exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable(
        "user_queues", {
            id: "id",
            user_id: { type: "varchar(100)", notNull: true },
            name: { type: "varchar(50)", notNull: true },
            passcode: { type: "character(8)", notNull: true }
        }
    );
    pgm.createIndex("user_queues", "user_id");
    pgm.createIndex("user_queues", ["user_id", "passcode"], { unique: true });
};