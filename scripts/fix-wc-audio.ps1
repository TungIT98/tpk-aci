# fix-wc-audio-sapi.ps1 - Add audio to WC-01 through WC-05 using Windows SAPI
# No API keys needed - works offline
$ErrorActionPreference = "Stop"

$wcIds = @("WC-01", "WC-02", "WC-03", "WC-04", "WC-05")
$voice = "Zira"  # Female voice for energetic Gen Z content

foreach ($id in $wcIds) {
    Write-Host "`n=== Processing $id ==="
    
    # Read script JSON
    $scriptPath = "scripts/pending/$id.json"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "[SKIP] Script not found: $scriptPath"
        continue
    }
    
    $script = Get-Content $scriptPath -Raw | ConvertFrom-Json
    $text = $script.script
    Write-Host "Script length: $($text.Length) chars"
    
    $outputDir = "outputs/$id"
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    
    $finalPath = "$outputDir/final.mp4"
    if (-not (Test-Path $finalPath)) {
        Write-Host "[SKIP] final.mp4 not found for $id"
        continue
    }
    
    $ttsPath = "$outputDir/narration.mp3"
    
    # Generate TTS using Windows SAPI via PowerShell
    Write-Host "[SAPI] Generating TTS..."
    
    $tempDir = "$outputDir/_temp"
    if (-not (Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    }
    
    $tempWav = "$tempDir/sapi_$([guid]::NewGuid().ToString('N')).wav"
    
    # PowerShell SAPI TTS script
    $psScript = @"
Add-Type -AssemblyName System.Speech
`$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
`$synth.Rate = 0  # Normal speed
try { `$synth.SelectVoice('$voice') } catch { Write-Host "[SAPI] Voice not found, using default" }
`$synth.SetOutputToWaveFile('$($tempWav.Replace('\','\\'))')
`$synth.Speak([Console]::In.ReadToEnd())
`$synth.SetOutputToDefaultAudioDevice()
Write-Host 'SAPI_OK'
"@
    
    $sapiResult = powershell -NoProfile -Command $psScript -InputObject $text 2>&1
    if (-not ($sapiResult -join "" -match "SAPI_OK")) {
        Write-Host "[ERROR] SAPI TTS failed: $sapiResult"
        continue
    }
    Write-Host "[SAPI] WAV generated: $tempWav"
    
    if (-not (Test-Path $tempWav) -or (Get-Item $tempWav).Length -lt 5000) {
        Write-Host "[ERROR] WAV file missing or too small"
        continue
    }
    
    # Convert WAV to MP3 via FFmpeg
    Write-Host "[FFmpeg] Converting WAV to MP3..."
    $ffResult = & ffmpeg -y -i $tempWav -codec:a libmp3lame -qscale:a 2 $ttsPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] FFmpeg WAV->MP3 failed: $ffResult"
        continue
    }
    
    $mp3Size = (Get-Item $ttsPath).Length
    Write-Host "[OK] TTS MP3: $mp3Size bytes"
    
    # Get video duration
    $videoDuration = & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $finalPath 2>$null
    Write-Host "[INFO] Video duration: $videoDuration s"
    
    # Mix audio with video using amix
    $finalVoicePath = "$outputDir/final_with_voice.mp4"
    Write-Host "[FFmpeg] Mixing audio with video..."
    
    $mixResult = & ffmpeg -y `
        -i $finalPath `
        -i $ttsPath `
        -filter_complex "[0:a][1:a]amix=inputs=2:duration=first[aout]" `
        -map "0:v" `
        -map "[aout]" `
        -c:v copy `
        -c:a aac `
        -b:a 192k `
        $finalVoicePath 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] FFmpeg mix failed: $mixResult"
        continue
    }
    
    Write-Host "[OK] final_with_voice.mp4 created"
    
    # Verify
    $probeResult = & ffprobe -v error -show_entries stream=codec_type,codec_name -of default=noprint_wrappers=1 $finalVoicePath 2>$null
    Write-Host "[Verify] Streams:`n$probeResult"
    
    # Cleanup temp
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n=== Done ==="
