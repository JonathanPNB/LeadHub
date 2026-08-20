import { dataHora } from "../util/util.js";
import { supabase } from "./supabase.js";

const PAGE_LIMIT = 1000;

export function chaveEventoChatPro(registro) {
  if (registro?.message_id) {
    return `id:${registro.message_id}`;
  }

  return [
    "cmp",
    registro?.session_id ?? "",
    registro?.messageTimestamp ?? "",
    registro?.num_telefone ?? "",
    registro?.tipo_evento ?? "",
    registro?.mensagem ?? "",
  ].join("|");
}

export async function getEventosChatProPorSessao(sessionId) {
  const eventos = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("Eventos_chatPro")
      .select("message_id, session_id, messageTimestamp, num_telefone, tipo_evento, mensagem")
      .eq("session_id", sessionId)
      .range(offset, offset + PAGE_LIMIT - 1);

    if (error) {
      console.error(`[${dataHora()}][eventos_chatpro.js] error.message: ${error.message}`);
      console.error(`[${dataHora()}][eventos_chatpro.js] error.details: ${error.details}`);
      throw error;
    }

    const pagina = data ?? [];
    eventos.push(...pagina);

    if (pagina.length < PAGE_LIMIT) {
      break;
    }

    offset += PAGE_LIMIT;
  }

  return eventos;
}

export function filtrarEventosNovos(registros, eventosExistentes) {
  const chavesExistentes = new Set(eventosExistentes.map(chaveEventoChatPro));
  const novos = [];

  for (const registro of registros) {
    const chave = chaveEventoChatPro(registro);

    if (chavesExistentes.has(chave)) {
      continue;
    }

    chavesExistentes.add(chave);
    novos.push(registro);
  }

  return novos;
}

export async function inserirEventosChatPro(registros) {
  const { error } = await supabase
    .from("Eventos_chatPro")
    .insert(registros);

  if (error) {
    console.error(`[${dataHora()}][eventos_chatpro.js] error.message: ${error.message}`);
    console.error(`[${dataHora()}][eventos_chatpro.js] error.details: ${error.details}`);
    throw error;
  }

  console.log(`[${dataHora()}][eventos_chatpro.js] ${registros.length} evento(s) inserido(s).`);
}
