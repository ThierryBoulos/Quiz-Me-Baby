/* node --test engine/  — dealing, on a small made-up bank */
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./core.js');

let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const bank = [];
['Music', 'Movies'].forEach(t => ['easy', 'medium', 'hard'].forEach(d => {
  for(let i = 0; i < 6; i++) bank.push({ id:`${t}-${d}-${i}`, type:'standard', theme:t, difficulty:d, use_with:`${t}${d}${i >> 1}` });
}));
for(let i = 0; i < 12; i++) bank.push({ id:'c' + i, type:'closest', theme:['Music','Movies','Sports'][i % 3] });
for(let i = 0; i < 4; i++) bank.push({ id:'a' + i, type:'auction' });
for(let i = 0; i < 12; i++) bank.push({ id:'s' + i, type:'saysame', pool:i < 2 ? ['x','y'] : ['p','q','r','s','t'].slice(0, 3 + (i % 3)) });
['veasy','easy','medium','hard','expert'].forEach(l => { for(let i = 0; i < 8; i++) bank.push({ id:`flag:${l}${i}`, type:'flag', level:l }); });
['c-easy','c-medium','d-easy','d-medium'].forEach(l => { for(let i = 0; i < 5; i++) bank.push({ id:`dish:${l}${i}`, type:'dish', level:l }); });
['easy','medium','hard'].forEach(l => { for(let i = 0; i < 3; i++) bank.push({ id:`map:${l}${i}`, type:'map', level:l }); });
const used = new Set(['flag:medium0']);
const D = Q.createDealer({ bank:() => bank, used:() => used, noRepeat:() => true, rng,
  ok:{ map:q => q.type === 'map', flag:q => q.type === 'flag', dish:q => q.type === 'dish' } });
const cfg = (x) => Object.assign({ rounds:4, themes:['Music','Movies'], difficulty:'medium', minis:[],
  teamA:{ name:'A', captain:'', players:'' }, teamB:{ name:'B', captain:'', players:'' } }, x);

test('standard rounds: pairs share a ticker and a difficulty', () => {
  const g = D.buildGame(cfg());
  assert.equal(g.rounds.length, 4);
  g.rounds.forEach(r => { assert.equal(r.q[0].difficulty, 'medium'); assert.equal(r.q[0].use_with, r.q[1].use_with); });
  const ids = g.rounds.flatMap(r => r.q.map(q => q.id));
  assert.equal(new Set(ids).size, ids.length);                    // nothing dealt twice
});

test('hand-picked flags lead, then the levels share evenly', () => {
  const deck = D.flagDeck({ pickFlag:['flag:hard3', 'flag:easy1'] }, ['easy', 'hard']);
  assert.deepEqual(deck.slice(0, 2).map(q => q.id), ['flag:hard3', 'flag:easy1']);
  const first10 = deck.slice(0, 10).map(q => q.level);
  assert.equal(first10.filter(l => l === 'easy').length, 5);
  assert.ok(deck.every(q => q.level === 'easy' || q.level === 'hard'));
});

test('played flags queue behind fresh ones', () => {
  const deck = D.flagPool(['medium']);
  assert.equal(deck[deck.length - 1].id, 'flag:medium0');
});

test('cocktail/dish: levels default to medium, deck is best of 7', () => {
  assert.deepEqual(D.dishLevelsOf({}), ['c-medium', 'd-medium']);
  const g = D.buildGame(cfg({ minis:['dish'] }));
  assert.equal(g.dishGame.base, 7);
  assert.ok(g.dishGame.qs.every(q => q.level === 'c-medium' || q.level === 'd-medium'));
  assert.deepEqual(g.dishGame.leg, { shown:1, out:[false, false], buzz:null, calls:[], k:0 });
});

test('say-same: wide prompts first, a coin flip last', () => {
  const deck = D.saySameDeck({});
  const legs = deck.slice(0, 9);
  assert.equal(legs[legs.length - 1].pool.length, 2);
  for(let i = 1; i < legs.length - 1; i++) assert.ok(legs[i - 1].pool.length >= legs[i].pool.length);
});

