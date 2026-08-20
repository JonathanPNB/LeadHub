import "dotenv/config";
import { dataHora } from "./util/util.js";
import { syncChatproEventos } from "./chatpro/sync.js";

syncChatproEventos().catch((error) => {
  console.error(`[${dataHora()}][index.js] Falha ao buscar sessões/mensagens: ${error.message}`);
  process.exitCode = 1;
});
