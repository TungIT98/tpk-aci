const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const results = {};
for (const file of files) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    results[file] = {
      status: j.status,
      has_prompt: j.prompt_for_hailuo ? 'YES' : 'NO',
      has_specific: j.specific_details ? 'YES' : 'NO',
      has_visual: j.visual_scene ? 'YES' : 'NO',
      has_negative: j.negative_prompt ? 'YES' : 'NO'
    };
  } catch(e) {
    results[file] = { error: e.message };
  }
}
console.log(JSON.stringify(results, null, 2));
