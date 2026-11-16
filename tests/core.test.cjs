/* 两遍都没看见 · 核心测试：node --test tests/core.test.cjs
 * 锚点：tests/ref.json（独立 Python Fraction + math.comb 直接按公式算，300 组）、默认场景手算、常识性质。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require(path.join(__dirname, '..', 'core.js'));
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
const S = (o) => Object.assign(A.defaultState(), o);
const C = (a, b, m, extra) => S(Object.assign({ mode: 'count', a: String(a), b: String(b), m: String(m) }, extra || {}));
const close = (x, y, tol, msg) => assert.ok(Math.abs(x - y) <= tol, msg + '：' + x + ' vs ' + y);

test('默认场景：清单比对 + 手算读数', () => {
  const o = A.compute(A.defaultState());
  assert.ok(o.ok, JSON.stringify(o.errors));
  /* 「p13 图 3-5 坐标轴没标单位」与「p13 图3-5坐标轴没标单位」去空白后相同 → 算同一处；p9 两条说法不同 → 不自动合并 */
  assert.equal(o.P.a, 12); assert.equal(o.P.b, 10); assert.equal(o.P.m, 6); assert.equal(o.d, 16);
  assert.equal(o.match.near.length, 1);
  assert.equal(o.match.near[0].b, 'p9 表 3-1 的单位漏掉了百分号');
  /* Chapman：13×11/7 − 1 = 19.4286，还剩 3.43；Lincoln–Petersen 12×10/6 = 20 */
  close(o.nHat, 13 * 11 / 7 - 1, 1e-12, 'Chapman'); assert.equal(o.lp, 20);
  /* 各自比例：我 6/10 = 60%，室友 6/12 = 50%，平均 55% */
  assert.equal(o.rateA, 0.6); assert.equal(o.rateB, 0.5); close(o.pBar, 0.55, 1e-12, '平均比例');
  assert.equal(o.P.cap, 64); /* max(4×16, 16+30) */
  assert.equal(o.median, 5); assert.equal(o.qRem, 14); assert.equal(A.n1(o.mean), '6.9');
  assert.equal(A.pct(o.pZero), '4.1%');
  assert.equal(o.sensitive, false); assert.equal(o.level, 'more');
  /* 再查 k 遍：6.8589 × 0.45^k ≤ 1 → k = 3（0.45^2×6.86 = 1.39 > 1，0.45^3×6.86 = 0.63） */
  assert.equal(o.passes, 3);
  assert.equal(A.n1(o.mean - o.afterOne), '3.8');
  assert.deepEqual(o.actions.map((x) => x.id), ['actNear', 'actTarget', 'actConf']);
  assert.equal(o.actions[1].set.target, '4');
  assert.ok(o.actions[1].text.indexOf('只要再查 1 遍（现在要 3 遍）') >= 0, o.actions[1].text);
  assert.ok(o.actions[2].text.indexOf('不超过 10 处') >= 0, o.actions[2].text);
  assert.equal(A.headline(o), '两人都没看见的，大概还剩 5 处；要 90% 的把握，得按不超过 14 处来想。');
});

test('与独立 Python Fraction 参考实现逐组对拍（300 组）', () => {
  let n = 0;
  REF.forEach((c, i) => {
    const o = A.compute(c.state), at = '第 ' + i + ' 组 ' + JSON.stringify(c.state);
    assert.ok(o.ok, at + JSON.stringify(o.errors));
    assert.equal(o.d, c.d, at + ' d'); assert.equal(o.P.cap, c.cap, at + ' 上限');
    close(o.nHat, c.chapman, 1e-9, at + ' Chapman');
    assert.equal(o.median, c.median, at + ' 中位'); assert.equal(o.qRem, c.q, at + ' 分位'); assert.equal(o.qRem2, c.q2, at + ' 上限翻倍分位');
    close(o.mean, c.mean, 1e-9 * Math.max(1, c.mean), at + ' 平均');
    close(o.pZero, c.pZero, 1e-11, at + ' 找全');
    close(o.pBar, c.p, 1e-12, at + ' 比例');
    assert.equal(o.passes, c.passes, at + ' 遍数'); assert.equal(o.level, c.level, at + ' 结论');
    c.post10.forEach((v, k) => close(o.post[k], v, 1e-11, at + ' 后验 R=' + k));
    n++;
  });
  assert.equal(n, 300);
  for (const lv of ['none', 'more', 'done']) assert.ok(REF.filter((c) => c.level === lv).length >= 40, lv + ' 太少');
});

