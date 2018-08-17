const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const host = process.env.NODE_ENV === "production" ? "backend.spotiqu.eu" : "spotique.fi";
const port = process.env.NODE_ENV === "production" ? "" : ":8001";

const config = {
    backend: {
        url: protocol + "://" + host + port
    },
    hostname: protocol + "://" + host + "/"
};

export default config;
