/* ===== Login (Supabase Auth). A chave abaixo é a chave pública do projeto: foi feita para ficar na tela;
   quem protege os dados são as regras de acesso (RLS) do banco. ===== */
(function(){
'use strict';
const URL_BANCO = 'https://tfcvoszeewmpghgxztuy.supabase.co';
const CHAVE_PUBLICA = 'sb_publishable_gCsZr12PJB8syyPGf7AUuQ_ir0g0WAy';

const raiz = document.getElementById('entrada');
// o link do e-mail (esqueci a senha, convite) chega no endereço; lido antes de a biblioteca limpar
const LINK = new URLSearchParams(location.hash.replace(/^#/, '') + '&' + location.search.replace(/^\?/, ''));
const tipoLink = LINK.get('type');
const erroLink = LINK.get('error_code') || LINK.get('error');
const etapas = [...raiz.querySelectorAll('[data-etapa]')];
function mostrar(nome){
  etapas.forEach(e => { e.hidden = e.dataset.etapa !== nome; });
  const f = raiz.querySelector('[data-etapa="' + nome + '"] input');
  if (f) setTimeout(() => f.focus(), 0);
}
function aviso(form, tipo, txt){
  const e = form.querySelector('[data-erro]'), o = form.querySelector('[data-ok]');
  if (e) { e.hidden = tipo !== 'erro'; e.textContent = tipo === 'erro' ? txt : ''; }
  if (o) { o.hidden = tipo !== 'ok'; o.textContent = tipo === 'ok' ? txt : ''; }
}
function traduz(err){
  const m = String((err && err.message) || err || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme o seu e-mail pelo link que enviamos antes de entrar.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (/should be (at least|different)|weak/i.test(m)) return 'Escolha outra senha: com 8 ou mais caracteres, letra maiúscula, número e caractere especial, e diferente da anterior.';
  if (/fetch|network|Failed to/i.test(m)) return 'Não foi possível falar com o servidor. Confira a internet e tente de novo.';
  return 'Não deu certo: ' + m;
}
function ocupado(form, sim){ const b = form.querySelector('.entrada-botao'); if (b) { b.disabled = sim; } }
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

if (!window.supabase || !window.supabase.createClient){
  mostrar('login');
  aviso(raiz.querySelector('[data-etapa="login"]'), 'erro', 'Não foi possível carregar o login. Confira a internet e recarregue a página.');
  return;
}
const sb = window.supabase.createClient(URL_BANCO, CHAVE_PUBLICA, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
window.ciclodevBanco = sb;
let trocandoSenha = tipoLink === 'recovery' || tipoLink === 'invite';
if (tipoLink === 'signup' || tipoLink === 'email') history.replaceState(null, '', location.pathname);

async function entrar(sessao){
  const {data, error} = await sb.rpc('vincular_meu_login');
  if (error){ mostrar('login'); aviso(raiz.querySelector('[data-etapa="login"]'), 'erro', traduz(error)); return; }
  const p = Array.isArray(data) ? data[0] : data;
  if (!p){ raiz.querySelector('[data-email]').textContent = sessao.user.email || ''; mostrar('sem-acesso'); return; }
  const falta = await faltaCadastro(p);
  if (falta) return mostrarCompletar(sessao, p, falta);
  return abrirSistema(p);
}
async function abrirSistema(p){
  // primeiro lê o banco (a tela de "carregando" continua aparecendo), depois mostra o sistema
  if (window.ciclodevEntrouComo) await window.ciclodevEntrouComo(p);
  document.body.classList.add('logado');
}
/* quem entrou pelo Google, GitHub, Apple ou Microsoft não tem CPF, nascimento, endereço nem uso: pede antes de abrir o sistema.
   O dono do sistema entra direto. Se não der para conferir (banco fora do ar), não trava a entrada. */
const cadastroCompleto = d => !!(d && d.nome_completo && d.data_nascimento && d.cpf && d.cep && d.logradouro && d.numero && d.bairro && d.cidade && d.uf && d.uso && d.termos_aceitos_em && (d.uso !== 'trabalho' || d.cargo));
async function faltaCadastro(p){
  try {
    const dono = await sb.rpc('sou_dono_sistema');
    if (dono.error || dono.data === true) return null;
    const r = await sb.from('pessoas_privado').select('*');
    if (r.error || !Array.isArray(r.data)) return null;
    const d = r.data[0] || {};
    return cadastroCompleto(d) ? null : d;
  } catch (e) { return null; }
}
function mostrarTrocar(){
  const f = raiz.querySelector('[data-etapa="trocar"]');
  const convite = tipoLink === 'invite';
  f.querySelector('h1').textContent = convite ? 'Bem-vindo ao CicloDev' : 'Criar a senha nova';
  f.querySelector('.entrada-sub').textContent = convite ? 'Crie a sua senha para entrar. Ela precisa seguir as regras abaixo.' : 'A senha precisa seguir as regras abaixo.';
  mostrar('trocar');
}
async function sair(){ await sb.auth.signOut(); location.replace(location.pathname); }

raiz.querySelector('[data-etapa="login"]').addEventListener('submit', async ev => {
  ev.preventDefault(); const f = ev.currentTarget;
  const email = f.email.value.trim(), senha = f.senha.value;
  if (!emailOk(email)) return aviso(f, 'erro', 'Digite um e-mail válido.');
  if (!senha) return aviso(f, 'erro', 'Digite a senha.');
  aviso(f); ocupado(f, true);
  const {data, error} = await sb.auth.signInWithPassword({email, password: senha});
  ocupado(f, false);
  if (error) return aviso(f, 'erro', traduz(error));
  f.senha.value = ''; mostrar('carregando'); entrar(data.session);
});
/* ===== cadastro em 4 passos ===== */
const soDigitos = v => String(v || '').replace(/\D/g, '');
function cpfValido(v){
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
// regra da senha: 8 ou mais caracteres, uma maiúscula, um número e um caractere especial
const REGRAS_SENHA = {tam: s => s.length >= 8, mai: s => /[A-ZÀ-Ý]/.test(s), num: s => /\d/.test(s), esp: s => /[^A-Za-zÀ-ÿ0-9\s]/.test(s)};
const senhaForte = s => Object.values(REGRAS_SENHA).every(t => t(s));
function marcarRegras(form){
  const s = form.senha.value, lista = form.querySelector('[data-regras]'); if (!lista) return;
  lista.querySelectorAll('[data-r]').forEach(li => li.classList.toggle('ok', REGRAS_SENHA[li.dataset.r](s)));
}
function idade(iso){
  const n = new Date(iso + 'T00:00:00'); if (isNaN(n)) return -1;
  const h = new Date(); let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}
const cad = raiz.querySelector('[data-etapa="cadastro"]');
let passo = 1;
function irPasso(n){
  passo = n;
  cad.querySelectorAll('[data-passo]').forEach(fs => { fs.hidden = +fs.dataset.passo !== n; });
  cad.querySelectorAll('.entrada-passos li').forEach(li => { const p = +li.dataset.p; li.classList.toggle('atual', p === n); li.classList.toggle('feito', p < n); });
  cad.querySelector('[data-voltar]').hidden = n === 1;
  cad.querySelector('.entrada-botao').textContent = n === 4 ? (completando() ? 'Salvar e entrar' : 'Criar minha conta') : 'Continuar';
  cad.querySelectorAll('[data-so-passo1]').forEach(e => { e.hidden = n !== 1 || completando(); });
  aviso(cad);
  const f = cad.querySelector('[data-passo="' + n + '"] input:not([type=radio]):not([type=checkbox])'); if (f) setTimeout(() => f.focus(), 0);
}
function erroCampo(campo, txt){ aviso(cad, 'erro', txt); if (campo && campo.focus) campo.focus(); return false; }
function passoOk(n){
  const f = cad;
  if (n === 1){
    const nome = f.nome.value.trim().replace(/\s+/g, ' ');
    if (nome.length < 3 || nome.split(' ').length < 2) return erroCampo(f.nome, 'Escreva o seu nome completo (nome e sobrenome).');
    const i = idade(f.nascimento.value);
    if (!f.nascimento.value || i < 0 || i > 120) return erroCampo(f.nascimento, 'Digite uma data de nascimento válida.');
    if (!cpfValido(f.cpf.value)) return erroCampo(f.cpf, 'Esse CPF não é válido. Confira os números.');
    if (!completando() && !emailOk(f.email.value.trim())) return erroCampo(f.email, 'Digite um e-mail válido.');
  }
  if (n === 2){
    if (soDigitos(f.cep.value).length !== 8) return erroCampo(f.cep, 'Digite o CEP com 8 números.');
    if (!f.logradouro.value.trim()) return erroCampo(f.logradouro, 'Digite a rua.');
    if (!f.numero.value.trim()) return erroCampo(f.numero, 'Digite o número (se não tiver, escreva S/N).');
    if (!f.bairro.value.trim()) return erroCampo(f.bairro, 'Digite o bairro.');
    if (!f.cidade.value.trim()) return erroCampo(f.cidade, 'Digite a cidade.');
    if (!f.uf.value) return erroCampo(f.uf, 'Escolha o estado (UF).');
  }
  if (n === 3){
    if (!f.uso.value) return erroCampo(f.querySelector('input[name=uso]'), 'Escolha para que você vai usar o sistema.');
    if (f.uso.value === 'trabalho' && !f.cargo.value.trim()) return erroCampo(f.cargo, 'Digite o seu cargo.');
  }
  if (n === 4){
    if (!completando() && !senhaForte(f.senha.value)) return erroCampo(f.senha, 'A senha ainda não segue todas as regras da lista.');
    if (!completando() && f.senha.value !== f.senha2.value) return erroCampo(f.senha2, 'As duas senhas não estão iguais.');
    if (!f.termos.checked) return erroCampo(f.termos, 'Marque a caixa de concordância para ' + (completando() ? 'continuar.' : 'criar a conta.'));
  }
  return true;
}
// máscaras
cad.cpf.addEventListener('input', () => { const d = soDigitos(cad.cpf.value).slice(0, 11); cad.cpf.value = d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2'); });
let cepBuscado = '';
cad.cep.addEventListener('input', async () => {
  const d = soDigitos(cad.cep.value).slice(0, 8); cad.cep.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  const dica = cad.querySelector('[data-cep-aviso]');
  if (d.length !== 8 || d === cepBuscado) return;
  cepBuscado = d; dica.textContent = 'Procurando o endereço…';
  try {
    const r = await fetch('https://viacep.com.br/ws/' + d + '/json/'); const j = await r.json();
    if (j.erro) { dica.textContent = 'Não achamos esse CEP. Preencha o endereço à mão.'; return; }
    if (j.logradouro) cad.logradouro.value = j.logradouro;
    if (j.bairro) cad.bairro.value = j.bairro;
    if (j.localidade) cad.cidade.value = j.localidade;
    if (j.uf) cad.uf.value = j.uf;
    dica.textContent = 'Endereço encontrado. Confira e complete o número.';
    (j.logradouro ? cad.numero : cad.logradouro).focus();
  } catch (e) { dica.textContent = 'Não foi possível buscar o CEP agora. Preencha o endereço à mão.'; }
});
cad.addEventListener('change', ev => {
  if (ev.target.name !== 'uso') return;
  const u = ev.target.value;
  cad.querySelector('[data-rotulo-cargo]').innerHTML = u === 'estudo' ? 'Curso <i>(opcional)</i>' : u === 'trabalho' ? 'Cargo' : 'Cargo <i>(opcional)</i>';
  cad.querySelector('[data-rotulo-empresa]').innerHTML = (u === 'estudo' ? 'Instituição de ensino' : 'Empresa') + ' <i>(opcional)</i>';
  cad.cargo.placeholder = u === 'estudo' ? 'Ex.: Engenharia de Software' : 'Ex.: Gerente de projetos';
});
raiz.querySelectorAll('input[name=senha]').forEach(i => { const f = i.form; if (f.querySelector('[data-regras]')) i.addEventListener('input', () => marcarRegras(f)); });
cad.addEventListener('input', () => { const e = cad.querySelector('[data-erro]'); if (e && !e.hidden) aviso(cad); });
let COMPLETAR = null;
const completando = () => !!COMPLETAR;
function mostrarCompletar(sessao, p, d){
  COMPLETAR = {p, sessao};
  const m = (sessao && sessao.user && sessao.user.user_metadata) || {};
  const prov = PROV_NOME[(sessao && sessao.user && sessao.user.app_metadata && sessao.user.app_metadata.provider) || ''] || '';
  cad.dataset.modo = 'completar';
  cad.querySelector('h1').textContent = 'Complete o seu cadastro';
  cad.querySelector('.entrada-sub').textContent = 'Falta pouco. ' + (prov ? 'A sua conta ' + prov + ' não informa estes dados' : 'Precisamos de alguns dados') + ' e eles são pedidos uma vez só.';
  cad.querySelector('[data-legenda-4]').textContent = 'Confirmar';
  const ult = cad.querySelector('.entrada-passos li[data-p="4"]'); if (ult) ult.textContent = 'Confirmar';
  cad.querySelectorAll('[data-so-cadastro]').forEach(e => { e.hidden = true; });
  cad.querySelectorAll('[data-so-completar]').forEach(e => { e.hidden = false; });
  const val = (campo, v) => { if (v && !cad[campo].value) cad[campo].value = v; };
  val('nome', d.nome_completo || m.full_name || m.name || p.nome);
  val('nascimento', d.data_nascimento); val('cep', d.cep ? String(d.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2') : '');
  if (d.cpf) cad.cpf.value = String(d.cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  ['logradouro','numero','complemento','bairro','cidade','uf','cargo','empresa'].forEach(k => val(k, d[k]));
  if (d.uso){ const r = cad.querySelector('input[name=uso][value="' + d.uso + '"]'); if (r){ r.checked = true; r.dispatchEvent(new Event('change', {bubbles:true})); } }
  cad.email.value = (sessao && sessao.user && sessao.user.email) || '';
  mostrar('cadastro'); irPasso(1);
}
async function salvarCompletar(){
  const f = cad, {p} = COMPLETAR;
  const nome = f.nome.value.trim().replace(/\s+/g, ' ');
  const linha = {pessoa_id:p.pessoa_id, nome_completo:nome, data_nascimento:f.nascimento.value, cpf:soDigitos(f.cpf.value), cep:soDigitos(f.cep.value),
    logradouro:f.logradouro.value.trim(), numero:f.numero.value.trim(), complemento:f.complemento.value.trim() || null, bairro:f.bairro.value.trim(),
    cidade:f.cidade.value.trim(), uf:f.uf.value, uso:f.uso.value, cargo:f.cargo.value.trim() || null, empresa:f.empresa.value.trim() || null, termos_aceitos_em:new Date().toISOString()};
  aviso(f); ocupado(f, true);
  const {data, error} = await sb.from('pessoas_privado').upsert(linha, {onConflict:'pessoa_id'}).select('pessoa_id');
  ocupado(f, false);
  if (error){
    if (/cpf_uq|duplicate/i.test(error.message)) { irPasso(1); return erroCampo(f.cpf, 'Esse CPF já está em outra conta. Entre com a conta em que você usou esse CPF.'); }
    if (/cpf_valido|check/i.test(error.message)) { irPasso(1); return erroCampo(f.cpf, 'Confira o CPF e a data de nascimento.'); }
    return aviso(f, 'erro', traduz(error));
  }
  if (!data || !data.length) return aviso(f, 'erro', 'Não foi possível salvar os seus dados. Tente de novo.');
  if (nome && nome !== p.nome){ await sb.from('pessoas').update({nome: nome}).eq('id', p.pessoa_id).select('id'); p.nome = nome; }
  COMPLETAR = null; mostrar('carregando'); abrirSistema(p);
}

/* entrar com Google, GitHub, Apple ou Microsoft (Supabase Auth). Só funciona depois de ligar cada um no Supabase. */
const PROVEDORES = [
  ['google', 'Google', '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>'],
  ['github', 'GitHub', '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z"/></svg>'],
  ['apple', 'Apple', '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.9zM13.9 5c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>'],
  ['azure', 'Microsoft', '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#F25022" d="M1 1h10.5v10.5H1z"/><path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z"/><path fill="#00A4EF" d="M1 12.5h10.5V23H1z"/><path fill="#FFB900" d="M12.5 12.5H23V23H12.5z"/></svg>']
];
const PROV_NOME = Object.fromEntries(PROVEDORES.map(([k, n]) => [k, n]));
let PROV_ATIVOS = null;   // o que está ligado no Supabase (lido das configurações públicas do login)
fetch(URL_BANCO + '/auth/v1/settings', {headers:{apikey: CHAVE_PUBLICA}}).then(r => r.ok ? r.json() : null).then(j => { if (j && j.external) PROV_ATIVOS = j.external; }).catch(() => {});
raiz.querySelectorAll('[data-sociais] .entrada-sociais-botoes').forEach(caixa => {
  caixa.innerHTML = PROVEDORES.map(([k, n, ico]) => '<button type="button" class="entrada-social" data-provedor="' + k + '">' + ico + '<span>' + n + '</span></button>').join('');
});
raiz.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-provedor]'); if (!b) return;
  const form = b.closest('form'); const k = b.dataset.provedor, nome = PROV_NOME[k];
  if (PROV_ATIVOS && !PROV_ATIVOS[k]) return aviso(form, 'erro', 'O login com ' + nome + ' ainda não foi ativado. Por enquanto, use e-mail e senha.');
  aviso(form); b.disabled = true;
  const {error} = await sb.auth.signInWithOAuth({provider: k, options: Object.assign({redirectTo: location.origin + location.pathname}, k === 'azure' ? {scopes: 'email'} : {})});
  b.disabled = false;
  if (error) aviso(form, 'erro', /not enabled|unsupported provider/i.test(error.message) ? 'O login com ' + nome + ' ainda não foi ativado. Por enquanto, use e-mail e senha.' : traduz(error));
});
cad.querySelector('[data-voltar]').addEventListener('click', () => irPasso(Math.max(1, passo - 1)));
cad.querySelectorAll('.entrada-passos li').forEach(li => li.addEventListener('click', () => { const p = +li.dataset.p; if (p < passo) irPasso(p); }));
cad.addEventListener('submit', async ev => {
  ev.preventDefault(); const f = cad;
  if (!passoOk(passo)) return;
  if (passo < 4) return irPasso(passo + 1);
  for (let n = 1; n <= 3; n++) if (!passoOk(n)) return irPasso(n), passoOk(n);
  if (completando()) return salvarCompletar();
  const email = f.email.value.trim(), senha = f.senha.value;
  const dados = {
    nome: f.nome.value.trim().replace(/\s+/g, ' '), nascimento: f.nascimento.value, cpf: soDigitos(f.cpf.value),
    cep: soDigitos(f.cep.value), logradouro: f.logradouro.value.trim(), numero: f.numero.value.trim(), complemento: f.complemento.value.trim(),
    bairro: f.bairro.value.trim(), cidade: f.cidade.value.trim(), uf: f.uf.value,
    uso: f.uso.value, cargo: f.cargo.value.trim(), empresa: f.empresa.value.trim(), termos: 'sim'
  };
  aviso(f); ocupado(f, true);
  const {data, error} = await sb.auth.signUp({email, password: senha, options: {data: dados, emailRedirectTo: location.origin + location.pathname}});
  ocupado(f, false);
  if (error){
    if (/already|registered|exists/i.test(error.message)) { irPasso(1); return erroCampo(f.email, 'Já existe uma conta com esse e-mail. Entre ou use "Esqueci minha senha".'); }
    if (/database error|saving new user/i.test(error.message)) { irPasso(1); return erroCampo(f.cpf, 'Não foi possível criar a conta com esse CPF. Ele pode já ter uma conta: tente entrar ou use "Esqueci minha senha".'); }
    return aviso(f, 'erro', traduz(error));
  }
  f.senha.value = ''; f.senha2.value = ''; marcarRegras(f);
  if (data.session){ mostrar('carregando'); return entrar(data.session); }
  f.querySelectorAll('[data-passo], .entrada-passos, .entrada-navega').forEach(e => { e.hidden = true; });
  aviso(f, 'ok', 'Conta criada. Enviamos um e-mail para ' + email + ': clique no link para confirmar e entrar.');
});
raiz.querySelector('[data-etapa="esqueci"]').addEventListener('submit', async ev => {
  ev.preventDefault(); const f = ev.currentTarget; const email = f.email.value.trim();
  if (!emailOk(email)) return aviso(f, 'erro', 'Digite um e-mail válido.');
  aviso(f); ocupado(f, true);
  const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname});
  ocupado(f, false);
  if (error) return aviso(f, 'erro', traduz(error));
  aviso(f, 'ok', 'Pronto. Se esse e-mail tiver acesso, o link chega em alguns minutos. Confira também a caixa de spam.');
});
raiz.querySelector('[data-etapa="trocar"]').addEventListener('submit', async ev => {
  ev.preventDefault(); const f = ev.currentTarget;
  if (!senhaForte(f.senha.value)) return aviso(f, 'erro', 'A senha ainda não segue todas as regras da lista.');
  if (f.senha.value !== f.senha2.value) return aviso(f, 'erro', 'As duas senhas não estão iguais.');
  aviso(f); ocupado(f, true);
  const {data, error} = await sb.auth.updateUser({password: f.senha.value});
  ocupado(f, false);
  if (error) return aviso(f, 'erro', traduz(error));
  trocandoSenha = false; f.reset(); history.replaceState(null, '', location.pathname);
  const s = (await sb.auth.getSession()).data.session; mostrar('carregando'); entrar(s || {user: data.user});
});
raiz.addEventListener('click', ev => {
  const ir = ev.target.closest('[data-ir]'); if (ir){ mostrar(ir.dataset.ir); if (ir.dataset.ir === 'cadastro') irPasso(1); const de = raiz.querySelector('[data-etapa="login"] input[name=email]').value; const para = raiz.querySelector('[data-etapa="' + ir.dataset.ir + '"] input[name=email]'); if (para && de && !para.value) para.value = de; return; }
  const v = ev.target.closest('[data-ver-senha]'); if (v){ const i = v.previousElementSibling; const ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; v.textContent = ver ? 'Esconder' : 'Mostrar'; v.setAttribute('aria-label', ver ? 'Esconder a senha' : 'Mostrar a senha'); return; }
  if (ev.target.closest('[data-sair]')) sair();
});

/* botão Sair no menu lateral */
const rodape = document.querySelector('.menu-rodape .rodape-txt');
if (rodape){ const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-sair'; b.setAttribute('aria-label', 'Sair do sistema'); b.title = 'Sair';
  b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" aria-hidden="true"><path d="M9 4H5v16h4"/><path d="M14 8l4 4-4 4"/><path d="M18 12H9"/></svg>';
  b.addEventListener('click', sair); rodape.appendChild(b); }

sb.auth.onAuthStateChange((evento, sessao) => {
  if (evento === 'PASSWORD_RECOVERY'){ trocandoSenha = true; mostrarTrocar(); }
  else if (evento === 'SIGNED_OUT'){ document.body.classList.remove('logado'); mostrar('login'); }
});
(async () => {
  const {data} = await sb.auth.getSession();
  if (erroLink && /provider|oauth|access_denied/i.test((LINK.get('error_description') || '') + ' ' + erroLink)){
    history.replaceState(null, '', location.pathname); mostrar('login');
    return aviso(raiz.querySelector('[data-etapa="login"]'), 'erro', /access_denied/i.test(erroLink) ? 'O acesso foi cancelado na outra conta. Tente de novo ou use e-mail e senha.' : 'Não foi possível entrar com essa conta agora. Tente de novo ou use e-mail e senha.');
  }
  if (erroLink){
    history.replaceState(null, '', location.pathname);
    mostrar('login');
    return aviso(raiz.querySelector('[data-etapa="login"]'), 'erro', /expired/i.test(erroLink) ? 'Esse link já venceu ou já foi usado. Peça um novo em "Esqueci minha senha".' : 'Esse link não é válido. Peça um novo em "Esqueci minha senha".');
  }
  if (trocandoSenha) return mostrarTrocar();
  if (data.session) entrar(data.session); else mostrar('login');
})();
})();
