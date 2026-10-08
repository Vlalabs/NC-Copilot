import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename } from 'node:path';

let html = await readFile('dist/index.html', 'utf8');
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if (!script || !stylesheet) throw new Error('Compiled script or stylesheet missing.');
const js = await readFile(`dist/assets/${basename(script[1])}`, 'utf8');
const css = await readFile(`dist/assets/${basename(stylesheet[1])}`, 'utf8');
html = html.replace(script[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
const favicon = await readFile('public/favicon.svg', 'utf8');
html = html.replace(/href="[^"]*favicon\.svg"/, () => `href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}"`);
await mkdir('demo', { recursive: true });
await writeFile('demo/NC-Copilot.html', html);
console.log('Exported self-contained demo/NC-Copilot.html');
