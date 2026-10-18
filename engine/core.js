/* ==========================================================================
   Quiz Me Baby — the shared engine (v4, step 1)
   ==========================================================================
   The rules of the game, with no screen in them: no DOM, no sounds, no
   storage. Classic (index.html) loads this with a plain <script>, Party (the
   Next.js app) imports it, and the tests run it under Node. Everything here
   is a pure function of its arguments, so all three see exactly the same
   game.

   This file grows step by step as logic moves out of index.html:
     1a  answer checking, mini-game points and schedule, best-of legs
     1b  dealing — the decks and the game built from a bank
     1c  the game's moves — Flag and Cocktail or Dish so far
   ========================================================================== */
(function(root, factory){
  const QMB = factory();
  if(typeof module === 'object' && module.exports) module.exports = QMB;
  else root.QMB = QMB;
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  /* ---------------------------------------------------------------- answers
     Typed answers (Party, and anything without a host) are checked here.
     Kept deliberately simple:
       - tidy both sides: lower-case, no accents, no punctuation, "&" = "and",
         no leading "the"/"a"/"an"
       - several accepted answers per question; an answer's own bracketed
         note is optional ("Everest (8,849 m)" also accepts "Everest")
       - small typos pass: none in words of 4 letters or fewer, one up to 8,
         two beyond. "yelephant" is elephant; "elegant" is not.
       - but one country is never a typo of another: "Austria" is not Australia
       - "Mount", "Mt", "River" and "Lake" are optional: "Everest" = "Mount Everest"
       - numbers are compared as numbers: "1,000" = "1000" = "1000.0", "twelve" = "12"
     Closest To Wins guesses are read by parseNumber ("1.5 million", "2k").  */
  function tidy(s){
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/^(the|a|an) /, '');
  }
  function asNumber(s){
    const t = String(s == null ? '' : s).replace(/[,\s]/g, '');
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  }
  /* numbers written as words count as the number: "five" = "5", "twenty one" = "21",
     "one hundred and five" = "105", "three thousand" = "3000". Runs on tidied text, word
     by word, so "seven wonders" and "7 wonders" meet in the middle as "7 wonders". */
  const UNITS = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
    eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19 };
  const TENS = { twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };
  const SCALES = { hundred:100, thousand:1000, million:1e6, billion:1e9 };
  function numWords(t){
    const words = t.split(' '), out = [];
    let total = 0, cur = 0, inNum = false;
    const flush = () => { if(inNum){ out.push(String(total + cur)); total = 0; cur = 0; inNum = false; } };
    for(let i = 0; i < words.length; i++){
      const w = words[i];
      if(w in UNITS){ cur += UNITS[w]; inNum = true; }
      else if(w in TENS){ cur += TENS[w]; inNum = true; }
      else if(w in SCALES && inNum){
        if(SCALES[w] === 100) cur *= 100; else { total += cur * SCALES[w]; cur = 0; }
      }
      /* "one hundred and five": the "and" belongs to the number when one follows */
      else if(w === 'and' && inNum && (words[i + 1] in UNITS || words[i + 1] in TENS)) continue;
      else { flush(); out.push(w); }
    }
    flush();
    return out.join(' ');
  }
  /* edits between two strings, a swapped neighbour pair counting as one */
  function distance(a, b){
    const n = a.length, m = b.length;
    if(!n) return m; if(!m) return n;
    const d = [];
    for(let i = 0; i <= n; i++){ d[i] = [i]; }
    for(let j = 0; j <= m; j++) d[0][j] = j;
    for(let i = 1; i <= n; i++){
      for(let j = 1; j <= m; j++){
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if(i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[n][m];
  }
  const allowance = (len) => len <= 4 ? 0 : len <= 8 ? 1 : 2;
  /* every way an answer may be written: itself, without its bracketed note,
     and each " / " alternative it lists */
  function variants(answer){
    const out = [];
    String(answer == null ? '' : answer).split(/\s+\/\s+/).forEach(a => {
      out.push(a);
      const bare = a.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      if(bare && bare !== a) out.push(bare);
    });
    return out;
  }
  /* Countries (UN members, plus a few places asked as if they were), each with the other names
     people use for it. Typing one country exactly is never a typo of another: "Austria" is
     not Australia, "Zambia" is not Gambia, though each is an edit away. A country's other
     names only stop it being taken for a different one ("Rumania" is still a typo of Romania);
     they aren't accepted for it here, or "Iran" would pass for "What was Iran called before
     1935?" (Persia). accept.json says which other names count. */
  const COUNTRIES = ('Afghanistan;Albania;Algeria;Andorra;Angola;Antigua and Barbuda|Antigua;Argentina;Armenia;' +
    'Australia;Austria;Azerbaijan;Bahamas;Bahrain;Bangladesh;Barbados;Belarus|Byelorussia|Belorussia;Belgium;' +
    'Belize;Benin|Dahomey;Bhutan;Bolivia;Bosnia and Herzegovina|Bosnia|Bosnia-Herzegovina|BiH;Botswana;Brazil|Brasil;' +
    'Brunei|Brunei Darussalam;Bulgaria;Burkina Faso|Burkina|Upper Volta;Burundi;Cape Verde|Cabo Verde;' +
    'Cambodia|Kampuchea;Cameroon;Canada;Central African Republic|CAR;Chad;Chile;China|PRC|People’s Republic of China;' +
    'Colombia;Comoros;Republic of the Congo|Congo-Brazzaville|Republic of Congo|Congo Republic;Costa Rica;' +
    'Ivory Coast|Côte d’Ivoire;Croatia|Hrvatska;Cuba;Cyprus;Czechia|Czech Republic|Czech;' +
    'DR Congo|Democratic Republic of the Congo|Democratic Republic of Congo|DRC|Congo-Kinshasa|Zaire;Denmark;' +
    'Djibouti;Dominica;Dominican Republic;Ecuador;Egypt;El Salvador;Equatorial Guinea;Eritrea;Estonia;' +
    'Eswatini|Swaziland;Ethiopia;Fiji;Finland;France;Gabon;Gambia;Georgia;Germany|Deutschland;Ghana;Greece;' +
    'Grenada;Guatemala;Guinea;Guinea-Bissau;Guyana;Haiti;Honduras;Hungary;Iceland;India|Bharat;Indonesia;' +
    'Iran|Persia;Iraq;Ireland|Eire|Republic of Ireland;Israel;Italy|Italia;Jamaica;Japan|Nippon;Jordan;Kazakhstan;' +
    'Kenya;Kiribati;Kuwait;Kyrgyzstan|Kyrgyz Republic|Kirghizia;Laos|Lao PDR;Latvia;Lebanon;Lesotho;Liberia;' +
    'Libya;Liechtenstein;Lithuania;Luxembourg;Madagascar;Malawi;Malaysia;Maldives;Mali;Malta;Marshall Islands;' +
    'Mauritania;Mauritius;Mexico;Micronesia;Moldova;Monaco;Mongolia;Montenegro;Morocco;Mozambique;' +
    'Myanmar|Burma;Namibia;Nauru;Nepal;Netherlands|Holland;New Zealand|NZ|Aotearoa;Nicaragua;Niger;Nigeria;' +
    'North Korea|DPRK;North Macedonia|Macedonia;Norway;Oman;Pakistan;Palau;Panama;Papua New Guinea|PNG;Paraguay;' +
    'Peru;Philippines;Poland;Portugal;Qatar;Romania|Rumania;Russia|Russian Federation;Rwanda;' +
    'Saint Kitts and Nevis|St Kitts and Nevis|St Kitts|Saint Kitts;Saint Lucia|St Lucia;' +
    'Saint Vincent and the Grenadines|St Vincent and the Grenadines|St Vincent|Saint Vincent;Samoa;San Marino;' +
    'São Tomé and Príncipe|São Tomé;Saudi Arabia|Saudi|KSA;Senegal;Serbia;Seychelles;Sierra Leone;Singapore;' +
    'Slovakia|Slovak Republic;Slovenia;Solomon Islands;Somalia;South Africa|RSA;South Korea|Republic of Korea|ROK;' +
    'South Sudan;Spain|España;Sri Lanka|Ceylon;Sudan;Suriname|Surinam;Sweden;Switzerland;Syria;Tajikistan;' +
    'Tanzania;Thailand|Siam;Timor-Leste|East Timor;Togo;Tonga;Trinidad and Tobago|Trinidad;Tunisia;Turkey|Türkiye;' +
    'Turkmenistan;Tuvalu;Uganda;Ukraine;United Arab Emirates|UAE|Emirates;' +
    'United Kingdom|UK|Britain|Great Britain|GB;United States|USA|US|America|United States of America;Uruguay;' +
    'Uzbekistan;Vanuatu;Venezuela;Vietnam|Viet Nam;Yemen;Zambia;Zimbabwe;' +
    'Vatican City|Vatican|Holy See;Palestine;Taiwan;Kosovo;England;Scotland;Wales;Northern Ireland;Greenland;' +
    'Western Sahara;Soviet Union|USSR;Prussia;North America;South America').split(';').map(g => g.split('|'));
  const COUNTRY = new Map();
  COUNTRIES.forEach((g, i) => g.forEach(n => COUNTRY.set(tidy(n).replace(/ /g, ''), i)));
  const countryOf = (t) => COUNTRY.get(t.replace(/ /g, '')) ?? -1;
  /* "Mount", "Mt", "River" and "Lake" are optional at either end ("Everest" = "Mount Everest",
     "Amazon" = "Amazon River"), but only when a name of 4 letters or more is left: "Red" alone
     is not the Red River. */
  function bareGeo(t){
    const r = t.replace(/^(mount|mt|river|lake) /, '').replace(/ (mount|mt|river|lake)$/, '');
    return r.replace(/ /g, '').length >= 4 ? r : t;
  }
  /* -> true when `typed` counts as `answer` (or any of `accept`) */
  function isMatch(typed, answer, accept){
    const tn = asNumber(typed) ?? asNumber(numWords(tidy(typed)));
    const wanted = variants(answer).concat(accept || []);
    for(const w of wanted){
      const wn = asNumber(w) ?? asNumber(numWords(tidy(w)));
      if(tn != null && wn != null){ if(tn === wn) return true; continue; }
      /* as written, with number words as digits (so a typo in "Sevn" still meets "Seven"),
         and without a leading "Mount" or trailing "River" */
      const ta = tidy(typed), tb = tidy(w);
      for(const [a, b] of [[ta, tb], [numWords(ta), numWords(tb)], [bareGeo(ta), bareGeo(tb)]]){
        if(!a || !b) continue;
        if(a === b || a.replace(/ /g, '') === b.replace(/ /g, '')) return true;
        const ca = countryOf(a), cb = countryOf(b);
        if(ca >= 0 && cb >= 0 && ca !== cb) continue;                  // one country typed for another
        if(distance(a, b) <= allowance(b.length)) return true;
      }
    }
    return false;
  }

  /* Closest To Wins guesses, as people type them: "1.5 million", "8,849 m", "2k", "€25",
     "45%", "1 000 000", "twelve thousand". -> a number, or NaN for anything else.
     `question` (optional) is the question's text: when it asks "in millions" (or thousands,
     billions), a guess given with its own scale is put in those units, so "212.8 million"
     and "212.8" both answer "In millions, the population of Brazil?". A lone "m" is a
     million, unless the question is in metres or the number is already 1,000 or more. */
  const SCALE_EXP = { hundred:2, hundreds:2, k:3, thousand:3, thousands:3, m:6, mn:6, mil:6, million:6, millions:6,
    b:9, bn:9, billion:9, billions:9, tn:12, trillion:12, trillions:12 };
  function parseNumber(s, question){
    const q = String(question || '').toLowerCase();
    const per = /\bin (thousands|millions|billions)\b/.exec(q), perExp = per ? SCALE_EXP[per[1]] : 0;
    let t = String(s == null ? '' : s).toLowerCase().replace(/ /g, ' ').trim()
      .replace(/^(about|around|roughly|approx(imately)?|circa|~|≈)\s*/, '')
      .replace(/^[€$£¥₹]\s*/, '');
    if(!/\d/.test(t)){                            // number words: "twelve thousand"
      const w = numWords(tidy(t));
      if(asNumber(w) == null) return NaN;
      return /thousand|million|billion/.test(t) && perExp ? asNumber(w) / 10 ** perExp : asNumber(w);
    }
    const m = /^(-?)(\d[\d,. ]*?)\s*([a-z]+)?\s*([a-z%°²³/.€$£¥₹ ]*)$/.exec(t);
    if(!m) return NaN;
    let num = m[2].trim();
    if(/^\d{1,3}([, ]\d{3})+(\.\d+)?$/.test(num)) num = num.replace(/[, ]/g, '');          // 1,000,000 / 1 000 000
    else if(/^\d{1,3}(\.\d{3}){2,}(,\d+)?$/.test(num)) num = num.replace(/\./g, '').replace(',', '.');   // 1.000.000
    else if(/^\d+,\d{1,2}$/.test(num)) num = num.replace(',', '.');                         // 1,5 (a decimal comma)
    else if(!/^\d+(\.\d+)?$/.test(num)) return NaN;
    let exp = SCALE_EXP[m[3]] || 0;
    if(m[3] === 'm' && (/\bmet(re|er)s?\b/.test(q) || Number(num) >= 1000)) exp = 0;      // "8,849 m": metres
    return Number(m[1] + num + 'e' + (exp ? exp - perExp : 0));
  }

  /* -------------------------------------------------------- mini-game points
     What each mini-game is worth, from the standard rounds N (2 points a
     round, one question each) and the mini-games M, the Battle among them.
     The Battle counts double (battle: is it on?), and all of them together
     come to about three quarters of the rounds, so the trivia still decides
     most of the night. Never under 1; with no standard rounds, 2 each.     */
  function miniPointValue(N, M, battle){
    if(!M) return 0;
    if(!N) return 2;
    return Math.max(1, Math.round(0.75 * 2 * N / (M + (battle ? 1 : 0))));
  }
  /* -> [{key, after}]: `after` is the 0-based round each mini-game follows.
     Equal `after` values run back to back. */
  function planMinis(N, keys){
    const M = keys.length;
    if(!M || !N) return [];
    const out = [];
    let last = -1;
    keys.forEach((k, i) => {
      let at = Math.round((i + 1) * N / (M + 1)) - 1;
      at = Math.max(0, Math.min(N - 1, at));
      if(at < last) at = last;
      out.push({ key:k, after:at });
      last = at;
    });
    return out;
  }

  /* ------------------------------------------------------------ best-of legs
     The shape Guess the Map, Guess the Flag and Cocktail or Dish share:
     `base` legs, stop early once the lead can't be caught, and when it ends
     level, say so — each game decides what level means (another leg, or the
     table's call).  s = { wins:[a, b], i (legs played), base }
       -> 'next'               play another base leg
       -> 'level'              base legs done (or tie-breaker done), level
       -> { winner:0|1, spare } decided; `spare` = base legs not needed      */
  function bestOf(s){
    const lead = Math.abs(s.wins[0] - s.wins[1]);
    const left = Math.max(0, s.base - s.i);
    if(s.i < s.base && lead <= left) return 'next';
    if(lead === 0) return 'level';
    return { winner:s.wins[0] > s.wins[1] ? 0 : 1, spare:s.i < s.base ? s.base - s.i : 0 };
  }


  /* ================================================================ dealing
     Step 1b: which questions, maps, flags and recipes a night gets, and in
     what order. Moved here from index.html as it was — same code, same order
     of random draws — with the three things it used to reach for passed in:
       ctx.bank()      the question bank (an array of rows)
       ctx.used()      a Set of ids already played
       ctx.noRepeat()  the "never reuse a question" setting
       ctx.ok          { map(q), flag(q), dish(q) } — whether a row's picture
                       or recipe exists (the catalogues stay with the app)
       ctx.rng         optional; Math.random when absent
     Anything that needs tonight's game (the Battle's "already used") takes
     it as an argument instead of reading it.                               */
  const LEGS = { closest:7, auction:3, saysame:9, map:3, flag:10, dish:7, battle:10 };
  const CLOSEST_LEGS = LEGS.closest, SAYSAME_LEGS = LEGS.saysame, MAP_LEGS = LEGS.map,
        FLAG_LEGS = LEGS.flag, DISH_LEGS = LEGS.dish, BATTLE_N = LEGS.battle;
  /* Flag first: fast and loud, it opens the night */
  const INTERLEAVED = ['flag', 'closest', 'auction', 'saysame', 'map', 'dish'];
  const MAP_ORDER = ['easy', 'medium', 'hard'];
  const FLAG_LEVEL_KEYS = ['veasy', 'easy', 'medium', 'hard', 'expert'];
  const DISH_LEVEL_KEYS = ['c-easy', 'c-medium', 'c-hard', 'd-easy', 'd-medium', 'd-hard'];
  const BATTLE_SKIP_THEMES = ['Know the Host', 'Sexy Time', 'Lebanon'];

  function createDealer(ctx){
    const bank = ctx.bank;
    const ok = ctx.ok || { map:() => false, flag:() => false, dish:() => false };
    const rand = () => (ctx.rng || Math.random)();
    const shuffle = (a) => shuffleWith(a, ctx.rng);
    const isFresh = (q) => !ctx.noRepeat() || !ctx.used().has(q.id);
    const uid = () => rand().toString(36).slice(2, 10);

    const matchDiff = (q, d) => d === 'mixed' || q.difficulty === d;

    function pairsFor(theme, diff, exclude){
      exclude = exclude || new Set();
      const pool = bank().filter(q =>
        q.type === 'standard' && q.theme === theme && matchDiff(q, diff) &&
        !exclude.has(q.id) && isFresh(q));
      /* Group by ticker AND difficulty — on "mixed" one team must never get an
         easy question while the other gets a hard one. */
      const groups = {};
      pool.forEach(q => {
        const k = ((q.use_with || '').trim() || '__solo__') + '||' + q.difficulty;
        (groups[k] = groups[k] || []).push(q);
      });
      const pairs = [], odd = {};
      Object.keys(groups).forEach(k => {
        const diff = k.split('||')[1];
        if(k.indexOf('__solo__||') === 0){ (odd[diff] = odd[diff] || []).push(...groups[k]); return; }
        const sh = shuffle(groups[k]);
        for(let i = 0; i + 1 < sh.length; i += 2) pairs.push({ key:k.split('||')[0], a:sh[i], b:sh[i+1], strict:true });
        if(sh.length % 2) (odd[diff] = odd[diff] || []).push(sh[sh.length-1]);
      });
      /* leftovers pair loosely, but still only within the same difficulty */
      Object.keys(odd).forEach(diff => {
        const lo = shuffle(odd[diff]);
        for(let i = 0; i + 1 < lo.length; i += 2) pairs.push({ key:'', a:lo[i], b:lo[i+1], strict:false });
      });
      return shuffle(pairs);
    }

    function closestPool(){
      const byTheme = {};
      bank().forEach(q => {
        if(q.type !== 'closest' || !isFresh(q)) return;
        (byTheme[q.theme] = byTheme[q.theme] || []).push(q);
      });
      let decks = shuffle(Object.keys(byTheme)).map(t => shuffle(byTheme[t]));
      const out = [];
      while(decks.length){
        decks.forEach(d => out.push(d.shift()));
        decks = shuffle(decks.filter(d => d.length));
        /* a fresh lap must not open on the theme the last lap closed with */
        if(decks.length > 1 && out.length && decks[0][0].theme === out[out.length - 1].theme){
          const swap = decks[0]; decks[0] = decks[1]; decks[1] = swap;
        }
      }
      return out;
    }

    function capacity(themes, diff){
      const at = typeof diff === 'function' ? diff : () => diff;
      let loose = 0, strict = 0;
      themes.forEach(t => { const p = pairsFor(t, at(t)); loose += p.length; strict += p.filter(x => x.strict).length; });
      return { rounds:loose, strict, closest:closestPool().length };
    }

    function battlePool(spent, diff){
      const ok = (q) => q.type === 'standard' && !spent.has(q.id) &&
        BATTLE_SKIP_THEMES.indexOf(q.theme) < 0 &&
        (diff ? q.difficulty === diff : q.difficulty === 'easy' || q.difficulty === 'medium');
      const fresh = bank().filter(q => ok(q) && isFresh(q));
      /* "never reuse a question" is a nicety. Being able to run the Battle at all
         matters more, so fall back to the played ones rather than a short set. */
      return fresh.length >= BATTLE_N * 2 ? fresh : bank().filter(ok);
    }

    function battleReady(spent){
      const p = battlePool(spent);
      return p.filter(q => q.difficulty === 'easy').length >= 2 && p.length >= 8;
    }

    function buildBattle(spent){
      const pool = shuffle(battlePool(spent));
      const by = { easy:pool.filter(q => q.difficulty === 'easy'),
                   medium:pool.filter(q => q.difficulty === 'medium') };
      /* one shape, drawn once, used for both captains */
      const shape = shuffle(['easy','easy','easy','easy','easy','medium','medium','medium','medium','medium']);
      const taken = new Set();
      const draw = (want) => {
        /* the wanted difficulty first; the other one only to avoid a short set */
        for(const d of (want === 'easy' ? ['easy','medium'] : ['medium','easy'])){
          const q = by[d].find(x => !taken.has(x.id));
          if(q){ taken.add(q.id); return q; }
        }
        return null;
      };
      const sets = [[], []];
      for(let i = 0; i < BATTLE_N; i++){
        const a = draw(shape[i]), b = draw(shape[i]);
        if(!a || !b) break;                 // both captains or neither — always equal length
        sets[0].push(a); sets[1].push(b);
      }
      if(sets[0].length < 2) return null;
      return {
        n:sets[0].length, qs:sets, shape:shape.slice(0, sets[0].length),
        cap:0, i:0, shown:false, score:[0, 0],
        log:[[], []],                        // per captain: {q, got}
        stage:'run',                         // run → (tie) → done
        tb:null, tbUsed:[], tbRounds:0, dropped:[],
        winner:null, awarded:false, award:[0, 0], done:false
      };
    }

    function auctionPool(){
      return bank().filter(q => q.type === 'auction' && isFresh(q));
    }

    function auctionDeck(cfg){
      const picked = ((cfg && cfg.pickAuction) || [])
        .map(id => bank().find(q => q.id === id)).filter(Boolean);
      const ids = new Set(picked.map(q => q.id));
      return picked.concat(shuffle(auctionPool().filter(q => !ids.has(q.id))));
    }

    function saySamePool(){
      return bank().filter(q => q.type === 'saysame' && isFresh(q) && (q.pool || []).length >= 2);
    }

    /* The hidden word leans towards what people actually say: the lists run from
       the most common answer down, and the k-th word is drawn with weight 1/k, so
       "Sean Connery" comes up far more often than "George Lazenby". Short closed
       sets (heads or tails, the four suits) stay an even draw. */
    function drawSaySame(q){
      const pool = q.pool || [];
      if(pool.length <= 4) return Object.assign({}, q, { answer: pool[Math.floor(rand() * pool.length)] });
      const w = pool.map((_, k) => 1 / (k + 1)), total = w.reduce((a, b) => a + b, 0);
      let r = rand() * total, i = 0;
      while(i < pool.length - 1 && r >= w[i]){ r -= w[i]; i++; }
      return Object.assign({}, q, { answer: pool[i] });
    }

    function saySameDeck(cfg){
      /* Legs 1 to 8 are prompts with plenty of answers (four or more), widest
         first; leg 9 — the last — is a two-way coin flip (heads or tails, cats or
         dogs). Tie-breakers go back to the wide prompts. Fresh prompts first;
         played ones only if the fresh ones run short. */
      const has = (q) => q && (q.pool || []).length >= 2;
      const two = (q) => q.pool.length === 2;
      const picked = ((cfg && cfg.pickSaySame) || [])
        .map(id => bank().find(q => q.id === id)).filter(has).slice(0, SAYSAME_LEGS);
      const ids = new Set(picked.map(q => q.id));
      const all = bank().filter(q => q.type === 'saysame' && has(q) && !ids.has(q.id));
      const freshFirst = (list) => shuffle(list.filter(isFresh)).concat(shuffle(list.filter(q => !isFresh(q))));
      const wide  = freshFirst(all.filter(q => q.pool.length >= 4));
      const three = freshFirst(all.filter(q => q.pool.length === 3));
      const coins = freshFirst(all.filter(two));
    
      const last = picked.filter(two)[0] || coins[0] || null;
      const body = picked.filter(q => q !== last);
      const fill = wide.concat(three).filter(q => q !== last);
      while(body.length < SAYSAME_LEGS - (last ? 1 : 0) && fill.length) body.push(fill.shift());
      body.sort((x, y) => y.pool.length - x.pool.length);       // widest first
      const primary = body.concat(last ? [last] : []);
      return primary.concat(fill.slice(0, 6));                  // tie-breakers: more wide prompts
    }

    function mapLevelsOf(c){
      const want = (c && c.mapLevels) || MAP_ORDER;
      const ok = MAP_ORDER.filter(k => want.indexOf(k) > -1);
      return ok.length ? ok : MAP_ORDER.slice();
    }

    const mapAt = (q, levels) => !q.level || levels.indexOf(q.level) > -1;

    function mapQueue(test, skip){
      const all = bank().filter(q => ok.map(q) && test(q) && !(skip && skip.has(q.id)));
      return shuffle(all.filter(isFresh)).concat(shuffle(all.filter(q => !isFresh(q))));
    }

    function mapPool(levels, skip){
      const queues = levels.map(l => mapQueue(q => q.level === l, skip))
        .concat([mapQueue(q => !q.level, skip)]);
      const out = [];
      for(let i = 0; queues.some(q => i < q.length); i++)
        out.push.apply(out, shuffle(queues.filter(q => i < q.length).map(q => q[i])));
      const lo = MAP_ORDER.indexOf(levels[0]), hi = MAP_ORDER.indexOf(levels[levels.length - 1]);
      const rank = (l) => { const i = MAP_ORDER.indexOf(l); return i < lo ? lo - i : i > hi ? 10 + i - hi : 20; };
      MAP_ORDER.filter(l => levels.indexOf(l) < 0).sort((a, b) => rank(a) - rank(b))
        .forEach(l => out.push.apply(out, mapQueue(q => q.level === l, skip)));
      return out;
    }

    function mapDeck(cfg){
      const levels = mapLevelsOf(cfg);
      const picked = ((cfg && cfg.pickMap) || [])
        .map(id => bank().find(q => q.id === id))
        .filter(q => ok.map(q) && mapAt(q, levels))
        .slice(0, MAP_LEGS);
      return picked.concat(mapPool(levels, new Set(picked.map(q => q.id))));
    }

    function flagLevelsOf(c){
      const want = (c && c.flagLevels) || (c && c.flagLevel ? [c.flagLevel] : ['medium']);
      const ok = FLAG_LEVEL_KEYS.filter(k => want.indexOf(k) > -1);
      return ok.length ? ok : ['medium'];
    }

    function flagPool(levels, skip){
      const queues = levels.map(l => {
        const all = bank().filter(q => ok.flag(q) && q.level === l && !(skip && skip.has(q.id)));
        return shuffle(all.filter(isFresh)).concat(shuffle(all.filter(q => !isFresh(q))));
      });
      const out = [];
      for(let i = 0; queues.some(q => i < q.length); i++)
        out.push.apply(out, shuffle(queues.filter(q => i < q.length).map(q => q[i])));
      return out;
    }

    function flagDeck(cfg, levels){
      const picked = ((cfg && cfg.pickFlag) || [])
        .map(id => bank().find(q => q.id === id))
        .filter(q => ok.flag(q) && levels.indexOf(q.level) > -1)
        .slice(0, FLAG_LEGS);
      return picked.concat(flagPool(levels, new Set(picked.map(q => q.id))));
    }

    function dishLevelsOf(c){
      const want = (c && c.dishLevels) || ['c-medium', 'd-medium'];
      const ok = DISH_LEVEL_KEYS.filter(k => want.indexOf(k) > -1);
      return ok.length ? ok : ['c-medium', 'd-medium'];
    }

    function dishPool(levels, skip){
      const queues = levels.map(l => {
        const all = bank().filter(q => ok.dish(q) && q.level === l && !(skip && skip.has(q.id)));
        return shuffle(all.filter(isFresh)).concat(shuffle(all.filter(q => !isFresh(q))));
      });
      const out = [];
      for(let i = 0; queues.some(q => i < q.length); i++)
        out.push.apply(out, shuffle(queues.filter(q => i < q.length).map(q => q[i])));
      return out;
    }

    function dishDeck(cfg, levels){
      const picked = ((cfg && cfg.pickDish) || [])
        .map(id => bank().find(q => q.id === id))
        .filter(q => ok.dish(q) && levels.indexOf(q.level) > -1)
        .slice(0, DISH_LEGS);
      return picked.concat(dishPool(levels, new Set(picked.map(q => q.id))));
    }

    function diffOf(cfg, theme){
      const d = cfg && cfg.themeDiff && cfg.themeDiff[theme];
      return d || (cfg ? cfg.difficulty : 'mixed');
    }

    function pickedPair(theme, picks){
      const ids = (picks || {})[theme] || [];
      if(ids.length !== 2) return null;
      const a = bank().find(q => q.id === ids[0]), b = bank().find(q => q.id === ids[1]);
      if(!a || !b) return null;
      const key = (a.use_with || '').trim();
      return { key, a, b, strict:!!key && key === (b.use_with || '').trim(), picked:true };
    }

    function dishLeg(){ return { shown:1, out:[false, false], buzz:null, calls:[], k:0 }; }

    function buildGame(cfg){
      const N = cfg.standard === false ? 0 : cfg.rounds;   // 0 = mini-games only
      const themes = shuffle(cfg.themes.slice());
      const taken = new Set();
      const rounds = [];
    
      for(let i = 0; i < N; i++){
        let pair = null, theme = null;
        // try each theme in rotation until one still has a usable pair
        const order = themes.slice(i % themes.length).concat(themes.slice(0, i % themes.length));
        for(const t of order){
          /* a hand-picked pair wins outright — the host chose those two on purpose */
          const hand = pickedPair(t, cfg.picks);
          if(hand && !taken.has(hand.a.id) && !taken.has(hand.b.id)){ pair = hand; theme = t; break; }
          const p = pairsFor(t, diffOf(cfg, t), taken);
          if(p.length){ pair = p[0]; theme = t; break; }
        }
        if(!pair) break;
        taken.add(pair.a.id); taken.add(pair.b.id);
        rounds.push({
          n:i + 1, theme, strict:pair.strict, picked:!!pair.picked, pairKey:pair.key,
          q:[pair.a, pair.b],                 // q[0] -> team that goes first slot 0
          dbl:[false, false], llUsed:[[], []],
          res:[null, null],                   // per seat: {correct, stolen}
          pts:[0, 0], done:false
        });
      }
    
      /* Hand-picked legs lead, in the order the host ticked them; the round-robin
         draw makes up whatever is short, skipping anything already picked. */
      const handClosest = (cfg.pickClosest || [])
        .map(id => bank().find(q => q.id === id))
        .filter(q => q && q.type === 'closest');
      const handIds = new Set(handClosest.map(q => q.id));
      const cpAll = handClosest.concat(closestPool().filter(q => !handIds.has(q.id)));
      const cp = cpAll.slice(0, CLOSEST_LEGS);
      const spare = cpAll.slice(CLOSEST_LEGS, CLOSEST_LEGS + 6);   // held back for tie-breaker legs
    
      /* Say-Same's legs are already sorted vast-to-tight by saySameDeck(); the
         first SAYSAME_LEGS play, the rest sit in reserve for a tie-break. Each
         leg's secret word is resolved now, once, via drawSaySame — not at render
         time, or a re-render mid-leg would change the answer under the host. */
      const ssDeck = saySameDeck(cfg);
      const ssLegs = ssDeck.slice(0, SAYSAME_LEGS).map(drawSaySame);
      const ssSpare = ssDeck.slice(SAYSAME_LEGS);   // resolved lazily, if a tie-break needs one
    
      const mpDeck = mapDeck(cfg);
      const mpLegs = mpDeck.slice(0, MAP_LEGS);
      const mpSpare = mpDeck.slice(MAP_LEGS);
    
      const fgLevels = flagLevelsOf(cfg);
      const fgDeck = flagDeck(cfg, fgLevels);
      const fgLegs = fgDeck.slice(0, FLAG_LEGS);
      const fgSpare = fgDeck.slice(FLAG_LEGS);   // every other flag at the level: swaps and tie-breakers
    
      const dsLevels = dishLevelsOf(cfg);
      const dsDeck = dishDeck(cfg, dsLevels);
      const dsLegs = dsDeck.slice(0, DISH_LEGS);
      const dsSpare = dsDeck.slice(DISH_LEGS);
    
      const mk = (t, color) => ({
        name:t.name, captain:t.captain, players:t.players,
        score:0, ll:{ friend:true, dip:true, dbl:true }, color
      });
    
      /* Which mini-games the host actually asked for, in a fixed order so the
         plan is stable, minus any that cannot run on this bank. */
      const wanted = (cfg.minis || []).slice();
      const inter  = INTERLEAVED.filter(k => wanted.indexOf(k) > -1)
                                .filter(k => k !== 'closest' || cp.length)
                                .filter(k => k !== 'auction' || auctionPool().length)
                                .filter(k => k !== 'saysame' || ssLegs.length)
                                .filter(k => k !== 'map' || mpLegs.length)
                                .filter(k => k !== 'flag' || fgLegs.length)
                                .filter(k => k !== 'dish' || dsLegs.length);
      const hasBattle = wanted.indexOf('battle') > -1;
      /* no standard rounds: the mini-games simply run back to back, from the start */
      const plan = rounds.length ? planMinis(rounds.length, inter) : inter.map(k => ({ key:k, after:0 }));
      const M = inter.length + (hasBattle ? 1 : 0);
    
      return {
        id:uid(), startedAt:new Date().toISOString(), cfg,
        teams:[mk(cfg.teamA, 'a'), mk(cfg.teamB, 'b')],
        rounds,
        plan,                      // [{key, after}] for the interleaved ones
        hasBattle,
        miniPts: miniPointValue(rounds.length, M, hasBattle),
        battlePts: 2 * miniPointValue(rounds.length, M, hasBattle),
        done:{},                   // key -> true once that mini-game has finished
        mini:{ qs:cp, spare, base:cp.length, i:0, wins:[0, 0], subs:[], delta:[0, 0], done:false, awarded:false, tieLegs:0 },
        saySame:{ qs:ssLegs, spare:ssSpare, base:ssLegs.length, i:0, wins:[0, 0], subs:[], done:false, awarded:false, tieLegs:0 },
        mapGame:{ levels:mapLevelsOf(cfg), qs:mpLegs, spare:mpSpare, base:mpLegs.length, i:0, wins:[0, 0], subs:[], done:false, awarded:false, tieLegs:0 },
        flagGame:{ levels:fgLevels, qs:fgLegs, spare:fgSpare, base:fgLegs.length, i:0, wins:[0, 0], subs:[], done:false, awarded:false, tieLegs:0 },
        dishGame:{ levels:dsLevels, qs:dsLegs, spare:dsSpare, base:dsLegs.length, i:0, wins:[0, 0], subs:[], done:false, awarded:false, tieLegs:0, leg:dishLeg() },
        auction:null,
        r:0, seat:0, sub:'intro', miniPlayed:false,
        battle:null,
        sd:null, screen:'roundIntro'
      };
    }

    /* ctx.suddenOk: questions that can't be played in sudden death (Party: the ones a person must judge) */
    const suddenOk = ctx.suddenOk || (() => true);
    return { bank, shuffle, isFresh, suddenOk, matchDiff, pairsFor, closestPool, capacity, battlePool, battleReady, buildBattle,
             auctionPool, auctionDeck, saySamePool, drawSaySame, saySameDeck,
             mapLevelsOf, mapAt, mapPool, mapDeck, flagLevelsOf, flagPool, flagDeck,
             dishLevelsOf, dishPool, dishDeck, diffOf, pickedPair, dishLeg, buildGame };
  }


  /* ================================================================== moves
     Step 1c: the game's moves. play(g, action) changes the game `g` in place
     and returns what the screen should do about it, in order:
       { go:'screen' }            show that screen
       { render:true }            redraw the current one
       { toast:'text', ms }       the pop-up message
       { sound:'correct'|'wrong'|'soft'|'point' }
       { timer:'stop'|'pause'|'resume' }
       { next:true }              this mini-game is finished — on to whatever comes next
     Classic carries these out on one screen; Party will carry them out on
     the TV and the phones. A move that isn't allowed right now returns []
     or just a toast saying why.
       { used:q }                 mark that question as played
       { finalize:true }          the night is over — save it and show the final
       { host:[moments], vars }   Imad says something (one of his lines)
       { shake:true }             the screen shakes (a stolen point)
       { lifeline:'friend'|'dip' } open that lifeline's card
     Every move of the night is here: the standard rounds, every mini-game,
     the Battle, sudden death, and the running order between them.          */

  /* the mini-game's points to one team, or split — once */
  function awardMini(g, s, w, fx){
    if(s.awarded) return;
    s.awarded = true;
    if(w === 'split'){
      const half = Math.floor(g.miniPts / 2);
      g.teams[0].score += half; g.teams[1].score += half;
      s.award = [half, half];
      s.verdict.note = 'Split — ' + half + ' point' + (half > 1 ? 's' : '') + ' each.';
      s.verdict.winner = null;
    } else {
      g.teams[w].score += g.miniPts;
      s.award = [w === 0 ? g.miniPts : 0, w === 1 ? g.miniPts : 0];
      s.verdict.winner = w;
    }
    s.verdict.needsHost = false;
    fx.push({ sound:'point' });
  }
  /* a mini-game's last button: refused while the points still need awarding */
  function finishMini(g, key, s){
    if(s.verdict && s.verdict.needsHost) return [{ toast:'Award the mini-game points first.' }];
    g.done[key] = true;
    return [{ next:true }];
  }
  const freshLeg = () => ({ shown:1, out:[false, false], buzz:null, calls:[], k:0 });

  /* ---- decided early: keep playing for fun, or stop there ----
     Party asks once a mini-game can't be lost any more (the lead is bigger
     than the legs left). Either way the winner is paid there and then; legs
     played "for fun" still count on the mini-game's own scoreboard, never on
     the night's score. s.fun: the rest is for fun; s.asked: already asked.  */
  const LEGGED = {
    closest:{ s:(g) => g.mini, q:'miniQ', summary:'miniSummary', left:(s) => s.base - s.i },
    saysame:{ s:(g) => g.saySame, q:'sayQ', summary:'saySummary', left:(s) => s.base - s.i },
    flag:{ s:(g) => g.flagGame, q:'flagQ', summary:'flagSummary', left:(s) => s.base - s.i },
    map:{ s:(g) => g.mapGame, q:'mapQ', summary:'mapSummary', left:(s) => s.base - s.i },
    dish:{ s:(g) => g.dishGame, q:'dishQ', summary:'dishSummary', left:(s) => s.base - s.i },
    auction:{ s:(g) => g.auction, q:'auctionBid', summary:'auctionResult', left:(s) => s.n - s.leg - 1 }
  };
  /* -> { winner, spare } when this mini-game is settled with legs still to play, else null */
  function decidedEarly(g, key){
    const L = LEGGED[key], s = L && L.s(g);
    if(!s || s.fun || s.asked) return null;
    const left = L.left(s), lead = Math.abs(s.wins[0] - s.wins[1]);
    if(left <= 0 || lead <= left) return null;
    return { winner:s.wins[0] > s.wins[1] ? 0 : 1, spare:left };
  }
  /* pay the winner of a mini-game decided early (once) */
  function payEarly(g, key, s, d, fx){
    const note = 'Decided with ' + d.spare + ' to spare.';
    if(key === 'auction'){
      if(!s.awarded){ s.awarded = true; s.winner = d.winner; s.award = [d.winner === 0 ? g.miniPts : 0, d.winner === 1 ? g.miniPts : 0]; g.teams[d.winner].score += g.miniPts; fx.push({ sound:'point' }); }
      return;
    }
    if(!s.awarded){ s.verdict = { winner:d.winner, needsHost:false, note }; awardMini(g, s, d.winner, fx); }
  }
  /* a leg played for fun: the next one, or the summary (the points were paid when it was decided) */
  function funLeg(s, q, summary, fx){
    if(s.i < s.base){ fx.push({ go:q }); return fx; }
    s.done = true;
    if(s.verdict) s.verdict.note = (s.verdict.note ? s.verdict.note + ' ' : '') + 'The rest was played for fun.';
    fx.push({ go:summary });
    return fx;
  }
  const other = (t) => t === 0 ? 1 : 0;

  /* ---- Guess the Flag ---- */
  function flagAfterLeg(g, fx){
    const s = g.flagGame;
    if(s.fun) return funLeg(s, 'flagQ', 'flagSummary', fx);
    const out = bestOf(s);
    if(out === 'next'){ fx.push({ go:'flagQ' }); return fx; }
    if(out === 'level'){
      if(s.spare && s.spare.length){
        s.qs.push(s.spare.shift());
        s.tieLegs++;
        fx.push({ toast:s.wins[0] ? 'Level at ' + s.wins[0] + ' each — next flag decides it.' : 'Nobody on the board yet — next flag.', ms:3600 });
        fx.push({ go:'flagQ' });
        return fx;
      }
      s.done = true;
      s.verdict = { winner:null, needsHost:true, note:'Still level, and there are no flags left at this level. Your call.' };
      fx.push({ go:'flagSummary' });
      return fx;
    }
    const winner = out.winner;
    s.done = true;
    s.verdict = { winner, needsHost:false,
      note:s.tieLegs ? 'Settled by ' + (s.tieLegs === 1 ? 'a tie-breaker flag' : s.tieLegs + ' tie-breaker flags') + '.'
         : s.i < s.base ? 'Decided with ' + (s.base - s.i) + ' flag' + (s.base - s.i > 1 ? 's' : '') + ' to spare.' : '' };
    awardMini(g, s, winner, fx);
    fx.push({ go:'flagSummary' });
    return fx;
  }

  /* ---- Guess the Cocktail or Dish ---- */
  function dishEndLeg(g, w, fx){
    const s = g.dishGame, q = s.qs[s.i];
    fx.push({ timer:'stop' });
    s.subs.push({ q, winner:w });
    s.leg.shown = q.ings.length;
    if(w === 'none') fx.push({ toast:'Nobody got it.' });
    else {
      s.wins[w]++;
      fx.push({ sound:'correct' });
      fx.push({ toast:g.teams[w].name + ' takes ' + (s.i < s.base ? 'number ' + (s.i + 1) : 'the tie-breaker') + '.' });
    }
    fx.push({ go:'dishReveal' });
    return fx;
  }
  /* no host: once the calls are in (or time runs out), check them in order */
  function dishTurnOver(g, fx){
    const L = g.dishGame.leg;
    if(!L.calls.length) return dishEndLeg(g, 'none', fx);
    fx.push({ timer:'stop' });
    L.k = 0;
    fx.push({ go:'dishCheck' });
    return fx;
  }
  function dishAfterLeg(g, fx){
    const s = g.dishGame;
    s.leg = freshLeg();
    if(s.fun) return funLeg(s, 'dishQ', 'dishSummary', fx);
    const out = bestOf(s);
    if(out === 'next'){ fx.push({ go:'dishQ' }); return fx; }
    /* level: the table decides — one more to settle it, or a point each */
    if(out === 'level'){ fx.push({ go:'dishTie' }); return fx; }
    s.done = true;
    s.verdict = { winner:out.winner, needsHost:false,
      note:s.tieLegs ? 'Settled by ' + (s.tieLegs === 1 ? 'a tie-breaker' : s.tieLegs + ' tie-breakers') + '.' : '' };
    awardMini(g, s, out.winner, fx);
    fx.push({ go:'dishSummary' });
    return fx;
  }

  /* ---- Guess the Map ---- */
  function mapAfterLeg(g, fx){
    const s = g.mapGame;
    if(s.fun) return funLeg(s, 'mapQ', 'mapSummary', fx);
    const out = bestOf(s);
    if(out === 'next'){ fx.push({ go:'mapQ' }); return fx; }
    /* level after the three (or after a tie-breaker): the host reads the room —
       another map, or stop here with a point each */
    if(out === 'level'){ fx.push({ go:'mapTie' }); return fx; }
    s.done = true;
    s.verdict = { winner:out.winner, needsHost:false,
      note:s.tieLegs ? 'Settled by ' + (s.tieLegs === 1 ? 'a tie-breaker map' : s.tieLegs + ' tie-breaker maps') + '.'
         : s.i < s.base ? 'Decided with ' + (s.base - s.i) + ' map' + (s.base - s.i > 1 ? 's' : '') + ' to spare.' : '' };
    awardMini(g, s, out.winner, fx);
    fx.push({ go:'mapSummary' });
    return fx;
  }

  /* ---- Closest To Wins and Don't Say the Same as Me ----
     Both play every leg; level at the end means a tie-breaker leg from the
     spares while they last, then the host's call. */
  function legsFinish(g, s, o, fx){
    if(s.wins[0] === s.wins[1]){
      if(s.spare && s.spare.length){
        const q = o.draw(s.spare.shift());
        s.qs.push(q);
        fx.push({ used:q });
        s.tieLegs++;
        fx.push({ toast:'Tied after ' + (s.qs.length - 1) + ' legs — tie-breaker ' + o.what + '.', ms:3600 });
        fx.push({ go:o.again });            // s.i already points at the new one
        return fx;
      }
      s.done = true;
      s.verdict = { winner:null, needsHost:true, note:o.dry };
      fx.push({ go:o.summary });
      return fx;
    }
    const winner = s.wins[0] > s.wins[1] ? 0 : 1;
    s.done = true;
    s.verdict = { winner, needsHost:false,
      note:s.tieLegs ? 'Settled by ' + (s.tieLegs === 1 ? 'a tie-breaker leg' : s.tieLegs + ' tie-breaker legs') + '.' : '' };
    awardMini(g, s, winner, fx);
    fx.push({ go:o.summary });
    return fx;
  }
  const CLOSEST_END = { what:'question', again:'miniQ', summary:'miniSummary', draw:(q) => q,
    dry:'Tied on legs, and there are no spare Closest To questions left for another tie-breaker. Your call.' };

  /* ---- The Auction ---- */
  /* the next category off the deck; also "Change the category" — the
     skipped one goes to the back, not the bin */
  function auctionDraw(a, skip, fx){
    if(skip && a.q) a.deck.push(a.q);
    a.q = a.deck.shift() || a.q;
    if(a.q) fx.push({ used:a.q });
    a.bid = 0; a.by = null; a.count = 0;
    a.turn = a.leg % 2;                // the open alternates leg by leg
  }
  /* end of one leg: the bidder delivered or didn't; exactly one winner */
  function auctionResolve(g, fx){
    const a = g.auction;
    fx.push({ timer:'stop' });
    const made = a.count >= a.bid;
    const won  = made ? a.by : other(a.by);
    a.wins[won]++;
    a.legs.push({ q:a.q, bid:a.bid, by:a.by, count:a.count, made, won });
    fx.push({ sound:made ? 'correct' : 'wrong' }, { go:'auctionLeg' });
    return fx;
  }
  /* all legs played — the auction itself pays, not the legs */
  function auctionFinish(g, fx){
    const a = g.auction;
    a.done = true;
    a.winner = a.wins[0] > a.wins[1] ? 0 : 1;
    if(!a.awarded){
      a.awarded = true;
      a.award = [a.winner === 0 ? g.miniPts : 0, a.winner === 1 ? g.miniPts : 0];
      g.teams[a.winner].score += g.miniPts;
      fx.push({ sound:'point' });
    }
    fx.push({ go:'auctionResult' });
    return fx;
  }

  /* ---- Battle of the Captains ---- */
  /* everything already used tonight is off the table for the Battle */
  function battleSpent(g){
    const spent = new Set();
    g.rounds.forEach(r => r.q.forEach(q => spent.add(q.id)));
    (g.mini.qs || []).forEach(q => spent.add(q.id));
    (g.mini.spare || []).forEach(q => spent.add(q.id));
    (g.sdUsed || []).forEach(id => spent.add(id));
    const b = g.battle;
    if(b){
      b.qs.forEach(set => set.forEach(q => spent.add(q.id)));
      (b.tbUsed || []).forEach(id => spent.add(id));
      (b.dropped || []).forEach(id => spent.add(id));
    }
    return spent;
  }
  /* the Battle is worth double (games saved before that was so: the old value) */
  const battlePoints = (g) => g.battlePts || g.miniPts;
  function battleAward(g, fx){
    const b = g.battle;
    b.stage = 'done'; b.done = true;
    if(b.winner != null && !b.awarded){
      b.awarded = true;
      const pts = battlePoints(g);
      g.teams[b.winner].score += pts;
      b.award = [b.winner === 0 ? pts : 0, b.winner === 1 ? pts : 0];
      fx.push({ sound:'point' });
    }
    fx.push({ go:'battleSummary' });
    return fx;
  }
  /* level → a medium question, no clock, first captain in takes it; still
     level → another. bump === false swaps this tie-breaker instead. */
  function battleTieBreak(g, env, bump, fx){
    const b = g.battle, D = env.deal;
    let pool = D.battlePool(battleSpent(g), 'medium');
    if(!pool.length) pool = D.battlePool(battleSpent(g));
    if(!pool.length){
      b.stage = 'done'; b.done = true; b.winner = null;
      b.note = 'Dead level, and the bank is out of questions. Your call.';
      fx.push({ go:'battleSummary' }); return fx;
    }
    const q = D.shuffle(pool)[0];
    b.tbUsed.push(q.id);
    if(bump !== false) b.tbRounds++;
    b.stage = 'tie';
    b.tb = { q, n:b.tbRounds, shown:false };
    fx.push({ used:q }, { go:'battleTie' });
    return fx;
  }
  function battleFinish(g, env, fx){
    const b = g.battle;
    if(b.score[0] === b.score[1]) return battleTieBreak(g, env, undefined, fx);
    b.winner = b.score[0] > b.score[1] ? 0 : 1;
    return battleAward(g, fx);
  }

  /* ---- the end of the night, and sudden death ---- */
  /* tonight's themes first; wider only when they run dry */
  function suddenPool(g, D){
    const inGame = new Set();
    g.rounds.forEach(r => r.q.forEach(q => inGame.add(q.id)));
    g.mini.qs.forEach(q => inGame.add(q.id));
    (g.sdUsed || []).forEach(id => inGame.add(id));
    const themes = g.cfg.themes || [];
    const free = (q) => q.type === 'standard' && !inGame.has(q.id) && (!D.suddenOk || D.suddenOk(q));
    let pool = D.bank().filter(q => free(q) && themes.indexOf(q.theme) > -1 && D.isFresh(q));
    if(!pool.length) pool = D.bank().filter(q => free(q) && themes.indexOf(q.theme) > -1);
    if(!pool.length) pool = D.bank().filter(q => free(q) && D.isFresh(q));
    if(!pool.length) pool = D.bank().filter(free);
    return pool;
  }
  /* newLeg === false: "Change question", not another sudden-death question */
  function startSudden(g, env, newLeg, fx){
    const D = env.deal;
    const pool = suddenPool(g, D);
    if(!pool.length){
      if(newLeg === false){ fx.push({ toast:'No spare questions left to swap in.' }); return fx; }
      g.winner = null; fx.push({ finalize:true }); return fx;
    }
    const q = D.shuffle(pool)[0];
    g.sdUsed = (g.sdUsed || []).concat([q.id]);
    if(newLeg !== false) g.sdRounds = (g.sdRounds || 0) + 1;
    const offTheme = (g.cfg.themes || []).indexOf(q.theme) < 0;
    g.sd = { q, n:g.sdRounds, shown:false, offTheme };
    fx.push({ used:q });
    if(offTheme) fx.push({ toast:'Tonight themes are out of spare questions — pulling from ' + q.theme + '.', ms:4200 });
    fx.push({ go:'sudden' });
    return fx;
  }
  function endGame(g, env, fx){
    if(g.teams[0].score === g.teams[1].score) return startSudden(g, env, undefined, fx);
    g.winner = g.teams[0].score > g.teams[1].score ? 0 : 1;
    fx.push({ finalize:true });
    return fx;
  }

  /* ---- the running order ---- */
  /* which TEAM sits in slot `seat` of a round (who answers first) */
  function seatTeam(g, round, seat, settings){
    const flip = settings && settings.alternateFirst && (round.n % 2 === 0);
    return flip ? (seat === 0 ? 1 : 0) : seat;
  }
  const pointValue = (round, owner) => round.dbl[owner] ? 2 : 1;
  /* every mini-game still owed after round r */
  const minisAfter = (g, r) => (g.plan || []).filter(p => p.after === r && !g.done[p.key]);
  function startMini(g, env, key, fx){
    if(key === 'closest'){ fx.push({ go:'miniIntro' }); return fx; }
    if(key === 'auction'){ MOVES['auction/build'](g, {}, env).forEach(f => fx.push(f)); fx.push({ go:'auctionIntro' }); return fx; }
    if(key === 'saysame'){ fx.push({ go:'sayIntro' }); return fx; }
    if(key === 'map'){ fx.push({ go:'mapIntro' }); return fx; }
    if(key === 'flag'){ fx.push({ go:'flagIntro' }); return fx; }
    if(key === 'dish'){ fx.push({ go:'dishIntro' }); return fx; }
    if(key === 'battle'){ MOVES['battle/build'](g, {}, env).forEach(f => fx.push(f)); return fx; }
    return fx;
  }
  /* after a round or a mini-game: the next mini-game owed against this
     round, else the next round, else the Battle (chosen in Setup), else the end */
  function nextStep(g, env, fx){
    const owed = minisAfter(g, g.r);
    if(owed.length) return startMini(g, env, owed[0].key, fx);
    g.r = Math.min(g.r + 1, g.rounds.length);
    if(g.r < g.rounds.length){ g.seat = 0; fx.push({ go:'roundIntro' }); return fx; }
    if(g.hasBattle && !g.done.battle) return startMini(g, env, 'battle', fx);
    return endGame(g, env, fx);
  }
  /* points to a team, with the pop-up that says so */
  function award(g, team, pts, why, fx){
    g.teams[team].score += pts;
    fx.push({ sound:'point' });
    fx.push({ toast:g.teams[team].name + ' +' + pts + ' ' + (pts === 1 ? 'point' : 'points') + (why ? ' — ' + why : '') });
  }

  const MOVES = {
    /* the game has just been dealt: the first round, or straight into the mini-games */
    'game/start'(g, a, env){ return g.rounds.length ? [{ go:'roundIntro' }] : nextStep(g, env, []); },

    /* ---- the standard rounds ---- */
    /* double points is armed (or un-armed) at the round intro, before the questions */
    'round/armDbl'(g, a){
      const i = a.i, rd = g.rounds[g.r], fx = [];
      if(!g.teams[i].ll.dbl) return fx;
      rd.dbl[i] = !rd.dbl[i];
      if(rd.dbl[i]) fx.push({ host:['ll_dbl'], vars:{ t:i } });
      fx.push({ sound:'soft' }, { render:true });
      return fx;
    },
    /* Start: an armed double is spent from that moment */
    'round/begin'(g){
      const rd = g.rounds[g.r];
      [0, 1].forEach(i => { if(rd.dbl[i]) g.teams[i].ll.dbl = false; });
      g.seat = 0;
      return [{ go:'ask' }];
    },
    /* "Change this question": the next one in the theme at this difficulty.
       One list for the whole round, so a question skipped on Team A doesn't
       come back on Team B; the current one can return at the end of a lap. */
    'round/swap'(g, a, env){
      const D = env.deal, rd = g.rounds[g.r], seat = g.seat;
      const elsewhere = new Set();
      g.rounds.forEach((r, ri) => r.q.forEach((q, si) => { if(ri !== g.r || si !== seat) elsewhere.add(q.id); }));
      g.mini.qs.forEach(q => elsewhere.add(q.id));
      const list = D.bank().filter(q =>
        q.type === 'standard' && q.theme === rd.theme &&
        D.matchDiff(q, D.diffOf(g.cfg, rd.theme)) && !elsewhere.has(q.id));
      const none = [{ toast:'No other question left in ' + rd.theme + ' at this difficulty.', ms:4000 }];
      if(list.length < 2) return none;
      const cur = rd.q[seat];
      const seen = rd.swapSeen = rd.swapSeen || [];
      if(seen.indexOf(cur.id) < 0) seen.push(cur.id);
      let next = list.filter(q => seen.indexOf(q.id) < 0)[0];
      if(!next){                                    // whole theme exhausted — start again
        seen.length = 0; seen.push(cur.id);
        next = list.filter(q => q.id !== cur.id)[0];
      }
      if(!next) return none;
      seen.push(next.id);
      rd.q[seat] = next;
      rd.strict = false;
      rd.picked = false;                 // no longer the pair the host chose by hand
      return [{ used:next }, { toast:'New question.' }, { go:'ask' }];
    },
    /* a lifeline: key 'friend' | 'dip', i the team. With double armed, one extra only. */
    'round/lifeline'(g, a){
      const key = a.key, i = a.i, rd = g.rounds[g.r], t = g.teams[i];
      if(!t.ll[key]) return [];
      if(rd.dbl[i] && rd.llUsed[i].length >= 1) return [{ toast:'Double points is armed — one extra lifeline only.' }];
      t.ll[key] = false;
      rd.llUsed[i].push(key);
      return [{ timer:'pause' }, { lifeline:key }, { host:['ll_' + key], vars:{ t:i } },
              { toast:t.name + ' used ' + (key === 'friend' ? 'Call a Friend' : key === 'dip' ? 'Double Dip' : 'Double Points') + '.' }];
    },
    /* right: v true | false */
    'round/judge'(g, a, env){
      const rd = g.rounds[g.r], ti = seatTeam(g, rd, g.seat, env.settings), fx = [];
      rd.res[g.seat] = { correct:a.v, stolen:false };
      if(a.v){
        const p = pointValue(rd, ti);
        fx.push({ host:['correct'], vars:{ t:ti } });
        rd.pts[ti] += p; award(g, ti, p, '', fx);
        fx.push({ go:'answer' });
        return fx;
      }
      /* wrong: the other team gets a steal — except with no host, where it's straight to the answer */
      fx.push({ sound:'wrong' }, { host:g.hostless ? ['wrong'] : ['wrong', 'steal'], vars:{ t:ti } }, { go:g.hostless ? 'answer' : 'steal' });
      return fx;
    },
    'round/judgeSteal'(g, a, env){
      const rd = g.rounds[g.r], owner = seatTeam(g, rd, g.seat, env.settings), th = other(owner), fx = [];
      /* back: the steal was the very answer the first team gave, so the point is theirs (Party, no host) */
      if(a.v && a.back){
        const p = pointValue(rd, owner);
        rd.res[g.seat] = { correct:true, stolen:false, same:true, steal:true };
        rd.pts[owner] += p; award(g, owner, p, 'same answer as theirs', fx);
        fx.push({ go:'answer' });
        return fx;
      }
      rd.res[g.seat].stolen = a.v;
      rd.res[g.seat].steal = true;
      if(a.v){
        const p = pointValue(rd, owner);
        fx.push({ host:['stolen'], vars:{ t:th } }, { shake:true });
        rd.pts[th] += p; award(g, th, p, 'steal', fx);
      } else fx.push({ sound:'wrong' }, { host:['nosteal'], vars:{ t:th } });
      fx.push({ go:'answer' });
      return fx;
    },
    /* an appeal after the steal (Party, no host): the first team says it was right, the
       other captain agrees (ok) or not; once per question. Agreed: the point is theirs,
       and a steal that scored gives it back. */
    'round/appeal'(g, a, env){
      const rd = g.rounds[g.r], res = rd.res[g.seat], owner = seatTeam(g, rd, g.seat, env.settings), th = other(owner), fx = [];
      if(!res || res.correct || res.appealed) return fx;
      res.appealed = true;
      if(!a.ok){ fx.push({ toast:'Appeal turned down.' }, { render:true }); return fx; }
      const p = pointValue(rd, owner);
      if(res.stolen){ rd.pts[th] -= p; g.teams[th].score -= p; res.stolen = false; }
      res.correct = true;
      rd.pts[owner] += p; award(g, owner, p, 'appeal agreed', fx);
      fx.push({ render:true });
      return fx;
    },
    /* A call changed on the answer card (Party: both captains agreed, or the host decided).
       line 'first' (the first team's answer) or 'steal'; v the new verdict. The score moves by
       the difference only: what this question gave before, against what it gives now. */
    'round/rule'(g, a, env){
      const rd = g.rounds[g.r], res = rd.res[g.seat], fx = [];
      if(!res) return fx;
      const owner = seatTeam(g, rd, g.seat, env.settings), th = other(owner), p = pointValue(rd, owner);
      const gives = (r) => { const out = [0, 0]; if(r.correct) out[owner] = p; else if(r.stolen) out[th] = p; return out; };
      const before = gives(res);
      if(a.line === 'first'){ res.correct = !!a.v; if(res.correct) res.stolen = false; }
      else if(a.line === 'steal'){ if(!res.steal || res.correct) return fx; res.stolen = !!a.v; }
      else return fx;
      res.ruled = true;
      const after = gives(res);
      [0, 1].forEach(t => { const d = after[t] - before[t]; if(d){ rd.pts[t] += d; g.teams[t].score += d; } });
      const won = after[0] ? 0 : after[1] ? 1 : null;
      fx.push({ sound:won == null ? 'wrong' : 'point' });
      fx.push({ toast:'Call changed: ' + (won == null ? 'nobody scores this one.' : g.teams[won].name + ' +' + p + (p === 1 ? ' point.' : ' points.')) });
      fx.push({ render:true });
      return fx;
    },
    /* The first team's RIGHT was turned into WRONG after all, with no steal played: the answer is
       already on the screen, so the other team steals a new question from the same theme. */
    'round/freshSteal'(g, a, env){
      const D = env.deal, rd = g.rounds[g.r], seat = g.seat, res = rd.res[seat];
      if(!res || res.correct || res.steal || res.fresh) return [];
      const inUse = new Set();
      g.rounds.forEach(r => r.q.forEach(q => inUse.add(q.id)));
      g.mini.qs.forEach(q => inUse.add(q.id));
      (rd.swapSeen || []).forEach(id => inUse.add(id));
      const theme = (q) => q.type === 'standard' && q.theme === rd.theme && !inUse.has(q.id);
      let list = D.bank().filter(q => theme(q) && D.matchDiff(q, D.diffOf(g.cfg, rd.theme)));
      if(!list.length) list = D.bank().filter(theme);
      if(!list.length) return [{ toast:'No other question left in ' + rd.theme + ', so nobody scores this one.' }, { render:true }];
      const owner = seatTeam(g, rd, seat, env.settings), next = D.shuffle(list)[0];
      res.fresh = { q:rd.q[seat] };
      rd.q[seat] = next;
      return [{ used:next }, { toast:g.teams[other(owner)].name + ' steal a new question.' }, { go:'steal' }];
    },
    /* after the answer card: the second team's question, or the round's score */
    'round/afterAnswer'(g){
      const rd = g.rounds[g.r];
      if(g.seat === 0){ g.seat = 1; return [{ go:'ask' }]; }
      rd.done = true;
      return [{ go:'roundScore' }];
    },
    /* from the round's score: whatever comes next in the running order */
    'round/next'(g, a, env){ return nextStep(g, env, []); },


    /* deal the auction's deck when it comes round */
    'auction/build'(g, a, env){
      const deck = env.deal.auctionDeck(g.cfg), fx = [];
      if(!deck.length){ g.done.auction = true; fx.push({ toast:'No auction categories left in the bank.' }); return fx; }
      g.auction = {
        deck,                            // everything still available, in draw order
        leg:0, n:Math.min(LEGS.auction, deck.length),
        wins:[0, 0], legs:[],            // one record per finished leg
        q:null, bid:0, by:null, turn:0, count:0,
        winner:null, awarded:false, done:false
      };
      auctionDraw(g.auction, false, fx);
      return fx;
    },
    'auction/begin'(){ return [{ sound:'soft' }, { go:'auctionBid' }]; },
    /* n: the new bid */
    'auction/raise'(g, act){
      const a = g.auction, n = act.n;
      if(!(n > a.bid)) return [{ toast:'Has to beat ' + a.bid + '.' }];
      a.bid = n; a.by = a.turn; a.turn = other(a.turn);
      return [{ sound:'soft' }, { render:true }];
    },
    'auction/pass'(g){
      const a = g.auction;
      if(!a.bid) return [{ toast:'Somebody has to open first.' }];
      a.turn = a.by;                 // the standing bidder is the one on the hook
      a.ran = true;
      return [{ sound:'soft' }, { go:'auctionRun' }];
    },
    'auction/tick'(g){
      const a = g.auction, fx = [];
      a.count++;
      fx.push({ sound:'correct' });
      if(a.count >= a.bid) return auctionResolve(g, fx);   // settles itself on the target
      fx.push({ render:true });
      return fx;
    },
    'auction/untick'(g){ const a = g.auction; if(a.count) a.count--; return [{ render:true }]; },
    'auction/skip'(g){ const fx = []; auctionDraw(g.auction, true, fx); fx.push({ sound:'soft' }, { render:true }); return fx; },
    /* out of time, or "time is up" pressed */
    'auction/resolve'(g){ return auctionResolve(g, []); },
    'auction/nextLeg'(g){
      const a = g.auction, fx = [];
      a.leg++;
      if(a.fun && a.leg >= a.n){ a.done = true; fx.push({ go:'auctionResult' }); return fx; }
      if(a.leg >= a.n) return auctionFinish(g, fx);
      auctionDraw(a, false, fx);
      fx.push({ go:'auctionBid' });
      return fx;
    },
    'auction/done'(g){ g.done.auction = true; return [{ next:true }]; },

    /* deal the Battle when it comes round; not enough questions → skip to the end */
    'battle/build'(g, a, env){
      g.battle = env.deal.buildBattle(battleSpent(g));
      if(!g.battle){
        g.done.battle = true;
        return endGame(g, env, [{ toast:'Not enough spare questions left for the Battle.' }]);
      }
      return [{ go:'battleIntro' }];
    },
    /* the intro and the handoff both start here — cap and i are already set */
    'battle/start'(g){ g.battle.shown = false; return [{ go:'battleQ' }]; },
    'battle/show'(g){ g.battle.shown = true; return [{ timer:'stop' }, { render:true }]; },
    /* a question that doesn't suit the room: another at the same difficulty;
       the dropped one is remembered so it can't come straight back */
    'battle/swap'(g, a, env){
      const b = g.battle, D = env.deal, cur = b.qs[b.cap][b.i];
      let pool = D.battlePool(battleSpent(g), cur.difficulty);
      if(!pool.length) pool = D.battlePool(battleSpent(g));
      if(!pool.length) return [{ toast:'No spare question left in the bank.' }];
      b.dropped.push(cur.id);
      b.qs[b.cap][b.i] = D.shuffle(pool)[0];
      return [{ toast:'New question.' }, { go:'battleQ' }];
    },
    /* got: true | false */
    'battle/mark'(g, a, env){
      const b = g.battle, q = b.qs[b.cap][b.i], fx = [];
      b.log[b.cap][b.i] = { q, got:a.got, said:a.said };
      if(a.got){ b.score[b.cap]++; fx.push({ sound:'correct' }); } else fx.push({ sound:'wrong' });
      fx.push({ used:q });
      b.shown = false;
      b.i++;
      if(b.i < b.n){ fx.push({ go:'battleQ' }); return fx; }
      if(b.cap === 0){ b.cap = 1; b.i = 0; fx.push({ go:'battleHandoff' }); return fx; }
      /* Party, typed answers: every call can be looked at once more before the Battle is settled */
      if(a.review){ b.stage = 'review'; fx.push({ go:'battleReview' }); return fx; }
      return battleFinish(g, env, fx);
    },
    /* a Battle call changed at the review: cap's i-th answer */
    'battle/rule'(g, a){
      const b = g.battle, e = b && b.log[a.cap] && b.log[a.cap][a.i];
      if(!e || b.stage !== 'review' || e.got === !!a.got) return [];
      e.got = !!a.got; b.score[a.cap] += e.got ? 1 : -1;
      return [{ sound:e.got ? 'point' : 'wrong' }, { render:true }];
    },
    'battle/reviewDone'(g, a, env){
      const b = g.battle;
      if(!b || b.stage !== 'review') return [];
      b.stage = 'play';
      return battleFinish(g, env, []);
    },
    'battle/tbShow'(g){ g.battle.tb.shown = true; return [{ render:true }]; },
    'battle/tbSwap'(g, a, env){ return battleTieBreak(g, env, false, []); },
    /* w: 0 | 1 | 'none' (nobody got it → another) */
    'battle/tbWin'(g, a, env){
      if(a.w === 'none') return battleTieBreak(g, env, undefined, []);
      g.battle.winner = a.w;
      return battleAward(g, []);
    },
    /* a contested tie-breaker call, on the Battle's summary (or during the next tie-breaker): the
       Battle's points move to w, or (w 'none': nobody was right after all) another tie-breaker */
    'battle/tbRule'(g, a, env){
      const b = g.battle;
      if(!b || !b.tbRounds || (b.stage !== 'done' && b.stage !== 'tie')) return [];
      if(b.stage === 'done' && b.winner === a.w) return [];
      if(b.awarded && b.award){ g.teams[0].score -= b.award[0]; g.teams[1].score -= b.award[1]; }
      b.awarded = false; b.award = null; b.winner = null; b.done = false;
      if(a.w !== 0 && a.w !== 1) return battleTieBreak(g, env, undefined, []);
      b.winner = a.w;
      return battleAward(g, []);
    },
    /* the Battle's points can make a tie as easily as break one, so this hands
       back to the normal ending — which sends a level game to sudden death */
    'battle/done'(g, a, env){ g.done.battle = true; return endGame(g, env, []); },

    /* a mini-game decided early (see decidedEarly): play the rest for fun, or stop there */
    'mini/fun'(g, a){
      const L = LEGGED[a.key], s = L && L.s(g), d = decidedEarly(g, a.key) || (s && s.awarded && { winner:null, spare:0 }), fx = [];
      if(!s || !d) return [];
      if(d.winner != null) payEarly(g, a.key, s, d, fx);
      s.fun = true; s.asked = true; s.done = false;
      if(a.key === 'auction'){ s.leg++; auctionDraw(s, false, fx); }
      if(a.key === 'dish') s.leg = freshLeg();
      fx.push({ go:L.q });
      return fx;
    },
    'mini/stop'(g, a){
      const L = LEGGED[a.key], s = L && L.s(g), d = decidedEarly(g, a.key), fx = [];
      if(!s) return [];
      if(d) payEarly(g, a.key, s, d, fx);
      s.asked = true; s.done = true;
      if(a.key === 'auction'){ s.done = true; s.winner = s.wins[0] > s.wins[1] ? 0 : 1; }
      fx.push({ go:L.summary });
      return fx;
    },

    /* the last round (or mini-game) is over */
    'game/end'(g, a, env){ return endGame(g, env, []); },
    'sudden/go'(g){ g.sdReady = true; return [{ sound:'soft' }, { go:'sudden' }]; },
    'sudden/show'(g){ g.sd.shown = true; return [{ render:true }]; },
    'sudden/swap'(g, a, env){ return startSudden(g, env, false, []); },
    /* w: 0 | 1 | 'none' (neither → the next question) */
    'sudden/win'(g, a, env){
      if(a.w === 'none') return startSudden(g, env, undefined, []);
      g.teams[a.w].score += 1;
      g.winner = a.w;
      return [{ finalize:true }];
    },

    /* a contested sudden-death call, on the final screen (or during the next question): the
       night's point moves to w, or (w 'none': nobody was right after all) another question */
    'sudden/rule'(g, a, env){
      if(!g.sdRounds || g.winner === a.w) return [];
      if(g.winner === 0 || g.winner === 1){ g.teams[g.winner].score -= 1; g.winner = null; }
      if(a.w !== 0 && a.w !== 1) return startSudden(g, env, undefined, []);
      g.teams[a.w].score += 1;
      g.winner = a.w;
      return [{ finalize:true }];
    },

    'closest/start'(g){ g.mini.i = 0; return [{ go:'miniQ' }]; },
    /* a number that doesn't suit the room: another, preferably from a theme
       this mini-game hasn't used yet (one theme per leg) */
    'closest/swap'(g, a, env){
      const m = g.mini, D = env.deal;
      const inPlay = new Set();
      g.rounds.forEach(r => r.q.forEach(q => inPlay.add(q.id)));
      m.qs.forEach(q => inPlay.add(q.id));
      (m.spare || []).forEach(q => inPlay.add(q.id));
      let pool = D.bank().filter(q => q.type === 'closest' && !inPlay.has(q.id) && D.isFresh(q));
      if(!pool.length) pool = D.bank().filter(q => q.type === 'closest' && !inPlay.has(q.id));
      if(!pool.length) return [{ toast:'No spare Closest To Wins question left in the bank.' }];
      const spent = new Set(m.qs.filter((q, i) => i !== m.i).map(q => q.theme));
      const offTheme = pool.filter(q => !spent.has(q.theme));
      const q = D.shuffle(offTheme.length ? offTheme : pool)[0];
      m.qs[m.i] = q;
      return [{ used:q }, { toast:'New number question — ' + q.theme + '.' }, { go:'miniQ' }];
    },
    /* w: 0 | 1 | 'tie'; gA, gB: the two guesses when they were typed in */
    'closest/win'(g, a){
      const m = g.mini, q = m.qs[m.i], w = a.w, fx = [];
      const ga = a.gA == null ? null : a.gA, gb = a.gB == null ? null : a.gB;
      if(ga != null && gb != null){
        const ans = Number(q.answer);
        m.delta[0] += Math.abs(ga - ans); m.delta[1] += Math.abs(gb - ans);
        m.counted = true;
      }
      m.subs.push({ q, gA:ga, gB:gb, winner:w });
      if(w === 'tie'){ m.wins[0]++; m.wins[1]++; fx.push({ toast:'Tie — a point each.' }); }
      else if(w === 'none'){ fx.push({ toast:'Nobody answered — no point.' }); }
      else { m.wins[w]++; fx.push({ sound:'correct' }); fx.push({ toast:g.teams[w].name + ' takes leg ' + (m.i + 1) + '.' }); }
      m.i++;
      if(m.fun) return funLeg(m, 'miniQ', 'miniSummary', fx);
      if(m.i < m.qs.length){ fx.push({ go:'miniQ' }); return fx; }
      return legsFinish(g, m, CLOSEST_END, fx);
    },
    'closest/award'(g, a){ const fx = []; awardMini(g, g.mini, a.w, fx); fx.push({ render:true }); return fx; },
    'closest/done'(g){
      if(g.mini.verdict && g.mini.verdict.needsHost) return [{ toast:'Award the mini-game points first.' }];
      g.miniPlayed = true;
      g.done.closest = true;
      return [{ next:true }];
    },

    'say/start'(g){ g.saySame.i = 0; return [{ go:'sayQ' }]; },
    /* keep the shape: the last leg swaps for another coin flip, every other
       leg for another prompt with plenty of answers */
    'say/swap'(g, a, env){
      const s = g.saySame, D = env.deal;
      const inPlay = new Set();
      s.qs.forEach(q => inPlay.add(q.id));
      (s.spare || []).forEach(q => inPlay.add(q.id));
      const lastLeg = s.i === s.base - 1, cur = s.qs[s.i];
      const fits = (q) => lastLeg && cur.pool.length === 2 ? q.pool.length === 2 : q.pool.length >= 4;
      const avail = D.saySamePool().filter(q => !inPlay.has(q.id));
      let pool = avail.filter(fits);
      if(!pool.length) pool = avail;
      if(!pool.length) return [{ toast:'No spare prompt left in the bank.' }];
      s.qs[s.i] = D.drawSaySame(D.shuffle(pool)[0]);
      return [{ toast:'New prompt.' }, { go:'sayQ' }];
    },
    /* w: 0 | 1 | 'tie' */
    'say/verdict'(g, a, env){
      const s = g.saySame, q = s.qs[s.i], w = a.w, fx = [];
      s.subs.push({ q, winner:w });
      if(w === 'tie'){ s.wins[0]++; s.wins[1]++; fx.push({ toast:'Tie — a point each.' }); }
      else { s.wins[w]++; fx.push({ sound:'correct' }); fx.push({ toast:g.teams[w].name + ' takes leg ' + (s.i + 1) + '.' }); }
      s.i++;
      if(s.fun) return funLeg(s, 'sayQ', 'saySummary', fx);
      if(s.i < s.qs.length){ fx.push({ go:'sayQ' }); return fx; }
      /* a spare is a raw prompt — its secret word is drawn as it comes in */
      return legsFinish(g, s, { what:'prompt', again:'sayQ', summary:'saySummary', draw:(p) => env.deal.drawSaySame(p),
        dry:'Tied on legs, and there are no spare prompts left for another tie-breaker. Your call.' }, fx);
    },
    'say/award'(g, a){ const fx = []; awardMini(g, g.saySame, a.w, fx); fx.push({ render:true }); return fx; },
    'say/done'(g){ return finishMini(g, 'saysame', g.saySame); },

    'map/start'(g){ g.mapGame.i = 0; return [{ go:'mapQ' }]; },
    /* one hint per map: its subject comes up for both teams */
    'map/hint'(g){
      const s = g.mapGame, q = s.qs[s.i];
      (s.hints = s.hints || {})[q.id] = true;
      return [{ sound:'soft' }, { render:true }];
    },
    /* a map not landing tonight is swapped for one not in play */
    'map/swap'(g, a, env){
      const s = g.mapGame;
      const inPlay = new Set(s.qs.map(q => q.id));
      const pool = env.deal.mapPool(s.levels || MAP_ORDER, inPlay);
      if(!pool.length) return [{ toast:'No other map left in the bank.' }];
      const q = pool[0];
      s.spare = (s.spare || []).filter(x => x.id !== q.id);
      s.qs[s.i] = q;
      return [{ toast:'New map.' }, { go:'mapQ' }];
    },
    'map/verdict'(g, a){
      const s = g.mapGame, q = s.qs[s.i], w = a.w, fx = [];
      s.subs.push({ q, winner:w });
      if(w === 'tie'){ s.wins[0]++; s.wins[1]++; fx.push({ toast:'Both got it — a point each.' }); }
      else if(w === 'none'){ fx.push({ toast:'Nobody got it.' }); }
      else { s.wins[w]++; fx.push({ sound:'correct' }); fx.push({ toast:g.teams[w].name + ' takes map ' + (s.i + 1) + '.' }); }
      s.i++;
      return mapAfterLeg(g, fx);
    },
    'map/more'(g){
      const s = g.mapGame;
      if(!s.spare || !s.spare.length) return [{ toast:'No maps left.' }];
      s.qs.push(s.spare.shift());
      s.tieLegs++;
      return [{ go:'mapQ' }];                // s.i already points at the new map
    },
    'map/stop'(g){
      const s = g.mapGame;
      if(s.awarded) return [];
      s.done = true; s.awarded = true;
      s.award = [1, 1];
      g.teams[0].score += 1; g.teams[1].score += 1;
      s.verdict = { winner:null, needsHost:false,
        note:'Level after ' + s.i + ' map' + (s.i > 1 ? 's' : '') + ' — called there, a point each.' };
      return [{ sound:'point' }, { go:'mapSummary' }];
    },
    'map/award'(g, a){ const fx = []; awardMini(g, g.mapGame, a.w, fx); fx.push({ render:true }); return fx; },
    'map/done'(g){ return finishMini(g, 'map', g.mapGame); },

    'flag/start'(g){ g.flagGame.i = 0; return [{ go:'flagQ' }]; },
    'flag/swap'(g){
      const s = g.flagGame;
      if(!s.spare.length) return [{ toast:'No other flag left at this level.' }];
      s.qs[s.i] = s.spare.shift();
      return [{ toast:'New flag.' }, { go:'flagQ' }];
    },
    /* w: 0 | 1 | 'tie' (both right) | 'none' */
    'flag/verdict'(g, a){
      const s = g.flagGame, q = s.qs[s.i], w = a.w, fx = [];
      s.subs.push({ q, winner:w });
      if(w === 'tie'){ s.wins[0]++; s.wins[1]++; fx.push({ toast:'Both got it — a point each.' }); }
      else if(w === 'none'){ fx.push({ toast:'Nobody got it.' }); }
      else { s.wins[w]++; fx.push({ sound:'correct' }); fx.push({ toast:g.teams[w].name + ' takes flag ' + (s.i + 1) + '.' }); }
      s.i++;
      return flagAfterLeg(g, fx);
    },
    'flag/award'(g, a){ const fx = []; awardMini(g, g.flagGame, a.w, fx); fx.push({ render:true }); return fx; },
    'flag/done'(g){ return finishMini(g, 'flag', g.flagGame); },

    'dish/start'(g){ const s = g.dishGame; s.i = 0; s.leg = freshLeg(); return [{ go:'dishQ' }]; },
    'dish/swap'(g){
      const s = g.dishGame, L = s.leg;
      if(L.buzz != null || L.out[0] || L.out[1] || (L.calls || []).length) return [{ toast:'Somebody has already had a go at this one.' }];
      if(!s.spare.length) return [{ toast:'Nothing else left at these levels.' }];
      s.qs[s.i] = s.spare.shift();
      s.leg = freshLeg();
      return [{ toast:'New one.' }, { go:'dishQ' }];
    },
    /* with a host: the first captain to call it — the clock and the list stop while they answer */
    'dish/buzz'(g, a){
      const L = g.dishGame.leg, w = a.w;
      if(L.buzz != null || L.out[w]) return [];
      L.buzz = w; L.checked = false;
      return [{ timer:'pause' }, { sound:'soft' }, { render:true }];
    },
    'dish/right'(g){
      const L = g.dishGame.leg;
      if(L.buzz == null) return [];
      return dishEndLeg(g, L.buzz, []);
    },
    'dish/wrong'(g){
      const L = g.dishGame.leg;
      if(L.buzz == null) return [];
      const w = L.buzz, o = other(w), fx = [];
      L.out[w] = true; L.buzz = null;
      fx.push({ sound:'wrong' });
      if(L.out[o]) return dishEndLeg(g, 'none', fx);
      fx.push({ toast:g.teams[w].name + ' is out of this one — ' + g.teams[o].name + ', it is yours to get.', ms:3600 });
      fx.push({ timer:'resume' }, { render:true });
      return fx;
    },
    /* no host: a team has written its answer down, face down */
    'dish/write'(g, a){
      const L = g.dishGame.leg, w = a.w, fx = [];
      if(L.calls.indexOf(w) > -1) return [];
      L.calls.push(w);
      fx.push({ sound:'soft' });
      if(L.calls.length === 2) return dishTurnOver(g, fx);   // both written — nothing left to wait for
      fx.push({ toast:g.teams[w].name + ' wrote it down — ' + g.teams[other(w)].name + ', still time.', ms:3200 }, { render:true });
      return fx;
    },
    'dish/turnOver'(g){ return dishTurnOver(g, []); },
    'dish/checkYes'(g){ const L = g.dishGame.leg; return dishEndLeg(g, L.calls[L.k], []); },
    'dish/checkNo'(g){
      const L = g.dishGame.leg, fx = [{ sound:'wrong' }];
      L.k++;
      if(L.k >= L.calls.length) return dishEndLeg(g, 'none', fx);
      fx.push({ render:true });
      return fx;
    },
    /* out of time: with a host nobody scores it; without, the written answers are checked */
    'dish/timeUp'(g){ return g.hostless ? dishTurnOver(g, []) : dishEndLeg(g, 'none', []); },
    'dish/next'(g){ g.dishGame.i++; return dishAfterLeg(g, []); },
    /* a call changed at the reveal (Party): w the leg's winner now, 0 | 1 | 'none' */
    'dish/rule'(g, a){
      const s = g.dishGame, sub = s.subs[s.subs.length - 1];
      if(!sub || sub.winner === a.w) return [];
      if(sub.winner === 0 || sub.winner === 1) s.wins[sub.winner]--;
      sub.winner = a.w;
      if(a.w === 0 || a.w === 1) s.wins[a.w]++;
      return [{ toast:a.w === 0 || a.w === 1 ? 'Call changed: ' + g.teams[a.w].name + ' take it.' : 'Call changed: nobody takes it.' }, { render:true }];
    },
    /* the winning call was turned down and the other team never had its go: a new one, for both */
    'dish/replay'(g){
      const s = g.dishGame, sub = s.subs[s.subs.length - 1];
      if(!sub) return [];
      if(!s.spare.length) return MOVES['dish/rule'](g, { w:'none' });
      s.subs.pop();
      if(sub.winner === 0 || sub.winner === 1) s.wins[sub.winner]--;
      s.qs[s.i] = s.spare.shift();
      s.leg = freshLeg();
      return [{ toast:'Call changed. A new one, for both teams.' }, { go:'dishQ' }];
    },
    'dish/more'(g){
      const s = g.dishGame;
      if(!s.spare || !s.spare.length) return [{ toast:'Nothing left at these levels.' }];
      s.qs.push(s.spare.shift());
      s.tieLegs++;
      s.leg = freshLeg();
      return [{ go:'dishQ' }];
    },
    'dish/stop'(g){
      const s = g.dishGame;
      if(s.awarded) return [];
      s.done = true; s.awarded = true;
      s.award = [1, 1];
      g.teams[0].score += 1; g.teams[1].score += 1;
      s.verdict = { winner:null, needsHost:false, note:'Level — called there, a point each.' };
      return [{ sound:'point' }, { go:'dishSummary' }];
    },
    'dish/award'(g, a){ const fx = []; awardMini(g, g.dishGame, a.w, fx); fx.push({ render:true }); return fx; },
    'dish/done'(g){ return finishMini(g, 'dish', g.dishGame); }
  };
  /* env.deal: the dealer (createDealer), for moves that draw a replacement */
  function play(g, action, env){
    const move = MOVES[action && action.type];
    if(!move) throw new Error('Unknown move: ' + (action && action.type));
    env = env || {};
    const fx = move(g, action, env) || [];
    /* a finished mini-game says {next:true}; that becomes the next step here */
    const i = fx.findIndex(f => f.next);
    if(i < 0) return fx;
    return fx.slice(0, i).concat(nextStep(g, env, []), fx.slice(i + 1));
  }

  /* -------------------------------------------------------------- utilities */
  /* Fisher–Yates on a copy; `rng` defaults to Math.random (tests pass their own) */
  function shuffleWith(a, rng){
    const r = rng || Math.random, b = a.slice();
    for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }

  return { tidy, asNumber, numWords, distance, isMatch, parseNumber, COUNTRIES, miniPointValue, planMinis, bestOf, decidedEarly, shuffle:shuffleWith,
           createDealer, play, MOVES:Object.keys(MOVES), battleSpent, seatTeam, pointValue, minisAfter, LEGS, INTERLEAVED, MAP_ORDER, FLAG_LEVEL_KEYS, DISH_LEVEL_KEYS, BATTLE_SKIP_THEMES };
});
