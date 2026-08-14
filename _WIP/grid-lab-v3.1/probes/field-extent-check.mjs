// Field extent must yield EXACTLY N positions for every N the spec's guard permits (1..99).
const naive   = (N) => { const h = Math.floor(N / 2); return [-h, h]; };
const correct = (N) => { const min = -Math.floor(N / 2); return [min, min + N - 1]; };
const count = ([a, b]) => b - a + 1;
let naiveBad = 0;
for (let N = 1; N <= 99; N++) {
  if (count(naive(N)) !== N) naiveBad++;
  if (count(correct(N)) !== N) throw new Error(`correct formula wrong at N=${N}`);
}
console.log(`naive [-floor(N/2), floor(N/2)] wrong for ${naiveBad} of 99 legal values (every even N)`);
for (const N of [8, 9]) console.log(`  N=${N}: naive ${JSON.stringify(naive(N))}=${count(naive(N))}  correct ${JSON.stringify(correct(N))}=${count(correct(N))}`);
console.log('correct formula: exact for all 99 legal values');
