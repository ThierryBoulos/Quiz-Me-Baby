/* node --test engine/comeback.test.js — the comeback (the owner, 17 Nov): who gets the chance, how far a team that
   makes it moves up, and that nobody ever passes anybody */
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./core.js');

test('comeback: nobody far enough behind, no comeback', () => {
  assert.equal(Q.comebackPlan([40, 38, 36], 20), null);
  assert.equal(Q.comebackPlan([0, 0, 0], 20), null);
  assert.equal(Q.comebackPlan([10, 2], 0), null);                       // nothing left to play
});
test('comeback: two teams: the team behind can get back to 85% of the leader', () => {
  /* 12-2 with 10 points still to win: 10 behind is more than 0.65 x 10 */
  const P = Q.comebackPlan([12, 2], 10);
  assert.deepEqual(P.teams, [1]); assert.deepEqual(P.target, [null, 10]);
  assert.deepEqual(Q.comebackSettle([12, 2], [1], { 1:true }), [12, 10]);
  assert.deepEqual(Q.comebackSettle([12, 2], [1], { 1:false }), [12, 2]);
  /* 9-4 with 10 to win: 5 behind isn't a massacre */
  assert.equal(Q.comebackPlan([9, 4], 10), null);
});
test('comeback: two teams: a small gap on a short night is no massacre (at least 5 behind)', () => {
  assert.notEqual(Q.comebackPlan([4, 0], 4), null);                     // without the floor, 4-0 with 4 to win passes
  assert.equal(Q.comebackPlan([4, 0], 4, 5), null);
  assert.equal(Q.comebackPlan([4, 1], 4, 5), null);
  assert.deepEqual(Q.comebackPlan([8, 1], 10, 5).teams, [1]);
});
test('comeback: many teams: up to one point behind the team above, never past it', () => {
  const sc = [39, 34, 30, 27, 24, 21, 19, 12], P = Q.comebackPlan(sc, 35);
  assert.deepEqual(P.teams, [7]); assert.equal(P.target[7], 18);       // 85% of 39 is 33, but the team above has 19
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 7:true }), [39, 34, 30, 27, 24, 21, 19, 18]);
});
test('comeback: two teams in it: in order, the lower one behind the upper one, whoever makes it', () => {
  const sc = [40, 38, 14, 9], P = Q.comebackPlan(sc, 30);
  assert.deepEqual(P.teams, [2, 3]); assert.deepEqual(P.target, [null, null, 34, 33]);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 2:true, 3:true }), [40, 38, 34, 33]);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 2:true, 3:false }), [40, 38, 34, 9]);
  /* the upper one misses: the lower one stops one point behind it */
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 2:false, 3:true }), [40, 38, 14, 13]);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 2:false, 3:false }), sc);
});
test('comeback: teams level before it can end level, and the leader is never in it', () => {
  const sc = [50, 10, 10], P = Q.comebackPlan(sc, 30);
  assert.deepEqual(P.teams, [1, 2]);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 1:true, 2:true }), [50, 43, 43]);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 1:true, 2:false }), [50, 43, 10]);
});
test('comeback: nobody ever ends above a team it was behind (every outcome, many score lines)', () => {
  let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for(let n = 0; n < 4000; n++){
    const k = 2 + Math.floor(rng() * 7), sc = Array.from({ length:k }, () => Math.floor(rng() * 60)), P = Q.comebackPlan(sc, 5 + rng() * 40);
    if(!P) continue;
    const L = Math.max(...sc);
    assert.ok(P.teams.every(t => sc[t] < L));
    const made = {}; P.teams.forEach(t => { made[t] = rng() < 0.6; });
    const after = Q.comebackSettle(sc, P.teams, made);
    for(let a = 0; a < k; a++){
      assert.ok(after[a] >= sc[a]);                                     // it only pushes up
      if(!made[a]) assert.equal(after[a], sc[a]);
      assert.ok(after[a] <= Math.max(sc[a], Math.round(0.85 * L)));     // never past 85% of the leader
      for(let b = 0; b < k; b++) if(sc[a] < sc[b]) assert.ok(after[a] < after[b], `${sc} -> ${after}`);
    }
  }
});
