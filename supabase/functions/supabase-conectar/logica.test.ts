// Testes da função supabase-conectar com o Supabase e o banco de mentira. Rodar da raiz do repositório:
//   node --experimental-strip-types supabase/functions/supabase-conectar/logica.test.ts
// Com REAL_TOKEN=<chave> REAL_REF=<projeto>, também confere de verdade um projeto do Supabase (só leitura).
import { tratar } from './logica.ts';
import { conferir, literalEsquemas, CONSULTA_GARANTIA } from '../_shared/supabase.ts';
let falhas = 0;
const ok = (c: unknown, m: string) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };

type Cen = { soLeitura?: string; esquemas?: Record<string, boolean>; tabelas?: any[]; regrasBanco?: number; status?: number; projetos?: any[]; tokenStatus?: number; migr?: boolean };
const TAB = (nome: string, regras = 1) => ({ esquema: 'public', nome, tipo: 'r', rls: true, rls_forcado: false, nota: null,
  colunas: [{ nome: 'id', tipo: 'uuid', nao_nulo: true, padrao: null, nota: null }, { nome: 'cliente_id', tipo: 'uuid', nao_nulo: false, padrao: null, nota: null }],
  restricoes: [{ nome: nome + '_pkey', tipo: 'p', cols: ['id'] }, { nome: nome + '_fk', tipo: 'f', cols: ['cliente_id'], ref_esquema: 'public', ref_tabela: 'clientes', ref_cols: ['id'] }],
  permissoes: [{ papel: 'authenticated', privs: ['SELECT'] }], indices: [], regras: Array.from({ length: regras }, (_, i) => ({ nome: 'r' + i, comando: 'r', permissiva: true, papeis: ['authenticated'] })) });

