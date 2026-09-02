import { dataHora, fetchComRetry429 } from "../util/util.js";

const SPARKS_SESSIONS_LIST_URL = "https://sparks.chatpro.com.br/sessions/list";
const PAGE_LIMIT = 100;

function extrairSessoes(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function chaveSessao(sessao) {
  return sessao?.id ?? sessao?.sessionId ?? sessao?.session_id ?? JSON.stringify(sessao);
}

function intervaloHojeSaoPaulo() {
  return new Date(`2026-09-02T00:00:00.000Z`).toISOString()
}

async function buscarPaginaSessoes({ instanceId, instanceToken, offset, limit, open, start, end }) {
  const body = { instanceId, limit, offset, start, end };

  if (typeof open === "boolean") {
    body.open = open;
  }

  console.log(`[${dataHora()}][sessoes.js] Buscando sessões offset=${offset} limit=${limit} start=${start} ${typeof open === "boolean" ? ` open=${open}` : ""}`);

  const response = await fetchComRetry429(SPARKS_SESSIONS_LIST_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "instance-token": instanceToken,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detalhe = await response.text();
    throw new Error(`Erro na requisição sessions/list: ${response.status} ${detalhe}`);
  }

  return response.json();
}

async function buscarSessoesPorStatus({ instanceId, instanceToken, open, start }) {
  const sessoes = [];
  let offset = 0;

  while (true) {
    const payload = await buscarPaginaSessoes({
      instanceId,
      instanceToken,
      offset,
      limit: PAGE_LIMIT,
      open,
      start
    });
    const pagina = extrairSessoes(payload);

    if (pagina.length === 0) {
      break;
    }

    sessoes.push(...pagina);

    if (pagina.length < PAGE_LIMIT) {
      break;
    }

    offset += PAGE_LIMIT;
  }

  return sessoes;
}

// Busca todas as sessões (abertas e finalizadas) no Sparks ChatPro
export async function getChatproSessoes() {
  try {
    const instanceId = process.env.CHATPRO_INSTANCE_ID;
    const instanceToken = process.env.CHATPRO_INSTANCE_TOKEN;

    if (!instanceId || !instanceToken) {
      throw new Error("CHATPRO_INSTANCE_ID e CHATPRO_INSTANCE_TOKEN são obrigatórios");
    }

    const start = intervaloHojeSaoPaulo();
    console.log(`[${dataHora()}][sessoes.js] Iniciando requisição para ${SPARKS_SESSIONS_LIST_URL} (Inicio: ${start}`);

    const [abertas] = await Promise.all([
      buscarSessoesPorStatus({ instanceId, instanceToken, open: true, start }),
    ]);

    const sessoesPorId = new Map();
    for (const sessao of [...abertas]) {
      sessoesPorId.set(chaveSessao(sessao), sessao);
    }

    const sessoes = [...sessoesPorId.values()];
    console.log(`[${dataHora()}][sessoes.js] ${sessoes.length} sessões retornada(s)`);
    return sessoes;
  } catch (error) {
    console.error(`[${dataHora()}][sessoes.js] Erro ao buscar sessões: ${error.message}`);
    throw error;
  }
}
