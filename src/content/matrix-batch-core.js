/* AyinYar 0.21.2 — bounded batch queue and reproducible comparison reports.
 * Does NOT infer scientific support, similarity, causality, or research gaps.
 * All report values come exclusively from the user's saved matrix rows.
 */
(function(root){
'use strict';
const MAX_BATCH=8;
const FIELDS=['aim','method','sample','findings','limitations'];
const LABELS={aim:'هدف پژوهش',method:'روش تحقیق',sample:'جامعه / نمونه',findings:'یافته‌های ثبت‌شده',limitations:'محدودیت‌های ثبت‌شده'};
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const csvCell=value=>{let str=String(value??'');if(/^[\s]*[=+\-@\t\r\n]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"';};
function selection(rows, ids, demo=false){
 if(!Array.isArray(rows)||!Array.isArray(ids))throw Error('فهرست منابع معتبر نیست.');
 if(ids.length<1||ids.length>MAX_BATCH||new Set(ids).size!==ids.length)throw Error('بین یک تا هشت منبع یکتا انتخاب کن.');
 const byID=new Map(rows.map(r=>[r.source?.id,r]));
 return ids.map(id=>{
   const row=byID.get(id);
   if(!row||(!demo&&!(Number.isSafeInteger(row.source?.zoteroItemID)&&row.source.zoteroItemID>0)))throw Error('برای تحلیل دسته‌ای، منبع Zotero معتبر انتخاب کن.');
   return row;
 });
}
function report(rows,ids){
 const chosen=selection(rows,ids,true);
 const entries=chosen.map(row=>{
  const fields={};for(const f of FIELDS)fields[f]=String(row.fields?.[f]||'').slice(0,900);
  const evidences=Array.isArray(row.evidence)?row.evidence:[];
  const reviewed=evidences.filter(e=>e?.stance!=='unreviewed'&&e?.page&&e?.quote&&e?.claim).length;
  return {id:row.source.id,title:String(row.source.title||'بدون عنوان'),authors:String(row.source.authors||''),year:String(row.source.year||''),fields,
    evidenceCount:evidences.length,reviewed,needReview:evidences.length-reviewed,withPage:evidences.filter(e=>e.page).length,
    withLocalAI:evidences.filter(e=>e.origin?.kind==='local-ai').length,
    missing:FIELDS.filter(f=>!fields[f])};
 });
 const coverage=FIELDS.map(field=>({field,label:LABELS[field],present:entries.filter(e=>e.fields[field].trim()).length,total:entries.length}));
 const totals={sources:entries.length,evidences:entries.reduce((a,x)=>a+x.evidenceCount,0),reviewed:entries.reduce((a,x)=>a+x.reviewed,0),pending:entries.reduce((a,x)=>a+x.needReview,0)};
 // Lexical overlap is intentionally not treated as agreement or evidence.
 const stop=new Set('برای پژوهش تحقیق مطالعه بررسی روش نتایج نتیجه یافته داده های مورد شده است هستند هستند این آن یک در از به را و که با بر یا نیز همچنین استفاده صورت هدف بین طور بیشتر کمتر انجام شد شدند می شود شده های پژوهشی نمونه جامعه محدودیت نقش تاثیر تأثیر تحت متن مقاله مطالعه مطالعات دانشجویان های اصلی کلیدی نوع نسبت بر اساس شده‌اند بوده استدلال پژوهشگر موضوع'.split(' '));
 const termMap=new Map();
 for(const e of entries){
  const words=new Set((e.fields.method+' '+e.fields.findings).toLowerCase().replace(/\u200c/g,'').match(/[\p{L}]{4,}/gu)||[]);
  for(const w of words)if(!stop.has(w)&&w.length<=25){if(!termMap.has(w))termMap.set(w,new Set());termMap.get(w).add(e.id)}
 }
 const sharedTerms=[...termMap.entries()].filter(([_,ids])=>ids.size>=2).sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0])).slice(0,8).map(([term,ids])=>({term,count:ids.size}));
 return {entries,coverage,totals,sharedTerms,
   disclaimer:'این گزارش صرفاً بازآرایی داده‌های ثبت‌شده در ماتریس است؛ هم‌پوشانی واژه‌ها به معنی توافق علمی و فقدان داده به معنی شکاف پژوهشی نیست. نقل‌قول، صفحه و تفسیر باید با متن PDF بررسی شوند.'};
}
function html(r){
 const h1='<h1>گزارش تطبیقی پیشینه پژوهش — آیین‌یار</h1>';
 const count=`<p>منابع: ${r.totals.sources} | شواهد ثبت‌شده: ${r.totals.evidences} | نیازمند بازبینی: ${r.totals.pending}</p>`;
 const head=['منبع و سال',...FIELDS.map(f=>LABELS[f]),'شواهد (بازبینی‌شده / کل)','فیلدهای تکمیل‌نشده'];
 const table='<table><thead><tr>'+head.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+r.entries.map(e=>'<tr>'+[
  e.title+' ('+e.year+')',...FIELDS.map(f=>e.fields[f]||'—'),e.reviewed+' / '+e.evidenceCount,e.missing.map(f=>LABELS[f]).join('، ')||'—'
 ].map(x=>'<td>'+esc(x).replace(/\n/g,'<br>')+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 const words=r.sharedTerms.length?'<p>'+r.sharedTerms.map(x=>esc(x.term)+' ('+x.count+' منبع)').join('، ')+'</p>':'<p>واژه مشترک برجسته‌ای در متن‌های ثبت‌شده پیدا نشد.</p>';
 const cover='<ul>'+r.coverage.map(x=>'<li>'+esc(x.label)+': '+x.present+' از '+x.total+' منبع</li>').join('')+'</ul>';
 return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>گزارش تطبیقی آیین‌یار</title><style>body{font:12pt Tahoma,Arial,sans-serif;padding:20px;color:#19354d}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aabaca;padding:7px;vertical-align:top;white-space:pre-wrap}th{background:#e8f1f8}p{line-height:1.9}</style></head><body>'+h1+'<p>'+esc(r.disclaimer)+'</p>'+count+'<h2>پوشش اطلاعات</h2>'+cover+'<h2>مقایسه ثبت‌شده منابع</h2>'+table+'<h2>هم‌پوشانی صرفاً واژگانی در روش و یافته‌ها</h2>'+words+'<p>برای استناد به این جدول، مقالات و صفحات واقعی را بازبینی کنید.</p></body></html>';
}
function csv(r){
 const head=['شناسه','منبع','نویسندگان','سال',...FIELDS.map(f=>LABELS[f]),'شواهد کل','دارای ادعا و صفحه (برچسب پژوهشگر)','نیازمند بررسی','فیلدهای تکمیل‌نشده'];
 const lines=[head.map(csvCell).join(',')];
 for(const e of r.entries)lines.push([e.id,e.title,e.authors,e.year,...FIELDS.map(f=>e.fields[f]),e.evidenceCount,e.reviewed,e.needReview,e.missing.map(f=>LABELS[f]).join('، ')].map(csvCell).join(','));
 return '\ufeff'+lines.join('\r\n');
}
root.AyinMatrixBatchCore=Object.freeze({MAX_BATCH,FIELDS,LABELS,selection,report,html,csv});
if(typeof module==='object'&&module.exports)module.exports=root.AyinMatrixBatchCore;
})(typeof window==='undefined'?globalThis:window);