/* only the last two can come down to luck: three or four answers, then two (22 Oct) */
test('say-same: five answers or more until the last two, then four, then a coin flip', () => {
  const b = [];
  for(let i = 0; i < 12; i++) b.push({ id:'w' + i, type:'saysame', pool:'abcdefghijklmnop'.slice(0, 5 + (i % 6)).split('') });
  for(let i = 0; i < 3; i++) b.push({ id:'f' + i, type:'saysame', pool:['n', 's', 'e', 'w'] });
  for(let i = 0; i < 2; i++) b.push({ id:'t' + i, type:'saysame', pool:['r', 'p', 's'] });
  for(let i = 0; i < 2; i++) b.push({ id:'c' + i, type:'saysame', pool:['x', 'y'] });
  for(let run = 0; run < 30; run++){
    const D2 = Q.createDealer({ bank:() => b, used:() => new Set(), noRepeat:() => true, ok:{ map:() => false, flag:() => false, dish:() => false } });
    const deck = D2.saySameDeck({}), legs = deck.slice(0, 9), n = legs.map(q => q.pool.length);
    assert.equal(n[8], 2, n.join(','));
    assert.equal(n[7], 4, n.join(','));
    assert.ok(n.slice(0, 7).every(k => k >= 5), n.join(','));
    for(let i = 1; i < 8; i++) assert.ok(n[i - 1] >= n[i], n.join(','));
    assert.ok(deck.slice(9, 14).every(q => q.pool.length >= 5));                 // tie-breakers: the wide ones left
    /* the host's own three-answer pick is the next-to-last */
    const own = D2.saySameDeck({ pickSaySame:['t1'] }).slice(0, 9);
    assert.equal(own[7].id, 't1'); assert.equal(own[8].pool.length, 2);
  }
});

test('mini-game plan and points', () => {
  const g = D.buildGame(cfg({ rounds:4, minis:['closest', 'flag', 'battle'] }));
  assert.deepEqual(g.plan.map(p => p.key), ['flag', 'closest']);       // Flag opens the night
  assert.equal(g.hasBattle, true);
  assert.equal(g.miniPts, Q.miniPointValue(4, 3, true));
  assert.equal(g.battlePts, 2 * g.miniPts);
  const only = D.buildGame(cfg({ standard:false, minis:['map', 'flag'] }));
  assert.equal(only.rounds.length, 0);
  assert.deepEqual(only.plan, [{ key:'flag', after:0 }, { key:'map', after:0 }]);
});

test('battle: same difficulty shape for both captains, never the same question', () => {
  const b = D.buildBattle(new Set());
  assert.ok(b && b.n >= 2);
  b.qs[0].forEach((q, i) => assert.equal(q.difficulty, b.qs[1][i].difficulty));
  const all = b.qs[0].concat(b.qs[1]).map(q => q.id);
  assert.equal(new Set(all).size, all.length);
});

test('sudden death never deals a question the dealer marks as not for sudden death', () => {
  const D2 = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => false, rng,
    suddenOk:q => !q.id.startsWith('Music'),
    ok:{ map:q => q.type === 'map', flag:q => q.type === 'flag', dish:q => q.type === 'dish' } });
  const g = D2.buildGame(cfg({ rounds:4 }));
  g.teams[0].score = g.teams[1].score;
  for(let i = 0; i < 12; i++){
    Q.play(g, { type:'sudden/win', w:'none' }, { deal:D2, settings:{} });
    assert.ok(g.sd && g.sd.q, 'a sudden-death question was dealt');
    assert.ok(!g.sd.q.id.startsWith('Music'), g.sd.q.id);
  }
});

