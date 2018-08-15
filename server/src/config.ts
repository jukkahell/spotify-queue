import { CorsOptions } from "cors";
import { env } from "process";

const prod = env.NODE_ENV === "production";
const scheme = prod ? "https://" : "http://";
const host = prod ? "spotiqu.eu" : "spotique.fi";
const port = 8001;
const redirectUri = prod ? "backend.spotiqu.eu" : host ":" + port;
const uiPort = prod ? 80 : 3000;

const whitelist = [scheme + host + ":" + port, scheme + host + ":" + uiPort, scheme + host];

export interface IConfig {
    app: {
        scheme: string;
        host: string;
        port: number;
        cors: CorsOptions;
        logger: {
            level: string;
        }
    };
    userCookieOptions: {
        domain: string;
        expires: Date | null;
        secure: boolean;
        sameSite: string;
        signed: boolean;
    };
    passcodeCookieOptions: {
        domain: string;
        expires: Date | null;
        secure: boolean;
        sameSite: string;
        signed: boolean;
    };
    spotify: {
        clientId: string;
        redirectUri: string;
    };
    gamify: {
        initialPoints: number;
        skipCost: number;
        moveUpCost: number;
        protectCost: number;
    }
}

export const userCookieExpire = () => {
    const expireDate = new Date();
    expireDate.setTime((new Date()).getTime() + (10 * 365 * 24 * 60 * 60 * 1000));
    return expireDate;
};
export const passcodeCookieExpire = () => {
    const expireDate = new Date();
    expireDate.setTime((new Date()).getTime() + (30 * 24 * 60 * 60 * 1000));
    return expireDate;
};

const config: IConfig = {
    app: {
        scheme,
        host,
        port,
        cors: {
            origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
                if (!origin || whitelist.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by CORS"));
                }
          },
          credentials: true
        },
        logger: {
            level: prod ? "info" : "debug"
        }
    },
    userCookieOptions: {
        domain: host,
        expires: null,
        secure: prod,
        sameSite: "lax",
        signed: true
    },
    passcodeCookieOptions: {
        domain: host,
        expires: null,
        secure: prod,
        sameSite: "lax",
        signed: false
    },
    spotify: {
        clientId: "da6ea27d63384e858d12bcce0fac006d",
        redirectUri: scheme + redirectUri + "/",
    },
    gamify: {
        initialPoints: 10,
        skipCost: 20,
        moveUpCost: 5,
        protectCost: 10
    }
};

export default config;
