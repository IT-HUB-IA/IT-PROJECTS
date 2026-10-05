// Servidor local mínimo para a cópia: entrega os arquivos da pasta, aceita endereço sem .html (como na Vercel)
// e, numa aplicação de página única, devolve o index.html para qualquer caminho.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.wasm': 'application/wasm' };

export function servirPasta(pasta, { spa = false } = {}) {
  const arquivo = async (c) => { try { const s = await stat(c); if (s.isFile()) return c; if (s.isDirectory()) { const i = join(c, 'index.html'); if ((await stat(i).catch(() => null))?.isFile()) return i; } } catch { /* não existe */ } return null; };
  const srv = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const rel = normalize(decodeURIComponent(u.pathname)).replace(/^(\.\.[/\\])+/, '');
    const base = join(pasta, rel);
    if (!base.startsWith(pasta)) { res.writeHead(403).end(); return; }
    let c = await arquivo(base) || (!extname(base) ? await arquivo(base + '.html') : null);
    let status = 200;
    if (!c && spa && !extname(base)) c = await arquivo(join(pasta, 'index.html'));
    if (!c) { status = 404; c = await arquivo(join(pasta, '404.html')); }
    if (!c) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end('<!doctype html><title>404</title><h1>404</h1><p>Página não encontrada</p>'); return; }
    res.writeHead(status, { 'content-type': TIPOS[extname(c).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(c));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + srv.address().port + '/', parar: () => new Promise(r => srv.close(() => r())) })));
}
