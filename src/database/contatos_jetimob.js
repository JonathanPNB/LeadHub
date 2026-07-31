import { dataHora } from "../util/util.js";
import { supabase } from "../database/supabase.js";

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