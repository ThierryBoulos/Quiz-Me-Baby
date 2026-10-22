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
  assert.deepEqual(Q.play(g, { type:'flag/done' }), [{ go:'dishIntro' }]);   // next in the running order
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
  assert.deepEqual(Q.play(g2, { type:'closest/done' }, e2), [{ go:'sayIntro' }]);
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
  assert.equal(g.teams[1].score, g.battlePts);                         // the Battle pays double
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

/* ---- the standard rounds and the running order ---- */
function game4(over){
  const bank = [];
  ['easy', 'medium', 'hard'].forEach(d => { for(let i = 0; i < 8; i++) bank.push({ id:`m-${d}${i}`, type:'standard', theme:'Music', difficulty:d, use_with:'m' + d + (i >> 1), question:'Q' + i, answer:'A' }); });
  for(let i = 0; i < 9; i++) bank.push({ id:'c' + i, type:'closest', theme:'Music', answer:'10' });
  const deal = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => true });
  const g = deal.buildGame(Object.assign({ rounds:2, themes:['Music'], difficulty:'medium', minis:['closest'],
    teamA:{ name:'A' }, teamB:{ name:'B' } }, over));
  return { g, env:{ deal, settings:{ alternateFirst:false } } };
}

test('round: right scores, wrong goes to a steal, a steal scores the other team', () => {
  const { g, env } = game4();
  assert.deepEqual(Q.play(g, { type:'game/start' }, env), [{ go:'roundIntro' }]);
  Q.play(g, { type:'round/armDbl', i:0 }, env);
  Q.play(g, { type:'round/begin' }, env);
  assert.equal(g.teams[0].ll.dbl, false);                               // spent at Start
  Q.play(g, { type:'round/judge', v:true }, env);
  assert.equal(g.teams[0].score, 2);                                    // doubled
  Q.play(g, { type:'round/afterAnswer' }, env);
  assert.equal(g.seat, 1);
  const fx = Q.play(g, { type:'round/judge', v:false }, env);
  assert.ok(types(fx).includes('go:steal'));
  Q.play(g, { type:'round/judgeSteal', v:true }, env);
  assert.deepEqual(g.teams.map(t => t.score), [3, 0]);
  assert.deepEqual(types(Q.play(g, { type:'round/afterAnswer' }, env)), ['go:roundScore']);
});

test('round: no host means no steal', () => {
  const { g, env } = game4(); g.hostless = true;
  Q.play(g, { type:'round/begin' }, env);
  assert.ok(types(Q.play(g, { type:'round/judge', v:false }, env)).includes('go:answer'));
});

test('round: a lifeline is spent once; with double armed, only one extra', () => {
  const { g, env } = game4();
  Q.play(g, { type:'round/armDbl', i:0 }, env);
  Q.play(g, { type:'round/begin' }, env);
  assert.ok(types(Q.play(g, { type:'round/lifeline', key:'dip', i:0 }, env)).includes('lifeline:dip'));
  assert.deepEqual(Q.play(g, { type:'round/lifeline', key:'friend', i:0 }, env), [{ toast:'Double points is armed — one extra lifeline only.' }]);
  assert.deepEqual(Q.play(g, { type:'round/lifeline', key:'dip', i:0 }, env), []);   // already gone
});

test('running order: round 1, its mini-game, round 2, the end', () => {
  const { g, env } = game4();
  assert.deepEqual(g.plan, [{ key:'closest', after:0 }]);
  Q.play(g, { type:'round/begin' }, env);
  assert.deepEqual(Q.play(g, { type:'round/next' }, env), [{ go:'miniIntro' }]);  // owed after round 1
  g.mini.verdict = { needsHost:false };
  assert.deepEqual(Q.play(g, { type:'closest/done' }, env), [{ go:'roundIntro' }]);
  assert.equal(g.r, 1);
  g.teams[0].score = 1;
  assert.deepEqual(Q.play(g, { type:'round/next' }, env), [{ finalize:true }]);
});

