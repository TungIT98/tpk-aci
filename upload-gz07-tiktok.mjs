// GZ-07 TikTok Upload Script
// Uses TikTokBrowser with saved session

import { TikTokBrowser } from './lib/upload/tiktok-browser.js';

const videoPath = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output_topic/videos/GZ-07.mp4';
const caption = `I did a 30-day no-spend challenge. Not a single discretionary purchase for 30 days. Here's what actually happened.

Week one was torture — I kept opening apps out of habit. Week two, something shifted. I started noticing how much of my spending was just boredom and impulse.

Week three, the math started: I saved $800 I would have spent on takeout, random Amazon orders, and subscriptions I forgot I had.

Week four, the real change: I wasn't buying things to fill a gap.

The no-spend secret nobody tells you: it's not about willpower. It's about environment design. Delete the apps. Cancel one subscription per week. Leave your credit card at home. Willpower is finite. Environment is automatic.

#NoSpendChallenge #SavingMoney #Budgeting #GenZFinance #MoneyMindset #PersonalFinance #FinanceTikTok`;

const uploader = new TikTokBrowser({ headless: false });

try {
  await uploader.init();
  
  console.log('Uploading to TikTok...');
  const result = await uploader.upload({ 
    videoPath, 
    caption,
    tags: ['NoSpendChallenge', 'SavingMoney', 'Budgeting', 'GenZFinance', 'MoneyMindset']
  });
  
  if (result.success) {
    console.log(`✅ TikTok upload successful: ${result.url}`);
  } else {
    console.error(`❌ TikTok upload failed: ${result.error}`);
    process.exit(1);
  }
} finally {
  await uploader.close();
}
