import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const files=[];
async function walk(dir){
  for(const name of (await readdir(dir)).sort()){
    if(name==='node_modules'||name==='.git') continue;
    const path=join(dir,name); const s=await stat(path);
    if(s.isDirectory()) await walk(path);
    else if(!path.endsWith('artifact-manifest.sha256')) files.push(path);
  }
}
await walk(root);
const lines=[];
for(const path of files){
  const hash=createHash('sha256').update(await readFile(path)).digest('hex');
  lines.push(`${hash}  ${relative(root,path)}`);
}
await writeFile(join(root,'artifact-manifest.sha256'),lines.join('\n')+'\n');
console.log(`wrote ${lines.length} hashes`);
