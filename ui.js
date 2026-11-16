/* 两遍都没看见 · 界面（ui.js）
 * 读 state → AppCore.compute → 把同一次输出画出来。页面自己不做估计。 */
(function () {
  'use strict';
  var A = window.AppCore;
  var KEY = 'missed-by-both:v1';
  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = ['what', 'nameA', 'nameB', 'listA', 'listB', 'a', 'b', 'm', 'cap', 'conf', 'target'];
  var LIM = { what: 40, nameA: 12, nameB: 12, listA: 0, listB: 0, a: 8, b: 8, m: 8, cap: 8, conf: 6, target: 6 };
  var PRESETS = [
    { key: 'base', name: '毕业论文第三章（默认）', note: '虚构示例：我找到 12 处、室友找到 10 处，其中 6 处一样（有一处两人说法不同，没自动算成同一处）。' },
    { key: 'close', name: '重合很多', note: '虚构示例：两人各找到 9 处和 8 处，其中 7 处一样：大部分错已经被看见了。', f: function (s) { s.mode = 'count'; s.what = '一份合同'; s.nameA = '法务'; s.nameB = '我'; s.a = '9'; s.b = '8'; s.m = '7'; } },
    { key: 'none', name: '一处都没重合', note: '虚构示例：两人各找到 6 处和 5 处，没有一处一样：说明两人都漏了很多。', f: function (s) { s.mode = 'count'; s.what = '产品说明书'; s.nameA = '小王'; s.nameB = '小李'; s.a = '6'; s.b = '5'; s.m = '0'; } },
    { key: 'code', name: '代码走查', note: '虚构示例：两位同事各查一遍，找到 23 处和 17 处问题，其中 8 处一样。', f: function (s) { s.mode = 'count'; s.what = '支付模块代码'; s.nameA = '老张'; s.nameB = '小周'; s.a = '23'; s.b = '17'; s.m = '8'; } }
  ];
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function presetState(k) { var s = A.defaultState(), p = PRESETS.filter(function (q) { return q.key === k; })[0]; if (p.f) p.f(s); return s; }
  function norm(s) { var d = { mode: s.mode }; FIELDS.forEach(function (k) { d[k] = s[k]; }); return JSON.stringify(d); }
  function presetKey(s) { var j = norm(s); for (var i = 0; i < PRESETS.length; i++) if (norm(presetState(PRESETS[i].key)) === j) return PRESETS[i].key; return null; }

  function str(v, n) { return v == null || typeof v === 'object' ? '' : String(v).slice(0, n); }
  /* 勘误单按行截：最多 MAX_LINES+1 行（多 1 行让「超过 300 行」的报错照常出现）、每行 200 字（比对只用前 120 字） */
  function lines(v) { return str(v, 1e7).split(/\r?\n/).slice(0, A.MAX_LINES + 1).map(function (l) { return l.slice(0, 200); }).join('\n'); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState(), any = false;
    FIELDS.forEach(function (k) { if (k in s) { d[k] = LIM[k] ? str(s[k], LIM[k]) : lines(s[k]); any = true; } });
    if ('mode' in s) { d.mode = s.mode === 'count' ? 'count' : 'list'; any = true; }
    return any ? d : null;
  }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return sanitize(j && j.state); } catch (e) { return null; } }
  var state = load() || A.defaultState();
  var out = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ state: state })); $('saveTag').textContent = '· 已存到本机'; }
    catch (e) { $('saveTag').textContent = '· 没能存到本机'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function fillAll() {
    FIELDS.forEach(function (k) { $(k).value = state[k]; });
    $('modeList').setAttribute('aria-pressed', state.mode !== 'count');
    $('modeCount').setAttribute('aria-pressed', state.mode === 'count');
    $('sheetBox').classList.toggle('hide', state.mode === 'count');
    $('countBox').classList.toggle('hide', state.mode !== 'count');
  }
  FIELDS.forEach(function (k) { $(k).addEventListener('input', function () { state[k] = this.value; update(); }); });
  $('mode').addEventListener('click', function (e) {
    var b = e.target.closest('[data-m]'); if (!b) return;
    var m = b.getAttribute('data-m'); if (m === state.mode) return;
    /* 切到「只填处数」时把清单比出来的数带过去 */
    if (m === 'count' && out && out.P && state.mode === 'list' && out.match) { state.a = String(out.match.a); state.b = String(out.match.b); state.m = String(out.match.m); }
    state.mode = m; fillAll(); update();
  });
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; state = presetState(b.getAttribute('data-p')); fillAll(); update(); });
  function merge(fromB, intoA) { state.listB = state.listB.split(/\r?\n/).map(function (l) { return l.trim() === fromB ? intoA : l; }).join('\n'); fillAll(); update(); }
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = out.actions.filter(function (x) { return x.id === b.getAttribute('data-act'); })[0]; if (!a || !a.set) return;
    if (a.set.mergeB != null) return merge(a.set.mergeB, a.set.intoA);
    ['cap', 'conf', 'target'].forEach(function (k) { if (a.set[k] != null) state[k] = a.set[k]; });
    fillAll(); update();
  });
  $('nearBox').addEventListener('click', function (e) { var b = e.target.closest('[data-near]'); if (!b) return; var n = out.match.near[+b.getAttribute('data-near')]; if (n) merge(n.b, n.a); });

  function markErrors() {
    document.querySelectorAll('.bad').forEach(function (e) { e.classList.remove('bad'); });
    if (out.ok) return;
    out.errors.forEach(function (er) { var el = $(er.field); if (el) el.classList.add('bad'); });
  }
  function renderPresets() {
    var key = presetKey(state);
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (key === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = PRESETS.filter(function (p) { return p.key === key; })[0];
    $('presetNote').textContent = cur ? cur.note : '你改过的（按你填的算）。';
  }

  function why(o) {
    var P = o.P, s = [];
    s.push(P.nameA + '找到 ' + P.a + ' 处，' + P.nameB + '找到 ' + P.b + ' 处，两人都找到 ' + P.m + ' 处，合起来一共 ' + o.d + ' 处。');
    if (P.m > 0) s.push(P.nameB + '找到的里有 ' + A.pct0(o.rateA) + ' ' + P.nameA + '也找到了，所以' + P.nameA + '大概看见了 ' + A.pct0(o.rateA) + '；同理' + P.nameB + '大概看见了 ' + A.pct0(o.rateB) + '。');
    s.push(A.nextStep(o));
    return s.join('');
  }
  function head(o) {
    var h = esc(A.headline(o));
    if (o.level === 'more') h = h.replace('大概还剩 ' + o.median + ' 处', '大概还剩 <b>' + o.median + ' 处</b>');
    return h;
  }

  function venn(o) {
    var P = o.P, W = 420, H = 340, onlyA = P.a - P.m, onlyB = P.b - P.m;
    var big = Math.max(P.a, P.b), ra = 60 + 60 * Math.sqrt(P.a / big), rb = 60 + 60 * Math.sqrt(P.b / big);
    var ov = P.m / Math.max(1, Math.min(P.a, P.b)); /* 0 → 分开，1 → 小圆完全在里面 */
    var dist = (ra + rb + 10) - ov * (Math.min(ra, rb) * 2 + 10 - Math.abs(ra - rb));
    var cy = 148, total = ra + rb + dist, cxA = W / 2 - dist / 2, cxB = W / 2 + dist / 2;
    var s = '<rect x="8" y="8" width="' + (W - 16) + '" height="' + (H - 16) + '" rx="10" fill="none" stroke="#b9ad97" stroke-dasharray="6 5"/>';
    s += '<text x="20" y="32" fill="#8b8478" font-size="13">整份稿子里的错</text>';
    s += '<circle cx="' + cxA + '" cy="' + cy + '" r="' + ra + '" fill="#2f6fb0" fill-opacity=".16" stroke="#2f6fb0" stroke-width="2"/>';
    s += '<circle cx="' + cxB + '" cy="' + cy + '" r="' + rb + '" fill="#c2742a" fill-opacity=".16" stroke="#c2742a" stroke-width="2"/>';
    function t(x, y, txt, sz, col, w) { return '<text x="' + x + '" y="' + y + '" fill="' + col + '" font-size="' + sz + '" text-anchor="middle"' + (w ? ' font-weight="700"' : '') + '>' + esc(txt) + '</text>'; }
    var midX = (Math.max(cxA - ra, cxB - rb) + Math.min(cxA + ra, cxB + rb)) / 2;
    if (P.m > 0) { s += t(midX, cy + 4, String(P.m), 30, '#3d6b2f', 1); s += t(midX, cy + 24, '都找到', 12, '#3d6b2f'); }
    var la = P.m > 0 ? (cxA - ra + Math.max(cxA - ra, cxB - rb)) / 2 : cxA, lb = P.m > 0 ? (Math.min(cxA + ra, cxB + rb) + cxB + rb) / 2 : cxB;
    if (P.m > 0 && Math.abs(la - midX) < 34) la = cxA - ra * 0.55;
    if (P.m > 0 && Math.abs(lb - midX) < 34) lb = cxB + rb * 0.55;
    s += t(la, cy + 4, String(onlyA), 24, '#245a92', 1); s += t(la, cy + 22, '只有' + A.short(P.nameA, 4), 12, '#245a92');
    s += t(lb, cy + 4, String(onlyB), 24, '#8f5017', 1); s += t(lb, cy + 22, '只有' + A.short(P.nameB, 4), 12, '#8f5017');
    var rem = o.level === 'none' ? '?' : '约 ' + o.median;
    s += '<text id="remLab" x="' + (W / 2) + '" y="' + (H - 24) + '" fill="#8a3b12" font-size="15" text-anchor="middle"><tspan font-size="22" font-weight="700">' + esc(rem) + '</tspan>  处两人都没看见（虚线框里、圈外面）</text>';
    void total;
    return s;
  }
  function bars(o) {
    var box = $('bars').parentNode.clientWidth, W = Math.max(280, Math.min(560, box || 520)), nar = W < 420, H = nar ? 220 : 260, L = 40, R = 10, T = 16, B = 40;
    $('bars').setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var n = o.bars.length, mx = Math.max.apply(null, o.bars) || 1, bw = (W - L - R) / n, s = '';
    var top = Math.ceil(mx * 100 / 5) * 5 / 100 || 0.05;
    [0, 0.5, 1].forEach(function (f) { var y = T + (H - T - B) * (1 - f); s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="#ebe5d9"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" fill="#8b8478" font-size="11" text-anchor="end">' + (function (v) { return v % 1 ? v.toFixed(1) : String(v); })(Math.round(top * f * 1000) / 10) + '%</text>'; });
    o.bars.forEach(function (v, i) {
      var h = (H - T - B) * v / top, x = L + i * bw, col = i === o.qBar ? '#8a3b12' : (i < o.qBar ? '#2f6fb0' : '#a9c1dc');
      s += '<rect x="' + (x + bw * 0.12).toFixed(1) + '" y="' + (H - B - h).toFixed(1) + '" width="' + Math.max(1, bw * 0.76).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + col + '"/>';
    });
    var step = n <= 12 ? 1 : n <= 31 ? 5 : 10;
    var W0 = o.barW, labOf = function (i) { return (o.barsTail && i === n - 1) ? '≥' + i * W0 : String(i * W0); };
    for (var i = 0; i < n; i += step) { var lab = labOf(i); s += '<text x="' + (L + (i + 0.5) * bw).toFixed(1) + '" y="' + (H - B + 15) + '" fill="#8b8478" font-size="11" text-anchor="middle">' + lab + '</text>'; }
    if (o.barsTail && (n - 1) % step) s += '<text x="' + (L + (n - 0.5) * bw).toFixed(1) + '" y="' + (H - B + 15) + '" fill="#8b8478" font-size="11" text-anchor="middle">' + labOf(n - 1) + '</text>';
    s += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 6) + '" fill="#8b8478" font-size="12" text-anchor="middle">还剩几处' + (W0 > 1 ? '（每根柱 ' + W0 + ' 处）' : '') + '</text>';
    var qx = L + (o.qBar + 0.5) * bw, right = qx < W - R - 150;
    s += '<text id="qLab" x="' + (right ? qx + 6 : qx - 6) + '" y="' + (T + 12) + '" fill="#8a3b12" font-size="13" font-weight="700" text-anchor="' + (right ? 'start' : 'end') + '" stroke="#fffdf8" stroke-width="4" paint-order="stroke">' + o.P.conf + '% 把握：≤ ' + o.qRem + ' 处</text>';
    s += '<line x1="' + qx.toFixed(1) + '" x2="' + qx.toFixed(1) + '" y1="' + (T + 18) + '" y2="' + (H - B) + '" stroke="#8a3b12" stroke-dasharray="3 3"/>';
    return s;
  }

  function render() {
    var o = out;
    $('errBox').classList.toggle('hide', o.ok);
    ['okBox', 'vizPanel'].forEach(function (id) { $(id).classList.toggle('hide', !o.ok); });
    $('listPanel').classList.toggle('hide', !(state.mode !== 'count' && o.match));
    var M = o.match, P = o.P;
    $('labA').textContent = P.nameA + ' 找到几处'; $('labB').textContent = P.nameB + ' 找到几处';
    if (M) {
      $('cntA').textContent = M.a + ' 处' + (M.dupA ? '（去掉重复 ' + M.dupA + ' 行）' : '');
      $('cntB').textContent = M.b + ' 处' + (M.dupB ? '（去掉重复 ' + M.dupB + ' 行）' : '');
      var h = '', k = 0;
      M.both.forEach(function (x) { h += '<li><span class="who both">两人都找到</span><span>' + esc(x.a) + '</span></li>'; k++; });
      M.onlyA.forEach(function (x) { h += '<li><span class="who a">只有' + esc(A.short(P.nameA, 6)) + '</span><span>' + esc(x) + '</span></li>'; });
      M.onlyB.forEach(function (x) { h += '<li><span class="who b">只有' + esc(A.short(P.nameB, 6)) + '</span><span>' + esc(x) + '</span></li>'; });
      $('merged').innerHTML = h;
      $('mergedNote').textContent = '共 ' + (M.both.length + M.onlyA.length + M.onlyB.length) + ' 处' + (M.longA + M.longB ? '；超过 120 字的行只取前 120 字比对' : '');
      $('nearBox').classList.toggle('hide', !M.near.length);
      $('nearBox').innerHTML = M.near.length ? '<b>这几条说法不同，可能是同一处：</b>' + M.near.map(function (n, i) { return '<div><span class="t">「' + esc(n.a) + '」≈「' + esc(n.b) + '」（相似 ' + n.score + '%）</span><button type="button" class="btn sm" id="near' + i + '" data-near="' + i + '">算成同一处</button></div>'; }).join('') : '';
    } else { $('cntA').textContent = ''; $('cntB').textContent = ''; }
    if (!o.ok) { $('errBox').innerHTML = '先改好标红的地方：<ul>' + o.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>'; return; }
    $('tot').innerHTML = '<div id="totM"><span>大概还剩（一半可能不超过）</span><b>' + (o.level === 'none' ? '?' : o.median + ' 处') + '</b><small>平均 ' + A.n1(o.mean) + ' 处 · 经典公式 ' + A.n1(o.rHat) + ' 处</small></div>' +
      '<div class="key" id="totQ"><span>' + P.conf + '% 把握不超过</span><b>' + o.qRem + ' 处</b><small>上限按 ' + P.cap + ' 处算' + (P.capAuto ? '（自动）' : '') + (o.sensitive ? ' · 这个数主要是上限给的' : '') + '</small></div>' +
      '<div id="totZ"><span>已经一处不剩的把握</span><b>' + A.pct(o.pZero) + '</b><small>合起来已找到 ' + o.d + ' 处</small></div>';
    $('headline').innerHTML = head(o);
    $('why').textContent = why(o);
    var warn = '';
    if (o.sensitive) warn = '重合太少：把「最多可能有几处」从 ' + P.cap + ' 翻倍，' + P.conf + '% 把握的处数会从 ' + o.qRem + ' 变成 ' + o.qRem2 + '。这时候的数主要是你填的上限给的，别太当真。';
    $('warn').textContent = warn; $('warn').classList.toggle('hide', !warn);
    $('acts').innerHTML = o.actions.map(function (a) { return '<button type="button" class="act" id="' + a.id + '" data-act="' + a.id + '">→ ' + esc(a.text) + '</button>'; }).join('');
    $('venn').innerHTML = venn(o);
    $('bars').innerHTML = bars(o);
  }

  var rsz = null; window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { if (out && out.ok) $('bars').innerHTML = bars(out); }, 120); });
  function update() { out = A.compute(state); markErrors(); renderPresets(); render(); save(); }

  /* 导出 */
  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function tag() { return out.ok ? '还剩约' + (out.level === 'none' ? '未知' : out.median + '处') : '待改'; }
  $('dlCsv').addEventListener('click', function () { if (out.ok) download('两遍都没看见-合并勘误单.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { if (out.ok) download('两遍都没看见-' + tag() + '.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('两遍都没看见-备份.json', new Blob([JSON.stringify({ app: '两遍都没看见', slug: 'missed-by-both', version: 1, exported_at: stamp(), state: state }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importText(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('saveTag').textContent = '· 这个文件读不出来，没改动'; return false; }
    state = s; fillAll(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); fillAll(); update(); });

  /* 结果卡 PNG 1080×1350：文字取自同一次 out */
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), FF = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fffdf8'; g.fillRect(50, 50, W - 100, H - 100);
    g.fillStyle = '#e6b0aa'; g.fillRect(130, 50, 3, H - 100);
    var L = 160, Rr = W - 100, maxW = Rr - L, y = 150;
    function font(size, bold) { g.font = (bold ? '700 ' : '') + size + 'px ' + FF; }
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function wrap(t, size, color, bold, lim) {
      font(size, bold); g.fillStyle = color; var cur = '', n = 0;
      var toks = String(t).match(/[0-9.,%]+ ?(?:处|遍)?[）)。，、；：]?|[（(「]?[A-Za-z]+[）)」。，、；：]?|[（(「]?[^\s（(「][）)」。，、；：]?|\s/g) || [];
      for (var i = 0; i < toks.length; i++) { var ch = toks[i]; if (g.measureText(cur + ch).width > maxW && cur) { if (lim && ++n >= lim) { g.fillText(clip(cur + '…', maxW), L, y); y += size * 1.5; return; } g.fillText(cur, L, y); y += size * 1.5; cur = ch.trim() ? ch : ''; } else cur += ch; }
      if (cur) { g.fillText(cur, L, y); y += size * 1.5; }
    }
    font(52, true); g.fillStyle = '#24211c'; g.fillText('两遍都没看见', L, y); y += 56;
    if (!out.ok) { font(44, true); g.fillStyle = '#c0392b'; g.fillText('还算不了', L, y + 20); y += 90; out.errors.slice(0, 6).forEach(function (e) { wrap('· ' + e.message, 28, '#575148', false, 2); y += 8; }); y += 30; wrap('改好标红的地方，结果会自动重算。', 26, '#8b8478'); y += 40; wrap('这张卡算的是：两个人各自查一遍错，从两人都找到的重合有多少，估出两人都没看见的大概还剩几处。', 26, '#8b8478'); return cv; }
    var o = out, P = o.P;
    if (P.what) { font(26); g.fillStyle = '#8b8478'; g.fillText(clip('查的是：' + P.what, maxW), L, y); y += 50; } else y += 10;
    wrap(A.headline(o), 38, '#8a3b12', true, 3); y += 16;
    var bw = (maxW - 40) / 3, items = [['大概还剩', o.level === 'none' ? '?' : o.median + ' 处'], [P.conf + '% 把握不超过', o.qRem + ' 处'], ['已经一处不剩', A.pct(o.pZero)]];
    items.forEach(function (it, i) { var x0 = L + i * (bw + 20); g.fillStyle = i === 1 ? '#fff3d6' : '#faf7f0'; g.fillRect(x0, y, bw, 120); font(22); g.fillStyle = '#8b8478'; g.fillText(clip(it[0], bw - 30), x0 + 18, y + 40); var fs = 44; font(fs, true); while (fs > 22 && g.measureText(it[1]).width > bw - 30) { fs -= 2; font(fs, true); } g.fillStyle = i === 1 ? '#8a3b12' : '#24211c'; g.fillText(it[1], x0 + 18, y + 98); });
    y += 180;
    /* 三段条：只有 A / 都找到 / 只有 B / 估计没看见（中位） */
    var none = o.level === 'none', segs = [[P.a - P.m, '#2f6fb0', '只有' + A.short(P.nameA, 5)], [P.m, '#5b8c4a', '都找到'], [P.b - P.m, '#c2742a', '只有' + A.short(P.nameB, 5)], [none ? 0 : o.median, '#d8c6b4', '估计没看见']];
    var tot = segs.reduce(function (s, x) { return s + x[0]; }, 0) || 1, x = L;
    segs.forEach(function (sg) { var w = maxW * sg[0] / tot; g.fillStyle = sg[1]; g.fillRect(x, y, w, 56); if (w > 60) { font(26, true); g.fillStyle = '#fff'; g.fillText(String(sg[0]), x + 14, y + 38); } x += w; });
    y += 90; x = L;
    segs.forEach(function (sg, si) { if (!sg[0] && !(si === 3 && none)) return; font(22); var t = sg[2] + ' ' + (si === 3 && none ? '?' : sg[0]), tw = g.measureText(t).width; if (x > L && x + 24 + tw > Rr) { x = L; y += 34; } g.fillStyle = sg[1]; g.fillRect(x, y - 16, 16, 16); g.fillStyle = '#575148'; g.fillText(t, x + 24, y); x += tw + 60; });
    y += 70;
    wrap(P.nameA + '找到 ' + P.a + ' 处，' + P.nameB + '找到 ' + P.b + ' 处，两人都找到 ' + P.m + ' 处，合起来 ' + o.d + ' 处。', 28, '#24211c', false, 2); y += 10;
    wrap(A.nextStep(o), 28, '#575148', false, 4); y += 10;
    if (o.sensitive) { wrap('重合太少：结论主要取决于「最多可能有几处」（按 ' + P.cap + ' 处算）。', 26, '#b07a12', true, 2); }
    /* 剩下的空白画「还剩几处」的可能性柱图（与页面同一份 o.bars） */
    var cy0 = y + 30, cy1 = H - 200;
    if (cy1 - cy0 > 110) {
      font(22, true); g.fillStyle = '#575148'; g.fillText('还剩几处的可能性（深色到 ' + P.conf + '% 把握为止）', L, cy0); cy0 += 24;
      var nB = o.bars.length, mxB = Math.max.apply(null, o.bars) || 1, bwB = maxW / nB, hB = cy1 - cy0 - 34;
      o.bars.forEach(function (v, i) { var h = hB * v / mxB; g.fillStyle = i === o.qBar ? '#8a3b12' : (i < o.qBar ? '#2f6fb0' : '#a9c1dc'); g.fillRect(L + i * bwB + bwB * 0.12, cy0 + hB - h, Math.max(1, bwB * 0.76), h); });
      g.fillStyle = '#ddd6c8'; g.fillRect(L, cy0 + hB, maxW, 2);
      font(20); g.fillStyle = '#8b8478'; g.textAlign = 'left'; g.fillText('0 处', L, cy0 + hB + 28);
      g.textAlign = 'right'; g.fillText((o.barsTail ? '≥' + (nB - 1) * o.barW : String(nB * o.barW - 1)) + ' 处', Rr, cy0 + hB + 28); g.textAlign = 'left';
      var qx = L + (o.qBar + 0.5) * bwB; { font(20, true); g.fillStyle = '#8a3b12'; g.textAlign = qx > Rr - 160 ? 'right' : 'left'; g.fillText('≤ ' + o.qRem + ' 处', qx + (qx > Rr - 160 ? -8 : 8), cy0 + 20); g.textAlign = 'left'; }
    }
    y = H - 150;
    wrap('假设两人各查各的、每处错一样好找、查的时候稿子没改；难找的错两人都容易漏，真实剩余往往更多。默认数字为虚构示例。', 20, '#8b8478', false, 2);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (b) { if (b) download('两遍都没看见-' + tag() + '-1080x1350.png', b); }, 'image/png'); });

  window.__enUi = { state: function () { return clone(state); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };
  fillAll(); update();
})();
