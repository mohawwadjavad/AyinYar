/* AyinYar 0.9.3 — Gecko/XUL pref adapter. Does not import Services.sys.mjs. */
(function(root){
 'use strict';
 const PREFIX='extensions.ayinyar.';
 const keyOK=k=>typeof k==='string'&&k.startsWith(PREFIX)&&/^[a-zA-Z0-9._-]+$/.test(k);
 function branch(){
   // XUL chrome window: XPCOM preferences service is available without a JS module import.
   const c=typeof Components!=='undefined' ? Components : null;
   if(!c || !c.classes || !c.interfaces) throw new Error('دسترسی سطح افزونه به تنظیمات Zotero موجود نیست.');
   return c.classes['@mozilla.org/preferences-service;1'].getService(c.interfaces.nsIPrefBranch);
 }
 function read(k,defaultValue=''){
   if(!keyOK(k))throw new Error('کلید ذخیره‌سازی مجاز نیست.');
   const prefs=branch();
   // Distinguish absent preference from a failing storage service.
   if(prefs.getPrefType(k)===prefs.PREF_INVALID) return defaultValue;
   return prefs.getStringPref(k);
 }
 function write(k,value){
   if(!keyOK(k))throw new Error('کلید ذخیره‌سازی مجاز نیست.');
   if(typeof value!=='string')throw new Error('مقدار ذخیره‌سازی باید رشته باشد.');
   const prefs=branch();
   prefs.setStringPref(k,value);
   // Prevent user-facing success before a verified local write.
   if(prefs.getStringPref(k)!==value)throw new Error('خواندن دوباره داده ذخیره‌شده با مقدار جدید مطابقت ندارد.');
   return true;
 }
 const api=Object.freeze({read,write,branch});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.AyinPrefs=api;
})(typeof window==='undefined'?globalThis:window);
