/* node --test engine/see.test.js — What Do You See? (11 Nov, the owner): the deal, the legs, ties, decided early */
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./core.js');

function bankOf(n = 6){
  const b = [];
  for(const kind of ['face', 'logo', 'close']) for(const level of ['easy', 'medium', 'hard']) for(let i = 0; i < n; i++)
    b.push({ id:`see:${kind}-${level}-${i}`, type:'see', kind, level, answer:`${kind} ${level} ${i}`, question:`${kind} ${level} ${i}`, photo:`h${kind}${level}${i}` });
  return b;
}
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function night(over = {}, opt = {}){
  const bank = opt.bank || bankOf(), used = opt.used || new Set();
  const D = Q.createDealer({ bank:() => bank, used:() => used, noRepeat:() => true, never:() => opt.never || [], rng:opt.rng });
  const g = D.buildGame(Object.assign({ standard:false, rounds:0, themes:[], minis:['see'], teamA:{ name:'Owls' }, teamB:{ name:'Lions' } }, over));
  return { g, env:{ deal:D }, D };
}
const goes = (fx) => fx.filter(f => f.go).map(f => f.go);

test('see: 12 pictures, 4 faces, 4 logos, 4 close-ups; an easy one first; never two of a kind in a row', () => {
  for(let seed = 1; seed < 40; seed++){
    const { g } = night({}, { rng:seeded(seed) }), qs = g.seeGame.qs;
    assert.equal(qs.length, 12);
    const by = (k) => qs.filter(q => q.kind === k).length;
    assert.deepEqual([by('face'), by('logo'), by('close')], [4, 4, 4]);
    assert.equal(qs[0].level, 'easy');
    for(let i = 1; i < qs.length; i++) assert.notEqual(qs[i].kind, qs[i - 1].kind, qs.map(q => q.kind).join());
    assert.ok(g.seeGame.spare.length > 10, 'spares for Change question and tie-breakers');
  }
});

test('see: the levels picked; each kind its levels in turn; unplayed first', () => {
  const { g } = night({ seeLevels:['hard'] });
  assert.ok(g.seeGame.qs.every(q => q.level === 'hard'));
  const bank = bankOf(3), used = new Set(bank.filter(q => q.kind === 'face' && q.level === 'easy').slice(0, 2).map(q => q.id));
  for(let seed = 1; seed < 20; seed++){
    const { g: g2 } = night({ seeLevels:['easy'] }, { bank, used, rng:seeded(seed) });
    const faces = g2.seeGame.qs.filter(q => q.kind === 'face');
    assert.ok(faces.every(q => !used.has(q.id)) || faces.length > 1, 'a played face only once the unplayed ones are gone');
    assert.ok(faces.some(q => !used.has(q.id)));
  }
});

test('see: a kind left out (the host\'s Advanced); a kind that runs short, the others make it up', () => {
  const { g } = night({ seeKinds:['face', 'close'] });
  assert.ok(g.seeGame.qs.every(q => q.kind !== 'logo'));
  assert.deepEqual(['face', 'close'].map(k => g.seeGame.qs.filter(q => q.kind === k).length), [6, 6]);
  const small = bankOf(6).filter(q => q.kind !== 'logo' || q.level === 'easy').filter((q, i, a) => q.kind !== 'logo' || a.filter(x => x.kind === 'logo').indexOf(q) < 1);
  const { g: g2 } = night({}, { bank:small });
  assert.equal(g2.seeGame.qs.length, 12);
  assert.equal(g2.seeGame.qs.filter(q => q.kind === 'logo').length, 1);
  const { g: g3 } = night({ seeKinds:[] });
  assert.equal(g3.seeGame.kinds.length, 3, 'none ticked counts as all');
});

test('see: 3 to 8 teams ask for 12 too (cfg.seeLegs): 4 of each kind', () => {
  for(let seed = 1; seed < 20; seed++){
    const { g } = night({ seeLegs:12 }, { rng:seeded(seed) }), qs = g.seeGame.qs;
    assert.equal(qs.length, 12);
    assert.deepEqual(['face', 'logo', 'close'].map(k => qs.filter(q => q.kind === k).length), [4, 4, 4]);
  }
});

