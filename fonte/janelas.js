/* ================= Janelas: um padrão só para todas as janelas do sistema e a janela do item organizada =================
   Carrega por último. Não muda dado nenhum: só arruma o que as outras partes montaram. */

/* ---------- texto de ajuda: o que estava escondido no "i" vira uma linha escrita ---------- */
function jnAjuda(t){
  let s = String(t || '').trim();
  s = s.replace(/^[^:()]{1,40}\([^)]{1,80}\)\s*[:.]?\s*/, '');           // "Priority (prioridade): ..." vira só o texto
  if (/^[^:]{1,40}:\s/.test(s) && s.indexOf(':') < 40) s = s.slice(s.indexOf(':') + 1).trim();
  s = s.split(/(?<=[.!?])\s+/)[0] || s;                                   // só a primeira frase
  s = s.replace(/[.]$/, '');
  if (!s) return '';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s.length > 140 ? s.slice(0, 137).replace(/\s+\S*$/, '') + '...' : s;
}

/* ---------- janelas (modal) ---------- */
const JN_PERIGO = /^(excluir|apagar|remover|tirar|encerrar)/i;
const JN_VOLTA = /^(cancelar|fechar|voltar|não|agora não)$/i;
function jnArrumarCampos(dlg){
  const corpo = $('.modal-corpo', dlg);
  if (corpo){
    // cada campo: rótulo legível em cima, explicação escrita embaixo
    $$('label.lb', corpo).forEach(l => {
      l.classList.add('jn-campo');
      const inf = $(':scope > button.info', l);
      if (inf){ const a = jnAjuda(inf.dataset.info); inf.remove(); if (a && !$(':scope > .jn-ajuda', l)) l.insertAdjacentHTML('beforeend', '<small class="jn-ajuda">' + esc(a) + '</small>'); }
      const primeiro = [...l.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      if (primeiro){ const sp = document.createElement('span'); sp.className = 'jn-rot'; sp.textContent = primeiro.textContent.trim(); l.replaceChild(sp, primeiro); }
    });
    // títulos de grupo: letra normal, com o "i" virando explicação
    $$('.bloco-g > h4, .modal-corpo > h3, .modal-corpo > h4', dlg).forEach(h => {
      h.classList.add('jn-grupo');
      const inf = $('button.info', h);
      if (inf){ const a = jnAjuda(inf.dataset.info); inf.remove(); if (a) h.insertAdjacentHTML('afterend', '<p class="jn-grupo-ajuda">' + esc(a) + '</p>'); }
    });
  }
}
function jnArrumarJanela(dlg){
  if (!dlg || dlg.dataset.jn) return; dlg.dataset.jn = '1';
  jnArrumarCampos(dlg);
  const corpo = $('.modal-corpo', dlg), rod = $('.modal-rod', dlg);
  // janela que troca o próprio conteúdo depois de aberta: aplica o padrão de novo
  if (corpo){ let t = 0; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => jnArrumarCampos(dlg), 0); }).observe(corpo, {childList:true, subtree:true}); }
  if (rod){
    const bs = $$(':scope > .btn', rod);
    bs.forEach(b => {
      const t = b.textContent.trim();
      if (JN_PERIGO.test(t)){ b.classList.remove('sec', 'fant'); b.classList.add('jn-perigo'); }
      if (JN_VOLTA.test(t)){ b.classList.remove('fant'); b.classList.add('sec', 'jn-volta'); }
    });
    // o principal (o último) fica na ponta direita; Cancelar/Fechar logo antes dele; o resto vai para a esquerda
    const principal = bs[bs.length - 1];
    const outros = bs.filter(b => b !== principal && !b.classList.contains('jn-volta'));
    if (bs.length > 1 && outros.length){ outros.forEach(b => b.classList.add('jn-esq')); }
    const volta = bs.find(b => b.classList.contains('jn-volta') && b !== principal);
    if (volta && principal) rod.insertBefore(volta, principal);
    if (outros.length){ outros.slice().reverse().forEach(b => rod.insertBefore(b, rod.firstChild)); outros[outros.length - 1].classList.add('jn-ultimo-esq'); }
    if (bs.length === 1 && JN_VOLTA.test(bs[0].textContent.trim())) bs[0].classList.remove('sec');
  }
}
const _modalJn = modal;
modal = function(){ const d = _modalJn.apply(this, arguments); try { jnArrumarJanela(d); if (document.activeElement && document.activeElement.matches('[data-fechar]')){ const bs = $$('.modal-rod .btn', d); if (bs.length) bs[bs.length - 1].focus(); } } catch(e){} return d; };
// janelas que outras partes montam depois de abrir (conteúdo trocado) também passam pelo padrão
new MutationObserver(ms => { ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1){ const d = n.matches && n.matches('dialog.modal') ? n : null; if (d) setTimeout(() => jnArrumarJanela(d), 0); } })); }).observe(document.body, {childList:true});

