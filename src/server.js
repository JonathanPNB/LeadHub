// server.js
import "dotenv/config";
import express from "express";
import cron from "node-cron";
import { supabase } from "./database/supabase.js";
import { getJetimobLeads } from "./jetimob/leads.js";
import { dataHora } from "./util/util.js";
import { getChatproContatos } from "./chatpro/contatos.js";

const app = express();
app.use(express.json());

//Busca os contatos ja cadastrados no Jetimob e insere na tabela "Contatos_JetiMob"
async function syncJetimobLeads() {
  console.log(`[${dataHora()}][server.js] Sincronizando leads do Jetimob...`);
  const leads = await getJetimobLeads();

  console.log(`[${dataHora()}][server.js] syncJetimobLeads: ${JSON.stringify(leads, null, 2)}`);

  //Inserir os registros na tabela "Contatos_JetiMob" (uma única requisição)
  const registros = [];
  if (leads != null) {
    for (const lead of leads.dados) {
      registros.push({ nome_contato: lead.nome_contato, num_telefone: lead.num_telefone + Math.floor(Math.random() * (9 - 0 + 1)) + 0 })
    }

    if (registros.length > 0) {
      cadastrarJetimobLeads(registros)
    }
  }

}

async function cadastrarJetimobLeads(registros) {
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

//Busca os contatos ja cadastrados no chatpro e insere na tabela "Contatos_chatPro"
async function syncChatProContatos() {
  console.log(`[${dataHora()}][server.js] Sincronizando contatos do chatPro...`);
  const contatos = await getChatproContatos();

  console.log(`[${dataHora()}][server.js] syncChatProContatos: ${JSON.stringify(contatos, null, 2)}`);
  //cadastrar os contatos retornados na tabela 'Contatos_chatPro'
}

// Rota GET com Try/Catch
app.post("/chatpro/eventos", async (req, res) => {
  try {
    // Requisição ao Supabase
    const { data, error } = await supabase
      .from("Eventos_chatPro")
      .insert(req);

    // Verifica se o Supabase retornou um erro de banco/regra
    if (error) {
      console.error(`[${dataHora()}][server.js] error.message: ${error.message}`);
      console.error(`[${dataHora()}][server.js] error.details: ${error.details}`);
      return res.status(400).json({
        sucesso: false,
        error: error.message,
        details: error.details
      });
    }

    console.log(`[${dataHora()}][server.js] dados: ${JSON.stringify(data, null, 2)}`);
    // Retorno de sucesso
    res.json({ sucesso: true, dados: data });

  } catch (err) {
    // Captura erros críticos (ex: rede, crash do servidor, variáveis nulas)
    console.error(`[${dataHora()}] Erro interno no servidor: ${err}`);
    res.status(500).json({
      sucesso: false,
      erro: "Erro interno no servidor ao buscar dados."
    });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`[${dataHora()}] API rodando na porta ${process.env.PORT}`);

  //busca os leads do jetimob
  syncJetimobLeads();
  //busca os contatos do chatpro
  syncChatProContatos();
  //verifica quais contatos existem no chatpro porem ainda nao estao no jetimob
  // validContatos();

  const cronSchedule = process.env.JETIMOB_CRON_SCHEDULE || "0 * * * *";
  cron.schedule(cronSchedule, syncJetimobLeads);
  console.log(`[${dataHora()}][server.js] Cron job Jetimob agendado: ${cronSchedule}`);
});
