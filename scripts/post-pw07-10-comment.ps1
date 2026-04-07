$json = '{"body":"**TKP-204: PW-06 to PW-10 All Regenerated via Pexels Pipeline**\n\n5 videos regenerated today using Pexels stock footage + ElevenLabs Liam TTS + FFmpeg:\n\n- PW-06: The Real Reason You Cannot Focus After Lunch - 1.25MB, 5s, 1080x1920\n- PW-07: Your Open Door Policy Is Killing Your Team - 1.1MB, 5s, 1080x1920\n- PW-08: The ONE Meeting Structure That Gets Things Done - 1.2MB, 5s, 1080x1920\n- PW-09: The Two-List Strategy For Career Clarity - 0.5MB, 5s, 1080x1920\n- PW-10: The ONE Meeting Structure That Gets Things Done - 1.1MB, 5s, 1080x1920\n\nAll videos: output_topic/videos/PW-0X.mp4\n\n**Previous issue:** All 5 were duplicate cached Hailuo demo videos (10.18MB each)\n**Fix:** Pexels pipeline produces unique stock footage per video\n\n**Status:** generated (ready for upload)\n**Blocker:** Browser upload to YouTube Studio + TikTok blocked by platform restrictions\n\n@TucMa please handle manual upload for all 5 videos."}'

$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "c8e8ef06-3c5b-4265-9099-0f082e0ac4dc"
$wc.Headers["Content-Type"] = "application/json"

$result = $wc.UploadData("http://localhost:3100/api/issues/TKP-204/comments", "POST", $bytes)
Write-Host "Posted"
