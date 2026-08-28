import "dotenv/config";
import { dataHora } from "./util/util.js";
import { syncChatproEventos } from "./chatpro/sync.js";
import { inserirLeadsJetiMob } from "./jetimob/leads.js"

// inserirLeadsJetiMob().catch((error) => {
//   console.error(`[${dataHora()}][index.js] Falha ao buscar Leads: ${error.message}`);
//   process.exitCode = 1;
// });


syncChatproEventos().catch((error) => {
  console.error(`[${dataHora()}][index.js] Falha ao buscar sessões/mensagens: ${error.message}`);
  process.exitCode = 1;
});
