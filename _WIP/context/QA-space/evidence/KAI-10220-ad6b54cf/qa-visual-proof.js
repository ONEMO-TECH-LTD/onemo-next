async (page) => {
  const status = page.locator('p').filter({ hasText: 'Status:' })
  await page.locator('input[type=file]').first().setInputFiles('/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s62-pixel-v1-050d557e/public/assets/test-artwork.png')
  await status.filter({ hasText: /image ready/ }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /Detect/ }).click()
  await status.filter({ hasText: /done \(cut: u2netp\)/ }).waitFor({ timeout: 60_000 })
  const detectStatus = await status.textContent()
  const timing = await page.getByText('magic cut').locator('..').textContent()

  await page.getByRole('button', { name: /Vector/ }).click()
  const preset = page.getByRole('combobox', { name: 'vector preset' })
  await preset.selectOption('TECHNO')
  await status.filter({ hasText: /TECHNO vector preset/ }).waitFor()
  const undo = page.getByRole('button', { name: /Undo/ })
  const undoAfterPresetDisabled = await undo.isDisabled()
  await page.getByRole('button', { name: 'smooth', exact: true }).click()
  const knob = page.locator('input[type=number]')
  const technoSmoothBeforePaint = await knob.inputValue()

  await page.getByRole('button', { name: /^✋ Edit$/ }).click()
  await page.getByRole('button', { name: /Paint shape/ }).click()
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas not visible')
  await page.mouse.move(box.x + box.width * 0.44, box.y + box.height * 0.44)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.56, box.y + box.height * 0.56, { steps: 5 })
  await page.mouse.up()
  await status.filter({ hasText: /added — auto-tuned/ }).waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: /Vector/ }).click()
  const paintPreset = await preset.inputValue()
  await undo.click()
  await status.filter({ hasText: /restored previous cut/ }).waitFor({ timeout: 60_000 })
  const restoredPreset = await preset.inputValue()
  await page.getByRole('button', { name: 'smooth', exact: true }).click()
  const restoredSmooth = await knob.inputValue()

  await preset.selectOption('PURE')
  await status.filter({ hasText: /PURE vector preset/ }).waitFor()
  const values = {}
  for (const name of ['detail', 'offset', 'simplify', 'smooth', 'radius']) {
    await page.getByRole('button', { name, exact: true }).click()
    const slider = page.locator('input[type=range]').first()
    values[name] = {
      value: await knob.inputValue(),
      min: await slider.getAttribute('min'),
      max: await slider.getAttribute('max'),
      label: await knob.locator('..').locator('span').first().textContent(),
    }
  }
  await page.getByRole('button', { name: 'detail', exact: true }).click()
  await page.screenshot({
    path: '_WIP/context/QA-space/evidence/KAI-10220-ad6b54cf/qa-current-pure-all-ones.png',
    fullPage: true,
  })
  return {
    detectStatus,
    timing,
    undoAfterPresetDisabled,
    technoSmoothBeforePaint,
    paintPreset,
    restoredPreset,
    restoredSmooth,
    pure: values,
    finalStatus: await status.textContent(),
    canvas: await canvas.evaluate((element) => ({ width: element.width, height: element.height })),
  }
}
