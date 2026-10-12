/* node --test engine/  — the game's moves, played without any screen */
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./core.js');

/* a tiny game: just the two mini-games, no standard rounds */
function game(over){
  const bank = [];
  ['easy', 'medium'].forEach(l => { for(let i = 0; i < 12; i++) bank.push({ id:`flag:${l}${i}`, type:'flag', level:l, question:'F' + i }); });
  ['c-easy', 'd-easy'].forEach(l => { for(let i = 0; i < 10; i++) bank.push({ id:`dish:${l}${i}`, type:'dish', level:l, question:'D' + i, ings:['a — x', 'b — y', 'c — z'] }); });
  const D = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => true,
    ok:{ map:() => false, flag:q => q.type === 'flag', dish:q => q.type === 'dish' } });
  const g = D.buildGame(Object.assign({ standard:false, rounds:0, themes:[], minis:['flag', 'dish'],
    flagLevels:['easy', 'medium'], dishLevels:['c-easy', 'd-easy'],
    teamA:{ name:'Falafel' }, teamB:{ name:'Shawarma' } }, over));
  return g;
}
const types = (fx) => fx.map(f => Object.keys(f)[0] + ':' + Object.values(f)[0]);

test('flag: a 6–0 run ends early and pays the mini-game points', () => {
  const g = game();
  Q.play(g, { type:'flag/start' });
  let fx;
  for(let i = 0; i < 6; i++) fx = Q.play(g, { type:'flag/verdict', w:0 });
  assert.deepEqual(g.flagGame.wins, [6, 0]);
  assert.equal(g.flagGame.verdict.note, 'Decided with 4 flags to spare.');
  assert.equal(g.teams[0].score, g.miniPts);
  assert.ok(types(fx).includes('go:flagSummary'));
  assert.deepEqual(Q.play(g, { type:'flag/done' }), [{ next:true }]);
  assert.equal(g.done.flag, true);
});

test('flag: level after ten brings out a tie-breaker flag', () => {
  const g = game();
  Q.play(g, { type:'flag/start' });
  for(let i = 0; i < 10; i++) Q.play(g, { type:'flag/verdict', w:i % 2 });
  assert.equal(g.flagGame.tieLegs, 1);
  assert.equal(g.flagGame.qs.length, 11);
  const fx = Q.play(g, { type:'flag/verdict', w:'none' });
  assert.equal(g.flagGame.tieLegs, 2);                      // still level → another
  assert.ok(types(fx).includes('go:flagQ'));
});

test('dish with a host: wrong locks you out, the other team can still get it', () => {
  const g = game();
  Q.play(g, { type:'dish/start' });
  assert.deepEqual(types(Q.play(g, { type:'dish/buzz', w:0 })), ['timer:pause', 'sound:soft', 'render:true']);
  assert.deepEqual(Q.play(g, { type:'dish/buzz', w:1 }), []);           // someone is already answering
  const fx = Q.play(g, { type:'dish/wrong' });
  assert.deepEqual(g.dishGame.leg.out, [true, false]);
  assert.ok(types(fx).includes('timer:resume'));
  assert.deepEqual(Q.play(g, { type:'dish/buzz', w:0 }), []);           // one go each
  Q.play(g, { type:'dish/buzz', w:1 });
  Q.play(g, { type:'dish/right' });
  assert.deepEqual(g.dishGame.wins, [0, 1]);
});

test('dish without a host: written answers are checked in the order called', () => {
  const g = game(); g.hostless = true;
  Q.play(g, { type:'dish/start' });
  Q.play(g, { type:'dish/write', w:1 });
  const fx = Q.play(g, { type:'dish/write', w:0 });
  assert.ok(types(fx).includes('go:dishCheck'));
  assert.deepEqual(g.dishGame.leg.calls, [1, 0]);
  Q.play(g, { type:'dish/checkNo' });                                   // Shawarma, first, wrong
  Q.play(g, { type:'dish/checkYes' });                                  // Falafel, second, right
  assert.deepEqual(g.dishGame.wins, [1, 0]);
  /* out of time with nothing written: nobody */
  Q.play(g, { type:'dish/next' });
  Q.play(g, { type:'dish/timeUp' });
  assert.equal(g.dishGame.subs[1].winner, 'none');
});

test('dish: level after seven — one more, or a point each', () => {
  const g = game();
  Q.play(g, { type:'dish/start' });
  [0, 1, 0, 1, 0, 1].forEach(w => { Q.play(g, { type:'dish/buzz', w }); Q.play(g, { type:'dish/right' }); Q.play(g, { type:'dish/next' }); });
  Q.play(g, { type:'dish/timeUp' });
  assert.ok(types(Q.play(g, { type:'dish/next' })).includes('go:dishTie'));
  Q.play(g, { type:'dish/more' });
  assert.equal(g.dishGame.tieLegs, 1);
  Q.play(g, { type:'dish/timeUp' });
  Q.play(g, { type:'dish/next' });
  Q.play(g, { type:'dish/stop' });
  assert.deepEqual(g.dishGame.award, [1, 1]);
  assert.deepEqual(g.teams.map(t => t.score), [1, 1]);
  assert.deepEqual(Q.play(g, { type:'dish/stop' }), []);                // only once
});

test('unknown moves are refused loudly', () => {
  assert.throws(() => Q.play(game(), { type:'nope' }), /Unknown move/);
});