/* ---- decided early: keep playing for fun, or stop there ---- */
test('closest: nobody answering scores nobody', () => {
  const { g, env } = game2();
  Q.play(g, { type:'closest/start' }, env);
  const fx = Q.play(g, { type:'closest/win', w:'none' }, env);
  assert.deepEqual(g.mini.wins, [0, 0]);
  assert.ok(types(fx).includes('toast:Nobody answered — no point.'));
});

test('closest decided early: "for fun" pays now, plays on, and the extra legs never change the score', () => {
  const { g, env } = game2();
  Q.play(g, { type:'closest/start' }, env);
  const base = g.mini.base;
  let i = 0;
  while(!Q.decidedEarly(g, 'closest')) { Q.play(g, { type:'closest/win', w:0 }, env); i++; }
  assert.ok(i < base);
  const d = Q.decidedEarly(g, 'closest');
  assert.equal(d.winner, 0);
  assert.equal(d.spare, base - i);
  const fx = Q.play(g, { type:'mini/fun', key:'closest' }, env);
  assert.ok(types(fx).includes('go:miniQ'));
  assert.equal(g.teams[0].score, g.miniPts);                       // paid at once
  assert.equal(Q.decidedEarly(g, 'closest'), null);                // asked once
  let last;
  while(g.mini.i < base) last = Q.play(g, { type:'closest/win', w:1 }, env);
  assert.ok(types(last).includes('go:miniSummary'));
  assert.equal(g.mini.wins[1], base - i);                          // the fun legs count on the mini-game's board…
  assert.equal(g.teams[0].score, g.miniPts);                       // …never on the night's score
  assert.equal(g.teams[1].score, 0);
  assert.equal(g.mini.verdict.winner, 0);
});

test('flag decided early: "stop here" goes to the summary, paid once', () => {
  const g = game();
  Q.play(g, { type:'flag/start' });
  for(let i = 0; i < 6; i++) Q.play(g, { type:'flag/verdict', w:0 });
  assert.ok(Q.decidedEarly(g, 'flag'));
  const fx = Q.play(g, { type:'mini/stop', key:'flag' });
  assert.ok(types(fx).includes('go:flagSummary'));
  assert.equal(g.teams[0].score, g.miniPts);
});

test('flag decided early: "for fun" plays the remaining flags, then the summary', () => {
  const g = game();
  Q.play(g, { type:'flag/start' });
  for(let i = 0; i < 6; i++) Q.play(g, { type:'flag/verdict', w:0 });
  Q.play(g, { type:'mini/fun', key:'flag' });
  let fx;
  for(let i = 0; i < 4; i++) fx = Q.play(g, { type:'flag/verdict', w:1 });
  assert.ok(types(fx).includes('go:flagSummary'));
  assert.deepEqual(g.flagGame.wins, [6, 4]);
  assert.equal(g.teams[0].score, g.miniPts);
  assert.equal(g.teams[1].score, 0);
});

/* ---- no host: the same answer stolen goes back; an appeal ---- */
function roundGame(){
  const bank = [];
  ['Music', 'Movies'].forEach(t => { for(let i = 0; i < 8; i++) bank.push({ id:`${t}${i}`, type:'standard', theme:t, difficulty:'medium', use_with:`${t}${i >> 1}`, question:'Q', answer:'A' }); });
  const D = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => false, ok:{ map:() => false, flag:() => false, dish:() => false } });
  const g = D.buildGame({ rounds:2, themes:['Music', 'Movies'], difficulty:'medium', minis:[], teamA:{ name:'A' }, teamB:{ name:'B' } });
  const env = { deal:D, settings:{} };
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'round/begin' }, env);
  return { g, env };
}
test('steal with the first team\'s own answer: the point goes back to them', () => {
  const { g, env } = roundGame();
  Q.play(g, { type:'round/judge', v:false }, env);
  Q.play(g, { type:'round/judgeSteal', v:true, back:true }, env);
  assert.equal(g.teams[0].score, 1);
  assert.equal(g.teams[1].score, 0);
});
test('appeal agreed after a steal: the point moves to the first team; once only', () => {
  const { g, env } = roundGame();
  Q.play(g, { type:'round/judge', v:false }, env);
  Q.play(g, { type:'round/judgeSteal', v:true }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [0, 1]);
  Q.play(g, { type:'round/appeal', ok:true }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [1, 0]);
  Q.play(g, { type:'round/appeal', ok:true }, env);                 // no second go
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [1, 0]);
});
test('appeal turned down: nothing changes', () => {
  const { g, env } = roundGame();
  Q.play(g, { type:'round/judge', v:false }, env);
  Q.play(g, { type:'round/judgeSteal', v:false }, env);
  Q.play(g, { type:'round/appeal', ok:false }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [0, 0]);
  assert.equal(g.rounds[0].res[0].appealed, true);
});

