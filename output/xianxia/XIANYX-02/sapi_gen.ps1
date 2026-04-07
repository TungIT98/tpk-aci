Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male)
try { $synth.SelectVoice('David Desktop') } catch { }
$synth.Rate = -1
$outPath = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/xianxia/XIANYX-02/narration.wav'
$synth.SetOutputToWaveFile($outPath)
$text = @"
In the cultivation world, they cast out the unworthy without mercy. And so they left him for dead in the ruins of what was once his home. But the heavens had not forgotten him. A violet star fell that night. An omen the ancient texts called the Flame Reborn. A flame that burns only for the hopeless. His father's last gift, a broken jade pendant, the last thing between his son and oblivion. He gripped it as the world showed him its teeth. And in the crater where the star fell, a violet flame burned without fuel, without wind, without mercy. It was waiting. It had always been waiting for him. They cast him out for being nothing. But that night, something ancient answered the call of the fallen star. And when he smiled, the heavens themselves took notice.
"@
$synth.Speak($text)
$synth.SetOutputToDefaultAudioDevice()
Write-Host "SAPI_OK"
