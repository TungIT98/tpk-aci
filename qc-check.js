const {execSync} = require('child_process');
const path = require('path');
const fs = require('fs');
const base = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/';
const files = [
  'output_topic/videos/GZ-07.mp4',
  'output_topic/videos/GZ-09.mp4',
  'output_topic/videos/GZ-12.mp4',
  'output_topic/videos/PW-06.mp4',
  'output_topic/videos/PW-08.mp4',
  'output_topic/videos/PW-09.mp4',
  'output_topic/videos/PW-10.mp4',
  'output_topic/videos/PW-12.mp4'
];

files.forEach(f => {
  try {
    const full = path.join(base, f);
    const r = execSync('ffprobe -v quiet -print_format json -show_streams "' + full + '"', {encoding: 'utf8', timeout: 10000});
    const s = JSON.parse(r);
    const v = s.streams?.find(x => x.codec_type === 'video');
    const a = s.streams?.find(x => x.codec_type === 'audio');
    console.log(f + ': ' + (v?.width||'?') + 'x' + (v?.height||'?') + ' dur=' + (v?.duration||'?') + ' audio=' + (a?'Y':'N') + ' size=' + fs.statSync(full).size);
  } catch(e) {
    console.log(f + ': ERROR ' + e.message.substring(0,80));
  }
});
