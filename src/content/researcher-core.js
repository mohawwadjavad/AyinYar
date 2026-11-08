/* AyinYar Researcher Identity v0.21.5 — read-only Zotero account detection + local profiles.
 * Never reads sync credentials, email addresses, Gmail data, or makes network requests.
 */
(function(root){
  'use strict';
  const PREF='extensions.ayinyar.researcher.profile.v1';
  const DEGREES=Object.freeze(['unspecified','masters','phd','other']);
  const MAX_BYTES=80000;
  function clean(value,max=80){
    return String(value==null?'':value).normalize('NFC')
      .replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
  }
  function account(zotero){
    const users=zotero&&zotero.Users;
    let username='',userId='';
    if(users){
      try{if(typeof users.getCurrentUsername==='function'){const value=users.getCurrentUsername();if(typeof value==='string')username=clean(value,120)}}catch(_){}
      try{if(typeof users.getCurrentUserID==='function'){
        const id=users.getCurrentUserID();
        if((typeof id==='number'||typeof id==='string')&&/^[1-9][0-9]*$/.test(String(id)))userId=String(id);
      }}catch(_){}
    }
    const detected=Boolean(username||userId);
    // Stable Zotero user ID is preferred over a mutable username; offline profiles use a separate slot.
    const key=userId?'id:'+userId:(username?'username:'+encodeURIComponent(username.toLocaleLowerCase('en-US')):'local');
    return Object.freeze({username,userId,detected,key});
  }
  function normalizeProfile(raw){
    const data=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const degree=DEGREES.includes(data.degree)?data.degree:'unspecified';
    return {
      displayName:clean(data.displayName,80),
      degree,
      affiliation:clean(data.affiliation,120),
      showGreeting:data.showGreeting!==false
    };
  }
  function blankStore(){return {schema:1,profiles:{}}}
  function parse(raw){
    if(!raw)return blankStore();
    if(typeof raw!=='string'||raw.length>MAX_BYTES)throw new Error('حجم یا قالب داده پروفایل معتبر نیست.');
    let data;
    try{data=JSON.parse(raw)}catch(_){throw new Error('داده ذخیره‌شده پروفایل قابل خواندن نیست؛ برای جلوگیری از حذف آن ذخیره غیرفعال شد.');}
    if(!data||data.schema!==1||!data.profiles||typeof data.profiles!=='object'||Array.isArray(data.profiles)){
      throw new Error('ساختار داده ذخیره‌شده پروفایل با نسخه فعلی سازگار نیست.');
    }
    const profiles={};
    // Prevent prototype pollution and oversized/corrupt stores.
    for(const key of Object.keys(data.profiles)){
      if(!/^(local|id:[1-9][0-9]*|username:[A-Za-z0-9_.%+!~*'()@-]{1,360})$/.test(key))continue;
      profiles[key]=normalizeProfile(data.profiles[key]);
    }
    return {schema:1,profiles};
  }
  function readProfile(pref,identity){
    const data=parse(pref.read(PREF,''));
    return Object.freeze({profile:normalizeProfile(data.profiles[identity.key]),data});
  }
  function saveProfile(pref,identity,value){
    // Load again when saving so changes made in another AyinYar window are preserved.
    const data=parse(pref.read(PREF,''));
    const entry=normalizeProfile(value);
    data.profiles[identity.key]=entry;
    const serialized=JSON.stringify(data);
    if(serialized.length>MAX_BYTES)throw new Error('فضای مجاز پروفایل پر شده است.');
    const written=pref.write(PREF,serialized);
    if(written!==true)throw new Error('ذخیره محلی تأیید نشد.');
    return entry;
  }
  function deleteProfile(pref,identity){
    const data=parse(pref.read(PREF,''));
    delete data.profiles[identity.key];
    if(pref.write(PREF,JSON.stringify(data))!==true)throw new Error('پاک‌کردن اطلاعات محلی تأیید نشد.');
    return normalizeProfile(null);
  }
  function welcome(identity,profile){
    return clean(profile?.displayName,80)||identity.username||'پژوهشگر عزیز';
  }
  const api=Object.freeze({PREF,DEGREES,clean,account,normalizeProfile,parse,readProfile,saveProfile,deleteProfile,welcome});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AyinResearcherCore=api;
})(typeof window==='undefined'?globalThis:window);
