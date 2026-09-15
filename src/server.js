// server.js
import "dotenv/config";
import express from "express";
import cron from "node-cron";
import { supabase } from "./database/supabase.js";
import { getJetimobLeads } from "./jetimob/leads.js";
import { dataHora } from "./util/util.js";
import { getChatproContatos } from "./chatpro/contatos.js";
import { getSupaBase_ContatosJetiMob, getTelefonesContatosJetimob, telefoneCadastradoNoJetimob } from "./database/contatos_jetimob.js";
import { syncChatproEventos } from "./chatpro/sync.js";
import { inserirLeadsJetiMob } from "./jetimob/leads.js"

const app = express();

//Busca os contatos ja cadastrados no Jetimob e insere na tabela "Contatos_JetiMob"
async function syncJetimobLeads() {
  console.log(`[${dataHora()}][server.js] Sincronizando leads do Jetimob...`);
  const leadsJetiMob = await getJetimobLeads();
  const leads_contatosJetimob = await getSupaBase_ContatosJetiMob();

  console.log(`[${dataHora()}][server.js] syncJetimobLeads: ${leadsJetiMob.total} leads retornados do JetiMob`);
  console.log(`[${dataHora()}][server.js] syncJetimobLeads: ${leads_contatosJetimob.length} leads retornados do Supabase`);

  const telefonesCadastrados = new Set(
    (leads_contatosJetimob ?? []).map((contato) => contato.num_telefone)
  );

  //filtra e insere apenas os telefones nao cadastrados ainda
  const registros = [];
  if (leadsJetiMob?.result) {
    for (const lead of leadsJetiMob.result) {
      for (const telefone of lead.phones) {
        if (!telefonesCadastrados.has(telefone)) {
          registros.push({ nome_contato: lead.full_name, num_telefone: telefone });
        }
      }
    }

    //Inserir os registros na tabela "Contatos_JetiMob" (uma única requisição)
    if (registros.length > 0) {
      console.log(`[${dataHora()}][server.js] syncJetimobLeads: ${registros.length} leads enviados para tabela Contatos_JetiMob`);
      cadastrarJetimobContatos(registros)
    } else {
      console.log(`[${dataHora()}][server.js] syncJetimobLeads: Não foram encontrados registros a serem enviados para tabela Contatos_JetiMob`);
    }
  }

}

async function cadastrarJetimobContatos(registros) {
  const { error } = await supabase
    .from("Contatos_JetiMob")
    .insert(registros);

  if (error) {
    console.error(`[${dataHora()}][server.js] error.message: ${error.message}`);
    console.error(`[${dataHora()}][server.js] error.details: ${error.details}`);
    return;
  }

  console.log(`[${dataHora()}][server.js] ${registros.length} lead(s) inserido(s).`);
}

let syncChatproEmAndamento = false;

export async function executarSyncChatproEventos() {
  if (syncChatproEmAndamento) {
    console.log(`[${dataHora()}][server.js] Sincronização ChatPro já em andamento, execução ignorada`);
    return;
  }

  syncChatproEmAndamento = true;
  try {
    await syncJetimobLeads();
    await syncChatproEventos();
    await inserirLeadsJetiMob();
  } catch (error) {
    console.error(`[${dataHora()}][server.js] Falha na sincronização ChatPro: ${error.message}`);
  } finally {
    syncChatproEmAndamento = false;
  }
}

app.post("/sync/chatpro-eventos", (req, res) => {
  if (syncChatproEmAndamento) {
    return res.status(409).json({
      ok: false,
      message: "Sincronização ChatPro já em andamento",
    });
  }

  executarSyncChatproEventos().catch((error) => {
    console.error(`[${dataHora()}][server.js] Falha ao iniciar sincronização ChatPro: ${error.message}`);
  });

  return res.status(202).json({
    ok: true,
    message: "Sincronização ChatPro iniciada",
  });
});

const porta = Number(process.env.PORT) || 3000;

app.listen(porta, () => {
  console.log(`[${dataHora()}][server.js] Servidor Express ouvindo na porta ${porta}`);
});