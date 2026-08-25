import { dataHora, normalizarTexto, obterMensagemNomeNormalizada } from "../util/util.js";
import { getEventosChatProOrdenados } from "../database/eventos_chatpro.js";
import { getTelefonesContatosJetimob, telefoneCadastradoNoJetimob } from "../database/contatos_jetimob.js";
import { getTelefonesLeads, inserirLeads } from "../database/leads.js";

const TIPOS_ENVIO = new Set([
  "sent_message",
  "send_message",
  "send_text_message",
]);

const TIPOS_RECEBIMENTO = new Set([
  "received_message",
  "receveid_message",
]);

const PREFIXOS_NOME = /^(?:meu nome [ée]|me chamo|eu sou|sou o|sou a)\s+/i;
const SAUDACOES = new Set([
  "oi", "ola", "oie", "olaa", "ok", "sim", "nao", "bom dia", "boa tarde", "boa noite",
  "obrigado", "obrigada", "valeu", "blz", "beleza",
]);

function chaveConversa(evento) {
  return evento?.num_telefone || evento?.session_id || "";
}

function compararTimestamp(a, b) {
  const tsA = a?.messageTimestamp;
  const tsB = b?.messageTimestamp;

  if (tsA == null && tsB == null) return 0;
  if (tsA == null) return 1;
  if (tsB == null) return -1;

  if (typeof tsA === "string" || typeof tsB === "string") {
    return new Date(tsA).getTime() - new Date(tsB).getTime();
  }

  return Number(tsA) - Number(tsB);
}

function agruparEventosPorConversa(eventos) {
  const conversas = new Map();

  for (const evento of eventos) {
    const chave = chaveConversa(evento);
    if (!chave) {
      continue;
    }

    if (!conversas.has(chave)) {
      conversas.set(chave, []);
    }

    conversas.get(chave).push(evento);
  }

  for (const mensagens of conversas.values()) {
    mensagens.sort(compararTimestamp);
  }

  return conversas;
}

function telefoneDaConversa(mensagens) {
  return mensagens.find((evento) => evento.num_telefone)?.num_telefone ?? "";
}

export function mensagemCorrespondeAncora(evento, ancoraNormalizada) {
  const texto = normalizarTexto(evento?.mensagem);

  if (!texto || !ancoraNormalizada) {
    return false;
  }

  if (texto === ancoraNormalizada) {
    return true;
  }

  if (texto.includes(ancoraNormalizada) || ancoraNormalizada.includes(texto)) {
    const menor = Math.min(texto.length, ancoraNormalizada.length);
    const maior = Math.max(texto.length, ancoraNormalizada.length);
    return menor >= 20 && menor / maior >= 0.6;
  }

  return false;
}

function encontrarMensagemAncora(mensagens, ancoraNormalizada) {
  const candidatas = mensagens.filter((evento) => mensagemCorrespondeAncora(evento, ancoraNormalizada));

  if (candidatas.length === 0) {
    return null;
  }

  return candidatas.find((evento) => TIPOS_ENVIO.has(evento.tipo_evento)) ?? candidatas[0];
}

function ehMensagemRecebida(evento) {
  return TIPOS_RECEBIMENTO.has(evento?.tipo_evento) || !TIPOS_ENVIO.has(evento?.tipo_evento);
}

function pareceNome(texto) {
  const normalizado = normalizarTexto(texto);

  if (!normalizado || SAUDACOES.has(normalizado)) {
    return false;
  }

  const palavras = normalizado.split(" ");
  if (palavras.length === 0 || palavras.length > 6 || normalizado.length > 60) {
    return false;
  }

  return /[a-z]/.test(normalizado);
}

export function extrairNomeDoTexto(texto) {
  const primeiraLinha = String(texto ?? "").split(/\r?\n/)[0].trim();

  if (!primeiraLinha) {
    return "";
  }

  let candidato = primeiraLinha.replace(PREFIXOS_NOME, "").split(/[,.]/)[0].trim();
  candidato = candidato.replace(/\s+/g, " ");

  return pareceNome(candidato) ? candidato : "";
}

function indiceDaAncora(mensagens, ancora) {
  return mensagens.findIndex((evento) => (
    evento === ancora
    || (ancora.message_id && evento.message_id === ancora.message_id)
  ));
}

