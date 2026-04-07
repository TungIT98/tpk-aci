$json = @"
{"status":"in_progress","comment":"GZ-SPECIAL QC fixed: landscape video cropped to portrait 9:16 (1080x1920) with TTS audio muxed. Video ready at output/videos/GZ-SPECIAL-final.mp4. Browser upload to YouTube Studio and TikTok blocked by platform restrictions - manual upload required."}
"@

$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "e533c168-648f-4fa6-b7f2-71aec15017fc"
$wc.Headers["Content-Type"] = "application/json"

try {
    $result = $wc.UploadData("http://localhost:3100/api/issues/5c780bd7-c3e6-4550-a9ff-932ef48d2659", "PATCH", $bytes)
    $response = [System.Text.Encoding]::UTF8.GetString($result)
    Write-Host "Success: $response"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
