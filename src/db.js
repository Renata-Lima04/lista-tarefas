import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// resolve o caminho da raiz do projeto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// volta uma pasta (da src para a raiz)
const dbPath = path.resolve(__dirname, "../tarefas.db");

const db = new Database(dbPath);

// Cria a tabela
db.exec(`
  CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    custo REAL NOT NULL CHECK (custo >= 0),
    data_limite TEXT NOT NULL,
    ordem INTEGER NOT NULL UNIQUE
  );
`);

export default db;
