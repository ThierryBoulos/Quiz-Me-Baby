/* node --test engine/fool.test.js — Fool Me Twice (the owner, 16 Nov): the answers to pick from, the points, the
   prediction, the deal (4 normal facts, then 2 hard) and the two-team game's end */
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./core.js');

let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const fact = { answer:'Guinea pig', fakes:['Goldfish', 'Goat', 'Cow bell', 'Alphorn', 'Cuckoo clock', 'Parrot', 'Tortoise', 'Rabbit'] };
const accept = ['Guinea pigs', 'A guinea pig', 'Ginea pig'];

test('fool: the number of answers: 4 with 2 teams, 5 with 3, one per team and the truth from 4 to 8', () => {
  for(const [n, want] of [[2, 4], [3, 5], [4, 5], [5, 6], [8, 9]]){
    const lies = Array.from({ length:n }, (_, t) => 'Lie number ' + t);
    const { opts } = Q.foolOptions(fact, lies, accept, rng);
    assert.equal(opts.length, want, n + ' teams');
    assert.equal(opts.filter(o => o.truth).length, 1);
  }
});
test('fool: the truth typed as a lie, any way it is written, never shows twice; one of ours takes its place', () => {
  for(const typed of ['guinea pigs', 'A guinea pig', 'Ginea pig', 'guinea  pig.']){
    const { opts, lost } = Q.foolOptions(fact, [typed, 'Hamster'], accept, rng);
    assert.deepEqual(lost, [0], typed);
    assert.equal(opts.length, 4);
    assert.equal(opts.filter(o => Q.foolIsTruth(o.text, fact, accept)).length, 1, typed + ': the truth once');
    assert.equal(opts.filter(o => o.ours).length, 2);
  }
});
test('fool: no lie, an empty one: one of ours in its place', () => {
  const { opts, lost } = Q.foolOptions(fact, [null, '  '], accept, rng);
  assert.deepEqual(lost, [0, 1]);
  assert.equal(opts.length, 4);
  assert.equal(opts.filter(o => o.ours).length, 3);
});
test('fool: the same lie from two teams (typos, a full stop) shows once, both its writers; ours fill the gap', () => {
  const { opts } = Q.foolOptions(fact, ['Hamster', 'hamstr.', 'Goldfish'], accept, rng);
  const h = opts.filter(o => /hamst/i.test(o.text));
  assert.equal(h.length, 1);
  assert.deepEqual(h[0].by.sort(), [0, 1]);
  assert.equal(opts.length, 5);
  /* a team's lie that is one of ours: ours isn't added again */
  assert.equal(opts.filter(o => /goldfish/i.test(o.text)).length, 1);
});
test('fool: ours come from the top 4 fakes first; the 4 backups only when more than 4 are needed', () => {
  const top = fact.fakes.slice(0, 4).map(Q.foolShow), back = fact.fakes.slice(4).map(Q.foolShow);
  for(let i = 0; i < 40; i++){
    /* two teams, two lies: one of ours, always from the top 4 */
    const two = Q.foolOptions(fact, ['Hamster', 'Cat'], accept, rng).opts.filter(o => o.ours).map(o => o.text);
    assert.equal(two.length, 1); assert.ok(top.includes(two[0]));
    /* three teams, no lie at all: four of ours, the top 4 */
    const none = Q.foolOptions(fact, ['', '', ''], accept, rng).opts.filter(o => o.ours).map(o => o.text);
    assert.deepEqual(none.slice().sort(), top.slice().sort());
  }
  /* eight teams, no lie at all: all eight, the backups too */
  const all = Q.foolOptions(fact, Array(8).fill(''), accept, rng).opts.filter(o => o.ours).map(o => o.text);
  assert.deepEqual(all.slice().sort(), [...top, ...back].sort());
  /* a team's lie that is one of the top 4: the next of ours comes from the rest of the top 4 */
  const dup = Q.foolOptions(fact, ['Goldfish', '', ''], accept, rng).opts.filter(o => o.ours).map(o => o.text);
  assert.equal(dup.length, 3); assert.ok(dup.every(x => top.includes(x)));
});
test('fool: a real word a letter from the truth is a lie, a typo of the truth is the truth (17 Nov)', () => {
  const boats = { answer:'Boats' }, acc = ['Boat', 'Rowing boats', 'Botes'];
  assert.equal(Q.foolIsTruth('Goats', boats, acc), false);              // another first letter: a lie
  assert.equal(Q.foolIsTruth('Coats', boats, acc), false);
  assert.equal(Q.foolIsTruth('Boots', boats, acc), true);               // same first letter, one letter off: the truth, mistyped
  assert.equal(Q.foolIsTruth('boats.', boats, acc), true);
  assert.equal(Q.foolIsTruth('The boats', boats, acc), true);
  assert.equal(Q.foolIsTruth('Rowing boats', boats, acc), true);        // on the fact's own list, whatever its first letter
  assert.equal(Q.foolIsTruth('Brine', { answer:'Urine' }, ['Pee', 'Wee']), false);
  assert.equal(Q.foolIsTruth('Pee', { answer:'Urine' }, ['Pee', 'Wee']), true);
});
test('fool: two teams with the same lie who both named the team that fell for it: it loses 1, not 2 (17 Nov); each caller +1 more (19 Nov)', () => {
  const opts = [{ text:'T', truth:true, by:[] }, { text:'L', by:[0, 1] }, { text:'M', by:[2] }];
  const r = Q.foolScore(opts, [0, 0, 1], [2, 2, 0]);
  assert.deepEqual(r.pts, [4, 4, -1]);                                  // the truth +2, fooled C +1, called it +1
  assert.equal(r.hits.length, 2);                                       // both called it
});
test('fool: an answer shows tidied: first letter capital, no full stop, 25 letters at most', () => {
  assert.equal(Q.foolShow('  a   wig.  '), 'A wig');
  assert.equal(Q.foolShow('x'.repeat(60)).length, 25);
});
test('fool: points: +2 the truth, +1 per team fooled, a right call +1 to the caller and -1 to the team it named, 0 for ours', () => {
  const opts = [{ text:'Guinea pig', truth:true, by:[] }, { text:'Hamster', by:[0] }, { text:'Cat', by:[1, 2] }, { text:'Goat', ours:true, by:[] }];
  const r = Q.foolScore(opts, [2, 1, 0], [2, null, 0]);
  assert.deepEqual(r.pts, [0, 1, 4]);              // A: fooled B (+1), fell for Cat, which C predicted (-1); C: truth (+2), fooled A (+1), called it (+1)
  assert.deepEqual(r.hits, [{ by:2, on:0 }]);
  assert.deepEqual(Q.foolScore(opts, [3, null, null], [null, null, null]).pts, [0, 0, 0]);   // ours, and no pick: nothing
  assert.deepEqual(Q.foolScore(opts, [1, null, null], [null, null, null]).pts, [0, 0, 0]);   // its own lie: not a pick
});

