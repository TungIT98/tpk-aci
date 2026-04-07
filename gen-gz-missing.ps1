# GZ Missing Videos Production
$ErrorActionPreference = "Continue"
$apiKey = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
$baseDir = "C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI"
$videoDir = "$baseDir\output_topic\videos"
$ffmpeg = "C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"
$python = "python"

$videos = @(
  @{
    id = "GZ-07"
    title = "I Did a 30-Day No-Spend Challenge"
    script = "I did a 30-day no-spend challenge. Not a single discretionary purchase for 30 days. Here's what actually happened. Week one was torture - I kept opening apps out of habit. Week two, something shifted. I stopped window shopping entirely. Week three, I noticed my bank balance for the first time. Week four, I realized I don't actually need most of what I was buying. Final result: saved $1,200 and discovered I was spending out of boredom, not need."
    search = "person using phone credit card shopping"
    tag = "no spend challenge savings"
  },
  @{
    id = "GZ-10"
    title = "I Changed 3 Words on My LinkedIn Bio"
    script = "I changed three words on my LinkedIn bio. Response rate doubled overnight. The three words: results language and specificity. Bad bio: I'm passionate about marketing and love connecting with people. Good bio: I helped 12 startups reach 100K users through content marketing. Which one gets the reply?"
    search = "person working on laptop linkedin profile"
    tag = "linkedin bio career"
  },
  @{
    id = "GZ-11"
    title = "I Ghosted 50 Networking Events"
    script = "I ghosted 50 networking events. Here's what happened instead. I showed up, handed out business cards, said let's connect, and nothing came of it. 50 events, zero meaningful relationships. So I stopped going to events and started reaching out to people directly. One coffee chat a week. Just one. Result: 52 real relationships in one year. Quality beats quantity every time."
    search = "networking event business meeting people"
    tag = "networking career success"
  },
  @{
    id = "GZ-12"
    title = "A Mentor Told Me This at 23"
    script = "A mentor told me this at 23. I ignored it until 28. I was an idiot. She said: your network is your net worth, not your resume. I thought that was startup jargon. I spent five years applying for jobs online, competing with thousands of strangers. Then I finally started building real relationships. Opportunity stopped being something I searched for. It started finding me."
    search = "young professional mentor career advice"
    tag = "mentor network career"
  },
  @{
    id = "GZ-18"
    title = "Why Your Passion Isn't Paying Bills"
    script = "Following your passion is the worst career advice nobody wants to admit. You are not broke because you have not found your passion yet. You are broke because passion does not pay bills and someone told you a lie. Here's the truth: get good at something that people will pay for first. Then use the money and security to explore your passion on your own terms."
    search = "passionate career work burnout"
    tag = "passion career money"
  },
  @{
    id = "GZ-19"
    title = "The Fake It Till You Make It Framework"
    script = "Fake it till you make it has a reputation problem. Half the people who say it mean lie confidently. The other half mean act as if until you become it. One of those approaches works. The other one gets exposed. The framework that actually works: learn the skills first, then project the identity. Not the other way around."
    search = "confidence success career growth"
    tag = "fake it till you make it framework"
  },
  @{
    id = "GZ-20"
    title = "The Zero Dollar Side Hustle"
    script = "Not every side hustle requires investment. I built one that cost zero dollars to start and replaced my 9-to-5 income within 18 months. Let me be clear about the work involved. This is not a get-rich-quick scheme. This is a skill-first approach. Find a skill you can learn for free online. Get good enough to teach it. Offer it for free to get testimonials. Then charge. That's it."
    search = "side hustle work from home laptop"
    tag = "side hustle zero cost income"
  }
)

foreach ($v in $videos) {
  $outFile = "$videoDir\$($v.id).mp4"
  $finalFile = "$videoDir\$($v.id)-FINAL.mp4"
  
  if ((Test-Path $finalFile) -or (Test-Path $outFile)) {
    Write-Host "[SKIP] $($v.id) already exists"
    continue
  }
  
  Write-Host "[PRODUCE] $($v.id): $($v.title)"
  
  # 1. Search Pexels
  $searchUrl = "https://api.pexels.com/videos/search?query=$([uri]::EscapeDataString($v.search))&per_page=5&orientation=portrait"
  $response = Invoke-RestMethod $searchUrl -Headers @{"Authorization"=$apiKey}
  
  if ($response.videos.Count -eq 0) {
    Write-Host "[WARN] No Pexels results for $($v.search), trying alternate"
    $searchUrl = "https://api.pexels.com/videos/search?query=$([uri]::EscapeDataString($v.tag))&per_page=5&orientation=portrait"
    $response = Invoke-RestMethod $searchUrl -Headers @{"Authorization"=$apiKey}
  }
  
  if ($response.videos.Count -eq 0) {
    Write-Host "[ERROR] No Pexels results for $($v.id)"
    continue
  }
  
  # Pick best video (prefer files with portrait orientation)
  $vid = $response.videos | Where-Object { $_.width -lt $_.height } | Select-Object -First 1
  if (-not $vid) { $vid = $response.videos | Select-Object -First 1 }
  
  # Download best quality
  $bestFile = $vid.video_files | Sort-Object { $_.quality -eq "hd" -or $_.width * $_.height } -Descending | Select-Object -First 1
  $downloadUrl = $bestFile.link
  $tmpFile = "$env:TEMP\pexels_$($v.id)_$([guid]::NewGuid().ToString('N')).mp4"
  
  Write-Host "  Downloading from $downloadUrl"
  curl.exe -sL $downloadUrl -o $tmpFile
  
  if ((Test-Path $tmpFile) -and (Get-Item $tmpFile).Length -lt 10000) {
    Write-Host "[ERROR] Download failed for $($v.id)"
    Remove-Item $tmpFile -Force -EA SilentlyContinue
    continue
  }
  
  # 2. Generate TTS with gTTS
  $ttsFile = "$env:TEMP\tts_$($v.id).mp3"
  python -c "
import sys
try:
    from gtts import gTTS
    tts = gTTS(text='''$($v.script.Replace("'","'").Replace("`n"," ").Replace("\","\\"))''', lang='en', tld='com', slow=False)
    tts.save('$($ttsFile.Replace('\','\\'))')
    print('TTS OK')
except Exception as e:
    print(f'TTS ERROR: {e}', file=sys.stderr)
    sys.exit(1)
"
  
  if (-not (Test-Path $ttsFile)) {
    Write-Host "[ERROR] TTS failed for $($v.id)"
    Remove-Item $tmpFile -Force -EA SilentlyContinue
    continue
  }
  
  # 3. FFmpeg combine
  Write-Host "  Combining with FFmpeg"
  & $ffmpeg -y -i $tmpFile -i $ttsFile -filter_complex "[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=2.0[a1];[0:a][a1]amix=inputs=2:duration=first:dropout_transition=0[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 128k $outFile 2>$null
  
  if (-not (Test-Path $outFile)) {
    Write-Host "[ERROR] FFmpeg combine failed for $($v.id)"
    Remove-Item $tmpFile,$ttsFile -Force -EA SilentlyContinue
    continue
  }
  
  $size = (Get-Item $outFile).Length / 1MB
  Write-Host "[DONE] $($v.id) -> $outFile ($([math]::Round($size,1))MB)"
  
  # Cleanup
  Remove-Item $tmpFile,$ttsFile -Force -EA SilentlyContinue
}

Write-Host "Done!"
