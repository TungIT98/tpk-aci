$body = @{
  status = "done"
  comment = "Generated GZ-17 through GZ-20 FINAL videos (gTTS audio + FFmpeg mux). All 4 videos at C:/tmp/openclaw/uploads/GZ-{17,18,19,20}-FINAL.mp4. Script status updated to ready_for_upload. Browser upload blocked - manual intervention required per TKP-404."
} | ConvertTo-Json -Compress

$headers = @{
  "Authorization" = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
  "Content-Type" = "application/json"
  "X-Paperclip-Run-Id" = "1c908d88-e853-4ea1-8593-64a5cad299fd"
}

$response = Invoke-RestMethod -Uri "http://localhost:3100/api/issues/0aca7b11-60b1-40f8-ae8d-83acc6eebbab" -Method PATCH -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10