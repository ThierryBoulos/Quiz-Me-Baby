/* node --test engine/stakes.test.js — Secret Stakes (11 Nov, the owner): the deal, the bet's size, every move,
   the points, and where it sits in the night */
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./core.js');

const THEMES = ['General Knowledge', 'Geography', 'History', 'Science', 'Nature', 'Sports', 'Music', 'Movies', 'TV Series',
  'Food & Drink', 'Art & Books', 'Tech & Business', 'Celebrities', 'Quotes', 'Acronyms'];
/* a bank: every broad theme with n questions at each level, a fandom theme, the host's own trivia, and one of the host's making */
function bankOf(n = 3, extra = []){
  const b = [];
  for(const t of THEMES.concat(['Friends', 'Know the Host'])) for(const l of ['easy', 'medium', 'hard', 'expert'])
    for(let i = 0; i < n; i++) b.push({ id:`${t}:${l}${i}`, type:'standard', theme:t, difficulty:l, question:`${t} ${l} ${i}?`, answer:`${t}${l}${i}` });
  for(const l of ['easy', 'medium', 'hard', 'expert']) b.push({ id:`mine:${l}`, type:'standard', theme:'Our Family', difficulty:l, question:'?', answer:'x', src:'manual' });
  return b.concat(extra);
}
function night(over = {}, opt = {}){
  const bank = opt.bank || bankOf(), used = opt.used || new Set(), never = opt.never || [];
  const D = Q.createDealer({ bank:() => bank, used:() => used, noRepeat:() => true, never:() => never, rng:opt.rng });
  const g = D.buildGame(Object.assign({ standard:false, rounds:0, themes:[], minis:['stakes'], teamA:{ name:'Owls' }, teamB:{ name:'Lions' } }, over));
  return { g, env:{ deal:D }, D };
}
const goes = (fx) => fx.filter(f => f.go).map(f => f.go);
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('stakes: the size of a bet comes from the leader\'s total (over 30; at least 1; from 10 up, to the nearest 5)', () => {
  assert.equal(Q.STAKES_DIVISOR, 30);
  assert.deepEqual([0, 4, 12, 9, 15, 24, 25, 84, 90, 104, 130, 172, 240, 300, 330, 450, 600].map(Q.stakesUnit), [1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 4, 6, 8, 10, 10, 15, 20]);
  assert.deepEqual(['easy', 'medium', 'hard', 'expert'].map(l => Q.stakesBet(8, l)), [0, 8, 16, 24]);
});

test('stakes: the deal — 3 rounds and a spare, 3 themes each, all different, each with one question at every level', () => {
  for(let seed = 1; seed < 40; seed++){
    const { g } = night({}, { rng:seeded(seed) }), s = g.stakesGame;
    assert.ok(g.hasStakes);
    assert.equal(s.rounds.length, 3); assert.equal(s.spare.length, 1); assert.equal(s.base, 3);
    const all = s.rounds.concat(s.spare).flatMap(R => R.themes);
    assert.equal(new Set(all).size, 12, 'twelve different themes');
    for(const R of s.rounds.concat(s.spare)) R.qs.forEach((set, k) => ['easy', 'medium', 'hard', 'expert'].forEach(l => {
      assert.equal(set[l].difficulty, l, 'a level is that level');
      assert.equal(set[l].theme, R.themes[k]);
    }));
    /* broad themes only, unless the night picked one; never the host's own trivia, never one of their own making */
    assert.ok(all.every(t => THEMES.includes(t)), all.join());
  }
});

test('stakes: the night\'s own themes join the broad ones (a fandom theme only when picked)', () => {
  let seen = false;
  for(let seed = 1; seed < 60 && !seen; seed++){
    const { g } = night({ themes:['Friends'] }, { rng:seeded(seed) });
    seen = g.stakesGame.rounds.some(R => R.themes.includes('Friends'));
    assert.ok(!g.stakesGame.rounds.some(R => R.themes.includes('Know the Host') || R.themes.includes('Our Family')));
  }
  assert.ok(seen, 'Friends turns up on a night that picked it');
});

test('stakes: unplayed questions first; a theme short of a level is skipped while others can fill all four', () => {
  /* Sports has played everything at Expert: with 14 others fresh, it never comes up */
  const bank = bankOf(1), used = new Set(bank.filter(q => q.theme === 'Sports' && q.difficulty === 'expert').map(q => q.id));
  for(let seed = 1; seed < 30; seed++){
    const { g } = night({}, { bank, used, rng:seeded(seed) });
    assert.ok(!g.stakesGame.rounds.concat(g.stakesGame.spare).some(R => R.themes.includes('Sports')));
  }
  /* everything played: the game still deals, from played questions */
  const all = new Set(bank.map(q => q.id));
  const { g } = night({}, { bank, used:all });
  assert.ok(g.hasStakes);
});

