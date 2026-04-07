$headers = @{
    "Authorization" = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
    "X-Paperclip-Run-Id" = "d7ce5425-8689-4430-85bc-341cfb7e4a1e"
    "Content-Type" = "application/json"
}

# Comment on TKP-877
$body877 = @{
    "body" = "Duplicate of TKP-878. All 4 videos (TECH-12, COM-02, COM-03, COM-04) already produced from prior runs."
} | ConvertTo-Json -Compress
$null = Invoke-RestMethod -Uri "http://localhost:3100/api/issues/f0a747f5-9d34-41e2-8f65-745358e7479e/comments" -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body877))
Write-Output "TKP-877 commented"

# Comment on TKP-885
$body885 = @{
    "body" = "TECH-12 video already produced (12.8MB) from prior run. Script JSON updated with video_path + produced_at."
} | ConvertTo-Json -Compress
$null = Invoke-RestMethod -Uri "http://localhost:3100/api/issues/0d726901-23eb-4337-9e26-d233d0cc22a3/comments" -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body885))
Write-Output "TKP-885 commented"
