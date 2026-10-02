def _regras_seg():
    t=open('../supabase/functions/diagramas-auto/seguranca.ts',encoding='utf-8').read()
    i=t.index('export const REGRAS: Regra[] = ['); f=t.index('\n];',i)
    corpo=t[i+len('export const REGRAS: Regra[] = '):f+3]
    return "const SG_OWASP = n => 'OWASP ' + n.replace(/_/g, ' ');\nconst SG_REGRAS = "+corpo.replace('OWASP(','SG_OWASP(')+'\n'
head=open('parte_head.html',encoding='utf-8').read()
css=open('parte_css_base.css',encoding='utf-8').read()+open('app.css',encoding='utf-8').read()+open('design.css',encoding='utf-8').read()+open('tarefas.css',encoding='utf-8').read()+open('entregas.css',encoding='utf-8').read()+open('simples.css',encoding='utf-8').read()+open('produtividade.css',encoding='utf-8').read()+open('comunicacao.css',encoding='utf-8').read()+open('relatorios.css',encoding='utf-8').read()+open('janelas.css',encoding='utf-8').read()+open('estrutura.css',encoding='utf-8').read()+open('ajustes.css',encoding='utf-8').read()+open('lote.css',encoding='utf-8').read()+open('versoes.css',encoding='utf-8').read()+open('navegar.css',encoding='utf-8').read()+open('portal.css',encoding='utf-8').read()+open('ia.css',encoding='utf-8').read()+open('infra.css',encoding='utf-8').read()+open('po.css',encoding='utf-8').read()+open('calendario.css',encoding='utf-8').read()+open('seguranca.css',encoding='utf-8').read()+open('servidores.css',encoding='utf-8').read()+open('inventario.css',encoding='utf-8').read()
pb=open('parte_playbook.html',encoding='utf-8').read().replace('class="conteudo" id="tela-playbook"','class="conteudo cheio" id="tela-playbook"').replace('<h1 id="titulo-pb">','<div class="topo-hero"><div><h1 id="titulo-pb">',1).replace('mesmo com uma pessoa só no time.</p>','mesmo com uma pessoa só no time.</p></div></div>',1)
js=open('app.js',encoding='utf-8').read()
_fim='\nabrirModulo(UI.modulo);\n})();'
assert js.rstrip().endswith(_fim.strip()), 'final do app.js mudou'
js=js.rstrip()[:-len(_fim.strip())]+'\n'+open('recursos.js',encoding='utf-8').read()+'\n'+open('board.js',encoding='utf-8').read()+'\n'+open('multiusuario.js',encoding='utf-8').read()+'\n'+open('admin.js',encoding='utf-8').read()+'\n'+open('studio.js',encoding='utf-8').read()+'\n'+open('tarefas.js',encoding='utf-8').read()+'\n'+open('entregas.js',encoding='utf-8').read()+'\n'+open('git.js',encoding='utf-8').read()+'\n'+open('simples.js',encoding='utf-8').read()+'\n'+open('produtividade.js',encoding='utf-8').read()+'\n'+open('comunicacao.js',encoding='utf-8').read()+'\n'+open('relatorios.js',encoding='utf-8').read()+'\n'+open('janelas.js',encoding='utf-8').read()+'\n'+open('estrutura.js',encoding='utf-8').read()+'\n'+open('ajustes.js',encoding='utf-8').read()+'\n'+open('frentes.js',encoding='utf-8').read()+'\n'+open('lote.js',encoding='utf-8').read()+'\n'+open('versoes.js',encoding='utf-8').read()+'\n'+open('navegar.js',encoding='utf-8').read()+'\n'+open('decisoes.js',encoding='utf-8').read()+'\n'+open('exportar.js',encoding='utf-8').read()+'\n'+open('persistir.js',encoding='utf-8').read()+'\n'+open('arquivos.js',encoding='utf-8').read()+'\n'+open('prefs.js',encoding='utf-8').read()+'\n'+open('portal.js',encoding='utf-8').read()+'\n'+open('ia.js',encoding='utf-8').read()+'\n'+open('paistatus.js',encoding='utf-8').read()+'\n'+open('tabela_lote.js',encoding='utf-8').read()+'\n'+open('infra.js',encoding='utf-8').read()+'\n'+open('infra_auto.js',encoding='utf-8').read()+'\n'+open('infra_visao.js',encoding='utf-8').read()+'\n'+open('ficha_auto.js',encoding='utf-8').read()+'\n'+open('criar.js',encoding='utf-8').read()+'\n'+open('po.js',encoding='utf-8').read()+'\n'+open('lote_editar.js',encoding='utf-8').read()+'\n'+open('po_guia.js',encoding='utf-8').read()+'\n'+open('calendario.js',encoding='utf-8').read()+'\n'+_regras_seg()+open('seguranca.js',encoding='utf-8').read()+'\n'+open('servidores.js',encoding='utf-8').read()+'\n'+open('lib_qrcode.js',encoding='utf-8').read()+'\n'+open('inventario.js',encoding='utf-8').read()+'\n'+open('inventario_acoes.js',encoding='utf-8').read()+'\n'+open('inventario_extra.js',encoding='utf-8').read()+'\n'+open('po_leva2.js',encoding='utf-8').read()+'\n'+open('estado.js',encoding='utf-8').read()+'\n'+_fim.strip()+'\n'
import json, html as _h
from explicacoes import EXPL
js='window.EXPL = '+json.dumps(EXPL, ensure_ascii=False)+';\n'+js
# base de conhecimento do DevIT (guia de ligar banco): a mesma que a função devit usa, fonte única em supabase/functions/_shared
js='window.DEVIT_CONHECIMENTO = '+json.dumps(json.load(open('../supabase/functions/_shared/devit_conhecimento.json',encoding='utf-8')), ensure_ascii=False).replace('</','<\\/')+';\n'+js
# o canvas da aba Infraestrutura vai junto, como texto (a aba monta ele num iframe); '</' escapado para não fechar o script da página
js='window.CANVAS_INFRA_HTML = '+json.dumps(open('canvas_infra.html',encoding='utf-8').read(), ensure_ascii=False).replace('</','<\\/')+';\n'+js
def _esc(t): return _h.escape(t, quote=True).replace('&#x27;','&#39;')
for _k,_v in EXPL.items():
  pb=pb.replace('data-info="'+_esc(_k)+'"','data-info="'+_esc(_v)+'"').replace('aria-label="O que é: '+_esc(_k)+'"','aria-label="O que é: '+_esc(_v)+'"')
