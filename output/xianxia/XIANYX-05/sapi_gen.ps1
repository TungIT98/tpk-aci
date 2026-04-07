Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male)
try { $synth.SelectVoice('David Desktop') } catch { }
$synth.Rate = -1
$outPath = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/xianxia/XIANYX-05/narration.wav'
$synth.SetOutputToWaveFile($outPath)
$text = @"
He was the grave-keeper. The one who tended the tombs no one remembered. For three years he had buried the dead in silence, alone with the forgotten. But tonight he had wandered too far into the old ground. And found the grave no living person was meant to see, the burial of the Seer King, whose eye could see the moment of death itself. The scar on his eye, the one he had carried since birth, tore open. And as blood poured down his face, the Seer King's eye inside him opened for the first time in three thousand years. Visions flooded through him, every death since the first burial on this hill. Thousands of souls. Thousands of final moments. And all of them were looking at him. They called it a curse. A scar. A disfigurement. But tonight he finally understood. It was never broken. It was locked. And the key had been waiting in the grave all along.
"@
$synth.Speak($text)
$synth.SetOutputToDefaultAudioDevice()
Write-Host "SAPI_OK"
