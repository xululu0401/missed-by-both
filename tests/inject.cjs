'use strict';
/* 注入测试：对 core.js 做一处小改动，看核心测试能不能抓到。跑完自动还原。 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const F=path.join(__dirname,'../core.js'),src=fs.readFileSync(F,'utf8');
/* 删掉的等价变异（输出不变）：
 *  - 去掉「p >= 1 return 1」：log(1−1) = −∞，T/R 的对数除以 −∞ 得 0，max(1, 0) 仍是 1；
 *  - 柱图范围去掉 max(…, qRem)：把握最高 99%，99.5% 分位总 ≥ qRem；
 *  - 「conf > 80」改「>= 80」：conf = 80 时 80% 分位就是原分位，被「q80 < qRem」挡住。 */
const M=[
["* N / (N + 1); var v","; var v"],
["(N + 1 - a) * (N + 1 - b) / ((N + 1 - d) * (N + 1))","(N + 1 - a) * (N + 1 - b) / ((N + 1 - d) * (N + 2))"],
["for (var N = d; N < cap; N++)","for (var N = d; N <= cap; N++)"],
["if (acc >= q - EPS) return i;","if (acc > q) return i;"],
["function chapman(a, b, m) { return (a + 1) * (b + 1) / (m + 1) - 1; }","function chapman(a, b, m) { return (a + 1) * (b + 1) / (m + 1); }"],
["function autoCap(d) { return Math.min(MAX_CAP, Math.max(4 * d, d + 30)); }","function autoCap(d) { return Math.min(MAX_CAP, Math.max(3 * d, d + 30)); }"],
["o.rateA = m / b; o.rateB = m / a;","o.rateA = m / a; o.rateB = m / a;"],
["o.pBar = (o.rateA + o.rateB) / 2;","o.pBar = Math.max(o.rateA, o.rateB);"],
["o.mean = pr.reduce(function (s, x, i) { return s + x * i; }, 0);","o.mean = pr.reduce(function (s, x, i) { return s + x * (i + 1); }, 0);"],
["o.median = quantile(pr, 0.5);","o.median = quantile(pr, 0.6);"],
["o.sensitive = o.qRem2 - o.qRem >= Math.max(2,","o.sensitive = o.qRem2 - o.qRem >= Math.max(1,"],
["Math.ceil(0.1 * o.qRem - EPS)","Math.ceil(0.2 * o.qRem - EPS)"],
["o.level = m === 0 ? 'none' : (o.mean <= P.target + EPS ? 'done' : 'more');","o.level = m === 0 ? 'none' : (o.mean < P.target ? 'done' : 'more');"],
["if (R <= T + EPS) return 0;","if (R < T) return 0;"],
["Math.log(T > 0 ? T / R : 0.5 / R)","Math.log(T > 0 ? T / R : 1 / R)"],
["Math.ceil((hi + 1) / 60))","Math.ceil((hi + 1) / 61))"],
["o.qBar = Math.floor(o.qRem / w);","o.qBar = Math.round(o.qRem / w);"],
["o.barsTail = nb * w < pr.length;","o.barsTail = nb * w <= pr.length;"],
["if (o.level === 'more' && o.passes != null && o.passes > 1) {","if (o.level === 'more' && o.passes != null && o.passes > 0) {"],
["if (q80 < o.qRem) acts.push","acts.push"],
["if (c2 > P.cap) acts.push","acts.push"],
["if (P.mode === 'list' && P.match.near.length) {","if (false) {"],
["var s = dice(x.key, y.key); if (s >= 0.5)","var s = dice(x.key, y.key); if (s >= 0.3)"],
["if (near.length >= 5 || ua[c.i] || ub[c.j]) return;","if (near.length >= 5) return;"],
["for (var g in A.o) if (B.o[g]) hit += Math.min(A.o[g], B.o[g]);","for (var g in A.o) if (B.o[g]) hit += A.o[g];"],
[".replace(/\\s+/g, '').replace(/[。.,，;；!！?？、]+$/, '');",".replace(/[。.,，;；!！?？、]+$/, '');"],
["if (seen[k]) { dup++; return; }",""],
["if (s.length > 120) { s = s.slice(0, 120); long++; }",""],
["if (raA > MAX_LINES) E(","if (raA > MAX_LINES + 1) E("],
["if (P.a < 1) E(","if (P.a < 0) E("],
["else if (P.a >= 1 && P.b >= 1 && P.m > Math.min(P.a, P.b))","else if (P.a >= 1 && P.b >= 1 && P.m > Math.max(P.a, P.b))"],
["if (!(P.a >= 1 && P.a <= MAX_COUNT))","if (!(P.a >= 0 && P.a <= MAX_COUNT))"],
["else if (!P.capAuto && P.d > 0 && P.cap < P.d)","else if (!P.capAuto && P.d > 0 && P.cap <= P.d)"],
["if (!(P.conf >= 50 && P.conf <= 99))","if (!(P.conf >= 50 && P.conf <= 100))"],
["if (!(P.target >= 0 && P.target <= 100))","if (!(P.target >= 1 && P.target <= 100))"],
["if (P.nameA === P.nameB) P.nameB = P.nameB + '（2）';",""],
["if (/^\\d+(\\.0+)?$/.test(s))","if (/^\\d+(\\.\\d+)?$/.test(s))"],
["/^[=+\\-@]/.test(s)","false"],
["return String(s).replace(/\\|/g, '\\\\|')","return String(s)"],
["if (v >= 100 && x < 1 - EPS) v = 99.9;",""],
["if (v <= 0 && x > EPS) return '不到 1%';",""],
];
let caught=0,missed=[],nomatch=[];
try{
M.forEach(([a,b],i)=>{
  if(src.indexOf(a)<0){nomatch.push(i);return;}
  fs.writeFileSync(F,src.replace(a,b));
  let fail=false;try{execFileSync(process.execPath,['--test',path.join(__dirname,'core.test.cjs')],{stdio:'pipe',timeout:180000});}catch(e){fail=true;}
  if(fail)caught++;else missed.push(i+': '+b.slice(0,90));
});
}finally{fs.writeFileSync(F,src);}
const n=M.length-nomatch.length;
console.log('注入 '+n+' 处，抓到 '+caught+'，漏 '+missed.length+(nomatch.length?'，未匹配 '+nomatch.join(','):''));
missed.forEach(m=>console.log('  漏：'+m));
