/* ============================================================
   Sistema de Compras — Lógica do formulário
   ============================================================ */

// ⚙️  CONFIGURAÇÃO: cole aqui a URL do seu Google Apps Script Web App
//    (após publicar como Web App — veja /apps-script-code.gs)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxGxn-ctbqpoidFfcTrlMG8whhk7gBcp4l7W_-9g1BbPgau0LsoTo7XFZZNYjYJm7jxzQ/exec";

// ============ ESTADO ============
const state = {
  step: 1,
  solicitante: {},
  itens: [],
  editingIndex: -1,
  extraLinks: 0,
  arquivos: [], // arquivos do item em edição (antes de "Adicionar Item")
  protocolo: gerarProtocolo(),
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

document.getElementById("protocolo-num").textContent = state.protocolo;
document.getElementById("year").textContent = new Date().getFullYear();

// ============ HELPERS ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function gerarProtocolo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `${ymd}-${rnd}`;
}

function toast(msg, kind = "info") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toast._tid);
  toast._tid = setTimeout(() => t.classList.remove("show"), 3500);
}

function setError(field, msg) {
  const errEl = document.querySelector(`[data-err="${field}"]`);
  const inpEl = document.getElementById(field);
  if (msg) {
    if (errEl) errEl.textContent = msg;
    if (inpEl) inpEl.classList.add("invalid");
  } else {
    if (errEl) errEl.textContent = "";
    if (inpEl) inpEl.classList.remove("invalid");
  }
}

function clearErrors(container) {
  container.querySelectorAll(".err").forEach(e => e.textContent = "");
  container.querySelectorAll(".invalid").forEach(e => e.classList.remove("invalid"));
}