test('后验性质：总和为 1、非负、长度 = 上限 − 已找到 + 1；m ≥ 2 时上限够大后分位稳定', () => {
  REF.forEach((c) => {
    const o = A.compute(c.state);
    close(o.post.reduce((s, x) => s + x, 0), 1, 1e-9, '总和');
    assert.ok(o.post.every((x) => x >= 0));
    assert.equal(o.post.length, o.P.cap - o.d + 1);
    assert.ok(o.bars.length <= 61 && o.bars.length >= 1);
    /* 每根柱 = 连续 barW 个 R 的和；深色那根包含 qRem；q 分位落在画出来的范围里 */
    const w = o.barW; o.bars.slice(0, o.bars.length - (o.barsTail ? 1 : 0)).forEach((v, i) => close(v, o.post.slice(i * w, (i + 1) * w).reduce((s2, x) => s2 + x, 0), 1e-12, '柱 ' + i));
    assert.ok(o.qBar * w <= o.qRem && o.qRem < (o.qBar + 1) * w && o.qBar < o.bars.length - (o.barsTail ? 1 : 0), JSON.stringify(c.state));
    if (o.barsTail) assert.ok(o.bars[o.bars.length - 1] <= 0.005 + 1e-9, '尾巴 ≤ 0.5%');
    close(o.bars.reduce((s, x) => s + x, 0), 1, 1e-9, '柱子总和');
  });
  /* 重合多：12/10/6 上限 64 → 128 → 1000 分位都是 14 */
  [64, 128, 1000].forEach((cap) => assert.equal(A.compute(C(12, 10, 6, { cap: String(cap) })).qRem, 14));
  /* 后验在 [d, cap] 先升后降（单峰） */
  const p = A.compute(C(12, 10, 6)).post; let peak = p.indexOf(Math.max.apply(null, p));
  for (let i = 1; i <= peak; i++) assert.ok(p[i] >= p[i - 1] - 1e-15); for (let i = peak + 1; i < p.length; i++) assert.ok(p[i] <= p[i - 1] + 1e-15);
});

test('柱图分格：默认 1 处一格；极值并格', () => {
  const o = A.compute(A.defaultState()); assert.equal(o.barW, 1); assert.equal(o.qBar, 14);
  const e = A.compute(C(300, 300, 150)); assert.ok(e.barW > 1, String(e.barW)); assert.ok(e.bars.length <= 61);
  assert.ok(e.bars[e.qBar] > 0);
  const z = A.compute(C(5, 5, 2, { cap: '8' })); assert.deepEqual(z.bars, [1]); assert.equal(z.barsTail, false);
});

test('常识方向：重合越多剩得越少；两人找得越多（重合比例不变）剩得越少', () => {
  let prev = Infinity;
  for (let m = 1; m <= 10; m++) { const o = A.compute(C(12, 10, m, { cap: '200' })); assert.ok(o.mean < prev, 'm=' + m); prev = o.mean; }
  /* 两人都只找到对方找到的（a=b=m）：几乎找全 */
  const all = A.compute(C(8, 8, 8)); assert.equal(all.median, 0); assert.ok(all.pZero > 0.8, all.pZero); assert.equal(all.level, 'done');
  assert.equal(A.headline(all), '两人都没看见的平均只剩 0.1 处，在你能接受的 1 处以内；有 90% 的把握不超过 1 处。'); /* P(R=0)=0.890 < 0.9，所以 90% 分位是 1（Python Fraction 独立复算） */
  /* 把握越高，分位越大（单调不减） */
  let q = -1; for (let cf = 50; cf <= 99; cf++) { const o = A.compute(C(12, 10, 6, { conf: String(cf) })); assert.ok(o.qRem >= q); q = o.qRem; }
  /* A、B 对调，后验不变 */
  const x = A.compute(C(15, 7, 3)), y = A.compute(C(7, 15, 3));
  x.post.forEach((v, i) => close(v, y.post[i], 1e-12, '对称'));
});