P='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">'
MODS=[
 ('overview','Overview',P+'<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>'),
 ('painel','Meu painel',P+'<path d="M3 12l9-8 9 8"></path><path d="M5 10v10h14V10"></path><path d="M10 20v-6h4v6"></path></svg>'),
 ('operacoes','Operações',P+'<path d="M12 3l9 4.5-9 4.5-9-4.5z"></path><path d="M3 12l9 4.5 9-4.5"></path><path d="M3 16.5l9 4.5 9-4.5"></path></svg>'),
 ('clientes','Clients',P+'<rect x="3" y="7" width="18" height="14"></rect><path d="M8 7V3h8v4"></path><path d="M3 13h18"></path></svg>'),
 ('catalog','Catalog',P+'<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z"></path><path d="M16.5 13v7M13 16.5h7"></path></svg>'),
 ('custos','Costs',P+'<circle cx="12" cy="12" r="9"></circle><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5"></path></svg>'),
 ('servicedesk','Service Desk',P+'<path d="M4 4h16v12H8l-4 4z"></path><path d="M8 9h8M8 12h5"></path></svg>'),
 ('time','Team',P+'<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2"></path></svg>'),
 ('agentes','Agent Studio',P+'<rect x="4" y="7" width="16" height="12"></rect><path d="M12 3v4M9 12v2M15 12v2M2 12v3M22 12v3"></path></svg>'),
 ('playbook','Playbook',P+'<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"></path><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"></path></svg>'),
 ('lixeira','Lixeira',P+'<path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 13h10l1-13"></path><path d="M10 11v6M14 11v6"></path></svg>'),
 ('configuracoes','Settings',P+'<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path></svg>'),
 ('admin','Admin',P+'<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"></path><path d="M9 12l2 2 4-4"></path></svg>'),
]
menu='\n'.join('        <li><button class="item" type="button" data-nome="%s" data-tela="%s"><span class="item-ico">%s</span><span class="item-nome">%s</span></button></li>'%(n,k,ic,n) for k,n,ic in MODS)
menu=menu.replace('<li><button class="item" type="button" data-nome="Admin"','<li hidden><button class="item" type="button" data-nome="Admin"')
menu=menu.replace('<li><button class="item" type="button" data-nome="Agent Studio"','<li hidden><button class="item" type="button" data-nome="Agent Studio"')
secoes=''.join('    <section class="conteudo %s" id="tela-%s" hidden><div id="m-%s"></div></section>\n'%('sem-pad' if k=='operacoes' else 'cheio',k,k) for k,n,ic in MODS if k!='playbook')
base_js=r'''
(function(){
  const app = document.getElementById('app');
  const botao = document.getElementById('alternar');
  const dica = document.getElementById('dica');
  const CHAVE = 'ciclodev-menu-recolhido';
  function aplicar(recolhido){
    app.classList.toggle('recolhido', recolhido);
    botao.setAttribute('aria-expanded', String(!recolhido));
    const txt = recolhido ? 'Expandir menu' : 'Recolher menu';
    botao.setAttribute('aria-label', txt); botao.title = txt;
    if (!recolhido) dica.hidden = true;
  }
  const estreito = window.matchMedia('(max-width: 720px)');
  let inicial = estreito.matches;
  if (!inicial){ try { const v = localStorage.getItem(CHAVE); if (v !== null) inicial = v === '1'; } catch(e){} }
  estreito.addEventListener('change', e => { if (e.matches) aplicar(true); });
  aplicar(inicial);
  function alternarMenu(){
    const recolhido = !app.classList.contains('recolhido');
    aplicar(recolhido);
    try { localStorage.setItem(CHAVE, recolhido ? '1' : '0'); } catch(e){}
  }
  botao.addEventListener('click', alternarMenu);
  document.getElementById('menu').addEventListener('click', e => {
    if (e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return;
    alternarMenu();
  });
  document.querySelectorAll('.item').forEach(el => {
    const mostrar = () => {
      if (!app.classList.contains('recolhido')) return;
      const r = el.getBoundingClientRect();
      dica.textContent = el.dataset.nome;
      dica.style.left = (r.right + 8) + 'px';
      dica.style.top = (r.top + r.height / 2 - 14) + 'px';
      dica.hidden = false;
    };
    const esconder = () => { dica.hidden = true; };
    el.addEventListener('mouseenter', mostrar); el.addEventListener('focus', mostrar);
    el.addEventListener('mouseleave', esconder); el.addEventListener('blur', esconder);
  });

  // "i" dos termos técnicos, para qualquer conteúdo, inclusive o que é desenhado depois
  const dicaInfo = document.getElementById('dica-info');
  let infoAberto = null;
  function mostrarInfo(el){
    const casa = el.closest('dialog[open]') || document.body; if (dicaInfo.parentNode !== casa) casa.appendChild(dicaInfo);
    dicaInfo.textContent = (window.EXPL && window.EXPL[el.dataset.info]) || el.dataset.info; dicaInfo.hidden = false;
    const r = el.getBoundingClientRect(), d = dicaInfo.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left + r.width / 2 - d.width / 2), window.innerWidth - d.width - 8);
    let y = r.bottom + 8; if (y + d.height > window.innerHeight - 8) y = r.top - d.height - 8;
    dicaInfo.style.left = x + 'px'; dicaInfo.style.top = y + 'px';
    if (infoAberto && infoAberto !== el) infoAberto.setAttribute('aria-expanded', 'false');
    infoAberto = el; el.setAttribute('aria-expanded', 'true');
  }
  function esconderInfo(){ dicaInfo.hidden = true; if (dicaInfo.parentNode !== document.body) document.body.appendChild(dicaInfo); if (infoAberto) infoAberto.setAttribute('aria-expanded', 'false'); infoAberto = null; }
  document.addEventListener('mouseover', e => { const el = e.target.closest('.info'); if (el) mostrarInfo(el); });
  document.addEventListener('mouseout', e => { const el = e.target.closest('.info'); if (el && !el.contains(e.relatedTarget)) esconderInfo(); });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('.info'); if (el) mostrarInfo(el); });
  document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('.info')) esconderInfo(); });
  document.addEventListener('click', e => { const el = e.target.closest('.info'); if (el){ e.preventDefault(); e.stopPropagation(); if (infoAberto === el && !dicaInfo.hidden) esconderInfo(); else mostrarInfo(el); } }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') esconderInfo(); });
  window.addEventListener('scroll', esconderInfo, true);

  // abas do Playbook
  const abas = Array.from(document.querySelectorAll('.aba'));
  const CHAVE_ABA = 'ciclodev-aba-playbook';
  function abrirAba(id){
    const alvo = abas.find(a => a.id === id) || abas[0];
    abas.forEach(a => { const sel = a === alvo; a.setAttribute('aria-selected', String(sel)); a.tabIndex = sel ? 0 : -1; document.getElementById(a.getAttribute('aria-controls')).hidden = !sel; });
    try { localStorage.setItem(CHAVE_ABA, alvo.id); } catch(e){}
  }
  let abaInicial = null; try { abaInicial = localStorage.getItem(CHAVE_ABA); } catch(e){}
  abrirAba(abaInicial);
  abas.forEach((a, i) => {
    a.addEventListener('click', () => abrirAba(a.id));
    a.addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); const prox = abas[(i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length]; abrirAba(prox.id); prox.focus(); });
  });
})();
'''
html=head+'<style>'+css+'''
  .conteudo.sem-pad{padding:0;display:flex;flex-direction:column;flex:1}
  .conteudo.sem-pad > div{flex:1;display:flex;flex-direction:column}
</style>

<div class="app" id="app">
  <nav class="menu" id="menu" aria-label="Menu principal">
    <div class="menu-topo">
      <div class="logo" aria-label="CicloDev">Ciclo<b>Dev</b></div>
      <button class="alternar" id="alternar" type="button" aria-controls="menu" aria-expanded="true" aria-label="Recolher menu" title="Recolher menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><rect x="3" y="3" width="18" height="18"></rect><path d="M9 3v18"></path><path d="M16 15l-3-3 3-3"></path></svg>
      </button>
    </div>
    <div class="secao">
      <div class="rotulo">Módulos</div>
      <ul class="itens">
'''+menu+'''
      </ul>
    </div>
    <div class="menu-rodape" title="Ver como">
      <svg class="rodape-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>
      <div class="rodape-txt"><label class="rotulo" for="ver-como">Ver como</label><button class="rc-sino" type="button" data-rc-sino aria-label="Notificações" title="Notificações"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><b id="notif-n" hidden>0</b></button><span class="chip-exemplo">Dados de exemplo</span></div>
      <select class="sel peq" id="ver-como" aria-label="Ver o sistema como"><option value="master">Master</option><option value="dev">Dev</option><option value="stakeholder">Stakeholder · CEO da B&amp;L</option></select>
    </div>
  </nav>

  <main class="principal">
'''+secoes+pb+'''
  </main>
</div>
<div class="dica" id="dica" hidden></div>
<div class="dica-info" id="dica-info" role="tooltip" hidden></div>
<script>'''+base_js+'''</script>
<script>
'''+js+'''
</script>
'''
open('sistema.html','w',encoding='utf-8').write(html)
print(len(html))

