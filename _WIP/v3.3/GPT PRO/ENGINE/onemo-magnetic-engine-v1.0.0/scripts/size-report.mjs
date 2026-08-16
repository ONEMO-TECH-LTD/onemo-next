import { createGzip } from 'node:zlib';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const gzipAsync=promisify(gzip);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function filesUnder(dir){const out=[];async function walk(d){for(const n of (await readdir(d)).sort()){const p=join(d,n);const s=await stat(p);if(s.isDirectory())await walk(p);else if(p.endsWith('.js'))out.push(p);}}await walk(dir);return out;}
const packages={compute:'packages/geometry-compute/dist',logic:'packages/magnetic-logic/dist',nextAdapter:'packages/magnetic-next/dist'};
const report={generatedAt:new Date().toISOString(),packages:{}};
for(const [name,rel] of Object.entries(packages)){const files=await filesUnder(resolve(root,rel));let raw=0;const chunks=[];for(const f of files){const b=await readFile(f);raw+=b.length;chunks.push(Buffer.from(relative(resolve(root,rel),f)+'\0'),b,Buffer.from('\0'));}const gz=await gzipAsync(Buffer.concat(chunks),{level:9});report.packages[name]={javascriptFiles:files.length,rawBytes:raw,gzipBytes:gz.length};}
await mkdir(resolve(root,'reports'),{recursive:true});await writeFile(resolve(root,'reports/bundle-size-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