test('没有重合：算得出数但标为不可靠，并提示上限', () => {
  const o = A.compute(C(12, 10, 0));
  assert.ok(o.ok); assert.equal(o.level, 'none'); assert.equal(o.sensitive, true);
  assert.equal(o.lp, null); close(o.nHat, 13 * 11 - 1, 1e-12, 'Chapman m=0');
  assert.equal(A.headline(o), '我和室友找到的没有一处重合：两人都漏得很多，剩下多少算不出靠谱的数。');
  assert.ok(A.nextStep(o).indexOf('完全取决于你填的上限') >= 0);
  assert.deepEqual(o.actions.map((x) => x.id), ['actCap']);
  assert.equal(o.actions[0].set.cap, '176'); /* 自动上限 max(88, 52)=88 → 176 */
  assert.equal(o.passes, null); /* 两人比例都是 0 */
  assert.equal(o.qRem, o.post.length - 1 - (o.post.length - 1 - o.qRem)); /* 只防 undefined */
  assert.equal(typeof o.qRem, 'number');
});

test('清单比对：规范化、去重、相似建议、上限', () => {
  assert.equal(A.key('1. 第三页 错字。'), '第三页错字');
  assert.equal(A.key('（2）ＡＢＣ  错'), 'abc错');
  assert.equal(A.key('- p3 漏句号'), 'p3漏句号');
  const M = A.matchLists('错字一\n错字一\n\n  \n漏了句号。\nX', '1) 错字一\n漏了句号\n完全不同的一条');
  assert.equal(M.a, 3); assert.equal(M.dupA, 1); assert.equal(M.b, 3); assert.equal(M.m, 2);
  assert.deepEqual(M.onlyA, ['X']); assert.deepEqual(M.onlyB, ['完全不同的一条']);
  close(A.dice('abcd', 'abcd'), 1, 0, 'dice 相同');
  assert.equal(A.dice('aaaa', 'aa'), 0.5); /* 二元组按次数取小：{aa:3} 与 {aa:1} 只算 1 个 */
  /* 相似 0.3–0.5 之间的不给建议；一条只配一条 */
  const sm = A.dice(A.key('第三页图表编号'), A.key('第三页标题'));
  assert.ok(sm >= 0.3 && sm < 0.5, String(sm));
  assert.equal(A.matchLists('第三页图表编号', '第三页标题').near.length, 0);
  const one = A.matchLists('第五页表格单位漏了', '第五页表格单位漏掉\n第五页的表格单位漏了');
  assert.equal(one.near.length, 1); assert.equal(A.dice('a', 'b'), 0); assert.equal(A.dice('ab', 'cd'), 0);
  /* 相似建议最多 5 条，各条一一对应 */
  const la = Array.from({ length: 8 }, (_, i) => '第' + i + '页图表编号写错了').join('\n'), lb = Array.from({ length: 8 }, (_, i) => '第' + i + '页的图表编号写错').join('\n');
  const M2 = A.matchLists(la, lb); assert.equal(M2.m, 0); assert.equal(M2.near.length, 5);
  assert.equal(new Set(M2.near.map((x) => x.a)).size, 5); assert.equal(new Set(M2.near.map((x) => x.b)).size, 5);
  /* 超长行截断到 120 字、计数 */
  const M3 = A.matchLists('啊'.repeat(200), '啊'.repeat(130)); assert.equal(M3.m, 1); assert.equal(M3.longA, 1);
  /* 超过 300 行报错 */
  const big = Array.from({ length: 301 }, (_, i) => 'e' + i).join('\n');
  const o = A.compute(S({ listA: big }));
  assert.ok(!o.ok); assert.deepEqual(o.errors.map((e) => e.field), ['listA']);
  assert.ok(A.compute(S({ listA: big.split('\n').slice(0, 300).join('\n') })).ok);
});

test('清单为空 / 只有空白行：报错指向那一栏', () => {
  let o = A.compute(S({ listB: '  \n\n ' })); assert.ok(!o.ok); assert.deepEqual(o.errors.map((e) => e.field), ['listB']);
  assert.ok(o.errors[0].message.indexOf('室友的单子是空的') === 0, o.errors[0].message);
  o = A.compute(S({ listA: '', listB: '' })); assert.deepEqual(o.errors.map((e) => e.field), ['listA', 'listB']);
});

