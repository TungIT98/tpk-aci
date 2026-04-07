$scripts = @('PW-07', 'PW-08', 'PW-09', 'PW-10')
$timestamp = '2026-03-30T01:30:12Z'

foreach ($id in $scripts) {
    $path = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending/${id}.json"
    $content = Get-Content $path -Raw
    $json = $content | ConvertFrom-Json
    
    # Update fields
    $json.status = 'generated'
    $json.video_path = "output_topic/videos/${id}.mp4"
    $json.generated_at = $timestamp
    $json.qc_notes = "REGENERATED via Pexels pipeline (2026-03-30). Previous video was duplicate cached Hailuo demo. New video: Pexels stock footage (portrait, 1080x1920) + ElevenLabs Liam TTS."
    
    # Remove upload fields if present
    if ($json.PSObject.Properties.Name.Contains('uploaded_at')) { $json.uploaded_at = $null }
    if ($json.PSObject.Properties.Name.Contains('youtube_url')) { $json.youtube_url = $null }
    if ($json.PSObject.Properties.Name.Contains('tiktok_url')) { $json.tiktok_url = $null }
    
    $json | ConvertTo-Json -Depth 5 | Set-Content $path -Encoding UTF8
    Write-Host "Updated $id"
}
