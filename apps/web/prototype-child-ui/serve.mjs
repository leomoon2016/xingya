// PROTOTYPE（用完即弃）：孩子端界面原型的本地静态服务器。问题：孩子端长什么样？
// 只用 Node 自带模块；运行：node apps/web/prototype-child-ui/serve.mjs  →  http://localhost:5180/?variant=A
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 5180;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.woff': 'font/woff', '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8', '.png': 'image/png',
};
// 与主站 CSP 一致（nfr：default-src 'self'，无内联脚本、无第三方源），原型里用不到第三方资源。
const csp = "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path === '/' || path === '') path = '/index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || file.endsWith('serve.mjs')) { res.writeHead(404).end('not found'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Security-Policy': csp, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found');
  }
}).listen(port, () => {
  console.log(`孩子端原型（PROTOTYPE）：http://localhost:${port}/?variant=A  （B、C 同理；Ctrl+C 结束）`);
});
