// Uma análise inteira de um repositório já baixado (pasta): descobre as aplicações, sobe cada uma, percorre com cada papel,
// lê o código e monta o resultado no formato que mapa_gravar recebe.
import { chromium } from 'playwright';
import { detectar } from './detectar.mjs';
import { subir } from './construir.mjs';
import { percorrer } from './percorrer.mjs';
import { lerCodigo } from './codigo.mjs';
import { Falso, papeisDoBanco, papelMaisAlto } from './falso.mjs';
import { Mapa, montarAplicacao, alertasDoCodigo } from './montar.mjs';

export async function analisar(pasta, { bancos = [], usadasPorOutras = [], nome = '', log = () => {}, tempoPapelMs, maxTelas, executavel, soApps = null } = {}) {
  const t0 = Date.now();
  const bancosOk = bancos.filter(b => b && b.estrutura && Array.isArray(b.estrutura.tabelas));
  const comBanco = bancosOk.length > 0;
  const mapa = new Mapa();
  for (const b of bancos) if (b && b.erro) mapa.lacunas.push('O banco "' + b.nome + '" não foi lido: ' + b.erro);
  const apps = detectar(pasta).filter(a => !soApps || soApps.includes(a.rel));
  if (!apps.length) mapa.lacunas.push('Nenhuma aplicação com tela foi achada neste repositório (procurei package.json com framework de tela, pastas com .html e sistemas Java, PHP, Python, Ruby, .NET e Go).');
  const regra = papeisDoBanco(bancosOk);
  const papeis = [{ papel: 'visitante', rotulo: 'sem entrar', logado: false }, ...(regra ? regra.valores.map(v => ({ papel: v, rotulo: v, logado: true })) : [{ papel: 'logado', rotulo: 'pessoa que entrou', logado: true }])];
  const saidas = apps.filter(a => a.tipo === 'estatico').map(a => a.pasta);
  const codigo = lerCodigo(pasta, { saida: saidas[0] || null });
  const palavras = bancosOk.flatMap(b => b.palavras || []);
  const navegador = await chromium.launch({ headless: true, ...(executavel ? { executablePath: executavel } : {}), args: ['--disable-dev-shm-usage'] });
  const resumoApps = [];
  try {
    for (const app of apps) {
      let srv = null; const voltas = [];
      try {
        if (app.tipo !== 'servidor') { srv = await subir(app, { log }); app.como = srv.como; }
        else mapa.lacunas.push('A aplicação "' + app.nome + '" (' + app.framework + ') foi lida só pelo código: telas e campos vêm dos modelos de página, sem rodar.');
      } catch (e) { mapa.lacunas.push('A aplicação "' + app.nome + '" não subiu: ' + String(e.message || e).slice(0, 400) + '. Ela foi lida só pelo código.'); }
      if (srv) {
        for (const p of papeis) {
          const falso = new Falso({ bancos: bancosOk, papel: p.logado ? p.papel : null, regraPapel: regra, logado: p.logado });
          try {
            const r = await percorrer({ navegador, url: srv.url, paginas: app.paginas || [], falso, papel: p.papel, rotuloPapel: p.rotulo, log,
              tempoMs: p.logado ? (tempoPapelMs ?? Number(process.env.MAPA_TEMPO_PAPEL || 480) * 1000) : Math.min(120_000, tempoPapelMs ?? 120_000), maxTelas: p.logado ? (maxTelas ?? Number(process.env.MAPA_MAX_TELAS || 80)) : 20 });
            voltas.push({ papel: p.papel, r, falso });
            if (falso.simNao && regra && !mapa.lacunas.some(x => x.startsWith('Perguntas de sim ou não')))
              mapa.lacunas.push('Perguntas de sim ou não ao banco (funções que devolvem verdadeiro ou falso) foram respondidas "sim" só para o papel mais alto (' + papelMaisAlto(regra.valores) + ') e "não" para os outros. Se alguma tela aparece para um papel por outra regra, ela pode faltar no mapa desse papel.');
            mapa.lacunas.push(...r.lacunas);
          } catch (e) { mapa.lacunas.push('Papel ' + p.rotulo + ' em "' + app.nome + '": a volta parou com erro: ' + String(e.message || e).slice(0, 300)); }
        }
        await srv.parar().catch(() => {});
      }
      const n = montarAplicacao(mapa, { app, voltas, codigo, bancos: bancosOk, comBanco });
      resumoApps.push({ chave: app.chave, nome: app.nome, framework: app.framework, tipo: app.tipo, pasta: app.rel, como: app.como || (app.tipo === 'servidor' ? 'só pelo código' : 'não subiu'), ...n });
    }
  } finally { await navegador.close().catch(() => {}); }
  if (comBanco) alertasDoCodigo(mapa, { codigo, falso: new Falso({ bancos: bancosOk }), usadasPorOutras, palavras, apps });
  else mapa.alertas.clear();
  const tecnologia = [...new Set(apps.map(a => a.framework))].join(' + ').slice(0, 200) || null;
  const res = mapa.resultado({ tecnologia, com_banco: comBanco, papeis: papeis.map(p => p.papel),
    resumo: { aplicacoes: resumoApps, segundos: Math.round((Date.now() - t0) / 1000), arquivos_lidos: codigo.arquivos, papeis: papeis.map(p => ({ papel: p.papel, rotulo: p.rotulo })),
      regra_papeis: regra ? { tabela: regra.tabela, coluna: regra.coluna } : null, nome } });
  // limites do banco (mapa_gravar): 20 mil peças, 40 mil ligações, 5 mil alertas
  if (res.pecas.length > 20000) { res.lacunas.push('Mapa grande demais: ficaram ' + (res.pecas.length - 20000) + ' peças de fora.'); res.pecas = res.pecas.slice(0, 20000); }
  if (res.ligacoes.length > 40000) res.ligacoes = res.ligacoes.slice(0, 40000);
  if (res.alertas.length > 5000) { res.lacunas.push('Alertas demais: ficaram ' + (res.alertas.length - 5000) + ' de fora.'); res.alertas = res.alertas.slice(0, 5000); }
  return res;
}
