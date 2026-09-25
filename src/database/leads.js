import { dataHora } from "../util/util.js";
import { supabase } from "./supabase.js";
import { normalizarTelefone } from "./contatos_jetimob.js";

const PAGE_LIMIT = 1000;

export async function getTelefonesLeads() {
  const telefones = new Set();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("Leads")
      .select("num_telefone")
      .range(offset, offset + PAGE_LIMIT - 1);

    if (error) {
      console.error(`[${dataHora()}][leads.js] error.message: ${error.message}`);
      console.error(`[${dataHora()}][leads.js] error.details: ${error.details}`);
      throw error;
    }

    const pagina = data ?? [];
    for (const lead of pagina) {
      const digitos = normalizarTelefone(lead.num_telefone);
      if (digitos) {
        telefones.add(digitos);
      }
    }

    if (pagina.length < PAGE_LIMIT) {
      break;
    }

    offset += PAGE_LIMIT;
  }

  return telefones;
}

export async function inserirLeads(registros) {
  const { error } = await supabase
    .from("Leads")
    .insert(registros);

  if (error) {
    console.error(`[${dataHora()}][leads.js] error.message: ${error.message}`);
    console.error(`[${dataHora()}][leads.js] error.details: ${error.details}`);
    throw error;
  }

  console.log(`[${dataHora()}][leads.js] ${registros.length} lead(s) inserido(s).`);
}

export async function buscarLeadsSupaBase() {
  const { data, error } = await supabase
    .from("Leads")
    .select("nome_contato, num_telefone")
    .is('integrado_at', null)
    .order("id", { ascending: true });

  if (error) {
    console.error(`[${dataHora()}][leads.js] error.message: ${error.message}`);
    console.error(`[${dataHora()}][leads.js] error.details: ${error.details}`);
    throw error;
  }

  return data;
}

export async function preencherLeadIntegrado(num_telefone) {
  try {
    const { error } = await supabase
      .from("Leads")
      .update({ "integrado_at": "now()" })
      .eq('num_telefone', num_telefone);

    if (error) {
      console.error(`[${dataHora()}][leads.js] error.message: ${error.message}`);
      console.error(`[${dataHora()}][leads.js] error.details: ${error.details}`);
      throw error;
    }
  } catch (err) {
    console.error('Erro ao inserir leads:', err.message);
  }
}