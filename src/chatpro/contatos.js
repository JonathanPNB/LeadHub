//Busca os contatos já cadastrados no Jetmobi 
export async function getChatproContatos() {
    try {
        const response = await fetch(process.env.CHATPRO_URL_CONTATOS + process.env.CHATPRO_INSTANCE_ID + process.env.CHATPRO_ENDPOINT_CONTATOS, {
            method: 'GET'
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