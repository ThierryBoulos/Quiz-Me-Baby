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
     1b  dealing — the decks and the game built from a bank   (next)
     1c  the game as actions in, new state out               (after)
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

  /* -------------------------------------------------------------- utilities */
  /* Fisher–Yates on a copy; `rng` defaults to Math.random (tests pass their own) */
  function shuffle(a, rng){
    const r = rng || Math.random, b = a.slice();
    for(let i = b.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }

  return { tidy, asNumber, distance, isMatch, miniPointValue, planMinis, bestOf, shuffle };
});
