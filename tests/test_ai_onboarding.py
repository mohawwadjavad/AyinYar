#!/usr/bin/env python3
"""Static + mocked bridge checks for Persian AI API-key onboarding."""
from pathlib import Path
from xml.etree import ElementTree as ET
import subprocess

ROOT = Path(__file__).resolve().parents[1]
guide = ROOT / "راهنمای فعالسازی هوش مصنوعی.txt"
assert guide.exists()
txt = guide.read_text("utf-8")
for needed in ["https://aistudio.google.com/api-keys", "https://openrouter.ai/settings/keys",
               "Gemini", "OpenRouter", "Create API key", "Create Key", "openrouter/free",
               "رضایت", "429", "401", "فقط تا وقتی پنجره آیین‌یار باز است"]:
    assert needed in txt, needed
note = (ROOT / "THANKS.txt").read_text("utf-8")
assert "محمدجواد شریفی‌ام" in note and "پاییز ۱۴۰۵" in note and "pumortem@gmail.com" in note
ui = ET.parse(ROOT / "src/content/selector.xhtml")
for element in ["ai-key-link", "ai-key-guide", "ai-guide-gemini", "ai-guide-openrouter", "ai-key-link-status"]:
    assert len(ui.findall(f".//*[@id='{element}']")) == 1, element

src = (ROOT / "src/content/ai-local.js").read_text("utf-8")
assert "PROVIDER_KEY_URLS=Object.freeze" in src
assert "syncProviderKeyHelp();" in src
assert "$('ai-online-key').value='';" in src
start = src.index("function getCloudKey(){")
end = src.index("function activeModel(){", start)
functions = src[start:end]
mock = r"""
const nodes={};
function el(id){return nodes[id]??(nodes[id]={hidden:false,textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v}});}
let provider='gemini',launched=[],bridge=[],mode='direct',prevented=0;
const $=el;
const status=(id,text)=>el(id).textContent=text;
const root={AYINYAR_DEMO:false,arguments:[{ayinyarOpenExternalURL(u){bridge.push(u)}}]};
const z=()=>mode==='direct'?{launchURL(u){launched.push(u)}}:mode==='throw'?{launchURL(){throw Error('failed')}}:null;
""" + functions + r"""
syncProviderKeyHelp();
if(el('ai-key-link').attrs.href!=='https://aistudio.google.com/api-keys'||el('ai-guide-gemini').hidden||!el('ai-guide-openrouter').hidden) throw Error('Gemini link/guide failed');
openProviderKeySite({isTrusted:true,preventDefault(){prevented++}});
if(launched[0]!=='https://aistudio.google.com/api-keys'||prevented!==1) throw Error('Gemini launch failed');
provider='openrouter';syncProviderKeyHelp();
if(el('ai-key-link').attrs.href!=='https://openrouter.ai/settings/keys'||!el('ai-guide-gemini').hidden||el('ai-guide-openrouter').hidden) throw Error('OpenRouter link/guide failed');
mode='throw';
openProviderKeySite({isTrusted:true,preventDefault(){prevented++}});
if(bridge[0]!=='https://openrouter.ai/settings/keys') throw Error('OpenRouter bridge failed');
root.AYINYAR_DEMO=true;
const n=prevented;openProviderKeySite({isTrusted:true,preventDefault(){prevented++}});
if(prevented!==n) throw Error('Demo navigation blocked');
console.log('API onboarding provider links: PASS');
"""
subprocess.run(["node", "-e", mock], check=True)
print("Persian API guide, THANKS and linked help: PASS")
