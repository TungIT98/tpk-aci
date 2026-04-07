$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "7843b3a0-79c6-44af-a596-918ba0160801"
$wc.Headers["Content-Type"] = "application/json"

$body = '{"body":"**Update: 5/7 videos done via Pexels + ElevenLabs gTTS hybrid**\n\nPW-06 to PW-10: Generated via Pexels + ElevenLabs (1.1-1.25MB each, 5s, 1080x1920)\nPW-11: Published\nPW-12: BLOCKED - MiniMax exhausted\n\nAll generated videos ready at output_topic/videos/\n\nManual upload still required for all 5 new videos."}'

$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$result = $wc.UploadData("http://localhost:3100/api/issues/TKP-204/comments", "POST", $bytes)
Write-Host "Posted"

$patch = '{"status":"in_progress","comment":"5/7 done (PW-06 to PW-10). PW-11 published. PW-12 blocked (MiniMax exhausted). Manual upload required by @TucMa."}'
$patchBytes = [System.Text.Encoding]::UTF8.GetBytes($patch)
$result2 = $wc.UploadData("http://localhost:3100/api/issues/TKP-204", "PATCH", $patchBytes)
Write-Host "TKP-204 updated"
