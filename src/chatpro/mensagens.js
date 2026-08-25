import { dataHora, fetchComRetry429 } from "../util/util.js";
import { filtrarEventosNovos, getEventosChatProPorSessao, inserirEventosChatPro } from "../database/eventos_chatpro.js";
import { getTelefonesContatosJetimob, telefoneCadastradoNoJetimob } from "../database/contatos_jetimob.js";

const SPARKS_MESSAGES_GET_ALL_URL = "https://sparks.chatpro.com.br/messages/getAll";
const PAGE_LIMIT = 100;
const REGEX_TELEFONE = /^([1-9]{2})(([1-9]{2}))(\d{4,5})(\d{4})$/;

function extrairMensagens(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function obterSessionId(sessao) {
  return sessao?.id ?? sessao?.sessionId ?? sessao?.session_id;
}

function obterMessageId(mensagem) {
  return mensagem?.id;
}

function obterTsReceive(mensagem) {
  return mensagem?.ts_receive ?? mensagem?.tsReceive;
}

function compararTsReceive(a, b) {
  const tsA = obterTsReceive(a);
  const tsB = obterTsReceive(b);

  if (tsA == null && tsB == null) return 0;
  if (tsA == null) return 1;
  if (tsB == null) return -1;

  if (typeof tsA === "string" || typeof tsB === "string") {
    return new Date(tsA).getTime() - new Date(tsB).getTime();
  }

  return Number(tsA) - Number(tsB);
}

export function ordenarMensagensPorTsReceive(mensagens) {
  return [...mensagens].sort(compararTsReceive);
}

function obterTelefoneSessao(sessao) {
  const numero = sessao?.number
    ?? sessao?.lead?.number
    ?? sessao?.lead?.phone
    ?? sessao?.contact?.number
    ?? "";

  return obterTelefone({ number: numero });
}

function obterTelefoneConversa(sessao, registros) {
  const telefoneSessao = obterTelefoneSessao(sessao);
  if (telefoneSessao) {
    return telefoneSessao;
  }

  return registros.find((registro) => registro.num_telefone)?.num_telefone ?? "";
}

function obterTelefone(mensagem) {
  const numero = mensagem?.number ?? mensagem?.numero ?? "";

  if (typeof numero !== "string") {
    return "";
  }

  if (numero.includes("@")) {
    return numero.substring(0, numero.indexOf("@"));
  }

  return numero;
}

function obterTipoEvento(mensagem) {
  if (mensagem?.type) return mensagem.type;
  if (mensagem?.fromMe === true) return "sent_message";
  if (mensagem?.fromMe === false) return "received_message";
  return "message";
}

function mensagemParaRegistro(mensagem, sessionId) {
  return {
    tipo_evento: obterTipoEvento(mensagem),
    num_telefone: obterTelefone(mensagem),
    mensagem: mensagem?.message ?? mensagem?.body ?? mensagem?.text ?? "",
    PushName: mensagem?.PushName ?? mensagem?.pushName ?? mensagem?.pushname ?? "",
    messageTimestamp: obterTsReceive(mensagem) ?? mensagem?.timestamp ?? 0,
    session_id: sessionId,
    message_id: obterMessageId(mensagem)
  };
}

function mensagensParaRegistros(mensagens, sessionId) {
  return mensagens
    .map((mensagem) => mensagemParaRegistro(mensagem, sessionId))
    .filter((registro) => (
      registro.num_telefone.trim()
      && registro.mensagem.trim()
      && REGEX_TELEFONE.test(registro.num_telefone)
    ));
}

async function buscarPaginaMensagens({ instanceId, instanceToken, sessionId, offset, limit }) {
  const response = await fetchComRetry429(SPARKS_MESSAGES_GET_ALL_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "instance-token": instanceToken,
    },
    body: JSON.stringify({
      instanceId,
      sessionId,
      limit,
      offset,
    }),
  });

  if (!response.ok) {
    const detalhe = await response.text();
    throw new Error(`Erro na requisição messages/getAll (sessionId=${sessionId}): ${response.status} ${detalhe}`);
  }

  return response.json();
}

