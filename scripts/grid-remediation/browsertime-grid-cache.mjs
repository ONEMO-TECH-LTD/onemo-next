export default async function (context, commands) {
  const url = context.options.gridLabUrl
  if (!url) throw new Error('--gridLabUrl is required.')

  await commands.navigate(url)
  await commands.wait.byCondition(
    "window.__GRID_LAB_PROOF__?.status === 'ready' && Boolean(window.__GRID_LAB_PROOF__?.renderedPlanKey)",
    60_000,
  )

  await commands.js.run(`
    window.__gridBtBefore = document.querySelector('.gl')?.dataset.gridRenderedPlanKey;
  `)
  await commands.measure.start('grid-cold-circle')
  await commands.js.run(`
    window.__gridBtOpenedAt = performance.now();
    window.__gridBtElapsed = undefined;
    const root = document.querySelector('.gl');
    const observer = new MutationObserver(() => {
      if (root?.dataset.gridRenderedPlanKey && root.dataset.gridRenderedPlanKey !== window.__gridBtBefore) {
        window.__gridBtElapsed = performance.now() - window.__gridBtOpenedAt;
        observer.disconnect();
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-grid-rendered-plan-key'] });
    const button = [...document.querySelectorAll('button')]
      .find((node) => node.textContent?.trim() === 'Circle');
    if (!button) throw new Error('Circle button not found.');
    button.click();
  `)
  await commands.wait.byCondition(
    'Number.isFinite(window.__gridBtElapsed)',
    60_000,
  )
  await commands.measure.stop()
  const coldMs = await commands.js.run(
    'return window.__gridBtElapsed',
  )
  commands.measure.add('matchingRenderCommitProxyMs', coldMs)

  await commands.wait.byCondition(
    "window.__GRID_LAB_PROOF__?.status === 'ready'",
    60_000,
  )
  await commands.js.run(`
    const field = [...document.querySelectorAll('.gl-field')]
      .find((node) => node.querySelector(':scope > span')?.textContent?.startsWith('Size ·'));
    const button = field?.querySelector('button:not([aria-pressed="true"])');
    if (!button) throw new Error('Warm seeded size button not found.');
    window.__gridBtWarmButton = button;
    window.__gridBtWarmLabel = button.textContent?.trim();
    window.__gridBtBefore = document.querySelector('.gl')?.dataset.gridRenderedPlanKey;
  `)
  await commands.measure.start('grid-warm-seeded-size')
  await commands.js.run(`
    window.__gridBtOpenedAt = performance.now();
    window.__gridBtElapsed = undefined;
    const root = document.querySelector('.gl');
    const observer = new MutationObserver(() => {
      if (root?.dataset.gridRenderedPlanKey && root.dataset.gridRenderedPlanKey !== window.__gridBtBefore) {
        window.__gridBtElapsed = performance.now() - window.__gridBtOpenedAt;
        observer.disconnect();
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-grid-rendered-plan-key'] });
    window.__gridBtWarmButton.click();
  `)
  await commands.wait.byCondition(
    'Number.isFinite(window.__gridBtElapsed)',
    30_000,
  )
  await commands.measure.stop()
  const warmMs = await commands.js.run(
    'return window.__gridBtElapsed',
  )
  commands.measure.add('matchingRenderCommitProxyMs', warmMs)
  commands.measure.add(
    'warmButtonLabel',
    await commands.js.run('return window.__gridBtWarmLabel'),
  )
}
