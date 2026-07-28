export function formatReportTable(report) {
  const headers = ['Surface', 'Engine', 'Scenario', 'Cold ms', 'Warm ms', 'T1', 'T2']
  const rows = report.profiles.flatMap((profile) => profile.scenarios.map((scenario) => [
    profile.id,
    `${profile.engine} ${profile.engineVersion}`,
    scenario.label,
    scenario.cold.elapsedMs.toFixed(1),
    scenario.warm.elapsedMs.toFixed(1),
    scenario.baselineT1Pass ? 'PASS' : 'DIFF',
    scenario.t2Pass ? 'PASS' : 'FAIL',
  ]))
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => String(row[index]).length),
  ))
  const line = (row) => `| ${row.map((cell, index) => String(cell).padEnd(widths[index])).join(' | ')} |`
  return [
    line(headers),
    line(widths.map((width) => '-'.repeat(width))),
    ...rows.map(line),
  ].join('\n')
}

export function assertColdWarmReport(report) {
  for (const profile of report.profiles) {
    for (const scenario of profile.scenarios) {
      for (const temperature of ['cold', 'warm']) {
        if (!Number.isFinite(scenario[temperature]?.elapsedMs)) {
          throw new Error(`${profile.id}/${scenario.id} is missing ${temperature} timing.`)
        }
      }
    }
  }
}
