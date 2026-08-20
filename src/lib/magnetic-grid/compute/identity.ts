// §6.2: "identity.ts owns canonical serialization."
//
// This is the boundary between the BigInt arithmetic compute works in (§6.2, and the "deterministic
// BigInt interval arithmetic" §7.1b.4 assumes) and the decimal-string form §6.1 declares, whose
// stated purpose is that "Node/browser/worker/cache bytes agree" — the same form §6.4 canonicalizes
// identity with.
//
// Only values that are EXACTLY representable in the target form are converted here. A certified
// enclosure is not a rational and does not become one; it needs its own certificate, which is a
// later conversion family with its own proof.

import type { Rational } from '../spec'
import { rational, type ExactRational } from './exact-real'

/** §6.1 `Rational` — decimal-string integers, normalized, lossless in both directions. */
export function encodeRational(value: ExactRational): Rational {
  return { numerator: value.n.toString(), denominator: value.d.toString() }
}

/** The inverse. Round-tripping any exact rational returns the identical value. */
export function decodeRational(value: Rational): ExactRational {
  return rational(BigInt(value.numerator), BigInt(value.denominator))
}
