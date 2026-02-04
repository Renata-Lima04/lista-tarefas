const listaEl = document.getElementById("lista");

const totalRodapeEl = document.getElementById("totalRodape");
const form = document.getElementById("form");

function formatBRL(v) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function carregar() {
  const res = await fetch("/api/tarefas");
  const data = await res.json();

  listaEl.innerHTML = "";

  data.tarefas.forEach((t, idx) => {
    const div = document.createElement("div");
    div.className = "task";
    div.draggable = true;         // drag-and-drop
    div.dataset.id = t.id;        // drag-and-drop

    if (Number(t.custo) >= 1000) div.classList.add("highlight");

    div.innerHTML = `
      <div class="small" style="margin-bottom:10px;">
        ID:  Ordem: ${t.ordem} • Arraste para reordenar
      </div>

      <div class="row">
        <div class="field">
          <label>Nome</label>
          <input class="nome" value="${t.nome}" disabled />
        </div>

        <div class="field" style="max-width:180px;">
          <label>Custo (R$)</label>
          <input class="custo" type="number" step="0.01" min="0" value="${t.custo}" disabled />
        </div>

        <div class="field" style="max-width:190px;">
          <label>Data-limite</label>
          <input class="data" type="date" value="${t.data_limite}" disabled />
        </div>
      </div>

      <div class="actions">
        <button class="subir ghost">Subir</button>
        <button class="descer ghost">Descer</button>
        <button class="editar primary">Editar</button>
        <button class="excluir">Excluir</button>
      </div>
    `;

    const inpNome = div.querySelector(".nome");
    const inpCusto = div.querySelector(".custo");
    const inpData = div.querySelector(".data");
    const btnEditar = div.querySelector(".editar");
    const btnExcluir = div.querySelector(".excluir");
    const btnSubir = div.querySelector(".subir");
    const btnDescer = div.querySelector(".descer");

    // desabilitar nas pontas (botões)
    if (idx === 0) btnSubir.disabled = true;
    if (idx === data.tarefas.length - 1) btnDescer.disabled = true;

    // SUBIR (swap com a vizinha de cima)
    btnSubir.onclick = async () => {
      const resp = await fetch(`/api/tarefas/${t.id}/mover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direcao: "cima" })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        alert(err.error || "Erro ao mover");
        return;
      }
      carregar();
    };

    // DESCER (swap com a vizinha de baixo)
    btnDescer.onclick = async () => {
      const resp = await fetch(`/api/tarefas/${t.id}/mover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direcao: "baixo" })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        alert(err.error || "Erro ao mover");
        return;
      }
      carregar();
    };

    // EXCLUIR
    btnExcluir.onclick = async () => {
      const ok = confirm("Confirmar exclusão? (Sim/Não)");
      if (!ok) return;

      const resp = await fetch(`/api/tarefas/${t.id}`, { method: "DELETE" });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        alert(err.error || "Erro ao excluir");
        return;
      }
      carregar();
    };

    // EDITAR / SALVAR
    btnEditar.onclick = async () => {
      if (btnEditar.textContent === "Editar") {
        inpNome.disabled = false;
        inpCusto.disabled = false;
        inpData.disabled = false;
        btnEditar.textContent = "Salvar";
        inpNome.focus();
        return;
      }

      const payload = {
        nome: inpNome.value.trim(),
        custo: inpCusto.value,
        data_limite: inpData.value
      };

      const resp = await fetch(`/api/tarefas/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        alert(err.error || "Erro ao salvar");
        return;
      }

      inpNome.disabled = true;
      inpCusto.disabled = true;
      inpData.disabled = true;
      btnEditar.textContent = "Editar";

      carregar();
    };

    // ========= DRAG AND DROP =========
    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(t.id));
      div.style.opacity = "0.5";
    });

    div.addEventListener("dragend", () => {
      div.style.opacity = "1";
    });

    div.addEventListener("dragover", (e) => {
      e.preventDefault(); // permite soltar
    });

    div.addEventListener("drop", async (e) => {
      e.preventDefault();

      const draggedId = Number(e.dataTransfer.getData("text/plain"));
      const targetId = Number(div.dataset.id);

      if (!draggedId || !targetId || draggedId === targetId) return;

      const cards = Array.from(listaEl.querySelectorAll(".task"));
      const fromIndex = cards.findIndex(c => Number(c.dataset.id) === draggedId);
      const toIndex = cards.findIndex(c => Number(c.dataset.id) === targetId);

      if (fromIndex === -1 || toIndex === -1) return;

      const draggedEl = cards[fromIndex];
      const targetEl = cards[toIndex];

      // move visualmente
      if (fromIndex < toIndex) {
        listaEl.insertBefore(draggedEl, targetEl.nextSibling);
      } else {
        listaEl.insertBefore(draggedEl, targetEl);
      }

      // salva no banco
      const ordemIds = Array.from(listaEl.querySelectorAll(".task"))
        .map(c => Number(c.dataset.id));

      const resp = await fetch("/api/tarefas/reordenar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordemIds })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        alert(err.error || "Erro ao reordenar");
        carregar();
        return;
      }

      carregar();
    });
    // ========= FIM DRAG AND DROP =========

    listaEl.appendChild(div);
  });

if (totalRodapeEl) totalRodapeEl.textContent = formatBRL(data.total);

}

form.onsubmit = async (e) => {
  e.preventDefault();

  const nome = document.getElementById("novoNome").value.trim();
  const custo = document.getElementById("novoCusto").value;
  const data_limite = document.getElementById("novoData").value;

  // não aceitar datas passadas (front)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataInformada = new Date(data_limite + "T00:00:00");

  if (dataInformada < hoje) {
    alert("A data-limite não pode ser anterior a hoje.");
    return;
  }

  const resp = await fetch("/api/tarefas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, custo, data_limite })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Erro" }));
    alert(err.error || "Erro ao incluir");
    return;
  }

  form.reset();
  carregar();
};

carregar();
