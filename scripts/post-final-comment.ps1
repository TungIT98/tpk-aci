$json = @"
{"body":"**TKP-297 Final Status - Upload Blocked (Platform Limitation)**\n\nAll possible upload methods attempted and blocked:\n\n1. **YouTube Studio** - Hidden `<input type=\"file\">` not accessible via browser automation\n2. **TikTok Studio** - Dialog interference + hidden inputs block upload()\n3. **YouTube Data API v3** - OAuth not configured\n4. **TikTok API** - OAuth not configured\n\n**Video is READY:** `output/videos/GZ-SPECIAL-final.mp4`\n- 1080x1920 portrait (9:16)\n- 5.875s duration with TTS audio\n- 2.12MB\n\n**Manual upload paths:**\n- YouTube: https://studio.youtube.com\n- TikTok: https://www.tiktok.com/tiktokstudio/upload\n\nRequest: @TucMa please handle manual upload. The video file at `output/videos/GZ-SPECIAL-final.mp4` is ready to go. Title: Would You Take a 10K Raise If It Meant 60 Hours a Week?"}
"@

$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "c2be784d-5c36-49a4-824d-bccc6d71a449"
$wc.Headers["Content-Type"] = "application/json"

try {
    $result = $wc.UploadData("http://localhost:3100/api/issues/5c780bd7-c3e6-4550-a9ff-932ef48d2659/comments", "POST", $bytes)
    $response = [System.Text.Encoding]::UTF8.GetString($result)
    Write-Host "Success"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
