$headers = @{
    "Authorization" = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
    "X-Paperclip-Run-Id" = "d7ce5425-8689-4430-85bc-341cfb7e4a1e"
    "Content-Type" = "application/json"
}
$body = @{
    "body" = "All videos already produced from prior runs: TECH-12 (12.8MB), COM-02 (1.7MB), COM-03 (1.5MB), COM-04 (1.2MB). All saved to output_topic/videos/. Script JSONs already updated with video_path + produced_at."
} | ConvertTo-Json -Compress
$resp = Invoke-RestMethod -Uri "http://localhost:3100/api/issues/8f1e5f42-ae8b-4333-9fcb-87f5f2c03b41/comments" -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
$resp | ConvertTo-Json -Depth 3
