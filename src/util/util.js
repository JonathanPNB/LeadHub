//Retorna data e hora atual para logs
export function dataHora() {
    const dataAtual = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return dataAtual.replace(",", "")
}

export function normalizarTexto(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, " ")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

export function obterMensagemNomeNormalizada() {
    const mensagemNome = process.env.MENSAGEM_NOME;

    if (!mensagemNome?.trim()) {
        throw new Error("MENSAGEM_NOME é obrigatória no .env");
    }

    return normalizarTexto(mensagemNome);
}

export function aguardar(ms) {
    return new Promise((resolve) => setTimeout(resolve, parseInt(ms.replace(/_/g, ''), 10)));
}

function obterMaxRetry429() {
    const valor = Number.parseInt(process.env.CHATPRO_RETRY_MAX, 10);
    return Number.isInteger(valor) && valor >= 0 ? valor : 5;
}

export async function fetchComRetry429(url, options) {
    const maxRetry = obterMaxRetry429();
    let tentativas = 0;

    while (true) {
        const response = await fetch(url, options);

        if (response.status !== 429) {
            return response;
        }

        tentativas += 1;
        const detalhe = await response.text().catch(() => "");

        if (tentativas > maxRetry) {
            throw new Error(`Erro na requisição: 429 após ${maxRetry} tentativa(s) de retry ${detalhe}`.trim());
        }

        console.log(`[${dataHora()}] Rate limit 429 em ${url}. Tentativa ${tentativas}/${maxRetry} em ${parseInt(process.env.CHATPRO_RETRY_429_MS.replace(/_/g, ""), 10)/1000} segundos...`);
        await aguardar(process.env.CHATPRO_RETRY_429_MS);
    }
}