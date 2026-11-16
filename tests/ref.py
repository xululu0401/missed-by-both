#!/usr/bin/env python3
"""两遍都没看见 · 独立参考实现（Python Fraction + math.comb，直接按公式算，不用相邻比值递推）。
输出 tests/ref.json：300 组「按处数填」的输入与精确读数，给 core.test.cjs 对拍。
后验：N ∈ [d, cap]，先验 ∝ 1/N，似然 = C(a,m)·C(N−a,b−m)/C(N,b)。"""
import json, math, random
from fractions import Fraction as F

def post(a, b, m, cap):
    d = a + b - m
    w = []
    for N in range(d, cap + 1):
        lik = F(math.comb(a, m) * math.comb(N - a, b - m), math.comb(N, b))
        w.append(lik / N)
    s = sum(w)
    return [x / s for x in w]

def quant(pr, q):
    acc = F(0)
    for i, x in enumerate(pr):
        acc += x
        if acc >= q:
            return i
    return len(pr) - 1

def auto_cap(d):
    return min(5000, max(4 * d, d + 30))

def passes(mean, p, T):
    lim = F(T) if T > 0 else F(1, 2)
    if mean <= T:
        return 0
    if p == 0:
        return None
    if p == 1:
        return 1
    k = 1
    while mean * (1 - p) ** k > lim:
        k += 1
    return k

random.seed(20261117)
cases = []
while len(cases) < 300:
    kind = random.random()
    a = random.randint(1, 40); b = random.randint(1, 40)
    if kind < 0.1:
        m = 0
    elif kind < 0.2:
        m = min(a, b)
    else:
        m = random.randint(0, min(a, b))
    d = a + b - m
    cap = None if random.random() < 0.6 else random.randint(d, d + random.choice([5, 40, 200]))
    conf = random.choice([50, 80, 90, 95, 99, random.randint(50, 99)])
    T = random.choice([0, 1, 2, 3, 5, random.randint(0, 20)])
    capv = auto_cap(d) if cap is None else cap
    pr = post(a, b, m, capv)
    mean = sum(F(i) * x for i, x in enumerate(pr))
    p = (F(m, b) + F(m, a)) / 2
    pr2 = post(a, b, m, min(10000, capv * 2))
    cases.append({
        'state': {'mode': 'count', 'a': str(a), 'b': str(b), 'm': str(m), 'cap': '' if cap is None else str(cap), 'conf': str(conf), 'target': str(T), 'nameA': 'A', 'nameB': 'B'},
        'd': d, 'cap': capv,
        'chapman': float(F((a + 1) * (b + 1), m + 1) - 1),
        'median': quant(pr, F(1, 2)), 'q': quant(pr, F(conf, 100)), 'q2': quant(pr2, F(conf, 100)),
        'sens': None,
        'mean': float(mean), 'pZero': float(pr[0]), 'p': float(p),
        'passes': passes(mean, p, T),
        'level': 'none' if m == 0 else ('done' if mean <= T else 'more'),
        'post10': [float(x) for x in pr[:10]],
    })
for c in cases:
    c['sens'] = (c['q2'] - c['q']) >= max(2, math.ceil(F(c['q'], 10)))
json.dump(cases, open(__file__.replace('ref.py', 'ref.json'), 'w'), ensure_ascii=False)
lv = {}
for c in cases:
    lv[c['level']] = lv.get(c['level'], 0) + 1
print('ref.json 写出', len(cases), '组；level 分布', lv, '；自动上限', sum(1 for c in cases if c['state']['cap'] == ''), '组；上限翻倍分位会变', sum(1 for c in cases if c['q'] != c['q2']), '组，其中算「靠上限撑着」', sum(1 for c in cases if c['sens']), '组')
