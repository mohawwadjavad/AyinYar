#!/usr/bin/env python3
"""Mocked runtime tests for the Gecko bootstrap bridge and About-page links."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

bootstrap_test = r'''const fs=require('fs'),vm=require('vm');
const calls=[];
const context={
 Cc:{
  '@mozilla.org/uriloader/external-protocol-service;1':{getService(){return {loadURI(uri,principal){calls.push({uri,principal});}}}},
  '@mozilla.org/widget/clipboardhelper;1':{getService(){return {copyString(text){calls.push({copy:text});}}}}
 },
 Ci:{nsIExternalProtocolService:{},nsIClipboardHelper:{}},
 Services:{io:{newURI(url){return {spec:url};}},scriptSecurityManager:{getSystemPrincipal(){return 'SYSTEM_PRINCIPAL';}},wm:{getEnumerator(){return {hasMoreElements(){return false;}}}}},
 Zotero:{getMainWindows(){return []},logError(){}},Set,String,Error,console
};
vm.createContext(context);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);
for(const url of ['https://theavanstudio.ir/mohawwadjavad','mailto:pumortem@gmail.com','tel:+15555550100']) context.ayinyarOpenExternalURL(url);
if(calls.length!==3||calls.some(x=>x.principal!=='SYSTEM_PRINCIPAL')) throw Error('external protocol bridge test failed');
let rejected=false;try{context.ayinyarOpenExternalURL('javascript:alert(1)')}catch(e){rejected=true}if(!rejected)throw Error('unsafe scheme accepted');
context.ayinyarCopyText('+15555550100');if(calls[3]?.copy!=='+15555550100')throw Error('clipboard bridge failed');
console.log('bootstrap bridge: https/mailto/tel + system principal + unsafe scheme rejection + clipboard PASS');'''

app = (SRC / "content/app.js").read_text("utf-8")
start = app.index("  function aboutLinkStatus(message){")
end = app.index("  function renderNewsSources(){", start)
funcs = app[start:end]
handler_test = r'''const vm=require('vm');
const status={textContent:''};const copied=[];let launched=[];let bridge=[];
const anchor={getAttribute(n){return n==='href'?this.href:null},href:'https://theavanstudio.ir/mohawwadjavad'};
const window={AYINYAR_DEMO:false,arguments:[{ayinyarOpenExternalURL(u){bridge.push(u)},ayinyarCopyText(t){copied.push(t)}}],alert(){}};
const context={window,navigator:{clipboard:{writeText(t){copied.push(t)}}},$:id=>id==='about-link-status'?status:null,getZotero:()=>({launchURL(u){launched.push(u)}}),String,Error};
vm.createContext(context);vm.runInContext(process.argv[1],context);
function click(url,launchThrows=false,bridgeThrows=false){anchor.href=url;context.getZotero=()=>({launchURL(u){if(launchThrows)throw Error('launch fail');launched.push(u)}});window.arguments[0].ayinyarOpenExternalURL=u=>{if(bridgeThrows)throw Error('bridge fail');bridge.push(u)};let prevented=false,stopped=false;const e={target:{closest(){return anchor}},preventDefault(){prevented=true},stopPropagation(){stopped=true},stopImmediatePropagation(){}};context.handleAboutContactClick(e);return {prevented,stopped};}
let r=click('https://theavanstudio.ir/mohawwadjavad');if(!r.prevented||launched.at(-1)!==anchor.href)throw Error('https link dispatch failed');
r=click('tel:+15555550100',true,false);if(!r.prevented||bridge.at(-1)!=='tel:+15555550100')throw Error('tel compatibility bridge failed');
r=click('mailto:pumortem@gmail.com',true,true);if(!r.prevented||copied.at(-1)!=='pumortem@gmail.com'||!status.textContent.includes('کپی شد'))throw Error('mailto clipboard fallback failed');
let p=false;context.handleAboutContactClick({target:{closest(){anchor.href='javascript:alert(1)';return anchor}},preventDefault(){p=true},stopPropagation(){}});if(p)throw Error('unsafe scheme should not be intercepted');
console.log('About-link handler: HTTPS launch + TEL bridge + MAILTO clipboard fallback + scheme safety PASS');'''

node = "node"
subprocess.run([node, "-e", bootstrap_test, str(SRC / "bootstrap.js")], check=True)
subprocess.run([node, "-e", handler_test, funcs], check=True)
print("All mocked runtime bridge tests PASS")
