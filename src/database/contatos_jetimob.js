import { supabase } from "../database/supabase.js";

export function normalizarTelefone(telefone) {
    return String(telefone ?? "").replace(/\D/g, "");
}

export function telefoneCadastradoNoJetimob(telefone, telefonesCadastrados) {
    const digitos = normalizarTelefone(telefone);

    if (!digitos) {
        return false;
    }

    const variantes = [digitos];

    if (digitos.startsWith("55") && digitos.length > 11) {
        variantes.push(digitos.slice(2));
    } else if (digitos.length === 10 || digitos.length === 11) {
        variantes.push(`55${digitos}`);
    }

    return variantes.some((variante) => telefonesCadastrados.has(variante));
}

export async function getTelefonesContatosJetimob() {
    const contatos = await getSupaBase_ContatosJetiMob();
    const telefones = new Set();

    for (const contato of contatos ?? []) {
        const digitos = normalizarTelefone(contato.num_telefone);
        if (digitos) {
            telefones.add(digitos);
        }
    }

    return telefones;
}

//Busca os contatos ja cadastrados na tabela Contatos_jetimob na supabase
export async function getSupaBase_ContatosJetiMob() {
    try {
        // Requisição ao Supabase
        const { data, error } = await supabase
            .from('Contatos_JetiMob')
            .select('*')
            .order('num_telefone');

        // Verifica se o Supabase retornou um erro de banco/regra
        if (error) {
            console.error("[contatos_jetimob.js] error.message: " + error.message);
            console.error("[contatos_jetimob.js] error.details: " + error.details);
            return json({
                sucesso: false,
                error: error.message,
                details: error.details
            });
        }

        // Retorno de sucesso
        return data;
    } catch (error) {
        console.error('Erro ao buscar leads:', error.message);
    }
}