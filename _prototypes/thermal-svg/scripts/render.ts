// Headless use of the engine, the way an API route would call it:
//   npm run render -- [config.json] [out.svg]
// With no config it renders the defaults. Proves the engine needs no browser.

import { readFileSync, writeFileSync } from 'node:fs'
import { renderThermal } from '../src/engine'

const [configPath, outPath = 'thermal.svg'] = process.argv.slice(2)
const input = configPath ? JSON.parse(readFileSync(configPath, 'utf8')) : {}
const { svg, width, height } = renderThermal(input)
writeFileSync(outPath, svg)
console.log(`${outPath}: ${width}×${height}, ${(svg.length / 1024).toFixed(1)} KB`)
