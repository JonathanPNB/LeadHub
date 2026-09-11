import "dotenv/config";
import { dataHora } from "./util/util.js";
import { executarSyncChatproEventos } from "./server.js"

executarSyncChatproEventos().catch((error) => {
  console.error(`[${dataHora()}][index.js] Falha ao buscar sessões/mensagens: ${error.message}`);
  process.exitCode = 1;
});