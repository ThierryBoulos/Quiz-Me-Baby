/* Writes party/public/maps/<id>.json — every map in the bank drawn exactly as
   Classic draws it (mapSVG + mapLegend), once for play and once for the
   reveal, so Party shows the very same maps without its own copy of the
   drawing code. Run it after any change to the maps:
     node scripts/export-maps.js
   Needs Playwright's Chromium. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), http = require('http');
const root = path.join(__dirname, '..');
/* the reveal's drawing goes in a file of its own, kept out of public/ (party/data/maps-r/<id>.json); each build copies
   it to public/maps/r/ under a name only the server knows until the reveal (party/scripts/hash-flags.mjs, with the
   flags' key): the answer's drawing no longer comes down with the question (the 4 Nov audit, 4.5) */
(async () => {
  const srv = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/classic.html'));
    fs.readFile(f, (e, d) => { if(e){ res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html' }); res.end(d); } });
  }).listen(0);
  const port = srv.address().port;
  const b = await chromium.launch(process.env.CHROME ? { executablePath:process.env.CHROME } : {});
  const p = await b.newPage();
  await p.goto(`http://127.0.0.1:${port}/classic.html`);
  /* a map's picture layer (the night lights) goes inside its SVG, so Party needs no extra file */
  const raster = { 'maps-night.png': 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'maps-night.png')).toString('base64') };
  const out = await p.evaluate(async (raster) => {
    window.MAPRASTER = raster;
    await loadMapGeo();
    const maps = {};
    buildSeedBank().filter(q => q.type === 'map').forEach(q => {
      maps[q.id] = { q: mapSVG(q, false), r: mapSVG(q, true), lq: mapLegend(q, false), lr: mapLegend(q, true), topic: (mapSpec(q) || {}).topic || '' };
    });
    return { version: BUILD.v, maps };
  }, raster);
  await b.close(); srv.close();
  /* one file per map: a phone only ever loads the map on screen */
  const dir = path.join(root, 'party/public/maps');
  fs.rmSync(dir, { recursive:true, force:true });
  fs.mkdirSync(dir, { recursive:true });
  let total = 0;
  const rdir = path.join(root, 'party/data/maps-r');
  fs.rmSync(rdir, { recursive:true, force:true }); fs.mkdirSync(rdir, { recursive:true });
  Object.keys(out.maps).forEach(id => { const m = out.maps[id];
    const f = path.join(dir, id + '.json'); fs.writeFileSync(f, JSON.stringify({ q:m.q, lq:m.lq, topic:m.topic })); total += fs.statSync(f).size;
    const r = path.join(rdir, id + '.json'); fs.writeFileSync(r, JSON.stringify({ r:m.r, lr:m.lr })); total += fs.statSync(r).size; });
  console.log('maps/:', Object.keys(out.maps).length, 'maps', (total / 1024).toFixed(0) + ' KB in all, from v' + out.version);
})();
