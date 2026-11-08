/* AyinYar v0.9.4 - offline, evidence-safe personal backup. No academic regulations imported. */
(function(root){
 'use strict';
 const LIMIT=100, STORE_LIMIT=220000, MAX_FILE_CHARS=1000000;
 const own=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
 const stable=r=>['title','excerpt','source_id','category','published_jalali','deadline_jalali','post_url'].map(k=>r[k]||'').join('\u241e');
 function normalize(input){
   if(typeof input!=='string' || input.length>MAX_FILE_CHARS)throw Error('فایل پشتیبان بزرگ‌تر از حد مجاز یا ناخواناست.');
   let doc;
   try{doc=JSON.parse(input.replace(/^\uFEFF/,''));}catch(e){throw Error('فایل انتخابی JSON معتبر نیست.');}
   if(!doc || typeof doc!=='object' || Array.isArray(doc) || doc.app!=='AyinYar')throw Error('این فایل، پشتیبان شناسایی‌شده آیین‌یار نیست.');
   const isNew=doc.type==='personal-data-backup' && doc.schema_version===1;
   const isLegacy=doc.type==='manually-curated-notices' && typeof doc.version==='string';
   if(!isNew&&!isLegacy)throw Error('نوع یا نسخه قالب فایل پشتیبان پشتیبانی نمی‌شود.');
   if(own(doc,'official_rules_created') && doc.official_rules_created!==0)throw Error('پشتیبان ادعای ایجاد قانون رسمی دارد و قابل ورود نیست.');
   if(own(doc,'rules') || own(doc,'official_rules'))throw Error('فایل شامل بسته مقررات است؛ ورود قوانین از مسیر اطلاعیه مجاز نیست.');
   if(isNew && (!doc.profile || doc.profile.unit_id!=='iau-najafabad'))throw Error('واحد دانشگاهی فایل پشتیبان با نسخه فعلی مطابقت ندارد.');
   if(!Array.isArray(doc.notices) || doc.notices.length>LIMIT)throw Error('تعداد اطلاعیه‌های فایل نامعتبر یا بیشتر از ظرفیت مجاز است.');
   const n=root.AyinNews;
   if(!n?.validate)throw Error('موتور اعتبارسنجی اطلاعیه در دسترس نیست.');
   const seen=new Set(),records=[];
   for(let i=0;i<doc.notices.length;i++){
     const raw=doc.notices[i];
     if(!raw || typeof raw!=='object' || Array.isArray(raw))throw Error('رکورد '+(i+1)+' ساختار معتبری ندارد.');
     // Reject invalid data explicitly rather than losing records silently during sanitizeStored.
     for(const f of ['id','title','source_id','category','published_jalali','deadline_jalali','excerpt','post_url']){
       if(typeof raw[f]!=='string')throw Error('فیلد «'+f+'» در رکورد '+(i+1)+' باید متن باشد.');
     }
     const id=raw.id;
     if(!/^notice-[a-zA-Z0-9-]{8,90}$/.test(id) || seen.has(id))throw Error('شناسه تکراری یا نامعتبر در رکورد '+(i+1));
     seen.add(id);
     // Strict field length guard (validate truncates overly long entries for manual input).
     for(const [k,max] of [['title',180],['excerpt',2000],['source_id',100],['category',32],['published_jalali',20],['deadline_jalali',20],['post_url',800]]){
       if(raw[k].length>max)throw Error('متن «'+k+'» در رکورد '+(i+1)+' بیش از حد مجاز است.');
     }
     const checked=n.validate(raw);
     const created=typeof raw.created_at==='string'?raw.created_at:'';
     if(created.length>35)throw Error('تاریخ ایجاد رکورد نامعتبر است.');
     // Persist as explicitly UNVERIFIED, never trust review_status from external JSON.
     records.push({id,created_at:created,review_status:'user_added_unverified',...checked});
   }
   return {source:isNew?'v1':'legacy',notices:records,exported_at:typeof doc.exported_at==='string'?doc.exported_at:'',unit_id:'iau-najafabad'};
 }
 function plan(existing,imported,mode='merge'){
   if(!Array.isArray(existing)||!Array.isArray(imported))throw Error('آرشیو قابل مقایسه نیست.');
   if(!['merge','replace'].includes(mode))throw Error('نوع بازیابی پشتیبانی نمی‌شود.');
   const original=root.AyinNews.sanitizeStored(existing);
   if(original.length!==existing.length)throw Error('آرشیو محلی شامل رکورد نامعتبر است؛ از بازنویسی جلوگیری شد.');
   const idSet=new Set(original.map(r=>r.id)), contentSet=new Set(original.map(stable));
   let added=0,skipped=0,conflicts=0;
   const target=mode==='replace'?[]:[...original];
   const ids=mode==='replace'?new Set():idSet;
   const contents=mode==='replace'?new Set():contentSet;
   for(const r of imported){
     const fp=stable(r);
     if(ids.has(r.id)){ if(mode==='merge' && !contentSet.has(fp))conflicts++; else skipped++; continue; }
     if(contents.has(fp)){skipped++;continue;}
     target.push({...r,review_status:'user_added_unverified'});
     ids.add(r.id); contents.add(fp);added++;
   }
   if(target.length>LIMIT)throw Error('بعد از بازیابی تعداد اطلاعیه‌ها از سقف ۱۰۰ مورد بیشتر می‌شود.');
   const serialized=JSON.stringify(target);
   if(serialized.length>STORE_LIMIT)throw Error('حجم بازیابی بیشتر از ظرفیت ذخیره‌سازی محلی است.');
   return {records:target,stats:{before:original.length,from_file:imported.length,after:target.length,added,skipped,conflicts,removed:mode==='replace'?Math.max(0,original.length-target.length):0,mode}};
 }
 function serialize(records,{unit_id='iau-najafabad',now=new Date().toISOString()}={}){
   if(unit_id!=='iau-najafabad')throw Error('واحد دانشگاهی نامعتبر است.');
   const source=root.AyinNews.sanitizeStored(records);
   if(source.length!==records.length)throw Error('آرشیو شامل رکوردهای نامعتبر است؛ خروجی ناقص ایجاد نمی‌شود.');
   return JSON.stringify({app:'AyinYar',type:'personal-data-backup',schema_version:1,app_version:'0.9.4',exported_at:now,profile:{unit_id},official_rules_created:0,notice:'اطلاعیه‌ها با ثبت دستی کاربر هستند و به معنی تأیید رسمی یا مقررات لازم‌الاجرا نیستند.',notices:source},null,2);
 }
 const api=Object.freeze({normalize,plan,serialize,stable,LIMIT,STORE_LIMIT});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.AyinBackup=api;
})(typeof window==='undefined'?globalThis:window);
