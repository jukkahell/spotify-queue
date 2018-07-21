import { format } from "winston";
import * as winston from "winston";
import config from "./config";
const DailyRotateFile = require("winston-daily-rotate-file");

const logFormat = format.printf(info => {
    const p = info.passcode ? info.passcode : "";
    const u = info.user ? info.user : "";
    const i = info.id ? info.id : "";
    const level = info.level.padEnd(15); // 15 because of the color bytes

    let message = info.message;
    if (typeof info.message === "object") {
        console.log(message);
        message = JSON.stringify(message);
    }

    if (p || u) {
        return `${info.timestamp} ${level} - [${p}][${u}] ${message}`;
    } else if (i) {
        return `${info.timestamp} ${level} - [${i}] ${message}`;
    } else {
        return `${info.timestamp} ${level} - ${message}`;
    }
});

export const logger = winston.createLogger({
    level: config.app.logger.level,
    format: format.combine(
        format.colorize(),
        format.timestamp(),
        logFormat
    ),
    transports: [
        new winston.transports.Console(),
        new DailyRotateFile({
            filename: "spotiqu-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            zippedArchive: false,
            maxFiles: "14d"
        })
    ]
});
