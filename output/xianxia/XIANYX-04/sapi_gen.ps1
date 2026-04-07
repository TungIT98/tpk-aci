Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)
try { $synth.SelectVoice('Zira Desktop') } catch { }
$synth.Rate = -1
$outPath = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/xianxia/XIANYX-04/narration.wav'
$synth.SetOutputToWaveFile($outPath)
$text = @"
In the great Azure Bamboo Valley, where the air itself tasted of spiritual power, the sect's most talented disciples came to ascend. But no one ever spoke of the ones who came to suffer. His only belonging, a jade pendant with a butterfly frozen in time. She had given it to him the day they were separated. And every night since, he had whispered the same question into the silence. She had freed the butterfly from its web, and they had taken her from him. Fifteen years he had carried this jade. Fifteen years the butterfly inside had been waiting. The butterfly's wings stirred for the first time in fifteen years. And through the jade, a voice he had waited half his life to hear whispered three words. You finally called. She had been with him all along. Trapped between worlds. Waiting for him to be strong enough to hear her. And now, after fifteen years of silence, she would teach him everything she knew.
"@
$synth.Speak($text)
$synth.SetOutputToDefaultAudioDevice()
Write-Host "SAPI_OK"
