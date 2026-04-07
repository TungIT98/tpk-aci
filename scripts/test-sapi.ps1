Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male)
$synth.SetOutputToWaveFile("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/_temp_sapi/test.wav")
$synth.Rate = 0
$text = "There's a 2pm crash sitting on you right now and it's not about what you ate. It's biology. Scientists call it the postprandial dip — your brain genuinely loses capacity in the early afternoon."
$synth.Speak($text)
$info = New-Object System.IO.FileInfo("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/_temp_sapi/test.wav")
Write-Host "Size: $([math]::Round($info.Length / 1KB)) KB"
$synth.Dispose()
