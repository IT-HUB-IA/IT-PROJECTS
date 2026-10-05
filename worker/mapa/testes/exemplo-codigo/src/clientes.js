import { supabase } from './banco.js';
export async function salvarCliente(c) {
  return supabase.from('clientes').insert({ nome: c.nome, apelido: c.apelido });
}
export async function listar() {
  return supabase.from('clientes').select('id, nome, email').eq('ativo', true).order('nome');
}
export const lembrar = (f) => localStorage.setItem('filtro-clientes', JSON.stringify(f));
export async function pedidosAntigos() { return supabase.from('pedidos_velhos').select('*'); }
