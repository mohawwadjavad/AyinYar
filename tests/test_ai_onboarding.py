"""Static regression checks for the narrow v0.22.2 API-key onboarding patch."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = '{http://www.w3.org/1999/xhtml}'
ui = ET.parse(ROOT / 'src/content/selector.xhtml').getroot()
js = (ROOT / 'src/content/ai-local.js').read_text('utf-8')
style = (ROOT / 'src/content/selector.css').read_text('utf-8')
manual = (ROOT / 'راهنمای فعال کردن هوش مصنوعی افزونه.txt').read_text('utf-8')
thanks = (ROOT / 'THANKS.txt').read_text('utf-8')
manifest = json.loads((ROOT / 'src/manifest.json').read_text('utf-8'))
assert manifest['version'] == '0.22.2'
assert manifest['applications']['zotero']['id'] == 'ayinyar-university-selector@research.local'
assert manifest['applications']['zotero']['update_url'] == 'https://github.com/mohawwadjavad/AyinYar/releases/latest/download/updates.json'
providers = {'gemini': 'https://aistudio.google.com/apikey', 'openrouter': 'https://openrouter.ai/settings/keys'}
for provider, url in providers.items():
    panels = [el for el in ui.iter() if el.get('data-ai-help-provider') == provider]
    assert len(panels) == 1
    assert panels[0].get('hidden') == 'hidden'
    links = [el for el in panels[0].iter() if el.tag == NS + 'a' and el.get('data-ai-key-link') == provider]
    assert len(links) == 1 and links[0].get('href') == url
    assert links[0].get('target') == '_blank'
    assert links[0].get('rel') == 'noopener noreferrer'
    assert len([el for el in panels[0].iter() if el.tag == NS + 'details']) == 1
    assert url in manual and url in js
    assert f"data-ai-help-provider=\"{provider}\"" in (ROOT / 'src/content/selector.xhtml').read_text('utf-8')
assert "el.hidden=el.dataset.aiHelpProvider!==provider" in js
assert "document.querySelectorAll('[data-ai-key-link]').forEach" in js
assert "root.arguments?.[0]?.ayinyarOpenExternalURL" in js
assert '.ai-provider-help[hidden]{display:none!important}' in style
assert 'ai-online-key' in (ROOT / 'src/content/selector.xhtml').read_text('utf-8')
assert 'pumortem@gmail.com' in thanks and 'دکتری تخصصی' in thanks
assert 'محمدجواد شریفی' in thanks
assert len(manual) > 3500
print('API onboarding: per-provider key links + inline Persian help + privacy/text guide PASS')
