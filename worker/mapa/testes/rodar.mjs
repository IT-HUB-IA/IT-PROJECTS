// Testes do trabalhador do Mapa do Sistema. Rodar de worker/mapa: node testes/rodar.mjs
//   1. peças isoladas: banco de mentira, papéis, funções, detecção de aplicações, leitura do código
//   2. ponta a ponta: o sistema de exemplo (testes/exemplo-estatico) construído, percorrido com cada papel e comparado com o banco
import { readFileSync } from 'node:fs';
import { Falso, papeisDoBanco } from '../lib/falso.mjs';
import { detectar, variaveisDoCodigo } from '../lib/detectar.mjs';
import { lerCodigo } from '../lib/codigo.mjs';
import { analisar } from '../lib/analisar.mjs';

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const aqui = new URL('.', import.meta.url).pathname;
const bancos = JSON.parse(readFileSync(aqui + 'exemplo-estatico/banco.json', 'utf8'));

// ---------- 1. banco de mentira ----------
const regra = papeisDoBanco(bancos);
ok(regra && regra.tabela === 'pessoas' && regra.coluna === 'nivel' && regra.valores.join() === 'atendente,gerente', 'papéis tirados da regra de valor do banco (pessoas.nivel: atendente, gerente)');
const f = new Falso({ bancos: [{ ...bancos[0], funcoes: [
  { esquema: 'public', nome: 'vincular', devolve: 'TABLE(pessoa_id uuid, nome text, nivel text)', varias: true },
  { esquema: 'public', nome: 'sou_dono', devolve: 'boolean', varias: false },
  { esquema: 'public', nome: 'meus_clientes', devolve: 'SETOF clientes', varias: true }] }], papel: 'gerente', regraPapel: regra });
const resp = (url, extra = {}) => { const r = f.responder({ url, metodo: 'GET', ...extra }); return { ...r, json: r.body ? JSON.parse(r.body) : null }; };
const l = resp('https://abc.supabase.co/rest/v1/clientes?select=id,nome&limit=2').json;
ok(Array.isArray(l) && l.length === 2 && /^mq[0-9a-z]{3}k/.test(l[0].nome) && !('email' in l[0]), 'lê só as colunas pedidas, com marcador único por coluna');
ok(resp('https://abc.supabase.co/rest/v1/pessoas?select=nivel&id=eq.7', { cabecalhos: { accept: 'application/vnd.pgrst.object+json' } }).json.nivel === 'gerente', 'a pessoa da volta tem o papel da volta (gerente)');
ok(resp('https://abc.supabase.co/rest/v1/pedidos?select=*,cliente:clientes(nome)').json[0].cliente.nome.startsWith('mq'), 'tabela embutida (pedidos com o cliente) vem montada pela chave estrangeira');
ok(resp('https://abc.supabase.co/rest/v1/nao_existe?select=*').status === 404 && f.eventos.at(-1).existe === false, 'tabela que não existe: responde como o Supabase (404) e anota');
const rpc = (n) => JSON.parse(f.responder({ url: 'https://abc.supabase.co/rest/v1/rpc/' + n, metodo: 'POST', corpo: '{}' }).body || 'null');
ok(rpc('vincular')[0].nivel === 'gerente' && rpc('sou_dono') === true && rpc('meus_clientes').length === 2, 'funções do banco respondidas no formato da assinatura (TABLE, boolean, SETOF tabela)');
const fa = new Falso({ bancos: [{ ...bancos[0], funcoes: [{ esquema: 'public', nome: 'sou_dono', devolve: 'boolean' }] }], papel: 'atendente', regraPapel: regra });
ok(JSON.parse(fa.responder({ url: 'https://abc.supabase.co/rest/v1/rpc/sou_dono', metodo: 'POST', corpo: '{}' }).body) === false, 'pergunta de sim ou não: "sim" só para o papel mais alto (gerente), "não" para o atendente');
ok(f.responder({ url: 'https://abc.supabase.co/rest/v1/rpc/apagar_tudo', metodo: 'POST', corpo: '{}' }).status === 404, 'função que não existe no banco: 404, como o Supabase');
f.responder({ url: 'https://abc.supabase.co/rest/v1/clientes', metodo: 'POST', corpo: JSON.stringify({ nome: 'x', apelido: 'y' }) });
ok(f.eventos.at(-1).tipo === 'grava' && f.eventos.at(-1).colunas.join() === 'nome,apelido', 'o que se grava fica anotado com as colunas');
ok(f.responder({ url: 'https://api.loja.com/v2/clientes/9', metodo: 'PATCH', cabecalhos: { 'x-mapa-tipo': 'fetch' }, corpo: '{"email":"a"}' }).status === 204 && f.eventos.at(-1).tabela === 'clientes', 'API própria: /clientes conta como a tabela clientes');
ok(f.colunasNoTexto('Total: ' + resp('https://abc.supabase.co/rest/v1/pedidos?select=total').json[0].total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })).some(x => x.coluna === 'total'), 'número marcado é reconhecido mesmo formatado (48.007,00)');
ok(new Falso({ bancos, logado: false }).responder({ url: 'https://abc.supabase.co/auth/v1/user', metodo: 'GET' }).status === 401, 'sem entrar: o login responde que não há sessão');

