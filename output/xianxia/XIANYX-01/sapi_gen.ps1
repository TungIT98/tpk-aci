Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)
try { $synth.SelectVoice('Zira Desktop') } catch { }
$synth.Rate = -1
$outPath = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/xianxia/XIANYX-01/narration.wav'
$synth.SetOutputToWaveFile($outPath)
$text = @"
In the final age of the Nine Heavens, when sects fell and dynasties burned, there was one last temple standing on the sacred peak. The Sword Saint's daughter had never been meant to wield the blade. She was meant to live a quiet life of study and tea. But fate had other plans. Her father's last gift. A phoenix hairpin, forged with his last breath. Each feather, a promise. Each jade eye, a memory. A thousand soldiers marching under a blood-red sky. One woman in crimson, standing alone. No army. No sect. Just her. She was not her father's warrior. But she was his blood. And blood always remembers the blade.
"@
$synth.Speak($text)
$synth.SetOutputToDefaultAudioDevice()
Write-Host "SAPI_OK"
