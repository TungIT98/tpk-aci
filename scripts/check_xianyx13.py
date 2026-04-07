import json

script_path = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending/xianxia/XIANYX-13.json'
with open(script_path, 'r', encoding='utf-8') as f:
    script = json.load(f)

for i, shot in enumerate(script.get('shots', [])):
    nar = shot.get('narration', 'NO_NARRATION')
    print('Shot', i+1, ':', nar[:100])
print()
print('Visual scene:', script.get('visual_scene', 'N/A')[:300])
print()
print('Prompt for hailuo:', script.get('prompt_for_hailuo', 'N/A')[:300])
