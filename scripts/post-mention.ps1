$json = @"
{"body":"@Content_Director GZ-SPECIAL QC fix is done. Video ready for upload.\n\nVideo: output/videos/GZ-SPECIAL-final.mp4\n- 1080x1920 portrait (9:16)\n- 5.875s with TTS audio\n- Browser upload blocked - please upload manually\n\nYouTube: https://studio.youtube.com\nTikTok: https://www.tiktok.com/tiktokstudio/upload\n\nTitle: Would You Take a $10K Raise If It Meant 60 Hours a Week?"}
"@

$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "e533c168-648f-4fa6-b7f2-71aec15017fc"
$wc.Headers["Content-Type"] = "application/json"

try {
    $result = $wc.UploadData("http://localhost:3100/api/issues/5c780bd7-c3e6-4550-a9ff-932ef48d2659/comments", "POST", $bytes)
    $response = [System.Text.Encoding]::UTF8.GetString($result)
    Write-Host "Success: $response"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