/* ---- contests (Party): a call changed on the answer card, the score moves by the difference ---- */
test('contest: the first team\'s WRONG turned RIGHT after a steal scored: the point moves over', () => {
  const { g, env } = roundGame();
  Q.play(g, { type:'round/judge', v:false }, env);
  Q.play(g, { type:'round/judgeSteal', v:true }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [0, 1]);
  Q.play(g, { type:'round/rule', line:'first', v:true }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [1, 0]);
  assert.deepEqual(g.rounds[0].pts, [1, 0]);
  assert.equal(g.rounds[0].res[0].stolen, false);
});
test('contest: a steal turned RIGHT, then a steal turned WRONG', () => {
  const { g, env } = roundGame();
  Q.play(g, { type:'round/judge', v:false }, env);
  Q.play(g, { type:'round/judgeSteal', v:false }, env);
  Q.play(g, { type:'round/rule', line:'steal', v:true }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [0, 1]);
  Q.play(g, { type:'round/rule', line:'steal', v:false }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [0, 0]);
});
test('contest: the first team\'s RIGHT turned WRONG with no steal played: a steal on a new question', () => {
  const { g, env } = roundGame();
  const first = g.rounds[0].q[0];
  Q.play(g, { type:'round/judge', v:true }, env);
  assert.equal(g.teams[0].score, 1);
  Q.play(g, { type:'round/rule', line:'first', v:false }, env);
  assert.equal(g.teams[0].score, 0);
  const fx = Q.play(g, { type:'round/freshSteal' }, env);
  assert.ok(types(fx).includes('go:steal'));
  const q = g.rounds[0].q[0];
  assert.notEqual(q.id, first.id);
  assert.equal(q.theme, first.theme);
  assert.ok(!g.rounds.some((r) => r.q.some((x, i) => x.id === q.id && !(r === g.rounds[0] && i === 0))), 'not a question already in the game');
  Q.play(g, { type:'round/judgeSteal', v:true }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [0, 1]);
  assert.deepEqual(Q.play(g, { type:'round/freshSteal' }, env), []);       // once per question
});
test('contest: no fresh steal once the steal has been played', () => {
  const { g, env } = roundGame();
  Q.play(g, { type:'round/judge', v:false }, env);
  Q.play(g, { type:'round/judgeSteal', v:true, back:true }, env);     // same answer as theirs: the point went back
  Q.play(g, { type:'round/rule', line:'first', v:false }, env);
  assert.deepEqual([g.teams[0].score, g.teams[1].score], [0, 0]);
  assert.deepEqual(Q.play(g, { type:'round/freshSteal' }, env), []);
});
test('contest: double points moves as double', () => {
  const bank = [];
  ['Music', 'Movies'].forEach(t => { for(let i = 0; i < 8; i++) bank.push({ id:`${t}${i}`, type:'standard', theme:t, difficulty:'medium', use_with:`${t}${i >> 1}`, question:'Q', answer:'A' }); });
  const D = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => false, ok:{ map:() => false, flag:() => false, dish:() => false } });
  const g = D.buildGame({ rounds:2, themes:['Music', 'Movies'], difficulty:'medium', minis:[], teamA:{ name:'A' }, teamB:{ name:'B' } });
  const env = { deal:D, settings:{} };
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'round/armDbl', i:0 }, env); Q.play(g, { type:'round/begin' }, env);
  Q.play(g, { type:'round/judge', v:false }, env);
  Q.play(g, { type:'round/judgeSteal', v:false }, env);
  Q.play(g, { type:'round/rule', line:'first', v:true }, env);
  assert.equal(g.teams[0].score, 2);
});
test('contest: dish leg winner changed, and a leg played again with a new dish', () => {
  const g = game();
  Q.play(g, { type:'dish/start' });
  Q.play(g, { type:'dish/buzz', w:0 }); Q.play(g, { type:'dish/right' });
  assert.deepEqual(g.dishGame.wins, [1, 0]);
  Q.play(g, { type:'dish/rule', w:'none' });
  assert.deepEqual(g.dishGame.wins, [0, 0]);
  Q.play(g, { type:'dish/rule', w:1 });
  assert.deepEqual(g.dishGame.wins, [0, 1]);
  const before = g.dishGame.qs[g.dishGame.i].id, subs = g.dishGame.subs.length;
  const fx = Q.play(g, { type:'dish/replay' });
  assert.ok(types(fx).includes('go:dishQ'));
  assert.deepEqual(g.dishGame.wins, [0, 0]);
  assert.equal(g.dishGame.subs.length, subs - 1);
  assert.notEqual(g.dishGame.qs[g.dishGame.i].id, before);
});
test('contest: the Battle stops for a review before it is settled; a changed call moves the score', () => {
  const { g, env } = game3({ minis:['battle'] });
  Q.play(g, { type:'battle/build' }, env);
  let fx;
  for(let cap = 0; cap < 2; cap++){
    Q.play(g, { type:'battle/start' }, env);
    for(let i = 0; i < g.battle.n; i++) fx = Q.play(g, { type:'battle/mark', got:i < 5, said:'x' + i, review:true }, env);
  }
  assert.ok(types(fx).includes('go:battleReview'));
  assert.equal(g.battle.log[1][0].said, 'x0');
  Q.play(g, { type:'battle/rule', cap:0, i:9, got:true }, env);       // A's last answer was right after all
  assert.deepEqual(g.battle.score, [6, 5]);
  Q.play(g, { type:'battle/rule', cap:0, i:9, got:true }, env);       // no change twice
  assert.deepEqual(g.battle.score, [6, 5]);
  fx = Q.play(g, { type:'battle/reviewDone' }, env);
  assert.ok(types(fx).includes('go:battleSummary'));
  assert.equal(g.battle.winner, 0);
  assert.deepEqual(Q.play(g, { type:'battle/rule', cap:1, i:0, got:false }, env), []);   // only at the review
});
test('contest: a sudden-death call changed on the final screen moves the win, or plays another question', () => {
  const { g, env } = game3();
  Q.play(g, { type:'game/end' }, env);
  assert.deepEqual(Q.play(g, { type:'sudden/rule', w:1 }, env), [{ finalize:true }]);  // B's WRONG was right: they win
  assert.equal(g.winner, 1);
  assert.deepEqual(g.teams.map(t => t.score), [0, 1]);
  assert.deepEqual(Q.play(g, { type:'sudden/rule', w:1 }, env), []);                  // no change twice
  Q.play(g, { type:'sudden/rule', w:0 }, env);                                         // it was A, first
  assert.deepEqual(g.teams.map(t => t.score), [1, 0]);
  const q = g.sd.q.id;
  const fx = Q.play(g, { type:'sudden/rule', w:'none' }, env);                         // A's RIGHT was wrong
  assert.ok(types(fx).includes('go:sudden'));
  assert.deepEqual(g.teams.map(t => t.score), [0, 0]);
  assert.equal(g.winner, null);
  assert.notEqual(g.sd.q.id, q);
  assert.equal(g.sdRounds, 2);
});
test('contest: a tie-breaker call changed on the Battle summary moves its points, or plays another', () => {
  const { g, env } = game3({ minis:['battle'] });
  Q.play(g, { type:'battle/build' }, env);
  for(let cap = 0; cap < 2; cap++){
    Q.play(g, { type:'battle/start' }, env);
    for(let i = 0; i < g.battle.n; i++) Q.play(g, { type:'battle/mark', got:i < 5 }, env);
  }
  assert.deepEqual(Q.play(g, { type:'battle/tbRule', w:1 }, env).length > 0, true);   // during the tie-breaker: B was right
  assert.equal(g.teams[1].score, g.battlePts);
  Q.play(g, { type:'battle/tbRule', w:0 }, env);
  assert.deepEqual(g.teams.map(t => t.score), [g.battlePts, 0]);
  const fx = Q.play(g, { type:'battle/tbRule', w:'none' }, env);
  assert.ok(types(fx).includes('go:battleTie'));
  assert.deepEqual(g.teams.map(t => t.score), [0, 0]);
  assert.equal(g.battle.stage, 'tie');
  assert.equal(g.battle.tbRounds, 2);
});

