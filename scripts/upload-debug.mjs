/**
 * scripts/upload-debug.mjs - Debug why "Đăng" button click doesn't work
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log(`[debug] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function main() {
  const videoPath = resolve(ROOT, 'outputs', 'GZ-01', 'final.mp4');
  const caption = 'AI Video Generator Test #ai #automation #fyp #tiktok2026';

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    storageState: resolve(ROOT, '.tiktok-session.json'),
    viewport: { width: 1280, height: 900 }
  });
  const page = await ctx.newPage();

  // Log ALL console messages and network requests
  page.on('console', msg => {
    if (msg.type() === 'error') {
      log(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });
  
  page.on('requestfailed', req => {
    log(`[REQUEST FAILED] ${req.url().slice(0, 100)} - ${req.failure()?.errorText}`);
  });

  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);

    // Upload file
    await page.locator('input[type="file"]').first().setInputFiles(videoPath);
    log('File set');
    await page.waitForTimeout(12000);

    // Fill caption
    const captionEl = page.locator('div[contenteditable="true"]').first();
    await captionEl.click();
    await captionEl.click({ clickCount: 3 });
    await captionEl.fill(caption);
    await page.waitForTimeout(2000);

    // Inspect the Đăng button more closely
    const btnInfo = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dangBtn = btns.find(b => b.innerText?.trim() === 'Đăng');
      if (!dangBtn) return 'NOT FOUND';
      
      return {
        text: dangBtn.innerText,
        disabled: dangBtn.disabled,
        type: dangBtn.type,
        className: dangBtn.className,
        dataTestId: dangBtn.getAttribute('data-testid'),
        onclick: dangBtn.onclick,
        form: dangBtn.form?.id || (dangBtn.closest('form') ? 'in-form' : 'no-form'),
        ariaDisabled: dangBtn.getAttribute('aria-disabled'),
        tabIndex: dangBtn.tabIndex,
        // Check if button has any data-e2e attribute
        dataE2e: Array.from(dangBtn.attributes).find(a => a.name.startsWith('data-'))?.value || 'none',
        // Get React fiber info if available
        reactFiber: dangBtn._reactRootContainer ? 'has-react-root' : 
                    Object.keys(dangBtn).find(k => k.startsWith('__reactFiber')) || 'no-react-fiber'
      };
    });
    log(`Đăng button info: ${JSON.stringify(btnInfo)}`);

    // Check the form
    const formInfo = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) return 'No form found';
      return {
        id: form.id,
        action: form.action,
        method: form.method,
        children: form.innerHTML.slice(0, 200)
      };
    });
    log(`Form info: ${JSON.stringify(formInfo)}`);

    // Try submitting the form directly
    const submitResult = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dangBtn = btns.find(b => b.innerText?.trim() === 'Đăng');
      if (!dangBtn) return 'Button not found';
      
      // Try native click
      dangBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return `Dispatched click, button still exists: ${document.body.contains(dangBtn)}`;
    });
    log(`Native click: ${submitResult}`);

    await page.waitForTimeout(5000);
    
    // Check if something changed
    const currentUrl = page.url();
    const currentText = (await page.locator('body').innerText().catch(() => '')).slice(0, 300);
    log(`URL after native click: ${currentUrl}`);
    log(`Page text: ${currentText}`);

    await page.waitForTimeout(20000);
    await browser.close();

  } catch (err) {
    log(`Error: ${err.message}`);
    await browser.close();
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
