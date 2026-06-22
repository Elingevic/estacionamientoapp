import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST || "172.16.205.47",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "parking",
  user: process.env.DB_USER || "parking",
  password: process.env.DB_PASSWORD, // Dejar que se defina en el servidor/.env.local
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("Executed query", { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
}

export default pool;