# versão publicada (Vercel): mesma página, com a tela de login na frente
# a volta da janelinha do GitHub ou do GitLab (fonte/git.js): quando a página abre com ?git=..., avisa a janela
# principal (BroadcastChannel e localStorage) e fecha. No GitHub, quando o app já estava instalado a volta vem sem
# código: pede a confirmação da conta (OAuth) na mesma janelinha.
_volta_git = r"""(function(){
  var q = new URLSearchParams(location.search), g = q.get('git'); if (!g) return;
  var e = null; try { e = JSON.parse(localStorage.getItem('ciclodev-git-espera') || 'null'); } catch(x){}
  if (!e || Date.now() - (e.t || 0) > 1800000) return;
  if (g === 'github' && !q.get('code') && !q.get('error') && e.client_id){
    location.replace('https://github.com/login/oauth/authorize?client_id=' + encodeURIComponent(e.client_id) + '&state=' + encodeURIComponent(q.get('state') || e.estado)); return;
  }
  var d = {}; q.forEach(function(v, k){ d[k] = v; });
  try { localStorage.setItem('ciclodev-git-volta', JSON.stringify({dados:d, t:Date.now()})); } catch(x){}
  try { new BroadcastChannel('ciclodev-git').postMessage(d); } catch(x){}
  try { window.stop(); } catch(x){}
  document.documentElement.innerHTML = '<head><meta charset="utf-8"><title>CicloDev</title></head><body style="margin:0;background:#0b0b0c;color:#e8e6e3;font:16px system-ui,sans-serif;display:grid;place-items:center;height:100vh"><p>Pronto. Pode fechar esta janela e voltar ao CicloDev.</p></body>';
  setTimeout(function(){ window.close(); }, 400);
  throw new Error('volta do git');
})();"""
_login_css = open('login.css', encoding='utf-8').read()
_login_html = open('login.html', encoding='utf-8').read()
_login_js = open('login.js', encoding='utf-8').read()
import os as _os
_os.makedirs('vercel', exist_ok=True)
# a página publicada não leva os dados de exemplo (nomes de empresas, projetos e tarefas de demonstração):
# com login, a tela mostra só o que está no banco, então essas funções viram versões vazias
def _trocar_funcao(txt, nome, corpo):
    ini = txt.find('\nfunction ' + nome + '(')
    assert ini >= 0, 'função não achada: ' + nome
    fim = txt.find('\n}\n', ini)
    assert fim > ini, 'fim não achado: ' + nome
    return txt[:ini] + '\nfunction ' + nome + corpo + txt[fim + 2:]
