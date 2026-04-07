$headers = @{
    "Authorization" = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
    "X-Paperclip-Run-Id" = "7f892fab-3974-451f-9b88-45304dfad3d1"
    "Content-Type" = "application/json"
}
$body = @{
    "status" = "done"
    "comment" = "Video Production Complete. 5 new videos produced via Pexels+gTTS: PW-01_2-minute-rule (1.7MB), PW-02_meeting-output (1.4MB), PW-03_sunday-night-ritual (1.3MB), PW-04_email-trap (1.8MB), PW-05_90-minute-rhythm (1.3MB). All saved to output_topic/videos/. Script JSONs updated with video_path + produced_at. Upload blocked: YouTube OAuth invalid + TikTok cookies expired (TKP-162)."
} | ConvertTo-Json -Compress
$resp = Invoke-RestMethod -Uri "http://localhost:3100/api/issues/ba6f241d-1d02-4388-8ffe-01116d9a3131" -Method Patch -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
$resp | ConvertTo-Json -Depth 5
Write-Output "DONE"
