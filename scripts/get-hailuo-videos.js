// Script to get Hailuo video URL via API
// Run with: node --experimental-vm-modules scripts/get-hailuo-videos.js

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NzgwMDY1MTcsInVzZXIiOnsiaWQiOiI0ODIzMDg0MjYwNTA4MTM5NjAiLCJuYW1lIjoiVMO5bmcgVHLhuqduIFRoYW5oIiwiYXZhdGFyIjoiIiwiZGV2aWNlSUQiOiI0OTMwNDY3MDUwMDQwNjA2NzIiLCJpc0Fub255bW91cyI6ZmFsc2V9fQ.y2YjQx7EIm9lnrX1osJpS75KWlBu9lJ25-IPtzEmrC0';
const DEVICE_ID = '493046705004060672';

async function main() {
  // Try different yy header formats
  const yyOptions = [
    DEVICE_ID,  // Just device ID
    `Hailuo/${DEVICE_ID}`,  // With prefix
    Buffer.from(DEVICE_ID).toString('base64'),  // Base64 encoded
    DEVICE_ID.substring(0, 16),  // First 16 chars
  ];
  
  for (const yy of yyOptions) {
    console.log(`\nTrying yy header: ${yy}`);
    try {
      const resp = await fetch('https://hailuoai.video/api/v1/video/list', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'yy': yy,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      console.log(`Status: ${resp.status}`);
      const text = await resp.text();
      console.log(`Body: ${text.substring(0, 500)}`);
    } catch(e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
