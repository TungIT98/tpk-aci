Add-Type -AssemblyName System.Speech

$env:Path += ";C:\Users\PC\AppData\Local\Programs\Python\Python312;C:\Users\PC\AppData\Local\Programs\Python\Python312\Scripts"
$pythonExe = "python"

# Scripts to process
$scripts = @('PW-13','PW-14','PW-15','PW-16','PW-17','PW-18')
$ROOT = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"
$TEMP_DIR = "$ROOT/output/_temp_sapi"
$PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"

New-Item -ItemType Directory -Force -Path $TEMP_DIR | Out-Null

function Get-PexelsVideos($query, $perPage = 6) {
    $uri = "https://api.pexels.com/videos/search?query=$(Uri.EscapeDataString($query))&per_page=$perPage&orientation=portrait"
    $client = New-Object System.Net.WebClient
    $client.Headers["Authorization"] = $PEXELS_KEY
    $json = $client.DownloadString($uri) | ConvertFrom-Json
    return $json.videos
}

function Get-BestClip($videos, $preferredHeight = 1920) {
    $hd = $videos | Where-Object { $_.height -eq 1920 -or $_.width -eq 1920 } | Select-Object -First 1
    if ($hd) { return $hd }
    $tall = $videos | Where-Object { $_.height -gt 1000 -or $_.width -gt 1000 } | Sort-Object { [Math]::Abs($_.height - 1920) } | Select-Object -First 1
    return $tall ?? $videos[0]
}

function Download-Clip($video, $outPath) {
    $clip = $video.video_files | Where-Object { $_.quality -eq "hd" -and $_.width -ge 720 } | Select-Object -First 1
    if (-not $clip) { $clip = $video.video_files[0] }
    $client = New-Object System.Net.WebClient
    $client.DownloadFile($clip.link, $outPath)
}

function Get-SapiAudio($text, $outPath, $voice = "David") {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male, [System.Speech.Synthesis.VoiceAge]::Adult)
    $synth.SetOutputToWaveFile($outPath)
    $synth.Rate = 0
    $synth.Speak($text)
    $synth.Dispose()
}

# Test SAPI
Write-Host "Testing SAPI TTS..."
$testOut = "$TEMP_DIR/test.wav"
Get-SapiAudio "Test audio" $testOut
$testInfo = New-Object System.IO.FileInfo($testOut)
Write-Host "SAPI works: $([math]::Round($testInfo.Length / 1KB, 1)) KB"
Remove-Item $testOut -Force

$results = @()

foreach ($sid in $scripts) {
    Write-Host "`n=== Processing $sid ==="
    
    # Load script
    $scriptPath = "$ROOT/scripts/pending/${sid}.json"
    $json = Get-Content $scriptPath -Raw | ConvertFrom-Json
    $scriptText = $json.script
    $title = $json.title
    Write-Host "Script: $title"
    
    $outVideo = "$ROOT/output_topic/videos/${sid}.mp4"
    $tempMp4a = "$TEMP_DIR/${sid}_video.mp4"
    $tempWav = "$TEMP_DIR/${sid}_audio.wav"
    $tempList = "$TEMP_DIR/${sid}_list.txt"
    
    # Skip if already exists and good size
    if ((Test-Path $outVideo) -and (New-Object System.IO.FileInfo($outVideo)).Length -gt 100KB) {
        Write-Host "Already exists, skipping"
        $results += @{ id = $sid; status = "exists"; size = (New-Object System.IO.FileInfo($outVideo)).Length }
        continue
    }
    
    # Get tags for search
    $tags = $json.tags -join " "
    Write-Host "Searching Pexels: $tags"
    
    try {
        $videos = Get-PexelsVideos $tags
        Write-Host "Found $($videos.Count) videos"
        
        # Download 2 clips
        $clip1 = Get-BestClip $videos
        Write-Host "Clip 1: $($clip1.width)x$($clip1.height) ($($clip1.duration)s)"
        Download-Clip $clip1 "$TEMP_DIR/${sid}_clip1.mp4"
        
        $videos2 = Get-PexelsVideos ($tags -replace "productivity", "work focus")
        $clip2 = Get-BestClip $videos2
        Write-Host "Clip 2: $($clip2.width)x$($clip2.height) ($($clip2.duration)s)"
        Download-Clip $clip2 "$TEMP_DIR/${sid}_clip2.mp4"
        
        # Trim clips to 2.5s each
        $ffmpegArgs1 = "-ss 0 -i `"$TEMP_DIR/${sid}_clip1.mp4`" -t 2.5 -vf `"scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1`" -c:v libx264 -preset fast -crf 23 -an -r 30 `"$TEMP_DIR/${sid}_c1.mp4`""
        $ffmpegArgs2 = "-ss 0 -i `"$TEMP_DIR/${sid}_clip2.mp4`" -t 2.5 -vf `"scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1`" -c:v libx264 -preset fast -crf 23 -an -r 30 `"$TEMP_DIR/${sid}_c2.mp4`""
        
        $p1 = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs1 -NoNewWindow -Wait -PassThru
        $p2 = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs2 -NoNewWindow -Wait -PassThru
        Write-Host "Clips trimmed"
        
        # Concatenate
        "file '$TEMP_DIR/${sid}_c1.mp4'" | Set-Content $tempList -Encoding ASCII
        "file '$TEMP_DIR/${sid}_c2.mp4'" | Add-Content $tempList -Encoding ASCII
        $p3 = Start-Process -FilePath "ffmpeg" -ArgumentList "-f concat -safe 0 -i `"$tempList`" -c copy `"$tempMp4a`"" -NoNewWindow -Wait -PassThru
        Write-Host "Videos concatenated"
        
        # SAPI TTS
        Write-Host "Generating SAPI TTS..."
        Get-SapiAudio $scriptText $tempWav
        $wavInfo = New-Object System.IO.FileInfo($tempWav)
        Write-Host "TTS: $([math]::Round($wavInfo.Length / 1KB)) KB"
        
        # Get video duration
        $probeJson = & ffprobe -v quiet -print_format json -show_format "$tempMp4a" 2>$null | ConvertFrom-Json
        $videoDur = [double]($probeJson.format.duration)
        Write-Host "Video duration: $videoDur s"
        
        # Trim TTS to video length
        $trimmedWav = "$TEMP_DIR/${sid}_audio_trimmed.wav"
        $p4 = Start-Process -FilePath "ffmpeg" -ArgumentList "-i `"$tempWav`" -t $videoDur -c:a copy `"$trimmedWav`"" -NoNewWindow -Wait -PassThru
        
        # Mux video + audio
        $p5 = Start-Process -FilePath "ffmpeg" -ArgumentList "-i `"$tempMp4a`" -i `"$trimmedWav`" -c:v copy -c:a aac -b:a 128k -shortest `"$outVideo`" -y" -NoNewWindow -Wait -PassThru
        
        $outInfo = New-Object System.IO.FileInfo($outVideo)
        Write-Host "Output: $([math]::Round($outInfo.Length / 1MB, 2)) MB"
        
        $results += @{ id = $sid; status = "done"; size = $outInfo.Length }
        
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)"
        $results += @{ id = $sid; status = "error"; error = $_.Exception.Message }
    }
    
    # Cleanup
    Get-ChildItem "$TEMP_DIR/${sid}*" | Remove-Item -Force -ErrorAction SilentlyContinue
}

Write-Host "`n=== SUMMARY ==="
$results | ForEach-Object { Write-Host "$($_.id): $($_.status) $(if($_.size){"($([math]::Round($_.size/1MB,2))MB")}" )" }
