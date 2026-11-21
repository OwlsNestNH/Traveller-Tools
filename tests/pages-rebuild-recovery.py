from pathlib import Path
import tempfile, subprocess, os, textwrap
workflow=Path(__file__).resolve().parents[1]/'.github/workflows/pages-rebuild.yml'
if not workflow.exists(): workflow=Path(__file__).with_name('pages-rebuild.yml')
script=textwrap.dedent(workflow.read_text().split('        run: |\n',1)[1])
subprocess.run(['bash','-n'],input=script,text=True,check=True)
sha='a'*40
with tempfile.TemporaryDirectory() as d:
 p=Path(d)
 (p/'sleep').write_text('#!/bin/sh\nexit 0\n'); (p/'sleep').chmod(0o755)
 (p/'gh').write_text('''#!/usr/bin/env python3
import os,sys,json
args=sys.argv[1:]; path=next((a for a in args if a.startswith('repos/')), '')
with open(os.environ['CALL_LOG'],'a') as f: f.write(' '.join(args)+'\\n')
if '--method' in args:
 if os.environ.get('POST_FAIL'): sys.exit(1)
 print('{"status":"queued"}')
elif path.endswith('/commits/main'): print(os.environ.get('MOCK_MAIN', 'a'*40))
elif path.endswith('/pages/builds/latest'):
 if '--jq' in args: print('https://api.github.com/build/1')
 else: print(json.dumps({'commit':os.environ.get('BUILD_SHA','a'*40),'status':os.environ.get('BUILD_STATUS','built'),'url':'https://api.github.com/build/'+os.environ.get('BUILD_ID','2')}))
elif path.endswith('/pages'): print(json.dumps({'build_type':os.environ.get('MOCK_TYPE','legacy'),'source':{'branch':'main','path':'/'}}))
else: print('main')
'''); (p/'gh').chmod(0o755)
 cases=[('valid',{},0,1),('bad SHA',{'EXPECTED_SHA':'oops'},1,0),('dispatch mismatch',{'DISPATCH_SHA':'b'*40},1,0),('main advanced',{'MOCK_MAIN':'b'*40},1,0),('changed source',{'MOCK_TYPE':'workflow'},1,0),('old receipt',{'BUILD_ID':'1'},1,1),('wrong receipt SHA',{'BUILD_SHA':'b'*40},1,1),('build errored',{'BUILD_STATUS':'errored'},1,1),('uncertain POST',{'POST_FAIL':'1'},1,1)]
 for label,extra,expected,posts in cases:
  log=p/'calls'; log.write_text('')
  env={**os.environ,'PATH':d+':'+os.environ['PATH'],'CALL_LOG':str(log),'GH_REPO':'OwlsNestNH/Traveller-Tools','EXPECTED_SHA':sha,'DISPATCH_SHA':sha,'RUNNER_TEMP':d,'GITHUB_STEP_SUMMARY':str(p/'summary'),**extra}
  r=subprocess.run(['bash','-c',script],env=env,capture_output=True,text=True)
  assert r.returncode==expected,(label,r.stderr,r.stdout)
  assert log.read_text().count('--method POST')==posts,label
  print(label+': PASS')
