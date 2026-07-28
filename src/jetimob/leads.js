import { dataHora } from "../util/util.js";

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