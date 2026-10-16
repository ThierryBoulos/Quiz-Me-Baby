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

test('answers: 12 = Twelve, and every number to twenty both ways', () => {
  assert.ok(Q.isMatch('12', 'Twelve'));
  const w = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  w.forEach((x, i) => {
    assert.ok(Q.isMatch(x, String(i + 1)), `${x} = ${i + 1}`);
    assert.ok(Q.isMatch(String(i + 1), x[0].toUpperCase() + x.slice(1)), `${i + 1} = ${x}`);
  });
  assert.ok(!Q.isMatch('13', 'Thirty'));
  assert.ok(!Q.isMatch('fourteen', '40'));
});

/* every pair of countries the typo allowance used to let through, and the near misses */
const LOOKALIKES = [
  ['Austria', 'Australia'], ['North Korea', 'South Korea'], ['Ireland', 'Iceland'], ['Zambia', 'Gambia'],
  ['Zambia', 'The Gambia'], ['Russia', 'Prussia'], ['North America', 'South America'],
  ['Niger', 'Nigeria'], ['Guinea', 'Guyana'], ['Guinea', 'Guinea-Bissau'], ['Guinea', 'Equatorial Guinea'],
  ['Mali', 'Malawi'], ['Mali', 'Malta'], ['Iran', 'Iraq'], ['Iran', 'Oman'], ['Slovenia', 'Slovakia'],
  ['Sweden', 'Swaziland'], ['Algeria', 'Nigeria'], ['Liberia', 'Nigeria'], ['Brunei', 'Burundi'],
  ['Canada', 'Panama'], ['Chile', 'China'], ['China', 'Ghana'], ['Ghana', 'Guyana'], ['Gambia', 'Namibia'],
  ['Namibia', 'Zambia'], ['Holland', 'Poland'], ['Romania', 'Somalia'], ['Rwanda', 'Uganda'],
  ['Serbia', 'Syria'], ['Persia', 'Serbia'], ['Togo', 'Tonga'], ['Eire', 'Zaire'], ['USA', 'USSR'],
  ['Dominica', 'Dominican Republic'], ['Nigeria', 'Niger River'],
];
test('answers: one country is never a typo of another', () => {
  for(const [x, y] of LOOKALIKES){
    assert.ok(!Q.isMatch(x, y), `${x} is not ${y}`);
    assert.ok(!Q.isMatch(y, x), `${y} is not ${x}`);
  }
  /* and none at all: every listed name against every other country's */
  const names = Q.COUNTRIES.flatMap((g, i) => g.map(n => [n, i]));
  for(const [x, i] of names) for(const [y, j] of names) if(i !== j) assert.ok(!Q.isMatch(x, y), `${x} is not ${y}`);
});

test('answers: countries still take typos and their accepted names', () => {
  assert.ok(Q.isMatch('Phillipines', 'Philippines'));
  assert.ok(Q.isMatch('Columbia', 'Colombia'));              // not a country of its own
  assert.ok(Q.isMatch('Austrailia', 'Australia'));
  assert.ok(Q.isMatch('Australa', 'Australia'));
  assert.ok(Q.isMatch('South Korae', 'South Korea'));
  assert.ok(Q.isMatch('Rumania', 'Romania'));                // another name, and a typo of it
  assert.ok(Q.isMatch('the gambia', 'The Gambia'));
  assert.ok(Q.isMatch('Gambia', 'The Gambia'));
  assert.ok(Q.isMatch('USA', 'United States', ['USA', 'US', 'America']));
  assert.ok(Q.isMatch('U.S.A.', 'United States', ['USA']));
  assert.ok(Q.isMatch('Holland', 'Netherlands', ['Holland']));
  assert.ok(!Q.isMatch('Iran', 'Persia'));                   // other names count only through accept
});

