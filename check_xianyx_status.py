import os, json
scripts = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending/xianxia'
for i in [8, 11, 12]:
    path = os.path.join(scripts, f'XIANYX-{i:02d}.json')
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
        print(f'XIANYX-{i:02d}: status={data.get("status")}')
    else:
        print(f'XIANYX-{i:02d}: NOT FOUND')
