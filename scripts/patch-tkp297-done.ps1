$json = @"
{"status":"done","comment":"GZ-SPECIAL QC fix COMPLETE. Landscape video cropped to 1080x1920 portrait with ElevenLabs TTS audio muxed. Video at output/videos/GZ-SPECIAL-final.mp4 (2.12MB, 5.875s). Upload BLOCKED: YouTube Studio + TikTok Studio both use hidden file inputs inaccessible to browser automation. Manual upload required by @TucMa."}
"@

$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "c2be784d-5c36-49a4-824d-bccc6d71a449"
$wc.Headers["Content-Type"] = "application/json"

try {
    $result = $wc.UploadData("http://localhost:3100/api/issues/5c780bd7-c3e6-4550-a9ff-932ef48d2659", "PATCH", $bytes)
    Write-Host "Success"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