function validUrl(v) {
  if (!v) return false;
  try { const u = new URL(v); return u.protocol.startsWith("http"); } catch { return false; }
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ============ NAVEGAÇÃO ENTRE ETAPAS ============
function goStep(n) {
  state.step = n;
  $$(".step-panel").forEach(p => p.classList.remove("active"));
  $(`#panel-${n}`).classList.add("active");

  $$(".step").forEach(s => {
    const idx = Number(s.dataset.step);
    s.classList.remove("active", "completed");
    if (idx < n) s.classList.add("completed");
    else if (idx === n) s.classList.add("active");
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (n === 3) renderRevisao();
}

// ============ ETAPA 1 ============
$("#finalidade").addEventListener("change", (e) => {
  const outra = e.target.value === "Outro";
  $("#wrap-finalidade-outra").classList.toggle("hidden", !outra);
});

$("#departamento").addEventListener("change", (e) => {
  const valor = e.target.value;
  const isAcademico = valor.startsWith("Academic-Primary") || valor.startsWith("Academic-Secondary");
  $("#campoAcademico").classList.toggle("hidden", !isAcademico);
  if (!isAcademico) {
    $("#anoOuArea").value = "";
  }
});


$("#btn-next-1").addEventListener("click", () => {
  const panel = $("#panel-1");
  clearErrors(panel);

  const dados = {
    solicitante: $("#solicitante").value.trim(),
    email: $("#email").value.trim(),
    campus: $("#campus").value,
    departamento: $("#departamento").value,
    finalidade: $("#finalidade").value,
    finalidadeOutra: $("#finalidade-outra").value.trim(),
  };

  let ok = true;
  if (!dados.solicitante) { setError("solicitante", "Informe o nome do solicitante."); ok = false; }
  if (!validEmail(dados.email)) { setError("email", "Informe um e-mail válido."); ok = false; }
  if (!dados.campus) { setError("campus", "Selecione o campus."); ok = false; }
  if (!dados.departamento) { setError("departamento", "Selecione o departamento."); ok = false; }
  if (!dados.finalidade) { setError("finalidade", "Selecione a finalidade."); ok = false; }
  if (dados.finalidade === "Outro" && !dados.finalidadeOutra) {
    setError("finalidade-outra", "Especifique a finalidade."); ok = false;
  }

  if (!ok) { toast("Verifique os campos destacados.", "error"); return; }

  state.solicitante = dados;
  goStep(2);
});

// ============ ETAPA 2 — Item form ============
$("#i-unidade").addEventListener("change", (e) => {
  const v = e.target.value;
  const show = (v === "Caixa" || v === "Pacote");
  $("#wrap-qtd-embalagem").classList.toggle("hidden", !show);
});

document.querySelectorAll('input[name="prioridade"]').forEach(r => {
  r.addEventListener("change", (e) => {
    $("#wrap-urgencia").classList.toggle("hidden", e.target.value !== "Alta");
  });
});

$("#btn-add-link").addEventListener("click", () => {
  state.extraLinks += 1;
  const idx = state.extraLinks;
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.style.marginTop = "12px";
  wrap.innerHTML = `
    <label class="lbl">Link ${2 + idx}</label>
    <div style="display:flex; gap:8px; align-items:center;">
      <input type="url" class="inp extra-link" placeholder="https://..." data-testid="input-extra-link-${idx}" />
      <button type="button" class="icon-btn danger" onclick="this.parentElement.parentElement.remove()" title="Remover">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button>
    </div>
  `;
  $("#extra-links").appendChild(wrap);
});

$("#btn-add-item").addEventListener("click", () => {
  const panel = $("#panel-2");
  clearErrors(panel);

  const item = {
    categoria: $("#i-categoria").value,
    nome: $("#i-nome").value.trim(),
    quantidade: $("#i-qtd").value,
    unidade: $("#i-unidade").value,
    qtdEmbalagem: $("#i-qtd-embalagem").value,
    marca: $("#i-marca").value.trim(),
    modelo: $("#i-modelo").value.trim(),
    cor: $("#i-cor").value.trim(),
    tamanho: $("#i-tamanho").value.trim(),
    especificacoes: $("#i-especs").value.trim(),
    similar: document.querySelector('input[name="similar"]:checked')?.value || "",
    link1: $("#i-link1").value.trim(),
    link2: $("#i-link2").value.trim(),
    linksExtras: [...document.querySelectorAll(".extra-link")].map(i => i.value.trim()).filter(Boolean),
    arquivos: [...state.arquivos],
    observacoes: $("#i-obs").value.trim(),
    prioridade: document.querySelector('input[name="prioridade"]:checked')?.value || "",
    urgencia: $("#i-urgencia").value.trim(),
  };

  let ok = true;
  if (!item.categoria) { setError("i-categoria", "Selecione a categoria."); ok = false; }
  if (!item.nome) { setError("i-nome", "Informe o nome do material."); ok = false; }
  if (!item.quantidade || Number(item.quantidade) <= 0) { setError("i-qtd", "Informe uma quantidade válida."); ok = false; }
  if (!item.unidade) { setError("i-unidade", "Selecione a unidade."); ok = false; }
  if ((item.unidade === "Caixa" || item.unidade === "Pacote") && (!item.qtdEmbalagem || Number(item.qtdEmbalagem) <= 0)) {
    setError("i-qtd-embalagem", "Informe a quantidade por caixa/pacote."); ok = false;
  }
  if (!item.similar) { setError("similar", "Informe se aceita similar."); ok = false; }
  if (item.link1 && !validUrl(item.link1)) { setError("i-link1", "Informe uma URL válida."); ok = false; }
  if (item.link2 && !validUrl(item.link2)) { setError("i-link2", "Informe uma URL válida."); ok = false; }
  if (!item.prioridade) { setError("prioridade", "Selecione a prioridade."); ok = false; }
  if (item.prioridade === "Alta" && !item.urgencia) { setError("i-urgencia", "Informe o motivo da urgência."); ok = false; }

  if (!ok) { toast("Verifique os campos destacados no item.", "error"); return; }

  if (state.editingIndex >= 0) {
    state.itens[state.editingIndex] = item;
    toast("Item atualizado.", "success");
    state.editingIndex = -1;
    $("#btn-cancel-edit").style.display = "none";
    $("#btn-add-item-label").textContent = "Adicionar Item";
  } else {
    state.itens.push(item);
    toast("Item adicionado à solicitação.", "success");
  }

  resetItemForm();
  renderTabela();
});

$("#btn-cancel-edit").addEventListener("click", () => {
  state.editingIndex = -1;
  $("#btn-cancel-edit").style.display = "none";
  $("#btn-add-item-label").textContent = "Adicionar Item";
  resetItemForm();
  toast("Edição cancelada.");
});

function resetItemForm() {
  const ids = ["i-categoria", "i-nome", "i-qtd", "i-unidade", "i-qtd-embalagem", "i-marca", "i-modelo", "i-cor",
    "i-tamanho", "i-especs", "i-link1", "i-link2", "i-obs", "i-urgencia"];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.querySelectorAll('input[name="similar"]').forEach(r => r.checked = false);
  document.querySelectorAll('input[name="prioridade"]').forEach(r => r.checked = false);
  $("#wrap-qtd-embalagem").classList.add("hidden");
  $("#wrap-urgencia").classList.add("hidden");
  $("#extra-links").innerHTML = "";
  state.extraLinks = 0;
  state.arquivos = [];
  $("#i-arquivos").value = "";
  renderListaArquivos();
  clearErrors($("#panel-2"));
}

// ============ UPLOAD DE ARQUIVOS ============

const MAX_ARQUIVOS = 10;

$("#i-arquivos").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = ""; // permite selecionar o mesmo arquivo de novo
  for (const f of files) {
    if (state.arquivos.length >= MAX_ARQUIVOS) {
      toast('Máximo de ${MAX_ARQUIVOS} arquivos por item.', "error");
      break;
    }
    if (!ACCEPTED_MIMES.includes(f.type)) {
      toast(`"${f.name}": tipo não aceito (apenas JPG, PNG, WEBP, PDF).`, "error");
      continue;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast(`"${f.name}": excede 5 MB.`, "error");
      continue;
    }
    try {
      const base64 = await fileToBase64(f);
      state.arquivos.push({
        filename: f.name,
        mimeType: f.type,
        size: f.size,
        base64: base64,
      });
    } catch (err) {
      toast(`Falha ao ler "${f.name}".`, "error");
    }
  }
  renderListaArquivos();
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // remove data:...;base64, prefix
      const base64 = result.substring(result.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function renderListaArquivos() {
  const lst = $("#lista-arquivos");
  lst.innerHTML = state.arquivos.map((a, i) => {
    const icon = a.mimeType === "application/pdf"
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="fico"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="2"/><path d="M14 2v6h6M9 15h6M9 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="fico"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="2"/><path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `
      <div class="arquivo-chip" data-testid="arquivo-${i}">
        ${icon}
        <span class="fname">${escapeHtml(a.filename)}</span>
        <span class="fsize">${formatSize(a.size)}</span>
        <button type="button" onclick="removerArquivo(${i})" title="Remover" data-testid="btn-remover-arquivo-${i}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </button>
      </div>
    `;
  }).join("");
}
window.removerArquivo = function (i) {
  state.arquivos.splice(i, 1);
  renderListaArquivos();
};

function renderTabela() {
  const tbody = $("#tbody-itens");
  $("#counter-itens").textContent = `${state.itens.length} ${state.itens.length === 1 ? "item" : "itens"}`;
  if (state.itens.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Nenhum item adicionado. Preencha o formulário acima e clique em <b>Adicionar Item</b>.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.itens.map((it, i) => {
    const prioClass = it.prioridade === "Alta" ? "badge-alta" : it.prioridade === "Média" ? "badge-media" : "badge-baixa";
    const simClass = it.similar === "Sim" ? "badge-sim" : "badge-nao";
    return `
      <tr>
        <td><b>${escapeHtml(it.nome)}</b></td>
        <td>${escapeHtml(it.categoria)}</td>
        <td>${escapeHtml(it.quantidade)}</td>
        <td>${escapeHtml(it.unidade)}</td>
        <td><span class="badge ${prioClass}">${escapeHtml(it.prioridade)}</span></td>
        <td><span class="badge ${simClass}">${escapeHtml(it.similar)}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="Editar" onclick="editarItem(${i})" data-testid="edit-item-${i}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="icon-btn danger" title="Remover" onclick="removerItem(${i})" data-testid="remove-item-${i}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

window.editarItem = function (i) {
  const it = state.itens[i];
  state.editingIndex = i;
  $("#i-categoria").value = it.categoria;
  $("#i-nome").value = it.nome;
  $("#i-qtd").value = it.quantidade;
  $("#i-unidade").value = it.unidade;
  $("#i-qtd-embalagem").value = it.qtdEmbalagem || "";
  $("#wrap-qtd-embalagem").classList.toggle("hidden", !(it.unidade === "Caixa" || it.unidade === "Pacote"));
  $("#i-marca").value = it.marca;
  $("#i-modelo").value = it.modelo;
  $("#i-cor").value = it.cor;
  $("#i-tamanho").value = it.tamanho;
  $("#i-especs").value = it.especificacoes;
  document.querySelector(`input[name="similar"][value="${it.similar}"]`)?.click();
  document.querySelector(`input[name="similar"][value="${it.similar}"]`) && (document.querySelector(`input[name="similar"][value="${it.similar}"]`).checked = true);
  $("#i-link1").value = it.link1;
  $("#i-link2").value = it.link2;
  $("#extra-links").innerHTML = "";
  state.extraLinks = 0;
  (it.linksExtras || []).forEach(link => {
    $("#btn-add-link").click();
    const inputs = document.querySelectorAll(".extra-link");
    inputs[inputs.length - 1].value = link;
  });
  $("#i-anexo-foto").value = it.anexoFoto || "";
  $("#i-anexo-catalogo").value = it.anexoCatalogo || "";
  $("#i-anexo-print").value = it.anexoPrint || "";
  $("#i-anexo-pdf").value = it.anexoPdf || "";
  state.arquivos = [...(it.arquivos || [])];
  renderListaArquivos();
  $("#i-obs").value = it.observacoes || "";
  if (it.prioridade) {
    const r = document.querySelector(`input[name="prioridade"][value="${it.prioridade}"]`);
    if (r) { r.checked = true; r.dispatchEvent(new Event("change")); }
  }
  $("#i-urgencia").value = it.urgencia || "";
  $("#btn-cancel-edit").style.display = "inline-flex";
  $("#btn-add-item-label").textContent = "Salvar alterações";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.removerItem = function (i) {
  if (!confirm("Remover este item da solicitação?")) return;
  state.itens.splice(i, 1);
  renderTabela();
  toast("Item removido.", "info");
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("#btn-back-2").addEventListener("click", () => goStep(1));
$("#btn-next-2").addEventListener("click", () => {
  if (state.itens.length === 0) {
    toast("Adicione ao menos 1 item à solicitação.", "error");
    return;
  }
  goStep(3);
});

// ============ ETAPA 3 — Revisão ============
function renderRevisao() {
  const s = state.solicitante;
  $("#review-solicitante").innerHTML = `
    <div><dt>Nome</dt><dd>${escapeHtml(s.solicitante)}</dd></div>
    <div><dt>E-mail</dt><dd>${escapeHtml(s.email)}</dd></div>
    <div><dt>Campus</dt><dd>${escapeHtml(s.campus)}</dd></div>
    <div><dt>Departamento</dt><dd>${escapeHtml(s.departamento)}</dd></div>
    <div style="grid-column: span 2;"><dt>Finalidade</dt><dd>${escapeHtml(s.finalidade === "Outro" ? s.finalidadeOutra : s.finalidade)}</dd></div>
  `;
  $("#review-count").textContent = `${state.itens.length} ${state.itens.length === 1 ? "item" : "itens"}`;

  $("#review-itens").innerHTML = state.itens.map((it, i) => {
    const links = [it.link1, it.link2, ...(it.linksExtras || [])].filter(Boolean);
    const anexos = [
      it.anexoFoto && ["Foto", it.anexoFoto],
      it.anexoCatalogo && ["Catálogo", it.anexoCatalogo],
      it.anexoPrint && ["Print", it.anexoPrint],
      it.anexoPdf && ["PDF", it.anexoPdf],
    ].filter(Boolean);
    const arquivos = it.arquivos || [];
    const prioClass = it.prioridade === "Alta" ? "badge-alta" : it.prioridade === "Média" ? "badge-media" : "badge-baixa";
    return `
      <div class="review-item">
        <div class="review-item-head">
          <div class="review-item-name">
            <span class="idx">${i + 1}</span>
            <span>${escapeHtml(it.nome)}</span>
          </div>
          <span class="badge ${prioClass}">${escapeHtml(it.prioridade)}</span>
        </div>
        <div class="review-item-body">
          <div><dt>Categoria</dt><dd>${escapeHtml(it.categoria)}</dd></div>
          <div><dt>Quantidade</dt><dd>${escapeHtml(it.quantidade)} ${escapeHtml(it.unidade)}${it.qtdEmbalagem ? ` (${escapeHtml(it.qtdEmbalagem)} por ${escapeHtml(it.unidade).toLowerCase()})` : ""}</dd></div>
          <div><dt>Aceita similar</dt><dd>${escapeHtml(it.similar)}</dd></div>
          ${it.marca ? `<div><dt>Marca</dt><dd>${escapeHtml(it.marca)}</dd></div>` : ""}
          ${it.modelo ? `<div><dt>Modelo</dt><dd>${escapeHtml(it.modelo)}</dd></div>` : ""}
          ${it.cor ? `<div><dt>Cor</dt><dd>${escapeHtml(it.cor)}</dd></div>` : ""}
          ${it.tamanho ? `<div><dt>Tamanho</dt><dd>${escapeHtml(it.tamanho)}</dd></div>` : ""}
          ${it.especificacoes ? `<div class="full"><dt>Especificações técnicas</dt><dd>${escapeHtml(it.especificacoes)}</dd></div>` : ""}
          ${it.urgencia ? `<div class="full"><dt>Motivo da urgência</dt><dd>${escapeHtml(it.urgencia)}</dd></div>` : ""}
          ${links.length ? `<div class="full"><dt>Links de referência</dt><dd>${links.map(l => `<a href="${escapeHtml(l)}" target="_blank" rel="noopener">${escapeHtml(l)}</a>`).join("<br>")}</dd></div>` : ""}
          ${anexos.length ? `<div class="full"><dt>Anexos (links)</dt><dd>${anexos.map(([k, v]) => `<b>${k}:</b> <a href="${escapeHtml(v)}" target="_blank" rel="noopener">${escapeHtml(v)}</a>`).join("<br>")}</dd></div>` : ""}
          ${arquivos.length ? `<div class="full"><dt>Arquivos enviados</dt><dd>${arquivos.map(a => `📎 ${escapeHtml(a.filename)} <span style="color:var(--ink-400);font-family:var(--ff-mono);font-size:11px;">(${formatSize(a.size)})</span>`).join("<br>")}</dd></div>` : ""}
          ${it.observacoes ? `<div class="full"><dt>Observações</dt><dd>${escapeHtml(it.observacoes)}</dd></div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

$("#btn-back-3").addEventListener("click", () => goStep(2));

// ============ ENVIO ============
$("#btn-enviar").addEventListener("click", async () => {
  const btn = $("#btn-enviar");
  btn.disabled = true;
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="animation:spin 1s linear infinite;"><path d="M12 2a10 10 0 019 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg> Enviando...`;

  const payload = {
    protocolo: state.protocolo,
    dataEnvio: new Date().toISOString(),
    solicitante: state.solicitante,
    itens: state.itens,
  };

  try {
    if (!GOOGLE_SCRIPT_URL) {
      // Modo demonstração — mostra sucesso mesmo sem URL configurada
      console.log("[MODO DEMO] Payload que seria enviado ao Google Sheets:", payload);
      await new Promise(r => setTimeout(r, 900));
      showSuccessModal(state.protocolo);
      toast("Modo demonstração: dados exibidos no console.", "info");
    } else {
      // Envio real ao Google Apps Script (text/plain evita preflight CORS)
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === "error") {
        throw new Error(data.message || "Erro no servidor.");
      }
      showSuccessModal(state.protocolo);
    }
  } catch (err) {
    console.error(err);
    toast("Falha ao enviar: " + err.message, "error");
    btn.disabled = false;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Enviar Solicitação`;
  }
});

// Spinner CSS
const styleEl = document.createElement("style");
styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleEl);

function showSuccessModal(protocolo) {
  $("#modal-protocol").textContent = "SC-" + protocolo;
  $("#success-modal").classList.add("show");
  $("#success-modal").setAttribute("aria-hidden", "false");
}

$("#btn-nova").addEventListener("click", () => {
  location.reload();
});
