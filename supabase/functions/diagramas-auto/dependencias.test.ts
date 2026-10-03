// Rodar com: node --experimental-strip-types supabase/functions/diagramas-auto/dependencias.test.ts   (OSV=1 também consulta a base de verdade)
import { dependenciasDe, analisarDependencias, notaCvss3, gravidadeDe, correcaoDe, cmpVersao, ehTrava } from './dependencias.ts';
import { lerTarGz, interessa } from './gerar.ts';
import { mkdtempSync, mkdirSync, writeFileSync, createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
let falhas = 0;
const ok = (c: boolean, m: string) => { if (!c) falhas++; console.log((c ? 'OK    ' : 'FALHA ') + m); };
const tem = (l: any[], eco: string, nome: string, v: string, arq?: string) => l.some(d => d.ecossistema === eco && d.nome === nome && d.versao === v && (!arq || d.arquivo === arq));

// ---------- arquivos de travas, uma linguagem por vez ----------
const travas = new Map<string, string>([
  ['web/package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { '': { name: 'web' }, 'node_modules/lodash': { version: '4.17.15' }, 'node_modules/@babel/core': { version: '7.1.0' }, 'node_modules/a/node_modules/minimist': { version: '0.0.8' }, 'node_modules/meu': { link: true, version: '1.0.0' } } })],
  ['velho/package-lock.json', JSON.stringify({ lockfileVersion: 1, dependencies: { express: { version: '4.16.0', dependencies: { qs: { version: '6.5.1' } } } } })],
  ['pn/pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      axios:\n        specifier: ^1.6.0\n        version: 1.6.0\npackages:\n  axios@1.6.0:\n    resolution: {integrity: sha512-x}\n  '@types/node@20.1.0':\n    resolution: {integrity: sha512-y}\n  react-dom@18.2.0(react@18.2.0):\n    resolution: {}\n"],
  ['pn5/pnpm-lock.yaml', "lockfileVersion: 5.4\npackages:\n  /left-pad/1.1.0:\n    resolution: {integrity: sha512-z}\n"],
  ['y1/yarn.lock', '# yarn lockfile v1\n\n"@scope/pkg@^2.0.0", "@scope/pkg@^2.1.0":\n  version "2.1.3"\n  resolved "https://x"\n\nchalk@^4:\n  version "4.1.2"\n'],
  ['y2/yarn.lock', '__metadata:\n  version: 6\n\n"debug@npm:^4.3.1":\n  version: 4.3.4\n  resolution: "debug@npm:4.3.4"\n\n"meu-app@workspace:.":\n  version: 0.0.0-use.local\n'],
  ['py/poetry.lock', '[[package]]\nname = "django"\nversion = "3.2.0"\n\n[[package]]\nname = "requests"\nversion = "2.19.0"\n'],
  ['pp/Pipfile.lock', JSON.stringify({ default: { flask: { version: '==0.12' } }, develop: { pytest: { version: '==7.0.0' } } })],
  ['php/composer.lock', JSON.stringify({ packages: [{ name: 'guzzlehttp/guzzle', version: 'v6.5.0' }], 'packages-dev': [{ name: 'phpunit/phpunit', version: '9.5.0' }] })],
  ['rb/Gemfile.lock', 'GEM\n  remote: https://rubygems.org/\n  specs:\n    rails (6.0.0)\n      actionpack (= 6.0.0)\n    nokogiri (1.10.3-x86_64-linux)\n\nPLATFORMS\n  ruby\n'],
  ['rs/Cargo.lock', '[[package]]\nname = "serde"\nversion = "1.0.100"\n\n[[package]]\nname = "tokio"\nversion = "1.0.0"\n'],
  ['go/go.sum', 'github.com/gin-gonic/gin v1.6.0 h1:abc=\ngithub.com/gin-gonic/gin v1.6.0/go.mod h1:def=\n'],
  ['net/packages.lock.json', JSON.stringify({ version: 1, dependencies: { 'net6.0': { 'Newtonsoft.Json': { type: 'Direct', resolved: '12.0.1' }, MeuProjeto: { type: 'Project' } } } })],
  ['jv/gradle.lockfile', 'org.apache.logging.log4j:log4j-core:2.14.1=compileClasspath\nempty=\n'],
]);
const codigo = new Map<string, string>([
  ['web/package.json', JSON.stringify({ dependencies: { lodash: '^4.17.0' } })],                              // tem travas na mesma pasta: não conta
  ['solto/package.json', JSON.stringify({ dependencies: { express: '^4.17.1', exata: '1.2.3', local: 'file:../x' } })],   // sem travas: versão aproximada
  ['api/pom.xml', '<project><properties><jackson.version>2.9.8</jackson.version></properties><dependencies><dependency><groupId>com.fasterxml.jackson.core</groupId><artifactId>jackson-databind</artifactId><version>${jackson.version}</version></dependency></dependencies></project>'],
  ['srv/requirements.txt', 'urllib3==1.24.1\nrequests[security]==2.20.0\nflask>=1.0\n'],
  ['app/App.csproj', '<Project><ItemGroup><PackageReference Include="Serilog" Version="2.10.0" /></ItemGroup></Project>'],
  ['g2/build.gradle', "dependencies {\n  implementation 'org.springframework:spring-web:5.2.0.RELEASE'\n}\n"],
]);
const deps = dependenciasDe(codigo, travas);
ok(tem(deps, 'npm', 'lodash', '4.17.15', 'web/package-lock.json') && tem(deps, 'npm', '@babel/core', '7.1.0') && tem(deps, 'npm', 'minimist', '0.0.8') && !deps.some(d => d.nome === 'meu'), 'package-lock.json v3: versões instaladas, inclusive dentro de outra biblioteca e com @escopo; link de pasta não conta');
ok(tem(deps, 'npm', 'express', '4.16.0', 'velho/package-lock.json') && tem(deps, 'npm', 'qs', '6.5.1'), 'package-lock.json v1 (antigo), com as de dentro');
ok(tem(deps, 'npm', 'axios', '1.6.0') && tem(deps, 'npm', '@types/node', '20.1.0') && tem(deps, 'npm', 'react-dom', '18.2.0') && tem(deps, 'npm', 'left-pad', '1.1.0'), 'pnpm-lock.yaml (formato 9 e 5)');
ok(tem(deps, 'npm', '@scope/pkg', '2.1.3') && tem(deps, 'npm', 'chalk', '4.1.2') && tem(deps, 'npm', 'debug', '4.3.4') && !deps.some(d => d.nome === 'meu-app'), 'yarn.lock (v1 e Berry); o próprio projeto (workspace) não conta');
ok(tem(deps, 'PyPI', 'django', '3.2.0') && tem(deps, 'PyPI', 'flask', '0.12') && tem(deps, 'PyPI', 'pytest', '7.0.0') && tem(deps, 'PyPI', 'urllib3', '1.24.1') && tem(deps, 'PyPI', 'requests', '2.20.0') && !deps.some(d => d.ecossistema === 'PyPI' && d.nome === 'flask' && d.versao === '1.0'), 'Python: poetry.lock, Pipfile.lock e requirements.txt (só ==, com [extras])');
ok(tem(deps, 'Packagist', 'guzzlehttp/guzzle', '6.5.0') && tem(deps, 'Packagist', 'phpunit/phpunit', '9.5.0'), 'PHP: composer.lock (tira o v da versão)');
ok(tem(deps, 'RubyGems', 'rails', '6.0.0') && tem(deps, 'RubyGems', 'nokogiri', '1.10.3') && !deps.some(d => d.nome === 'actionpack'), 'Ruby: Gemfile.lock (só as instaladas, não as exigências)');
ok(tem(deps, 'crates.io', 'serde', '1.0.100') && tem(deps, 'Go', 'github.com/gin-gonic/gin', '1.6.0') && deps.filter(d => d.nome === 'github.com/gin-gonic/gin').length === 1, 'Rust (Cargo.lock) e Go (go.sum, sem repetir a linha /go.mod)');
ok(tem(deps, 'NuGet', 'Newtonsoft.Json', '12.0.1') && !deps.some(d => d.nome === 'MeuProjeto') && tem(deps, 'NuGet', 'Serilog', '2.10.0'), '.NET: packages.lock.json e .csproj');
ok(tem(deps, 'Maven', 'org.apache.logging.log4j:log4j-core', '2.14.1') && tem(deps, 'Maven', 'com.fasterxml.jackson.core:jackson-databind', '2.9.8') && tem(deps, 'Maven', 'org.springframework:spring-web', '5.2.0.RELEASE'), 'Java: gradle.lockfile, pom.xml (com ${versão}) e build.gradle');
ok(!deps.some(d => d.arquivo === 'web/package.json'), 'com arquivo de travas na pasta, a lista com faixa (^4.17.0) não é usada');
ok(deps.some(d => d.nome === 'express' && d.arquivo === 'solto/package.json' && d.aproximada) && deps.some(d => d.nome === 'exata' && !d.aproximada) && !deps.some(d => d.nome === 'local'), 'sem travas: a faixa vira "versão aproximada"; versão exata não');

// ---------- gravidade de verdade e versão que corrige ----------
ok(notaCvss3('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H') === 9.8 && notaCvss3('CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N') === 6.1 && notaCvss3('CVSS:3.0/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N') === 1.8, 'nota CVSS 3 calculada certa (9,8, 6,1 e 1,8, conferidas na calculadora do FIRST)');
ok(gravidadeDe({ severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }] }) === 'critica' && gravidadeDe({ database_specific: { severity: 'MODERATE' } }) === 'media'
  && gravidadeDe({ affected: [{ ecosystem_specific: { severity: 'LOW' } }] }) === 'baixa' && gravidadeDe({}) === 'alta', 'gravidade: pela nota CVSS, senão pela classificação do aviso; sem nada, alta');
ok(cmpVersao('1.10.0', '1.9.9') > 0 && cmpVersao('2.0.0', '2.0.0-beta') > 0 && cmpVersao('4.17.19', '4.17.19') === 0, 'compara versões (1.10 > 1.9; versão final > beta)');
const dl = { ecossistema: 'npm', nome: 'lodash', versao: '4.17.15', arquivo: 'x' } as any;
ok(correcaoDe({ affected: [{ package: { name: 'lodash' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '3.0.0' }, { introduced: '4.0.0' }, { fixed: '4.17.19' }] }] }] }, dl) === '4.17.19', 'versão que corrige: a menor acima da atual');

