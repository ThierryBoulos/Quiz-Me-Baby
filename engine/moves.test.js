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

/* ---- Map, Closest To Wins, Don't Say the Same ---- */
function game2(){
  const bank = [];
  ['easy', 'medium', 'hard'].forEach(l => { for(let i = 0; i < 4; i++) bank.push({ id:`map:${l}${i}`, type:'map', level:l, question:'M' }); });
  ['Music', 'Movies', 'Sports', 'Food'].forEach(t => { for(let i = 0; i < 4; i++) bank.push({ id:`c:${t}${i}`, type:'closest', theme:t, answer:String(100 * (i + 1)) }); });
  for(let i = 0; i < 14; i++) bank.push({ id:'s' + i, type:'saysame', question:'P' + i, pool:i < 2 ? ['x', 'y'] : ['a', 'b', 'c', 'd'] });
  const used = new Set();
  const deal = Q.createDealer({ bank:() => bank, used:() => used, noRepeat:() => true,
    ok:{ map:q => q.type === 'map', flag:() => false, dish:() => false } });
  const g = deal.buildGame({ standard:false, rounds:0, themes:[], minis:['closest', 'saysame', 'map'],
    teamA:{ name:'A' }, teamB:{ name:'B' } });
  return { g, env:{ deal } };
}

test('map: level after three goes to the table, "stop" pays a point each', () => {
  const { g, env } = game2();
  Q.play(g, { type:'map/start' }, env);
  Q.play(g, { type:'map/hint' }, env);
  assert.equal(Object.keys(g.mapGame.hints).length, 1);
  Q.play(g, { type:'map/verdict', w:0 }, env);
  Q.play(g, { type:'map/verdict', w:1 }, env);
  const fx = Q.play(g, { type:'map/verdict', w:'none' }, env);
  assert.ok(types(fx).includes('go:mapTie'));
  Q.play(g, { type:'map/stop' }, env);
  assert.deepEqual(g.teams.map(t => t.score), [1, 1]);
});

test('map: a swap draws a map that is not already in play', () => {
  const { g, env } = game2();
  Q.play(g, { type:'map/start' }, env);
  const before = g.mapGame.qs.map(q => q.id);
  Q.play(g, { type:'map/swap' }, env);
  assert.ok(!before.includes(g.mapGame.qs[0].id));
});

test('closest: guesses add up the gap; level after seven brings a tie-breaker leg', () => {
  const { g, env } = game2();
  Q.play(g, { type:'closest/start' }, env);
  const ans = Number(g.mini.qs[0].answer);
  Q.play(g, { type:'closest/win', w:0, gA:ans - 3, gB:ans + 10 }, env);
  assert.deepEqual(g.mini.delta, [3, 10]);
  for(let i = 1; i < 7; i++) Q.play(g, { type:'closest/win', w:i % 2 ? 1 : 0 }, env);   // 4–3 to A... make it level:
  assert.ok(g.mini.done);
  const { g:g2, env:e2 } = game2();
  Q.play(g2, { type:'closest/start' }, e2);
  for(let i = 0; i < 7; i++) Q.play(g2, { type:'closest/win', w:i === 6 ? 'tie' : i % 2 }, e2);
  assert.equal(g2.mini.tieLegs, 1);
  const fx = Q.play(g2, { type:'closest/win', w:1 }, e2);
  assert.equal(g2.mini.verdict.winner, 1);
  assert.equal(g2.mini.verdict.note, 'Settled by a tie-breaker leg.');
  assert.ok(types(fx).includes('go:miniSummary'));
  assert.deepEqual(Q.play(g2, { type:'closest/done' }, e2), [{ next:true }]);
  assert.equal(g2.miniPlayed, true);
});

test('say-same: a tie-breaker prompt gets its secret word as it comes in', () => {
  const { g, env } = game2();
  Q.play(g, { type:'say/start' }, env);
  for(let i = 0; i < 9; i++) Q.play(g, { type:'say/verdict', w:'tie' }, env);
  assert.equal(g.saySame.tieLegs, 1);
  const tb = g.saySame.qs[9];
  assert.ok(tb.pool.includes(tb.answer));
});