// Busca todas as mensagens de uma sessão no Sparks ChatPro
export async function getChatproMensagensPorSessao(sessionId) {
  const instanceId = process.env.CHATPRO_INSTANCE_ID;
  const instanceToken = process.env.CHATPRO_INSTANCE_TOKEN;

  if (!instanceId || !instanceToken) {
    throw new Error("CHATPRO_INSTANCE_ID e CHATPRO_INSTANCE_TOKEN são obrigatórios");
  }

  if (!sessionId) {
    throw new Error("sessionId é obrigatório");
  }

  const mensagens = [];
  let offset = 0;

  while (true) {
    const payload = await buscarPaginaMensagens({
      instanceId,
      instanceToken,
      sessionId,
      offset,
      limit: PAGE_LIMIT,
    });
    const pagina = extrairMensagens(payload);

    if (pagina.length === 0) {
      break;
    }

    mensagens.push(...pagina);

    if (pagina.length < PAGE_LIMIT) {
      break;
    }

    offset += PAGE_LIMIT;
  }

  return mensagens;
}

// Busca todas as mensagens de cada sessão informada
export async function getChatproMensagensPorSessoes(sessoes) {
  const resultados = [];
  const telefonesJetimob = await getTelefonesContatosJetimob();
  console.log(`[${dataHora()}][mensagens.js] ${telefonesJetimob.size} telefone(s) cadastrado(s) em Contatos_JetiMob`);

  for (const sessao of sessoes) {
    const sessionId = obterSessionId(sessao);

    if (!sessionId) {
      console.warn(`[${dataHora()}][mensagens.js] Sessão sem id ignorada: ${JSON.stringify(sessao)}`);
      continue;
    }

    const telefoneSessao = obterTelefoneSessao(sessao);
    if (telefoneSessao && telefoneCadastradoNoJetimob(telefoneSessao, telefonesJetimob)) {
      console.warn(`[${dataHora()}][mensagens.js] Sessão ${sessionId}: telefone ${telefoneSessao} já cadastrado no Jetimob, conversa ignorada`);
      continue;
    }

    // console.log(`[${dataHora()}][mensagens.js] Buscando mensagens da sessão ${sessionId}...`);
    const mensagens = await getChatproMensagensPorSessao(sessionId);
    const mensagensOrdenadas = ordenarMensagensPorTsReceive(mensagens);
    // console.log(`[${dataHora()}][mensagens.js] Sessão ${sessionId}: ${mensagensOrdenadas.length} mensagem(ns)`);

    const registros = mensagensParaRegistros(mensagensOrdenadas, sessionId);
    const telefoneConversa = obterTelefoneConversa(sessao, registros);

    if (telefoneConversa && telefoneCadastradoNoJetimob(telefoneConversa, telefonesJetimob)) {
      console.warn(`[${dataHora()}][mensagens.js] Sessão ${sessionId}: telefone ${telefoneConversa} já cadastrado no Jetimob, conversa não gravada`);
      resultados.push({ sessionId, sessao, mensagens: mensagensOrdenadas });
      continue;
    }

    if (registros.length === 0) {
      // console.log(`[${dataHora()}][mensagens.js] Sessão ${sessionId}: nenhum registro válido para inserir`);
    } else {
      const eventosExistentes = await getEventosChatProPorSessao(sessionId);
      const registrosNovos = filtrarEventosNovos(registros, eventosExistentes);

      if (registrosNovos.length > 0) {
        console.log(`[${dataHora()}][mensagens.js] Sessão ${sessionId}: ${registrosNovos.length} novo(s) / ${registros.length - registrosNovos.length} duplicado(s)`);
        await inserirEventosChatPro(registrosNovos);
      } else {
        // console.log(`[${dataHora()}][mensagens.js] Sessão ${sessionId}: nenhum registro novo para inserir (${registros.length} duplicado(s))`);
      }
    }

    resultados.push({ sessionId, sessao, mensagens: mensagensOrdenadas });
  }

  const totalMensagens = resultados.reduce((total, item) => total + item.mensagens.length, 0);
  console.log(`[${dataHora()}][mensagens.js] ${totalMensagens} mensagem(ns) em ${resultados.length} sessão(ões)`);

  return resultados;
}
