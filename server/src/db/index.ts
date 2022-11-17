import { Pool } from "pg";
import secrets from "../secrets";

const pool = new Pool({
  user: "spotiqu",
  host: process.env.NODE_ENV === "production" ? secrets.db.ip : "db",
  database: "spotiqu",
  password: secrets.db.password,
  port: 5432
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
