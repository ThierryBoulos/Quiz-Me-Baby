/* The map drawing, out of classic.html (21 Nov, the tidy-up's Phase 1): each built-in map drawn as an SVG from the
   real borders (maps-geo.js), once for play and once for the reveal, with its legend. Copied as it was; only
   scripts/export-maps.js uses it, in a headless browser (scripts/maps-page.html loads bank/bank.js, then this file),
   to write party/public/maps/ and party/data/maps-r/. The maps themselves are in bank/bank.js (SEED_MAPS). */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function mapSpec(q){ return q && q.map ? SEED_MAPS.find(m => m.key === q.map) || null : null; }

/* ---- loading the geometry ---- */
let mapGeoP = null;
function loadMapGeo(){
  if(window.MAPGEO) return Promise.resolve(window.MAPGEO);
  if(mapGeoP) return mapGeoP;
  mapGeoP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'maps-geo.js?v=' + BUILD.v;   // a new release must not read last version's cached file
    s.async = true;
    s.onload = () => window.MAPGEO ? res(window.MAPGEO) : rej(new Error('empty'));
    s.onerror = () => { mapGeoP = null; s.remove(); rej(new Error('load')); };
    document.head.appendChild(s);
  });
  return mapGeoP;
}
const needsGeo = (q) => !!mapSpec(q) && !window.MAPGEO;

/* ---- drawing ---- */
const MAP_SEA = '#0B1030', MAP_LAND = '#2B3152';
/* the world map stops just below Cape Horn unless a map needs Antarctica */
const MAP_CROP = { world:450 };
/* label sizes per base map, in the geometry's own units (1000 = full width) */
const MAP_FS = { world:12, europe:10.5, northatl:11, namerica:12, us:13, asia:11 };
const MAP_VIEW_NAME = { world:'World', europe:'Europe', northatl:'North Atlantic', namerica:'North America', us:'US', asia:'Asia' };
/* Countries too small, or too crowded, to hold their own label. The label is
   moved by [dx, dy] to the nearest spot where it covers nothing but sea or its
   own country and no other label, and a hairline leads back to it. Found by
   collision-testing every label against the real borders at these sizes, not
   by eye — rerun that if a label is added or MAP_FS changes. */
const MAP_CALLOUT = {
  europe:{ GRC:[8,0], PRT:[-5,6], LVA:[-7,4], HRV:[-23,13], SVK:[7,-4], CHE:[8,0], NLD:[-6,5], MDA:[41,34], BEL:[-8,-43],
           ARM:[-59,0], ALB:[-7,4], MKD:[-37,7], SVN:[19,53], MNE:[-11,13], XKX:[-20,55], CYP:[8,1], LUX:[13,-73],
           AND:[16,28], LIE:[-11,61], SMR:[-22,38], MCO:[-3,20] },
  us:{ WV:[10,-17], MD:[36,20], VT:[-11,-13], NH:[17,0], MA:[30,36], NJ:[14,0], CT:[20,3] },
  world:{ DEU:[-6,34], GBR:[-1,-8], GRC:[4,7] },
  northatl:{}, namerica:{}, asia:{}
};

const MAP_R = Math.PI / 180;
/* the exact same projection maps-geo.js was cut with (d3's naturalEarth1 and
   azimuthalEqualArea), so a city dot lands on the very pixel of its border */
