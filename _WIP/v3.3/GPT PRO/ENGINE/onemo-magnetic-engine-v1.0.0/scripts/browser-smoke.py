from __future__ import annotations
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
report={'chromium':None,'webkit':{'status':'not-run','reason':'WebKit browser executable is not installed in this container'}}
with sync_playwright() as p:
    try:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--allow-file-access-from-files','--disable-web-security'])
        page=browser.new_page()
        page.goto((ROOT/'reports/browser-smoke.html').as_uri(),wait_until='load')
        page.wait_for_function("document.documentElement.dataset.status !== undefined",timeout=60000)
        status=page.get_attribute('html','data-status')
        output=page.locator('#output').inner_text()
        try: parsed=json.loads(output)
        except Exception: parsed=output
        report['chromium']={'status':status,'output':parsed,'userAgent':page.evaluate('navigator.userAgent')}
        browser.close()
    except Exception as exc:
        report['chromium']={'status':'blocked','reason':str(exc)}
(ROOT/'reports/browser-smoke-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