test('按处数填：校验与全角', () => {
  const bad = (st, f) => { const o = A.compute(st); assert.ok(!o.ok, JSON.stringify(st)); assert.deepEqual(o.errors.map((e) => e.field), f); return o; };
  bad(C(0, 5, 0), ['a']); bad(C(5, 501, 0), ['b']); bad(C(5, 5, -1), ['m']); bad(C('2.5', 5, 0), ['a']);
  const o = bad(C(5, 3, 4), ['m']); assert.ok(o.errors[0].message.indexOf('（4）不能比其中一人找到的（3）还多') >= 0);
  assert.ok(A.compute(C(500, 500, 0)).ok); assert.ok(A.compute(C(1, 1, 1)).ok); assert.ok(A.compute(C('５', '４．0', '３')).ok);
  assert.equal(A.compute(C('５', '４', '３')).P.a, 5);
  bad(C(5, 5, 2, { conf: '49' }), ['conf']); bad(C(5, 5, 2, { conf: '100' }), ['conf']); assert.ok(A.compute(C(5, 5, 2, { conf: '99' })).ok);
  bad(C(5, 5, 2, { target: '101' }), ['target']); bad(C(5, 5, 2, { target: '-1' }), ['target']); assert.ok(A.compute(C(5, 5, 2, { target: '0' })).ok);
  bad(C(5, 5, 2, { cap: '7' }), ['cap']); assert.ok(A.compute(C(5, 5, 2, { cap: '8' })).ok); bad(C(5, 5, 2, { cap: '5001' }), ['cap']); bad(C(5, 5, 2, { cap: 'abc' }), ['cap']);
  /* 上限正好等于已找到：只剩 0 一种可能 */
  const z = A.compute(C(5, 5, 2, { cap: '8' })); assert.equal(z.post.length, 1); assert.equal(z.pZero, 1); assert.equal(z.qRem, 0);
  /* 多项错误一起列 */
  bad(C(0, 0, 0, { conf: '1', target: 'x' }), ['a', 'b', 'conf', 'target']);
});

test('上限：自动取 max(4×已找到, 已找到+30)、不超过 5000；翻倍建议截到 5000', () => {
  assert.equal(A.autoCap(1), 31); assert.equal(A.autoCap(10), 40); assert.equal(A.autoCap(11), 44); assert.equal(A.autoCap(1250), 5000); assert.equal(A.autoCap(1300), 5000);
  const o = A.compute(C(500, 500, 0)); assert.equal(o.P.cap, 4000); assert.equal(o.actions[0].set.cap, '5000');
  const t = Date.now(); const o2 = A.compute(C(500, 500, 0, { cap: '5000' })); assert.ok(Date.now() - t < 2000);
  assert.ok(!o2.actions.some((x) => x.id === 'actCap'), '已到 5000 不再给翻倍');
  close(o2.post.reduce((s, x) => s + x, 0), 1, 1e-9, '极值总和');
});

test('分位与「上限敏感」的定义', () => {
  assert.equal(A.quantile([0.5, 0.5], 0.5), 0); /* 累计正好到 q 就停 */
  assert.equal(A.quantile([0.25, 0.25, 0.5], 0.5), 1);
  let one = 0;
  REF.forEach((c) => {
    const o = A.compute(c.state);
    assert.equal(o.sensitive, c.sens, JSON.stringify(c.state));
    if (c.q2 === c.q + 1) { one++; assert.equal(o.sensitive, false, '只差 1 不算'); }
    o.actions.filter((a) => a.id === 'actConf').forEach(() => assert.ok(A.quantile(o.post, 0.8) < o.qRem));
    if (o.P.conf > 80 && o.level === 'more' && A.quantile(o.post, 0.8) === o.qRem) assert.ok(!o.actions.some((a) => a.id === 'actConf'), '80% 与原把握相同时不给');
  });
  assert.ok(one >= 1, '要有上限翻倍只差 1 的样本');
  /* 阈值两侧：代码走查 23/17/8 翻倍 40→41 不算；没重合 6/5/0 31→69 算 */
  assert.equal(A.compute(C(23, 17, 8)).sensitive, false); assert.equal(A.compute(C(6, 5, 0)).sensitive, true);
  assert.ok(REF.filter((c) => c.sens).length >= 30 && REF.filter((c) => !c.sens && c.q2 > c.q).length >= 10, '阈值两侧都要有样本');
});