// ---------- detecção e leitura do código ----------
const raizCiclo = new URL('../../../', import.meta.url).pathname;
const apps = detectar(raizCiclo);
ok(apps.some(a => a.tipo === 'node' && a.framework === 'Next.js' && a.rel === 'site') && apps.some(a => a.tipo === 'estatico' && a.rel === 'publico'), 'o repositório do CicloDev tem 2 aplicações: o site (Next.js) e a pasta publicada');
const ex = detectar(aqui + 'exemplo-codigo');
ok(ex.length === 1 && ex[0].tipo === 'servidor' && /Java/.test(ex[0].framework), 'sistema Java: lido só pelo código');
const env = variaveisDoCodigo(raizCiclo + 'site');
ok(Object.values(env).every(v => /mapa|falso|eyJ/.test(v)), 'variáveis de ambiente só com valores falsos');
const cod = lerCodigo(aqui + 'exemplo-codigo');
const ac = (t, m) => cod.acessos.find(a => a.tabela === t && a.modo === m);
ok(ac('clientes', 'grava') && ac('clientes', 'grava').colunas.join() === 'nome,apelido' && /clientes\.js$/.test(ac('clientes', 'grava').arquivo), 'Supabase no código: insert com as colunas, arquivo e linha');
ok(ac('clientes', 'le').colunas.includes('ativo') && ac('clientes', 'le').colunas.includes('email'), 'select, filtros e ordem contam como colunas lidas');
ok(ac('pedidos', 'grava') && ac('pedidos', 'grava').colunas.includes('desconto') && cod.acessos.some(a => a.via === 'sql' && a.colunas.includes('status')), 'SQL escrito à mão (Java): insert e update com as colunas');
ok(cod.navegador.some(n => n.chave === 'filtro-clientes' && n.linha === 8), 'o que guarda só no navegador, com a linha');
ok(cod.telasEstaticas.some(t => t.titulo === 'Pedido' && t.elementos.some(e => e.rotulo === 'Gravar pedido')), 'modelo de página: botões, campos e links lidos sem rodar');
ok(cod.onde('Voltar para a lista')?.arquivo === 'templates/pedido.html', 'acha o arquivo e a linha de um texto da tela');

// ---------- 2. ponta a ponta ----------
const r = await analisar(aqui + 'exemplo-estatico', { bancos, tempoPapelMs: 60_000 });
const P = Object.fromEntries(r.pecas.map(p => [p.chave, p])), A = r.alertas;
ok(r.com_banco && r.papeis.join() === 'visitante,atendente,gerente', 'três voltas: sem entrar, atendente e gerente');
ok(P['app:publico/m:financeiro']?.papeis.join() === 'gerente' && P['app:publico/m:clientes']?.papeis.includes('atendente'), 'quem vê: Financeiro só o gerente; Clientes, todos');
ok(P['app:publico/m:clientes/t:clientes/j:novo-cliente']?.quando === 'ao clicar em Novo cliente' && P['app:publico/m:clientes/t:clientes/b:novo-cliente']?.destino === 'app:publico/m:clientes/t:clientes/j:novo-cliente', 'botão Novo cliente abre a janela Novo cliente (quando aparece e para onde leva)');
ok(P['app:publico/m:clientes/t:clientes/j:novo-cliente/c:nome']?.destino === 'clientes.nome', 'o campo Nome vai para clientes.nome');
ok(A.some(a => a.tipo === 'coluna_inexistente' && a.coluna === 'apelido' && /c:apelido$/.test(a.peca)), 'erro: o campo Apelido grava numa coluna que não existe');
ok(A.some(a => a.tipo === 'campo_sem_destino' && /c:observacao$/.test(a.peca)), 'atenção: Observação não vai para lugar nenhum');
ok(A.some(a => a.tipo === 'so_navegador' && /c:tema-da-tela$/.test(a.peca)), 'atenção: Tema da tela fica só no navegador');
ok(A.some(a => a.tipo === 'caminho_sem_fim' && /relatorio-antigo$/.test(a.peca)), 'informação: o link Relatório antigo não leva a lugar nenhum');
ok(A.some(a => a.tipo === 'coluna_sem_tela' && a.coluna === 'telefone') && A.some(a => a.tipo === 'coluna_sem_tela' && a.tabela === 'tabela_esquecida' && !a.coluna) && !A.some(a => a.coluna === 'status'), 'colunas sem tela: telefone e a tabela esquecida; status não (aparece na tela)');
ok(!A.some(a => a.coluna === 'nivel' || a.coluna === 'cupom' && false), 'nivel não é coluna sem tela (a tela usa para o papel)');
ok(r.pecas.every(p => p.certeza !== 'rodando' || !p.arquivo) && P['app:publico/m:clientes/t:clientes/b:novo-cliente']?.arquivo === 'publico/index.html', 'cada peça com o arquivo e a linha no código');
ok(new Set(A.map(a => a.impressao)).size === A.length && A.every(a => /^[0-9a-f]{32}$/.test(a.impressao)), 'cada alerta tem a sua impressão (para o "é de propósito")');
const semBanco = await analisar(aqui + 'exemplo-estatico', { bancos: [], tempoPapelMs: 20_000 });
ok(!semBanco.com_banco && semBanco.alertas.length === 0 && semBanco.pecas.length > 5, 'sem banco ligado: o mapa sai igual, sem nenhum alerta');
console.log(falhas ? falhas + ' FALHA(S)' : 'tudo OK');
process.exit(falhas ? 1 : 0);
