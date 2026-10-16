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

test('mini-game plan and points', () => {
  const g = D.buildGame(cfg({ rounds:4, minis:['closest', 'flag', 'battle'] }));
  assert.deepEqual(g.plan.map(p => p.key), ['closest', 'flag']);
  assert.equal(g.hasBattle, true);
  assert.equal(g.miniPts, Q.miniPointValue(4, 3));
  const only = D.buildGame(cfg({ standard:false, minis:['map', 'flag'] }));
  assert.equal(only.rounds.length, 0);
  assert.deepEqual(only.plan, [{ key:'map', after:0 }, { key:'flag', after:0 }]);
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
