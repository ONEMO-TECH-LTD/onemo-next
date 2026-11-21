import { chromium } from 'playwright';

const url = 'https://fcs1jmkuc213ttja-77352566954.shopifypreview.com';
const outDir = '/Users/daniilsolopov/.gemini/antigravity/brain/5afbce7a-0bc4-4332-9c53-2b292b1eb4c7';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForSelector('onemo-shop-shell [data-shell-reel]', { timeout: 30000 });
await page.addStyleTag({ content: '#PBarNextFrameWrapper, #preview-bar-iframe, .shopify-preview-bar { display: none !important; }' });
await page.waitForTimeout(1000);

async function readState(idx = 1) {
  return await page.evaluate((i) => {
    const shell = document.querySelector('onemo-shop-shell');
    const sec = shell.closest('.onemo-shop-shell') || shell;
    const items = shell.querySelectorAll('[data-shell-item]');
    const item = items[i];
    const views = item ? item.querySelector('[data-shell-views]') : null;
    const slides = views ? Array.from(views.children) : [];
    const w = views ? views.clientWidth || 402 : 402;
    const activeSlideIdx = views ? Math.round(views.scrollLeft / w) : 0;
    const activeSlide = slides[activeSlideIdx];
    const card = activeSlide ? activeSlide.querySelector('[class$="-card-shop-effect-feed"], [class$="-card-shop-tee-feed"]') : null;
    const rect = card ? card.getBoundingClientRect() : null;
    const bottomBar = shell.querySelector('.onemo-shop-shell__bottom:not([hidden])');
    const prevBtn = bottomBar ? bottomBar.querySelector('button[class$="-prev"]') : null;
    const nextBtn = bottomBar ? bottomBar.querySelector('button[class$="-next"]') : null;
    const backEl = shell.querySelector('[data-shell-product-back]');
    return {
      productView: sec.hasAttribute('data-onemo-product-view'),
      mode: sec.getAttribute('data-onemo-mode'),
      viewsScrollLeft: views ? Math.round(views.scrollLeft) : null,
      activeSlideIdx,
      slidesCount: slides.length,
      cardTop: rect ? Math.round(rect.top) : null,
      cardCenterY: rect ? Math.round(rect.top + rect.height / 2) : null,
      cardSize: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : null,
      bottomHidden: !bottomBar,
      backHidden: backEl ? backEl.hidden : true,
      prevAriaDisabled: prevBtn ? prevBtn.getAttribute('aria-disabled') : null,
      nextAriaDisabled: nextBtn ? nextBtn.getAttribute('aria-disabled') : null,
    };
  }, idx);
}

// Scroll to Product 1, enter Product View
await page.evaluate(() => {
  const reel = document.querySelector('[data-shell-reel]');
  reel.scrollTo({ top: 874, behavior: 'instant' });
});
await page.waitForTimeout(600);
console.log('1. Browse Product 1:', JSON.stringify(await readState(1)));

await page.evaluate(() => {
  const item = document.querySelectorAll('[data-shell-item]')[1];
  const views = item.querySelector('[data-shell-views]');
  views.children[1].click();
});
await page.waitForTimeout(400);
console.log('3. Product 1 PV Look (view 1):', JSON.stringify(await readState(1)));

// Step left chevron to view 0 -> check aria-disabled
await page.click('.onemo-shop-shell__bottom:not([hidden]) button[class$="-prev"]');
await page.waitForTimeout(600);
console.log('4. Product 1 PV at view 0 (prevAriaDisabled):', JSON.stringify(await readState(1)));

// Switch to Size mode via [class$="-mode-size"] -> tap card (stays in PV) -> tap Back arrow [data-shell-product-back] (exits PV)
await page.click('.onemo-shop-shell__bottom:not([hidden]) [class$="-mode-size"]');
await page.waitForTimeout(500);
console.log('7a. Product 1 PV Size mode:', JSON.stringify(await readState(1)));
await page.screenshot({ path: `${outDir}/one-1800-qa-06b-p1-size-back-visible.png` });
await page.evaluate(() => {
  const item = document.querySelectorAll('[data-shell-item]')[1];
  const views = item.querySelector('[data-shell-views]');
  views.children[0].click();
});
await page.waitForTimeout(300);
const afterTapInSize = await readState(1);
await page.click('[data-shell-product-back]');
await page.waitForTimeout(500);
const afterBackClick = await readState(1);
console.log('7b. Tap in Size mode stays in PV:', afterTapInSize.productView, 'backHidden:', afterTapInSize.backHidden, '| Back button exits PV:', afterBackClick.productView);

// 8. Check all reel items and T-shirt item
const allItemsMeta = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('[data-shell-item]')).map((el, idx) => ({
    idx,
    itemId: el.dataset.shellItem,
    handle: el.dataset.productHandle || null,
    mode: el.dataset.onemoMode || null,
  }));
});
console.log('8. All reel items:', JSON.stringify(allItemsMeta));
const garmentIdx = allItemsMeta.find(m => m.idx > 0 && !m.mode)?.idx || -1;
if (garmentIdx > 0) {
  await page.evaluate((idx) => {
    const reel = document.querySelector('[data-shell-reel]');
    reel.scrollTo({ top: idx * 874, behavior: 'instant' });
  }, garmentIdx);
  await page.waitForTimeout(700);
  await page.evaluate((idx) => {
    const item = document.querySelectorAll('[data-shell-item]')[idx];
    const views = item.querySelector('[data-shell-views]');
    views.children[0].click();
  }, garmentIdx);
  await page.waitForTimeout(500);
  console.log('8a. Garment Look mode:', JSON.stringify(await readState(garmentIdx)));
  await page.click('.onemo-shop-shell__bottom:not([hidden]) [class$="-mode-size"]');
  await page.waitForTimeout(600);
  console.log('8b. Garment Size mode:', JSON.stringify(await readState(garmentIdx)));
  await page.screenshot({ path: `${outDir}/one-1800-qa-07-tee-pv-size.png` });
  await page.click('.onemo-shop-shell__bottom:not([hidden]) button[class$="-next"]');
  await page.waitForTimeout(600);
  console.log('8c. Garment Size mode after next chevron:', JSON.stringify(await readState(garmentIdx)));
  await page.click('.onemo-shop-shell__bottom:not([hidden]) [class$="-mode-material"]');
  await page.waitForTimeout(600);
  console.log('8d. Garment Material mode:', JSON.stringify(await readState(garmentIdx)));
  await page.screenshot({ path: `${outDir}/one-1800-qa-08-tee-pv-material.png` });
}

// 9. Check /products/<handle> route renders Home shell with initial_product
const firstHandle = allItemsMeta.find(m => m.idx > 0 && m.handle)?.handle;
if (firstHandle) {
  await page.goto(`${url}/products/${firstHandle}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('onemo-shop-shell [data-shell-reel]', { timeout: 30000 });
  await page.waitForTimeout(1000);
  const prodRouteInfo = await page.evaluate(() => {
    const shell = document.querySelector('onemo-shop-shell');
    return {
      hasShell: Boolean(shell),
      initialProduct: shell ? shell.dataset.initialProduct : null,
      itemsCount: shell ? shell.querySelectorAll('[data-shell-item]').length : 0,
    };
  });
  console.log('9. /products/<handle> route check:', JSON.stringify(prodRouteInfo));
}

await browser.close();