test('Say the Same: the hidden word is any of the top six, evenly; a shorter list, any of it', () => {
  let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const D3 = Q.createDealer({ bank:() => [], used:() => new Set(), noRepeat:() => false, rng:r, ok:{ map:() => false, flag:() => false, dish:() => false } });
  /* a long list: the top six only (never Wensleydale), each about a sixth of the time */
  const cheese = { pool:'Cheddar Mozzarella Brie Parmesan Feta Gouda Camembert Halloumi Stilton Edam Wensleydale'.split(' ') }, n = {};
  for(let i = 0; i < 6000; i++){ const w = D3.drawSaySame(cheese).answer; n[w] = (n[w] || 0) + 1; }
  assert.deepEqual(Object.keys(n).sort(), ['Brie', 'Cheddar', 'Feta', 'Gouda', 'Mozzarella', 'Parmesan'], JSON.stringify(n));
  assert.ok(Object.values(n).every((k) => k > 850 && k < 1150), JSON.stringify(n));
  /* six or fewer: any of them (the planets' first six too) */
  const six = { pool:['Mars', 'Earth', 'Jupiter', 'Saturn', 'Venus', 'Mercury'] }, b = new Set();
  for(let i = 0; i < 2000; i++) b.add(D3.drawSaySame(six).answer);
  assert.equal(b.size, 6);
  /* ...unless the list keeps to its famous answers: the four Beatles, never Pete Best */
  const beatles = { pool:['John', 'Paul', 'Ringo', 'George', 'Pete Best', 'Stuart Sutcliffe'], common:4 }, f = new Set();
  for(let i = 0; i < 2000; i++) f.add(D3.drawSaySame(beatles).answer);
  assert.deepEqual([...f].sort(), ['George', 'John', 'Paul', 'Ringo']);
  const coin = { pool:['Heads', 'Tails'] }, c = {};
  for(let i = 0; i < 2000; i++){ const w = D3.drawSaySame(coin).answer; c[w] = (c[w] || 0) + 1; }
  assert.ok(Math.abs(c.Heads - c.Tails) < 200, JSON.stringify(c));
});

/* the four levels (22 Oct): a mix without Expert deals Expert only once a theme runs out of the rest */
test('levels: Easy+Medium+Hard by default, Mixed is all four, Expert only when the rest is spent', () => {
  assert.deepEqual(Q.diffsOf(Q.DEFAULT_DIFF), ['easy', 'medium', 'hard']);
  assert.deepEqual(Q.diffsOf('mixed'), ['easy', 'medium', 'hard', 'expert']);
  assert.deepEqual(Q.diffsOf('expert+easy'), ['easy', 'expert']);
  assert.deepEqual(Q.diffsOf('nonsense'), ['easy', 'medium', 'hard']);
  const b = [];
  ['easy', 'expert'].forEach(d => { for(let i = 0; i < 4; i++) b.push({ id:`T-${d}-${i}`, type:'standard', theme:'T', difficulty:d, question:d + i, answer:'a' }); });
  const used = new Set();
  const D2 = Q.createDealer({ bank:() => b, used:() => used, noRepeat:() => true });
  const deal = (difficulty) => D2.buildGame({ standard:true, rounds:4, themes:['T'], difficulty, minis:[], teamA:{ name:'A' }, teamB:{ name:'B' } });
  /* the default: the two easy pairs first; then, the easy ones spent, the Expert ones */
  const g1 = deal(Q.DEFAULT_DIFF);
  assert.deepEqual(g1.rounds.map(r => r.q[0].difficulty), ['easy', 'easy', 'expert', 'expert']);
  assert.equal(g1.rounds.slice(0, 2).every(r => r.q.every(q => q.difficulty === 'easy')), true);
  /* both questions of a round always share a level */
  assert.ok(g1.rounds.every(r => r.q[0].difficulty === r.q[1].difficulty));
  /* a single level stays that level */
  assert.equal(deal('easy').rounds.length, 2);
  /* Mixed takes all four from the start */
  assert.equal(deal('mixed').rounds.length, 4);
  assert.ok(D2.matchDiff({ difficulty:'expert' }, 'mixed') && !D2.matchDiff({ difficulty:'expert' }, Q.DEFAULT_DIFF));
});