test('stakes: never a question the night already has, nor one that clashes with it', () => {
  const bank = bankOf(1);
  const never = [['Geography:easy0', 'History:expert0']];
  for(let seed = 1; seed < 30; seed++){
    const { g } = night({ standard:true, rounds:1, themes:['Geography'], difficulty:'easy' }, { bank, never, rng:seeded(seed) });
    const ids = g.stakesGame.rounds.concat(g.stakesGame.spare).flatMap(R => R.qs.flatMap(set => Object.values(set).map(q => q.id)));
    const round = g.rounds.flatMap(r => r.q.map(q => q.id));
    assert.ok(!ids.some(id => round.includes(id)), 'nothing from the round');
    if(round.includes('Geography:easy0')) assert.ok(!ids.includes('History:expert0'), 'nothing that clashes with it');
    assert.equal(new Set(ids).size, ids.length, 'no question twice');
  }
});

test('stakes: too small a bank for three rounds — the game is left out', () => {
  const bank = bankOf(1).filter(q => ['Geography', 'History', 'Music', 'Movies', 'Sports'].includes(q.theme));
  const { g } = night({}, { bank });
  assert.equal(g.hasStakes, false);
});

test('stakes: always the last game, after the Battle; then the end (or sudden death, if level)', () => {
  const bank = bankOf(4);
  const { g, env } = night({ standard:true, rounds:1, themes:['Geography'], difficulty:'easy', minis:['stakes', 'battle'] }, { bank });
  assert.ok(g.hasStakes && g.hasBattle);
  assert.ok(!(g.plan || []).some(p => p.key === 'stakes'), 'never between the rounds');
  /* the Battle's done: Secret Stakes comes next, not the end */
  g.r = 1; g.done.battle = false;
  let fx = Q.play(g, { type:'battle/build' }, env);
  assert.deepEqual(goes(fx), ['battleIntro']);
  fx = Q.play(g, { type:'battle/done' }, env);
  assert.deepEqual(goes(fx), ['stakesIntro']);
  /* the Battle can't be dealt: still Secret Stakes */
  const n2 = night({ minis:['stakes', 'battle'] }, { bank }); n2.g.battle = null;
  n2.env.deal.buildBattle = () => null;
  fx = Q.play(n2.g, { type:'battle/build' }, n2.env);
  assert.ok(goes(fx).includes('stakesIntro'));
});

test('stakes: the bet is fixed when the game starts, from the scoreboard then', () => {
  const { g, env } = night();
  g.teams[0].score = 84; g.teams[1].score = 51;
  const fx = Q.play(g, { type:'game/start' }, env);
  assert.deepEqual(goes(fx), ['stakesIntro']);
  assert.equal(g.stakesGame.unit, 3);
  g.teams[0].score = 300;                                   // (a change later doesn't move it)
  Q.play(g, { type:'stakes/start' }, env);
  assert.equal(g.stakesGame.unit, 3);
});

test('stakes: a round — both bets in, the questions go up; right wins the bet, wrong loses it, off the night\'s total', () => {
  const { g, env } = night();
  g.teams[0].score = 12; g.teams[1].score = 9;
  Q.play(g, { type:'game/start' }, env);
  assert.deepEqual(goes(Q.play(g, { type:'stakes/start' }, env)), ['stakesPick']);
  const s = g.stakesGame;
  assert.equal(s.unit, 1);
  /* a bet once, then locked in (a second tap changes nothing); a level or theme that isn't one is refused */
  assert.deepEqual(Q.play(g, { type:'stakes/pick', t:0, k:5, level:'hard' }, env), []);
  assert.deepEqual(Q.play(g, { type:'stakes/pick', t:0, k:1, level:'insane' }, env), []);
  assert.deepEqual(goes(Q.play(g, { type:'stakes/pick', t:0, k:1, level:'expert' }, env)), []);
  assert.deepEqual(Q.play(g, { type:'stakes/pick', t:0, k:2, level:'easy' }, env), []);
  assert.deepEqual(s.picks[0], { k:1, level:'expert' });
  assert.deepEqual(goes(Q.play(g, { type:'stakes/pick', t:1, k:1, level:'medium' }, env)), ['stakesQ']);
  /* Owls right on Expert: +3; Lions wrong on Medium: −1 */
  const fx = Q.play(g, { type:'stakes/verdict', ok:[true, false] }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [15, 8]);
  assert.deepEqual(s.net, [3, -1]);
  assert.deepEqual(goes(fx), ['stakesPick']);
  assert.equal(s.i, 1);
  assert.deepEqual(s.picks, [null, null]);
  assert.deepEqual(s.log[0].delta, [3, -1]);
  assert.deepEqual(s.log[0].bet, [3, 1]);
});

test('stakes: no bet by time-up is the safe one (Easy, the first theme); Easy wins and loses nothing', () => {
  const { g, env } = night();
  g.teams[0].score = 90; g.teams[1].score = 5;
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'stakes/start' }, env);
  Q.play(g, { type:'stakes/pick', t:1, k:2, level:'hard' }, env);
  assert.deepEqual(goes(Q.play(g, { type:'stakes/lock' }, env)), ['stakesQ']);
  assert.deepEqual(g.stakesGame.picks[0], { k:0, level:'easy', auto:true });
  Q.play(g, { type:'stakes/verdict', ok:[false, true] }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [90, 11]);   // (90/30 = 3 a bet: Hard is 6)
});

