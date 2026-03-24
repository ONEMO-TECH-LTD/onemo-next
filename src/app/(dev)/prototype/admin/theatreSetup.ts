// Theatre.js setup — admin only, never imported by core/ or user/
// Initializes Theatre Studio and creates the project + sheet for scene editing

import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
import { getProject } from '@theatre/core'

// Initialize Theatre Studio (only in dev/admin)
let initialized = false

export function initTheatre() {
  if (initialized) return
  studio.initialize()
  studio.extend(extension)
  initialized = true
}

// Create the project — this holds all scene state
// The project state can be exported to JSON for scene save/load
export const project = getProject('ONEMO Scene')

// The main sheet — contains all editable objects
export const sheet = project.sheet('Main')
