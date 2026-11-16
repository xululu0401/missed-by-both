/* 封面 cover.svg（1200×1200），读数来自 core.js 同一次 compute；再用浏览器截成 cover.png。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState());
if (!o.ok || o.median !== 5 || o.qRem !== 14 || o.P.m !== 6) throw new Error('默认场景不对');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
const P = o.P;
let bars = '';
const n = o.bars.length, mx = Math.max(...o.bars), bw = 900 / n;
o.bars.forEach((v, i) => { const h = 220 * v / mx; bars += `<rect x="${(150 + i * bw + bw * 0.12).toFixed(1)}" y="${(1010 - h).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${h.toFixed(1)}" fill="${i === o.qBar ? '#8a3b12' : i < o.qBar ? '#2f6fb0' : '#a9c1dc'}"/>`; });
const qx = 150 + (o.qBar + 0.5) * bw;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f4f1ea"/>
  <rect x="60" y="60" width="1080" height="1080" fill="#fffdf8"/>
  <rect x="125" y="60" width="4" height="1080" fill="#e6b0aa"/>
  <text x="150" y="215" font-family="${F}" font-size="118" font-weight="800" fill="#24211c">两遍都没看见</text>
  <text x="150" y="290" font-family="${F}" font-size="38" fill="#575148">两个人各查一遍错，还剩几处没找到</text>
  <circle cx="420" cy="520" r="150" fill="#2f6fb0" fill-opacity=".16" stroke="#2f6fb0" stroke-width="4"/>
  <circle cx="610" cy="520" r="135" fill="#c2742a" fill-opacity=".16" stroke="#c2742a" stroke-width="4"/>
  <text x="340" y="535" font-family="${F}" font-size="56" font-weight="800" fill="#245a92" text-anchor="middle">${P.a - P.m}</text>
  <text x="340" y="575" font-family="${F}" font-size="24" fill="#245a92" text-anchor="middle">只有我</text>
  <text x="518" y="540" font-family="${F}" font-size="70" font-weight="800" fill="#3d6b2f" text-anchor="middle">${P.m}</text>
  <text x="518" y="580" font-family="${F}" font-size="24" fill="#3d6b2f" text-anchor="middle">都找到</text>
  <text x="680" y="535" font-family="${F}" font-size="56" font-weight="800" fill="#8f5017" text-anchor="middle">${P.b - P.m}</text>
  <text x="680" y="575" font-family="${F}" font-size="24" fill="#8f5017" text-anchor="middle">只有室友</text>
  <text x="790" y="470" font-family="${F}" font-size="34" fill="#575148">大概还剩</text>
  <text x="790" y="560" font-family="${F}" font-size="96" font-weight="800" fill="#8a3b12">${o.median} 处</text>
  <text x="790" y="615" font-family="${F}" font-size="30" fill="#575148">九成把握 ≤ ${o.qRem} 处</text>
  <text x="150" y="760" font-family="${F}" font-size="28" fill="#575148">还剩几处的可能性</text>
  ${bars}
  <line x1="150" x2="1050" y1="1011" y2="1011" stroke="#ddd6c8" stroke-width="2"/>
  <text x="${(qx + 10).toFixed(1)}" y="${1010 - 220 * o.bars[o.qBar] / mx - 14}" font-family="${F}" font-size="26" font-weight="700" fill="#8a3b12">≤ ${o.qRem} 处</text>
  <text x="150" y="1080" font-family="${F}" font-size="24" fill="#8b8478">两人各查各的、每处错一样好找时的估计 · 数字为虚构示例</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
fs.writeFileSync('/tmp/cover93.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body>' + svg + '</body></html>');
console.log('cover.svg', svg.length);