function mapRotate(lam, phi, dl, dp){
  lam += dl; if(lam > Math.PI) lam -= 2 * Math.PI; else if(lam < -Math.PI) lam += 2 * Math.PI;
  if(!dp) return [lam, phi];
  const cp = Math.cos(dp), sp = Math.sin(dp), cphi = Math.cos(phi);
  const x = Math.cos(lam) * cphi, y = Math.sin(lam) * cphi, z = Math.sin(phi), k = z * cp + x * sp;
  return [Math.atan2(y, x * cp - z * sp), Math.asin(Math.max(-1, Math.min(1, k)))];
}
function mapNE1(l, p){
  const p2 = p * p, p4 = p2 * p2;
  return [ l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
           p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))) ];
}
function mapLAEA(l, p){ const cl = Math.cos(l), cp = Math.cos(p), k = Math.sqrt(2 / (1 + cl * cp)); return [k * cp * Math.sin(l), k * Math.sin(p)]; }
function mapProject(view, lat, lon){
  const pr = view.proj;
  const [l, p] = mapRotate(lon * MAP_R, lat * MAP_R, pr.r[0] * MAP_R, pr.r[1] * MAP_R);
  const [x, y] = (pr.t === 'ne1' ? mapNE1 : mapLAEA)(l, p);
  return [pr.tx + pr.k * x, pr.ty - pr.k * y];
}

