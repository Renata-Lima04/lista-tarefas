import pg from "pg";

const { Pool } = pg;

// Render/Neon usa DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error("❌ Variável DATABASE_URL não encontrada.");
  console.error("No Render: Settings > Environment > adicione DATABASE_URL.");
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Neon geralmente precisa SSL
});

export async function initDb() {
  // cria a tabela no Postgres (Neon) se não existir
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tarefas (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      custo NUMERIC(12,2) NOT NULL CHECK (custo >= 0),
      data_limite DATE NOT NULL,
      ordem INTEGER NOT NULL UNIQUE
    );
  `);
}
