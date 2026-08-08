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
app.use(express.json({
  verify: (req, _res, buf) => {
    if (req.path === "/chatpro/eventos") {
      req.rawBody = buf;
    }
  },
}));

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

app.get('/leads', async (req, res) => {
  try {
    // Retorno de sucesso
    res.json({ sucesso: true });

  } catch (err) {
    // Captura erros críticos (ex: rede, crash do servidor, variáveis nulas)
    console.error('Erro interno no servidor:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno no servidor ao buscar dados.'
    });
  }
});

/* Exemplo para testar diretamento no navegador
fetch('http://localhost:3333/chatpro/eventos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({"nome":"jonathan"})
})
.then(resposta => resposta.json())
.then(resultado => {
  console.log("Sucesso:", resultado);
})
.catch(erro => {
  console.error("Erro na requisição:", erro);
});
*/

// Rota GET com Try/Catch
app.post("/chatpro/eventos", async (req, res) => {
  try {
    //ENVIO DE WEBHOOK PARA TESTES
    fetch(process.env.WEBHOOK_EVENTOS_URL, {
      method: "POST",
      headers: {
        "Content-Type": req.get("content-type") || "application/json",
      },
      body: req.rawBody ?? JSON.stringify(req.body),
    }).catch((webhookErr) => {
      console.error(`[${dataHora()}][server.js] Erro ao enviar webhook chatpro/eventos:`, webhookErr);
    });

    console.log(`[${dataHora()}][server.js] chatpro/eventos: ${req.body.event} - ${req.body.action} sessionId: ${req.body.new.session_id}`);

    if(req.body.new.number) {
      console.log(`[${dataHora()}][server.js] chatpro/eventos: ${req.body.new.number.substring(0, req.body.new.number.indexOf('@'))} - ${req.body.new.message}`);
    } else {
      console.log(`[${dataHora()}][server.js] chatpro/eventos: ${JSON.stringify(req.body, null, 2)}`);
    }

    if (req.body.new.last_message && req.body.new.last_type) {
      console.log(`[${dataHora()}][server.js] chatpro/eventos: ${req.body.new.last_message} - ${req.body.new.last_type}`)
    }
    const tipo = req.body.new.type || req.body.new.Type;
    if (tipo) {
      console.log(`[server.js] ${tipo} recebido`);
      const registros = [];
      let telefone = "";
      let mensagem = "";
      let pushname = "";
      let timestamp = 0;
      const regex_telefone = /^([1-9]{2})(([1-9]{2}))(\d{4,5})(\d{4})$/;

      switch (tipo) {
        case "send_text_message":
        case "received_message":
        case "receveid_message":
        case "sent_message":
        case "send_message":

          telefone = req.body.new.number.substring(0, req.body.new.number.indexOf('@'));
          mensagem = req.body.new.message;

          timestamp = req.body.timestamp;
          break;
        default:
          console.log(`[server.js] ${tipo} recebido e não tratado`);
          break;
      }

      //verifica se a variavel possui um valor valido
      if (telefone.trim() && mensagem.trim() && regex_telefone.test(telefone)) {
        registros.push({ tipo_evento: tipo, num_telefone: telefone, mensagem: mensagem, PushName: pushname, messageTimestamp: timestamp });

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
      }

    }
    // Retorno de sucesso
    res.json({ sucesso: true });

  } catch (err) {
    // Captura erros críticos (ex: rede, crash do servidor, variáveis nulas)
    console.error(`[${dataHora()}] Erro interno no servidor: ${err}`);
    res.status(400).json({
      sucesso: false,
      erro: "Requisição inválida"
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