test('再查几遍：边界', () => {
  assert.equal(A.passesFor(1, 0.5, 1), 0); assert.equal(A.passesFor(1.0000001, 0.5, 1), 1);
  assert.equal(A.passesFor(4, 0.5, 1), 2); /* 4×0.25 = 1，正好到 */
  assert.equal(A.passesFor(4.01, 0.5, 1), 3);
  assert.equal(A.passesFor(3, 0, 1), null); assert.equal(A.passesFor(3, 1, 1), 1);
  assert.equal(A.passesFor(2, 0.5, 0), 2); /* 目标 0 时压到 0.5 以下：2×0.25 = 0.5 */
  /* 放宽建议：建议的目标值确实让遍数变少 */
  REF.forEach((c) => { const o = A.compute(c.state); o.actions.filter((a) => a.id === 'actTarget').forEach((a) => { const o2 = A.compute(Object.assign({}, c.state, a.set)); assert.ok(o2.passes < o.passes, JSON.stringify(c.state)); }); });
});

test('改法按钮：每个都作用于输入并改变结果', () => {
  const o = A.compute(A.defaultState());
  /* 合并相似：把室友那条改成和我那条一样 → 重合 7 */
  const near = o.actions[0].set, st = A.defaultState();
  st.listB = st.listB.split('\n').map((l) => (l === near.mergeB ? near.intoA : l)).join('\n');
  const o2 = A.compute(st); assert.equal(o2.P.m, 7); assert.equal(o2.d, 15); assert.ok(o2.mean < o.mean);
  assert.equal(o2.match.near.length, 0);
  assert.ok(!o2.actions.some((x) => x.id === 'actNear'));
  const o3 = A.compute(S({ conf: '80' })); assert.equal(o3.qRem, 10); assert.ok(!o3.actions.some((x) => x.id === 'actConf'));
  /* 已经 done 时不给放宽与降把握 */
  const d = A.compute(C(8, 8, 8)); assert.equal(d.actions.length, 0);
});

test('显示与导出', () => {
  assert.equal(A.pct(0.0004), '0.1%'); assert.equal(A.pct(0.9996), '99.9%'); assert.equal(A.pct(1), '100%'); assert.equal(A.pct(0), '0%');
  assert.equal(A.pct0(0.004), '不到 1%'); assert.equal(A.pct0(0.996), '99%'); assert.equal(A.pct0(0.55), '55%');
  assert.equal(A.n1(3.0), '3'); assert.equal(A.n1(3.05), '3.1'); assert.equal(A.short('一二三四五六七八九'), '一二三四五六七…'); assert.equal(A.short('一二三四五六七八'), '一二三四五六七八');
  const o = A.compute(S({ listA: '=HYPERLINK("x")\n|竖线|\n共同', listB: '共同\n+1', nameA: '甲', nameB: '甲' }));
  assert.equal(o.P.nameB, '甲（2）');
  const csv = A.toCSV(o, 'T');
  assert.ok(csv.indexOf('"=HYPERLINK(""x"")"') >= 0, csv); assert.ok(csv.indexOf('"+1"') >= 0);
  assert.equal(csv.split('\n').filter((l) => /^\d+,/.test(l)).length, 4);
  const md = A.toMD(o, 'T'); assert.ok(md.indexOf('\\|竖线\\|') >= 0); assert.ok(md.indexOf('| 1 | 共同 | 两人都找到 |') >= 0);
  assert.equal(A.toCSV({ ok: false }, 'T'), ''); assert.equal(A.toMD({ ok: false }, 'T'), '');
  const oc = A.compute(C(12, 10, 6)); assert.ok(A.toCSV(oc, 'T').indexOf('没有逐条清单') >= 0);
  const md0 = A.toMD(A.compute(A.defaultState()), 'T');
  ['我找到 12 处，室友找到 10 处，两人都找到 6 处；一共找到不重复的 16 处。', '一半可能不超过 5 处，平均 6.9 处，90% 把握不超过 14 处', '已经找全的把握 4.1%（上限按 64 处算）', 'Chapman 公式对照：还剩约 3.4 处'].forEach((t) => assert.ok(md0.indexOf(t) >= 0, t));
});
