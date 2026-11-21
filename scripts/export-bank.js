/* Writes Party's two banks from the question bank (bank/bank.js, buildSeedBank), so Party deals from it:
     party/data/bank.json    — everything, answers included. Server only: the
                               TV and the host get it through /api/bank.
     party/public/bank.json  — what any phone may see: ids, types, themes,
                               levels. No questions, no answers (D5).
   Run it after any change to the bank:
     node scripts/export-bank.js
   (Until 21 Nov it read the bank out of classic.html in a browser; the bank now has a file of its own.) */
const path = require('path'), fs = require('fs');
const root = path.join(__dirname, '..');
const { BUILD, SEED_VERSION, THEMES, SEED_NEVER, buildSeedBank } = require(path.join(root, 'bank/bank.js'));
const rows = buildSeedBank(true);
/* the themes: the house list, then any other theme a question has, A to Z ("General Knowledge", "Quotes"), as Classic
   added them when it loaded (reconcileThemes) */
const extra = [...new Set(rows.map(q => q.theme).filter(t => t && THEMES.indexOf(t) < 0))].sort();
const out = {
  version: BUILD.v, seed: SEED_VERSION, themes: THEMES.concat(extra), never: SEED_NEVER || [],
  bank: rows.map(q => { const o = {}; Object.keys(q).forEach(k => { if(q[k] !== '' && q[k] != null && k !== 'src') o[k] = q[k]; }); return o; })
};
const file = path.join(root, 'party/data/bank.json');
fs.mkdirSync(path.dirname(file), { recursive:true });
fs.writeFileSync(file, JSON.stringify(out));
const LITE = ['id', 'type', 'theme', 'difficulty', 'level', 'use_with'];
const lite = Object.assign({}, out, { never:undefined, bank:out.bank.map(q => { const o = {}; LITE.forEach(k => { if(q[k] != null) o[k] = q[k]; }); return o; }) });
fs.writeFileSync(path.join(root, 'party/public/bank.json'), JSON.stringify(lite));
const by = {}; out.bank.forEach(q => by[q.type] = (by[q.type] || 0) + 1);
console.log('bank.json:', out.bank.length, 'rows', JSON.stringify(by), (fs.statSync(file).size / 1024).toFixed(0) + ' KB, from v' + out.version);
