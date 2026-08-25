import { dataHora } from "../util/util.js";
import { getChatproSessoes } from "./sessoes.js";
import { getChatproMensagensPorSessoes } from "./mensagens.js";
import { identificarMensagemNomePorConversa } from "./ancora.js";

export async function syncChatproEventos() {
  console.log(`[${dataHora()}][sync.js] Sincronizando sessões e conversas do ChatPro...`);

  const sessoes = await getChatproSessoes();
  console.log(`[${dataHora()}][sync.js] Total de sessões: ${sessoes.length}`);

  const sessoesComMensagens = await getChatproMensagensPorSessoes(sessoes);
  console.log(`[${dataHora()}][sync.js] Processamento concluído para ${sessoesComMensagens.length} sessão(ões)`);

  const conversasComAncora = await identificarMensagemNomePorConversa();

  return { sessoes, sessoesComMensagens, conversasComAncora };
}
