#!/bin/bash
# Create cinematic short video (30s) with Hailuo clips

# Step 1: Scale clips to 1080w with cinema aspect ratio (2.35:1 -> 1920x817 or 1080x459)
# We'll use 1920x817 for cinema feel, then pad to 1920x1080

# Scale and crop clips to cinema ratio
ffmpeg -y -i hailuo_v1.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:817" -t 6 -c:v libx264 -preset fast -pix_fmt yuv420p clip1_cine.mp4 2>/dev/null
ffmpeg -y -i hailuo_v2.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:817" -t 6 -c:v libx264 -preset fast -pix_fmt yuv420p clip2_cine.mp4 2>/dev/null
ffmpeg -y -i hailuo_v3.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:817" -t 6 -c:v libx264 -preset fast -pix_fmt yuv420p clip3_cine.mp4 2>/dev/null

# Step 2: Create poster frame as opening (6s)
ffmpeg -y -i poster.jpg -vf "scale=1920:1080,trim=0:6,setpts=PTS-STARTPTS" -t 6 -c:v libx264 -preset fast -pix_fmt yuv420p poster_clip.mp4 2>/dev/null

# Step 3: Concatenate clips
cat > concat.txt << 'EOF'
file 'poster_clip.mp4'
file 'clip1_cine.mp4'
file 'clip2_cine.mp4'
file 'clip3_cine.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i concat.txt -c copy video_no_audio.mp4 2>/dev/null

# Step 4: Add black side bars to make 1920x1080 (cinema top/bottom bars)
ffmpeg -y -i video_no_audio.mp4 -vf "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" -c:v libx264 -preset fast -pix_fmt yuv420p video_padded.mp4 2>/dev/null

# Step 5: Add color grading (teal & orange) and slight vignette
ffmpeg -y -i video_padded.mp4 -vf "eq=saturation=1.2:contrast=1.1:brightness=0.02:gamma_r=1.1:gamma_b=0.9,vignette=PI/8" -c:v libx264 -preset fast -pix_fmt yuv420p video_graded.mp4 2>/dev/null

# Step 6: Trim voiceover to 24s (to match video)
ffmpeg -y -i review_voiceover.mp3 -t 24 -c:a copy voiceover_short.mp3 2>/dev/null

# Step 7: Combine video + voiceover
ffmpeg -y -i video_graded.mp4 -i voiceover_short.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -shortest pilot_short.mp4 2>/dev/null

echo "Done! Output: pilot_short.mp4"
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 pilot_short.mp4
ls -lh pilot_short.mp4
