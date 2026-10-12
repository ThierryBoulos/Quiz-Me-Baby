/* Writes party/public/bank.json — the built-in bank exactly as Classic builds
   it (buildSeedBank), so Party deals from the same questions. Run it after
   any change to the built-in bank:
     node scripts/export-bank.js
   Needs Playwright's Chromium (it reads the bank out of index.html itself). */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), http = require('http');
const root = path.join(__dirname, '..');
(async () => {
  const srv = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    fs.readFile(f, (e, d) => { if(e){ res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html' }); res.end(d); } });
  }).listen(0);
  const port = srv.address().port;
  const b = await chromium.launch(process.env.CHROME ? { executablePath:process.env.CHROME } : {});
  const p = await b.newPage();
  await p.goto(`http://127.0.0.1:${port}/index.html`);
  const out = await p.evaluate(() => ({
    version: BUILD.v, seed: SEED_VERSION, themes: THEMES,
    bank: buildSeedBank().map(q => { const o = {}; Object.keys(q).forEach(k => { if(q[k] !== '' && q[k] != null && k !== 'src') o[k] = q[k]; }); return o; })
  }));
  await b.close(); srv.close();
  const file = path.join(root, 'party/public/bank.json');
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, JSON.stringify(out));
  const by = {}; out.bank.forEach(q => by[q.type] = (by[q.type] || 0) + 1);
  console.log('bank.json:', out.bank.length, 'rows', JSON.stringify(by), (fs.statSync(file).size / 1024).toFixed(0) + ' KB, from v' + out.version);
})();
