#!/usr/bin/env node
import { resolve } from 'path';
import { chromium } from 'playwright';

const TMP_UPLOADS = 'C:/tmp/openclaw/uploads';
const OUTPUT_VIDEOS = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output_topic/videos';
const SESSION_PATH = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.tiktok-session.json';

const VIDEOS = [
  { id: 'GZ-09', path: TMP_UPLOADS+'/GZ-09-final.mp4', caption: 'Boss texts at 11pm. You respond in 2 minutes. Here is what that actually costs you. Your time is the only asset you cannot earn back. Every after-hours notification you answer is a tax on your life. Do not normalize urgency that is not yours. #genz #worklife #boundaries #career #timemanagement #burnout #worklifebalance' },
  { id: 'GZ-10', path: TMP_UPLOADS+'/GZ-10-final.mp4', caption: 'Nobody talks about this part of getting promoted. The new title comes with new rules. You now get blamed for things outside your control. You attend meetings that waste your time. You manage people who resent you. The raise does not cover the stress. Before you accept: know what you are negotiating for. #genz #career #promotion #management #leadership #careergrowth #workadvice' },
  { id: 'GZ-11', path: TMP_UPLOADS+'/GZ-11-final.mp4', caption: 'Remote work gave you freedom. Nobody told you the hidden cost. When your office is your home, your home becomes your office. You never leave work. You answer emails at dinner. You check slack on weekends. The fix is not a bigger salary. It is physical and mental boundaries that most people never build. #genz #remotework #worklife #boundaries #digitalnomad #productivity #workfromhome' },
  { id: 'GZ-12', path: TMP_UPLOADS+'/GZ-12-final.mp4', caption: 'You are not lazy. You are just optimizing for the wrong reward. Dopamine from finishing small tasks feels good but compounds into nothing. The grind that actually builds a life is boring, slow, and unrewarding in the moment. That is what makes it valuable. Anyone can chase the shortcut. #genz #motivation #dopamine #grind #success #mindset #delayedgratification #hardwork' },
  { id: 'GZ-17', path: TMP_UPLOADS+'/GZ-17-final.mp4', caption: 'Cold applying to 200 jobs and getting 0 callbacks? Your resume is being filtered before a human sees it. Applicant Tracking Systems scan for keywords, not experience. Most people are applying wrong. Here is what actually works: tailoring your resume per job description, not a one-size-fits-all approach. #genz #jobsearch #career #resume #hiring #jobs #careeradvice #hiringtips' },
  { id: 'PW-08', path: TMP_UPLOADS+'/PW-08-final.mp4', caption: 'You do not need a morning routine. You need an afternoon system. Most people destroy their morning productivity by checking their phone before their brain is online. The real win is protecting your first 90 minutes from all meetings and messages. #productivity #morningroutine #focus #deepwork #career #worklife #habits #timemanagement' },
  { id: 'PW-10', path: TMP_UPLOADS+'/PW-10-final.mp4', caption: 'Meeting overload is a system problem, not a calendar problem. The real issue is that nobody knows what decisions actually need to be made. So they schedule a meeting to talk about scheduling a meeting. Before you accept: ask what problem this meeting solves. #productivity #meetings #timemanagement #worklife #career #communication #wfh #remotework' },
  { id: 'PW-13', path: TMP_UPLOADS+'/PW-13-final.mp4', caption: 'Email chains that should have been a 5-minute call. Meetings that could have been a message. Slack threads that spiral into paragraphs. Communication overload is killing your focus. The fix is not more tools — it is choosing the right medium for the message. #productivity #communication #worklife #email #meetings #focus #remotework #career' },
  { id: 'PW-14', path: TMP_UPLOADS+'/PW-14-final.mp4', caption: 'Multitasking is a myth your brain cannot fulfill. When you switch tasks, your prefrontal cortex burns energy rebuilding context. That context switch costs 23 minutes per interruption on average. Single-tasking is not slow — it is the only way to actually finish things. #productivity #focus #multitasking #deepwork #timemanagement #career #habits #neuroscience' },
  { id: 'PW-15', path: TMP_UPLOADS+'/PW-15-final.mp4', caption: 'The 2-minute rule: if it takes less than 2 minutes, do it now. Sounds simple. Most people still do not do it. Because the real problem is not knowing what your 2-minute tasks are — it is clearing the mental clutter to see them. Declutter first, then decide. #productivity #procrastination #habits #timemanagement #focus #organization #career #mindset' },
  { id: 'PW-16', path: TMP_UPLOADS+'/PW-16-final.mp4', caption: 'Energy management beats time management. You can schedule every hour of your day and still accomplish nothing if your energy is depleted. The highest performers protect their energy like a financial asset. Nutrition, sleep, movement, and recovery are not optional — they are infrastructure. #productivity #energymanagement #worklife #career #health #wellness #focus #habits' },
  { id: 'PW-17', path: TMP_UPLOADS+'/PW-17-final.mp4', caption: 'Your to-do list is lying to you. Most items never get done because they are not real tasks — they are vague intentions dressed up as actions. A real task has a specific outcome and a next physical step. If you cannot write the next action, the task is not a task yet. #productivity #todolist #timemanagement #focus #career #habits #organization #procrastination' },
  { id: 'PW-18', path: TMP_UPLOADS+'/PW-18-final.mp4', caption: 'Procrastination is not a character flaw. It is an emotional regulation problem. You delay because your brain is trying to protect you from discomfort, uncertainty, or fear of failure. The fix is not discipline — it is reducing the emotional cost of starting. Make the first step so small it feels ridiculous not to do. #procrastination #productivity #mindset #mentalhealth #focus #habits #career #motivation' },
  { id: 'COM-01', path: OUTPUT_VIDEOS+'/COM-01.mp4', caption: 'Texting a recruiter at 3am. Ghosting 5 times and then responding with enthusiasm. Applying to 500 jobs with the same generic resume. The job search has become a comedy of errors. Here is the plot twist: the people who get hired are not always the most qualified. They are the most visible. #comedy #jobsearch #genz #career #worklife #interview #hiring #relatable' },
  { id: 'LIFE-01', path: OUTPUT_VIDEOS+'/LIFE-01.mp4', caption: 'Your 20s are not a trial period for your real life. They are your actual life. The pressure to have everything figured out by 30 is a social construct that serves no one. The best thing you can do in your 20s is take detours, ask questions, and stay genuinely curious. #lifestyle #genz #lifelessons #career #twentysomething #selfimprovement #mindset #motivation' },
  { id: 'MOT-01', path: OUTPUT_VIDEOS+'/MOT-01.mp4', caption: 'Nobody is coming to save your career. No mentor is going to hand you the roadmap. No company is going to invest in your growth more than you demand. The professionals who win are the ones who treat their own development like a business with themselves as the product. #motivation #career #genz #success #mindset #growth #leadership #hustle' },
  { id: 'MOVIE-01', path: OUTPUT_VIDEOS+'/MOVIE-01.mp4', caption: 'Most movie protagonists are not special because of their skills — they are special because they care more than anyone else. That is the actual lesson from every film you have ever loved. Not talent. Not luck. Just absolute refusal to quit. #movie #film #storytelling #motivation #lessons #cinema #screenwriting #hollywood' },
  { id: 'TECH-01', path: OUTPUT_VIDEOS+'/TECH-01.mp4', caption: 'AI will not replace you. Someone using AI will. The tools are neutral. The competitive advantage comes from knowing what questions to ask, what to do with the answers, and how to integrate AI into your existing workflow without losing your judgment. #tech #ai #artificialintelligence #future #jobs #career #automation #productivity' },
];

