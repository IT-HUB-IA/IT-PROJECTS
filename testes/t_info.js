const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1600,height:1000}});
  const erros=[]; p.on('pageerror', e => erros.push(e.message));
  const base = async () => { await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(250); };
  const vai = async sel => { const el = await p.$(sel); if (!el) return false; await el.click({force:true}).catch(()=>{}); await p.waitForTimeout(220); return true; };
  const textos = new Map(); const formsAbertos = []; const falhas = [];
  async function coletar(estado){
    const topo = await p.evaluate(() => { const g = [...document.querySelectorAll('dialog[open], .gaveta')].filter(x => x.getBoundingClientRect().width > 0); return g.length ? true : false; });
    const infos = topo ? await p.$$('dialog[open] .info, .gaveta .info') : await p.$$('.info');
    for (const el of infos){
      const vis = await el.evaluate(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; });
      if (!vis) continue;
      const t = await el.getAttribute('data-info');
      
      await el.scrollIntoViewIfNeeded().catch(()=>{});
      const cobre = await el.evaluate(e => { const r = e.getBoundingClientRect(); const x = r.left + r.width/2, y = r.top + r.height/2; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 'fora'; const t = document.elementFromPoint(x, y); return t && (t === e || e.contains(t)) ? 'ok' : (t ? t.className || t.tagName : 'nada'); });
      if (cobre !== 'ok'){ falhas.push([estado, t, 'coberto por ' + cobre]); continue; }
      await el.hover().catch(()=>{}); await p.waitForTimeout(30);
      const mostra = await p.evaluate(txt => { const d = document.getElementById('dica-info'); if (d.hidden || !d.textContent) return 'não abriu'; const r = d.getBoundingClientRect(); if (r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return 'saiu da tela'; const z = +getComputedStyle(d).zIndex; const topo = [...document.querySelectorAll('.gaveta,.veu,.modal,.toast')].filter(x => x.offsetParent !== null || getComputedStyle(x).position === 'fixed').map(x => +getComputedStyle(x).zIndex || 0); const dlgI = document.querySelector('dialog[open]'); if (dlgI && !dlgI.contains(d)) return 'por baixo do formulário'; return topo.some(v => v >= z) ? 'por baixo de outra camada' : 'ok'; }, t);
      if (mostra !== 'ok') falhas.push([estado, t, mostra]); { const m2 = await p.evaluate(() => document.getElementById('dica-info').textContent); if (!textos.has(m2)) textos.set(m2, estado); }
      const mostrado = await p.evaluate(() => document.getElementById('dica-info').textContent);
      if (!mostrado || mostrado.length < 60 || !/[:.]/.test(mostrado)) falhas.push([estado, mostrado, 'explicação fraca']);
    }
    await p.mouse.move(1, 999);
  }
  const MODS = ['overview','operacoes','clientes','catalog','custos','servicedesk','time','playbook','configuracoes'];
  await base();
  for (const m of MODS){ await vai('[data-tela='+m+']'); await coletar(m); }
  // operações: todas as visões
  const VIEWS = ['dashboard','board','table','list','calendar','timeline','workload','whiteboard','custos','sheet','stages'];
  await vai('[data-tela=operacoes]');
  for (const v of VIEWS){ await vai('[data-view='+v+']'); await coletar('ops/'+v); }
  await vai('[data-view=calendar]'); for (const m of ['semana','dia','agenda']){ if (await vai('[data-cal-modo='+m+']')) await coletar('ops/calendar/'+m); }
  // cada nível da árvore
  const nos = await p.$$eval('.ops-arvore [data-no]', els => els.map(e => e.dataset.no)).catch(()=>[]);
  for (const n of nos.slice(0, 12)){ await vai('.ops-arvore [data-no="'+n+'"]'); for (const v of ['dashboard','sheet','stages','custos']){ await vai('[data-view='+v+']'); await coletar('ops/'+n+'/'+v); } }
  // telas novas
  for (const v of ['sprints','mywork','whiteboard','timeline']){ await vai('[data-view='+v+']'); await coletar('novo/'+v); }
  await vai('[data-view=table]'); const cx = await p.$('[data-rc-sel]'); if (cx){ await cx.click(); await p.waitForTimeout(150); await coletar('novo/table-massa'); }
  await vai('[data-rc-tudo]'); for (const v of ['board','table','dashboard']){ await vai('[data-view='+v+']'); await coletar('everything/'+v); }
  await vai('.ops-arvore [data-no="project:pj_bl"]');
  await vai('[data-tela=playbook]'); await vai('#aba-blueprint'); await coletar('playbook/blueprint');
  await vai('[data-tela=configuracoes]'); await coletar('settings-novos');
  await vai('[data-tela=servicedesk]'); await coletar('sd-novos');
  await vai('[data-tela=operacoes]'); await vai('[data-view=board]');
  // gaveta de item
  await vai('[data-view=board]'); if (await vai('.cartao')) { await coletar('gaveta item'); await p.keyboard.press('Escape'); await p.waitForTimeout(200); }
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.abrirItem = 'is_1'; document.body.appendChild(b); b.click(); b.remove(); }); await p.waitForTimeout(250); await coletar('gaveta epic'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // formulários
  for (const [mod, ac] of [['operacoes','novo-item'],['operacoes','novo-cliente-proj'],['clientes','novo-cliente'],['clientes','nova-tag'],['catalog','novo-servico'],['custos','novo-custo'],['servicedesk','novo-pedido'],['time','nova-pessoa'],['configuracoes','cs-novo'],['configuracoes','cf-novo'],['configuracoes','auto-nova']]){
    await base(); await vai('[data-tela='+mod+']'); if (mod==='operacoes') await vai('[data-view=board]'); if (ac==='nova-tag') await vai('[data-acao=cli-tags]'); if (ac==='novo-custo') await vai('[data-ct-aba=clientes]'); if (await vai('[data-acao='+ac+']') || await vai('[data-rc-acao='+ac+']')) { formsAbertos.push(ac); await coletar('form '+ac); } else falhas.push(['form', ac, 'não abriu o formulário']);
  }
  // abas de custos e catálogo
  await base(); await vai('[data-tela=custos]');
  for (const k of ['visao','clientes','equipe','operacao','regras']){ await vai('[data-ct-aba='+k+']'); await coletar('custos/'+k); const linhas = await p.$$('#m-custos tr.clicavel, #m-custos [data-ct-cli]'); if (linhas.length && k==='clientes'){ await linhas[0].click().catch(()=>{}); await p.waitForTimeout(200); await coletar('custos/cliente aberto'); } }
  await vai('[data-tela=catalog]'); const sv = await p.$('#m-catalog tbody tr.clicavel, #m-catalog [data-servico]'); if (sv){ await sv.click(); await p.waitForTimeout(200); await coletar('catalog/servico'); for (const k of await p.$$eval('[data-sv-aba]', e => e.map(x => x.dataset.svAba))){ await vai('[data-sv-aba='+k+']'); await coletar('catalog/servico/'+k); } }
  // playbook abas
  await vai('[data-tela=playbook]'); for (const a of ['aba-dados','aba-etapas','aba-hier','aba-modelo','aba-ficha']){ await vai('#'+a); await coletar('playbook/'+a); }
  // visões dev e stakeholder
  for (const v of ['dev','stakeholder']){ await base(); await p.selectOption('#ver-como', v); await p.waitForTimeout(200); for (const m of MODS){ await vai('[data-tela='+m+']'); await coletar(v+'/'+m); } }
  fs.writeFileSync('infos.json', JSON.stringify({textos:[...textos], falhas}, null, 1));
  console.log('forms', formsAbertos.join(',')); console.log('total de i distintos', textos.size, 'falhas', falhas.length, 'erros', erros);
  await b.close();
})();
