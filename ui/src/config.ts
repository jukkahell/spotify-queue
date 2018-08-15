const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const host = process.env.NODE_ENV === "production" ? "backend.spotiqu.eu" : "spotique.fi";
const port = process.env.NODE_ENV === "production" ? "443" : "8001";

const config = {
    backend: {
        url: protocol + "://" + host + ":" + port
    }
};

export default config;