test('answers: Mount, Mt, River and Lake are optional at either end', () => {
  assert.ok(Q.isMatch('Everest', 'Mount Everest'));
  assert.ok(Q.isMatch('Mt Everest', 'Mount Everest'));
  assert.ok(Q.isMatch('Mt. Everest', 'Mount Everest'));
  assert.ok(Q.isMatch('Mount Everest', 'Everest'));
  assert.ok(Q.isMatch('Everest', 'Mount Everest (8,849 m)'));
  assert.ok(Q.isMatch('Kilimanjaro', 'Mount Kilimanjaro'));
  assert.ok(Q.isMatch('Kilimanjoro', 'Mount Kilimanjaro'));  // a typo in what is left still passes
  assert.ok(Q.isMatch('Amazon', 'Amazon River'));
  assert.ok(Q.isMatch('River Amazon', 'Amazon River'));
  assert.ok(Q.isMatch('the Nile', 'River Nile'));
  assert.ok(Q.isMatch('Victoria', 'Lake Victoria'));
  assert.ok(Q.isMatch('Lake Victoria', 'Victoria'));
  assert.ok(!Q.isMatch('Mount', 'Mount Everest'));
  assert.ok(!Q.isMatch('River', 'Amazon River'));
  assert.ok(!Q.isMatch('Lake', 'Lake Victoria'));
  assert.ok(!Q.isMatch('Red', 'Red River'));                 // too short to stand alone
  assert.ok(!Q.isMatch('Po', 'River Po'));
  assert.ok(!Q.isMatch('Victoria', 'Victoria Falls'));       // only those four words
  assert.ok(!Q.isMatch('Everest', 'Mount Elbrus'));
  assert.ok(!Q.isMatch('Mount Elbrus', 'Mount Everest'));
});

test('parseNumber: guesses as people type them', () => {
  const P = Q.parseNumber;
  assert.equal(P('236'), 236);
  assert.equal(P(' 1,000,000 '), 1000000);
  assert.equal(P('1 000 000'), 1000000);
  assert.equal(P('1.000.000'), 1000000);
  assert.equal(P('1,5'), 1.5);                               // a decimal comma
  assert.equal(P('1.5 million'), 1500000);
  assert.equal(P('1.5m'), 1500000);
  assert.equal(P('1.5M'), 1500000);
  assert.equal(P('3.2 billion'), 3200000000);
  assert.equal(P('3.2bn'), 3200000000);
  assert.equal(P('2k'), 2000);
  assert.equal(P('2 K'), 2000);
  assert.equal(P('12 thousand'), 12000);
  assert.equal(P('twelve thousand'), 12000);
  assert.equal(P('two million'), 2000000);
  assert.equal(P('5 hundred'), 500);
  assert.equal(P('8,849 m'), 8849);                          // 1,000 or more: metres, not millions
  assert.equal(P('8849m'), 8849);
  assert.equal(P('€25'), 25);
  assert.equal(P('$ 1.99'), 1.99);
  assert.equal(P('25€'), 25);
  assert.equal(P('45%'), 45);
  assert.equal(P('-40'), -40);
  assert.equal(P('about 300'), 300);
  assert.equal(P('~44,000'), 44000);
  assert.equal(P('3,200 km'), 3200);
  assert.equal(P('263 km/h'), 263);
  assert.equal(P('1.5 million people'), 1500000);
  assert.equal(P('476 AD'), 476);
  for(const bad of ['', '   ', 'abc', 'lots', 'two or three', '12-15', '1 in 649,740', '1.2.3', '1,00,000', '5 or 6', null, undefined])
    assert.ok(Number.isNaN(P(bad)), `${bad} is not a number`);
});

test('parseNumber: in the question\'s own units', () => {
  const P = Q.parseNumber, brazil = 'In millions, what is the population of Brazil?';
  assert.equal(P('212.8', brazil), 212.8);
  assert.equal(P('212.8 million', brazil), 212.8);
  assert.equal(P('212.8m', brazil), 212.8);
  assert.equal(P('0.2 billion', brazil), 200);
  assert.equal(P('500k', brazil), 0.5);
  assert.equal(P('two hundred', brazil), 200);
  assert.equal(P('ten billion', 'In millions, how many baguettes?'), 10000);
  assert.equal(P('2.25 billion', 'Number of coffee cups drunk every day, in billions'), 2.25);
  assert.equal(P('300m', 'Height of the Eiffel Tower, in metres'), 300);    // metres, said so
  assert.equal(P('300m', 'How many people?'), 300000000);
});
