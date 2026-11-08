/* AyinYar v0.7.0 — deterministic, read-only citation quality review.
 * A finding is a prompt for human verification, NOT a university compliance violation.
 */
(function(root){
 'use strict';
 const MAX_FINDINGS=5000;
 function make(code,level,location,paragraph,source,explanation,action,confidence){
   return {code,level,location:String(location||''),paragraph_hint:Number(paragraph)||null,
     source:String(source||'').slice(0,500),explanation,action,confidence:confidence||'review'};
 }
 function build(audit){
   const tasks=[];let truncated=false;
   function push(item){if(tasks.length<MAX_FINDINGS)tasks.push(item);else truncated=true;}
   const cites=Array.isArray(audit?.citations)?audit.citations:[];
   const bib=audit?.bibliography_content_audit;
   if(cites.length && !(audit?.bibliographies||[]).length){
     const d=audit?.bibliography_diagnostics;
     push(make('BIBLIOGRAPHY_NOT_DETECTED','review',(d?.raw_marker_parts||[])[0]||'word/document.xml',null,'','فهرست منابع زنده Zotero در بخش‌های بررسی‌شده شناسایی نشد.','در Word با Alt+F9 وضعیت ZOTERO_BIBL را بررسی و سند را ذخیره کنید.','uncertain'));
   }
   for(let ci=0;ci<cites.length;ci++){
     const c=cites[ci],seen=new Set(),seenMetadata=new Set();
     if((c.issues||[]).some(s=>/JSON|citationItems|ناتمام|ناقص/.test(s))){
       push(make('CITATION_FIELD_UNREADABLE','review',c.location,c.paragraph_number,c.items?.[0]?.title,'اطلاعات ساختاری یک استناد ناقص یا قابل خواندن نیست.','استناد را با Zotero Add/Edit Citation در Word بررسی کنید.','high'));
     }
     for(const i of c.items||[]){
       const signature=i.uris?.[0]||(i.key&&i.title?`local:${i.key}:${i.title}`:'');
       if(signature){
         if(seen.has(signature))push(make('DUPLICATE_IN_CITATION','review',c.location,c.paragraph_number,i.title||i.key,'یک منبع بیش از یک بار در همین فیلد استناد قرار دارد.','در Word روی همان استناد، Add/Edit Citation را باز و موارد تکراری را بررسی کنید.','high'));
         seen.add(signature);
       }else push(make('CITATION_ID_UNAVAILABLE','info',c.location,c.paragraph_number,i.title,'برای این آیتم شناسه پایدار قابل مقایسه وجود ندارد.','جزئیات استناد و اتصال منبع را دستی بررسی کنید.','uncertain'));
       if(i.lookup_status==='unavailable'||i.lookup_status==='not_resolvable'){
         push(make('SOURCE_NOT_IN_LOCAL_LIBRARY','info',c.location,c.paragraph_number,i.title,'منبع در کتابخانه محلی فعلی بازیابی نشد؛ ممکن است متعلق به کتابخانه دیگری باشد.','منبع را در کتابخانه متناظر بررسی کنید؛ این وضعیت لزوماً خطا نیست.','uncertain'));
       }
       if(i.metadata_review?.doi_conflict && !seenMetadata.has('doi:'+signature)){
         push(make('EMBEDDED_DOI_DIFFERS','review',c.location,c.paragraph_number,i.title,'DOI ذخیره‌شده در فیلد Word با DOI فعلی منبع در Zotero متفاوت است.','اطلاعات منبع در Zotero را بررسی کرده و در نسخه پشتیبان Word از Zotero Refresh استفاده کنید.','high'));
         seenMetadata.add('doi:'+signature);
       }
       if(i.metadata_review?.title_conflict && !seenMetadata.has('title:'+signature)){
         push(make('EMBEDDED_TITLE_DIFFERS','review',c.location,c.paragraph_number,i.title,'عنوان ذخیره‌شده در استناد با عنوان کنونی کتابخانه Zotero تفاوت قابل توجهی دارد.','عنوان را در Zotero و Word بررسی کنید؛ ممکن است تغییر آگاهانه یا اطلاعات قدیمی باشد.','review'));
         seenMetadata.add('title:'+signature);
       }
     }
   }
   if(bib){
     for(const b of bib.sources||[]){
       if(b.status==='review'){
         const n=b.citation_field_numbers?.[0];const cite=Number(n)>0?cites[n-1]:null;
         push(make('SOURCE_NOT_OBSERVED_IN_BIBLIOGRAPHY','review',cite?.location,cite?.paragraph_number,b.title,'در متن نمایشی فهرست، نشانه روشنی از عنوان یا DOI این منبع پیدا نشد.','تنظیمات Edit Bibliography (حذف یا افزودن دستی)، کوتاه‌سازی عنوان و به‌روز بودن فهرست را بررسی کنید.','uncertain'));
       }
     }
     for(const f of bib.fields||[]){
       if(!f.has_rendered_text)push(make('BIBLIOGRAPHY_WITHOUT_RENDERED_TEXT','info',f.part,f.paragraph_hint,'','فیلد فهرست وجود دارد، اما متن نمایشی آن برای تحلیل قابل خواندن نیست.','فهرست را در Word بررسی کنید و پس از ذخیره دوباره اسکن بگیرید.','uncertain'));
       if(f.truncated)push(make('BIBLIOGRAPHY_TEXT_TRUNCATED','info',f.part,f.paragraph_hint,'','متن فهرست به سقف مجاز پردازش رسیده است.','برای اسناد بسیار طولانی گزارش را به‌صورت کامل‌تر با روش مستقل بررسی کنید.','high'));
     }
     if(bib.errors?.length)push(make('BIBLIOGRAPHY_XML_READ_ERROR','review','',null,'','خواندن بعضی بخش‌های فهرست ناموفق بود.','ساختار فایل DOCX و گزارش JSON را بررسی کنید.','high'));
   }
   // Stable priorities; conservative language. "review" is NOT a formal violation.
   tasks.sort((a,b)=>Number(a.level!=='review')-Number(b.level!=='review') || a.code.localeCompare(b.code));
   return {kind:'citation-integrity-review',version:'0.7.0',university_compliance:false,read_only:true,
     findings:tasks,summary:{total:tasks.length,review:tasks.filter(t=>t.level==='review').length,info:tasks.filter(t=>t.level==='info').length,truncated},
     scope:'این فهرست صرفاً راهنمای فنی برای بررسی انسانی است؛ نبود اخطار به معنی صحت کامل منابع یا تأیید دانشگاهی نیست.'};
 }
 function csv(report){
   const headings=['کد','سطح','بخش XML','پاراگراف تقریبی','منبع','شرح','راهنمای اصلاح','قطعیت'];
   const safe=v=>{let s=String(v??'').replace(/\r?\n/g,' ');if(/^[\s\uFEFF]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
   const rows=(report?.findings||[]).map(x=>[x.code,x.level,x.location,x.paragraph_hint??'',x.source,x.explanation,x.action,x.confidence]);
   return '\uFEFF'+[headings,...rows].map(a=>a.map(safe).join(',')).join('\r\n');
 }
 root.AyinIntegrity=Object.freeze({build,csv});
})(typeof window!=='undefined'?window:globalThis);
