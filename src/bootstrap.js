/* AyinYar Research 0.22.0 — Zotero 10 bootstrapped plugin */
var ayinyarChromeHandle = null;
var ayinyarDialogs = new Set();
async function startup({id, version, rootURI}) {
  const reg = Cc['@mozilla.org/addons/addon-manager-startup;1'].getService(Ci.amIAddonManagerStartup);
  ayinyarChromeHandle = reg.registerChrome(Services.io.newURI(rootURI + 'manifest.json'), [['content', 'ayinyar-selector', 'content/']]);
  for (const win of Zotero.getMainWindows()) if (win && win.ZoteroPane) ayinyarAddMenu(win);
}
function onMainWindowLoad({window}) { if (window && window.ZoteroPane) ayinyarAddMenu(window); }
function onMainWindowUnload({window}) { ayinyarRemoveMenu(window); }
function ayinyarAddMenu(win) {
  const menu = win.document.getElementById('menu_ToolsPopup');
  if (!menu || win.document.getElementById('ayinyar-unit-picker-menu')) return;
  const entry = win.document.createXULElement('menuitem');
  entry.id = 'ayinyar-unit-picker-menu';
  entry.setAttribute('label', 'آیین‌یار پژوهش — داشبورد پژوهشی');
  entry.addEventListener('command', () => ayinyarOpen(win));
  menu.appendChild(entry);
  const itemPopup=win.document.getElementById('zotero-itemmenu');
  if(itemPopup && !win.document.getElementById('ayinyar-visual-context')){
    const visual=win.document.createXULElement('menuitem');
    visual.id='ayinyar-visual-context';
    visual.setAttribute('label','آیین‌یار — استخراج تصاویر PDF و نمایش گالری');
    visual.addEventListener('command',()=>ayinyarOpen(win,true));
    itemPopup.appendChild(visual);
  }
}
function ayinyarOpenExternalURL(rawURL) {
  const url = String(rawURL || '').trim();
  const match = url.match(/^([a-z][a-z0-9+.-]*):/i);
  const scheme = match ? match[1].toLowerCase() : '';
  if (!['https', 'mailto', 'tel'].includes(scheme)) throw new Error('نشانی خارجی مجاز نیست.');
  const uri = Services.io.newURI(url, null, null);
  const service = Cc['@mozilla.org/uriloader/external-protocol-service;1']
    .getService(Ci.nsIExternalProtocolService);
  // Gecko 140 requires an explicit triggering principal for external protocol dispatch.
  service.loadURI(uri, Services.scriptSecurityManager.getSystemPrincipal());
  return true;
}
function ayinyarCopyText(rawText) {
  const text = String(rawText || '');
  Cc['@mozilla.org/widget/clipboardhelper;1']
    .getService(Ci.nsIClipboardHelper).copyString(text);
  return true;
}
function ayinyarOpen(win, autoScan=false) {
  try {
    const dialog = win.openDialog('chrome://ayinyar-selector/content/selector.xhtml', 'ayinyar-dashboard', 'chrome,centerscreen,resizable,dialog=no,width=1120,height=790', {
      ayinyarScan: autoScan,
      ayinyarOpenExternalURL,
      ayinyarCopyText
    });
    ayinyarDialogs.add(dialog);
    dialog.addEventListener('unload', () => ayinyarDialogs.delete(dialog), {once:true});
  } catch (error) { Zotero.logError(error); win.alert('آیین‌یار: ' + error.message); }
}
function ayinyarRemoveMenu(win) { try { win?.document?.getElementById('ayinyar-unit-picker-menu')?.remove();win?.document?.getElementById('ayinyar-visual-context')?.remove(); } catch(e) { Zotero.logError(e); } }
function shutdown() {
  // Close independently opened game windows before releasing registered chrome.
  try {
    const all = Services.wm.getEnumerator(null);
    while (all.hasMoreElements()) {
      const win = all.getNext();
      if (win?.document?.documentURI === 'chrome://ayinyar-selector/content/game.xhtml' && !win.closed) win.close();
    }
  } catch (error) { try { Zotero.logError(error); } catch (_) {} }

  for (const win of Zotero.getMainWindows()) ayinyarRemoveMenu(win);
  for (const dlg of ayinyarDialogs) try { if (!dlg.closed) dlg.close(); } catch(e) {}
  ayinyarDialogs.clear();
  if (ayinyarChromeHandle) { try { ayinyarChromeHandle.destruct(); } catch(e) { Zotero.logError(e); } ayinyarChromeHandle=null; }
}
function install() {}
function uninstall() {}
