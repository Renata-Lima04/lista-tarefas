import express from "express";
import path from "path";
import db from "./db.js";

const app = express();

// permite receber dados em JSON
app.use(express.json());

// permite acessar arquivos da pasta public
app.use(express.static(path.resolve("public")));

// rota inicial só para teste
app.get("/api/teste", (req, res) => {
  res.json({ mensagem: "Servidor funcionando!" });
});

// rota para listar tarefas (ainda vazia)
app.get("/api/tarefas", (req, res) => {
  const tarefas = db
    .prepare("SELECT * FROM tarefas ORDER BY ordem ASC")
    .all();

  const total = tarefas.reduce((soma, t) => soma + Number(t.custo), 0);

  res.json({ tarefas, total });
});

// rota para incluir tarefa
app.post("/api/tarefas", (req, res) => {
  const { nome, custo, data_limite } = req.body;

  // validações básicas
  if (!nome || nome.trim() === "") {
    return res.status(400).json({ error: "Nome é obrigatório." });
  }

  const custoNum = Number(String(custo).replace(",", "."));
  if (Number.isNaN(custoNum) || custoNum < 0) {
    return res.status(400).json({ error: "Custo inválido." });
  }

  // data no formato YYYY-MM-DD
  const dataValida =
    typeof data_limite === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(data_limite) &&
    !Number.isNaN(new Date(data_limite).getTime());

      // não aceitar datas passadas (comparando só a data)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataInformada = new Date(data_limite + "T00:00:00");
  if (dataInformada < hoje) {
    return res.status(400).json({ error: "A data-limite não pode ser anterior a hoje." });
  }


  if (!dataValida) {
    return res.status(400).json({ error: "Data-limite inválida." });
  }

  // ordem = max + 1 (para entrar como última)
  const max = db.prepare("SELECT COALESCE(MAX(ordem), 0) as m FROM tarefas").get().m;
  const ordem = max + 1;

  try {
    const info = db
      .prepare("INSERT INTO tarefas (nome, custo, data_limite, ordem) VALUES (?, ?, ?, ?)")
      .run(nome.trim(), custoNum, data_limite, ordem);

    return res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    // nome duplicado
    if (String(e).includes("UNIQUE constraint failed: tarefas.nome")) {
      return res.status(409).json({ error: "Já existe uma tarefa com esse nome." });
    }
    return res.status(500).json({ error: "Erro ao inserir." });
  }
});
// rota para excluir tarefa
app.delete("/api/tarefas/:id", (req, res) => {
  const id = Number(req.params.id);

  const info = db.prepare("DELETE FROM tarefas WHERE id = ?").run(id);

  if (info.changes === 0) {
    return res.status(404).json({ error: "Tarefa não encontrada." });
  }

  return res.json({ ok: true });
});
// rota para editar tarefa (nome, custo e data_limite)
app.put("/api/tarefas/:id", (req, res) => {
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
  // não aceitar datas passadas (comparando só a data)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataInformada = new Date(data_limite + "T00:00:00");
  if (dataInformada < hoje) {
    return res.status(400).json({ error: "A data-limite não pode ser anterior a hoje." });
  }

  if (!dataValida) {
    return res.status(400).json({ error: "Data-limite inválida." });
  }

  // impedir duplicidade de nome em outro registro
  const existe = db
    .prepare("SELECT id FROM tarefas WHERE nome = ? AND id <> ?")
    .get(nome.trim(), id);

  if (existe) {
    return res.status(409).json({ error: "Já existe uma tarefa com esse nome." });
  }

  const info = db
    .prepare("UPDATE tarefas SET nome = ?, custo = ?, data_limite = ? WHERE id = ?")
    .run(nome.trim(), custoNum, data_limite, id);

  if (info.changes === 0) {
    return res.status(404).json({ error: "Tarefa não encontrada." });
  }

  return res.json({ ok: true });
});
// reordenar: sobe ou desce (troca a ordem com a vizinha)
app.post("/api/tarefas/:id/mover", (req, res) => {
  const id = Number(req.params.id);
  const { direcao } = req.body; // "cima" ou "baixo"

  if (!["cima", "baixo"].includes(direcao)) {
    return res.status(400).json({ error: "Direção inválida." });
  }

  const atual = db.prepare("SELECT id, ordem FROM tarefas WHERE id = ?").get(id);
  if (!atual) return res.status(404).json({ error: "Tarefa não encontrada." });

  let vizinha;

  if (direcao === "cima") {
    vizinha = db
      .prepare("SELECT id, ordem FROM tarefas WHERE ordem < ? ORDER BY ordem DESC LIMIT 1")
      .get(atual.ordem);
  } else {
    vizinha = db
      .prepare("SELECT id, ordem FROM tarefas WHERE ordem > ? ORDER BY ordem ASC LIMIT 1")
      .get(atual.ordem);
  }

  // já está no topo ou no fim
  if (!vizinha) return res.json({ ok: true });

  // troca usando valor temporário (evita violar UNIQUE)
  const swap = db.transaction(() => {
    db.prepare("UPDATE tarefas SET ordem = ? WHERE id = ?").run(-1, atual.id);
    db.prepare("UPDATE tarefas SET ordem = ? WHERE id = ?").run(atual.ordem, vizinha.id);
    db.prepare("UPDATE tarefas SET ordem = ? WHERE id = ?").run(vizinha.ordem, atual.id);
  });

  try {
    swap();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao reordenar." });
  }
});
// reordenar por drag-and-drop (recebe a lista de IDs na nova ordem)
app.post("/api/tarefas/reordenar", (req, res) => {
  const { ordemIds } = req.body; // ex: [3,1,2]

  if (!Array.isArray(ordemIds) || ordemIds.length === 0) {
    return res.status(400).json({ error: "Lista de ordem inválida." });
  }

  // garantir que são números
  const ids = ordemIds.map(Number);
  if (ids.some((x) => !Number.isInteger(x))) {
    return res.status(400).json({ error: "IDs inválidos." });
  }

  // checar se todos existem
  const total = db.prepare("SELECT COUNT(*) as c FROM tarefas").get().c;
  if (ids.length !== total) {
    return res.status(400).json({ error: "A lista de IDs deve conter todas as tarefas." });
  }

  // atualizar ordem em transação usando valor temporário
  const tx = db.transaction(() => {
    // coloca ordens temporárias negativas para não bater no UNIQUE
    ids.forEach((id, i) => {
      db.prepare("UPDATE tarefas SET ordem = ? WHERE id = ?").run(-(i + 1), id);
    });

    // agora grava ordens finais 1..N
    ids.forEach((id, i) => {
      db.prepare("UPDATE tarefas SET ordem = ? WHERE id = ?").run(i + 1, id);
    });
  });

  try {
    tx();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao reordenar." });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