test('stakes: a total never goes below 0', () => {
  const { g, env } = night();
  g.teams[0].score = 120; g.teams[1].score = 2;
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'stakes/start' }, env);
  Q.play(g, { type:'stakes/pick', t:0, k:0, level:'medium' }, env);
  Q.play(g, { type:'stakes/pick', t:1, k:0, level:'expert' }, env);
  Q.play(g, { type:'stakes/verdict', ok:[false, false] }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [116, 0]);   // (120/30 = 4 a bet)
  assert.deepEqual(g.stakesGame.net, [-4, -2], 'only what really came off');
});

test('stakes: the same theme and level for both teams is the same question', () => {
  const { g, env } = night();
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'stakes/start' }, env);
  Q.play(g, { type:'stakes/pick', t:0, k:2, level:'hard' }, env);
  Q.play(g, { type:'stakes/pick', t:1, k:2, level:'hard' }, env);
  const R = g.stakesGame.rounds[0], q = (t) => R.qs[g.stakesGame.picks[t].k][g.stakesGame.picks[t].level];
  assert.equal(q(0).id, q(1).id);
});

test('stakes: Change question — three new themes, the bets cleared; none spare left, it says so', () => {
  const { g, env } = night();
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'stakes/start' }, env);
  const was = g.stakesGame.rounds[0].themes.join();
  Q.play(g, { type:'stakes/pick', t:0, k:0, level:'hard' }, env);
  const fx = Q.play(g, { type:'stakes/swap' }, env);
  assert.deepEqual(goes(fx), ['stakesPick']);
  assert.notEqual(g.stakesGame.rounds[0].themes.join(), was);
  assert.deepEqual(g.stakesGame.picks, [null, null]);
  assert.deepEqual(Q.play(g, { type:'stakes/swap' }, env), [{ toast:'No other themes left.' }]);
});

test('stakes: three rounds, then the summary, then the end; no 2 points for a winner, nothing to award', () => {
  const { g, env } = night();
  g.teams[0].score = 60; g.teams[1].score = 60;
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'stakes/start' }, env);
  let fx;
  for(let r = 0; r < 3; r++){
    Q.play(g, { type:'stakes/pick', t:0, k:0, level:'medium' }, env);
    Q.play(g, { type:'stakes/pick', t:1, k:1, level:'easy' }, env);
    fx = Q.play(g, { type:'stakes/verdict', ok:[true, true] }, env);
  }
  assert.deepEqual(goes(fx), ['stakesSummary']);
  assert.ok(g.stakesGame.done);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [66, 60]);    // three Mediums at 2 (60/30), nothing else
  assert.deepEqual(Q.play(g, { type:'stakes/verdict', ok:[true, true] }, env), [], 'nothing after the last round');
  fx = Q.play(g, { type:'stakes/done' }, env);
  assert.ok(fx.some(f => f.finalize));
  assert.equal(g.winner, 0);
});

test('stakes: tied after it — sudden death, as always', () => {
  const { g, env } = night();
  g.teams[0].score = 10; g.teams[1].score = 10;
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'stakes/start' }, env);
  for(let r = 0; r < 3; r++){ Q.play(g, { type:'stakes/lock' }, env); Q.play(g, { type:'stakes/verdict', ok:[false, false] }, env); }
  const fx = Q.play(g, { type:'stakes/done' }, env);
  assert.deepEqual(goes(fx), ['sudden']);
});

test('stakes: stakesResult and stakesOrder for any number of teams (3-8 use them too)', () => {
  const r = Q.stakesResult([80, 64, 10, 3], [{ level:'expert' }, { level:'easy' }, { level:'hard' }, { level:'medium' }], [false, true, true, false], 8);
  assert.deepEqual(r.bet, [24, 0, 16, 8]);
  assert.deepEqual(r.after, [56, 64, 26, 0]);
  assert.deepEqual(r.delta, [-24, 0, 16, -3]);
  /* last place first, up to the leader; tied teams, the later letter first */
  assert.deepEqual(Q.stakesOrder([80, 64, 10, 3]), [3, 2, 1, 0]);
  assert.deepEqual(Q.stakesOrder([5, 9, 5]), [2, 0, 1]);
});

test('stakes: the thin-bank note counts the themes that can still fill every level', () => {
  const bank = bankOf(1), used = new Set(bank.filter(q => THEMES.slice(0, 8).includes(q.theme)).map(q => q.id));
  const D = Q.createDealer({ bank:() => bank, used:() => used, noRepeat:() => true });
  const t = D.thinBank().find(x => x.key === 'stakes');
  assert.deepEqual(t, { key:'stakes', left:7, need:9 });
});
