/* 两遍都没看见 · 计算核心（core.js）
 * 问题：一份稿子（作业、论文、合同、代码、PPT）请两个人各自独立查一遍错。
 *       两人都找到的有几处、各自独有的有几处 —— 从「重合多少」能估出两人都没看见的大概还剩几处。
 * 模型（设计选择，页面「怎么算的」里写明）：
 *   - 两人互不商量、各查各的；每处错对同一个人来说被看见的机会一样（同质）；查的过程中稿子没改。
 *   - A 找到 a 处，B 找到 b 处，两人都找到 m 处；一共找到不重复的 d = a + b − m 处。
 *   - 点估计用 Chapman 修正：总数 N̂ = (a+1)(b+1)/(m+1) − 1，还剩 R̂ = N̂ − d（m = 0 也能算）。
 *   - 主读数用后验：总数 N 在 [d, 上限] 内取先验 ∝ 1/N（不偏向任何数量级），似然为超几何
 *     P(m | N,a,b) = C(a,m)·C(N−a,b−m)/C(N,b)，得到「还剩 R = N − d 处」的后验分布 →
 *     中位数（「大概还剩」）、q 分位（几成把握不超过几处）、平均、已经找全的把握 P(R=0)。
 *     m ≥ 1 时后验在 N→∞ 方向按 N^(−m−1) 衰减；m 小时结论靠上限撑着，页面会提示（上限翻倍看变不变）。
 *   - Chapman 点估计只作对照（它偏乐观，见页面说明）。
 *   - 各自看见的比例：A ≈ m/b，B ≈ m/a；再查 k 遍按两人平均比例 p̄ 估：剩下的平均 × (1 − p̄)^k。
 * 精确性：后验用相邻比值递推（双精度），独立 Python Fraction + math.comb 直接按公式计算对拍。 */
