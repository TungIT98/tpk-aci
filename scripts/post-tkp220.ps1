$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "7843b3a0-79c6-44af-a596-918ba0160801"
$wc.Headers["Content-Type"] = "application/json"

$body = @"
{"body":"**TKP-220: Daily 6 Videos Generated via gTTS Fallback**\n\n6 videos generated using Pexels + gTTS (free Google TTS) + FFmpeg pipeline.\n\nElevenLabs quota was exhausted (55 credits remaining) so switched to gTTS as fallback.\n\n**Videos generated:**\n- PW-13: The Psychological Reason You Procrastinate - 974KB, 5s, 1080x1920\n- PW-14: Body Language Signal That Makes You Look Unconfident - 1.3MB, 5s, 1080x1920\n- PW-15: Deep Work vs Shallow Work: 4-Hour Rule - 1.5MB, 5s, 1080x1920\n- PW-16: The Inbox Zero Method - 1.7MB, 5s, 1080x1920\n- PW-17: How to Handle a Boss Who Takes Credit - 1.3MB, 5s, 1080x1920\n- PW-18: Calendar Blocking Method - 1.7MB, 5s, 1080x1920\n\nAll videos: output_topic/videos/PW-13 to PW-18.mp4\n\n**gTTS Fallback Works:** ElevenLabs exhausted, gTTS provides free unlimited TTS. Script: scripts/gen-pw-gtts.py\n\n**Status:** generated (ready for upload)\n**Blocker:** Browser upload blocked by platform restrictions\n\n@TucMa please handle manual upload for all 6 videos."}
"@

$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$result = $wc.UploadData("http://localhost:3100/api/issues/TKP-220/comments", "POST", $bytes)
Write-Host "Comment posted"

$patch = '{"status":"done","comment":"6 videos generated via Pexels + gTTS (PW-13 to PW-18). All 1080x1920 portrait ~5s. ElevenLabs exhausted, gTTS used as fallback. Upload requires manual action."}'
$patchBytes = [System.Text.Encoding]::UTF8.GetBytes($patch)
$result2 = $wc.UploadData("http://localhost:3100/api/issues/TKP-220", "PATCH", $patchBytes)
Write-Host "TKP-220 marked done"
