/* node --test engine/  — the engine's own checks, no browser needed */
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./core.js');

test('answers: exact, tidy and typo-tolerant', () => {
  assert.ok(Q.isMatch('Paris', 'Paris'));
  assert.ok(Q.isMatch('  paris!! ', 'Paris'));
  assert.ok(Q.isMatch('yelephant', 'Elephant'));          // one stray letter
  assert.ok(!Q.isMatch('elegant', 'Elephant'));           // a different word
  assert.ok(Q.isMatch('beatles', 'The Beatles'));
  assert.ok(Q.isMatch('the beatles', 'Beatles'));
  assert.ok(Q.isMatch('Cote d Ivoire', "Côte d'Ivoire"));
  assert.ok(Q.isMatch('pina colada', 'Piña Colada'));
  assert.ok(Q.isMatch('Mount Everest', 'Mount Everest (8,849 m)'));
  assert.ok(Q.isMatch('Britain', 'United Kingdom', ['UK', 'Britain', 'Great Britain']));
  assert.ok(Q.isMatch('uk', 'United Kingdom', ['UK']));
  assert.ok(Q.isMatch('UK', 'UK / United Kingdom'));
  assert.ok(Q.isMatch('United Kingdom', 'UK / United Kingdom'));
  assert.ok(!Q.isMatch('Peru', 'Paris'));
  assert.ok(!Q.isMatch('Iran', 'Iraq'));                  // short words: no allowance
  assert.ok(Q.isMatch('Iraq', 'Iraq'));
  assert.ok(Q.isMatch('Mojitto', 'Mojito'));
  assert.ok(Q.isMatch('tirmaisu', 'Tiramisu'));            // swapped letters = one edit
  assert.ok(!Q.isMatch('', 'Paris'));
  assert.ok(Q.isMatch('salt and pepper', 'Salt & Pepper'));
  assert.ok(Q.isMatch('newyork', 'New York'));
});

test('answers: numbers compare as numbers', () => {
  assert.ok(Q.isMatch('1,000', '1000'));
  assert.ok(Q.isMatch('1000.0', '1000'));
  assert.ok(!Q.isMatch('1001', '1000'));
  assert.ok(!Q.isMatch('100', '1000'));
});

test('mini-game points: 2 to 4', () => {
  assert.equal(Q.miniPointValue(8, 0), 0);
  assert.equal(Q.miniPointValue(0, 3), 2);
  assert.equal(Q.miniPointValue(8, 1), 3);
  assert.equal(Q.miniPointValue(8, 6), 2);
  assert.equal(Q.miniPointValue(20, 1), 4);
});

test('mini-game schedule: spread, in order, never before round 1', () => {
  assert.deepEqual(Q.planMinis(8, ['a', 'b']), [{ key:'a', after:2 }, { key:'b', after:4 }]);
  assert.deepEqual(Q.planMinis(0, ['a']), []);
  const p = Q.planMinis(2, ['a', 'b', 'c', 'd']);
  assert.ok(p.every((x, i) => x.after >= 0 && x.after <= 1 && (i === 0 || x.after >= p[i - 1].after)));
});

test('best-of: early finish, level, winner', () => {
  assert.equal(Q.bestOf({ wins:[0, 0], i:0, base:7 }), 'next');
  assert.deepEqual(Q.bestOf({ wins:[4, 0], i:4, base:7 }), { winner:0, spare:3 });
  assert.equal(Q.bestOf({ wins:[3, 1], i:4, base:7 }), 'next');
  assert.equal(Q.bestOf({ wins:[3, 3], i:7, base:7 }), 'level');
  assert.deepEqual(Q.bestOf({ wins:[3, 4], i:7, base:7 }), { winner:1, spare:0 });
  assert.equal(Q.bestOf({ wins:[3, 3], i:8, base:7 }), 'level');       // tied tie-breaker
  assert.deepEqual(Q.bestOf({ wins:[4, 3], i:8, base:7 }), { winner:0, spare:0 });
});

test('shuffle: same items, own rng respected', () => {
  let seed = 1; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const a = [1, 2, 3, 4, 5];
  const s = Q.shuffle(a, rng);
  assert.deepEqual([...s].sort(), a);
  assert.deepEqual(a, [1, 2, 3, 4, 5]);                    // input untouched
});

test('answers: numbers as digits or words, both ways', () => {
  assert.ok(Q.isMatch('5', 'Five'));
  assert.ok(Q.isMatch('five', '5'));
  assert.ok(Q.isMatch('Seven', '7'));
  assert.ok(Q.isMatch('twelve', '12'));
  assert.ok(Q.isMatch('21', 'Twenty-one'));
  assert.ok(Q.isMatch('twenty one', '21'));
  assert.ok(Q.isMatch('one hundred and five', '105'));
  assert.ok(Q.isMatch('3000', 'Three thousand'));
  assert.ok(Q.isMatch('two million', '2,000,000'));
  assert.ok(Q.isMatch('7 wonders', 'Seven Wonders'));
  assert.ok(Q.isMatch('Seven wonders', '7 Wonders'));
  assert.ok(Q.isMatch('One Direction', 'One Direction'));   // a name with a number in it still matches itself
  assert.ok(Q.isMatch('1 Direction', 'One Direction'));
  assert.ok(!Q.isMatch('6', 'Five'));
  assert.ok(!Q.isMatch('fifteen', '50'));
  assert.ok(!Q.isMatch('Someone', 'One'));                    // only whole words are numbers
  assert.ok(Q.isMatch('Everyone', 'Everyone'));
  assert.ok(Q.isMatch('Sevn', 'Seven'));                      // a typo in a number word still passes
});
