/* Writes party/public/maps/<id>.json — every map in the bank drawn exactly as
   Classic draws it (mapSVG + mapLegend), once for play and once for the
   reveal, so Party shows the very same maps without its own copy of the
   drawing code. Run it after any change to the maps:
     node scripts/export-maps.js
   Needs Playwright's Chromium. */
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
  const out = await p.evaluate(async () => {
    await loadMapGeo();
    const maps = {};
    buildSeedBank().filter(q => q.type === 'map').forEach(q => {
      maps[q.id] = { q: mapSVG(q, false), r: mapSVG(q, true), lq: mapLegend(q, false), lr: mapLegend(q, true), topic: (mapSpec(q) || {}).topic || '' };
    });
    return { version: BUILD.v, maps };
  });
  await b.close(); srv.close();
  /* one file per map: a phone only ever loads the map on screen */
  const dir = path.join(root, 'party/public/maps');
  fs.rmSync(dir, { recursive:true, force:true });
  fs.mkdirSync(dir, { recursive:true });
  let total = 0;
  Object.keys(out.maps).forEach(id => { const f = path.join(dir, id + '.json'); fs.writeFileSync(f, JSON.stringify(out.maps[id])); total += fs.statSync(f).size; });
  console.log('maps/:', Object.keys(out.maps).length, 'maps', (total / 1024).toFixed(0) + ' KB in all, from v' + out.version);
})();
