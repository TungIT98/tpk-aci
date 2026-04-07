import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3').verbose();

const EDGE_USER_DATA = process.env.LOCALAPPDATA.replace(/\\$/, '') + '/Microsoft/Edge/User Data';
const cookiesPath = resolve(EDGE_USER_DATA, 'Default/Network/Cookies');
const tmpDir = 'C:/tmp/hailuo';
const tmpCookies = tmpDir + '/Cookies';

try { mkdirSync(tmpDir, { recursive: true }); } catch (e) { console.log('mkdir error:', e.message); }
try { copyFileSync(cookiesPath, tmpCookies); console.log('Copied cookies DB'); } catch (e) { console.error('Copy error:', e.message); process.exit(1); }

const db = new sqlite3.Database(tmpCookies);
db.all("SELECT host_key, name, value, path, expires_utc, is_httponly, is_secure FROM cookies WHERE host_key LIKE '%hailuo%'", [], (err, rows) => {
  if (err) { console.error('SQL error:', err.message); db.close(); process.exit(1); }

  console.log('Found', rows.length, 'hailuo cookies');
  for (const row of rows) {
    const val = row.value || '(empty)';
    console.log('  ', row.host_key, '|', row.name, '|', val.slice(0, 50), '| httpOnly:', row.is_httponly);
  }
  db.close();
});
