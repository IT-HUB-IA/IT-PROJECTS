// Consultas fixas de ESTRUTURA do banco (só o catálogo, nunca o conteúdo das tabelas) e os tipos da estrutura.
// Usadas pelo robô dos desenhos (diagramas-auto/gerar.ts), pela leitura do Supabase sem senha (supabase.ts),
// pela leitura pelo endereço (ler_banco.ts) e pela função mapa-trabalho. Sem dependências: dá para publicar sozinho.

// uma consulta só, que qualquer usuário de leitura consegue rodar (usa o catálogo, não information_schema)
export const CONSULTA_BANCO = `
with esq as (select unnest($1::text[]) as n),
tab as (
  select c.oid, n.nspname as esquema, c.relname as nome, c.relkind::text as tipo, c.relrowsecurity as rls, c.relforcerowsecurity as rls_forcado,
         obj_description(c.oid, 'pg_class') as nota, c.relowner, c.relacl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in (select n from esq) and c.relkind in ('r','p','v','m','f') and not c.relispartition),
perm as (
  select t.oid, coalesce(r.rolname, 'PUBLIC') as papel, array_agg(distinct a.privilege_type order by a.privilege_type) as privs
    from tab t cross join lateral aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) a
    left join pg_roles r on r.oid = a.grantee
   where a.grantee <> t.relowner and (r.oid is null or (not r.rolsuper and r.rolname !~ '^(pg_|supabase_)' and r.rolname not in ('postgres','dashboard_user','pgbouncer','authenticator')))
     and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
   group by 1, 2)
select json_build_object(
  'tabelas', coalesce((select json_agg(json_build_object(
      'esquema', t.esquema, 'nome', t.nome, 'tipo', t.tipo, 'rls', t.rls, 'rls_forcado', t.rls_forcado, 'nota', t.nota,
      'colunas', (select coalesce(json_agg(json_build_object('nome', a.attname, 'tipo', format_type(a.atttypid, a.atttypmod), 'nao_nulo', a.attnotnull,
                    'padrao', pg_get_expr(d.adbin, d.adrelid), 'nota', col_description(a.attrelid, a.attnum)) order by a.attnum), '[]')
                    from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                   where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped),
      'restricoes', (select coalesce(json_agg(json_build_object('nome', k.conname, 'tipo', k.contype::text,
                    'cols', (select json_agg(a.attname order by x.i) from unnest(k.conkey) with ordinality x(n, i) join pg_attribute a on a.attrelid = k.conrelid and a.attnum = x.n),
                    'ref_esquema', (select n2.nspname from pg_class c2 join pg_namespace n2 on n2.oid = c2.relnamespace where c2.oid = k.confrelid),
                    'ref_tabela', (select c2.relname from pg_class c2 where c2.oid = k.confrelid),
                    'ref_cols', (select json_agg(a.attname order by x.i) from unnest(k.confkey) with ordinality x(n, i) join pg_attribute a on a.attrelid = k.confrelid and a.attnum = x.n)
                  ) order by k.conname), '[]') from pg_constraint k where k.conrelid = t.oid and k.contype in ('p','u','f')),
      'permissoes', (select coalesce(json_agg(json_build_object('papel', p.papel, 'privs', p.privs) order by p.papel), '[]') from perm p where p.oid = t.oid),
      'regras', (select coalesce(json_agg(json_build_object('nome', po.polname, 'comando', po.polcmd::text, 'permissiva', po.polpermissive,
                    'usando', pg_get_expr(po.polqual, po.polrelid), 'checa', pg_get_expr(po.polwithcheck, po.polrelid),
                    'papeis', (select coalesce(json_agg(coalesce(r.rolname, 'PUBLIC') order by 1), '[]') from unnest(po.polroles) pr left join pg_roles r on r.oid = pr)) order by po.polname), '[]')
                  from pg_policy po where po.polrelid = t.oid),
      'indices', (select coalesce(json_agg((select json_agg(a.attname order by k.i) from unnest(ix.indkey) with ordinality k(n, i) join pg_attribute a on a.attrelid = ix.indrelid and a.attnum = k.n)), '[]')
                  from pg_index ix where ix.indrelid = t.oid)
    ) order by t.esquema, t.nome)
    from tab t), '[]'),
  'papeis', coalesce((select json_agg(json_build_object('nome', r.rolname, 'ignora_rls', r.rolbypassrls) order by r.rolname) from pg_roles r
                        where r.rolname in (select distinct papel from perm)), '[]')
) as estrutura`;

export type Coluna = { nome: string; tipo: string; nao_nulo: boolean; padrao: string | null; nota: string | null };
export type Restricao = { nome: string; tipo: string; cols: string[]; ref_esquema: string | null; ref_tabela: string | null; ref_cols: string[] | null };
export type Tabela = { esquema: string; nome: string; tipo: string; rls: boolean; rls_forcado: boolean; nota: string | null; colunas: Coluna[]; restricoes: Restricao[];
  permissoes: { papel: string; privs: string[] }[]; indices?: string[][]; regras: { nome: string; comando: string; permissiva: boolean; papeis: string[]; usando?: string | null; checa?: string | null }[] };
// datas (opcional, "esquema.tabela"): quando a tabela foi criada e mexida pela última vez; não entram no resumo (a data muda sem a estrutura mudar)
export type Estrutura = { tabelas: Tabela[]; papeis: { nome: string; ignora_rls: boolean }[]; datas?: Record<string, { criado?: string; mudou?: string }> };

