/* AyinYar v0.21.6 — researcher profile page and dashboard, no network requests. */
(function(root){
  'use strict';
  const core=root.AyinResearcherCore;
  if(!core)return;
  const $=id=>document.getElementById(id);
  let identity=core.account(null),profile=core.normalizeProfile(null),storageOK=false,storageError='';
  const demoMemory={};
  const pref= root.AYINYAR_DEMO ? {
    read:(k,d)=>{if(Object.prototype.hasOwnProperty.call(demoMemory,k))return demoMemory[k];try{return root.localStorage?.getItem(k)??d}catch(_){return d}},
    write:(k,v)=>{demoMemory[k]=v;try{root.localStorage?.setItem(k,v)}catch(_){}return true;}
  }:root.AyinPrefs;
  function zotero(){
    try{return root.opener?.Zotero||root.Zotero||null}catch(_){return null}
  }
  function set(id,value){const e=$(id);if(e)e.textContent=value}
  function status(text,error=false){
    const e=$('researcher-status');if(!e)return;
    e.textContent=text;e.classList.toggle('is-error',error);
  }
  function read(){
    identity=root.AYINYAR_DEMO ? core.account({Users:{getCurrentUsername:()=> 'demo-researcher',getCurrentUserID:()=>81234}}) : core.account(zotero());
    try{
      if(!pref)throw new Error('ذخیره‌سازی محلی Zotero در دسترس نیست.');
      const loaded=core.readProfile(pref,identity);
      profile=loaded.profile;storageOK=true;storageError='';
    }catch(error){profile=core.normalizeProfile(null);storageOK=false;storageError=error.message}
    render();
  }
  function render(){
    const username=identity.username||'نام کاربری در دسترس نیست';
    set('researcher-username',username);
    set('researcher-userid',identity.userId||'شناسه در دسترس نیست');
    set('researcher-account-state',identity.detected?'حساب Zotero شناسایی شد':'حساب تنظیم‌شده شناسایی نشد');
    const badge=$('researcher-account-badge');if(badge)badge.classList.toggle('offline',!identity.detected);
    const input=$('researcher-display-name');if(input)input.value=profile.displayName;
    // Inline native radio inputs avoid XUL-hosted HTML <select> popup overlap.
    const degree=$('researcher-degree-'+profile.degree)||$('researcher-degree-unspecified');
    if(degree)degree.checked=true;
    const affiliation=$('researcher-affiliation');if(affiliation)affiliation.value=profile.affiliation;
    const greeting=$('researcher-show-greeting');if(greeting)greeting.checked=profile.showGreeting;
    const save=$('researcher-save');if(save)save.disabled=!storageOK;
    const reset=$('researcher-clear');if(reset)reset.disabled=!storageOK;
    const who=core.welcome(identity,profile);
    set('researcher-avatar-initial',who[0]||'پ');
    set('researcher-display-preview',who);
    set('sidebar-researcher-name',who);
    const dash=$('researcher-dashboard-greeting');if(dash){dash.textContent=profile.showGreeting?'سلام '+who+'! 👋':'به فضای پژوهشی آیین‌یار خوش آمدی.'}
    const dashInfo=$('researcher-dashboard-detail');if(dashInfo){
      dashInfo.textContent=identity.detected?'حساب Zotero: '+username+' · اطلاعات پژوهشی فقط در دستگاه تو نگهداری می‌شوند.':'می‌توانی بدون حساب متصل هم پروفایل محلی داشته باشی.';
    }
    if(!storageOK)status('خطای ذخیره‌سازی: '+storageError,true);
    else status(identity.detected?'نام کاربری مستقیماً از Zotero خوانده شد. نام کامل Google در دسترس افزونه نیست.':'برای نمایش نام واقعی در خوشامدگویی، نام نمایشی را وارد کن. اطلاعات حساب Zotero در دسترس نیست.');
  }
  function save(){
    if(!storageOK)return status('ذخیره‌سازی محلی آماده نیست.',true);
    try{
      // Check account once more before writing: never store one account's name in another account's slot.
      const actual=root.AYINYAR_DEMO?identity:core.account(zotero());
      if(actual.key!==identity.key){read();throw new Error('حساب Zotero تغییر کرده است؛ اطلاعات جدید را بررسی و دوباره ثبت کن.');}
      const data={displayName:$('researcher-display-name').value, degree:(document.querySelector('input[name="researcher-degree"]:checked')?.value||'unspecified'), affiliation:$('researcher-affiliation').value, showGreeting:$('researcher-show-greeting').checked};
      profile=core.saveProfile(pref,identity,data);
      render();status('پروفایل پژوهشگر برای همین حساب در تنظیمات محلی ذخیره و بازخوانی شد.');
    }catch(error){status('ذخیره پروفایل انجام نشد: '+error.message,true)}
  }
  function clear(){
    if(!storageOK)return;
    if(!root.confirm('اطلاعات شخصی ثبت‌شده در آیین‌یار برای این حساب پاک شود؟ حساب Zotero و منابع تغییر نخواهند کرد.'))return;
    try{profile=core.deleteProfile(pref,identity);render();status('اطلاعات پروفایل محلی پاک شد. تنظیمات Zotero تغییری نکرد.');}
    catch(error){status('پاک‌سازی انجام نشد: '+error.message,true)}
  }
  function init(){
    $('researcher-save')?.addEventListener('click',save);
    $('researcher-refresh')?.addEventListener('click',()=>{read();status(identity.detected?'اطلاعات حساب از Zotero دوباره خوانده شد.':'حساب تنظیم‌شده در Zotero پیدا نشد.');});
    $('researcher-clear')?.addEventListener('click',clear);
    read();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  root.AyinResearcher=Object.freeze({refresh:read});
})(window);
