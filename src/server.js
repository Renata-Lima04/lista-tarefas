import express from "express";
import path from "path";
import { pool, initDb } from "./db.js";

const app = express();

app.use(express.json());
app.use(express.static(path.resolve("public")));

// inicializa o banco
await initDb();

// rota teste
app.get("/api/teste", (req, res) => {
  res.json({ mensagem: "Servidor funcionando!" });
});

// listar tarefas
app.get("/api/tarefas", async (req, res) => {
  try {
    const { rows: tarefas } = await pool.query(
      "SELECT id, nome, custo, TO_CHAR(data_limite, 'YYYY-MM-DD') AS data_limite, ordem FROM tarefas ORDER BY ordem ASC"
    );

    const total = tarefas.reduce((soma, t) => soma + Number(t.custo), 0);
    res.json({ tarefas, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar." });
  }
});

// incluir tarefa
app.post("/api/tarefas", async (req, res) => {
  const { nome, custo, data_limite } = req.body;

  if (!nome || nome.trim() === "") {
    return res.status(400).json({ error: "Nome é obrigatório." });
  }

  const custoNum = Number(String(custo).replace(",", "."));
  if (Number.isNaN(custoNum) || custoNum < 0) {
    return res.status(400).json({ error: "Custo inválido." });
  }

  const dataValida =
    typeof data_limite === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(data_limite) &&
    !Number.isNaN(new Date(data_limite).getTime());

  if (!dataValida) {
    return res.status(400).json({ error: "Data-limite inválida." });
  }

  // não aceitar datas passadas (comparando só a data)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataInformada = new Date(data_limite + "T00:00:00");
  if (dataInformada < hoje) {
    return res.status(400).json({ error: "A data-limite não pode ser anterior a hoje." });
  }

  try {
    // ordem = max + 1
    const maxRes = await pool.query("SELECT COALESCE(MAX(ordem), 0) AS m FROM tarefas");
    const ordem = Number(maxRes.rows[0].m) + 1;

    const insertRes = await pool.query(
      "INSERT INTO tarefas (nome, custo, data_limite, ordem) VALUES ($1, $2, $3, $4) RETURNING id",
      [nome.trim(), custoNum, data_limite, ordem]
    );

    return res.status(201).json({ id: insertRes.rows[0].id });
  } catch (e) {
    if (String(e).includes("tarefas_nome_key") || String(e).includes("duplicate key")) {
      return res.status(409).json({ error: "Já existe uma tarefa com esse nome." });
    }
    console.error(e);
    return res.status(500).json({ error: "Erro ao inserir." });
  }
});

// excluir tarefa
app.delete("/api/tarefas/:id", async (req, res) => {
  const id = Number(req.params.id);

  try {
    const del = await pool.query("DELETE FROM tarefas WHERE id = $1", [id]);

    if (del.rowCount === 0) {
      return res.status(404).json({ error: "Tarefa não encontrada." });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao excluir." });
  }
});

// editar tarefa
app.put("/api/tarefas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { nome, custo, data_limite } = req.body;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "ID inválido." });
  }

  if (!nome || nome.trim() === "") {
    return res.status(400).json({ error: "Nome é obrigatório." });
  }

  const custoNum = Number(String(custo).replace(",", "."));
  if (Number.isNaN(custoNum) || custoNum < 0) {
    return res.status(400).json({ error: "Custo inválido." });
  }

  const dataValida =
    typeof data_limite === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(data_limite) &&
    !Number.isNaN(new Date(data_limite).getTime());

  if (!dataValida) {
    return res.status(400).json({ error: "Data-limite inválida." });
  }

  // não aceitar datas passadas
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataInformada = new Date(data_limite + "T00:00:00");
  if (dataInformada < hoje) {
    return res.status(400).json({ error: "A data-limite não pode ser anterior a hoje." });
  }

  try {
    // impedir duplicidade em outro registro
    const existe = await pool.query(
      "SELECT id FROM tarefas WHERE nome = $1 AND id <> $2",
      [nome.trim(), id]
    );
    if (existe.rowCount > 0) {
      return res.status(409).json({ error: "Já existe uma tarefa com esse nome." });
    }

    const up = await pool.query(
      "UPDATE tarefas SET nome = $1, custo = $2, data_limite = $3 WHERE id = $4",
      [nome.trim(), custoNum, data_limite, id]
    );

    if (up.rowCount === 0) {
      return res.status(404).json({ error: "Tarefa não encontrada." });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao salvar." });
  }
});

// subir/descer (troca ordem com vizinha)
app.post("/api/tarefas/:id/mover", async (req, res) => {
  const id = Number(req.params.id);
  const { direcao } = req.body;

  if (!["cima", "baixo"].includes(direcao)) {
    return res.status(400).json({ error: "Direção inválida." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const atualRes = await client.query("SELECT id, ordem FROM tarefas WHERE id = $1", [id]);
    if (atualRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Tarefa não encontrada." });
    }
    const atual = atualRes.rows[0];

    let vizinhaRes;
    if (direcao === "cima") {
      vizinhaRes = await client.query(
        "SELECT id, ordem FROM tarefas WHERE ordem < $1 ORDER BY ordem DESC LIMIT 1",
        [atual.ordem]
      );
    } else {
      vizinhaRes = await client.query(
        "SELECT id, ordem FROM tarefas WHERE ordem > $1 ORDER BY ordem ASC LIMIT 1",
        [atual.ordem]
      );
    }

    if (vizinhaRes.rowCount === 0) {
      await client.query("COMMIT");
      return res.json({ ok: true });
    }

    const vizinha = vizinhaRes.rows[0];

    // swap usando -1 temporário
    await client.query("UPDATE tarefas SET ordem = $1 WHERE id = $2", [-1, atual.id]);
    await client.query("UPDATE tarefas SET ordem = $1 WHERE id = $2", [atual.ordem, vizinha.id]);
    await client.query("UPDATE tarefas SET ordem = $1 WHERE id = $2", [vizinha.ordem, atual.id]);

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ error: "Erro ao reordenar." });
  } finally {
    client.release();
  }
});

// drag-and-drop: recebe a lista completa de ids na nova ordem
app.post("/api/tarefas/reordenar", async (req, res) => {
  const { ordemIds } = req.body;

  if (!Array.isArray(ordemIds) || ordemIds.length === 0) {
    return res.status(400).json({ error: "Lista de ordem inválida." });
  }

  const ids = ordemIds.map(Number);
  if (ids.some((x) => !Number.isInteger(x))) {
    return res.status(400).json({ error: "IDs inválidos." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const totalRes = await client.query("SELECT COUNT(*) AS c FROM tarefas");
    const total = Number(totalRes.rows[0].c);

    if (ids.length !== total) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "A lista de IDs deve conter todas as tarefas." });
    }

    // ordens temporárias negativas
    for (let i = 0; i < ids.length; i++) {
      await client.query("UPDATE tarefas SET ordem = $1 WHERE id = $2", [-(i + 1), ids[i]]);
    }

    // ordens finais 1..n
    for (let i = 0; i < ids.length; i++) {
      await client.query("UPDATE tarefas SET ordem = $1 WHERE id = $2", [i + 1, ids[i]]);
    }

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ error: "Erro ao reordenar." });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
