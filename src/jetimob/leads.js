import { dataHora } from "../util/util.js";
import { buscarLeadsSupaBase, preencherLeadIntegrado } from "../database/leads.js";

//Busca os contatos já cadastrados no Jetmobi
export async function getJetimobLeads() {
  try {
    const url = process.env.JETIMOB_URL_LEADS + process.env.JETIMOB_PUBLIC_KEY

    console.log(`[${dataHora()}] Iniciando requisicao para a url ${process.env.JETIMOB_URL_LEADS}`)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization-Key': process.env.JETIMOB_PRIVATE_KEY
      }
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

//Insere novos leads no Jetmobi
export async function inserirLeadsJetiMob() {
  try {
    const leads = await buscarLeadsSupaBase();
    let body;
    const url = process.env.JETIMOB_URL_LEADS + process.env.JETIMOB_PUBLIC_KEY

    console.log(`[${dataHora()}] Iniciando insert para a url ${process.env.JETIMOB_URL_LEADS}`)
    for (const lead of leads) {
      body = { full_name: lead.nome_contato + " (ChatPro)", phone: lead.num_telefone, source: "ChatPro" };

      console.log(`[${dataHora()}] BODY ${JSON.stringify(body)}`)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization-Key': process.env.JETIMOB_PRIVATE_KEY
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      } else {
        preencherLeadIntegrado(lead.num_telefone)
      }

    }

  } catch (error) {
    console.error('Erro ao inserir leads:', error.message);
  }

  console.log(`[${dataHora()}] inserirLeadsJetiMob Finalizado`)
}