/* 22 Oct: both teams always answer at the same level in a round, even after "Change question" */
function levelGame(counts, difficulty){
  const bank = [];
  for(const [d, n] of Object.entries(counts)) for(let i = 0; i < n; i++) bank.push({ id:`Mu-${d}${i}`, type:'standard', theme:'Music', difficulty:d, use_with:`p-${d}${i >> 1}`, question:'Q ' + d + i, answer:'A' });
  const D = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => false, ok:{ map:() => false, flag:() => false, dish:() => false } });
  const g = D.buildGame({ rounds:1, themes:['Music'], difficulty:difficulty || 'mixed', minis:[], teamA:{ name:'A' }, teamB:{ name:'B' } });
  const env = { deal:D, settings:{} };
  Q.play(g, { type:'game/start' }, env); Q.play(g, { type:'round/begin' }, env);
  return { g, env };
}
test('levels: in a mixed game, Change question keeps the level of the other team\'s question', () => {
  for(let k = 0; k < 20; k++){
    const { g, env } = levelGame({ easy:6, medium:6, hard:6 });
    const rd = g.rounds[0], want = rd.q[1].difficulty;
    assert.equal(rd.q[0].difficulty, want);                        // dealt as a pair
    for(let i = 0; i < 4; i++){ Q.play(g, { type:'round/swap' }, env); assert.equal(rd.q[0].difficulty, want, 'swap ' + (i + 1)); }
  }
});
test('levels: when the level runs out, the swap takes the nearest level and says so', () => {
  const { g, env } = levelGame({ hard:2, medium:4, easy:4 }, 'hard');
  const rd = g.rounds[0];
  assert.equal(rd.q[0].difficulty, 'hard');
  const fx = Q.play(g, { type:'round/swap' }, env);
  assert.equal(rd.q[0].difficulty, 'medium');                   // not easy: the nearest first
  assert.ok(fx.some(f => /No more hard questions in Music, so here is a medium one/.test(f.toast || '')));
});
test('levels: a steal on a new question is at the first team\'s level', () => {
  for(let k = 0; k < 20; k++){
    const { g, env } = levelGame({ easy:6, medium:6, hard:6 });
    const want = g.rounds[0].q[0].difficulty;
    Q.play(g, { type:'round/judge', v:true }, env);
    Q.play(g, { type:'round/rule', line:'first', v:false }, env);
    Q.play(g, { type:'round/freshSteal' }, env);
    assert.equal(g.rounds[0].q[0].difficulty, want);
  }
});

