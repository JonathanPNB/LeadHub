import { dataHora } from "../util/util.js";

//Busca os contatos já cadastrados no Jetmobi 
export async function getChatproContatos() {
    try {
        const url = process.env.CHATPRO_URL_CONTATOS + process.env.CHATPRO_INSTANCE_ID + process.env.CHATPRO_ENDPOINT_CONTATOS+"?withProfileImage=false";

        console.log(`[${dataHora()}] Iniciando requisicao para a url ${url}`)
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': process.env.CHATPRO_AUTH_TOKEN
              }
        });

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao buscar contatos:', error.message);
    }
}