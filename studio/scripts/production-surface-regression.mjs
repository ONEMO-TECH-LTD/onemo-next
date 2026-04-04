import { mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const shellScenePath = join(repoRoot, 'studio', 'data', 'scenes');

const shellUrl = 'http://127.0.0.1:3487/editor/scene/1';
const wrapperUrl = 'http://127.0.0.1:3005/studio';
const prototypeUrl = 'http://127.0.0.1:3005/prototype';

const outputDir = '/tmp/onemo-production-regression';
const saveSceneName = 'codex-production-regression-save';
const repeatedSaveSceneName = 'codex-production-regression-size';

const launchBrowser = async () => {
    return chromium.launch({
        headless: process.env.HEADLESS === '1',
        args: ['--enable-unsafe-swiftshader']
    });
};

const withPage = async (browser, url, task) => {
    const context = await browser.newContext({
        viewport: { width: 1600, height: 1000 }
    });
    const page = await context.newPage();

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(5000);
        return await task(page);
    } finally {
        await page.close();
        await context.close();
    }
};

const getSavedSceneSize = async (sceneName) => {
    const scenePath = join(shellScenePath, `${sceneName}.onemo`);
    if (!existsSync(scenePath)) {
        return null;
    }

    const sceneStat = await stat(scenePath);
    return sceneStat.size;
};

const main = async () => {
    await mkdir(outputDir, { recursive: true });

    const browser = await launchBrowser();

    try {
        const shell = await withPage(browser, shellUrl, async (page) => {
            const urls = [];
            const consoleMessages = [];

            page.on('requestfinished', (request) => {
                urls.push(request.url());
            });
            page.on('console', (message) => {
                consoleMessages.push({
                    type: message.type(),
                    text: message.text()
                });
            });

            await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(5000);

            await page.evaluate(() => {
                const settings = editor.call('settings:projectUser');
                editor.call('selector:set', 'editorSettings', [settings]);
                editor.emit('attributes:inspect[editorSettings]');
                editor.call('editorSettings:tab:set', 'editor');
            });
            await page.waitForTimeout(500);

            const fieldVisible = (await page.locator('text=Show Grid').count()) > 0;

            const gridStates = await page.evaluate(() => {
                const settings = editor.call('settings:projectUser');
                const before = {
                    showGrid: settings.get('editor.showGrid'),
                    divisions: settings.get('editor.gridDivisions')
                };

                settings.set('editor.showGrid', false);
                const hidden = {
                    showGrid: settings.get('editor.showGrid'),
                    divisions: settings.get('editor.gridDivisions')
                };

                settings.set('editor.showGrid', true);
                const shown = {
                    showGrid: settings.get('editor.showGrid'),
                    divisions: settings.get('editor.gridDivisions')
                };

                return { before, hidden, shown };
            });

            const saveResult = await page.evaluate(async (sceneName) => {
                await editor.call('r3f:scene:saveNamed', sceneName);
                return {
                    lastScene: window.localStorage.getItem('onemo.playcanvas.last-scene'),
                    statusText: document.querySelector('.status')?.textContent ?? null
                };
            }, saveSceneName);

            const repeatedSaveSizes = [];
            for (let i = 0; i < 3; i += 1) {
                await page.evaluate(async (sceneName) => {
                    await editor.call('r3f:scene:saveNamed', sceneName);
                }, repeatedSaveSceneName);
                await page.waitForTimeout(1200);
                repeatedSaveSizes.push(await getSavedSceneSize(repeatedSaveSceneName));
            }

            const bridgeState = await page.evaluate(() => {
                const bridge = editor.call('viewport:bridgeAdapter');
                return {
                    environment: bridge?.config?.environment ?? null,
                    scene: bridge?.config?.scene ?? null,
                    productRoles: bridge?.config?.product?.materialRoles?.map((role) => role.role) ?? []
                };
            });

            const shellScreenshotPath = join(outputDir, 'studio-shell.png');
            await page.screenshot({ path: shellScreenshotPath, fullPage: false });

            return {
                remoteHdrRequests: urls.filter((url) => /raw\.githack|raw\.githubusercontent/i.test(url)),
                localHdrRequests: urls.filter((url) => /\/assets\/env\/studio_small_03_1k\.hdr/i.test(url)),
                consoleMessages,
                fieldVisible,
                gridStates,
                saveResult,
                repeatedSaveSizes,
                bridgeState,
                screenshot: shellScreenshotPath
            };
        });

        const wrapper = await withPage(browser, wrapperUrl, async (page) => {
            const consoleMessages = [];
            page.on('console', (message) => {
                consoleMessages.push({
                    type: message.type(),
                    text: message.text()
                });
            });

            const iframeAllow = await page.locator('iframe').getAttribute('allow');

            return {
                iframeAllow,
                consoleMessages
            };
        });

        const prototype = await withPage(browser, prototypeUrl, async (page) => {
            const urls = [];
            page.on('requestfinished', (request) => {
                urls.push(request.url());
            });

            const prototypeScreenshotPath = join(outputDir, 'prototype.png');
            await page.screenshot({ path: prototypeScreenshotPath, fullPage: false });

            return {
                sceneRequests: urls.filter((url) => /\/api\/dev\/scenes\//i.test(url)),
                remoteHdrRequests: urls.filter((url) => /raw\.githack|raw\.githubusercontent/i.test(url)),
                localHdrRequests: urls.filter((url) => /\/assets\/env\/studio_small_03_1k\.hdr/i.test(url)),
                screenshot: prototypeScreenshotPath
            };
        });

        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                shellUrl,
                wrapperUrl,
                prototypeUrl,
                outputDir
            },
            shell,
            wrapper,
            prototype
        };

        const reportPath = join(outputDir, 'report.json');
        await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        console.log(JSON.stringify({ reportPath, ...report }, null, 2));
    } finally {
        await browser.close();
    }
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
