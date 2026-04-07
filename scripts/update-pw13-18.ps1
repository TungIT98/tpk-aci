$scripts = @('PW-13', 'PW-14', 'PW-15', 'PW-16', 'PW-17', 'PW-18')
foreach ($id in $scripts) {
    $path = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending/${id}.json"
    $content = Get-Content $path -Raw
    $json = $content | ConvertFrom-Json
    $json.status = 'generated'
    $json.video_path = "output_topic/videos/${id}.mp4"
    $json.generated_at = '2026-03-30T01:48:00Z'
    $json.upload_note = "Generated via Pexels + gTTS (2026-03-30). gTTS used because ElevenLabs exhausted. Video: Pexels stock footage (portrait, 1080x1920) + gTTS audio. Duration ~5s."
    if ($json.PSObject.Properties.Name.Contains('uploaded_at')) { $json.uploaded_at = $null }
    if ($json.PSObject.Properties.Name.Contains('youtube_url')) { $json.youtube_url = $null }
    if ($json.PSObject.Properties.Name.Contains('tiktok_url')) { $json.tiktok_url = $null }
    $json | ConvertTo-Json -Depth 5 | Set-Content $path -Encoding UTF8
    Write-Host "Updated $id"
}
