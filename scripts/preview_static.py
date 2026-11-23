#!/usr/bin/env python3
"""Generate non-Zotero browser preview (mock-only, never ship inside XPI)."""
from lxml import etree
from pathlib import Path
import base64, mimetypes
root=Path(__file__).resolve().parents[1]
p=etree.parse(str(root/'src/content/selector.xhtml'))
for el in p.iter():
    if isinstance(el.tag,str) and el.tag.startswith('{'): el.tag=etree.QName(el).localname
body=p.getroot()
script_lines=[]
for elem in list(body):
    if elem.tag=='script':
      elem.attrib['src']=elem.get('src').replace('chrome://ayinyar-selector/content/','./src/content/')
      script_lines.append('<script>'+ (root/'src/content'/Path(elem.get('src')).name).read_text('utf-8').replace('</script','<\\/script') +'</script>')
# otherwise body div markup
app=next(el for el in body if el.get('id')=='app')
for el in app.iter():
 if el.get('src','').startswith('chrome://ayinyar-selector/content/'):
  local=root/'src/content'/el.get('src').replace('chrome://ayinyar-selector/content/','')
  if local.is_file():
   mime=mimetypes.guess_type(local.name)[0] or 'application/octet-stream'
   el.attrib['src']='data:'+mime+';base64,'+base64.b64encode(local.read_bytes()).decode('ascii')
css=(root/'src/content/selector.css').read_text('utf-8').replace('chrome://ayinyar-selector/content/','./src/content/')
font=root/'src/content/assets/fonts/Vazirmatn-Variable.woff2'
css=css.replace('./src/content/assets/fonts/Vazirmatn-Variable.woff2','data:font/woff2;base64,'+base64.b64encode(font.read_bytes()).decode('ascii'))
html='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>AyinYar UI preview - no Zotero</title><style>'+css+'</style><script>window.AYINYAR_DEMO={references:[]};</script></head><body>'+etree.tostring(app,method='html',encoding='unicode')+'\n'.join(script_lines)+'</body></html>'
out=root/'preview.html';out.write_text(html,'utf-8');print(out)