// ---------- a consulta (OSV de mentira; com OSV=1, a de verdade) ----------
const chamadas: string[] = [];
const falso = (async (u: string, o: any) => {
  chamadas.push(u);
  if (/\/vulns\//.test(u)) {
    const id = decodeURIComponent(u.split('/').pop()!);
    return { ok: true, json: async () => id === 'GHSA-a' ? { id, aliases: ['CVE-2021-1'], severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }], affected: [{ package: { name: 'lodash' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '4.17.21' }] }] }] }
                                                 : { id, database_specific: { severity: 'MODERATE' }, affected: [{ package: { name: 'lodash' }, ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '4.17.19' }] }] }] } };
  }
  const q = JSON.parse(o.body).queries;
  return { ok: true, json: async () => ({ results: q.map((x: any) => x.package.name === 'lodash' ? { vulns: [{ id: 'GHSA-a' }, { id: 'GHSA-b' }] } : x.package.name === 'express' ? { vulns: [{ id: 'GHSA-b' }] } : {}) }) };
}) as unknown as typeof fetch;
const r = await analisarDependencias(deps, falso);
const lo = r.achados.find(a => /^lodash 4\.17\.15/.test(a.titulo));
ok(!!lo && lo.gravidade === 'critica' && /Corrige na versão 4\.17\.21/.test(lo.trecho) && /CVE-2021-1 \(GHSA-a\)/.test(lo.trecho) && /web\/package-lock\.json · npm/.test(lo.onde), 'achado com a pior gravidade dos avisos, a versão que corrige todos e o código CVE');
const ex = r.achados.find(a => /^express 4\.17\.1/.test(a.titulo));
ok(!!ex && ex.gravidade === 'media' && /versão aproximada/.test(ex.titulo), 'aviso médio fica médio (não sobe por quantidade); faixa sem travas avisa que a versão é aproximada');
ok(chamadas.filter(u => /\/vulns\//.test(u)).length === 2, 'cada aviso é lido uma vez só, mesmo aparecendo em várias bibliotecas');
const r2 = await analisarDependencias(deps, falso);
ok(r.achados.every(a => r2.achados.some(b => b.impressao === a.impressao)), 'a mesma biblioteca na mesma versão tem a mesma identidade (a próxima rodada reconhece)');
const caiu = await analisarDependencias(deps, (async () => { throw new Error('sem rede'); }) as unknown as typeof fetch);
ok(caiu.achados.length === 0 && /sem rede/.test(caiu.erro || ''), 'sem acesso à base: nenhum achado inventado, e o aviso diz o motivo');

// ---------- o pacote: os arquivos de travas vêm à parte, sem download a mais ----------
const dir = mkdtempSync('/tmp/travas-'); mkdirSync(dir + '/repo-abc/web', { recursive: true });
const grande = JSON.stringify({ lockfileVersion: 3, packages: Object.fromEntries(Array.from({ length: 6000 }, (_, i) => ['node_modules/pacote-' + i, { version: '1.0.' + i, integrity: 'sha512-' + 'x'.repeat(60) }])) });
writeFileSync(dir + '/repo-abc/web/package-lock.json', grande);
writeFileSync(dir + '/repo-abc/web/index.ts', 'export const a = 1;\n');
execFileSync('tar', ['czf', dir + '/p.tar.gz', '-C', dir, 'repo-abc']);
const p = await lerTarGz(Readable.toWeb(createReadStream(dir + '/p.tar.gz')) as unknown as ReadableStream<Uint8Array>);
ok(grande.length > 400_000 && p.travas?.get('web/package-lock.json')?.length === grande.length && !p.arquivos.has('web/package-lock.json') && p.arquivos.has('web/index.ts'),
  'package-lock.json de ' + Math.round(grande.length / 1024) + ' KB fica à parte (não entra nos desenhos nem na análise do código)');
ok(dependenciasDe(p.arquivos, p.travas).length === 6000, 'as 6000 bibliotecas do arquivo de travas são lidas');
ok(ehTrava('a/poetry.lock', 10) && !ehTrava('node_modules/x/package-lock.json', 10) && !ehTrava('a/yarn.lock', 9_000_000) && !interessa('a/yarn.lock', 10), 'arquivo de travas: até 8 MB, fora de node_modules; não é tratado como código');

if (process.env.OSV) {
  const real = await analisarDependencias([{ ecossistema: 'npm', nome: 'lodash', versao: '4.17.15', arquivo: 'package-lock.json' }, { ecossistema: 'PyPI', nome: 'django', versao: '3.2.0', arquivo: 'poetry.lock' }], fetch);
  ok(real.achados.length === 2 && !real.erro, 'OSV de verdade: ' + (real.erro || real.achados.map(a => a.titulo + ' [' + a.gravidade + '] ' + a.trecho.slice(0, 60)).join(' | ')));
}
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
if (falhas) process.exit(1);
