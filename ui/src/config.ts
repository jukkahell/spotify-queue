import { env } from "process";

const protocol = env.NODE_ENV === "production" ? "https" : "http";
const host = env.NODE_ENV === "production" ? "spotiqu.eu" : "spotique.fi";

const config = {
    backend: {
        url: protocol + "://" + host + ":8001"
    }
};

export default config;
