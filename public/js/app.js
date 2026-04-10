// public/js/app.js
let CHAMADOS = [];
let EQUIPES = [];
let EQUIPE_CARGOS = [];
let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;

window.addEventListener("load", async () => {
  await registrarServiceWorker();
  atualizarStatusConexao();
  registrarEventos();

  await Promise.all([
    carregarEquipes(),
    carregarEquipeCargos()
  ]);

  preencherSelectEquipes();
  await carregarChamados();
  ouvirMudancasTempoReal();
});

window.addEventListener("online", atualizarStatusConexao);
window.addEventListener("offline", atualizarStatusConexao);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.getElementById("btnInstalar").classList.remove("oculto");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  document.getElementById("btnInstalar").classList.add("oculto");
});

async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.error("Erro ao registrar Service Worker:", error);
  }
}

function atualizarStatusConexao() {
  document.getElementById("statusConexao").textContent = navigator.onLine ? "Online" : "Offline";
}

function registrarEventos() {
  document.getElementById("busca").addEventListener("input", aplicarFiltros);
  document.getElementById("filtroStatus").addEventListener("change", aplicarFiltros);
  document.getElementById("filtroSetor").addEventListener("change", aplicarFiltros);

  document.getElementById("btnInstalar").addEventListener("click", instalarApp);
  document.getElementById("btnPermissaoNotificacao").addEventListener("click", solicitarPermissaoNotificacao);
  document.getElementById("btnNovoChamado").addEventListener("click", abrirFormularioNovoChamado);

  document.getElementById("fecharModalDetalhes").addEventListener("click", fecharDetalhes);
  document.getElementById("fecharModalFormulario").addEventListener("click", fecharFormulario);
  document.getElementById("btnCancelarFormulario").addEventListener("click", fecharFormulario);

  document.getElementById("btnAdicionarItem").addEventListener("click", () => adicionarLinhaItem());
  document.getElementById("equipeId").addEventListener("change", aoTrocarEquipeFormulario);
  document.getElementById("formChamado").addEventListener("submit", salvarChamadoCompleto);
}

async function carregarEquipes() {
  const { data, error } = await supabaseClient
    .from("equipes")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar equipes:", error);
    return;
  }

  EQUIPES = data || [];
}

async function carregarEquipeCargos() {
  const { data, error } = await supabaseClient
    .from("vw_equipe_cargos")
    .select("*")
    .order("equipe_nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar cargos por equipe:", error);
    return;
  }

  EQUIPE_CARGOS = data || [];
}

function preencherSelectEquipes() {
  const select = document.getElementById("equipeId");
  select.innerHTML = "";

  EQUIPES.forEach((equipe) => {
    const option = document.createElement("option");
    option.value = equipe.id;
    option.textContent = equipe.nome;
    select.appendChild(option);
  });
}

async function instalarApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById("btnInstalar").classList.add("oculto");
}

