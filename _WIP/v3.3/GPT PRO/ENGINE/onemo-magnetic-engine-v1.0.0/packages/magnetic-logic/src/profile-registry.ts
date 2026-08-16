import { canonicalHash, canonicalJson } from '@onemo/geometry-compute';
import type { ProductProfile, RegisteredProfile } from './contracts.js';
import { validateProfile } from './profile-schema.js';

function deepFreeze<T>(value:T,seen=new Set<object>()):T{
  if(value&&typeof value==='object'){
    if(seen.has(value as object))return value;seen.add(value as object);
    for(const child of Object.values(value as Record<string,unknown>))deepFreeze(child,seen);
    Object.freeze(value);
  }
  return value;
}

export function profileCanonicalPayload(profile:ProductProfile):unknown{
  const {profileHash:_hash,...payload}=profile;return payload;
}

export function registerProfile(profile:ProductProfile):RegisteredProfile{
  const validation=validateProfile(profile);if(!validation.valid)throw new Error(`invalid profile: ${validation.errors.join('; ')}`);
  const hash=canonicalHash(profileCanonicalPayload(profile));
  if(profile.profileHash&&profile.profileHash!==hash)throw new Error(`profile hash mismatch: expected ${profile.profileHash}, computed ${hash}`);
  return deepFreeze({...profile,profileHash:hash}) as RegisteredProfile;
}

export class ProfileRegistry{
  readonly #profiles=new Map<string,RegisteredProfile>();
  public add(profile:ProductProfile):RegisteredProfile{const registered=registerProfile(profile);const key=`${registered.id}@${registered.version}`;const existing=this.#profiles.get(key);if(existing&&existing.profileHash!==registered.profileHash)throw new Error(`profile version collision: ${key}`);this.#profiles.set(key,registered);return registered;}
  public resolve(id:string,version?:number):RegisteredProfile{
    const matches=[...this.#profiles.values()].filter(p=>p.id===id&&(version===undefined||p.version===version)).sort((a,b)=>b.version-a.version);
    const profile=matches[0];if(!profile)throw new Error(`profile not found: ${id}${version?`@${version}`:''}`);return profile;
  }
  public canonicalBytes(profile:RegisteredProfile):string{return canonicalJson(profileCanonicalPayload(profile));}
}
