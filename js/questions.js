/* Switch question bank expansion.
 *
 * Drop-in module. Adds new puzzle variants to the four existing categories (maths, memory,
 * logic, word) and two new categories (space, code). Same generator contract as the game:
 *   gen(r, d) -> {ask, big, kind, answer, choices, flash, cls, terms}
 * where r is the game's seeded rng ({f, int, pick, shuffle}) and d is difficulty 1..8.
 *
 * Usage (inside the game script, after GEN is defined):
 *   SwitchQuestions.install(GEN);            // wraps GEN.maths/.memory/.logic/.word, adds GEN.space/.code
 * See README.md next to this file for the full plug-in checklist.
 *
 * Rules every variant follows:
 *  - one correct answer, found by working it out (no fact recall)
 *  - numeric answers are never negative (the numeric keyboard has no minus key)
 *  - choice questions always have 3 or 4 options (the game's 50/50 hint needs at least 3)
 *  - sequences return `terms` (numbers) so the gaps hint works
 *  - typed answers are lowercase; flash questions return flash:{text,ms} so the replay hint works
 */
(function (root) {
  'use strict';
  var X = { version: '1.0' };

  /* ---------- helpers ---------- */
  function V(id, min, max, gen) { return { id: id, min: min, max: max, gen: gen }; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function pickN(r, arr, n) { return r.shuffle(arr).slice(0, n); }
  function ord(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }
  function L(i) { return String.fromCharCode(65 + i); }
  function hasDouble(w) { return /(.)\1/.test(w); }
  function rev(s) { return s.split('').reverse().join(''); }
  function sortKey(w) { return w.split('').sort().join(''); }
  function distinctInts(r, n, lo, hi) {
    var out = [], used = {}, x;
    while (out.length < n) { x = r.int(lo, hi); if (!used[x]) { used[x] = 1; out.push(x); } }
    return out;
  }
  /* four numeric choices: the answer plus three plausible wrong ones (never below lo) */
  function numOpts(r, ans, cands, lo) {
    var set = [], seen = {}, k, c;
    seen[ans] = 1;
    r.shuffle(cands).forEach(function (c2) {
      if (c2 >= lo && !seen[c2] && set.length < 3) { seen[c2] = 1; set.push(c2); }
    });
    for (k = 1; set.length < 3; k++) {
      c = ans + k; if (c >= lo && !seen[c]) { seen[c] = 1; set.push(c); }
      c = ans - k; if (c >= lo && !seen[c] && set.length < 3) { seen[c] = 1; set.push(c); }
    }
    return r.shuffle([ans].concat(set)).map(String);
  }
  /* four string choices: the answer plus three distinct others */
  function strOpts(r, ans, others) {
    var pool = r.shuffle(others.filter(function (o, i) { return o !== ans && others.indexOf(o) === i; }));
    return r.shuffle([ans].concat(pool.slice(0, 3)));
  }

  /* ---------- word pools ---------- */
  var POOL = ['apple', 'bread', 'chair', 'dance', 'eagle', 'flame', 'grape', 'heart', 'input', 'jelly', 'knife', 'lemon', 'mango',
    'night', 'ocean', 'paper', 'queen', 'river', 'stone', 'tiger', 'uncle', 'voice', 'water', 'young', 'zebra', 'brick', 'cloud',
    'dream', 'earth', 'field', 'glass', 'horse', 'piano', 'tulip', 'whale', 'sheep', 'mouse', 'ghost', 'flute', 'globe',
    'planet', 'garden', 'window', 'bridge', 'forest', 'castle', 'rocket', 'silver', 'jungle', 'market', 'pencil', 'button',
    'mirror', 'pocket', 'basket', 'ribbon', 'tunnel', 'wizard', 'shadow', 'pirate', 'butter', 'candle', 'dinner', 'engine',
    'flower', 'guitar', 'hammer', 'island', 'jacket', 'kitten', 'ladder', 'magnet', 'needle', 'orange', 'parrot', 'rabbit',
    'saddle', 'ticket', 'violin', 'yellow', 'blanket', 'lantern', 'whistle', 'journey', 'thunder', 'volcano', 'balloon',
    'chimney', 'compass', 'library', 'kitchen', 'diamond', 'village', 'dolphin', 'penguin', 'teacher', 'holiday', 'mystery',
    'trumpet', 'elephant', 'umbrella', 'notebook', 'sandwich', 'mountain', 'dinosaur', 'keyboard', 'fireplace', 'telephone',
    'chocolate', 'adventure', 'crocodile', 'porcupine'];
  var SHORT = ['cat', 'dog', 'fish', 'bird', 'frog', 'duck', 'bear', 'lion', 'wolf', 'deer', 'goat', 'crab', 'moth', 'seal',
    'hawk', 'swan', 'mole', 'toad', 'lamb', 'fox', 'pear', 'plum', 'rose', 'sand', 'moon', 'star', 'rain', 'wind', 'snow', 'leaf'];
  var PALINS = ['level', 'radar', 'civic', 'kayak', 'refer', 'rotor', 'madam', 'noon', 'stats', 'tenet', 'solos', 'deed', 'peep', 'sagas', 'minim'];
  var ANAGRAMS = [['listen', 'silent', 'enlist', 'tinsel'], ['night', 'thing'], ['angel', 'glean', 'angle'], ['stale', 'least', 'steal', 'slate', 'tales'],
    ['earth', 'heart', 'hater'], ['race', 'care', 'acre'], ['stop', 'pots', 'spot', 'tops', 'post', 'opts'], ['evil', 'live', 'vile', 'veil'],
    ['dusty', 'study'], ['bored', 'robed'], ['cheap', 'peach'], ['dear', 'read', 'dare'], ['flow', 'fowl', 'wolf'], ['mate', 'meat', 'team', 'tame'],
    ['loop', 'polo', 'pool'], ['spare', 'pears', 'parse', 'spear', 'reaps', 'pares'], ['tale', 'teal'], ['deal', 'lead', 'dale'], ['siren', 'rinse'],
    ['below', 'elbow', 'bowel'], ['lemon', 'melon']];
  var NONSENSE = ['dreks', 'plorbs', 'wumps', 'zinks', 'gleeps', 'tonks', 'fizzes', 'blips', 'snarfs', 'quibs', 'morgs', 'yelps'];
  var NAMES = ['Mia', 'Leo', 'Ava', 'Kai', 'Zoe', 'Sam', 'Ivy', 'Ben', 'Noor', 'Raj', 'Eli', 'Tara'];

  var VOW = 'aeiou';
  function vowelCount(w) { return w.replace(/[^aeiou]/g, '').length; }

  /* odd-one-out checker for words: returns the index of the single word that every 3-vs-1 split
     agrees on, or -1 when there is no split, or -2 when two different features disagree. */
  /* features people actually look for. A set of four words is only used when every feature that splits it
     3-versus-1 points at the same word. (Checking "contains the letter x" for all 26 letters is impossible to satisfy:
     four words almost always have some letter in exactly one of them.) */
  var ODD_PROPS = [
    function (w) { return w.length; },
    hasDouble,
    function (w) { return VOW.indexOf(w[0]) >= 0; },
    function (w) { return VOW.indexOf(w[w.length - 1]) >= 0; },
    function (w) { return w[0] === w[w.length - 1]; },
    function (w) { return w[0]; },
    function (w) { return w[w.length - 1]; },
    function (w) { return w === rev(w); },
    function (w) { return sortKey(w) === w; },
    function (w) { return vowelCount(w); },
    function (w) { return w.length > 6; },
    function (w) { return /[jkqxyz]/.test(w); }
  ];
  /* {idx, easy}: idx is the single word every 3-vs-1 split agrees on (-1 none, -2 conflict);
     easy is true when only obvious features (length, double letter, first/last letter, vowel start/end) split the set */
  var EASY_PROPS = { 0: 1, 1: 1, 2: 1, 3: 1, 5: 1, 6: 1 };
  function oddInfo(words) {
    var found = -1, easy = true, i, j, vals, counts, odd;
    for (i = 0; i < ODD_PROPS.length; i++) {
      vals = words.map(ODD_PROPS[i]); counts = {};
      vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
      if (Object.keys(counts).length !== 2) continue;
      odd = -1;
      for (j = 0; j < 4; j++) if (counts[vals[j]] === 1) odd = j;
      if (odd < 0 || !Object.keys(counts).some(function (k) { return counts[k] === 3; })) continue;
      if (found === -1) found = odd; else if (found !== odd) return { idx: -2, easy: false };
      if (!EASY_PROPS[i]) easy = false;
    }
    return { idx: found, easy: found >= 0 && easy };
  }
  function oddIndex(words) { return oddInfo(words).idx; }
  /* built once (install() warms it up in the background), with a fixed generator so every player gets the same bank */
  var oddBank = null;
  function buildOddBank() {
    var easy = [], hard = [], seen = {}, seed = 12345, tries = 0, w, i, info, f, pos, neg, three, one, key;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function pickFrom(arr) { return arr[Math.floor(rnd() * arr.length)]; }
    function sample(arr, n) { var out = []; while (out.length < n) { var x = pickFrom(arr); if (out.indexOf(x) < 0) out.push(x); } return out; }
    var feats = [hasDouble, function (w2) { return VOW.indexOf(w2[0]) >= 0; }, function (w2) { return VOW.indexOf(w2[w2.length - 1]) >= 0; }];
    for (i = 4; i <= 9; i++) (function (n) { feats.push(function (w2) { return w2.length === n; }); })(i);
    'abcdefghilmnoprstuw'.split('').forEach(function (c) { feats.push(function (w2) { return w2[0] === c; }); });
    'aeoyrt'.split('').forEach(function (c) { feats.push(function (w2) { return w2[w2.length - 1] === c; }); });
    /* targeted: 3 words with an obvious feature + 1 without (or the reverse) */
    while (easy.length < 240 && tries < 60000) {
      tries++; f = pickFrom(feats); pos = POOL.filter(f); neg = POOL.filter(function (x) { return !f(x); });
      if (pos.length < 4 || neg.length < 4) continue;
      if (rnd() < 0.5) { three = sample(pos, 3); one = pickFrom(neg); } else { three = sample(neg, 3); one = pickFrom(pos); }
      w = three.concat([one]); info = oddInfo(w); key = w.slice().sort().join();
      if (info.idx === 3 && !seen[key]) { seen[key] = 1; easy.push({ words: w, odd: one }); }
    }
    /* open: any 4 words that happen to have exactly one odd one out, however subtle */
    for (tries = 0; hard.length < 120 && tries < 60000; tries++) {
      w = sample(POOL, 4); info = oddInfo(w); key = w.slice().sort().join();
      if (info.idx >= 0 && !info.easy && !seen[key]) { seen[key] = 1; hard.push({ words: w, odd: w[info.idx] }); }
    }
    return { easy: easy, hard: hard };
  }
  function warmOddBank() { if (!oddBank) oddBank = buildOddBank(); return oddBank; }

  /* ================= MATHS ================= */
  var maths = [
    V('factor', 1, 5, function (r, d) {
      var a = r.int(2, 5 + d), b = r.int(2, 5 + d), f = r.int(0, 3), big, ans, m, s, t;
      if (f === 0) { big = '? × ' + a + ' = ' + (a * b); ans = b; }
      else if (f === 1) { big = '? ÷ ' + a + ' = ' + b; ans = a * b; }
      else if (f === 2) { m = r.int(10, 20 + d * 10); big = '? − ' + a + ' = ' + m; ans = m + a; }
      else { s = r.int(20, 60 + d * 10); t = r.int(5, s - 5); big = s + ' − ? = ' + t; ans = s - t; }
      return { ask: 'Find the missing number', big: big, kind: 'num', answer: String(ans) };
    }),
    V('scale', 1, 3, function (r, d) {
      var w = r.pick(['Double', 'Half', 'Triple']), n, ans;
      if (w === 'Half') { n = 2 * r.int(8, 40 + d * 10); ans = n / 2; }
      else if (w === 'Triple') { n = r.int(6, 15 + d * 3); ans = n * 3; }
      else { n = r.int(12, 40 + d * 10); ans = n * 2; }
      return { ask: 'Work it out', big: w + ' ' + n, kind: 'num', answer: String(ans) };
    }),
    V('change', 1, 4, function (r, d) {
      var q = r.int(2, 4 + d), p = r.int(3, 9 + d * 2), pay = (Math.floor(q * p / 10) + 1 + r.int(0, 1)) * 10;
      return { ask: 'You buy ' + q + ' things at ' + p + ' each and pay with ' + pay + '. How much change do you get?', big: '', kind: 'num', answer: String(pay - q * p) };
    }),
    V('round', 2, 6, function (r, d) {
      var to = d <= 3 ? 10 : r.pick([10, 100]), n;
      do { n = r.int(d <= 3 ? 23 : 130, d <= 3 ? 989 : 9890); } while (n % to === to / 2 || n % to === 0);
      return { ask: 'Round to the nearest ' + to, big: String(n), kind: 'num', answer: String(Math.round(n / to) * to) };
    }),
    V('digitsum', 2, 5, function (r, d) {
      var n = r.int(d < 3 ? 100 : 1000, d < 3 ? 999 : 9999), s = String(n).split('').reduce(function (a, c) { return a + (+c); }, 0);
      return { ask: 'Add up the digits', big: String(n), kind: 'num', answer: String(s) };
    }),
    V('square', 3, 8, function (r, d) {
      var n;
      if (r.f() < 0.5) { n = r.int(11, 14 + d); return { ask: 'Square it', big: n + '²', kind: 'num', answer: String(n * n) }; }
      n = r.int(6, 10 + d); return { ask: 'Square root', big: '√' + (n * n), kind: 'num', answer: String(n) };
    }),
    V('remainder', 3, 7, function (r, d) {
      var b = r.int(4, 9), q = r.int(3, 9 + d), rem = r.int(1, b - 1);
      return { ask: 'What is the remainder?', big: (b * q + rem) + ' ÷ ' + b, kind: 'num', answer: String(rem) };
    }),
    V('fraction', 3, 8, function (r, d) {
      var den = r.pick(d < 5 ? [2, 3, 4, 5] : [3, 4, 5, 6, 8, 10]), num = r.int(1, den - 1), k = r.int(2, 12);
      return { ask: 'Work it out', big: num + '/' + den + ' of ' + (den * k), kind: 'num', answer: String(num * k) };
    }),
    V('mean', 3, 7, function (r, d) {
      var n = r.pick([3, 4, 5]), m = r.int(30, 60 + d * 5), vals = [], sum = 0, i, dev;
      for (i = 0; i < n - 1; i++) { dev = r.int(-6, 6); vals.push(m + dev); sum += dev; }
      vals.push(m - sum);
      return { ask: 'What is the average (mean) of these numbers?', big: r.shuffle(vals).join(', '), kind: 'num', answer: String(m) };
    }),
    V('elapsed', 3, 8, function (r, d) {
      var h1 = r.int(1, 11), m1 = 5 * r.int(0, 11), dur = r.pick(d < 5 ? [25, 35, 40, 50, 65, 70, 85] : [95, 105, 110, 125, 135, 145, 155, 170]);
      var tot = h1 * 60 + m1 + dur, h2 = Math.floor(tot / 60) % 12 || 12, m2 = tot % 60;
      return { ask: 'How many minutes from ' + h1 + ':' + pad2(m1) + ' to ' + h2 + ':' + pad2(m2) + '?', big: '', kind: 'num', answer: String(dur) };
    }),
    V('bigger', 3, 8, function (r, d) {
      var ex, vals, i, hi = 9 + d, best, ans;
      do {
        ex = []; vals = [];
        for (i = 0; i < 3; i++) { var a = r.int(4, hi), b = r.int(4, hi); ex.push(a + ' × ' + b); vals.push(a * b); }
        best = Math.max.apply(null, vals);
      } while (vals.filter(function (v) { return v === best; }).length > 1 || ex.some(function (e, i2) { return ex.indexOf(e) !== i2; }));
      ans = ex[vals.indexOf(best)];
      return { ask: 'Which is the biggest?', kind: 'choice', answer: ans, choices: ex };
    }),
    V('negatives', 4, 8, function (r, d) {
      var a = r.int(2, 15), b = a + r.int(3, 12), c = (b - a) + r.int(1, 15);
      return { ask: 'Solve it', big: a + ' − ' + b + ' + ' + c, kind: 'num', answer: String(a - b + c) };
    }),
    V('precedence', 4, 8, function (r, d) {
      var f = r.int(0, 2), a, b, c, e, big, ans;
      if (f === 0) { b = r.int(2, 9); c = r.int(2, 9); a = b * r.int(2, 9); e = r.int(2, 9); big = a + ' ÷ ' + b + ' + ' + c + ' × ' + e; ans = a / b + c * e; }
      else if (f === 1) { do { a = r.int(30, 90); b = r.int(2, 9); c = r.int(2, 9); } while (a <= b * c); big = a + ' − ' + b + ' × ' + c; ans = a - b * c; }
      else { a = r.int(2, 9); b = r.int(2, 9); c = r.int(10, 40); e = r.int(2, 9); big = c + ' + ' + a + ' × ' + b + ' − ' + e; ans = c + a * b - e; }
      return { ask: 'Solve it (multiply and divide first)', big: big, kind: 'num', answer: String(ans) };
    })
  ];

  /* ================= MEMORY ================= */
  var memory = [
    V('count', 1, 6, function (r, d) {
      var syms = pickN(r, ['★', '●', '▲', '■', '◆'], 3), len = Math.min(12, 6 + d), target = syms[0], n = r.int(1, Math.min(5, len - 2)), arr = [], i;
      for (i = 0; i < n; i++) arr.push(target);
      while (arr.length < len) arr.push(r.pick(syms.slice(1)));
      return { ask: 'How many ' + target + ' do you see?', flash: { text: r.shuffle(arr).join(' '), ms: 1300 + len * 260 }, kind: 'num', answer: String(n) };
    }),
    V('gap', 1, 4, function (r, d) {
      var a = r.int(30, 90 + d * 10), b = r.int(11, a - 8);
      return { ask: 'What is the difference between the two numbers?', flash: { text: a + '  and  ' + b, ms: 1600 }, kind: 'num', answer: String(a - b) };
    }),
    V('extreme', 1, 5, function (r, d) {
      var nums = distinctInts(r, 4, 11, 40 + d * 15), big = r.f() < 0.5, ans = big ? Math.max.apply(null, nums) : Math.min.apply(null, nums);
      return { ask: big ? 'Which was the biggest number?' : 'Which was the smallest number?', flash: { text: nums.join('  '), ms: 1500 + d * 100 }, kind: 'choice', answer: String(ans), choices: nums.map(String) };
    }),
    V('letters', 1, 8, function (r, d) {
      var len = Math.min(7, 3 + Math.floor((d + 1) / 2)), arr = pickN(r, 'bcdfghjkmnpqrstvwxz'.split(''), len), back = d >= 4 && r.f() < 0.5;
      return { ask: back ? 'Type the letters backwards' : 'Type the letters', flash: { text: arr.join(' ').toUpperCase(), ms: 700 + len * 450 }, kind: 'text', answer: back ? rev(arr.join('')) : arr.join('') };
    }),
    V('pairs', 2, 8, function (r, d) {
      var k = d <= 3 ? 3 : (d <= 6 ? 4 : 5), dig = pickN(r, [1, 2, 3, 4, 5, 6, 7, 8, 9], k), letters = pickN(r, 'BCDFGHJKLMNPQRSTVWXZ'.split(''), k + 3);
      var ti = r.int(0, k - 1), ans = letters[ti];
      var shown = letters.slice(0, k).filter(function (x, i) { return i !== ti; }), extras = letters.slice(k);
      var distract = r.shuffle(shown).concat(extras).slice(0, 3);
      var txt = dig.map(function (x, i) { return x + '=' + letters[i]; }).join('  ');
      return { ask: 'What letter went with ' + dig[ti] + '?', flash: { text: txt, ms: 900 + k * 650 }, kind: 'choice', answer: ans, choices: r.shuffle([ans].concat(distract)) };
    }),
    V('repeat', 2, 8, function (r, d) {
      var n = d <= 3 ? 4 : (d <= 5 ? 5 : 6), words = pickN(r, SHORT, n), rep = r.pick(words), list = r.shuffle(words.concat([rep]));
      var others = words.filter(function (w) { return w !== rep; });
      var extra = pickN(r, SHORT.filter(function (w) { return words.indexOf(w) < 0; }), 3);
      return { ask: 'One word showed up twice. Which one?', flash: { text: list.join(' · '), ms: 900 + list.length * 520 }, kind: 'choice', answer: rep, choices: r.shuffle([rep].concat(r.shuffle(others).concat(extra).slice(0, 3))) };
    }),
    V('order', 2, 8, function (r, d) {
      var n = d <= 4 ? 4 : 5, words = pickN(r, SHORT, n), idx = r.int(1, n), ans = words[idx - 1];
      var others = words.filter(function (w, i) { return i !== idx - 1; });
      return { ask: 'What was the ' + (idx === n ? 'last' : ord(idx)) + ' word?', flash: { text: words.join(' · '), ms: 900 + n * 600 }, kind: 'choice', answer: ans, choices: r.shuffle([ans].concat(r.shuffle(others).slice(0, 3))) };
    }),
    V('tally', 3, 8, function (r, d) {
      var n = Math.min(5, 2 + Math.ceil(d / 3)), tot, parts, i, x, sign;
      do {
        tot = 0; parts = [];
        for (i = 0; i < n; i++) {
          x = r.int(2, 9 + d);
          sign = (i > 0 && r.f() < 0.45 && tot - x >= 0) ? -1 : 1;
          tot += sign * x; parts.push((sign > 0 ? '+' : '−') + x);
        }
      } while (tot <= 0);
      return { ask: 'Start at 0. What is the total?', flash: { text: parts.join('  '), ms: 700 + n * 650 }, kind: 'num', answer: String(tot) };
    })
  ];

  /* ================= LOGIC ================= */
  function letterSeq(r, d) {
    var fam = r.pick(['step', 'step', 'back'].concat(d >= 4 ? ['grow'] : [], d >= 5 ? ['inter'] : [])), t = [], k, s, i;
    if (fam === 'step') { k = r.int(1, d <= 2 ? 2 : 4); s = r.int(0, 25 - 5 * k); for (i = 0; i < 6; i++) t.push(s + k * i); }
    else if (fam === 'back') { k = r.int(1, d <= 2 ? 2 : 4); s = r.int(5 * k, 25); for (i = 0; i < 6; i++) t.push(s - k * i); }
    else if (fam === 'grow') { s = r.int(0, 10); t = [s]; for (i = 1; i < 6; i++) t.push(t[i - 1] + i); }
    else { k = r.int(1, 2); s = r.int(0, 5); var e = r.int(20, 25); t = [s, e, s + k, e - k, s + 2 * k, e - 2 * k]; }
    var ans = t.pop();
    return { ask: 'What letter comes next?', big: t.map(L).join(', ') + ', _', kind: 'text', answer: L(ans).toLowerCase(), cls: 'seq', terms: t.map(function (x) { return x + 1; }) };
  }
  function oddWord(r, d) {
    var bank = warmOddBank(), list = (d <= 4 || r.f() < 0.4) ? bank.easy : bank.hard.concat(bank.easy), p = r.pick(list);
    return { ask: 'Three of these words share a feature. Which one does not belong?', kind: 'choice', answer: p.odd, choices: r.shuffle(p.words) };
  }

  var logic = [
    V('letterseq', 1, 8, letterSeq),
    V('seqmix', 3, 8, function (r, d) {
      var fam = r.pick(['shrink', 'shrink'].concat(d >= 5 ? ['altops'] : [])), t, i, s, st, m, a;
      if (fam === 'shrink') { st = r.int(5, 12); s = r.int(70, 160); t = [s]; for (i = 0; i < 5; i++) t.push(t[i] - (st - i)); }
      else { m = r.int(2, 3); a = r.int(1, 6); t = [r.int(1, 6)]; for (i = 1; i < 6; i++) t.push(i % 2 ? t[i - 1] * m : t[i - 1] + a); }
      var ans = t.pop();
      return { ask: 'What comes next?', big: t.join(', ') + ', _', kind: 'num', answer: String(ans), cls: 'seq', terms: t.slice() };
    }),
    V('matrix', 3, 8, function (r, d) {
      var rules = [
        { f: function (a, b) { return a + b; }, lo: 3 }, { f: function (a, b) { return a - b; }, lo: 3, sub: true },
        { f: function (a, b) { return a * b; }, lo: 5 }, { f: function (a, b) { return 2 * a + b; }, lo: 5 },
        { f: function (a, b) { return a * b + 1; }, lo: 7 }, { f: function (a, b) { return a + 2 * b; }, lo: 6 }
      ].filter(function (x) { return d >= x.lo; });
      var attempt, rule, rows, ans;
      for (attempt = 0; attempt < 200; attempt++) {
        rule = r.pick(rules); rows = []; var hi = d >= 6 ? 9 : 12, ok = true, i, a, b;
        for (i = 0; i < 3; i++) {
          a = r.int(2, hi); b = r.int(rule.sub ? 1 : 2, rule.sub ? a - 1 : hi);
          if (rule.sub && b >= a) { ok = false; break; }
          rows.push([a, b, rule.f(a, b)]);
        }
        if (!ok) continue;
        if (rows[0][0] === rows[1][0] && rows[0][1] === rows[1][1]) continue;
        if (matrixAmbiguous(rows)) continue;
        ans = rows[2][2];
        var txt = rows.slice(0, 2).map(function (x) { return x.join('  '); }).concat([rows[2][0] + '  ' + rows[2][1] + '  ?']).join('  |  ');
        return { ask: 'Every row follows the same rule. What is the missing number?', big: txt, kind: 'num', answer: String(ans), cls: 'seq' };
      }
      return { ask: 'Every row follows the same rule. What is the missing number?', big: '2  3  5  |  4  1  5  |  6  2  ?', kind: 'num', answer: '8', cls: 'seq' };
    }),
    V('machine', 2, 8, function (r, d) {
      var p2 = 0, p1, p0, xs, q, f, rows, qx;
      if (d >= 6 && r.f() < 0.5) { p2 = 1; p1 = r.pick([0, 0, 1]); p0 = r.int(-3, 6); } else { p1 = r.int(2, 3 + Math.floor(d / 2)); p0 = r.int(-3, 9); }
      f = function (x) { return p2 * x * x + p1 * x + p0; };
      do {
        xs = distinctInts(r, 4, 1, 12).sort(function (a, b) { return a - b; });
        qx = xs.pop(); rows = xs;
      } while (rows.some(function (x) { return f(x) < 1; }) || f(qx) < 1);
      var txt = rows.map(function (x) { return x + ' → ' + f(x); }).join('   ') + '   ' + qx + ' → ?';
      return { ask: 'A machine changes numbers by the same rule every time. What comes out?', big: txt, kind: 'num', answer: String(f(qx)), cls: 'seq' };
    }),
    V('syllogism', 3, 8, function (r, d) {
      var n = pickN(r, NONSENSE, 4), A = n[0], B = n[1], C = n[2], D = n[3], name = r.pick(NAMES);
      function sing(w) { return w.replace(/s$/, ''); }
      var forms = [
        { lo: 3, t: 'All ' + A + ' are ' + B + '. All ' + B + ' are ' + C + '. Is every ' + sing(A) + ' a ' + sing(C) + '?', a: 'Yes' },
        { lo: 3, t: 'All ' + A + ' are ' + B + '. ' + name + ' is a ' + sing(A) + '. Is ' + name + ' a ' + sing(B) + '?', a: 'Yes' },
        { lo: 4, t: 'All ' + A + ' are ' + B + '. All ' + C + ' are ' + B + '. Is every ' + sing(A) + ' a ' + sing(C) + '?', a: "Can't tell" },
        { lo: 4, t: 'All ' + A + ' are ' + B + '. ' + name + ' is a ' + sing(B) + '. Is ' + name + ' a ' + sing(A) + '?', a: "Can't tell" },
        { lo: 5, t: 'No ' + A + ' is a ' + sing(B) + '. All ' + C + ' are ' + A + '. Can a ' + sing(C) + ' be a ' + sing(B) + '?', a: 'No' },
        { lo: 6, t: 'All ' + A + ' are ' + B + '. ' + name + ' is not a ' + sing(B) + '. Is ' + name + ' a ' + sing(A) + '?', a: 'No' },
        { lo: 7, t: 'All ' + A + ' are ' + B + '. All ' + B + ' are ' + C + '. All ' + C + ' are ' + D + '. Is every ' + sing(A) + ' a ' + sing(D) + '?', a: 'Yes' }
      ].filter(function (x) { return d >= x.lo; });
      var f = r.pick(forms);
      return { ask: f.t, kind: 'choice', answer: f.a, choices: r.shuffle(['Yes', 'No', "Can't tell"]) };
    }),
    V('symbols', 3, 8, function (r, d) {
      var S = r.shuffle(['▲', '●', '■', '◆']), A = S[0], B = S[1], C = S[2], a = r.int(2, 9 + d), b = r.int(1, 9 + d), c = r.int(1, 9 + d), t;
      if (d >= 7) t = A + ' × ' + A + ' = ' + (a * a) + ',  ' + A + ' + ' + B + ' = ' + (a + b) + ',  ' + B + ' + ' + C + ' = ' + (b + c);
      else if (d >= 5) t = A + ' + ' + A + ' + ' + A + ' = ' + (3 * a) + ',  ' + A + ' + ' + B + ' = ' + (a + b) + ',  ' + B + ' + ' + C + ' = ' + (b + c);
      else return { ask: 'Each symbol is a whole number. ' + A + ' + ' + A + ' = ' + (2 * a) + ' and ' + A + ' + ' + B + ' = ' + (a + b) + '. What is ' + B + '?', big: '', kind: 'num', answer: String(b) };
      return { ask: 'Each symbol is a positive whole number. ' + t + '. What is ' + C + '?', big: '', kind: 'num', answer: String(c) };
    }),
    V('ages', 2, 6, function (r, d) {
      var nm = pickN(r, NAMES, 3), a = r.int(8, 30), x = r.int(2, 6), y = r.int(2, 6), up1 = r.f() < 0.6, up2 = r.f() < 0.6;
      var b = up1 ? a + x : a - x, c = up2 ? b + y : b - y, later = d >= 5 ? r.int(2, 6) : 0;
      if (b < 1 || c < 1) { up1 = up2 = true; b = a + x; c = b + y; }
      var s = r.shuffle([
        nm[0] + ' is ' + a + '.',
        nm[1] + ' is ' + x + ' years ' + (up1 ? 'older' : 'younger') + ' than ' + nm[0] + '.',
        nm[2] + ' is ' + y + ' years ' + (up2 ? 'older' : 'younger') + ' than ' + nm[1] + '.'
      ]).join(' ');
      return { ask: s + (later ? ' In ' + later + ' years, how old will ' + nm[2] + ' be?' : ' How old is ' + nm[2] + '?'), big: '', kind: 'num', answer: String(c + later) };
    }),
    V('oddword', 1, 8, oddWord)
  ];

  /* ================= WORD ================= */
  var word = [
    V('letterat', 1, 8, function (r, d) {
      var w = r.pick(POOL.filter(function (x) { return x.length >= 5 && x.length <= Math.min(9, 4 + d); })), fromEnd = d >= 4 && r.f() < 0.5, i = r.int(1, 4);
      var ch = fromEnd ? w[w.length - i] : w[i - 1];
      return { ask: fromEnd ? 'What is the ' + ord(i) + ' letter from the end?' : 'What is the ' + ord(i) + ' letter?', big: w, kind: 'text', answer: ch, cls: 'word' };
    }),
    V('alphafirst', 1, 6, function (r, d) {
      var first = r.f() < 0.5, words, sorted;
      do { words = pickN(r, POOL.filter(function (w) { return w.length <= 4 + d; }), 4); sorted = words.slice().sort(); }
      while (d <= 3 && words.some(function (w, i) { return words.some(function (v, j) { return i !== j && v[0] === w[0]; }); }));
      return { ask: first ? 'Which word comes FIRST in alphabetical order?' : 'Which word comes LAST in alphabetical order?', kind: 'choice', answer: first ? sorted[0] : sorted[3], choices: words };
    }),
    V('dropvowels', 3, 8, function (r, d) {
      var w = r.pick(POOL.filter(function (x) { var c = x.replace(/[aeiou]/g, ''); return x.length <= Math.min(9, 4 + d) && c.length >= 2 && c.length < x.length; }));
      return { ask: 'Remove the vowels (a, e, i, o, u). What is left?', big: w, kind: 'text', answer: w.replace(/[aeiou]/g, ''), cls: 'word' };
    }),
    V('palin', 1, 6, function (r, d) {
      var p = r.pick(PALINS), others = pickN(r, POOL.filter(function (w) { return w !== rev(w) && w.length >= 4 && w.length <= 5 + d; }), 3);
      return { ask: 'Which word reads the same backwards?', kind: 'choice', answer: p, choices: r.shuffle([p].concat(others)) };
    }),
    V('doubled', 1, 6, function (r, d) {
      var lim = 5 + d, yes = r.pick(POOL.filter(function (w) { return hasDouble(w) && w.length <= lim + 2; })), no = pickN(r, POOL.filter(function (w) { return !hasDouble(w) && w.length <= lim; }), 3);
      return { ask: 'Which word has the same letter twice in a row?', kind: 'choice', answer: yes, choices: r.shuffle([yes].concat(no)) };
    }),
    V('longest', 1, 3, function (r, d) {
      var words, lens;
      do { words = pickN(r, POOL, 4); lens = words.map(function (w) { return w.length; }); } while (lens.filter(function (l) { return l === Math.max.apply(null, lens); }).length > 1);
      return { ask: 'Which word is the longest?', kind: 'choice', answer: words[lens.indexOf(Math.max.apply(null, lens))], choices: words };
    }),
    V('countletter', 2, 8, function (r, d) {
      var phrase, c, n, tries = 0;
      do {
        phrase = d <= 4 ? r.pick(POOL.filter(function (w) { return w.length >= 6; })) : r.pick(POOL.filter(function (w) { return w.length <= 6; })) + ' ' + r.pick(POOL.filter(function (w) { return w.length >= 5 && w.length <= 7; }));
        c = r.pick(['e', 'a', 'o', 't', 'r', 's', 'l', 'i', 'n']);
        n = phrase.split('').filter(function (x) { return x === c; }).length; tries++;
      } while ((n < 1 || n > 5) && tries < 200);
      return { ask: 'How many times does the letter ' + c.toUpperCase() + ' appear?', big: phrase, kind: 'choice', answer: String(n), choices: numOpts(r, n, [n - 2, n - 1, n + 1, n + 2], 0), cls: 'word' };
    }),
    V('shiftletter', 3, 8, function (r, d) {
      if (r.f() < 0.4 && d >= 5) {
        var x = r.int(0, 25), y = r.int(0, 25);
        return { ask: 'A = 1, B = 2, C = 3 and so on. What is ' + L(x) + ' + ' + L(y) + '?', big: '', kind: 'num', answer: String(x + y + 2) };
      }
      var k = r.int(2, 3 + d), fwd = r.f() < 0.5, i = fwd ? r.int(0, 25 - k) : r.int(k, 25);
      return { ask: 'Which letter is ' + k + ' steps ' + (fwd ? 'after ' : 'before ') + L(i) + ' in the alphabet?', big: '', kind: 'text', answer: L(fwd ? i + k : i - k).toLowerCase() };
    }),
    V('anagramfind', 3, 8, function (r, d) {
      var cls = r.pick(ANAGRAMS.filter(function (c) { return c.length >= 2; })), two = pickN(r, cls, 2), base = two[0], ans = two[1], key = sortKey(base);
      var others = pickN(r, POOL.filter(function (w) { return sortKey(w) !== key && w.length >= base.length - 1 && w.length <= base.length + 1; }), 3);
      return { ask: 'Which word uses exactly the same letters as ' + base.toUpperCase() + '?', kind: 'choice', answer: ans, choices: r.shuffle([ans].concat(others)) };
    })
  ];

  /* ================= SPACE (new category) ================= */
  var DIRS = ['North', 'East', 'South', 'West'], ARROWS = ['↑', '→', '↓', '←'];
  var space = [
    V('turns', 1, 8, function (r, d) {
      var n = 2 + Math.floor(d / 3), h = r.int(0, 3), cur = h, steps = [], i, t;
      for (i = 0; i < n; i++) {
        t = r.pick(d >= 4 ? ['right', 'left', 'around'] : ['right', 'left']);
        steps.push(t); cur = (cur + (t === 'right' ? 1 : t === 'left' ? 3 : 2)) % 4;
      }
      var txt = steps.map(function (s) { return s === 'around' ? 'turn around' : 'turn ' + s; }).join(', then ');
      return { ask: 'You face ' + DIRS[h] + '. You ' + txt + '. Which way are you facing now?', visual: { kind: 'compass', deg: h * 90 }, kind: 'choice', answer: DIRS[cur], choices: r.shuffle(DIRS) };
    }),
    V('path', 2, 8, function (r, d) {
      var n = 2 + Math.floor(d / 2), x, y, parts, i, dir, k, ans, cands, opts;
      function fmt(a, b) { return '(' + a + ', ' + b + ')'; }
      do {
        x = 0; y = 0; parts = [];
        for (i = 0; i < n; i++) {
          dir = r.pick(['up', 'down', 'left', 'right']); k = r.int(1, 5);
          if (dir === 'up') y += k; else if (dir === 'down') y -= k; else if (dir === 'right') x += k; else x -= k;
          parts.push(dir + ' ' + k);
        }
        ans = fmt(x, y);
        cands = [fmt(y, x), fmt(-x, y), fmt(x, -y), fmt(x + 1, y), fmt(x - 1, y), fmt(x, y + 1), fmt(x, y - 1), fmt(-x, -y)];
        opts = strOpts(r, ans, cands);
      } while (opts.length < 4);
      return { ask: 'Start at (0, 0). Right is +x, up is +y. Move ' + parts.join(', ') + '. Where do you end up?', kind: 'choice', answer: ans, choices: opts };
    }),
    V('rotate', 1, 6, function (r, d) {
      var n = d <= 2 ? 2 : 3, cur = r.int(0, 3), start = cur, steps = [], i, t;
      for (i = 0; i < n; i++) {
        t = r.pick(['cw', 'ccw', 'half']);
        steps.push(t === 'cw' ? 'a quarter turn clockwise' : t === 'ccw' ? 'a quarter turn anticlockwise' : 'a half turn');
        cur = (cur + (t === 'cw' ? 1 : t === 'ccw' ? 3 : 2)) % 4;
      }
      return { ask: 'An arrow points ' + ARROWS[start] + '. Turn it ' + steps.join(', then ') + '. Which way does it point now?', visual: { kind: 'arrow', deg: start * 90 }, kind: 'choice', answer: ARROWS[cur], choices: r.shuffle(ARROWS) };
    }),
    V('dice', 1, 8, function (r, d) {
      var top = r.int(1, 6), front, askBottom = d <= 3 || r.f() < 0.5;
      do { front = r.int(1, 6); } while (front === top || front === 7 - top);
      var ask = 'Opposite faces of a die add up to 7. ' + (d <= 3 ? 'The top shows ' + top + '. What is on the bottom?'
        : 'The top shows ' + top + ' and the face towards you shows ' + front + '. What is on the ' + (askBottom ? 'bottom' : 'back') + '?');
      return { ask: ask, big: '', visual: { kind: 'dice', top: top }, kind: 'num', answer: String(7 - (d <= 3 || askBottom ? top : front)) };
    }),
    V('clockmirror', 3, 8, function (r, d) {
      var h, m, M, mir, fmt, ans, cands, opts;
      do { h = r.int(1, 12); m = 5 * r.int(0, 11); M = (h % 12) * 60 + m; mir = (720 - M) % 720; } while (mir === M);
      fmt = function (mins) { var hh = Math.floor(mins / 60) % 12 || 12; return hh + ':' + pad2(mins % 60); };
      ans = fmt(mir);
      cands = [fmt(M), fmt((M + 60) % 720), fmt((mir + 60) % 720), fmt((mir + 720 - 60) % 720), h + ':' + pad2((60 - m) % 60), fmt((720 - M + 30) % 720)];
      opts = strOpts(r, ans, cands);
      return { ask: 'A clock shows ' + fmt(M) + '. You look at it in a mirror. What time does the reflection show?', visual: { kind: 'clock', h: h, m: m }, kind: 'choice', answer: ans, choices: opts };
    }),
    V('cubes', 5, 8, function (r, d) {
      var hi = d <= 6 ? 4 : 5, dims = [r.int(3, hi), r.int(3, hi), r.int(3, hi)].sort(function (x, y) { return x - y; }), kind = r.pick([0, 1, 2]), a = dims[0] - 2, b = dims[1] - 2, c = dims[2] - 2, ans;
      ans = kind === 2 ? 4 * (a + b + c) : kind === 1 ? 2 * (a * b + a * c + b * c) : a * b * c;
      return { ask: 'A ' + dims.join('×') + ' block is painted red on the outside, then cut into ' + (dims[0] * dims[1] * dims[2]) + ' small cubes. How many small cubes have exactly ' + kind + ' red face' + (kind === 1 ? '' : 's') + '?', big: '', visual: { kind: 'cube', a: dims[0], b: dims[1], c: dims[2] }, kind: 'num', answer: String(ans) };
    }),
    V('squares', 4, 8, function (r, d) {
      var hi = d <= 6 ? 4 : 5, a = r.int(2, hi), b = r.int(2, hi + 1), t, k, cnt = 0;
      if (a > b) { t = a; a = b; b = t; }
      if (r.f() < 0.5) {
        for (k = 1; k <= a; k++) cnt += (a - k + 1) * (b - k + 1);
        return { ask: 'How many squares of any size can you find in a ' + a + ' × ' + b + ' grid of small squares?', big: '', visual: { kind: 'grid', w: b, h: a }, kind: 'num', answer: String(cnt) };
      }
      return { ask: 'How many rectangles of any size (squares count too) can you find in a ' + a + ' × ' + b + ' grid of small squares?', big: '', visual: { kind: 'grid', w: b, h: a }, kind: 'num', answer: String((a * (a + 1) / 2) * (b * (b + 1) / 2)) };
    }),
    V('routes', 6, 8, function (r, d) {
      var w = r.int(2, 5), h = r.int(2, 4);
      function f(a, b) { if (a === 0 || b === 0) return 1; return f(a - 1, b) + f(a, b - 1); }
      return { ask: 'You can only move right or down along the lines. How many different shortest routes lead from the top-left corner to the bottom-right corner of a grid that is ' + w + ' squares wide and ' + h + ' squares tall?', big: '', visual: { kind: 'grid', w: w, h: h, routes: true }, kind: 'num', answer: String(f(w, h)) };
    })
  ];

  /* ================= CODE (new category) ================= */
  function shiftWord(w, k) {
    return w.split('').map(function (c) { return String.fromCharCode(97 + (((c.charCodeAt(0) - 97 + k) % 26) + 26) % 26); }).join('');
  }
  function atbash(w) { return w.split('').map(function (c) { return String.fromCharCode(97 + 25 - (c.charCodeAt(0) - 97)); }).join(''); }
  function noWrap(w, k) { return w.split('').every(function (c) { var i = c.charCodeAt(0) - 97 + k; return i >= 0 && i <= 25; }); }
  var CODEWORDS = POOL.filter(function (w) { return w.length >= 3 && w.length <= 6; }).concat(SHORT.filter(function (w) { return w.length >= 3; }));

  var code = [
    V('caesar', 1, 5, function (r, d) {
      var k = r.int(1, d <= 2 ? 1 : 3), w = r.pick(CODEWORDS.filter(function (x) { return noWrap(x, k) && x.length <= 4 + Math.ceil(d / 2); }));
      return { ask: 'Move every letter ' + k + ' step' + (k === 1 ? '' : 's') + ' forward in the alphabet (A becomes ' + L(k) + ')', visual: { kind: 'strip', k: k, back: false }, big: w, kind: 'text', answer: shiftWord(w, k), cls: 'word' };
    }),
    V('caesarback', 4, 8, function (r, d) {
      var k = r.int(1, 3), w = r.pick(CODEWORDS.filter(function (x) { return noWrap(x, -k) && x.length <= 6; }));
      return { ask: 'Move every letter ' + k + ' step' + (k === 1 ? '' : 's') + ' backward in the alphabet (' + L(k) + ' becomes A)', visual: { kind: 'strip', k: 26 - k, back: true }, big: w, kind: 'text', answer: shiftWord(w, -k), cls: 'word' };
    }),
    V('example', 4, 8, function (r, d) {
      var fam = d >= 7 && r.f() < 0.5 ? 'atbash' : 'shift', k = r.int(1, 4), enc, ws, attempt;
      enc = fam === 'atbash' ? atbash : function (w) { return shiftWord(w, k); };
      for (attempt = 0; attempt < 300; attempt++) {
        ws = pickN(r, CODEWORDS.filter(function (x) { return x.length <= 5; }), 3);
        if (fam === 'shift' && !ws.every(function (w) { return noWrap(w, k); })) continue;
        if (cipherAmbiguous([[ws[0], enc(ws[0])], [ws[1], enc(ws[1])]], ws[2], enc(ws[2]))) continue;
        return { ask: 'A secret code changes letters the same way every time. ' + ws[0].toUpperCase() + ' → ' + enc(ws[0]).toUpperCase() + ', ' + ws[1].toUpperCase() + ' → ' + enc(ws[1]).toUpperCase() + '. What is ' + ws[2].toUpperCase() + ' in code?', visual: { kind: 'pairs', pairs: [[ws[0], enc(ws[0])], [ws[1], enc(ws[1])]] }, big: '', kind: 'text', answer: enc(ws[2]) };
      }
      return { ask: 'A secret code changes letters the same way every time. CAT → DBU, DOG → EPH. What is BAT in code?', big: '', kind: 'text', answer: 'cbu' };
    }),
    V('symbolval', 2, 8, function (r, d) {
      var S = pickN(r, ['★', '▲', '●', '■', '◆'], 3), v = distinctInts(r, 3, 2, 3 + d * 2), big, ans;
      if (d <= 4 || r.f() < 0.5) { big = S[0] + ' + ' + S[1] + ' + ' + S[2]; ans = v[0] + v[1] + v[2]; }
      else { do { v = distinctInts(r, 3, 2, 3 + d * 2); } while (v[0] * v[1] <= v[2]); big = S[0] + ' × ' + S[1] + ' − ' + S[2]; ans = v[0] * v[1] - v[2]; }
      return { ask: S[0] + ' = ' + v[0] + ',  ' + S[1] + ' = ' + v[1] + ',  ' + S[2] + ' = ' + v[2] + '.  Work out:', big: big, kind: 'num', answer: String(ans) };
    }),
    V('steps', 1, 8, function (r, d) {
      var n = 2 + Math.floor(d / 3), x = r.int(2, 9), start = x, txt = [], i, op, k, tries;
      for (i = 0; i < n; i++) {
        for (tries = 0; tries < 50; tries++) {
          op = r.pick(['double', 'add', 'sub', 'triple'].concat(x % 2 === 0 ? ['half'] : [], d >= 6 && x <= 12 ? ['square'] : []));
          k = r.int(2, 9);
          if (op === 'sub' && x - k < 1) continue;
          if ((op === 'double' || op === 'triple') && x > 60) continue;
          break;
        }
        if (tries === 50) op = 'add';
        if (op === 'double') { x *= 2; txt.push('Double it'); }
        else if (op === 'triple') { x *= 3; txt.push('Triple it'); }
        else if (op === 'half') { x /= 2; txt.push('Halve it'); }
        else if (op === 'square') { x *= x; txt.push('Square it'); }
        else if (op === 'add') { x += k; txt.push('Add ' + k); }
        else { x -= k; txt.push('Subtract ' + k); }
      }
      return { ask: 'Start with ' + start + '. ' + txt.join('. ') + '. What do you get?', big: '', kind: 'num', answer: String(x) };
    }),
    V('wordops', 2, 8, function (r, d) {
      var w = r.pick(POOL.filter(function (x) { return x.length >= 5 && x.length <= 7; })), n = d <= 4 ? 2 : 3, cur = w, said = [], i, op;
      var OPS = {
        reverse: { t: 'reverse it', f: rev }, dropfirst: { t: 'drop the first letter', f: function (s) { return s.slice(1); } },
        droplast: { t: 'drop the last letter', f: function (s) { return s.slice(0, -1); } }, firstend: { t: 'move the first letter to the end', f: function (s) { return s.slice(1) + s[0]; } }
      };
      var names = r.shuffle(Object.keys(OPS));
      for (i = 0; i < n; i++) { op = OPS[names[i]]; said.push(op.t); cur = op.f(cur); }
      var txt = said.join(', then ');
      return { ask: 'Take the word below: ' + txt + '. What do you end up with?', big: w, kind: 'text', answer: cur, cls: 'word' };
    }),
    V('digitcode', 2, 7, function (r, d) {
      var k = r.int(1, 4), len = 3 + Math.min(3, Math.floor(d / 2)), s = '', out = '', i, x;
      for (i = 0; i < len; i++) { x = r.int(0, 9); s += x; out += (x + k) % 10; }
      return { ask: 'A code adds ' + k + ' to every digit (9 + ' + k + ' wraps round to ' + ((9 + k) % 10) + '). Write this number in code:', big: s, kind: 'num', answer: out };
    })
  ];


  /* ================= TYPING (new category) ================= */
  var PHRASE_WORDS = ['the', 'and', 'sun', 'red', 'big', 'run', 'cold', 'warm', 'fast', 'blue', 'jump', 'tree', 'rain', 'gold', 'milk', 'door',
    'swim', 'cake', 'wind', 'path', 'bold', 'calm', 'quick', 'brown', 'green', 'river', 'light', 'storm', 'happy', 'lucky', 'under', 'above', 'track'];
  var typing = [
    V('word', 1, 8, function (r, d) {
      var w = r.pick(POOL.filter(function (x) { return x.length >= 3 + Math.floor(d / 2) && x.length <= 4 + d; }));
      return { ask: 'Type the word as fast as you can', big: w, kind: 'text', answer: w, cls: 'word' };
    }),
    V('phrase', 2, 8, function (r, d) {
      var n = d <= 4 ? 2 : (d <= 6 ? 3 : 4), ws = pickN(r, PHRASE_WORDS, n).join(' ');
      return { ask: 'Type the words, spaces included', big: ws, kind: 'text', answer: ws, cls: 'seq' };
    }),
    V('mixed', 3, 8, function (r, d) {
      var len = Math.min(8, 4 + Math.floor(d / 2)), chars = 'abcdefghjkmnpqrstuvwxyz23456789', s = '', i;
      for (i = 0; i < len; i++) s += chars[r.int(0, chars.length - 1)];
      return { ask: 'Type the code exactly', big: s, kind: 'text', answer: s, cls: 'seq' };
    }),
    V('digits', 1, 8, function (r, d) {
      var len = Math.min(9, 4 + Math.floor((d + 1) / 2)), s = '', i;
      for (i = 0; i < len; i++) s += r.int(i ? 0 : 1, 9);
      return { ask: 'Type the number as fast as you can', big: s, kind: 'num', answer: s, cls: 'seq' };
    }),
    V('doubles', 4, 8, function (r, d) {
      var w = r.pick(POOL.filter(function (x) { return x.length >= 4 && x.length <= 4 + Math.ceil(d / 2); }));
      return { ask: 'Type the word twice with a space between', big: w, kind: 'text', answer: w + ' ' + w, cls: 'word' };
    })
  ];

  /* ---------- ambiguity guards used while generating ---------- */
  function matrixAmbiguous(rows) {
    /* every simple rule that fits the two complete rows must give the same third answer */
    var preds = {}, p, q, c, top = rows[2], two = rows.slice(0, 2);
    for (p = -4; p <= 4; p++) for (q = -4; q <= 4; q++) {
      if (two.every(function (x) { return p * x[0] + q * x[1] === x[2]; })) preds[p * top[0] + q * top[1]] = 1;
    }
    for (p = -2; p <= 2; p++) for (c = -4; c <= 4; c++) {
      if (p && two.every(function (x) { return p * x[0] * x[1] + c === x[2]; })) preds[p * top[0] * top[1] + c] = 1;
      if (two.every(function (x) { return x[0] * x[0] + p * x[1] + c === x[2]; })) preds[top[0] * top[0] + p * top[1] + c] = 1;
      if (two.every(function (x) { return p * x[0] + x[1] * x[1] + c === x[2]; })) preds[p * top[0] + top[1] * top[1] + c] = 1;
    }
    return Object.keys(preds).length !== 1;
  }
  function cipherAmbiguous(examples, target, ans) {
    var preds = {}, k;
    for (k = 1; k <= 25; k++) {
      if (examples.every(function (e) { return shiftWord(e[0], k) === e[1]; })) preds[shiftWord(target, k)] = 1;
    }
    if (examples.every(function (e) { return atbash(e[0]) === e[1]; })) preds[atbash(target)] = 1;
    return Object.keys(preds).length !== 1 || !preds[ans];
  }

  /* ---------- public API ---------- */
  X.variants = { maths: maths, memory: memory, logic: logic, word: word, space: space, code: code, typing: typing };
  X.NEW_KEYS = ['space', 'code', 'typing'];
  X.TYPES = { space: { n: 'Spatial', c: 'var(--space)' }, code: { n: 'Code', c: 'var(--code)' }, typing: { n: 'Typing', c: 'var(--typing)' } };
  X.CSS = ':root{--space:#b794ff;--code:#ff8ad8;--typing:#6fa8ff}' +
    ':root[data-skin="neon"]{--space:#b57bff;--code:#ff6ad5;--typing:#5a9bff}' +
    ':root[data-skin="paper"]{--space:#6b3fc0;--code:#b4247f;--typing:#1f5fc4}';

  function eligible(list, d) {
    var pool = list.filter(function (v) { return d >= v.min && d <= v.max; });
    return pool.length ? pool : list;
  }
  /* options: mix = share of existing-category questions that come from the new variants (default 0.6) */
  X.install = function (GEN, options) {
    if (typeof setTimeout === 'function') setTimeout(warmOddBank, 0);
    var mix = options && options.mix != null ? options.mix : 0.6;
    Object.keys(X.variants).forEach(function (key) {
      var list = X.variants[key], orig = GEN[key];
      GEN[key] = function (r, d) {
        var v, q;
        if (orig && r.f() >= mix) return orig(r, d);
        v = r.pick(eligible(list, d));
        q = v.gen(r, d);
        q.variant = key + '.' + v.id;
        if (key === 'typing') q.typing = true;
        return q;
      };
    });
  };
  X._internal = { oddIndex: oddIndex, oddInfo: oddInfo, matrixAmbiguous: matrixAmbiguous, cipherAmbiguous: cipherAmbiguous, POOL: POOL, SHORT: SHORT, PALINS: PALINS, ANAGRAMS: ANAGRAMS, shiftWord: shiftWord, atbash: atbash };

  if (typeof module !== 'undefined' && module.exports) module.exports = X; else root.SwitchQuestions = X;
})(typeof window !== 'undefined' ? window : this);
