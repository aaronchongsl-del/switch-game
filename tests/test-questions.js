/* Independent answer checker for switch-questions.js.
 * Run:  node test-questions.js [path-to-game-html]
 * Every generated question is re-solved here by a different route (parsing the visible text and
 * brute-forcing / simulating), then structural rules are checked. Exits 1 on any failure.
 */
'use strict';
var fs = require('fs');
var X = require('../js/questions.js');
var I = X._internal;

/* ---- the game's rng, copied verbatim ---- */
function hash(str) { var h = 1779033703 ^ str.length; for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return function () { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }; }
function rngFrom(str) {
  var a = hash(str)(); return {
    f: function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; },
    int: function (lo, hi) { return lo + Math.floor(this.f() * (hi - lo + 1)); },
    pick: function (arr) { return arr[Math.floor(this.f() * arr.length)]; },
    shuffle: function (arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(this.f() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  };
}

var fails = {}, total = 0, N = +process.env.N || 1500;
function fail(id, msg, q) { fails[id] = fails[id] || []; if (fails[id].length < 3) fails[id].push(msg + '  ::  ' + JSON.stringify(q)); fails[id].count = (fails[id].count || 0) + 1; }
function nums(s) { return (s.match(/\d+/g) || []).map(Number); }
function ev(expr) { return Function('"use strict";return (' + expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-') + ')')(); }
function L(i) { return String.fromCharCode(65 + i); }
function lp(c) { return c.toUpperCase().charCodeAt(0) - 65; }

/* ---- per-variant solvers: return the expected answer string ---- */
var SOLVE = {};
SOLVE['maths.factor'] = function (q) {
  var sols = [], x, lhs, rhs, parts = q.big.split('=');
  for (x = 0; x <= 6000; x++) { if (Math.abs(ev(parts[0].replace('?', '(' + x + ')')) - ev(parts[1].replace('?', '(' + x + ')'))) < 1e-9) sols.push(x); }
  return sols.length === 1 ? String(sols[0]) : 'AMBIG' + sols;
};
SOLVE['maths.scale'] = function (q) { var m = q.big.split(' '), n = +m[1]; return String(m[0] === 'Half' ? n / 2 : m[0] === 'Triple' ? n * 3 : n * 2); };
SOLVE['maths.change'] = function (q) { var n = nums(q.ask); return String(n[2] - n[0] * n[1]); };
SOLVE['maths.round'] = function (q) { var to = nums(q.ask)[0], n = +q.big, lo = Math.floor(n / to) * to, hi = lo + to; if (n - lo === hi - n) return 'TIE'; return String(n - lo < hi - n ? lo : hi); };
SOLVE['maths.digitsum'] = function (q) { return String(q.big.split('').reduce(function (a, c) { return a + (+c); }, 0)); };
SOLVE['maths.square'] = function (q) { if (q.big.indexOf('²') > 0) { var n = parseInt(q.big, 10); return String(n * n); } var s = +q.big.slice(1), r = Math.round(Math.sqrt(s)); return r * r === s ? String(r) : 'NOTSQ'; };
SOLVE['maths.remainder'] = function (q) { var n = nums(q.big); return String(n[0] % n[1]); };
SOLVE['maths.fraction'] = function (q) { var n = nums(q.big); var v = n[0] * n[2] / n[1]; return Number.isInteger(v) ? String(v) : 'FRAC'; };
SOLVE['maths.mean'] = function (q) { var n = nums(q.big), s = n.reduce(function (a, b) { return a + b; }, 0); return Number.isInteger(s / n.length) ? String(s / n.length) : 'FRAC'; };
SOLVE['maths.elapsed'] = function (q) { var m = q.ask.match(/(\d+):(\d+) to (\d+):(\d+)/); var a = +m[1] % 12 * 60 + +m[2], b = +m[3] % 12 * 60 + +m[4]; return String((b - a + 720) % 720); };
SOLVE['maths.bigger'] = function (q) { var best = null, bv = -1, tie = false; q.choices.forEach(function (c) { var v = ev(c); if (v > bv) { bv = v; best = c; tie = false; } else if (v === bv) tie = true; }); return tie ? 'TIE' : best; };
SOLVE['maths.negatives'] = function (q) { return String(ev(q.big)); };
SOLVE['maths.precedence'] = function (q) { var v = ev(q.big); return Number.isInteger(v) ? String(v) : 'FRAC'; };

SOLVE['memory.count'] = function (q) { var s = q.ask.match(/How many (\S+) do/)[1]; return String(q.flash.text.split(' ').filter(function (x) { return x === s; }).length); };
SOLVE['memory.gap'] = function (q) { var n = nums(q.flash.text); return String(Math.abs(n[0] - n[1])); };
SOLVE['memory.extreme'] = function (q) { var n = nums(q.flash.text); return String(/biggest/.test(q.ask) ? Math.max.apply(null, n) : Math.min.apply(null, n)); };
SOLVE['memory.letters'] = function (q) { var s = q.flash.text.toLowerCase().split(' ').join(''); return /backwards/.test(q.ask) ? s.split('').reverse().join('') : s; };
SOLVE['memory.pairs'] = function (q) { var d = nums(q.ask)[0], m = {}; q.flash.text.split(/\s+/).forEach(function (p) { var a = p.split('='); m[a[0]] = a[1]; }); return m[d]; };
SOLVE['memory.repeat'] = function (q) { var w = q.flash.text.split(' · '), c = {}; w.forEach(function (x) { c[x] = (c[x] || 0) + 1; }); var rep = Object.keys(c).filter(function (k) { return c[k] === 2; }); return rep.length === 1 && w.length === Object.keys(c).length + 1 ? rep[0] : 'AMBIG'; };
SOLVE['memory.order'] = function (q) { var w = q.flash.text.split(' · '), m = q.ask.match(/the (\w+) word/)[1]; var i = m === 'last' ? w.length - 1 : parseInt(m, 10) - 1; return w[i]; };
SOLVE['memory.tally'] = function (q) { return String(ev(q.flash.text.replace(/\s+/g, ' ').replace(/ /g, ''))); };

/* sequences: every rule family that fits the shown terms must predict the same next value */
function seqPredictions(t) {
  var P = {}, n = t.length, i, k, ok;
  function add(v, tag) { if (Number.isFinite(v)) { P[v] = P[v] || []; P[v].push(tag); } }
  var d1 = t.slice(1).map(function (x, i2) { return x - t[i2]; }), d2 = d1.slice(1).map(function (x, i2) { return x - d1[i2]; });
  if (d1.every(function (x) { return x === d1[0]; })) add(t[n - 1] + d1[0], 'arith');
  if (d2.length >= 2 && d2.every(function (x) { return x === d2[0]; })) add(t[n - 1] + d1[n - 2] + d2[0], 'quad');
  if (t[0] !== 0 && t.every(function (x, j) { return j === 0 || x * t[0] === t[1] * t[j - 1]; })) add(t[n - 1] * t[1] / t[0], 'geo');
  if (t.every(function (x, j) { return j < 2 || x === t[j - 1] + t[j - 2]; })) add(t[n - 1] + t[n - 2], 'fib');
  /* linear recurrence x -> m*x + a */
  for (var m = -4; m <= 4; m++) for (var a = -12; a <= 12; a++) { if (t.every(function (x, j) { return j === 0 || x === m * t[j - 1] + a; })) add(m * t[n - 1] + a, 'lin' + m + ',' + a); }
  /* alternating ops (x m then + a) and (+ a then x m) */
  for (m = 2; m <= 4; m++) for (a = -9; a <= 9; a++) {
    [0, 1].forEach(function (ph) { if (t.every(function (x, j) { return j === 0 || x === ((j + ph) % 2 ? t[j - 1] * m : t[j - 1] + a); })) add(((n + ph) % 2 ? t[n - 1] * m : t[n - 1] + a), 'altops'); });
  }
  /* alternating add p / subtract q */
  for (var p = 1; p <= 12; p++) for (var qq = 1; qq <= 6; qq++) { [0, 1].forEach(function (ph) { if (t.every(function (x, j) { return j === 0 || x === t[j - 1] + ((j + ph) % 2 ? p : -qq); })) add(t[n - 1] + ((n + ph) % 2 ? p : -qq), 'altadd'); }); }
  /* two interleaved arithmetic sequences */
  var ev0 = t.filter(function (x, j) { return j % 2 === 0; }), od = t.filter(function (x, j) { return j % 2 === 1; });
  function arith(s) { return s.length >= 2 && s.slice(1).every(function (x, j) { return x - s[j] === s[1] - s[0]; }); }
  if (n >= 5 && arith(ev0) && arith(od)) { var nxt = n % 2 === 0 ? ev0[ev0.length - 1] + ev0[1] - ev0[0] : od[od.length - 1] + od[1] - od[0]; add(nxt, 'inter'); }
  /* squares/cubes with offset */
  [2, 3].forEach(function (e) { for (var off = -9; off <= 9; off++) for (var s0 = 0; s0 <= 12; s0++) { if (t.every(function (x, j) { return x === Math.pow(s0 + j, e) + off; })) add(Math.pow(s0 + n, e) + off, 'pow' + e); } });
  /* n(n+1)/2 style triangular steps: differences grow by constant */
  return P;
}
function checkSeq(id, q, shown) {
  var P = seqPredictions(shown), keys = Object.keys(P);
  if (keys.length === 0) return 'NO-RULE';
  if (keys.length > 1) return 'AMBIG:' + keys.map(function (k) { return k + '(' + P[k].slice(0, 2) + ')'; }).join('|');
  return keys[0];
}
SOLVE['logic.seqmix'] = function (q) { return checkSeq('seqmix', q, nums(q.big)); };
SOLVE['logic.letterseq'] = function (q) {
  var shown = q.big.replace(', _', '').split(', ').map(function (c) { return lp(c) + 1; });
  var r = checkSeq('letterseq', q, shown); if (/^(NO|AMBIG)/.test(r)) return r; return L(+r - 1).toLowerCase();
};
SOLVE['logic.matrix'] = function (q) {
  var rows = q.big.split('|').map(function (s) { return nums(s); }), preds = {}, p, qq, c, two = rows.slice(0, 2), top = rows[2];
  for (p = -4; p <= 4; p++) for (qq = -4; qq <= 4; qq++) { if (two.every(function (x) { return p * x[0] + qq * x[1] === x[2]; })) preds[p * top[0] + qq * top[1]] = 1; }
  for (p = -2; p <= 2; p++) for (c = -4; c <= 4; c++) {
    if (p && two.every(function (x) { return p * x[0] * x[1] + c === x[2]; })) preds[p * top[0] * top[1] + c] = 1;
    if (two.every(function (x) { return x[0] * x[0] + p * x[1] + c === x[2]; })) preds[top[0] * top[0] + p * top[1] + c] = 1;
    if (two.every(function (x) { return p * x[0] + x[1] * x[1] + c === x[2]; })) preds[p * top[0] + top[1] * top[1] + c] = 1;
  }
  var k = Object.keys(preds); return k.length === 1 ? k[0] : 'AMBIG:' + k;
};
SOLVE['logic.machine'] = function (q) {
  var pts = q.big.split('   ').map(function (s) { return nums(s); }), known = pts.slice(0, 3), qx = pts[3][0];
  function lag(x) { var s = 0; known.forEach(function (a, i) { var t = a[1]; known.forEach(function (b, j) { if (i !== j) t *= (x - b[0]) / (a[0] - b[0]); }); s += t; }); return s; }
  var v = Math.round(lag(qx) * 1e6) / 1e6; return Number.isInteger(v) && v > 0 ? String(v) : 'BAD:' + v;
};
/* syllogism: model-check over a small universe */
var SYL = {};
SOLVE['logic.syllogism'] = function (q) {
  if (SYL[q.ask]) return SYL[q.ask];
  return (SYL[q.ask] = SYLSOLVE(q));
};
function SYLSOLVE(q) {
  var sing = function (w) { return w.replace(/s$/, ''); }, sentences = q.ask.split(/(?<=[.?])\s+/), prem = [], quest = null, classes = {}, names = {};
  function cls(w) { w = sing(w.toLowerCase()); classes[w] = 1; return w; }
  sentences.forEach(function (s) {
    var m;
    if ((m = s.match(/^All (\w+) are (\w+)\.$/))) prem.push({ t: 'all', a: cls(m[1]), b: cls(m[2]) });
    else if ((m = s.match(/^No (\w+) is an? (\w+)\.$/))) prem.push({ t: 'no', a: cls(m[1]), b: cls(m[2]) });
    else if ((m = s.match(/^(\w+) is not an? (\w+)\.$/))) { names[m[1]] = 1; prem.push({ t: 'ind-not', n: m[1], b: cls(m[2]) }); }
    else if ((m = s.match(/^(\w+) is an? (\w+)\.$/))) { names[m[1]] = 1; prem.push({ t: 'ind', n: m[1], b: cls(m[2]) }); }
    else if ((m = s.match(/^Is every (\w+) an? (\w+)\?$/))) quest = { t: 'every', a: cls(m[1]), b: cls(m[2]) };
    else if ((m = s.match(/^Is (\w+) an? (\w+)\?$/))) { names[m[1]] = 1; quest = { t: 'ind', n: m[1], b: cls(m[2]) }; }
    else if ((m = s.match(/^Can an? (\w+) be an? (\w+)\?$/))) quest = { t: 'can', a: cls(m[1]), b: cls(m[2]) };
    else throw new Error('unparsed: ' + s);
  });
  var cl = Object.keys(classes), nm = Object.keys(names), U = 4, nU = U + nm.length;
  var yes = 0, no = 0, sets = {}, total = 1 << U;
  function enumerate(i, assign) {
    if (i === cl.length) {
      /* named individuals are extra elements U.. U+nm.length-1; their membership is free */
      var idxs = nm.map(function () { return 0; });
      (function ind(j) {
        if (j === nm.length) { check(assign, idxs); return; }
        for (var mask = 0; mask < (1 << cl.length); mask++) { idxs[j] = mask; ind(j + 1); }
      })(0); return;
    }
    for (var m = 0; m < (1 << (U)); m++) { assign[cl[i]] = m; enumerate(i + 1, assign); }
  }
  function inCls(assign, indMask, c, e, j) { if (e < U) return (assign[c] >> e) & 1; return (indMask[e - U] >> cl.indexOf(c)) & 1; }
  function check(assign, indMask) {
    var e, ok = true;
    prem.forEach(function (p) {
      for (e = 0; e < nU; e++) {
        if (p.t === 'all' && inCls(assign, indMask, p.a, e) && !inCls(assign, indMask, p.b, e)) ok = false;
        if (p.t === 'no' && inCls(assign, indMask, p.a, e) && inCls(assign, indMask, p.b, e)) ok = false;
      }
      if (p.t === 'ind' && !inCls(assign, indMask, p.b, U + nm.indexOf(p.n))) ok = false;
      if (p.t === 'ind-not' && inCls(assign, indMask, p.b, U + nm.indexOf(p.n))) ok = false;
    });
    if (!ok) return;
    /* classes mentioned as subjects must be inhabited (the puzzle assumes there is something to ask about) */
    var nonEmpty = function (c) { for (var e2 = 0; e2 < nU; e2++) if (inCls(assign, indMask, c, e2)) return true; return false; };
    var res;
    if (quest.t === 'every') { if (!nonEmpty(quest.a)) return; res = true; for (e = 0; e < nU; e++) if (inCls(assign, indMask, quest.a, e) && !inCls(assign, indMask, quest.b, e)) res = false; }
    else if (quest.t === 'ind') res = !!inCls(assign, indMask, quest.b, U + nm.indexOf(quest.n));
    else { if (!nonEmpty(quest.a)) return; res = false; for (e = 0; e < nU; e++) if (inCls(assign, indMask, quest.a, e) && inCls(assign, indMask, quest.b, e)) res = true; }
    if (res) yes++; else no++;
  }
  /* universe of 3 elements keeps the search small enough: 8^4 * 2^(4*nm) */
  U = 3; total = 1 << U;
  enumerate(0, {});
  if (yes && no) return "Can't tell";
  if (yes) return quest.t === 'can' ? 'Yes' : 'Yes';
  return 'No';
}
SOLVE['logic.symbols'] = function (q) {
  var syms = q.ask.match(/[▲●■◆]/g).filter(function (s, i, a) { return a.indexOf(s) === i; }); while (syms.length < 3) syms.push('x');
  var body = q.ask.replace(/^Each symbol is [^.]*\.\s*/, ''), eqs = body.split(/,|\band\b/).map(function (e) { return e.replace(/\.\s*What is.*$/, '').replace(/\.$/, '').trim(); }).filter(function (e) { return / = \d+$/.test(e); });
  var target = q.ask.match(/What is (.)\?/)[1], sols = {}, a, b, c, vals = {};
  for (a = 1; a <= 60; a++) for (b = 1; b <= 60; b++) for (c = 1; c <= 60; c++) {
    vals[syms[0]] = a; vals[syms[1]] = b; vals[syms[2]] = c;
    if (eqs.every(function (e) { var p = e.split(' = '); var expr = p[0].replace(/[▲●■◆]/g, function (s) { return vals[s]; }); return ev(expr) === +p[1]; })) sols[vals[target]] = 1;
  }
  var k = Object.keys(sols); return k.length === 1 ? k[0] : 'AMBIG:' + k;
};
SOLVE['logic.ages'] = function (q) {
  var rel = [], base = null, s = q.ask.split(/(?<=\.)\s+/), tail = s.pop(), m, ages = {};
  s.forEach(function (x) {
    if ((m = x.match(/^(\w+) is (\d+)\.$/))) ages[m[1]] = +m[2];
    else if ((m = x.match(/^(\w+) is (\d+) years (older|younger) than (\w+)\.$/))) rel.push({ a: m[1], k: +m[2], dir: m[3], b: m[4] });
  });
  var changed = true; while (changed) { changed = false; rel.forEach(function (r) { if (ages[r.b] != null && ages[r.a] == null) { ages[r.a] = ages[r.b] + (r.dir === 'older' ? r.k : -r.k); changed = true; } }); }
  var who = tail.match(/(?:old is|old will) (\w+)|will (\w+) be/); var mm = tail.match(/how old (?:is|will) (\w+)/i) || tail.match(/How old (?:is|will) (\w+)/); var name = mm[1];
  var later = (tail.match(/In (\d+) years/) || [0, 0])[1];
  return String(ages[name] + +later);
};
SOLVE['logic.oddword'] = function (q) { var i = I.oddIndex(q.choices); return i >= 0 ? q.choices[i] : 'AMBIG' + i; };

SOLVE['word.letterat'] = function (q) { var i = nums(q.ask)[0]; return /from the end/.test(q.ask) ? q.big[q.big.length - i] : q.big[i - 1]; };
SOLVE['word.alphafirst'] = function (q) { var s = q.choices.slice().sort(); return /FIRST/.test(q.ask) ? s[0] : s[3]; };
SOLVE['word.dropvowels'] = function (q) { return q.big.split('').filter(function (c) { return 'aeiou'.indexOf(c) < 0; }).join(''); };
SOLVE['word.palin'] = function (q) { var p = q.choices.filter(function (w) { return w === w.split('').reverse().join(''); }); return p.length === 1 ? p[0] : 'AMBIG'; };
SOLVE['word.doubled'] = function (q) { var p = q.choices.filter(function (w) { for (var i = 1; i < w.length; i++) if (w[i] === w[i - 1]) return true; return false; }); return p.length === 1 ? p[0] : 'AMBIG'; };
SOLVE['word.longest'] = function (q) { var m = Math.max.apply(null, q.choices.map(function (w) { return w.length; })), p = q.choices.filter(function (w) { return w.length === m; }); return p.length === 1 ? p[0] : 'AMBIG'; };
SOLVE['word.countletter'] = function (q) { var c = q.ask.match(/letter (\w)/)[1].toLowerCase(); return String(q.big.split('').filter(function (x) { return x === c; }).length); };
SOLVE['word.shiftletter'] = function (q) {
  var m;
  if ((m = q.ask.match(/= 1, B = 2, C = 3 and so on\. What is (\w) \+ (\w)\?/))) return String(lp(m[1]) + 1 + lp(m[2]) + 1);
  m = q.ask.match(/(\d+) steps (after|before) (\w)/); return L(lp(m[3]) + (m[2] === 'after' ? 1 : -1) * +m[1]).toLowerCase();
};
SOLVE['word.anagramfind'] = function (q) {
  var base = q.ask.match(/as (\w+)\?/)[1].toLowerCase(), key = base.split('').sort().join('');
  var p = q.choices.filter(function (w) { return w.split('').sort().join('') === key && w !== base; }); return p.length === 1 ? p[0] : 'AMBIG';
};

var DIRS = ['North', 'East', 'South', 'West'], ARR = ['↑', '→', '↓', '←'];
SOLVE['space.turns'] = function (q) {
  var cur = DIRS.indexOf(q.ask.match(/face (\w+)\./)[1]);
  q.ask.match(/turn (right|left|around)/g).forEach(function (t) { cur += t === 'turn right' ? 1 : t === 'turn left' ? -1 : 2; });
  return DIRS[((cur % 4) + 4) % 4];
};
SOLVE['space.path'] = function (q) { var x = 0, y = 0, m, re = /(up|down|left|right) (\d+)/g; while ((m = re.exec(q.ask))) { var k = +m[2]; if (m[1] === 'up') y += k; else if (m[1] === 'down') y -= k; else if (m[1] === 'right') x += k; else x -= k; } return '(' + x + ', ' + y + ')'; };
SOLVE['space.rotate'] = function (q) {
  var cur = ARR.indexOf(q.ask.match(/points (.)\./)[1]), re = /(quarter turn clockwise|quarter turn anticlockwise|half turn)/g, m;
  while ((m = re.exec(q.ask))) cur += m[1] === 'quarter turn clockwise' ? 1 : m[1] === 'half turn' ? 2 : -1;
  return ARR[((cur % 4) + 4) % 4];
};
SOLVE['space.dice'] = function (q) {
  var n = nums(q.ask.replace('add up to 7', '')); var top = n[0];
  if (/bottom\?$/.test(q.ask)) return String(7 - top);
  return String(7 - n[1]);
};
SOLVE['space.clockmirror'] = function (q) {
  var m = q.ask.match(/shows (\d+):(\d+)\./), h = +m[1] % 12, mi = +m[2];
  var angH = h * 30 + mi * 0.5, mir = (360 - angH) % 360, mins = Math.round(mir * 2);
  var hh = Math.floor(mins / 60) % 12 || 12; return hh + ':' + (mins % 60 < 10 ? '0' : '') + (mins % 60);
};
SOLVE['space.cubes'] = function (q) {
  var m = q.ask.match(/A (\d)×(\d)×(\d) block/), A = +m[1], B = +m[2], C = +m[3], faces = +q.ask.match(/exactly (\d)/)[1], cnt = 0, x, y, z;
  for (x = 0; x < A; x++) for (y = 0; y < B; y++) for (z = 0; z < C; z++) { var f = (x === 0 || x === A - 1) + (y === 0 || y === B - 1) + (z === 0 || z === C - 1); if (f === faces) cnt++; }
  return String(cnt);
};
SOLVE['space.squares'] = function (q) {
  var m = q.ask.match(/(\d) × (\d) grid/), a = +m[1], b = +m[2], cnt = 0, x, y, w, h;
  var squaresOnly = /squares of any size/.test(q.ask);
  for (x = 0; x < a; x++) for (y = 0; y < b; y++) for (w = 1; x + w <= a; w++) for (h = 1; y + h <= b; h++) { if (squaresOnly ? w === h : true) cnt++; }
  return String(cnt);
};
SOLVE['space.routes'] = function (q) {
  var m = q.ask.match(/(\d) squares wide and (\d) squares tall/), w = +m[1], h = +m[2];
  function go(x, y) { if (x === w && y === h) return 1; var s = 0; if (x < w) s += go(x + 1, y); if (y < h) s += go(x, y + 1); return s; }
  return String(go(0, 0));
};

SOLVE['typing.word'] = SOLVE['typing.phrase'] = SOLVE['typing.mixed'] = SOLVE['typing.digits'] = function (q) { return q.big; };
SOLVE['typing.doubles'] = function (q) { return q.big + ' ' + q.big; };
SOLVE['code.caesar'] = function (q) { var k = nums(q.ask)[0]; return q.big.split('').map(function (c) { return String.fromCharCode(97 + (c.charCodeAt(0) - 97 + k)); }).join(''); };
SOLVE['code.caesarback'] = function (q) { var k = nums(q.ask)[0]; return q.big.split('').map(function (c) { return String.fromCharCode(97 + (c.charCodeAt(0) - 97 - k)); }).join(''); };
SOLVE['code.example'] = function (q) {
  var m = q.ask.match(/(\w+) → (\w+), (\w+) → (\w+)\. What is (\w+) in code/), ex = [[m[1].toLowerCase(), m[2].toLowerCase()], [m[3].toLowerCase(), m[4].toLowerCase()]], t = m[5].toLowerCase(), preds = {};
  var k; for (k = 1; k <= 25; k++) if (ex.every(function (e) { return I.shiftWord(e[0], k) === e[1]; })) preds[I.shiftWord(t, k)] = 1;
  if (ex.every(function (e) { return I.atbash(e[0]) === e[1]; })) preds[I.atbash(t)] = 1;
  /* letter-by-letter substitution (any cipher): the target must be fully determined by the examples or by a rule family */
  var ks = Object.keys(preds); return ks.length === 1 ? ks[0] : 'AMBIG:' + ks;
};
SOLVE['code.symbolval'] = function (q) {
  var m = q.ask.match(/(.) = (\d+),\s+(.) = (\d+),\s+(.) = (\d+)/), v = {}; v[m[1]] = m[2]; v[m[3]] = m[4]; v[m[5]] = m[6];
  var r = ev(q.big.replace(/[★▲●■◆]/g, function (s) { return v[s]; })); return r > 0 && Number.isInteger(r) ? String(r) : 'BAD'; };
SOLVE['code.steps'] = function (q) {
  var parts = q.ask.replace(/ What do you get\?$/, '').split('. ').map(function (s) { return s.replace(/\.$/, ''); }), x = +parts.shift().match(/\d+/)[0];
  parts.forEach(function (p) {
    if (p === 'Double it') x *= 2; else if (p === 'Triple it') x *= 3; else if (p === 'Halve it') { if (x % 2) x = NaN; else x /= 2; } else if (p === 'Square it') x *= x;
    else if (/^Add/.test(p)) x += nums(p)[0]; else if (/^Subtract/.test(p)) x -= nums(p)[0]; else x = NaN;
  });
  return Number.isInteger(x) && x > 0 ? String(x) : 'BAD:' + x;
};
SOLVE['code.wordops'] = function (q) {
  var ops = q.ask.replace('Take the word below: ', '').replace(/\. What do you end up with\?$/, '').split(', then '), w = q.big;
  ops.forEach(function (o) {
    if (o === 'reverse it') w = w.split('').reverse().join(''); else if (o === 'drop the first letter') w = w.slice(1); else if (o === 'drop the last letter') w = w.slice(0, -1);
    else if (o === 'move the first letter to the end') w = w.slice(1) + w[0]; else w = '??';
  });
  return w;
};
SOLVE['code.digitcode'] = function (q) { var k = nums(q.ask)[0]; return q.big.split('').map(function (c) { return (+c + k) % 10; }).join(''); };

/* ---- run ---- */
var stats = {}, shapeProblems = 0;
function checkShape(id, q) {
  var bad = function (m) { fail(id, 'shape: ' + m, q); };
  if (!q || typeof q.ask !== 'string' || !q.ask) return bad('ask');
  if (['num', 'text', 'choice'].indexOf(q.kind) < 0) return bad('kind');
  if (typeof q.answer !== 'string' || !q.answer) return bad('answer');
  if (q.big != null && typeof q.big !== 'string') return bad('big type');
  if (q.ask.length > 260) bad('ask too long ' + q.ask.length);
  if (q.big && q.big.length > 42) bad('big too long ' + q.big.length);
  if (q.kind === 'num' && !/^\d+$/.test(q.answer)) bad('num answer must be non-negative digits');
  if (q.kind === 'text' && !/^[a-z]+$/.test(q.answer) && !(id.indexOf('typing.') === 0 && /^[a-z0-9]+( [a-z0-9]+)*$/.test(q.answer))) bad('text answer must be lowercase letters');
  if (q.kind === 'text' && q.answer.length > (id.indexOf('typing.') === 0 ? 24 : 12)) bad('text answer long');
  if (q.kind === 'choice') {
    if (!Array.isArray(q.choices) || q.choices.length < 3 || q.choices.length > 4) return bad('choices need 3-4 options (hint needs >=3)');
    if (q.choices.some(function (c, i) { return q.choices.indexOf(c) !== i; })) bad('duplicate choice');
    if (q.choices.filter(function (c) { return c === q.answer; }).length !== 1) bad('answer must appear exactly once');
    if (q.choices.some(function (c) { return String(c).length > 20; })) bad('choice label long');
    if (q.choices.every(function (c) { return /^\d+$/.test(c); }) && new Set(q.choices.map(Number)).size !== q.choices.length) bad('numeric dup');
  }
  if (q.flash && (!q.flash.text || !(q.flash.ms >= 800 && q.flash.ms <= 6000))) bad('flash ' + JSON.stringify(q.flash));
  if (q.cls === 'seq' && /^\d|^[A-Z],/.test(q.big || '') && !Array.isArray(q.terms) && /sequence|comes next/.test(q.ask)) bad('sequence needs terms');
  if (Array.isArray(q.terms) && !q.terms.every(Number.isFinite)) bad('terms');
}

var cats = Object.keys(X.variants);
cats.forEach(function (cat) {
  X.variants[cat].forEach(function (v) {
    var id = cat + '.' + v.id, seen = {}, n = 0, solver = SOLVE[id];
    stats[id] = { n: 0, uniq: 0, fallback: 0 };
    if (!solver) fail(id, 'NO SOLVER WRITTEN', {});
    for (var d = v.min; d <= v.max; d++) {
      for (var i = 0; i < N; i++) {
        var r = rngFrom('t:' + id + ':' + d + ':' + i), q;
        try { q = v.gen(r, d); } catch (e) { fail(id, 'THROW ' + e.message, { d: d }); continue; }
        total++; n++;
        checkShape(id, q);
        if (solver) {
          var exp; try { exp = solver(q); } catch (e) { exp = 'SOLVERTHROW ' + e.message; }
          if (exp !== q.answer) fail(id, 'WRONG d=' + d + ' expected ' + exp + ' got ' + q.answer, q);
        }
        var key = q.ask + '|' + (q.big || '') + '|' + (q.flash ? q.flash.text : '') + '|' + (q.choices ? q.choices.slice().sort().join(',') : '');
        if (!seen[key]) { seen[key] = 1; stats[id].uniq++; }
                if ((id === 'logic.matrix' && q.big === '2  3  5  |  4  1  5  |  6  2  ?') || (id === 'code.example' && /CAT → DBU, DOG → EPH/.test(q.ask))) stats[id].fallback++;
      }
    }
    stats[id].n = n;
  });
});

/* wrapper / integration against the real game generators, if a game file is given */
var gamePath = process.argv[2];
if (gamePath && fs.existsSync(gamePath)) {
  var html = fs.readFileSync(gamePath, 'utf8'), a = html.indexOf('/* ---------- rng'), b = html.indexOf('/* ---------- ranks, unlocks');
  var code = html.slice(a, b) + '\nreturn {GEN:GEN,rngFrom:rngFrom,WORDS:WORDS};';
  var G = Function(code)();
  X.install(G.GEN);
  var KEYS = ['maths', 'memory', 'logic', 'word', 'space', 'code', 'typing'], ncalls = 0, newShare = {};
  KEYS.forEach(function (k) { newShare[k] = [0, 0]; for (var d = 1; d <= 8; d++) for (var i = 0; i < 400; i++) { var q; try { q = G.GEN[k](G.rngFrom('i:' + k + d + i), d); } catch (e) { fail('install.' + k, 'THROW ' + e.message + ' d=' + d, {}); continue; } ncalls++; checkShape(q.variant ? 'install.' + k : 'EXISTING-GAME.' + k, q); newShare[k][1]++; if (q.variant) newShare[k][0]++; } });
  console.log('integration with game generators:', ncalls, 'questions; share from new variants:', KEYS.map(function (k) { return k + ' ' + Math.round(100 * newShare[k][0] / newShare[k][1]) + '%'; }).join(', '));
}

var bad = Object.keys(fails);
console.log('checked ' + total + ' generated questions across ' + Object.keys(stats).length + ' variants');
console.log('\nvariant'.padEnd(26) + 'sampled'.padStart(8) + 'distinct'.padStart(10) + '  fallback');
Object.keys(stats).forEach(function (id) { console.log(id.padEnd(25) + String(stats[id].n).padStart(8) + String(stats[id].uniq).padStart(10) + '  ' + stats[id].fallback); });
if (bad.length) {
  console.log('\nFAILURES');
  bad.forEach(function (id) { console.log('- ' + id + ' (' + fails[id].count + '):'); fails[id].forEach(function (m) { console.log('    ' + m); }); });
  process.exit(1);
} else console.log('\nALL CHECKS PASSED');