const mapMemo = {};
function mapSVG(q, reveal){
  const spec = mapSpec(q);
  if(!spec){
    return q.img ? '<img class="map-img" src="' + esc(q.img) + '" alt="The map">'
                 : '<div class="map-wait">This map has no picture.</div>';
  }
  const GEO = window.MAPGEO;
  if(!GEO) return '<div class="map-wait" data-geo="wait">Loading the map&hellip;</div>';
  const memoKey = spec.key + (reveal ? ':r' : ':q');
  if(mapMemo[memoKey]) return mapMemo[memoKey];

  const v = GEO.views[spec.view];
  const H = (spec.view === 'world' && !spec.ata ? MAP_CROP.world : v.h);
  const fs = (spec.fs || MAP_FS[spec.view]) * 10;   // a map with small countries and numbers on them may set its own (5 Nov review: bigger)
  const fill = {};
  (spec.cls || []).forEach(c => c.codes.split(' ').forEach(k => { fill[k] = c.c; }));

  /* a map with areas clips them to the land, so each country's path gets an id to reuse */
  const lid = (spec.areas || []).length ? 'ml-' + spec.key + (reveal ? 'r-' : 'q-') : '';
  let land = '';
  Object.keys(v.shapes).forEach(k => {
    if(k === 'ATA' && !spec.ata) return;
    const f = fill[k] || (spec.rest && k !== 'ATA' ? spec.rest.c : MAP_LAND);
    land += '<path' + (lid ? ' id="' + lid + k + '"' : '') + ' d="' + v.shapes[k].d + '" fill="' + f + '"/>';
  });
  /* microstates and islands too small to see get a dot — only when they are
     in a group, or the map would be freckled with every atoll on Earth */
  let dots = '';
  const dotR = spec.view === 'world' ? 34 : 42;
  Object.keys(fill).forEach(k => {
    if(fill[k] === MAP_LAND) return;                                                      // a group drawn as plain land needs no dots
    const p = v.tiny[k] || (v.shapes[k] && v.shapes[k].a < 12 ? v.shapes[k].l : null);   // Malta-sized and under
    if(p) dots += '<circle cx="' + Math.round(p[0] * 10) + '" cy="' + Math.round(p[1] * 10) + '" r="' + dotR + '" fill="' + fill[k] + '"/>';
  });

  const where = (k) => v.shapes[k] ? v.shapes[k].l : v.tiny[k];
  /* a map with its own label set carries its own callouts — the view's were
     solved for a different set of labels and would put these in the wrong place */
  const call = spec.callout || MAP_CALLOUT[spec.view] || {};
  const lab = Object.assign({}, spec.labels || {}, reveal ? (spec.rlabels || {}) : {});
  let labels = '', leaders = '';
  Object.keys(lab).forEach(k => {
    const at = where(k); if(!at) return;
    const off = call[k];
    const x = Math.round((at[0] + (off ? off[0] : 0)) * 10), y = Math.round((at[1] + (off ? off[1] : 0)) * 10);
    if(off && Math.hypot(off[0], off[1]) > 12) leaders += '<line x1="' + Math.round(at[0] * 10) + '" y1="' + Math.round(at[1] * 10) + '" x2="' + x + '" y2="' + y + '"/>';
    labels += '<text x="' + x + '" y="' + y + '" dy=".35em" text-anchor="middle" font-size="' + fs + '" stroke-width="' + Math.round(fs * .22) + '">' + esc(lab[k]) + '</text>';
  });

  let lines = '';
  if(reveal && spec.lines && v.proj){
    spec.lines.forEach(ln => {
      let d = '';
      for(let lon = -180; lon <= 180; lon += 2){
        const p = mapProject(v, ln.lat, lon);
        d += (d ? 'L' : 'M') + Math.round(p[0] * 10) + ' ' + Math.round(p[1] * 10);
      }
      const p0 = mapProject(v, ln.lat, -150);
      lines += '<path class="mline" d="' + d + '"/>' +
        '<text x="' + Math.round(p0[0] * 10) + '" y="' + Math.round(p0[1] * 10 - fs * .6) + '" font-size="' + Math.round(fs * .9) + '" stroke-width="' + Math.round(fs * .2) + '">' + esc(ln.label) + '</text>';
    });
  }

  /* Areas: a region, not a whole country. Each is drawn freehand, well out
     to sea, and clipped to the coastline, so only its land takes the colour
     (the borders stay crisp, and a rough outline is enough). Routes are
     smooth lines through their points, with an arrowhead at the far end. */
  const P = (ll) => { const p = mapProject(v, ll[0], ll[1]); return [Math.round(p[0] * 10), Math.round(p[1] * 10)]; };
  let areas = '';
  if(lid && v.proj){
    const cid = lid + 'clip';
    let shapes = '';
    Object.keys(v.shapes).forEach(k => { if(k !== 'ATA' || spec.ata) shapes += '<use href="#' + lid + k + '"/>'; });
    areas = '<clipPath id="' + cid + '">' + shapes + '</clipPath><g clip-path="url(#' + cid + ')">';
    spec.areas.forEach(a => a.polys.forEach(poly => {
      areas += '<path d="M' + poly.map(P).map(p => p.join(' ')).join('L') + 'Z" fill="' + a.c + '"' + (a.o ? ' fill-opacity="' + a.o + '"' : '') + '/>';
    }));
    areas += '</g>';
  }
  let routes = '';
  if((spec.routes || []).length && v.proj){
    spec.routes.forEach(r => r.lines.forEach(line => {
      const q = line.map(P);
      let d = 'M' + q[0].join(' ');
      for(let i = 0; i < q.length - 1; i++){      // Catmull-Rom through every point
        const a = q[i - 1] || q[i], b = q[i], c = q[i + 1], e = q[i + 2] || c;
        d += 'C' + Math.round(b[0] + (c[0] - a[0]) / 6) + ' ' + Math.round(b[1] + (c[1] - a[1]) / 6) + ' ' +
                   Math.round(c[0] - (e[0] - b[0]) / 6) + ' ' + Math.round(c[1] - (e[1] - b[1]) / 6) + ' ' + c.join(' ');
      }
      const [x1, y1] = q[q.length - 2], [x2, y2] = q[q.length - 1], ang = Math.atan2(y2 - y1, x2 - x1), L = 150, Wd = 90;
      const tip = [x2, y2], l = [x2 - L * Math.cos(ang) + Wd * Math.sin(ang), y2 - L * Math.sin(ang) - Wd * Math.cos(ang)], rr = [x2 - L * Math.cos(ang) - Wd * Math.sin(ang), y2 - L * Math.sin(ang) + Wd * Math.cos(ang)];
      routes += '<path d="' + d + '" fill="none" stroke="#0B1030" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".7"/>' +
        '<path d="' + d + '" fill="none" stroke="' + r.c + '" stroke-width="2.4" stroke-linecap="round"' + (r.dash ? ' stroke-dasharray="7 5"' : '') + ' vector-effect="non-scaling-stroke"/>' +
        '<path d="M' + tip.join(' ') + 'L' + l.map(Math.round).join(' ') + 'L' + rr.map(Math.round).join(' ') + 'Z" fill="' + r.c + '"/>';
    }));
  }
  /* a picture layer, already in this view's projection (the night lights) */
  const raster = spec.raster ? '<image href="' + esc((window.MAPRASTER || {})[spec.raster] || spec.raster) + '" x="0" y="0" width="10000" height="' + (H * 10) + '" preserveAspectRatio="none"/>' : '';

  let pts = '', ptl = '';
  (spec.ptsReveal && !reveal ? [] : spec.pts || []).forEach(pt => {
    const p = mapProject(v, pt[0], pt[1]);
    const x = Math.round(p[0] * 10), y = Math.round(p[1] * 10);
    pts += '<circle class="mpt" cx="' + x + '" cy="' + y + '" r="' + (spec.pts.length > 10 ? 52 : 64) + '"' + (spec.ptColor ? ' style="fill:' + spec.ptColor + '"' : '') + '/>';
    if(reveal){
      const o = pt[3] || [10, 4, 'start'];
      ptl += '<text x="' + (x + o[0] * 10) + '" y="' + (y + o[1] * 10) + '" text-anchor="' + o[2] + '" font-size="' + Math.round(fs * .9) + '" stroke-width="' + Math.round(fs * .2) + '">' + esc(pt[2]) + '</text>';
    }
  });

  /* --ar lets the CSS size the drawing by whichever runs out first, width or
     height, so the frame (and its Enlarge chip) hugs the map itself */
  const out = '<svg class="map-svg" viewBox="0 0 10000 ' + (H * 10) + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map" style="--ar:' + (1000 / H).toFixed(4) + '">' +
    (v.sphere ? '<path class="msea" d="' + v.sphere + '"/>' : '<rect class="msea" width="10000" height="' + (H * 10) + '"/>') +
    '<g class="mland">' + land + '</g>' +
    areas + raster +
    '<g class="mdots">' + dots + '</g>' +
    lines + routes +
    '<g class="mlead">' + leaders + '</g>' +
    '<g class="mpts">' + pts + '</g>' +
    '<g class="mlab">' + labels + ptl + '</g>' +
  '</svg>';
  mapMemo[memoKey] = out;
  return out;
}
/* During play the legend may say what the colours ARE ("70–100", "50%") but
   never what they MEAN; at the reveal it says everything. A map with no hint
   at all simply has no legend until the reveal. */
