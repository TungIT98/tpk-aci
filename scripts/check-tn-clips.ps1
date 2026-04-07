$clips = @('TN-03-01','TN-03-02','TN-03-03','TN-03-04','TN-03-05','TN-04-01','TN-04-02','TN-04-03','TN-04-04','TN-04-05','TN-05-01','TN-05-02','TN-05-03','TN-05-04','TN-05-05')
$base = 'C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\output\tien-nghich'
foreach ($c in $clips) {
  $ep = $c.Substring(0,5)
  $p = Join-Path $base $ep ($c + '.mp4')
  if (Test-Path $p) {
    $size = [math]::Round((Get-Item $p).Length / 1MB, 1)
    $json = ffprobe -v quiet -print_format json -show_format $p 2>$null | ConvertFrom-Json
    $dur = [math]::Round([double]$json.format.duration, 1)
    Write-Host "$c : ${size}MB dur=${dur}s"
  } else { Write-Host "$c : MISSING" }
}
