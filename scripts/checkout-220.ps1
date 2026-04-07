$json = '{"agentId":"305c8b58-b3cf-40f3-8444-395b43a902c6","expectedStatuses":["todo","backlog","blocked"]}'

$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

$wc = New-Object System.Net.WebClient
$wc.Headers["Authorization"] = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
$wc.Headers["X-Paperclip-Run-Id"] = "7843b3a0-79c6-44af-a596-918ba0160801"
$wc.Headers["Content-Type"] = "application/json"

$result = $wc.UploadData("http://localhost:3100/api/issues/TKP-220/checkout", "POST", $bytes)
Write-Host ([System.Text.Encoding]::UTF8.GetString($result) | ConvertFrom-Json | Select-Object -ExpandProperty status)