/* the deal and the two-team game */
const bank = [];
for(let i = 0; i < 9; i++) bank.push({ id:'fool:n' + i, type:'fool', level:'normal', question:'Fact ' + i + ' ____.', answer:'True ' + i, fakes:['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'] });
for(let i = 0; i < 4; i++) bank.push({ id:'fool:h' + i, type:'fool', level:'hard', question:'Hard ' + i + ' ____.', answer:'Truth ' + i, fakes:['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'] });
const D = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => true, rng });
const game = () => D.buildGame({ standard:false, rounds:0, themes:[], minis:['fool'], teamA:{ name:'Owls' }, teamB:{ name:'Lions' } });

test('fool: six facts, the first four normal and the last two hard; the rest spare', () => {
  const s = game().foolGame;
  assert.equal(s.qs.length, Q.FOOL_LEGS);
  assert.deepEqual(s.qs.map(q => q.level), ['normal', 'normal', 'normal', 'normal', 'hard', 'hard']);
  assert.equal(s.spare.length, 13 - 6);
});
test('fool: two teams: the points add up over the facts, the most takes the game; tied, one more fact', () => {
  const g = game(), s = g.foolGame;
  assert.deepEqual(Q.play(g, { type:'fool/start' }), [{ go:'foolWrite' }]);
  const opts = [{ text:'T', truth:true, by:[] }, { text:'A', by:[0] }, { text:'B', by:[1] }, { text:'O', ours:true, by:[] }];
  let fx;
  /* five facts, each tied: both find the truth */
  for(let i = 0; i < 5; i++) fx = Q.play(g, { type:'fool/settle', opts, picks:[0, 0] });
  assert.deepEqual(s.pts, [10, 10]);
  assert.deepEqual(fx, [{ go:'foolWrite' }]);
  /* the sixth: A falls for B's lie (B: +1; with two teams nobody names a team, so A loses nothing) */
  fx = Q.play(g, { type:'fool/settle', opts, picks:[2, 0] });
  assert.deepEqual(s.pts, [10, 13]);
  assert.deepEqual(s.subs[5].hits, []);
  assert.equal(s.verdict.winner, 1);
  assert.equal(g.teams[1].score, g.miniPts);
  assert.ok(fx.some(f => f.go === 'foolSummary'));
  assert.deepEqual(Q.play(g, { type:'fool/done' }), [{ finalize:true }]);
});
test('fool: tied after six facts: one more from the spare ones', () => {
  const g = game(), s = g.foolGame;
  Q.play(g, { type:'fool/start' });
  const opts = [{ text:'T', truth:true, by:[] }, { text:'A', by:[0] }, { text:'B', by:[1] }, { text:'O', ours:true, by:[] }];
  let fx;
  for(let i = 0; i < 6; i++) fx = Q.play(g, { type:'fool/settle', opts, picks:[3, 3] });
  assert.equal(s.tieLegs, 1);
  assert.equal(s.qs.length, 7);
  assert.ok(fx.some(f => f.go === 'foolWrite'));
  assert.ok(fx.some(f => /Tied at 0 each/.test(f.toast || '')));
});
test('fool: a night with rounds: after its round, the game comes up (its intro)', () => {
  const std = [];
  for(let i = 0; i < 40; i++) std.push({ id:'s' + i, type:'standard', theme:'Music', difficulty:['easy', 'medium', 'hard'][i % 3], question:'Q' + i + '?', answer:'A' + i });
  const D2 = Q.createDealer({ bank:() => bank.concat(std), used:() => new Set(), noRepeat:() => true, rng });
  const g = D2.buildGame({ standard:true, rounds:2, themes:['Music', 'Music'], difficulty:'easy+medium+hard', minis:['fool'], teamA:{ name:'Owls' }, teamB:{ name:'Lions' } });
  const owed = (g.plan || []).filter(p => p.key === 'fool');
  assert.equal(owed.length, 1);
  g.r = owed[0].after;
  const fx = Q.play(g, { type:'round/next' }, { deal:D2 });
  assert.ok(fx.some(f => f.go === 'foolIntro'), JSON.stringify(fx));
});
test('fool: two facts that never share a night: never both dealt, nor one dealt and the other spare', () => {
  const b2 = bank.map(q => Object.assign({}, q));
  for(let seed2 = 1; seed2 <= 40; seed2++){
    let x = seed2; const r = () => (x = (x * 16807) % 2147483647) / 2147483647;
    const D3 = Q.createDealer({ bank:() => b2, used:() => new Set(), noRepeat:() => true, rng:r, never:() => [['fool:n0', 'fool:n1'], ['fool:h0', 'fool:h1']] });
    const s = D3.buildGame({ standard:false, rounds:0, themes:[], minis:['fool'], teamA:{ name:'Owls' }, teamB:{ name:'Lions' } }).foolGame;
    const all = s.qs.concat(s.spare).map(q => q.id);
    for(const [a, c] of [['fool:n0', 'fool:n1'], ['fool:h0', 'fool:h1']]) assert.ok(!(all.includes(a) && all.includes(c)), seed2 + ': ' + a + ' and ' + c);
    assert.deepEqual(s.qs.map(q => q.level), ['normal', 'normal', 'normal', 'normal', 'hard', 'hard']);
  }
});
