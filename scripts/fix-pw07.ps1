$json = Get-Content "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending/PW-07.json" -Raw | ConvertFrom-Json
$json.upload_note = "REGENERATED via Pexels pipeline (2026-03-30). Previous video was duplicate cached Hailuo demo. New video: Pexels stock footage (portrait, 1080x1920) + ElevenLabs Liam TTS."
$json | ConvertTo-Json -Depth 5 | Set-Content "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending/PW-07.json" -Encoding UTF8
Write-Host "Fixed PW-07"
