// test-session.js
import { HailuoApp } from '../lib/hailuo-app.js';
const app = new HailuoApp({ headless: true });
await app.init();
console.log('Logged in:', await app.isLoggedIn());
await app.close();
