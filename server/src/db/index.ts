import { Pool } from "pg";
import secrets from "../secrets";

const pool = new Pool({
    user: "spotiqu",
    host: "localhost",
    database: "spotiqu",
    password: secrets.db.password,
    port: 5433,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
