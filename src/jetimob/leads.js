import express from "express";
import { dataHora } from "../util/util.js";

const app = express();
app.use(express.json());

//Busca os contatos já cadastrados no Jetmobi
export async function getJetimobLeads() {
  try {
    const url = process.env.JETIMOB_URL_LEADS + process.env.JETIMOB_PUBLIC_KEY

    console.log(`[${dataHora()}] Iniciando requisicao para a url ${url}`)
    const response = await fetch(url, {
      method: 'GET'/*,
      headers: {
        'Accept': 'application/json',
        'Authorization-Key': process.env.JETIMOB_PRIVATE_KEY
      }*/
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar leads:', error.message);
  }
}

// Rota GET com Try/Catch
app.get('/jetimob/leads', async (req, res) => {
  try {
    // Requisição ao Supabase
    const { data, error } = await supabase
      .from('Contatos_JetiMob')
      .select('*');

    // Verifica se o Supabase retornou um erro de banco/regra
    if (error) {
      console.error("[server.js] error.message: "+error.message);
      console.error("[server.js] error.details: "+error.details);
      return res.status(400).json({ 
        sucesso: false, 
        error: error.message,
        details: error.details
      });
    }
    
    console.log("[server.js] dados: "+data);
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