test('see: no pictures at all, the game is left out', () => {
  const { g } = night({ minis:['see', 'flag'] }, { bank:[] });
  assert.ok(!(g.plan || []).some(p => p.key === 'see'));
});

test('see: the legs — the fastest right takes the picture; nobody, nobody; 12 pictures', () => {
  const { g, env } = night();
  assert.deepEqual(goes(Q.play(g, { type:'game/start' }, env)), ['seeIntro']);
  assert.deepEqual(goes(Q.play(g, { type:'see/start' }, env)), ['seeQ']);
  Q.play(g, { type:'see/verdict', w:0 }, env);
  Q.play(g, { type:'see/verdict', w:'none' }, env);
  Q.play(g, { type:'see/verdict', w:1 }, env);
  assert.deepEqual(g.seeGame.wins, [1, 1]);
  assert.equal(g.seeGame.i, 3);
  for(let i = 0; i < 9; i++) Q.play(g, { type:'see/verdict', w:0 }, env);
  assert.ok(g.seeGame.done);
  assert.equal(g.seeGame.verdict.winner, 0);
  assert.equal(g.teams[0].score, 2, 'the game pays 2');
});

test('see: won early (the lead bigger than the pictures left): decided, as every best-of', () => {
  const { g, env } = night();
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'see/start' }, env);
  for(let i = 0; i < 6; i++) Q.play(g, { type:'see/verdict', w:1 }, env);
  assert.equal(Q.decidedEarly(g, 'see'), null, '6 up with 6 to play: not yet');
  Q.play(g, { type:'see/verdict', w:1 }, env);
  assert.deepEqual(Q.decidedEarly(g, 'see'), { winner:1, spare:5 });
});

test('see: tied after 12 — the team that buzzed faster wins (the owner, 12 Nov); Change question takes a spare at the same level', () => {
  const { g, env } = night();
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'see/start' }, env);
  const lvl = g.seeGame.qs[0].level, was = g.seeGame.qs[0].id;
  assert.deepEqual(goes(Q.play(g, { type:'see/swap' }, env)), ['seeQ']);
  assert.notEqual(g.seeGame.qs[0].id, was);
  assert.equal(g.seeGame.qs[0].level, lvl);
  /* 5 each and 2 nobody got; Lions (1) were faster on theirs */
  const seq = [[0, 6000], [1, 3000], [0, 5000], [1, 4000], [0, 7000], [1, 2500], [0, 4000], [1, 3500], [0, 6500], [1, 3000], ['none'], ['none']];
  let fx;
  for(const [w, ms] of seq) fx = Q.play(g, { type:'see/verdict', w, ms }, env);
  assert.equal(g.seeGame.qs.length, 12, 'no tie-breaker picture');
  assert.deepEqual(goes(fx), ['seeSummary']);
  assert.equal(g.seeGame.verdict.winner, 1);
  assert.equal(g.seeGame.verdict.note, 'Tied at 5 each: Lions buzzed faster.');
  assert.equal(g.teams[1].score, 2);
});

test('see: nobody got any of the 12 — the next spare picture decides it, as Guess the Flag', () => {
  const { g, env } = night();
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'see/start' }, env);
  let fx;
  for(let i = 0; i < 12; i++) fx = Q.play(g, { type:'see/verdict', w:'none' }, env);
  assert.equal(g.seeGame.qs.length, 13);
  assert.deepEqual(goes(fx), ['seeQ']);
  fx = Q.play(g, { type:'see/verdict', w:1, ms:4000 }, env);
  assert.equal(g.seeGame.verdict.winner, 1);
  assert.match(g.seeGame.verdict.note, /tie-breaker picture/);
});

test('see: in the night\'s order between the rounds (it is a mini-game like the others)', () => {
  const bank = bankOf(6);
  for(const t of ['Geography', 'History', 'Music', 'Movies']) for(const d of ['easy', 'medium']) for(let i = 0; i < 4; i++)
    bank.push({ id:`${t}${d}${i}`, type:'standard', theme:t, difficulty:d, question:'?', answer:'x' + i });
  const { g } = night({ standard:true, rounds:4, themes:['Geography', 'History', 'Music', 'Movies'], difficulty:'easy+medium', minis:['see', 'flag'] }, { bank });
  assert.ok(g.plan.some(p => p.key === 'see'));
});