_html_pub = html
for _n, _c in [('semente', '(){ return dadosVazios(); }'),
               ('sementeComercial', '(D){ D.catalog = D.catalog || []; D.regras = D.regras || regrasVazias(); D.custos = D.custos || []; D.opCustos = D.opCustos || []; D.receitas = D.receitas || []; }'),
               ('garantirRecursos', "(d){ ['sprints','marcos','automacoes','autoLog','notifs','vistas','statusCustom','camposItem'].forEach(k => { d[k] = d[k] || []; }); d.quadros = d.quadros || {}; d.recursosV = d.recursosV || 1; }"),
               ('domSemente', '(){ if (!D.dominios) D.dominios = []; }'),
               ('mtLocal', '(){ if (!D.metasLoc) D.metasLoc = {metas:[], resultados:[], itens:[]}; return D.metasLoc; }')]:
    _html_pub = _trocar_funcao(_html_pub, _n, _c)
_v = _html_pub.replace('</style>', _login_css + '\n</style>', 1)
_v = _v.replace('<div class="dica" id="dica" hidden></div>', _login_html + '<div class="dica" id="dica" hidden></div>', 1)
_v = _v + '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n<script>\n' + _login_js + '\n</script>\n'
_v = '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#0B0B0C"><style>[hidden]{display:none!important}html,body{height:100%}</style></head><body>\n<script>' + _volta_git + '</script>\n<script>document.body.classList.add("com-login")</script>\n' + _v + '\n</body></html>\n'
assert _login_html[:20] in _v and 'com-login' in _v
open('vercel/index.html', 'w', encoding='utf-8').write(_v)
print('vercel/index.html', len(_v))

# publicação: a apresentação do CicloDev fica na raiz (/) e o sistema, com o login, em /entrar
import shutil as _sh
_pub = _os.path.join('..', 'publico')
_sh.copyfile('vercel/index.html', _os.path.join(_pub, 'entrar.html'))
_sh.copyfile('landing.html', _os.path.join(_pub, 'index.html'))
print('publico/entrar.html e publico/index.html')