/* 22 Oct: Drop the Pin (nearest pin takes the leg) and Guess the Airport (as the flags) */
function newGames(over){
  const bank = [];
  ['easy', 'medium', 'hard'].forEach(l => { for(let i = 0; i < 8; i++){
    bank.push({ id:`pin:${l}${i}`, type:'pin', level:l, question:'P' + i, answer:'P' + i, lat:48.8584, lon:2.2945 });
    bank.push({ id:`airport:${l}${i}`, type:'airport', level:l, question:'A' + i, answer:'A' + i, code:'X' + i, board:[] });
  } });
  const D = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => true,
    ok:{ pin:q => q.type === 'pin', airport:q => q.type === 'airport' } });
  return D.buildGame(Object.assign({ standard:false, rounds:0, themes:[], minis:['pin', 'airport'],
    teamA:{ name:'Falafel' }, teamB:{ name:'Shawarma' } }, over));
}
test('pin: km by the great circle — Eiffel Tower to Notre-Dame, and to New York', () => {
  assert.equal(Math.round(Q.kmBetween({ lat:48.8584, lon:2.2945 }, { lat:48.8530, lon:2.3499 })), 4);
  assert.equal(Math.round(Q.kmBetween({ lat:48.8584, lon:2.2945 }, { lat:40.6892, lon:-74.0445 })), 5837);
  assert.equal(Math.round(Q.kmBetween({ lat:0, lon:179.5 }, { lat:0, lon:-179.5 })), 111);   // across the date line
});
test('pin: the nearer pin takes the leg; no pin loses; the same km is a point each', () => {
  const g = newGames(), s = g.pinGame;
  assert.deepEqual(s.levels, ['easy', 'medium', 'hard']);
  assert.equal(s.qs.length, 5);
  assert.ok(new Set(s.qs.map(q => q.level)).size === 3);           // shared over the levels
  Q.play(g, { type:'pin/start' });
  const near = { lat:48.86, lon:2.30 }, far = { lat:51.5, lon:-0.12 };
  Q.play(g, { type:'pin/settle', pins:[far, near] });
  assert.deepEqual(s.wins, [0, 1]);
  assert.equal(s.subs[0].winner, 1);
  assert.equal(Math.round(s.subs[0].km[0]), 340);
  Q.play(g, { type:'pin/settle', pins:[near, null] });
  assert.deepEqual(s.wins, [1, 1]);
  assert.equal(s.subs[1].km[1], null);
  Q.play(g, { type:'pin/settle', pins:[near, { lat:48.8601, lon:2.3001 }] });
  assert.equal(s.subs[2].winner, 'tie');
  assert.deepEqual(s.wins, [2, 2]);
  Q.play(g, { type:'pin/settle', pins:[null, { lat:'x', lon:2 }] });       // nothing usable: nobody
  assert.equal(s.subs[3].winner, 'none');
  assert.equal(s.i, 4);
});
test('pin: level after five brings a tie-breaker landmark, then pays', () => {
  const g = newGames(), s = g.pinGame;
  Q.play(g, { type:'pin/start' });
  const near = { lat:48.86, lon:2.30 }, far = { lat:51.5, lon:-0.12 };
  for(let i = 0; i < 4; i++) Q.play(g, { type:'pin/settle', pins:i % 2 ? [near, far] : [far, near] });
  let fx = Q.play(g, { type:'pin/settle', pins:[near, near] });
  assert.deepEqual(s.wins, [3, 3]);
  assert.equal(s.tieLegs, 1);
  assert.equal(s.qs.length, 6);
  assert.ok(types(fx).includes('go:pinQ'));
  fx = Q.play(g, { type:'pin/settle', pins:[far, near] });
  assert.equal(s.verdict.winner, 1);
  assert.equal(g.teams[1].score, g.miniPts);
  assert.ok(types(fx).includes('go:pinSummary'));
  assert.deepEqual(Q.play(g, { type:'pin/done' }), [{ go:'airportIntro' }]);
});
test('pin: the setup\'s levels and hand-picks', () => {
  const g = newGames({ pinLevels:['hard'], pickPin:['pin:easy3', 'pin:hard5'] });
  assert.deepEqual(g.pinGame.levels, ['hard']);
  assert.equal(g.pinGame.qs[0].id, 'pin:hard5');                   // a pick at a level that is off is dropped
  assert.ok(g.pinGame.qs.every(q => q.level === 'hard'));
  assert.equal(newGames({ pinLevels:['nope'] }).pinGame.levels.length, 3);
});
test('airport: as the flags — decided early stops, level brings another board', () => {
  let g = newGames();
  Q.play(g, { type:'airport/start' });
  let fx;
  for(let i = 0; i < 3; i++) fx = Q.play(g, { type:'airport/verdict', w:0 });
  assert.equal(g.airportGame.verdict.note, 'Decided with 2 boards to spare.');
  assert.equal(g.teams[0].score, g.miniPts);
  assert.ok(types(fx).includes('go:airportSummary'));
  g = newGames();
  Q.play(g, { type:'airport/start' });
  ['tie', 0, 1, 'none', 'tie'].forEach(w => Q.play(g, { type:'airport/verdict', w }));
  assert.equal(g.airportGame.tieLegs, 1);
  assert.equal(g.airportGame.qs.length, 6);
});
test('the new games sit in the running order only when they have something to play', () => {
  const g = newGames({ minis:['flag', 'pin', 'airport'] });
  assert.deepEqual(g.plan.map(p => p.key), ['pin', 'airport']);              // no flags in this bank
  const none = Q.createDealer({ bank:() => [], used:() => new Set(), noRepeat:() => true }).buildGame({ standard:false, rounds:0, themes:[], minis:['pin', 'airport'], teamA:{ name:'A' }, teamB:{ name:'B' } });
  assert.deepEqual(none.plan, []);
});