function mapLegend(q, reveal){
  const spec = mapSpec(q);
  if(!spec) return '';
  const items = [];
  (spec.cls || []).forEach(c => { const t = reveal ? c.label : c.hint; if(t) items.push('<span><i style="background:' + c.c + '"></i>' + esc(t) + '</span>'); });
  if(spec.rest){ const t = reveal ? spec.rest.label : spec.rest.hint; if(t) items.push('<span><i style="background:' + spec.rest.c + '"></i>' + esc(t) + '</span>'); }
  (spec.areas || []).forEach(a => { const t = reveal ? a.label : a.hint; if(t) items.push('<span><i style="background:' + a.c + (a.o ? ';opacity:' + a.o : '') + '"></i>' + esc(t) + '</span>'); });
  (spec.routes || []).forEach(r => { const t = reveal ? r.label : r.hint; if(t) items.push('<span><i style="background:' + r.c + ';height:3px;border-radius:2px"></i>' + esc(t) + '</span>'); });
  if(spec.pts && (reveal || !spec.ptsReveal)) items.push('<span><i class="pt"' + (spec.ptColor ? ' style="background:' + spec.ptColor + '"' : '') + '></i>' + (reveal ? esc(spec.ptLabel) : spec.pts.length + ' places') + '</span>');
  return items.length ? '<div class="map-legend">' + items.join('') + '</div>' : '';
}

