// server.js
import "dotenv/config";
import express from "express";
import cron from "node-cron";
import { supabase } from "./database/supabase.js";
import { getJetimobLeads } from "./jetimob/leads.js";
import { dataHora } from "./util/util.js";
import { getChatproContatos } from "./chatpro/contatos.js";
import { getSupaBase_ContatosJetiMob } from "./database/contatos_jetimob.js";

const app = express();
app.use(express.json());

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

// Rota GET com Try/Catch
app.post("/chatpro/eventos", async (req, res) => {
  try {
    const tipo = req.body.type || req.body.Type;
    if (tipo !== null && tipo !== undefined) {
      const registros = [];
      let telefone = "";
      let mensagem = "";

      switch (tipo) {
        case "send_text_message":
        case "received_message":
        case "sent_message":
        case "send_message":
          console.log(`[server.js] ${tipo} recebido`);
          telefone = req.body.Body.Info.RemoteJid.substring(1, req.body.Body.Info.RemoteJid.indexOf('@'));
          mensagem = req.body.Body.Text;
          break;
        default:
          console.log(`[server.js] ${tipo} recebido e não tratado`);
          break;
      }

      //filtra e insere apenas os telefones nao cadastrados ainda
      if (telefone !== null && telefone !== undefined && mensagem !== null && mensagem !== undefined) {
        registros.push({ tipo_evento: tipo, num_telefone: telefone, mensagem: mensagem });
      }

      // Requisição ao Supabase
      const { data, error } = await supabase
        .from("Eventos_chatPro")
        .insert(registros);

      // // Verifica se o Supabase retornou um erro de banco/regra
      if (error) {
        console.error(`[${dataHora()}][server.js] error.message: ${error.message}`);
        console.error(`[${dataHora()}][server.js] error.details: ${error.details}`);
        return res.status(400).json({
          sucesso: false,
          error: error.message,
          details: error.details
        });
      }

      console.log(`[${dataHora()}][server.js] chatpro/eventos: ${JSON.stringify(req.body, null, 2)}`);
    }
    // Retorno de sucesso
    res.json({ sucesso: true });

  } catch (err) {
    // Captura erros críticos (ex: rede, crash do servidor, variáveis nulas)
    console.error(`[${dataHora()}] Erro interno no servidor: ${err}`);
    res.status(500).json({
      sucesso: false,
      erro: "Erro interno no servidor ao buscar dados."
    });
  }
});

// Rota GET com Try/Catch
app.get('/jetimob/leads', async (req, res) => {
  try {
    // Requisição ao Supabase
    const { data, error } = await supabase
      .from('Contatos_JetiMob')
      .select('nome_contato, num_telefone');

    // Verifica se o Supabase retornou um erro de banco/regra
    if (error) {
      console.error("[server.js] error.message: " + error.message);
      console.error("[server.js] error.details: " + error.details);
      return res.status(400).json({
        sucesso: false,
        error: error.message,
        details: error.details
      });
    }

    // Retorno de sucesso
    res.json({ sucesso: true, dados: data });

  } catch (err) {
    // Captura erros críticos (ex: rede, crash do servidor, variáveis nulas)
    console.error('Erro interno no servidor:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno no servidor ao buscar dados.'
    });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`[${dataHora()}] API rodando na porta ${process.env.PORT}`);

  //busca os leads do jetimob
  syncJetimobLeads();

  const cronSchedule = process.env.JETIMOB_CRON_SCHEDULE || "0 * * * *";
  cron.schedule(cronSchedule, syncJetimobLeads);
  console.log(`[${dataHora()}][server.js] Cron job Jetimob agendado: ${cronSchedule}`);
});
