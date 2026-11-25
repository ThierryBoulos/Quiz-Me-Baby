/* node --test engine/comebackTwo.test.js — The Comeback in the two-team night (the owner, 17 Nov): when it comes up
   (once, at the night's middle, only in a massacre, not when it's off), how it plays (three questions, all right or
   nothing; the host's skip), the score after, and that the night carries on where it was going */
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./core.js');

const THEMES = ['Movies', 'Music', 'Geography', 'History'];
function setup(over){
  const bank = [];
  THEMES.concat(['Science', 'Sports']).forEach(t => ['easy', 'medium'].forEach(d => { for(let i = 0; i < 8; i++) bank.push({ id:`${t}:${d}${i}`, type:'standard', theme:t, difficulty:d, question:`${t} ${d} ${i}?`, answer:`A${i}` }); }));
  for(let i = 0; i < 12; i++) bank.push({ id:'flag:' + i, type:'flag', level:'easy', question:'F' + i });
  const used = [];
  const D = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => true, ok:{ flag:q => q.type === 'flag' } });
  const g = D.buildGame(Object.assign({ standard:true, rounds:4, themes:THEMES, difficulty:'easy+medium', minis:[], flagLevels:['easy'],
    teamA:{ name:'Lions' }, teamB:{ name:'Owls' } }, over));
  const env = { deal:D, settings:{} };
  const play = (move) => { const fx = Q.play(g, move, env); fx.forEach(f => { if(f.used) used.push(f.used.id); }); return fx; };
  /* a round played out (its points set by hand), then Next from its score */
  const round = (a, b) => { g.teams[0].score += a; g.teams[1].score += b; g.rounds[g.r].done = true; return play({ type:'round/next' }); };
  return { g, env, play, round, used, bank };
}
const goes = (fx) => fx.filter(f => f.go).map(f => f.go);
const scores = (g) => g.teams.map(t => t.score);

test('comeback, two teams: it comes up at the middle of a massacre, and only there', () => {
  const { g, round } = setup();
  assert.deepEqual(goes(round(3, 0)), ['roundIntro']);                 // 1 of 4 played: not the middle yet
  assert.equal(g.comeback, undefined);
  assert.deepEqual(goes(round(3, 0)), ['comebackIntro']);              // 2 of 4, 6-0, 4 points still to win: a massacre
  assert.deepEqual(g.comeback.teams, [1]);
  assert.deepEqual(g.comeback.before, [6, 0]);
  assert.deepEqual(g.comeback.target, [null, 5]);                      // 85% of 6, and never level with the leader
  assert.equal(g.comeback.qs.length, 3); assert.equal(g.comeback.spare.length, 2);
  assert.equal(g.r, 1);                                                // the night hasn't moved on yet
});

test('comeback, two teams: 4-0 on a short night is no massacre (at least 5 behind)', () => {
  const { g, round } = setup();
  round(2, 0);
  assert.deepEqual(goes(round(2, 0)), ['roundIntro']);                 // 4-0 at the middle: the night carries on
  assert.equal(g.comeback, undefined);
});

test('comeback, two teams: its questions are easy, none of tonight\'s, none from a theme still to play', () => {
  const { g, round } = setup();
  round(3, 0); round(3, 0);
  const tonight = new Set(); g.rounds.forEach(r => r.q.forEach(q => tonight.add(q.id)));
  const toPlay = g.rounds.filter(r => !r.done).map(r => r.theme);
  g.comeback.qs.concat(g.comeback.spare).forEach(q => {
    assert.equal(q.type, 'standard'); assert.equal(q.difficulty, 'easy');
    assert.ok(!tonight.has(q.id)); assert.ok(toPlay.indexOf(q.theme) < 0, q.theme);
  });
});