(function (root) {
  'use strict';
  var MAX_LINES = 300, MAX_COUNT = 500, MAX_CAP = 5000, EPS = 1e-12;

  function defaultState() {
    return {
      mode: 'list', what: '毕业论文第三章', nameA: '我', nameB: '室友',
      listA: ['p3 第二段「的地得」用错', 'p5 图 3-2 标题和正文编号不一致', 'p6 公式 (3.4) 少一个括号', 'p7 参考文献 [12] 年份写错',
        'p8 「数据集」前后叫法不统一', 'p9 表 3-1 单位漏了 %', 'p11 错别字「既然」写成「即然」', 'p12 句子没有主语',
        'p13 图 3-5 坐标轴没标单位', 'p14 段落重复了一句', 'p15 英文缩写首次出现没给全称', 'p16 页码跳了一页'].join('\n'),
      listB: ['p3 第二段「的地得」用错', 'p4 引用格式不统一', 'p6 公式 (3.4) 少一个括号', 'p8 「数据集」前后叫法不统一',
        'p10 结论比数据说得更满', 'p11 错别字「既然」写成「即然」', 'p13 图3-5坐标轴没标单位', 'p15 英文缩写首次出现没给全称',
        'p17 致谢放错位置', 'p9 表 3-1 的单位漏掉了百分号'].join('\n'),
      a: '12', b: '10', m: '6', cap: '', conf: '90', target: '1'
    };
  }

  function blank(s) { return String(s == null ? '' : s).trim() === ''; }
  function half(s) { return String(s == null ? '' : s).replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/\u3000/g, ' '); }
  function int(s) { s = half(s).trim().replace(/。/g, '.'); if (/^\d+(\.0+)?$/.test(s)) return Number(s.split('.')[0]); return NaN; }

  /* 一行勘误 → 用来比对的样子：去编号、去空白、全角转半角、小写、去末尾标点 */
  function key(line) {
    return half(line).toLowerCase().replace(/^\s*(?:[-*•·]|\(?\d{1,3}[.)、:：]|[（(]\d{1,3}[)）])\s*/, '').replace(/\s+/g, '').replace(/[。.,，;；!！?？、]+$/, '');
  }
  function splitList(t) {
    var raw = String(t == null ? '' : t).split(/\r?\n/), items = [], seen = {}, dup = 0, long = 0;
    raw.forEach(function (ln) {
      var s = ln.trim(); if (!s) return;
      if (s.length > 120) { s = s.slice(0, 120); long++; }
      var k = key(s); if (!k) return;
      if (seen[k]) { dup++; return; }
      seen[k] = 1; items.push({ text: s, key: k });
    });
    return { items: items, dup: dup, long: long };
  }
  function bigrams(s) { var o = {}, n = 0; for (var i = 0; i < s.length - 1; i++) { var g = s.slice(i, i + 2); o[g] = (o[g] || 0) + 1; n++; } return { o: o, n: n }; }
  function dice(x, y) {
    if (x === y) return 1;
    if (x.length < 2 || y.length < 2) return 0;
    var A = bigrams(x), B = bigrams(y), hit = 0;
    for (var g in A.o) if (B.o[g]) hit += Math.min(A.o[g], B.o[g]);
    return 2 * hit / (A.n + B.n);
  }
  /* 两张单子比对：完全一样（规范化后）算同一处；其余里相似度 ≥ 0.5 的给「可能是同一处」建议（贪心，最多 5 条） */
  function matchLists(ta, tb) {
    var A = splitList(ta), B = splitList(tb), bk = {}, both = [], onlyA = [], onlyB = [];
    B.items.forEach(function (x, j) { bk[x.key] = j; });
    var usedB = {};
    A.items.forEach(function (x) { if (x.key in bk) { both.push({ a: x.text, b: B.items[bk[x.key]].text }); usedB[bk[x.key]] = 1; } else onlyA.push(x); });
    B.items.forEach(function (x, j) { if (!usedB[j]) onlyB.push(x); });
    var cand = [];
    onlyA.forEach(function (x, i) { onlyB.forEach(function (y, j) { var s = dice(x.key, y.key); if (s >= 0.5) cand.push({ i: i, j: j, s: s }); }); });
    cand.sort(function (p, q) { return q.s - p.s || p.i - q.i || p.j - q.j; });
    var ua = {}, ub = {}, near = [];
    cand.forEach(function (c) { if (near.length >= 5 || ua[c.i] || ub[c.j]) return; ua[c.i] = ub[c.j] = 1; near.push({ a: onlyA[c.i].text, b: onlyB[c.j].text, score: Math.round(c.s * 100) }); });
    return { a: A.items.length, b: B.items.length, m: both.length, both: both, onlyA: onlyA.map(function (x) { return x.text; }), onlyB: onlyB.map(function (x) { return x.text; }), near: near, dupA: A.dup, dupB: B.dup, longA: A.long, longB: B.long, rawA: String(ta || '').split(/\r?\n/).filter(function (s) { return s.trim(); }).length, rawB: String(tb || '').split(/\r?\n/).filter(function (s) { return s.trim(); }).length };
  }

  function nm(s, d) { s = String(s == null ? '' : s).trim(); return s ? s.slice(0, 12) : d; }
  function autoCap(d) { return Math.min(MAX_CAP, Math.max(4 * d, d + 30)); }

  function parse(st) {
    var errors = [], P = {};
    function E(field, message) { errors.push({ field: field, message: message }); }
    P.mode = st.mode === 'count' ? 'count' : 'list';
    P.nameA = nm(st.nameA, 'A'); P.nameB = nm(st.nameB, 'B');
    if (P.nameA === P.nameB) P.nameB = P.nameB + '（2）';
    P.what = String(st.what == null ? '' : st.what).trim().slice(0, 40);
    if (P.mode === 'list') {
      var raA = String(st.listA || '').split(/\r?\n/).filter(function (s) { return s.trim(); }).length, raB = String(st.listB || '').split(/\r?\n/).filter(function (s) { return s.trim(); }).length;
      if (raA > MAX_LINES) E('listA', P.nameA + '的单子最多 ' + MAX_LINES + ' 行');
      if (raB > MAX_LINES) E('listB', P.nameB + '的单子最多 ' + MAX_LINES + ' 行');
      var M = matchLists(st.listA, st.listB);
      P.match = M; P.a = M.a; P.b = M.b; P.m = M.m;
      if (!errors.length) {
        if (P.a < 1) E('listA', P.nameA + '的单子是空的：两个人都至少要找到一处，才能从重合估出还剩多少');
        if (P.b < 1) E('listB', P.nameB + '的单子是空的：两个人都至少要找到一处，才能从重合估出还剩多少');
      }
    } else {
      P.a = int(st.a); P.b = int(st.b); P.m = int(st.m);
      if (!(P.a >= 1 && P.a <= MAX_COUNT)) E('a', P.nameA + '找到几处要填 1–' + MAX_COUNT + ' 的整数');
      if (!(P.b >= 1 && P.b <= MAX_COUNT)) E('b', P.nameB + '找到几处要填 1–' + MAX_COUNT + ' 的整数');
      if (!(P.m >= 0 && P.m <= MAX_COUNT)) E('m', '两人都找到的要填 0 或正整数');
      else if (P.a >= 1 && P.b >= 1 && P.m > Math.min(P.a, P.b)) E('m', '两人都找到的（' + P.m + '）不能比其中一人找到的（' + Math.min(P.a, P.b) + '）还多');
    }
    P.d = (P.a || 0) + (P.b || 0) - (P.m || 0);
    P.capAuto = blank(st.cap);
    P.cap = P.capAuto ? autoCap(P.d) : int(st.cap);
    if (!P.capAuto && !(P.cap >= 1 && P.cap <= MAX_CAP)) E('cap', '「最多可能有几处」要填 1–' + MAX_CAP + ' 的整数，或留空让它自己定');
    else if (!P.capAuto && P.d > 0 && P.cap < P.d) E('cap', '「最多可能有几处」（' + P.cap + '）比已经找到的 ' + P.d + ' 处还少');
    P.conf = int(st.conf);
    if (!(P.conf >= 50 && P.conf <= 99)) E('conf', '把握要填 50–99 之间的整数（百分比）');
    P.target = int(st.target);
    if (!(P.target >= 0 && P.target <= 100)) E('target', '「能接受平均还剩几处」要填 0–100 之间的整数');
    return { P: P, errors: errors };
  }

  /* 后验：N ∈ [d, cap]，先验 ∝ 1/N，似然 ∝ C(N−a,b−m)/C(N,b)；
   * 相邻比值 w(N+1)/w(N) = (N+1−a)(N+1−b)/((N+1−d)(N+1)) × N/(N+1) 递推 */
  function posterior(a, b, m, cap) {
    var d = a + b - m, w = [1], s = 1;
    for (var N = d; N < cap; N++) { var r = (N + 1 - a) * (N + 1 - b) / ((N + 1 - d) * (N + 1)) * N / (N + 1); var v = w[w.length - 1] * r; w.push(v); s += v; }
    return w.map(function (x) { return x / s; }); /* 下标 = 还剩几处 R */
  }
  function quantile(pr, q) { var acc = 0; for (var i = 0; i < pr.length; i++) { acc += pr[i]; if (acc >= q - EPS) return i; } return pr.length - 1; }
  function chapman(a, b, m) { return (a + 1) * (b + 1) / (m + 1) - 1; }
  /* 再查 k 遍后剩下的期望 ≤ T 的最少遍数 */
  function passesFor(R, p, T) {
    if (R <= T + EPS) return 0;
    if (!(p > 0)) return null;
    if (p >= 1) return 1;
    return Math.max(1, Math.ceil(Math.log(T > 0 ? T / R : 0.5 / R) / Math.log(1 - p) - EPS));
  }

  function compute(st) {
    var r = parse(st), P = r.P, o = { ok: !r.errors.length, errors: r.errors, P: P };
    if (P.match) o.match = P.match;
    if (!o.ok) return o;
    var a = P.a, b = P.b, m = P.m, d = P.d;
    o.d = d;
    o.lp = m > 0 ? a * b / m : null;            /* Lincoln–Petersen（只作对照） */
    o.nHat = chapman(a, b, m);
    o.rHat = Math.max(0, o.nHat - d);
    o.rateA = m / b; o.rateB = m / a;           /* 各自看见的比例估计 */
    o.pBar = (o.rateA + o.rateB) / 2;
    var pr = posterior(a, b, m, P.cap);
    o.post = pr;
    o.pZero = pr[0];
    o.median = quantile(pr, 0.5);
    o.mean = pr.reduce(function (s, x, i) { return s + x * i; }, 0);
    o.qRem = quantile(pr, P.conf / 100);
    o.atCap = o.qRem === pr.length - 1 && pr.length > 1;
    var pr2 = posterior(a, b, m, Math.min(MAX_CAP * 2, P.cap * 2));
    o.qRem2 = quantile(pr2, P.conf / 100);
    o.sensitive = o.qRem2 - o.qRem >= Math.max(2, Math.ceil(0.1 * o.qRem - EPS)); /* 上限翻倍，分位涨 ≥2 处且 ≥10%：结论取决于上限（阈值是设计选择） */
    o.passes = passesFor(o.mean, o.pBar, P.target);
    o.afterOne = o.mean * (1 - o.pBar);
    o.level = m === 0 ? 'none' : (o.mean <= P.target + EPS ? 'done' : 'more');
    /* 柱图：画到 99.5% 分位（至少 0–qRem），超过 60 格就每 w 处并成一根；后面的合并成最后一根「≥」 */
    var hi = Math.max(quantile(pr, 0.995), o.qRem), w = Math.max(1, Math.ceil((hi + 1) / 60)), nb = Math.ceil((hi + 1) / w), bars = [];
    if (nb * w >= pr.length) nb = Math.ceil(pr.length / w);
    for (var i = 0; i < nb; i++) { var sb = 0; for (var j = i * w; j < Math.min(pr.length, (i + 1) * w); j++) sb += pr[j]; bars.push(sb); }
    o.barsTail = nb * w < pr.length;
    if (o.barsTail) { var rest = 0; for (var k = nb * w; k < pr.length; k++) rest += pr[k]; bars.push(rest); }
    o.bars = bars; o.barW = w; o.qBar = Math.floor(o.qRem / w);
    /* 改法：都直接改输入 */
    var acts = [];
    if (P.mode === 'list' && P.match.near.length) {
      var n0 = P.match.near[0];
      acts.push({ id: 'actNear', text: '「' + short(n0.b, 14) + '」和「' + short(n0.a, 14) + '」像是同一处（相似 ' + n0.score + '%），算成同一处', set: { mergeB: n0.b, intoA: n0.a } });
    }
    if (o.sensitive) {
      var c2 = Math.min(MAX_CAP, P.cap * 2);
      if (c2 > P.cap) acts.push({ id: 'actCap', text: '「最多可能有几处」从 ' + P.cap + ' 改成 ' + c2 + '：' + P.conf + '% 把握的还剩处数 ' + o.qRem + ' → ' + o.qRem2 + '（变这么多说明重合太少，结论靠上限撑着）', set: { cap: String(c2) } });
    }
    if (o.level === 'more' && o.passes != null && o.passes > 1) {
      var T2 = Math.min(100, Math.max(P.target + 1, Math.ceil(o.afterOne - EPS)));
      acts.push({ id: 'actTarget', text: '把「能接受平均还剩几处」放宽到 ' + T2 + ' 处：只要再查 ' + passesFor(o.mean, o.pBar, T2) + ' 遍（现在要 ' + o.passes + ' 遍）', set: { target: String(T2) } });
    }
    if (P.conf > 80 && o.level === 'more') { var q80 = quantile(pr, 0.8); if (q80 < o.qRem) acts.push({ id: 'actConf', text: '把握降到 80%：不超过 ' + q80 + ' 处（' + P.conf + '% 时是 ' + o.qRem + ' 处）', set: { conf: '80' } }); }
    o.actions = acts;
    return o;
  }

  /* 显示 */
  function n1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, ''); }
  function pct(x) { var v = Math.round(x * 1000) / 10; if (v >= 100 && x < 1 - EPS) v = 99.9; if (v <= 0 && x > EPS) v = 0.1; return (v % 1 ? v.toFixed(1) : String(v)) + '%'; }
  function pct0(x) { var v = Math.round(x * 100); if (v >= 100 && x < 1 - EPS) v = 99; if (v <= 0 && x > EPS) return '不到 1%'; return v + '%'; }
  function short(n, k) { n = String(n); k = k || 8; return n.length > k ? n.slice(0, k - 1) + '…' : n; }

  function headline(o) {
    var P = o.P;
    if (o.level === 'none') return P.nameA + '和' + P.nameB + '找到的没有一处重合：两人都漏得很多，剩下多少算不出靠谱的数。';
    if (o.level === 'done') return '两人都没看见的平均只剩 ' + n1(o.mean) + ' 处，在你能接受的 ' + P.target + ' 处以内；有 ' + P.conf + '% 的把握不超过 ' + o.qRem + ' 处。';
    return '两人都没看见的，大概还剩 ' + o.median + ' 处；要 ' + P.conf + '% 的把握，得按不超过 ' + o.qRem + ' 处来想。';
  }
  function nextStep(o) {
    var P = o.P;
    if (o.level === 'none') return '先别急着交：再找一个人查一遍，或者两人换着各查对方那一半。没有重合时，剩下的数完全取决于你填的上限。';
    if (o.passes === 0) return '平均还剩 ' + n1(o.mean) + ' 处，已经不超过你能接受的 ' + P.target + ' 处。';
    if (o.passes == null) return '算不出还要查几遍。';
    return '平均还剩 ' + n1(o.mean) + ' 处。按两人平均每人能看见 ' + pct0(o.pBar) + ' 算，再请一个差不多的人查 1 遍，预计能再找出约 ' + n1(o.mean - o.afterOne) + ' 处；要把平均剩下的压到 ' + P.target + ' 处以内，大约要再查 ' + o.passes + ' 遍。';
  }

  function csvCell(s) { s = String(s); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCSV(o, stamp) {
    if (!o.ok) return '';
    var P = o.P, L = [];
    L.push(['两遍都没看见', P.what, '导出 ' + stamp].map(csvCell).join(','));
    L.push([P.nameA + '找到', P.a, P.nameB + '找到', P.b, '两人都找到', P.m, '一共找到', o.d, '大概还剩（中位）', o.median, '平均还剩', n1(o.mean), 'Chapman 对照', n1(o.rHat), P.conf + '% 把握不超过', o.qRem, '已找全的把握', pct(o.pZero), '上限', P.cap].map(csvCell).join(','));
    L.push('');
    L.push(['序号', '勘误', '谁找到的'].map(csvCell).join(','));
    if (P.mode === 'list') {
      var k = 0, M = P.match;
      M.both.forEach(function (x) { L.push([++k, x.a, '两人都找到'].map(csvCell).join(',')); });
      M.onlyA.forEach(function (x) { L.push([++k, x, '只有' + P.nameA].map(csvCell).join(',')); });
      M.onlyB.forEach(function (x) { L.push([++k, x, '只有' + P.nameB].map(csvCell).join(',')); });
    } else L.push(['', '（按处数填的，没有逐条清单）', ''].map(csvCell).join(','));
    return L.join('\n') + '\n';
  }
  function mdCell(s) { return String(s).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' '); }
  function toMD(o, stamp) {
    if (!o.ok) return '';
    var P = o.P, L = ['# 两遍都没看见' + (P.what ? '：' + mdCell(P.what) : ''), '', '导出时间：' + stamp, ''];
    L.push(P.nameA + '找到 ' + P.a + ' 处，' + P.nameB + '找到 ' + P.b + ' 处，两人都找到 ' + P.m + ' 处；一共找到不重复的 ' + o.d + ' 处。', '');
    L.push('**' + headline(o) + '**', '');
    L.push('还剩处数：一半可能不超过 ' + o.median + ' 处，平均 ' + n1(o.mean) + ' 处，' + P.conf + '% 把握不超过 ' + o.qRem + ' 处；已经找全的把握 ' + pct(o.pZero) + '（上限按 ' + P.cap + ' 处算）。经典 Chapman 公式对照：还剩约 ' + n1(o.rHat) + ' 处。', '');
    L.push(nextStep(o), '');
    if (P.mode === 'list') {
      var M = P.match;
      L.push('| # | 勘误 | 谁找到的 |', '|---|---|---|');
      var k = 0;
      M.both.forEach(function (x) { L.push('| ' + (++k) + ' | ' + mdCell(x.a) + ' | 两人都找到 |'); });
      M.onlyA.forEach(function (x) { L.push('| ' + (++k) + ' | ' + mdCell(x) + ' | 只有' + mdCell(P.nameA) + ' |'); });
      M.onlyB.forEach(function (x) { L.push('| ' + (++k) + ' | ' + mdCell(x) + ' | 只有' + mdCell(P.nameB) + ' |'); });
      L.push('');
    }
    L.push('_假设两人各查各的、每处错一样好找、查的时候稿子没改。实际里难找的错两个人都容易漏，所以真实剩余往往比这里估的多。默认数字为虚构示例。_');
    return L.join('\n') + '\n';
  }

  var api = { MAX_LINES: MAX_LINES, MAX_COUNT: MAX_COUNT, MAX_CAP: MAX_CAP, defaultState: defaultState, key: key, splitList: splitList, dice: dice, matchLists: matchLists, autoCap: autoCap, parse: parse, posterior: posterior, quantile: quantile, chapman: chapman, passesFor: passesFor, compute: compute, n1: n1, pct: pct, pct0: pct0, short: short, headline: headline, nextStep: nextStep, toCSV: toCSV, toMD: toMD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AppCore = api;
})(typeof window !== 'undefined' ? window : this);