async function uploadVideo(browser, video) {
  const ctx = await browser.newContext({ storageState: SESSION_PATH, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  try {
    await page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.locator('input[type="file"]').first().setInputFiles(video.path);
    console.log(`[${video.id}] Uploaded, waiting 60s...`);
    await page.waitForTimeout(60000);

    const captionArea = page.locator('div[contenteditable="true"]').first();
    if (await captionArea.count() > 0) {
      await captionArea.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(video.caption, { delay: 15 });
    }
    await page.waitForTimeout(3000);

    const btn = page.locator('button').filter({ hasText: /Post|Đăng/ }).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(20000);
    }
    console.log(`[${video.id}] Done. URL: ${page.url()}`);
    return true;
  } catch(e) {
    console.log(`[${video.id}] ERROR: ${e.message}`);
    return false;
  } finally {
    await ctx.close();
  }
}

async function main() {
  const targetId = process.argv[2];
  let toUpload = VIDEOS;

  if (targetId) {
    toUpload = VIDEOS.filter(v => v.id === targetId);
    if (toUpload.length === 0) {
      console.log('Unknown video ID:', targetId);
      process.exit(1);
    }
  }

  console.log(`Uploading ${toUpload.length} videos...`);
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  let success = 0, failed = 0;
  for (const video of toUpload) {
    console.log(`\n--- ${video.id} ---`);
    const ok = await uploadVideo(browser, video);
    if (ok) success++; else failed++;
  }
  await browser.close();
  console.log(`\n✅ Done! Success: ${success}, Failed: ${failed}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
