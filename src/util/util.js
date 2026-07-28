//Retorna data e hora atual para logs
export function dataHora() {
    const dataAtual = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return dataAtual.replace(",", "")
}