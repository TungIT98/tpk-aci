import { HailuoApp } from './lib/hailuo-app.js';

const app = new HailuoApp({
  sessionPath: '.hailuo-session.json',
  downloadDir: 'output_topic/videos',
  headless: false,
});

await app.init();
const loggedIn = await app.isLoggedIn();
console.log('Logged in:', loggedIn);

if (loggedIn) {
  const prompt = "Beautiful athletic girl with ponytail, wearing sports bra and gym shorts, flexing legs in front of mirror at gym. Static shot. Squats down, lifts heavy barbell. Tracking shot following movement. Muscles flex, confident smile at camera. Push in on face. Shows before/after transformation photos on phone. Pull out to reveal modern gym setting. Modern gym with neon lights, motivational atmosphere, cinematic lighting, 9:16 portrait.";
  
  console.log('Submitting video generation...');
  const result = await app.generateVideo({
    prompt,
    aspectRatio: '9:16',
    filename: 'HG-01.mp4',
    maxWaitMs: 15 * 60 * 1000,
  });
  console.log('Result:', JSON.stringify(result));
}

await app.close();
