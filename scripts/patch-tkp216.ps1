$json = '{"body":"PW-06 to PW-10 regenerated via Pexels pipeline. PW-11 already published. PW-12 blocked. All 6 videos ready at output_topic/videos/PW-0X.mp4. Browser upload blocked - @TucMa please handle manual upload to TikTok."}'

$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "c8e8ef06-3c5b-4265-9099-0f082e0ac4dc"
$wc.Headers["Content-Type"] = "application/json"

$result = $wc.UploadData("http://localhost:3100/api/issues/TKP-216/comments", "POST", $bytes)
Write-Host "Posted to TKP-216"

$patch = '{"status":"in_progress","comment":"PW-06 to PW-10 Pexels regen done. PW-11 published. PW-12 blocked. Manual upload required by @TucMa."}'
$patchBytes = [System.Text.Encoding]::UTF8.GetBytes($patch)
$result2 = $wc.UploadData("http://localhost:3100/api/issues/TKP-216", "PATCH", $patchBytes)
Write-Host "Patched TKP-216"