test('comeback, two teams: not a massacre at the middle, no comeback then or later', () => {
  const { g, round } = setup();
  round(1, 0);
  assert.deepEqual(goes(round(1, 1)), ['roundIntro']);                 // 2-1 at the middle
  assert.equal(g.comebackAsked, true);
  assert.deepEqual(goes(round(6, 0)), ['roundIntro']);                 // 8-1 later: the check was made already
  assert.equal(g.comeback, undefined);
});

test('comeback, two teams: off in Setup, never', () => {
  const { g, round } = setup({ comeback:false });
  round(2, 0);
  assert.deepEqual(goes(round(2, 0)), ['roundIntro']);
  assert.equal(g.comeback, undefined);
});

test('comeback, two teams: not with fewer than 2 steps still to play', () => {
  /* 3 rounds: the middle is after the 2nd, with one left */
  const three = setup({ rounds:3, themes:THEMES.slice(0, 3) });
  three.round(2, 0);
  assert.deepEqual(goes(three.round(2, 0)), ['roundIntro']);
  assert.equal(three.g.comeback, undefined);
  /* 2 rounds: the middle is after the 1st, with one left */
  const two = setup({ rounds:2, themes:THEMES.slice(0, 2) });
  assert.deepEqual(goes(two.round(4, 0)), ['roundIntro']);
  assert.equal(two.g.comeback, undefined);
});

test('comeback, two teams: the mini-games, the Battle and Secret Stakes count as steps', () => {
  /* 4 rounds and Guess the Flag (after round 2): 5 steps, the middle after the 3rd (the flags), 2 rounds left */
  const { g, round, play } = setup({ minis:['flag'] });
  round(3, 0);
  assert.deepEqual(goes(round(3, 0)), ['flagIntro']);                  // 2 of 5: not yet
  g.flagGame.verdict = { winner:0, needsHost:false, note:'' };
  assert.deepEqual(goes(play({ type:'flag/done' })), ['comebackIntro']);
  assert.deepEqual(g.comeback.before, [6, 0]);
  assert.deepEqual(g.comeback.target, [null, 5]);
});

test('comeback, two teams: all three right, and the team behind moves up as the result comes up', () => {
  const { g, round, play, used } = setup();
  round(6, 0); round(6, 1);                                            // 12-1
  assert.deepEqual(g.comeback.target, [null, 10]);
  const first = g.comeback.qs.map(q => q.id);
  assert.deepEqual(goes(play({ type:'comeback/start' })), ['comebackQ']);
  assert.deepEqual(goes(play({ type:'comeback/verdict', ok:true })), ['comebackQ']); assert.equal(g.comeback.i, 1);
  assert.deepEqual(goes(play({ type:'comeback/verdict', ok:true })), ['comebackQ']); assert.equal(g.comeback.i, 2);
  assert.deepEqual(scores(g), [12, 1]);                                // not before the result
  assert.deepEqual(goes(play({ type:'comeback/verdict', ok:true })), ['comebackSummary']);
  assert.equal(g.comeback.made, true);
  assert.deepEqual(g.comeback.after, [12, 10]);
  assert.deepEqual(scores(g), [12, 10]);
  assert.deepEqual(used, first);                                       // each question played is marked used, as it comes up
  assert.deepEqual(play({ type:'comeback/verdict', ok:true }), []);    // (a second tap changes nothing)
  /* Next: the night carries on where it was going (round 3), and the comeback never comes back */
  assert.deepEqual(goes(play({ type:'comeback/done' })), ['roundIntro']);
  assert.equal(g.r, 2);
  assert.deepEqual(goes(round(0, 0)), ['roundIntro']);
  assert.equal(g.r, 3);
});