// Supabase: as migrations aplicadas (a versão é a data, AAAAMMDDhhmmss). Lida à parte: o banco pode não ter essa tabela.
export const CONSULTA_MIGRACOES = `select version::text as versao, left(array_to_string(statements, E'\\n'), 300000) as sql from supabase_migrations.schema_migrations order by version limit 3000`;
export function datasDasMigracoes(linhas: { versao: string; sql: string | null }[], esquemas: string[]): Record<string, { criado?: string; mudou?: string }> {
  const out: Record<string, { criado?: string; mudou?: string }> = {};
  const nome = (s: string) => s.replace(/"/g, '');
  for (const l of linhas) {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(l.versao || ''); if (!m) continue;
    const dia = m[1] + '-' + m[2] + '-' + m[3], sql = l.sql || '';
    const chave = (esq: string | undefined, tab: string) => { const e = esq ? nome(esq) : (esquemas.includes('public') ? 'public' : esquemas[0]); return e + '.' + nome(tab); };
    for (const c of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:("?[\w]+"?)\.)?("?[\w]+"?)/gi)) { const k = chave(c[1], c[2]); out[k] = out[k] || {}; if (!out[k].criado) out[k].criado = dia; out[k].mudou = dia; }
    for (const c of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:("?[\w]+"?)\.)?("?[\w]+"?)/gi)) { const k = chave(c[1], c[2]); out[k] = out[k] || {}; out[k].mudou = dia; }
  }
  return out;
}

export type LinhaMysql = Record<string, any>;
export const CONSULTAS_MYSQL = {
  tabelas: "select table_schema as esquema, table_name as nome, table_type as tipo, table_comment as nota, create_time as criado, update_time as mudou from information_schema.tables where table_schema in (?) order by 1, 2",
  colunas: "select table_schema as esquema, table_name as tabela, column_name as nome, column_type as tipo, is_nullable as nulo, column_default as padrao, column_comment as nota, ordinal_position as ordem from information_schema.columns where table_schema in (?) order by 1, 2, ordinal_position",
  restricoes: "select k.table_schema as esquema, k.table_name as tabela, k.constraint_name as nome, c.constraint_type as tipo, k.column_name as coluna, k.ordinal_position as ordem, k.referenced_table_schema as ref_esquema, k.referenced_table_name as ref_tabela, k.referenced_column_name as ref_coluna from information_schema.key_column_usage k join information_schema.table_constraints c on c.constraint_schema = k.constraint_schema and c.table_name = k.table_name and c.constraint_name = k.constraint_name where k.table_schema in (?) order by 1, 2, 3, k.ordinal_position",
};
export function estruturaMysql(tabelas: LinhaMysql[], colunas: LinhaMysql[], restricoes: LinhaMysql[]): Estrutura {
  const v = (r: LinhaMysql, k: string) => r[k] ?? r[k.toUpperCase()];
  const out: Tabela[] = tabelas.map(t => ({ esquema: String(v(t, 'esquema')), nome: String(v(t, 'nome')), tipo: /VIEW/i.test(String(v(t, 'tipo'))) ? 'v' : 'r', rls: false, rls_forcado: false,
    nota: v(t, 'nota') ? String(v(t, 'nota')) : null, colunas: [], restricoes: [], permissoes: [], regras: [] }));
  const achar = (e: unknown, n: unknown) => out.find(t => t.esquema === String(e) && t.nome === String(n));
  for (const c of colunas) { const t = achar(v(c, 'esquema'), v(c, 'tabela')); if (t) t.colunas.push({ nome: String(v(c, 'nome')), tipo: String(v(c, 'tipo')), nao_nulo: String(v(c, 'nulo')).toUpperCase() === 'NO', padrao: v(c, 'padrao') == null ? null : String(v(c, 'padrao')), nota: v(c, 'nota') ? String(v(c, 'nota')) : null }); }
  const TIPO: Record<string, string> = { 'PRIMARY KEY': 'p', UNIQUE: 'u', 'FOREIGN KEY': 'f' };
  for (const r of restricoes) {
    const t = achar(v(r, 'esquema'), v(r, 'tabela')), tp = TIPO[String(v(r, 'tipo')).toUpperCase()]; if (!t || !tp) continue;
    let x = t.restricoes.find(y => y.nome === String(v(r, 'nome')) && y.tipo === tp);
    if (!x) { x = { nome: String(v(r, 'nome')), tipo: tp, cols: [], ref_esquema: tp === 'f' ? String(v(r, 'ref_esquema')) : null, ref_tabela: tp === 'f' ? String(v(r, 'ref_tabela')) : null, ref_cols: tp === 'f' ? [] : null }; t.restricoes.push(x); }
    x.cols.push(String(v(r, 'coluna'))); if (tp === 'f' && v(r, 'ref_coluna') != null) x.ref_cols!.push(String(v(r, 'ref_coluna')));
  }
  // o MySQL guarda quando a tabela foi criada e mexida (update_time pode vir vazio)
  const datas: Record<string, { criado?: string; mudou?: string }> = {};
  const dia = (x: unknown) => { if (x == null) return undefined; const d = x instanceof Date ? x : new Date(String(x)); return isNaN(+d) ? undefined : d.toISOString().slice(0, 10); };
  for (const t of tabelas) { const c = dia(v(t, 'criado')), u = dia(v(t, 'mudou')); if (c || u) datas[String(v(t, 'esquema')) + '.' + String(v(t, 'nome'))] = { criado: c, mudou: u || c }; }
  return { tabelas: out, papeis: [], ...(Object.keys(datas).length ? { datas } : {}) };
}
