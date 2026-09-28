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
  if (/should be (at least|different)|weak/i.test(m)) return 'Escolha outra senha, com pelo menos 8 caracteres e diferente da anterior.';
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

async function entrar(sessao){
  const {data, error} = await sb.rpc('vincular_meu_login');
  if (error){ mostrar('login'); aviso(raiz.querySelector('[data-etapa="login"]'), 'erro', traduz(error)); return; }
  const p = Array.isArray(data) ? data[0] : data;
  if (!p){ raiz.querySelector('[data-email]').textContent = sessao.user.email || ''; mostrar('sem-acesso'); return; }
  document.body.classList.add('logado');
  if (window.itiaEntrouComo) window.itiaEntrouComo(p);
}
function mostrarTrocar(){
  const f = raiz.querySelector('[data-etapa="trocar"]');
  const convite = tipoLink === 'invite';
  f.querySelector('h1').textContent = convite ? 'Bem-vindo ao Sistema IT.IA' : 'Criar a senha nova';
  f.querySelector('.entrada-sub').textContent = convite ? 'Crie a sua senha para entrar. Use pelo menos 8 caracteres.' : 'Use pelo menos 8 caracteres.';
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
  if (f.senha.value.length < 8) return aviso(f, 'erro', 'A senha precisa ter pelo menos 8 caracteres.');
  if (f.senha.value !== f.senha2.value) return aviso(f, 'erro', 'As duas senhas não estão iguais.');
  aviso(f); ocupado(f, true);
  const {data, error} = await sb.auth.updateUser({password: f.senha.value});
  ocupado(f, false);
  if (error) return aviso(f, 'erro', traduz(error));
  trocandoSenha = false; f.reset(); history.replaceState(null, '', location.pathname);
  const s = (await sb.auth.getSession()).data.session; mostrar('carregando'); entrar(s || {user: data.user});
});
raiz.addEventListener('click', ev => {
  const ir = ev.target.closest('[data-ir]'); if (ir){ mostrar(ir.dataset.ir); const de = raiz.querySelector('[data-etapa="login"] input[name=email]').value; const para = raiz.querySelector('[data-etapa="' + ir.dataset.ir + '"] input[name=email]'); if (para && de && !para.value) para.value = de; return; }
  const v = ev.target.closest('[data-ver-senha]'); if (v){ const i = v.previousElementSibling; const ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; v.textContent = ver ? 'Esconder' : 'Mostrar'; v.setAttribute('aria-label', ver ? 'Esconder a senha' : 'Mostrar a senha'); return; }
  if (ev.target.closest('[data-sair]')) sair();
});

/* botão Sair no menu lateral */
const rodape = document.querySelector('.menu-rodape .rodape-txt');
if (rodape){ const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-sair'; b.textContent = 'Sair'; b.addEventListener('click', sair); rodape.appendChild(b); }

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