function montar(c: Cen = {}) {
  const sqls: string[] = [], rpcs: string[] = [], chamadas: string[] = [];
  const tabelas = c.tabelas ?? [TAB('clientes'), TAB('pedidos', 2)];
  const buscar = (async (url: string, init: any = {}) => {
    const u = String(url); chamadas.push(u);
    const r = (s: number, j: unknown) => new Response(JSON.stringify(j), { status: s, headers: { 'content-type': 'application/json' } });
    if (u.endsWith('/v1/oauth/token')) {
      const b = new URLSearchParams(init.body);
      if (c.tokenStatus) return r(c.tokenStatus, { error: 'invalid_grant' });
      if (b.get('grant_type') === 'authorization_code' && b.get('code_verifier') !== 'verif-1') return r(400, { error: 'invalid_grant', error_description: 'PKCE errado' });
      return r(200, { access_token: b.get('grant_type') === 'refresh_token' ? 'acesso-novo' : 'acesso-1', refresh_token: 'renova-2', expires_in: 3600 });
    }
    if (u.endsWith('/v1/oauth/revoke')) return r(200, {});
    if (u.endsWith('/v1/projects')) return r(200, c.projetos ?? [{ ref: 'abcdefghijklmnopqrst', name: 'Produção', region: 'sa-east-1', organization_id: 'org1', status: 'ACTIVE_HEALTHY' }]);
    if (u.endsWith('/v1/organizations')) return r(200, [{ id: 'org1', name: 'Empresa X' }]);
    if (u.includes('/database/query/read-only')) {
      if (c.status) return r(c.status, { message: 'Forbidden resource' });
      const q = JSON.parse(init.body).query as string; sqls.push(q);
      if (q === CONSULTA_GARANTIA) return r(201, [{ usuario: 'supabase_read_only_user', so_leitura: c.soLeitura ?? 'on' }]);
      if (q.includes('as existe')) { const nomes = [...q.matchAll(/'([^']+)'/g)].map(m => m[1]); return r(201, nomes.map(n => ({ esquema: n, existe: (c.esquemas ?? {})[n] ?? true }))); }
      if (q.includes('as estrutura')) return r(201, [{ estrutura: { tabelas, papeis: [{ nome: 'authenticated', ignora_rls: false }] } }]);
      if (q.includes('as regras')) return r(201, [{ regras: c.regrasBanco ?? tabelas.reduce((s: number, t: any) => s + t.regras.length, 0) }]);
      if (q.includes('schema_migrations')) return c.migr === false ? r(400, { message: 'relation does not exist' }) : r(201, [{ versao: '20260101120000', sql: 'create table public.clientes (id uuid)' }]);
      return r(400, { message: 'consulta desconhecida' });
    }
    return r(404, {});
  }) as typeof fetch;
  const TOK: Record<string, any> = { 'c-1': { acesso: 'acesso-1', renovacao: 'renova-1', expira_em: new Date(Date.now() + 3600e3).toISOString() } };
  const rpc = async (nome: string, a: any) => {
    rpcs.push(nome);
    if (nome === 'supa_app_ler') return { data: { client_id: 'cli-12345678', client_secret: 'seg-12345678', retorno: 'https://ciclodev.app/entrar.html?git=supabase' }, error: null };
    if (nome === 'supa_conexao_gravar') { TOK['c-1'] = { acesso: a.p_acesso, renovacao: a.p_renovacao, expira_em: a.p_expira }; return { data: 'c-1', error: null }; }
    if (nome === 'supa_conexao_ler') return { data: TOK[a.p_id] ? { id: a.p_id, tokens: TOK[a.p_id] } : null, error: null };
    if (nome === 'supa_tokens_gravar') { TOK[a.p_conexao] = { acesso: a.p_acesso, renovacao: a.p_renovacao, expira_em: a.p_expira }; return { data: null, error: null }; }
    if (nome === 'supa_prova_gravar') return { data: 'prova-1', error: null };
    if (nome === 'supa_conexao_erro') return { data: null, error: null };
    return { data: null, error: { message: 'rpc desconhecida ' + nome } };
  };
  const rpcUsuario = async (nome: string, a: any) => {
    rpcs.push('eu:' + nome);
    if (nome === 'supa_estado_usar') return a.p_estado === 'est-1' ? { data: { pessoa_id: 'p-1', espaco_id: 'e-1', verificador: 'verif-1' }, error: null } : { data: null, error: { message: 'A conexão expirou ou não é sua. Tente de novo.' } };
    if (nome === 'supa_eu') return { data: 'p-1', error: null };
    if (nome === 'supa_conexao_remover') return { data: null, error: null };
    return { data: null, error: { message: 'rpc desconhecida ' + nome } };
  };
  const ler = async (t: string, id: string) => (t === 'supa_conexoes' && id === '11111111-1111-1111-1111-111111111111' ? { id: 'c-1', criado_por: 'p-1' } : null);
  return { d: { buscar, rpc, rpcUsuario, ler }, sqls, rpcs, chamadas, TOK };
}
const pedir = async (d: any, corpo: unknown) => { const r = await tratar(new Request('https://x/f', { method: 'POST', body: JSON.stringify(corpo) }), d); return { status: r.status, j: await r.json() }; };
const CON = '11111111-1111-1111-1111-111111111111', REF = 'abcdefghijklmnopqrst';

// 1. volta da janelinha
{ const m = montar(); const r = await pedir(m.d, { acao: 'concluir', code: 'cod', estado: 'est-1' });
  ok(r.j.ok && r.j.conexao_id === 'c-1' && r.j.projetos.length === 1 && r.j.conta === 'Empresa X', 'concluir: troca o código (com PKCE), lista os projetos e guarda a conta');
  ok(m.TOK['c-1'].acesso === 'acesso-1' && m.TOK['c-1'].renovacao === 'renova-2', 'as chaves vão para o banco pela função de serviço'); }
{ const m = montar(); const r = await pedir(m.d, { acao: 'concluir', code: 'cod', estado: 'outro' });
  ok(!r.j.ok && /expirou ou não é sua/.test(r.j.erro) && !m.rpcs.includes('supa_conexao_gravar'), 'estado de outra pessoa ou vencido: não guarda nada'); }
{ const m = montar({ projetos: [] }); m.d.buscar = (async (u: string, i: any) => String(u).endsWith('/v1/projects') ? new Response('{}', { status: 403 }) : (montar().d.buscar as any)(u, i)) as any;
  const r = await pedir(m.d, { acao: 'concluir', code: 'cod', estado: 'est-1' });
  ok(!r.j.ok && /Projects: Read/.test(r.j.erro) && !m.rpcs.includes('supa_conexao_gravar'), 'autorização que nem lista projetos: não guarda'); }

// 2. conferência que passa
{ const m = montar(); const r = await pedir(m.d, { acao: 'conferir', conexao_id: CON, projeto: REF, esquemas: ['public'] });
  ok(r.j.ok && r.j.prova === 'prova-1', 'conferência completa: devolve a prova');
  const c = r.j.conferencia;
  ok(c.so_leitura && c.tabelas === 2 && c.colunas === 4 && c.chaves === 2 && c.ligacoes === 2 && c.regras === 3 && c.permissoes === 2 && c.papeis === 1 && c.com_rls === 2 && c.migracoes === 1, 'conta tudo o que leu (tabelas, colunas, chaves, ligações, regras, permissões, papéis, migrations)');
  ok(m.sqls[0] === CONSULTA_GARANTIA, 'a primeira consulta confere que é só leitura');
  ok(m.sqls.every(q => !/from\s+public\./i.test(q) && !/\b(insert|update|delete|create|drop|alter|grant|truncate)\b\s/i.test(q.replace(/'[^']*'/g, ''))), 'nenhuma consulta lê o conteúdo de tabela nem muda nada'); }

// 3. conferências que não passam: sem prova
const naoPassa = async (cen: Cen, esquemas: string[], re: RegExp, nome: string) => {
  const m = montar(cen); const r = await pedir(m.d, { acao: 'conferir', conexao_id: CON, projeto: REF, esquemas });
  ok(!r.j.ok && !r.j.prova && !m.rpcs.includes('supa_prova_gravar') && (r.j.falhas || [r.j.erro]).some((f: string) => re.test(f)), nome);
};
await naoPassa({ soLeitura: 'off' }, ['public'], /não está em modo só leitura/, 'leitura que não é só leitura: não liga');
await naoPassa({ esquemas: { vendas: false } }, ['public', 'vendas'], /esquema vendas não existe/, 'esquema que não existe: não liga');
await naoPassa({ tabelas: [] }, ['public'], /nenhuma tabela/, 'nenhuma tabela: não liga');
await naoPassa({ regrasBanco: 9 }, ['public'], /todas as regras de acesso/, 'regras de acesso (RLS) incompletas: não liga');
await naoPassa({ tabelas: [{ ...TAB('x'), permissoes: undefined }] }, ['public'], /Faltou uma parte/, 'tabela sem permissões lidas: não liga');
await naoPassa({ status: 403 }, ['public'], /permissão Database/, 'autorização sem a permissão de banco: não liga e diz o que marcar');
{ const m = montar(); const r = await pedir(m.d, { acao: 'conferir', conexao_id: CON, projeto: 'zzzzzzzzzzzzzzzzzzzz', esquemas: ['public'] });
  ok(r.status === 403 && !m.sqls.length, 'projeto que a autorização não alcança: recusa antes de ler'); }
{ const m = montar(); const r = await pedir(m.d, { acao: 'conferir', conexao_id: CON, projeto: REF, esquemas: ["public'; drop table x; --"] });
  ok(!r.j.ok && /esquema inválido/.test(r.j.erro) && !m.sqls.length, 'esquema com aspas ou comando: recusa sem rodar nada'); }
{ const m = montar(); const r = await pedir(m.d, { acao: 'conferir', conexao_id: '22222222-2222-2222-2222-222222222222', projeto: REF, esquemas: ['public'] });
  ok(r.status === 403 && !m.sqls.length, 'conta de outro espaço: recusa'); }
{ const m = montar({ migr: false }); const r = await pedir(m.d, { acao: 'conferir', conexao_id: CON, projeto: REF, esquemas: ['public'] });
  ok(r.j.ok && r.j.conferencia.migracoes === null && r.j.conferencia.avisos.length === 1, 'sem histórico de migrations: liga, com aviso'); }

// 4. chave vencida renova sozinha
{ const m = montar(); m.TOK['c-1'] = { acesso: 'velho', renovacao: 'renova-1', expira_em: new Date(Date.now() - 1000).toISOString() };
  const r = await pedir(m.d, { acao: 'projetos', conexao_id: CON });
  ok(r.j.ok && m.TOK['c-1'].acesso === 'acesso-novo' && m.TOK['c-1'].renovacao === 'renova-2', 'chave vencida: renova e guarda a nova'); }
{ const m = montar({ tokenStatus: 400 }); m.TOK['c-1'] = { acesso: 'velho', renovacao: 'renova-1', expira_em: new Date(Date.now() - 1000).toISOString() };
  const r = await pedir(m.d, { acao: 'projetos', conexao_id: CON });
  ok(!r.j.ok && /Conecte de novo/.test(r.j.erro) && m.rpcs.includes('supa_conexao_erro'), 'autorização tirada no Supabase: anota o erro na conta'); }

// 5. desconectar devolve a autorização
{ const m = montar(); const r = await pedir(m.d, { acao: 'desconectar', conexao_id: CON });
  ok(r.j.ok && r.j.devolvida && m.rpcs.includes('eu:supa_conexao_remover') && m.chamadas.some(u => u.endsWith('/v1/oauth/revoke')), 'desconectar: tira do espaço e devolve ao Supabase'); }

// 6. Testar o jeito antigo (endereço): lê de verdade antes de salvar, nunca devolve a senha
{ const m = montar(); const NO = '33333333-3333-3333-3333-333333333333', END = 'postgresql://leitura:SenhaSecreta99@h.pooler.supabase.com:5432/postgres';
  const ru = m.d.rpcUsuario; m.d.rpcUsuario = async (n: string, a: any) => n === 'supa_pode_editar' ? { data: a.p_no === NO, error: null } : ru(n, a);
  (m.d as any).lerBanco = async (con: string, esq: string[]) => { if (/errada/.test(con)) throw new Error('connect ' + con + ' failed: password authentication failed'); return { tabelas: esq.includes('vazio') ? [] : [TAB('clientes')], papeis: [] }; };
  let r = await pedir(m.d, { acao: 'testar_endereco', no_id: NO, conexao: END, motor: 'postgres', esquemas: ['public'] });
  ok(r.j.ok && r.j.resultado.tabelas === 1 && r.j.resultado.colunas === 2 && r.j.resultado.regras === 1, 'Testar: endereço bom mostra o que leu');
  r = await pedir(m.d, { acao: 'testar_endereco', no_id: NO, conexao: END.replace('SenhaSecreta99', 'errada'), motor: 'postgres', esquemas: ['public'] });
  ok(!r.j.ok && /password authentication/.test(r.j.falhas[0]) && !JSON.stringify(r.j).includes('errada@'), 'Testar: senha errada diz o motivo, sem mostrar o endereço');
  r = await pedir(m.d, { acao: 'testar_endereco', no_id: NO, conexao: END, motor: 'postgres', esquemas: ['vazio'] });
  ok(!r.j.ok && /nenhuma tabela/.test(r.j.falhas[0]), 'Testar: conectou mas sem tabela, não passa');
  r = await pedir(m.d, { acao: 'testar_endereco', no_id: '44444444-4444-4444-4444-444444444444', conexao: END, motor: 'postgres', esquemas: ['public'] });
  ok(r.status === 403, 'Testar: só quem pode mudar o ponto (ninguém usa o CicloDev para sondar outros servidores)'); }
ok(literalEsquemas(['public', 'vendas_2']) === "array['public','vendas_2']::text[]", 'esquemas entram como texto fixo');

// 6. de verdade (opcional): um projeto do Supabase com uma chave de acesso
if (process.env.REAL_TOKEN && process.env.REAL_REF) {
  const c = await conferir({ rpc: async () => ({ data: null, error: null }), buscar: fetch }, process.env.REAL_TOKEN, process.env.REAL_REF, ['public']);
  ok(c.ok && c.so_leitura && c.tabelas > 0 && c.usuario === 'supabase_read_only_user', 'DE VERDADE: conferência do projeto ' + process.env.REAL_REF + ' passou (' + c.tabelas + ' tabelas, ' + c.colunas + ' colunas, ' + c.regras + ' regras, ' + c.permissoes + ' permissões, ' + c.papeis + ' papéis, migrations: ' + c.migracoes + ')');
  if (!c.ok) console.log(c.falhas);
  const errado = await conferir({ rpc: async () => ({ data: null, error: null }), buscar: fetch }, process.env.REAL_TOKEN, process.env.REAL_REF, ['public', 'nao_existe_xyz']);
  ok(!errado.ok && errado.falhas.some(f => /nao_existe_xyz não existe/.test(f)), 'DE VERDADE: esquema que não existe não passa');
}
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK'); if (falhas) process.exit(1);
