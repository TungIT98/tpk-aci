$headers = @{
    "Authorization" = "Bearer pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
}
$resp = Invoke-RestMethod -Uri "http://localhost:3100/api/issues/ba6f241d-1d02-4388-8ffe-01116d9a3131" -Headers $headers
$resp | ConvertTo-Json -Depth 3
