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
       - numbers are compared as numbers: "1,000" = "1000" = "1000.0"     */
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
  /* -> true when `typed` counts as `answer` (or any of `accept`) */
  function isMatch(typed, answer, accept){
    const tn = asNumber(typed);
    const wanted = variants(answer).concat(accept || []);
    for(const w of wanted){
      const wn = asNumber(w);
      if(tn != null && wn != null){ if(tn === wn) return true; continue; }
      const a = tidy(typed), b = tidy(w);
      if(!a || !b) continue;
      if(a === b || a.replace(/ /g, '') === b.replace(/ /g, '')) return true;
      if(distance(a, b) <= allowance(b.length)) return true;
    }
    return false;
  }

  /* -------------------------------------------------------- mini-game points
     What each mini-game is worth, from the standard rounds N and mini-games M.
     0.35 keeps the pool near a third of the round score; dividing by M stops
     three mini-games tripling it; never under 2, never over 4.            */
  function miniPointValue(N, M){
    if(!M) return 0;
    return Math.max(2, Math.min(4, Math.round(0.35 * N / M)));
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
  const INTERLEAVED = ['closest', 'auction', 'saysame', 'map', 'flag', 'dish'];
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

    function drawSaySame(q){
      const pool = q.pool || [];
      return Object.assign({}, q, { answer: pool[Math.floor(rand() * pool.length)] });
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
        miniPts: miniPointValue(rounds.length, M),
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

    return { isFresh, matchDiff, pairsFor, closestPool, capacity, battlePool, battleReady, buildBattle,
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
     Moved over game by game: Guess the Flag and Cocktail or Dish first.   */

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
  const other = (t) => t === 0 ? 1 : 0;

  /* ---- Guess the Flag ---- */
  function flagAfterLeg(g, fx){
    const s = g.flagGame;
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

  const MOVES = {
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
  function play(g, action){
    const move = MOVES[action && action.type];
    if(!move) throw new Error('Unknown move: ' + (action && action.type));
    return move(g, action) || [];
  }

  /* -------------------------------------------------------------- utilities */
  /* Fisher–Yates on a copy; `rng` defaults to Math.random (tests pass their own) */
  function shuffleWith(a, rng){
    const r = rng || Math.random, b = a.slice();
    for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }

  return { tidy, asNumber, distance, isMatch, miniPointValue, planMinis, bestOf, shuffle:shuffleWith,
           createDealer, play, MOVES:Object.keys(MOVES), LEGS, INTERLEAVED, MAP_ORDER, FLAG_LEVEL_KEYS, DISH_LEVEL_KEYS, BATTLE_SKIP_THEMES };
});