/* ---- the Auction, the Battle, sudden death ---- */
function game3(over){
  const bank = [];
  for(let i = 0; i < 5; i++) bank.push({ id:'a' + i, type:'auction', question:'Cat ' + i });
  ['easy', 'medium'].forEach(d => { for(let i = 0; i < 16; i++) bank.push({ id:`q-${d}${i}`, type:'standard', theme:'Music', difficulty:d, question:'Q', answer:'A' }); });
  const deal = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => true });
  const g = deal.buildGame(Object.assign({ standard:false, rounds:0, themes:['Music'], minis:['auction', 'battle'],
    teamA:{ name:'A' }, teamB:{ name:'B' } }, over));
  return { g, env:{ deal } };
}

test('auction: bid up, deliver, and the bidder takes the leg; best of three pays once', () => {
  const { g, env } = game3();
  Q.play(g, { type:'auction/build' }, env);
  assert.equal(g.auction.n, 3);
  assert.deepEqual(Q.play(g, { type:'auction/pass' }, env), [{ toast:'Somebody has to open first.' }]);
  Q.play(g, { type:'auction/raise', n:3 }, env);                       // A opens with 3
  assert.deepEqual(Q.play(g, { type:'auction/raise', n:3 }, env), [{ toast:'Has to beat 3.' }]);
  Q.play(g, { type:'auction/raise', n:4 }, env);                       // B raises to 4
  Q.play(g, { type:'auction/pass' }, env);                             // A folds — B must deliver 4
  for(let i = 0; i < 4; i++) Q.play(g, { type:'auction/tick' }, env);  // the 4th settles it
  assert.deepEqual(g.auction.wins, [0, 1]);
  Q.play(g, { type:'auction/nextLeg' }, env);
  Q.play(g, { type:'auction/raise', n:2 }, env);                       // B opens leg 2 (alternates)
  Q.play(g, { type:'auction/pass' }, env);
  Q.play(g, { type:'auction/resolve' }, env);                          // out of time, 0 of 2
  assert.deepEqual(g.auction.wins, [1, 1]);
  Q.play(g, { type:'auction/nextLeg' }, env);
  Q.play(g, { type:'auction/raise', n:1 }, env);
  Q.play(g, { type:'auction/pass' }, env);
  Q.play(g, { type:'auction/tick' }, env);
  const fx = Q.play(g, { type:'auction/nextLeg' }, env);
  assert.ok(types(fx).includes('go:auctionResult'));
  assert.equal(g.auction.winner, 0);
  assert.equal(g.teams[0].score, g.miniPts);
});

test('battle: level after both captains goes to a tie-breaker; "done" sends a level night to sudden death', () => {
  const { g, env } = game3({ minis:['battle'] });
  Q.play(g, { type:'battle/build' }, env);
  for(let cap = 0; cap < 2; cap++){
    Q.play(g, { type:'battle/start' }, env);
    for(let i = 0; i < g.battle.n; i++) Q.play(g, { type:'battle/mark', got:i < 5 }, env);
  }
  assert.equal(g.battle.stage, 'tie');
  Q.play(g, { type:'battle/tbWin', w:'none' }, env);
  assert.equal(g.battle.tbRounds, 2);
  Q.play(g, { type:'battle/tbWin', w:1 }, env);
  assert.equal(g.teams[1].score, g.miniPts);
  g.teams[0].score = g.teams[1].score;                                 // make the night level
  const fx = Q.play(g, { type:'battle/done' }, env);
  assert.ok(types(fx).includes('go:sudden'));
  assert.equal(g.sdRounds, 1);
  const win = Q.play(g, { type:'sudden/win', w:0 }, env);
  assert.deepEqual(win, [{ finalize:true }]);
  assert.equal(g.winner, 0);
});

test('end of the night: a clear winner finalizes straight away', () => {
  const { g, env } = game3();
  g.teams[1].score = 3;
  assert.deepEqual(Q.play(g, { type:'game/end' }, env), [{ finalize:true }]);
  assert.equal(g.winner, 1);
});
