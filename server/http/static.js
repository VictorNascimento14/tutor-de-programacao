/** Servidor de arquivos estaticos para a pasta `public/`. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PUBLIC_DIR } from '../config.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const etagFor = (stat) =>
  `"${createHash('sha1').update(`${stat.size}-${stat.mtimeMs}`).digest('hex').slice(0, 16)}"`;

/**
 * Tenta servir um arquivo estatico.
 * @returns {Promise<boolean>} true quando a resposta foi enviada.
 */
export async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safeSuffix = path
    .normalize(decodeURIComponent(requested))
    .replace(/^([.][.][/\\])+/, '')
    .replace(/^[/\\]+/, '');

  let filePath = path.join(PUBLIC_DIR, safeSuffix);

  // Barreira contra path traversal.
  if (!filePath.startsWith(PUBLIC_DIR)) return false;

  let stat;
  try {
    stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fsp.stat(filePath);
    }
  } catch {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const etag = etagFor(stat);

  // O index referencia CSS/JS sem versao. Injetar o mtime como query garante
  // que uma edicao invalide o cache do navegador sem hard reload.
  if (ext === '.html') {
    const html = (await fsp.readFile(filePath, 'utf8')).replace(
      /(href|src)="((?:styles|js)\/[^"?]+\.(?:css|js))"/g,
      (match, attr, caminho) => {
        try {
          const alvo = fs.statSync(path.join(PUBLIC_DIR, caminho));
          return `${attr}="${caminho}?v=${Math.round(alvo.mtimeMs)}"`;
        } catch {
          return match;
        }
      },
    );

    const corpo = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'Content-Type': MIME['.html'],
      'Content-Length': corpo.length,
      'Cache-Control': 'no-cache, must-revalidate',
    });
    res.end(req.method === 'HEAD' ? undefined : corpo);
    return true;
  }

  // Modulos ES sao buscados pela URL do import, que o navegador guarda em
  // cache. Carimbar cada especificador relativo com o mtime do alvo faz uma
  // edicao propagar sem hard reload - caso contrario fica-se com o modulo
  // antigo e erros do tipo "does not provide an export named X".
  // No Windows `path.normalize` devolve barras invertidas, por isso a troca.
  if (ext === '.js' && safeSuffix.replace(/\\/g, '/').startsWith('js/')) {
    const codigo = (await fsp.readFile(filePath, 'utf8')).replace(
      /(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g,
      (match, prefixo, aspas, especificador) => {
        try {
          const alvo = fs.statSync(path.resolve(path.dirname(filePath), especificador));
          return `${prefixo}${aspas}${especificador}?v=${Math.round(alvo.mtimeMs)}${aspas}`;
        } catch {
          return match;
        }
      },
    );

    const corpo = Buffer.from(codigo, 'utf8');
    res.writeHead(200, {
      'Content-Type': MIME['.js'],
      'Content-Length': corpo.length,
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : corpo);
    return true;
  }

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return true;
  }

  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    ETag: etag,
    'Last-Modified': stat.mtime.toUTCString(),
    // `no-cache` permite guardar, mas obriga revalidar. Com ETag a revalidacao
    // custa um 304 e o arquivo editado aparece sem precisar de hard reload.
    'Cache-Control': 'no-cache',
  });

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('close', resolve);
    stream.pipe(res);
  }).catch(() => res.end());

  return true;
}
