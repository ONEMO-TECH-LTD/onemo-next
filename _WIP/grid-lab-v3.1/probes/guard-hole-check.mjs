// Does the EXISTING "portable imports nothing outward" guard catch a bridge reaching into ui/?
// Guard source: src/lib/grid-engine/__tests__/separation.test.ts:154
const OUTWARD = /from ['"](@\/[^'"]+|\.\.\/[^'"]+)['"]/g;
const cases = [
  ['bridge -> seam        ./compute/candidates',                 `import { c } from "./compute/candidates"`,               'must pass'],
  ['bridge -> part 3      ./logic/.../dist/index.js',            `import { a } from "./logic/mg-product-logic/dist/index.js"`,'must pass'],
  ['bridge -> ui          ./ui/trace-cutout',                    `import type { R } from "./ui/trace-cutout"`,             'must FAIL'],
  ['bridge -> ui (alias)  @/lib/grid-engine/ui/trace-cutout',    `import type { R } from "@/lib/grid-engine/ui/trace-cutout"`,'must FAIL'],
];
let holes = 0;
for (const [label, src, expectation] of cases) {
  const caught = [...src.matchAll(OUTWARD)].length > 0;
  const ok = expectation === 'must FAIL' ? caught : !caught;
  if (!ok) holes++;
  console.log(`${ok ? 'OK  ' : 'HOLE'}  ${label.padEnd(48)} ${expectation.padEnd(9)} caught=${caught}`);
}
console.log(holes ? `\n${holes} unguarded direction(s) — the repaired guard must close these.` : '\nno holes');
