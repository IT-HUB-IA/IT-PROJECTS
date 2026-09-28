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
window.itiaBanco = sb;
let trocandoSenha = tipoLink === 'recovery' || tipoLink === 'invite';
if (tipoLink === 'signup' || tipoLink === 'email') history.replaceState(null, '', location.pathname);

async function entrar(sessao){
  const {data, error} = await sb.rpc('vincular_meu_login');
  if (error){ mostrar('login'); aviso(raiz.querySelector('[data-etapa="login"]'), 'erro', traduz(error)); return; }
  const p = Array.isArray(data) ? data[0] : data;
  if (!p){ raiz.querySelector('[data-email]').textContent = sessao.user.email || ''; mostrar('sem-acesso'); return; }
  // primeiro lê o banco (a tela de "carregando" continua aparecendo), depois mostra o sistema
  if (window.itiaEntrouComo) await window.itiaEntrouComo(p);
  document.body.classList.add('logado');
}
function mostrarTrocar(){
  const f = raiz.querySelector('[data-etapa="trocar"]');
  const convite = tipoLink === 'invite';
  f.querySelector('h1').textContent = convite ? 'Bem-vindo ao Sistema IT.IA' : 'Criar a senha nova';
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
  cad.querySelector('.entrada-botao').textContent = n === 4 ? 'Criar minha conta' : 'Continuar';
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
    if (!emailOk(f.email.value.trim())) return erroCampo(f.email, 'Digite um e-mail válido.');
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
    if (!senhaForte(f.senha.value)) return erroCampo(f.senha, 'A senha ainda não segue todas as regras da lista.');
    if (f.senha.value !== f.senha2.value) return erroCampo(f.senha2, 'As duas senhas não estão iguais.');
    if (!f.termos.checked) return erroCampo(f.termos, 'Marque a caixa de concordância para criar a conta.');
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
cad.querySelector('[data-voltar]').addEventListener('click', () => irPasso(Math.max(1, passo - 1)));
cad.querySelectorAll('.entrada-passos li').forEach(li => li.addEventListener('click', () => { const p = +li.dataset.p; if (p < passo) irPasso(p); }));
cad.addEventListener('submit', async ev => {
  ev.preventDefault(); const f = cad;
  if (!passoOk(passo)) return;
  if (passo < 4) return irPasso(passo + 1);
  for (let n = 1; n <= 3; n++) if (!passoOk(n)) return irPasso(n), passoOk(n);
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
  if (erroLink){
    history.replaceState(null, '', location.pathname);
    mostrar('login');
    return aviso(raiz.querySelector('[data-etapa="login"]'), 'erro', /expired/i.test(erroLink) ? 'Esse link já venceu ou já foi usado. Peça um novo em "Esqueci minha senha".' : 'Esse link não é válido. Peça um novo em "Esqueci minha senha".');
  }
  if (trocandoSenha) return mostrarTrocar();
  if (data.session) entrar(data.session); else mostrar('login');
})();
})();
