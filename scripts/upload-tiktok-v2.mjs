/**
 * scripts/upload-tiktok-v2.mjs
 * TikTok upload with better success detection
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log(`[upload2] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function main() {
  const videoId = process.argv[2] || 'GZ-01';
  const videoPath = resolve(ROOT, 'outputs', videoId, 'final.mp4');
  const caption = process.argv[3] || 'AI Video Generator #ai #automation #fyp #tiktok2026';

  log(`Video: ${videoPath}`);

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    storageState: resolve(ROOT, '.tiktok-session.json'),
    viewport: { width: 1280, height: 900 }
  });
  const page = await ctx.newPage();

  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(6000); // Wait for JS to fully load

    if (page.url().includes('/login')) {
      log('Session expired!');
      await browser.close();
      return;
    }

    log(`Page: ${page.url()}`);

    // Upload file
    const fileInput = page.locator('input[type="file"]').first();
    const inputCount = await fileInput.count();
    log(`File input: ${inputCount}`);

    if (inputCount > 0) {
      await fileInput.setInputFiles(videoPath);
      log('File uploaded to input');
    }

    // Wait for processing
    log('Waiting 12s for processing...');
    await page.waitForTimeout(12000);

    // Check page
    const pageText = await page.locator('body').innerText().catch(() => '');
    log(`Page content: ${pageText.slice(0, 400)}`);

    // Fill caption using JavaScript (more reliable than contenteditable)
    log('Filling caption via JS...');
    try {
      await page.evaluate((cap) => {
        const editables = document.querySelectorAll('div[contenteditable="true"]');
        for (const el of editables) {
          el.focus();
          el.innerText = cap;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }, caption);
      log('Caption filled via JS');
    } catch (e) {
      log(`JS caption fill failed: ${e.message}`);
    }

    await page.waitForTimeout(2000);

    // Click post button via JS for reliability
    log('Clicking post button via JS...');
    try {
      // Find all buttons and find the one that looks like "Đăng"
      const btnInfo = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.map(b => ({
          text: b.innerText?.trim().slice(0, 40),
          class: b.className?.slice(0, 60),
          disabled: b.disabled,
          type: b.type
        }));
      });
      
      const postBtnInfo = btnInfo.find(b => 
        (b.text?.includes('Đăng') || b.text?.includes('Post') || b.text?.includes('Publish')) && !b.disabled
      );
      
      if (postBtnInfo) {
        log(`Post button: "${postBtnInfo.text}", disabled=${postBtnInfo.disabled}`);
      }

      // Click using evaluate
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        for (const btn of btns) {
          const text = btn.innerText?.trim() || '';
          if ((text.includes('Đăng') || text === 'Post' || text === 'Publish') && !btn.disabled) {
            btn.click();
            return text;
          }
        }
        return null;
      });
      
      if (clicked) {
        log(`Clicked: "${clicked}"`);
      } else {
        log('Could not find enabled post button');
      }
    } catch (e) {
      log(`JS click failed: ${e.message}`);
    }

    // Wait for result
    log('Waiting 8s after post click...');
    await page.waitForTimeout(8000);

    const finalUrl = page.url();
    const finalText = (await page.locator('body').innerText().catch(() => '')).slice(0, 300);
    
    log(`Final URL: ${finalUrl}`);
    log(`Final text: ${finalText}`);

    // Detect success: URL changed OR text contains success indicators
    const success = 
      (!finalUrl.includes('upload') && finalUrl.includes('tiktok.com/@')) ||
      finalText.includes('Đã đăng') ||
      finalText.includes('Posted') ||
      finalText.includes('success') ||
      finalText.includes('Published');

    if (success) {
      log('✅ SUCCESS! Video posted!');
      writeFileSync(resolve(ROOT, 'outputs', videoId, 'published.txt'),
        `Published at: ${finalUrl}\n${new Date().toISOString()}\nCaption: ${caption}`);
    } else {
      log('⚠️  Could not confirm success');
      // Save a diagnostic
      writeFileSync(resolve(ROOT, 'outputs', videoId, 'upload-diagnostic.txt'),
        `URL: ${finalUrl}\nText: ${finalText}\n${new Date().toISOString()}`);
    }

    log('Keeping browser open for 15s...');
    await page.waitForTimeout(15000);
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
