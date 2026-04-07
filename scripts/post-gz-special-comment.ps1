$json = @"
{"body":"**TKP-297 GZ-SPECIAL QC Fix - Status Update**\n\n**Problem:** Original GZ-SPECIAL.mp4 was landscape - QC failed.\n\n**Fix Applied:**\n1. Cropped landscape video to 9:16 portrait (1080x1920) using center-crop FFmpeg\n2. Generated TTS audio using ElevenLabs Liam voice + eleven_flash_v2 model (trimmed to 6s)\n3. Muxed portrait video + TTS audio -> GZ-SPECIAL-final.mp4\n   - Resolution: 1080x1920 (portrait)\n   - Duration: 5.875s | Audio: AAC 128kbps | Size: 2.2MB\n\n**Files:**\n- output/videos/GZ-SPECIAL-portrait.mp4 (raw portrait crop)\n- output/videos/GZ-SPECIAL-final.mp4 (with audio)\n\n**Upload Blocked:** Browser upload to YouTube Studio + TikTok blocked by hidden file input (YouTube) and dialog interference (TikTok). Manual upload required.\n\nPlease upload manually from:\nC:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/videos/GZ-SPECIAL-final.mp4\n\nSuggested YouTube title: Would You Take a 10K Raise If It Meant 60 Hours a Week?\nTikTok caption: The math on that 10K raise doesnt add up #salary #negotiation #genz #career"}
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
