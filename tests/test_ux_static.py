#!/usr/bin/env python3
"""Static regression guards for v0.30.0 navigation and onboarding UX (stdlib only)."""
from pathlib import Path
import xml.etree.ElementTree as ET
import json, re, subprocess

ROOT=Path(__file__).resolve().parents[1]
ui_path=ROOT/'src/content/selector.xhtml'
root=ET.parse(ui_path).getroot()
XHTML='{http://www.w3.org/1999/xhtml}'
ids=[e.get('id') for e in root.iter() if e.get('id')]
assert len(ids)==len(set(ids)), 'Duplicate UI ids'
ids=set(ids)
pages={v.removeprefix('page-') for v in ids if v.startswith('page-')}
assert len(pages)==15, f'Unexpected number of major pages: {pages}'
expected={'dashboard','references','matrix','related','word','visuals','ai-local','ai-rag','compliance','regulations','news','deadlines','researcher','university','about'}
assert pages==expected
for el in root.iter():
    if el.get('aria-controls'):
        assert el.get('aria-controls') in ids, f'aria-controls points to missing element: {el.get("aria-controls")}'
    if el.get('data-go'):
        assert el.get('data-go') in pages, f'Invalid dashboard destination {el.get("data-go")}'
    if el.get('data-page'):
        assert el.get('data-page') in pages

content=ui_path.read_text('utf-8')
ux=(ROOT/'src/content/ux-system.js').read_text('utf-8')
app=(ROOT/'src/content/app.js').read_text('utf-8')
css=(ROOT/'src/content/selector.css').read_text('utf-8')
assert 'ux-system.js' in content
assert 'Object.prototype.hasOwnProperty.call(pageNames,id)' in app, 'Invalid page guard missing'
assert 'window.AyinUX?.onNavigate(id)' in app
for id in pages:
    assert re.search(r'(?<![\w-])'+re.escape(id)+r':\s*\{group:',ux) or re.search(r"'"+re.escape(id)+r"':\s*\{group:",ux), f'Missing guidance for {id}'
assert 'function reportIssue()' in ux
assert 'function openCommand()' in ux
assert 'aria-activedescendant' in ux
assert 'ux-page-hint' in css
assert 'ux-mobile-open' in css
assert 'ux-onboarding-grid' in css
assert 'Ctrl+K' in content
assert 'ux-report-issue' in ids
assert 'ux-back' in ids
assert 'ux-sidebar-scrim' in ids
assert 'ux-command-overlay' in ids
assert 'ux-help-panel' in ids
assert 'ux-command-input' in ids
assert 'ux-main' in ids
assert 'https://github.com/mohawwadjavad/AyinYar/releases/latest/download/updates.json' == json.loads((ROOT/'src/manifest.json').read_text('utf-8'))['applications']['zotero']['update_url']
assert json.loads((ROOT/'src/manifest.json').read_text('utf-8'))['applications']['zotero']['id'] == 'ayinyar-university-selector@research.local'

node_test=r'''
const fs=require('fs'),vm=require('vm');let opened=0,focused=0;let dialogs=[];
const context={
 Cc:{},Ci:{},Services:{},Zotero:{logError(){}},Set,String,Error,console
};vm.createContext(context);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);
const win={openDialog(url,name,flags,options){opened++;const dialog={opener:win,closed:false,focus(){focused++},addEventListener(){}};dialogs.push(dialog);return dialog;},alert(){}};
context.ayinyarOpen(win);context.ayinyarOpen(win);
if(opened!==1||focused!==1)throw Error('Repeated dashboard launch should focus first dialog');
context.ayinyarOpen(win,true);if(opened!==2)throw Error('Context-menu PDF scan must still open a new scan dialog');
console.log('Dashboard dialog deduplication + PDF context-scan preservation PASS');
'''
subprocess.run(['node','-e',node_test,str(ROOT/'src/bootstrap.js')],check=True)
print('UX static checks: 15 pages, navigation targets, ARIA, unique IDs, guide coverage, version invariants PASS')
