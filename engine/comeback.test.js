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
/* the room (26 Nov, the owner): 4 points with 2 or 3 teams, a game's worth (1st place less last place) with more */
const R2 = Q.comebackRoom(2), R3 = Q.comebackRoom(4), R4 = Q.comebackRoom(5), R5 = Q.comebackRoom(6), R8 = Q.comebackRoom(7);
test('comeback: the room is a game\'s worth, and 4 points at least', () => {
  assert.deepEqual([R2, R3, R4, R5, R8], [4, 4, 5, 6, 7]);
});
test('comeback: two teams: the team behind gets back to 4 points behind the leader (12-2: 8, not 10)', () => {
  /* 12-2 with 10 points still to win: 10 behind is more than 0.65 x 10 */
  const P = Q.comebackPlan([12, 2], 10, 5, R2);
  assert.deepEqual(P.teams, [1]); assert.deepEqual(P.target, [null, 8]);
  assert.deepEqual(Q.comebackSettle([12, 2], [1], { 1:true }, R2), [12, 8]);
  assert.deepEqual(Q.comebackSettle([12, 2], [1], { 1:false }, R2), [12, 2]);
  /* a big lead: 85% of the leader is the lower line (30: 26 either way; 40: 34, not 36) */
  assert.deepEqual(Q.comebackSettle([40, 5], [1], { 1:true }, R2), [40, 34]);
  /* 9-4 with 10 to win: 5 behind isn't a massacre */
  assert.equal(Q.comebackPlan([9, 4], 10, 5, R2), null);
});
test('comeback: two teams: a small gap on a short night is no massacre (at least 5 behind, and worth 2 points)', () => {
  assert.notEqual(Q.comebackPlan([4, 0], 4), null);                     // without the floor, 4-0 with 4 to win passes
  assert.equal(Q.comebackPlan([4, 0], 4, 5, R2), null);
  assert.equal(Q.comebackPlan([4, 1], 4, 5, R2), null);
  assert.deepEqual(Q.comebackPlan([8, 1], 10, 5, R2).target, [null, 4]);
  /* 6-1: 5 behind, but 4 points of room leave 1 to win: not worth a comeback; 7-1 is (1 to 3) */
  assert.equal(Q.comebackPlan([6, 1], 6, 5, R2), null);
  assert.deepEqual(Q.comebackPlan([7, 1], 8, 5, R2).target, [null, 3]);
});
test('comeback: many teams: a game\'s worth behind the team above, never one point behind it', () => {
  /* 8 teams: 85% of 39 is 33, but the team above has 19 and the 12 is exactly a game (7) behind it: nothing to win */
  assert.equal(Q.comebackPlan([39, 34, 30, 27, 24, 21, 19, 12], 35, 21, R8), null);
  /* 5 teams, one far behind the pack: 6 behind the team above (till 26 Nov: 32, one point behind) */
  const sc = [42, 38, 36, 33, 18], P = Q.comebackPlan(sc, 30, 18, R5);
  assert.deepEqual(P.teams, [4]); assert.equal(P.target[4], 27);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 4:true }, R5), [42, 38, 36, 33, 27]);
});
test('comeback: the group left behind goes in together (18 Nov, the owner: the 16 was left out)', () => {
  /* 8 teams, 7 games left (7 a game to win back): 31.85 behind is the line on its own; the 16 is 31 behind, but it's
     under the big drop (38 to 16) with the 14 and the 7, and well behind: it's in */
  const sc = [47, 47, 40, 38, 42, 16, 14, 7], P = Q.comebackPlan(sc, 49, 21, R8);
  assert.deepEqual(P.teams, [5, 6, 7]);
  /* a game (7) under the 38; the 14 was 2 behind the 16 and stays 2 behind; the 7 was 7 behind the 14 and stays 7 */
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 5:true, 6:true, 7:true }, R8), [47, 47, 40, 38, 42, 31, 29, 22]);
  /* the 16 misses: the 14 takes the place under the 38, and passes it (26 Nov, the owner) */
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 5:false, 6:true, 7:true }, R8), [47, 47, 40, 38, 42, 16, 31, 24]);
  /* a bottom five, evenly spaced, under a drop of 25: all five */
  assert.deepEqual(Q.comebackPlan([47, 46, 45, 20, 18, 16, 15, 14], 49, 21, R8).teams, [3, 4, 5, 6, 7]);
  /* no drop at all (evenly spread, 6 apart): nobody would win half a game's worth */
  assert.equal(Q.comebackPlan([47, 41, 35, 29, 23, 17, 11, 5], 49, 21, R8), null);
  /* one team far off: only it */
  assert.deepEqual(Q.comebackPlan([47, 45, 44, 43, 42, 41, 40, 8], 49, 21, R8).teams, [7]);
  /* the group never takes in a team that isn't well behind */
  assert.deepEqual(Q.comebackPlan([47, 47, 40, 38, 42, 30, 14, 7], 49, 21, R8).teams, [6, 7]);
});
test('comeback: 6 to 8 teams far behind (26 Nov, the owner: "80 against 20, 20, 20 should be considered")', () => {
  /* 8 teams, five in a pack and three on 20, 5 games left: the three are in, and end tied a game (7) under the pack */
  const a = [80, 78, 75, 72, 70, 20, 20, 20], A = Q.comebackPlan(a, 35, 21, R8);
  assert.deepEqual(A.teams, [5, 6, 7]); assert.deepEqual(A.target.slice(5), [63, 63, 63]);
  assert.deepEqual(Q.comebackSettle(a, A.teams, { 5:true, 6:false, 7:true }, R8), [80, 78, 75, 72, 70, 63, 20, 63]);
  /* 6 teams, a leader on 80 and everyone else on 20: all five are in; 85% of the leader (68) is under 80 less a game */
  const b = [80, 20, 20, 20, 20, 20], B = Q.comebackPlan(b, 35, 21, R8);
  assert.deepEqual(B.teams, [1, 2, 3, 4, 5]); assert.deepEqual(B.target.slice(1), [68, 68, 68, 68, 68]);
  /* 7 teams, 80 70 60 and four far behind, not tied: a game under the 60, then each keeps the gap it had (or a game) */
  const c = [80, 70, 60, 22, 20, 20, 5], C = Q.comebackPlan(c, 42, 21, R8);
  assert.deepEqual(C.teams, [3, 4, 5, 6]); assert.deepEqual(C.target.slice(3), [53, 51, 51, 44]);
  /* 8 teams on a short night (3 games left): still in */
  assert.deepEqual(Q.comebackPlan([40, 38, 36, 35, 34, 8, 8, 8], 21, 21, R8).target.slice(5), [27, 27, 27]);
});
test('comeback: two teams in it: in order, whoever makes it; one that makes it passes one that missed', () => {
  const sc = [40, 38, 14, 9], P = Q.comebackPlan(sc, 30, 15, R4);
  assert.deepEqual(P.teams, [2, 3]); assert.deepEqual(P.target, [null, null, 33, 28]);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 2:true, 3:true }, R4), [40, 38, 33, 28]);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 2:true, 3:false }, R4), [40, 38, 33, 9]);
  /* the upper one misses: the lower one goes to the place under the 38, past it (till 26 Nov it stopped at 13) */
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 2:false, 3:true }, R4), [40, 38, 14, 33]);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 2:false, 3:false }, R4), sc);
  /* two that were a point apart stay a point apart */
  assert.deepEqual(Q.comebackSettle([60, 55, 50, 24, 23], [3, 4], { 3:true, 4:true }, R5), [60, 55, 50, 44, 43]);
});
test('comeback: teams level before it can end level, and the leader is never in it', () => {
  const sc = [50, 10, 10], P = Q.comebackPlan(sc, 30, 12, R3);
  assert.deepEqual(P.teams, [1, 2]);
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 1:true, 2:true }, R3), [50, 43, 43]);   // (85% of 50, under 50 less 4)
  assert.deepEqual(Q.comebackSettle(sc, P.teams, { 1:true, 2:false }, R3), [50, 43, 10]);
});
test('comeback: a night saved before the room existed still settles (one point of room)', () => {
  assert.deepEqual(Q.comebackSettle([12, 2], [1], { 1:true }), [12, 10]);
  assert.deepEqual(Q.comebackSettle([40, 38, 14, 9], [2, 3], { 2:true, 3:true }), [40, 38, 34, 33]);
});
test('comeback: every outcome, many score lines: only up, never past a team that held, the room kept', () => {
  let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let plans = 0;
  for(let n = 0; n < 6000; n++){
    const k = 2 + Math.floor(rng() * 7), sc = Array.from({ length:k }, () => Math.floor(rng() * 60));
    const room = Q.comebackRoom(k === 2 ? 2 : [0, 0, 0, 4, 5, 6, 7, 7, 7][k]), P = Q.comebackPlan(sc, 5 + rng() * 40, 0, room);
    if(!P) continue;
    plans++;
    const L = Math.max(...sc), gain = Math.ceil(room / 2);
    assert.ok(P.teams.every(t => sc[t] < L));
    assert.ok(P.teams.every(t => P.target[t] - sc[t] >= gain), `${sc}: a team in it for under ${gain}`);
    const made = {}; P.teams.forEach(t => { made[t] = rng() < 0.6; });
    const after = Q.comebackSettle(sc, P.teams, made, room), held = (t) => P.teams.indexOf(t) < 0 || made[t];
    for(let a = 0; a < k; a++){
      assert.ok(after[a] >= sc[a]);                                     // it only pushes up
      if(!made[a]) assert.equal(after[a], sc[a]);
      else assert.ok(after[a] >= P.target[a], `${sc} -> ${after}: under what it was told`);   // at least what the announcement said
      assert.ok(after[a] <= Math.max(sc[a], Math.round(0.85 * L)));     // never past 85% of the leader
      for(let b = 0; b < k; b++) if(sc[a] < sc[b] && held(b)){
        assert.ok(after[a] < after[b], `${sc} -> ${after}`);            // never past, never level with, a team that held
        assert.ok(after[b] - after[a] >= Math.min(sc[b] - sc[a], room), `${sc} -> ${after}: closer than the room`);
      }
      for(let b = 0; b < k; b++) if(sc[a] === sc[b] && made[a] && made[b]) assert.equal(after[a], after[b]);
    }
  }
  assert.ok(plans > 300, `only ${plans} plans`);
});
