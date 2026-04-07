import json, os
scripts_dir = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending'
for sid in ['TECH-12','COM-02','COM-03','COM-04']:
    fpath = scripts_dir + '/' + sid + '.json'
    if os.path.exists(fpath):
        with open(fpath, encoding='utf-8-sig') as f:
            d = json.load(f)
        print(repr(sid) + ': video_path=' + repr(d.get('video_path', 'MISSING')) + ', produced_at=' + repr(d.get('produced_at', 'MISSING')))
    else:
        print(repr(sid) + ': FILE MISSING')
