const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:400,height:800}});
  await p.goto('file://' + process.cwd() + '/wrap.html'); await p.evaluate(()=>localStorage.clear()); await p.reload();
  for (const m of ['overview','operacoes','clientes','servicedesk','time','agentes','configuracoes','playbook']){
    await p.click('[data-tela='+m+']'); await p.waitForTimeout(100);
    const r = await p.evaluate(()=>{const m=document.querySelector('.principal'); const R=m.getBoundingClientRect().right; const w=[...m.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect(); return b.right>R+1 && b.width>0 && !e.closest('.tabela-rolo,.board-rolo,.gantt-rolo,.views,.abas')}).slice(0,4).map(e=>e.tagName+'.'+(e.className.baseVal!==undefined?'svg':e.className)+' '+Math.round(e.getBoundingClientRect().right)); return [m.scrollWidth,m.clientWidth,w]});
    console.log(m, JSON.stringify(r));
  }
  await b.close();
})();