/* ---------- janela do item ---------- */
function jnGaveta(i){
  const g = $('#gaveta-wrap .gaveta'); if (!g || !i || g.dataset.jn) return; g.dataset.jn = '1';
  const pri = $('.g-principal', g), lat = $('.g-lateral', g); if (!pri || !lat) return;
  g.classList.add('jn-item');
  // 1. sem repetição: situação e prioridade já estão em "Principal"; a faixa fica só com avisos
  const faixa = $('.g-faixa', pri);
  if (faixa){ $$(':scope > .st, :scope > .pr', faixa).forEach(x => x.remove()); if (!faixa.textContent.trim()) faixa.remove(); }
  // 2. lembrete e repetir viram linhas do cartão Principal
  const chips = $('.tf-chips', pri), cart = $(':scope > .g-cartao', lat);
  if (chips && cart){
    const lem = $('[data-tf-lembrete], .tf-chip:first-child', chips), rep = $('[data-tf-repetir]', chips) || $$('.tf-chip', chips)[1];
    const linha = (rot, el) => { if (!el) return; const d = document.createElement('div'); d.className = 'd-lin jn-lin'; d.innerHTML = '<span class="d-rot">' + rot + '</span><span class="d-val"></span>'; el.classList.add('jn-chip'); d.lastChild.appendChild(el); cart.appendChild(d); };
    linha('Lembrete', lem); linha('Repetir', rep);
    chips.remove();
  }
  // 3. rótulos do lado direito: o "i" vira dica ao passar o mouse, sem poluir
  $$('.d-rot > button.info', lat).forEach(b => { const r = b.parentElement; r.title = jnAjuda(b.dataset.info); b.remove(); });
  $$('.g-cartao > h4 > button.info, .sm-dobra summary h4 button.info', lat).forEach(b => { b.closest('h4').title = jnAjuda(b.dataset.info); b.remove(); });
  $$('label.lb', pri).forEach(l => { l.classList.add('jn-campo'); const inf = $(':scope > button.info', l); if (inf){ const a = jnAjuda(inf.dataset.info); inf.remove(); if (a) l.insertAdjacentHTML('beforeend', '<small class="jn-ajuda">' + esc(a) + '</small>'); } });
  // 4. seções do corpo: título em letra normal, explicação curta embaixo, estado vazio claro
  const JN_SEC = {
    'Checklist':['Checklist', 'Passos para conferir antes de dar como pronto'],
    'Child issues':['Subitens', 'As partes menores deste item'],
    'References':['Anexos e links', 'Imagens, arquivos e links que ajudam a entender'],
    'Links':['Ligações', 'Outros itens que dependem deste ou que têm relação com ele'],
    'Custom fields':['Campos do projeto', 'Informações extras que este projeto pede em todo item'],
    'Comments':['Comentários', 'Conversa sobre o item. Use @ para chamar alguém']
  };
  $$(':scope > .g-sec', pri).forEach(s => {
    const h = $(':scope > h4', s); if (!h) return;
    const k = s.dataset.smSec, def = JN_SEC[k];
    $$('button.info', h).forEach(b => b.remove());
    if (def){
      const cont = $('.g-cont', h);
      h.innerHTML = '<span class="jn-sec-tit">' + def[0] + '</span>' + (cont ? '<span class="g-cont">' + cont.textContent + '</span>' : '');
      h.insertAdjacentHTML('afterend', '<p class="jn-sec-ajuda">' + def[1] + '</p>');
    }
    s.classList.add('jn-sec');
    if (k === 'Checklist' && !$('.g-lista li', s)) { const ul = $('.g-lista', s); if (ul) ul.outerHTML = '<p class="jn-vazio">Nenhum passo ainda.</p>'; }
    if (k === 'Links'){
      const ul = $('.g-lista', s); if (ul && !$('li', ul)) ul.outerHTML = '<p class="jn-vazio">Nenhuma ligação.</p>';
      const f = $('form[data-form="link"]', s); if (f){ f.classList.add('jn-ligar'); f.insertAdjacentHTML('afterbegin', '<span class="jn-este">Este item</span>'); }
    }
  });
  // 4b. cada bloco com a cara do que ele é
  const secao = k => $$(':scope > .g-sec', pri).find(x => x.dataset.smSec === k);
  // listas (checklist, subitens, ligações): uma caixa só, com as linhas e a linha de acrescentar embaixo
  const caixa = (s, formSel, dica) => {
    if (!s) return;
    const box = document.createElement('div'); box.className = 'jn-caixa';
    const conteudo = $$(':scope > .progresso, :scope > .g-lista, :scope > .jn-vazio, :scope > p.sec', s);
    conteudo.forEach(x => box.appendChild(x));
    const f = $(formSel, s); if (f){ f.classList.add('jn-add-linha'); const c = $('input.campo[name="t"]', f); if (c && dica) c.placeholder = dica; box.appendChild(f); }
    s.appendChild(box);
  };
  caixa(secao('Checklist'), 'form[data-form="check"]', '+ Escreva um passo e aperte Enter');
  caixa(secao('Child issues'), 'form[data-rc-form="filho"]', '+ Escreva o título do subitem e aperte Enter');
  caixa(secao('Links'), 'form[data-form="link"]');
  // campos do projeto: nome à esquerda e valor à direita, como uma ficha
  const cps = secao('Custom fields');
  if (cps){ const gf = $('.grade-form', cps); if (gf){ gf.className = 'jn-ficha'; $$('label.lb', gf).forEach(l => { l.className = 'jn-ficha-lin'; }); } }
  // comentários: conversa, com a caixa de escrever embaixo
  const com = secao('Comments');
  if (com){
    com.classList.add('jn-conversa');
    const lista = document.createElement('div'); lista.className = 'jn-msgs';
    $$(':scope > .g-com, :scope > p.sec', com).forEach(x => lista.appendChild(x));
    const f = $('form[data-form="coment"]', com);
    com.insertBefore(lista, f || null);
    if (f){
      const inp = $('input[name="t"]', f);
      if (inp){
        const ta = document.createElement('textarea'); ta.name = 't'; ta.className = 'campo jn-escrever'; ta.rows = 2;
        ta.placeholder = 'Escreva um comentário. Use @ para chamar alguém'; ta.setAttribute('aria-label', 'Escrever um comentário'); ta.autocomplete = 'off';
        inp.replaceWith(ta);
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); f.requestSubmit(); } });
        ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(220, Math.max(64, ta.scrollHeight + 2)) + 'px'; });
      }
      f.classList.add('jn-compositor');
      f.insertAdjacentHTML('afterbegin', avatar(eu()));
      const bt = $('button[type="submit"]', f); if (bt){ bt.classList.remove('sec'); bt.textContent = 'Comentar'; bt.title = 'Ctrl + Enter também envia'; }
    }
  }
  // 5. Arquivar e Excluir: numa barra de rodapé da janela, no lugar certo
  const rod = $('.tf-rodape-item', lat);
  if (rod){
    const barra = document.createElement('div'); barra.className = 'jn-rodape';
    const quem = i.rep && pessoa(i.rep);
    barra.innerHTML = '<span class="jn-criado">' + (i.criado ? 'Criado em ' + fmt(i.criado) : '') + (quem ? ' por ' + esc(quem.nome) : '') + '</span>';
    barra.appendChild(rod); g.appendChild(barra);
  }
}
const _abrirItemJn = abrirItem;
abrirItem = function(id){ const r = _abrirItemJn.apply(this, arguments); try { jnGaveta(byId('issues', id)); } catch(e){ console.warn(e); } return r; };

if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {abrirItem, jnAjuda, modal});