/* 23 Oct: Majority Rules — every player answers; right answers out of all the answers a team could give */
function mrGame(over){
  const bank = [];
  ['easy', 'medium', 'hard'].forEach(l => { for(let i = 0; i < 8; i++) bank.push({ id:`mr:${l}${i}`, type:'majority', level:l, question:'M' + i, answer:'A', options:['A', 'B', 'C', 'D'] }); });
  const D = Q.createDealer({ bank:() => bank, used:() => new Set(), noRepeat:() => true, ok:{ majority:q => q.type === 'majority' } });
  return D.buildGame(Object.assign({ standard:false, rounds:0, themes:[], minis:['majority'], teamA:{ name:'Falafel' }, teamB:{ name:'Shawarma' } }, over));
}
test('majority: fifteen questions; the share of right answers decides, not the head count', () => {
  const g = mrGame(), s = g.majorityGame;
  assert.equal(s.qs.length, 15);
  assert.deepEqual(Q.play(g, { type:'majority/start', n:[5, 6] }), [{ go:'majorityQ' }]);
  /* 4 of 5 every time is 80%; 5 of 6 is 83%: Team B wins on the share */
  let fx;
  for(let i = 0; i < 15; i++) fx = Q.play(g, { type:'majority/settle', right:[4, 5] });
  assert.deepEqual(s.right, [60, 75]);
  assert.deepEqual(s.of, [75, 90]);
  assert.deepEqual(s.wins, [80, 83]);
  assert.equal(s.verdict.winner, 1);
  assert.equal(g.teams[1].score, g.miniPts);
  assert.ok(types(fx).includes('go:majoritySummary'));
  assert.match(s.verdict.note, /Falafel: 60 of 75 right \(80%\), Shawarma: 75 of 90 right \(83%\)/);
  assert.deepEqual(Q.play(g, { type:'majority/done' }), [{ finalize:true }]);   // nothing after it tonight
});
test('majority: more right answers from the bigger team is not enough when its share is lower', () => {
  const g = mrGame(), s = g.majorityGame;
  Q.play(g, { type:'majority/start', n:[2, 3] });
  for(let i = 0; i < 15; i++) Q.play(g, { type:'majority/settle', right:[2, 2] });   // 100% v 67%
  assert.equal(s.verdict.winner, 0);
});
test('majority: dead level brings one more question; counts are clamped to the list', () => {
  const g = mrGame(), s = g.majorityGame;
  Q.play(g, { type:'majority/start', n:[4, 4] });
  for(let i = 0; i < 14; i++) Q.play(g, { type:'majority/settle', right:[2, 2] });
  Q.play(g, { type:'majority/settle', right:[9, 3] });   // 9 is more than the 4 on the list: 4
  assert.deepEqual(s.right, [32, 31]);
  assert.equal(s.verdict.winner, 0);
  const h = mrGame(), t = h.majorityGame;
  Q.play(h, { type:'majority/start', n:[3, 3] });
  let f2;
  for(let i = 0; i < 15; i++) f2 = Q.play(h, { type:'majority/settle', right:[1, 1] });
  assert.equal(t.tieLegs, 1);
  assert.equal(t.qs.length, 16);
  assert.ok(types(f2).includes('go:majorityQ'));
  Q.play(h, { type:'majority/settle', right:[0, 3] });
  assert.equal(t.verdict.winner, 1);
});
