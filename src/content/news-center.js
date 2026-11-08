/* AyinYar 0.9 — offline bulletin store, deliberate manual input only; no scraping */
(function (root) {
  'use strict';
  const DEFAULT_SOURCES = Object.freeze([
    Object.freeze({id:'iau-najafabad-site',name:'وب‌سایت دانشگاه آزاد اسلامی واحد نجف‌آباد',url:'https://iaun.iau.ir/',verification:'institutional_domain',note:'وب‌سایت دانشگاه؛ اعتبار هر اطلاعیه باید با تاریخ و متن خودش سنجیده شود.'}),
    Object.freeze({id:'aau-re-bale',name:'کانال بله پژوهشی دانشکده هنر، معماری و شهرسازی (@aau_re)',url:'https://web.bale.ai/chat?uid=4996644915',verification:'user_provided_unverified',note:'کاربر معرفی کرده است؛ انتساب رسمی کانال هنوز مستقلاً تأیید نشده است.'})
  ]);
  const CATEGORIES = Object.freeze({defense:'پیش‌دفاع و دفاع',regulation:'بخشنامه و شیوه‌نامه',workshop:'کارگاه و رویداد',call:'فراخوان پژوهشی',other:'سایر اطلاعیه‌ها'});
  const MAX_ENTRIES=100;
  const clean=(val,max=4000)=>String(val??'').trim().slice(0,max);
  const getSource=id=>DEFAULT_SOURCES.find(s=>s.id===id);
  const safeURL=url=>{ const u=clean(url,800);if(!u)return ''; try{const x=new URL(u);return x.protocol==='https:'?x.href:'';}catch(e){return '';} };
  const jalaliDate=val=>!val||/^14\d\d\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/.test(val);
  function validate(input){
    const title=clean(input?.title,180),excerpt=clean(input?.excerpt,2000),source_id=clean(input?.source_id,100),category=clean(input?.category,32);
    const published_jalali=clean(input?.published_jalali,20),deadline_jalali=clean(input?.deadline_jalali,20),post_url=clean(input?.post_url,800);
    if(title.length<5)throw Error('عنوان اطلاعیه باید حداقل ۵ نویسه داشته باشد.');
    if(!getSource(source_id))throw Error('منبع معتبر در فهرست برنامه انتخاب نشده است.');
    if(!(category in CATEGORIES))throw Error('دسته‌بندی اطلاعیه ناشناخته است.');
    if(!jalaliDate(published_jalali)||!jalaliDate(deadline_jalali))throw Error('تاریخ را به شکل ۱۴۰۵/۰۸/۰۷ با ارقام انگلیسی وارد کنید.');
    if(post_url && !safeURL(post_url))throw Error('لینک پیام باید با https:// شروع شود.');
    return {title,excerpt,source_id,category,published_jalali,deadline_jalali,post_url};
  }
  function make(input,now=new Date().toISOString()){
    const entry=validate(input);
    return {id:'notice-'+now.replace(/[^0-9]/g,'')+'-'+Math.random().toString(36).slice(2,8),created_at:now,review_status:'user_added_unverified',...entry};
  }
  function sanitizeStored(data){
    if(!Array.isArray(data))return [];
    const out=[];let seen=new Set();
    for(const raw of data.slice(0,MAX_ENTRIES)){
      try{
        const r=validate(raw);const id=clean(raw.id,100);
        if(!/^notice-[a-zA-Z0-9-]{8,90}$/.test(id)||seen.has(id))continue;
        seen.add(id);
        out.push({id,created_at:clean(raw.created_at,35),review_status:'user_added_unverified',...r});
      }catch(e){}
    }
    return out;
  }
  function filter(records,{query='',category='all',source_id='all'}={}){
    const q=clean(query,150).toLocaleLowerCase();
    return records.filter(r=>(category==='all'||r.category===category)&&(source_id==='all'||r.source_id===source_id)&&(!q||[r.title,r.excerpt,r.published_jalali,r.deadline_jalali].join(' ').toLocaleLowerCase().includes(q)));
  }
  function serialize(records){return JSON.stringify({app:'AyinYar',version:'0.9.3',type:'manually-curated-notices',official_rules_created:0,exported_at:new Date().toISOString(),sources:DEFAULT_SOURCES,notices:sanitizeStored(records)},null,2);}
  const api={DEFAULT_SOURCES,CATEGORIES,MAX_ENTRIES,validate,make,filter,sanitizeStored,serialize,getSource,safeURL};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AyinNews=Object.freeze(api);
})(typeof window==='undefined'?globalThis:window);