export function encontrarNomeLead(mensagens, ancora, ancoraNormalizada) {
  if (!ancora) {
    return { nome: "", origem: null, mensagem: null };
  }

  const indice = indiceDaAncora(mensagens, ancora);
  if (indice < 0) {
    return { nome: "", origem: null, mensagem: null };
  }

  for (let i = indice + 1; i < mensagens.length; i += 1) {
    const evento = mensagens[i];
    if (!ehMensagemRecebida(evento) || mensagemCorrespondeAncora(evento, ancoraNormalizada)) {
      continue;
    }

    const nome = extrairNomeDoTexto(evento.mensagem);
    if (nome) {
      return { nome, origem: "depois", mensagem: evento };
    }
  }

  for (let i = indice - 1; i >= 0; i -= 1) {
    const evento = mensagens[i];
    if (!ehMensagemRecebida(evento)) {
      continue;
    }

    const nome = extrairNomeDoTexto(evento.mensagem);
    if (nome) {
      return { nome, origem: "antes", mensagem: evento };
    }
  }

  const pushName = ancora.PushName || mensagens.find((evento) => evento.PushName)?.PushName;
  if (pushName && pareceNome(pushName)) {
    return { nome: String(pushName).trim(), origem: "pushname", mensagem: null };
  }

  return { nome: "", origem: null, mensagem: null };
}

export async function identificarMensagemNomePorConversa() {
  const ancoraNormalizada = obterMensagemNomeNormalizada();
  const telefonesJetimob = await getTelefonesContatosJetimob();
  const telefonesLeads = await getTelefonesLeads();
  console.log(`[${dataHora()}][ancora.js] MENSAGEM_NOME normalizada: ${ancoraNormalizada}`);

  const eventos = await getEventosChatProOrdenados();
  const conversas = agruparEventosPorConversa(eventos);
  const resultados = [];
  const leadsParaInserir = [];

  for (const [chave, mensagens] of conversas) {
    const numTelefone = telefoneDaConversa(mensagens);

    if (numTelefone && telefoneCadastradoNoJetimob(numTelefone, telefonesJetimob)) {
      continue;
    }

    if (numTelefone && telefoneCadastradoNoJetimob(numTelefone, telefonesLeads)) {
      continue;
    }

    const ancora = encontrarMensagemAncora(mensagens, ancoraNormalizada);
    const lead = encontrarNomeLead(mensagens, ancora, ancoraNormalizada);
    const primeira = mensagens[0];

    resultados.push({
      conversa: chave,
      session_id: primeira?.session_id ?? "",
      num_telefone: numTelefone,
      totalMensagens: mensagens.length,
      ancora,
      nome_lead: lead.nome,
      origem_nome: lead.origem,
      mensagem_nome: lead.mensagem,
      mensagens,
    });

    if (ancora && lead.nome) {
      console.log(`[${dataHora()}][ancora.js] Conversa ${chave}: âncora encontrada, nome="${lead.nome}" (${lead.origem})`);

      if (numTelefone) {
        leadsParaInserir.push({
          nome_contato: lead.nome,
          num_telefone: numTelefone,
        });
      }
    } else if (ancora) {
      console.log(`[${dataHora()}][ancora.js] Conversa ${chave}: âncora encontrada, nome do lead não identificado`);
    } else {
      // console.log(`[${dataHora()}][ancora.js] Conversa ${chave}: MENSAGEM_NOME não encontrada`);
    }
  }

  const comAncora = resultados.filter((item) => item.ancora).length;
  const comNome = resultados.filter((item) => item.nome_lead).length;
  console.log(`[${dataHora()}][ancora.js] ${resultados.length} conversa(s) novas | ${comAncora} com âncora | ${comNome} com nome`);

  if (leadsParaInserir.length > 0) {
    const leadsNovos = [];
    const telefonesLote = new Set(telefonesLeads);

    for (const lead of leadsParaInserir) {
      if (telefoneCadastradoNoJetimob(lead.num_telefone, telefonesLote)) {
        continue;
      }

      leadsNovos.push(lead);
      const digitos = String(lead.num_telefone).replace(/\D/g, "");
      if (digitos) {
        telefonesLote.add(digitos);
      }
    }

    if (leadsNovos.length > 0) {
      await inserirLeads(leadsNovos);
    } else {
      console.log(`[${dataHora()}][ancora.js] Nenhum lead novo para inserir (${leadsParaInserir.length} já cadastrado(s) em Leads)`);
    }
  }

  return resultados;
}
