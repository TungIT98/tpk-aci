$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "7843b3a0-79c6-44af-a596-918ba0160801"
$wc.Headers["Content-Type"] = "application/json"

$patch = @"
{"status":"done","comment":"6 videos generated via Pexels + gTTS (PW-13 to PW-18). All 1080x1920 portrait 5s. ElevenLabs exhausted - gTTS used as fallback. Upload requires manual action by @TucMa."}
"@

$patchBytes = [System.Text.Encoding]::UTF8.GetBytes($patch)
$result = $wc.UploadData("http://localhost:3100/api/issues/TKP-220", "PATCH", $patchBytes)
Write-Host "Done"
