import { env } from "process";
import { CorsOptions } from "../node_modules/@types/cors";

const prod = env.NODE_ENV === "production";
const scheme = prod ? "https://" : "http://";
const host = prod ? "spotiqu.eu" : "spotique.fi";
const port = 8001;
const uiPort = prod ? 80 : 3000;

const whitelist = [scheme + host + ":" + port, scheme + host + ":" + uiPort, scheme + host]

export interface IConfig {
    app: {
        scheme: string;
        host: string;
        port: number;
        cors: CorsOptions;
        logger: {
            level: string;
        }
    },
    userCookieOptions: {
        domain: string;
        expires: Date;
        secure: boolean;
        sameSite: boolean;
        signed: boolean;
    },
    passcodeCookieOptions: {
        domain: string;
        expires: Date;
        secure: boolean;
        sameSite: boolean;
        signed: boolean;
    },
    spotify: {
        clientId: string;
        redirectUri: string;
    }
}

const userCookieExpire: Date = new Date();
userCookieExpire.setTime((new Date()).getTime() + (10*365*24*60*60*1000));
const passcodeCookieExpire: Date = new Date();
passcodeCookieExpire.setTime((new Date()).getTime() + (24*60*60*1000));

const config: IConfig = {
    app: {
        scheme,
        host,
        port,
        cors: {
            origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
                if (!origin || whitelist.indexOf(origin) !== -1) {
                    callback(null, true)
                } else {
                    callback(new Error('Not allowed by CORS'))
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
        expires: userCookieExpire,
        secure: prod ? true : false,
        sameSite: true,
        signed: true
    },
    passcodeCookieOptions: {
        domain: host,
        expires: passcodeCookieExpire,
        secure: prod ? true : false,
        sameSite: true,
        signed: false
    },
    spotify: {
        clientId: "da6ea27d63384e858d12bcce0fac006d",
        redirectUri: scheme + host + ":" + port + "/",
    }
};

export default config;