async function solicitarPermissaoNotificacao() {
  if (!("Notification" in window)) {
    alert("Este navegador não suporta notificações.");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") alert("Notificações ativadas.");
  else alert("Permissão de notificação não concedida.");
}

async function carregarChamados() {
  const lista = document.getElementById("listaChamados");
  lista.innerHTML = `<div class="mensagem-vazia">Carregando chamados...</div>`;

  const { data, error } = await supabaseClient
    .from("vw_chamados_com_total")
    .select("*")
    .order("criacao", { ascending: false });

  if (error) {
    console.error("Erro ao carregar chamados:", error);
    lista.innerHTML = `<div class="mensagem-erro">Falha ao carregar chamados. Verifique a configuração do Supabase.</div>`;
    return;
  }

  CHAMADOS = data || [];
  aplicarFiltros();
}

function aplicarFiltros() {
  const termo = document.getElementById("busca").value.toLowerCase().trim();
  const status = document.getElementById("filtroStatus").value;
  const setor = document.getElementById("filtroSetor").value;

  const filtrados = CHAMADOS.filter((chamado) => {
    const okBusca =
      (chamado.id || "").toLowerCase().includes(termo) ||
      (chamado.problema || "").toLowerCase().includes(termo) ||
      (chamado.solicitante || "").toLowerCase().includes(termo) ||
      (chamado.unidade || "").toLowerCase().includes(termo);

    const okStatus = !status || chamado.status === status;
    const okSetor = !setor || chamado.setor === setor;

    return okBusca && okStatus && okSetor;
  });

  renderizarChamados(filtrados);
}

function renderizarChamados(chamados) {
  const lista = document.getElementById("listaChamados");

  if (!chamados.length) {
    lista.innerHTML = `<div class="mensagem-vazia">Nenhum chamado encontrado com os filtros informados.</div>`;
    return;
  }

  lista.innerHTML = "";

  chamados.forEach((chamado) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-topo">
        <div>
          <h3>${escapeHtml(chamado.id)}</h3>
          <span class="badge">${escapeHtml(chamado.equipe || "Sem equipe")}</span>
        </div>

        <div class="card-acoes">
          <button data-acao="detalhes" data-id="${escapeHtml(chamado.id)}">Detalhes</button>
          <button data-acao="editar" data-id="${escapeHtml(chamado.id)}" class="secundario">Editar</button>
          <button data-acao="excluir" data-id="${escapeHtml(chamado.id)}" class="perigo">Deletar</button>
        </div>
      </div>

      <div class="linha"><strong>Solicitante:</strong> ${escapeHtml(chamado.solicitante || "")}</div>
      <div class="linha"><strong>Unidade:</strong> ${escapeHtml(chamado.unidade || "")}</div>
      <div class="linha"><strong>Setor:</strong> ${escapeHtml(chamado.setor || "")}</div>
      <div class="linha"><strong>Problema:</strong> ${escapeHtml(chamado.problema || "")}</div>
      <div class="linha"><strong>Manutenção:</strong> ${escapeHtml(chamado.manutencao || "")}</div>
      <div class="linha"><strong>Prioridade:</strong> ${escapeHtml(chamado.prioridade || "")}</div>
      <div class="linha"><strong>Status:</strong> ${escapeHtml(chamado.status || "")}</div>
      <div class="linha"><strong>Criação:</strong> ${formatarData(chamado.criacao)}</div>
      <div class="linha"><strong>Início:</strong> ${chamado.inicio ? formatarData(chamado.inicio) : "—"}</div>
      <div class="linha"><strong>Finalização:</strong> ${chamado.finalizacao ? formatarData(chamado.finalizacao) : "—"}</div>
      <div class="valor-total">Valor Total: ${formatarMoeda(Number(chamado.valor_total_chamado || 0))}</div>
    `;

    lista.appendChild(card);
  });

  document.querySelectorAll("button[data-acao='detalhes']").forEach((botao) => {
    botao.addEventListener("click", () => abrirDetalhes(botao.dataset.id));
  });

  document.querySelectorAll("button[data-acao='editar']").forEach((botao) => {
    botao.addEventListener("click", () => abrirFormularioEdicao(botao.dataset.id));
  });

  document.querySelectorAll("button[data-acao='excluir']").forEach((botao) => {
    botao.addEventListener("click", () => deletarChamado(botao.dataset.id));
  });
}

async function abrirDetalhes(idChamado) {
  const { data, error } = await supabaseClient
    .from("vw_chamado_itens_detalhado")
    .select("*")
    .eq("chamado_id", idChamado)
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao carregar detalhes:", error);
    alert("Não foi possível carregar os detalhes do chamado.");
    return;
  }

  const chamado = CHAMADOS.find((item) => item.id === idChamado);
  const detalhes = document.getElementById("detalhesChamado");

  let linhasTabela = "";

  (data || []).forEach((item) => {
    linhasTabela += `
      <tr>
        <td>${escapeHtml(item.servico)}</td>
        <td>${escapeHtml(item.cargo)}</td>
        <td>${formatarNumero(item.quantidade)}</td>
        <td>${formatarMoeda(Number(item.valor_hora || 0))}</td>
        <td>${formatarNumero(item.horas)}</td>
        <td>${formatarMoeda(Number(item.valor_total || 0))}</td>
      </tr>
    `;
  });

  if (!linhasTabela) {
    linhasTabela = `<tr><td colspan="6">Este chamado não possui composição de custo.</td></tr>`;
  }

  detalhes.innerHTML = `
    <div class="card-acoes">
      <button data-acao="editar-detalhe" data-id="${escapeHtml(idChamado)}" class="secundario">Editar</button>
      <button data-acao="excluir-detalhe" data-id="${escapeHtml(idChamado)}" class="perigo">Deletar este chamado</button>
    </div>

    <div class="linha"><strong>ID:</strong> ${escapeHtml(chamado?.id || "")}</div>
    <div class="linha"><strong>Solicitante:</strong> ${escapeHtml(chamado?.solicitante || "")}</div>
    <div class="linha"><strong>Unidade:</strong> ${escapeHtml(chamado?.unidade || "")}</div>
    <div class="linha"><strong>Setor:</strong> ${escapeHtml(chamado?.setor || "")}</div>
    <div class="linha"><strong>Equipe:</strong> ${escapeHtml(chamado?.equipe || "")}</div>
    <div class="linha"><strong>Status:</strong> ${escapeHtml(chamado?.status || "")}</div>
    <div class="linha"><strong>Total:</strong> ${formatarMoeda(Number(chamado?.valor_total_chamado || 0))}</div>

    <table>
      <thead>
        <tr>
          <th>Serviço</th>
          <th>Cargo</th>
          <th>Quantidade</th>
          <th>Valor/Hora</th>
          <th>Horas</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>${linhasTabela}</tbody>
      <tfoot>
        <tr>
          <td colspan="5">TOTAL</td>
          <td>${formatarMoeda(Number(chamado?.valor_total_chamado || 0))}</td>
        </tr>
      </tfoot>
    </table>
  `;

  detalhes.querySelector("[data-acao='editar-detalhe']").addEventListener("click", () => {
    fecharDetalhes();
    abrirFormularioEdicao(idChamado);
  });

  detalhes.querySelector("[data-acao='excluir-detalhe']").addEventListener("click", () => {
    deletarChamado(idChamado);
  });

  document.getElementById("modalDetalhes").classList.remove("oculto");
}

function fecharDetalhes() {
  document.getElementById("modalDetalhes").classList.add("oculto");
}

function abrirFormularioNovoChamado() {
  document.getElementById("tituloFormulario").textContent = "Novo chamado";
  document.getElementById("formChamado").reset();
  document.getElementById("chamadoId").value = "";
  document.getElementById("idManual").value = "";
  document.getElementById("criacao").value = obterAgoraLocal();
  document.getElementById("inicio").value = "";
  document.getElementById("finalizacao").value = "";
  document.getElementById("listaItensForm").innerHTML = "";

  if (EQUIPES.length) {
    document.getElementById("equipeId").value = String(EQUIPES[0].id);
  }

  adicionarLinhaItem();
  atualizarTotalFormulario();
  document.getElementById("modalFormulario").classList.remove("oculto");
}

async function abrirFormularioEdicao(idChamado) {
  const chamado = CHAMADOS.find((item) => item.id === idChamado);

  if (!chamado) {
    alert("Chamado não encontrado.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("vw_chamado_itens_detalhado")
    .select("*")
    .eq("chamado_id", idChamado)
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao carregar itens para edição:", error);
    alert("Não foi possível carregar os itens do chamado.");
    return;
  }

  document.getElementById("tituloFormulario").textContent = `Editar chamado ${idChamado}`;
  document.getElementById("chamadoId").value = chamado.id;
  document.getElementById("idManual").value = chamado.id;
  document.getElementById("solicitante").value = chamado.solicitante || "";
  document.getElementById("unidade").value = chamado.unidade || "";
  document.getElementById("setor").value = chamado.setor || "";
  document.getElementById("problema").value = chamado.problema || "";
  document.getElementById("manutencao").value = chamado.manutencao || "";
  document.getElementById("prioridade").value = chamado.prioridade || "Média";
  document.getElementById("status").value = chamado.status || "Aberto";
  document.getElementById("equipeId").value = chamado.equipe_id ? String(chamado.equipe_id) : "";
  document.getElementById("criacao").value = paraInputDateTime(chamado.criacao);
  document.getElementById("inicio").value = paraInputDateTime(chamado.inicio);
  document.getElementById("finalizacao").value = paraInputDateTime(chamado.finalizacao);
  document.getElementById("observacao").value = chamado.observacao || "";

  const tbody = document.getElementById("listaItensForm");
  tbody.innerHTML = "";

  if (!data?.length) {
    adicionarLinhaItem();
  } else {
    data.forEach((item) => {
      adicionarLinhaItem({
        servico: item.servico,
        cargo_id: item.cargo_id,
        quantidade: item.quantidade,
        horas: item.horas,
        observacao: item.observacao || ""
      });
    });
  }

  atualizarTotalFormulario();
  document.getElementById("modalFormulario").classList.remove("oculto");
}

function fecharFormulario() {
  document.getElementById("modalFormulario").classList.add("oculto");
}

function aoTrocarEquipeFormulario() {
  document.querySelectorAll("#listaItensForm .linha-item").forEach((linha) => {
    atualizarSelectCargoLinha(linha);
    recalcularLinha(linha);
  });

  atualizarTotalFormulario();
}

function adicionarLinhaItem(dados = {}) {
  const template = document.getElementById("templateLinhaItem");
  const clone = template.content.cloneNode(true);
  const linha = clone.querySelector(".linha-item");

  const inputServico = linha.querySelector(".item-servico");
  const selectCargo = linha.querySelector(".item-cargo");
  const inputQuantidade = linha.querySelector(".item-quantidade");
  const inputHoras = linha.querySelector(".item-horas");
  const inputObservacao = linha.querySelector(".item-observacao");
  const btnRemover = linha.querySelector(".item-remover");

  inputServico.value = dados.servico || "";
  inputQuantidade.value = dados.quantidade ?? 1;
  inputHoras.value = dados.horas ?? 0;
  inputObservacao.value = dados.observacao || "";

  atualizarSelectCargoLinha(linha, dados.cargo_id);

  selectCargo.addEventListener("change", () => {
    recalcularLinha(linha);
    atualizarTotalFormulario();
  });

  inputQuantidade.addEventListener("input", () => {
    recalcularLinha(linha);
    atualizarTotalFormulario();
  });

  inputHoras.addEventListener("input", () => {
    recalcularLinha(linha);
    atualizarTotalFormulario();
  });

  btnRemover.addEventListener("click", () => {
    linha.remove();
    if (!document.querySelectorAll("#listaItensForm .linha-item").length) {
      adicionarLinhaItem();
    }
    atualizarTotalFormulario();
  });

  document.getElementById("listaItensForm").appendChild(linha);
  recalcularLinha(linha);
  atualizarTotalFormulario();
}

function atualizarSelectCargoLinha(linha, cargoSelecionadoId = null) {
  const equipeId = Number(document.getElementById("equipeId").value);
  const selectCargo = linha.querySelector(".item-cargo");

  const opcoes = EQUIPE_CARGOS.filter((item) => Number(item.equipe_id) === equipeId);

  selectCargo.innerHTML = "";

  opcoes.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.cargo_id;
    option.textContent = `${item.cargo_nome} — ${formatarMoeda(Number(item.valor_hora || 0))}`;
    selectCargo.appendChild(option);
  });

  if (cargoSelecionadoId) {
    selectCargo.value = String(cargoSelecionadoId);
  }

  if (!selectCargo.value && opcoes.length) {
    selectCargo.value = String(opcoes[0].cargo_id);
  }
}

function recalcularLinha(linha) {
  const equipeId = Number(document.getElementById("equipeId").value);
  const cargoId = Number(linha.querySelector(".item-cargo").value);
  const quantidade = Number(linha.querySelector(".item-quantidade").value || 0);
  const horas = Number(linha.querySelector(".item-horas").value || 0);

  const configCargo = EQUIPE_CARGOS.find(
    (item) => Number(item.equipe_id) === equipeId && Number(item.cargo_id) === cargoId
  );

  const valorHora = Number(configCargo?.valor_hora || 0);
  const valorTotal = quantidade * horas * valorHora;

  linha.querySelector(".item-valor-hora").textContent = formatarMoeda(valorHora);
  linha.querySelector(".item-valor-total").textContent = formatarMoeda(valorTotal);
  linha.dataset.valorTotal = String(valorTotal);
}

function atualizarTotalFormulario() {
  let total = 0;

  document.querySelectorAll("#listaItensForm .linha-item").forEach((linha) => {
    total += Number(linha.dataset.valorTotal || 0);
  });

  document.getElementById("totalFormulario").textContent = formatarMoeda(total);
}

async function salvarChamadoCompleto(event) {
  event.preventDefault();

  const pin = await obterPinAdmin();
  if (!pin) return;

  const chamadoAtualId = document.getElementById("chamadoId").value.trim();
  const idManual = document.getElementById("idManual").value.trim();

  const payloadChamado = {
    id: chamadoAtualId || idManual || null,
    solicitante: document.getElementById("solicitante").value.trim(),
    unidade: document.getElementById("unidade").value.trim(),
    setor: document.getElementById("setor").value.trim(),
    problema: document.getElementById("problema").value.trim(),
    manutencao: document.getElementById("manutencao").value.trim(),
    prioridade: document.getElementById("prioridade").value,
    status: document.getElementById("status").value,
    criacao: fromInputDateTime(document.getElementById("criacao").value),
    inicio: fromInputDateTime(document.getElementById("inicio").value),
    finalizacao: fromInputDateTime(document.getElementById("finalizacao").value),
    equipe_id: Number(document.getElementById("equipeId").value),
    observacao: document.getElementById("observacao").value.trim() || null
  };

  const itens = [];

  for (const linha of document.querySelectorAll("#listaItensForm .linha-item")) {
    const servico = linha.querySelector(".item-servico").value.trim();
    const cargo_id = Number(linha.querySelector(".item-cargo").value);
    const quantidade = Number(linha.querySelector(".item-quantidade").value || 0);
    const horas = Number(linha.querySelector(".item-horas").value || 0);
    const observacao = linha.querySelector(".item-observacao").value.trim() || null;

    if (!servico) {
      alert("Preencha a descrição do serviço em todos os itens.");
      return;
    }

    itens.push({
      servico,
      cargo_id,
      quantidade,
      horas,
      observacao
    });
  }

  if (!itens.length) {
    alert("Inclua pelo menos um item no chamado.");
    return;
  }

  try {
    const respostaChamado = await chamarFuncaoProtegida(FUNCTION_UPSERT_CHAMADO, pin, payloadChamado);
    const chamadoIdSalvo = respostaChamado.id;

    await chamarFuncaoProtegida(FUNCTION_REPLACE_ITENS, pin, {
      chamado_id: chamadoIdSalvo,
      itens
    });

    fecharFormulario();
    await carregarChamados();

    await mostrarNotificacao(
      chamadoAtualId ? "Chamado atualizado" : "Chamado criado",
      `Chamado ${chamadoIdSalvo} salvo com sucesso.`
    );
  } catch (error) {
    console.error("Erro ao salvar chamado:", error);
    alert(error.message || "Não foi possível salvar o chamado.");
  }
}

async function deletarChamado(idChamado) {
  const confirmado = confirm(`Deseja realmente deletar o chamado ${idChamado}? Essa ação remove também os itens do chamado.`);
  if (!confirmado) return;

  const pin = await obterPinAdmin();
  if (!pin) return;

  try {
    await chamarFuncaoProtegida(FUNCTION_DELETE_CHAMADO, pin, { id: idChamado });

    fecharDetalhes();
    CHAMADOS = CHAMADOS.filter((item) => item.id !== idChamado);
    aplicarFiltros();

    await mostrarNotificacao("Chamado deletado", `O chamado ${idChamado} foi removido com sucesso.`);
  } catch (error) {
    console.error("Erro ao deletar chamado:", error);
    alert(error.message || "Não foi possível deletar o chamado.");
  }
}

async function chamarFuncaoProtegida(nomeFuncao, pin, body) {
  const resposta = await fetch(`${SUPABASE_URL}/functions/v1/${nomeFuncao}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
      "x-admin-pin": pin
    },
    body: JSON.stringify(body)
  });

  const payload = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(payload.error || `Falha na função ${nomeFuncao}.`);
  }

  return payload;
}

