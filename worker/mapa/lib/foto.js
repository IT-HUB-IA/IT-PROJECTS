// Roda DENTRO da página (page.evaluate): tira a "foto" do que está visível agora. Sem dependências.
// Devolve: titulo, caminho, elementos clicáveis e campos (com zona: menu, aba, janela, tela), janelas abertas e o texto (para os marcadores).
(() => {
  document.querySelectorAll('[data-mapa-id]').forEach(e => e.removeAttribute('data-mapa-id'));
  let n = 0;
  const visivel = (e) => {
    if (!e || !e.getClientRects().length) return false;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    if (e.closest('[aria-hidden="true"],[hidden],[inert]')) return false;
    for (let x = e; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false; }
    return true;
  };
  const limpo = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const rotulo = (e) => {
    const a = e.getAttribute('aria-label') || e.getAttribute('data-nome') || e.getAttribute('title');
    const t = limpo(e.innerText || e.textContent || '');
    const v = e.tagName === 'INPUT' ? limpo(e.value) : '';
    const img = e.querySelector && e.querySelector('img[alt]');
    let r = t && t.length <= 80 ? t : (a || (t ? t.split(/\n| {2,}/)[0].slice(0, 80) : '') || v || (img && img.alt) || '');
    return limpo(r).slice(0, 120);
  };
  const SEL_JANELA = '[role="dialog"],[role="alertdialog"],dialog[open],[aria-modal="true"]';
  const ehJanela = (x) => x.matches(SEL_JANELA) || ((/(^|[\s_-])(modal|dialog|janela|drawer|popup|popover|offcanvas)([\s_-]|$)/i.test(x.className && x.className.baseVal === undefined ? x.className : '')) && ['fixed', 'absolute'].includes(getComputedStyle(x).position) && x.getBoundingClientRect().width > 200);
  const janelaDe = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) if (ehJanela(x)) return x; return null; };
  const zonaDe = (e) => {
    if (janelaDe(e)) return 'janela';
    if (e.matches('[role="tab"]') || e.closest('[role="tablist"]')) return 'aba';
    if (e.closest('nav,aside,[role="navigation"],[role="menubar"],[role="menu"],.sidebar,.menu,.lateral,#menu,#sidebar')) return 'menu';
    return 'tela';
  };
  const titulo = (raiz) => {
    const h = [...raiz.querySelectorAll('h1,h2,[role="heading"]')].find(visivel);
    if (!h) return '';
    const c = h.cloneNode(true);   // sem os ícones e botões de ajuda que ficam dentro do título ("Clientes ⓘ")
    c.querySelectorAll('button,svg,[aria-hidden="true"],[data-info],.info,.i,small,sup,kbd').forEach(x => x.remove());
    return (limpo(c.textContent) || limpo(h.innerText)).slice(0, 120);
  };
  const ajuda = (e) => limpo(e.getAttribute('data-info') || e.getAttribute('aria-description') || (e.getAttribute('title') !== rotulo(e) ? e.getAttribute('title') : '') || '').slice(0, 500);
  const elementos = [], vistos = new Set();
  const CLICAVEL = 'a[href],button,[role="button"],[role="tab"],[role="menuitem"],[role="link"],[role="option"],input[type="button"],input[type="submit"],summary,[onclick],[data-tela],[data-acao],label[for]';
  const add = (e, tipo) => {
    if (vistos.has(e) || !visivel(e)) return;
    vistos.add(e);
    const id = String(++n); e.setAttribute('data-mapa-id', id);
    const z = zonaDe(e), j = janelaDe(e);
    const href = e.tagName === 'A' ? e.getAttribute('href') : null;
    elementos.push({ id, tipo, tag: e.tagName.toLowerCase(), papel: e.getAttribute('role') || '', rotulo: rotulo(e), zona: z, janela: j ? (titulo(j) || rotulo(j).slice(0, 60)) : null,
      href, alvo: e.getAttribute('target') || null, ativo: e.matches('[aria-selected="true"],[aria-current],.ativo,.active,.sel,.selecionado'), desligado: !!e.disabled || e.getAttribute('aria-disabled') === 'true',
      ajuda: ajuda(e), tipoCampo: e.type || '', submit: e.type === 'submit' && !!e.form });
  };
  document.querySelectorAll(CLICAVEL).forEach(e => { if (!e.closest('[data-mapa-ignorar]')) add(e, 'clique'); });
  // elementos "clicáveis à mão" (div com cursor de mão e texto curto, sem um clicável dentro)
  document.querySelectorAll('div,span,li,td').forEach(e => {
    if (vistos.has(e) || e.closest(CLICAVEL) || e.querySelector(CLICAVEL)) return;
    if (getComputedStyle(e).cursor !== 'pointer') return;
    const t = limpo(e.innerText); if (!t || t.length > 60) return;
    if (e.parentElement && getComputedStyle(e.parentElement).cursor === 'pointer' && limpo(e.parentElement.innerText) === t) return;
    add(e, 'clique');
  });
  const nomeCampo = (e) => {
    if (e.id) { const l = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (l && limpo(l.innerText)) return limpo(l.innerText).slice(0, 100); }
    const l = e.closest('label'); if (l) { const t = limpo([...l.childNodes].filter(x => x !== e).map(x => x.textContent).join(' ')); if (t) return t.slice(0, 100); }
    return limpo(e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('name') || e.id || '').slice(0, 100);
  };
  document.querySelectorAll('input,select,textarea,[contenteditable="true"]').forEach(e => {
    const t = (e.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'reset', 'file'].includes(t) || !visivel(e) || e.readOnly) return;
    const id = String(++n); e.setAttribute('data-mapa-id', id);
    const j = janelaDe(e);
    elementos.push({ id, tipo: 'campo', tag: e.tagName.toLowerCase(), rotulo: nomeCampo(e), zona: zonaDe(e), janela: j ? (titulo(j) || rotulo(j).slice(0, 60)) : null, tipoCampo: t || e.tagName.toLowerCase(),
      nome: e.getAttribute('name') || '', desligado: !!e.disabled, ajuda: ajuda(e), form: e.form ? (e.form.getAttribute('data-mapa-form') || (e.form.setAttribute('data-mapa-form', 'f' + n), 'f' + n)) : null,
      opcoes: e.tagName === 'SELECT' ? [...e.options].slice(0, 30).map(o => o.value) : null,
      min: e.getAttribute('min'), max: e.getAttribute('max'), maxlength: e.maxLength > 0 ? e.maxLength : null, padrao: e.getAttribute('pattern'), obrigatorio: !!e.required,
      dica: limpo((e.getAttribute('placeholder') || '') + ' ' + (e.getAttribute('name') || '') + ' ' + (e.id || '') + ' ' + (e.getAttribute('autocomplete') || '') + ' ' + (e.getAttribute('inputmode') || '')) });
  });
  const jEls = [...document.querySelectorAll('*')].filter(x => ehJanela(x) && visivel(x) && !(x.parentElement && janelaDe(x.parentElement)));
  const janelas = jEls.map(x => titulo(x) || rotulo(x).slice(0, 60));
  const textoJanelas = jEls.map(x => (x.innerText || '') + '\n' + [...x.querySelectorAll('input,textarea,select')].map(e => e.value).join('\n'));
  const texto = (document.body ? document.body.innerText : '') + '\n' + [...document.querySelectorAll('input,textarea,select')].map(e => e.value).join('\n');
  const vazia = !limpo(document.body ? document.body.innerText : '') && !document.querySelector('canvas,svg,img,video');
  return { titulo: titulo(document) || limpo(document.title), tituloPagina: limpo(document.title), caminho: location.pathname + (/^#[/!]/.test(location.hash) ? location.hash.replace(/[?=].*$/, '') : ''), elementos, janelas, textoJanelas: textoJanelas.map(t => t.slice(0, 100000)),
    texto: texto.slice(0, 400000), vazia, naoAchou: /(\b404\b|not found|página não encontrada|pagina nao encontrada|page not found)/i.test(limpo(document.body ? document.body.innerText : '').slice(0, 500)) };
})()
