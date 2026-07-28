//Busca os contatos já cadastrados no Jetmobi 
export async function getJetimobLeads() {
  try {
    const response = await fetch(process.env.JETIMOB_URL_LEADS + process.env.JETIMOB_PUBLIC_KEY, {
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