$json = '{"body":"**TKP-204: PW-06 Regenerated via Pexels**\n\nPW-06 regenerated using Pexels pipeline (stock footage + ElevenLabs TTS + FFmpeg).\n\n**PW-06:**\n- output_topic/videos/PW-06.mp4 (1.25MB, 5s, 1080x1920 portrait)\n- Status: generated (was duplicate cached video)\n\n**Upload Status:** Browser upload blocked for YouTube Studio + TikTok (hidden file inputs, dynamic JS). @TucMa please upload PW-06 manually.\n\nFile: C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output_topic/videos/PW-06.mp4\nTitle: The Real Reason You Cannot Focus After Lunch (Its Not About Food)\n\n**Remaining:** PW-07 to PW-10 also show duplicate cached video - need Pexels regen. PW-11 published. PW-12 blocked."}'

$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "c8e8ef06-3c5b-4265-9099-0f082e0ac4dc"
$wc.Headers["Content-Type"] = "application/json"

$result = $wc.UploadData("http://localhost:3100/api/issues/TKP-204/comments", "POST", $bytes)
Write-Host "Posted"