async function obterPinAdmin() {
  let pin = sessionStorage.getItem("admin_pin");

  if (!pin) {
    pin = prompt("Informe o PIN administrativo:");
  }

  if (!pin) return null;

  sessionStorage.setItem("admin_pin", pin);
  return pin;
}

function ouvirMudancasTempoReal() {
  supabaseClient
    .channel("public:chamados")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chamados" },
      async (payload) => {
        await carregarChamados();
        await mostrarNotificacao("Novo chamado", `Novo chamado criado: ${payload.new.id}`);
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "chamados" },
      async (payload) => {
        await carregarChamados();
        const status = payload.new?.status ? ` (${payload.new.status})` : "";
        await mostrarNotificacao("Chamado atualizado", `Chamado ${payload.new.id}${status}`);
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "chamados" },
      async (payload) => {
        await carregarChamados();
        await mostrarNotificacao("Chamado excluído", `Chamado removido: ${payload.old.id}`);
      }
    )
    .subscribe();
}

async function mostrarNotificacao(titulo, corpo) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  if (serviceWorkerRegistration) {
    await serviceWorkerRegistration.showNotification(titulo, {
      body: corpo,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: "chamados-engenharia",
      renotify: true
    });
    return;
  }

  new Notification(titulo, { body: corpo });
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarData(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR");
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paraInputDateTime(valor) {
  if (!valor) return "";
  const data = new Date(valor);
  const offset = data.getTimezoneOffset();
  const local = new Date(data.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromInputDateTime(valor) {
  if (!valor) return null;
  return new Date(valor).toISOString();
}

function obterAgoraLocal() {
  return paraInputDateTime(new Date().toISOString());
}