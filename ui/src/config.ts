const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const host = process.env.NODE_ENV === "production" ? "spotiqu.eu" : "spotique.fi";

const config = {
    backend: {
        url: protocol + "://" + host + ":8001"
    }
};

export default config;
