#!/bin/bash
set -e
cd /c/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/pilot-review

# Fix poster clip - use loop and t duration for image input
ffmpeg -y -loop 1 -i poster.jpg -vf "scale=1920:1080" -t 6 -r 30 -c:v libx264 -preset fast -pix_fmt yuv420p poster_clip.mp4

# Check all clips
echo "Clip durations:"
for f in poster_clip.mp4 clip1_cine.mp4 clip2_cine.mp4 clip3_cine.mp4; do
  echo "  $f: $(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $f 2>/dev/null)s"
done

# Concatenate
cat > concat.txt << 'EOF'
file 'poster_clip.mp4'
file 'clip1_cine.mp4'
file 'clip2_cine.mp4'
file 'clip3_cine.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i concat.txt -c copy video_raw.mp4

echo "Raw video duration: $(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 video_raw.mp4 2>/dev/null)s"

# Pad to 1920x1080 with black bars
ffmpeg -y -i video_raw.mp4 -vf "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" -c:v libx264 -preset fast -pix_fmt yuv420p video_padded.mp4

# Apply cinematic color grade (teal shadows, orange highlights)
ffmpeg -y -i video_padded.mp4 \
  -vf "colorbalance=rs=0.1:gs=0.05:bs=0.15:rm=0.05:gm=0.02:bm=-0.05:highlight=0.2:shadow=0.1,eq=saturation=1.3:contrast=1.15:vignette=PI/6" \
  -c:v libx264 -preset fast -pix_fmt yuv420p video_graded.mp4

# Trim voiceover to match video
DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 video_graded.mp4 2>/dev/null)
ffmpeg -y -i review_voiceover.mp3 -t ${DUR%.*} -c:a copy voiceover_trim.mp3

# Combine
ffmpeg -y -i video_graded.mp4 -i voiceover_trim.mp3 \
  -map 0:v -map 1:a -c:v copy -c:a aac -shortest \
  pilot_pro.mp4

echo "=== FINAL OUTPUT ==="
ffprobe -v error -show_entries format=duration,size,bitrate -of default=noprint_wrappers=1 pilot_pro.mp4
ls -lh pilot_pro.mp4