for(const miss of [0, 1, 2]){
  test(`comeback, two teams: a miss on question ${miss + 1} ends it at once, and nothing moves`, () => {
    const { g, round, play } = setup();
    round(6, 0); round(6, 1);
    play({ type:'comeback/start' });
    for(let i = 0; i < miss; i++) assert.deepEqual(goes(play({ type:'comeback/verdict', ok:true })), ['comebackQ']);
    /* (no answer in time is the same call: not right) */
    assert.deepEqual(goes(play({ type:'comeback/verdict', ok:miss === 1 ? undefined : false })), ['comebackSummary']);
    assert.equal(g.comeback.made, false);
    assert.equal(g.comeback.log.length, miss + 1);
    assert.deepEqual(scores(g), [12, 1]);
    assert.deepEqual(goes(play({ type:'comeback/done' })), ['roundIntro']);
    assert.equal(g.r, 2);
  });
}

test('comeback, two teams: the host skips it, and the night goes where it would have', () => {
  const a = setup(), b = setup({ comeback:false });
  a.round(6, 0); b.round(6, 0);
  assert.deepEqual(goes(a.round(6, 1)), ['comebackIntro']);
  const without = b.round(6, 1);
  assert.deepEqual(a.play({ type:'comeback/skip' }), without);         // the very step a night with no comeback takes
  assert.equal(a.g.r, b.g.r);
  assert.deepEqual(scores(a.g), [12, 1]);
  assert.equal(a.g.comeback.skipped, true);
  assert.deepEqual(a.play({ type:'comeback/start' }), []);             // it never happens that night
  assert.deepEqual(goes(a.round(0, 0)), ['roundIntro']);
});

test('comeback, two teams: after it, the same next step as a night without it (a mini-game owed, then the Battle)', () => {
  /* 2 rounds, the flags after round 1, the Battle last: 4 steps, the middle after the flags */
  const cfg = { rounds:2, themes:THEMES.slice(0, 2), minis:['flag', 'battle'] };
  const a = setup(cfg), b = setup(Object.assign({ comeback:false }, cfg));
  for(const x of [a, b]){ assert.deepEqual(goes(x.round(9, 0)), ['flagIntro']); x.g.flagGame.verdict = { winner:0, needsHost:false, note:'' }; }
  assert.deepEqual(goes(a.play({ type:'flag/done' })), ['comebackIntro']);
  assert.deepEqual(goes(b.play({ type:'flag/done' })), ['roundIntro']);
  a.play({ type:'comeback/start' });
  a.play({ type:'comeback/verdict', ok:false });
  assert.deepEqual(goes(a.play({ type:'comeback/done' })), ['roundIntro']);
  assert.equal(a.g.r, 1); assert.equal(b.g.r, 1);
  /* the Battle keeps clear of the comeback's question */
  const asked = a.g.comeback.log.map(e => e.q.id);
  assert.deepEqual(goes(a.round(0, 0)), ['battleIntro']);
  a.g.battle.qs.forEach(set => set.forEach(q => assert.ok(asked.indexOf(q.id) < 0)));
});

test('comeback, two teams: Change question swaps in a spare, until there are none', () => {
  const { g, round, play } = setup();
  round(6, 0); round(6, 1);
  play({ type:'comeback/start' });
  const was = g.comeback.qs[0].id, spare = g.comeback.spare.map(q => q.id);
  const fx = play({ type:'comeback/swap' });
  assert.deepEqual(goes(fx), ['comebackQ']);
  assert.equal(g.comeback.qs[0].id, spare[0]); assert.notEqual(g.comeback.qs[0].id, was);
  play({ type:'comeback/swap' });
  assert.deepEqual(play({ type:'comeback/swap' }), [{ toast:'No other question left.' }]);
  assert.equal(g.comeback.qs[0].id, spare[1]);
});

test('comeback, two teams: scores put right by hand during it are kept (it adds what it gives)', () => {
  const { g, round, play } = setup();
  round(6, 0); round(6, 1);
  play({ type:'comeback/start' });
  g.teams[0].score = 13;                                               // the host sets the scores meanwhile
  play({ type:'comeback/verdict', ok:true }); play({ type:'comeback/verdict', ok:true }); play({ type:'comeback/verdict', ok:true });
  assert.deepEqual(scores(g), [13, 10]);
});
