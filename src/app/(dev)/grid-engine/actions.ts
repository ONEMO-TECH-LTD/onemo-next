'use server'

import {
  createReferenceProfile,
  currentManufacturingVerificationResolver,
} from '@onemo/magnetic-logic'
import { parseManufacturingSpec, verifyOnServer } from '@onemo/magnetic-next'

export async function verifyManufacturingSpecAction(serialized: string) {
  const profile = createReferenceProfile()
  const spec = parseManufacturingSpec(serialized)
  return verifyOnServer(spec, currentManufacturingVerificationResolver(profile))
}
