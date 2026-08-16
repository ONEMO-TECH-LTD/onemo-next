import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReferenceProfile } from '../packages/magnetic-logic/dist/src/index.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dir=resolve(root,'packages/magnetic-logic/profiles');await mkdir(dir,{recursive:true});
const reference=createReferenceProfile();
await writeFile(resolve(dir,'onemo-magnetic-v1-reference.json'),JSON.stringify(reference,null,2)+'\n');
const {profileHash:_profileHash,...draft}=structuredClone(reference);
draft.id='onemo-magnetic-v1-production-template';draft.version=1;draft.approvalState='draft';draft.productionReady=false;
draft.engineeringAssumptions=[
  'TEMPLATE: replace structural thresholds with approved PD-17 calibration.',
  'TEMPLATE: replace pattern permissions and ranks with approved PD-19 values.',
  'TEMPLATE: resolve PD-27 sub-quantum behaviour.',
  'TEMPLATE: set an approved maximum input vertex count and upstream simplification owner under PD-35.',
  'TEMPLATE: define the approved B1 guarantee under PD-36.',
  'TEMPLATE: set real cut, placement, material and assembly tolerances and an effective verification radius under PD-38.',
  'TEMPLATE: attach the Dan-approved Batwoman fixture hash and mappings under PD-29.',
  'TEMPLATE: enable a 96 mm population only if PD-04/PD-34 is explicitly confirmed.'
];
await writeFile(resolve(dir,'onemo-magnetic-v1-production-template.json'),JSON.stringify(draft,null,2)+'\n');
