/* AyinYar 0.21.0 — review matrix + user-verified evidence passport.
 * Pure deterministic data helpers; never synthesizes scientific claims.
 */
(function(root){
 'use strict';
 const SCHEMA=1, MAX_ROWS=150, MAX_EVIDENCE=12;
 const FIELDS={aim:650,method:450,sample:420,findings:800,limitations:650,gap:500,relevance:450,notes:800};
 const STANCES=['unreviewed','supports','qualifies','contradicts','context'];
 const STATUS_LABELS={unreviewed:'نیازمند بررسی',supports:'پشتیبان ادعا',qualifies:'مشروط / محدودکننده',contradicts:'شاهد متفاوت',context:'اطلاعات زمینه‌ای'};
 const clip=(val,max)=>String(val??'').replace(/\u0000/g,'').trim().slice(0,max);
 const safeID=value=>/^[a-zA-Z0-9_-]{1,80}:[a-zA-Z0-9_-]{1,80}$/.test(String(value||''));
 function author(item){
   try{
     const creators=item.getCreators?.()||[];
     return clip(creators.slice(0,3).map(c=>[c.firstName,c.lastName].filter(Boolean).join(' ')||c.name||'').filter(Boolean).join('، '),240);
   }catch(_){return ''}
 }
 function field(item,name){try{return clip(item.getField(name),name==='abstractNote'?1200:500)}catch(_){return ''}}
 function fromItem(item){
   if(!item||typeof item.isRegularItem!=='function'||!item.isRegularItem())return null;
   const id=String(item.libraryID||'')+':'+String(item.key||'');
   if(!safeID(id)||!item.id)return null;
   return {id,zoteroItemID:Number(item.id),title:field(item,'title')||'بدون عنوان',authors:author(item),year:field(item,'date').slice(0,30),type:clip(item.itemType,90),doi:field(item,'DOI'),abstract:field(item,'abstractNote'),url:field(item,'url')};
 }
 function makeRow(source){
   if(!source||!safeID(source.id))throw Error('شناسه منبع Zotero معتبر نیست.');
   const meta={};
   for(const name of ['id','title','authors','year','type','doi','abstract','url'])meta[name]=clip(source[name],name==='abstract'?1200:name==='title'?500:300);
   meta.zoteroItemID=Number.isSafeInteger(Number(source.zoteroItemID))?Number(source.zoteroItemID):0;
   const row={source:meta,fields:{},evidence:[],updatedAt:new Date().toISOString()};
   for(const [name] of Object.entries(FIELDS))row.fields[name]='';
   return row;
 }
 function normalizeEvidence(x){
   if(!x||typeof x!=='object')throw Error('ساختار شاهد نامعتبر است.');
   const stance=STANCES.includes(x.stance)?x.stance:'unreviewed';
   const evidence={id:clip(x.id,44)||('e'+Date.now()),claim:clip(x.claim,440),quote:clip(x.quote,800),page:clip(x.page,45),stance,comment:clip(x.comment,550)};
   // Optional provenance from locally matched PDF excerpts; legacy schema stays backward compatible.
   if(x.origin&&x.origin.kind==='local-ai')evidence.origin={kind:'local-ai',attachmentKey:clip(x.origin.attachmentKey,80),chunkId:clip(x.origin.chunkId,50),pageSource:x.origin.pageSource==='indexed-pages'?'indexed-pages':'unknown'};
   if(stance!=='unreviewed'&&(!evidence.claim||!evidence.quote||!evidence.page))throw Error('برای دسته‌بندی شاهد، ادعا، نقل‌قول و شماره صفحه را وارد کن.');
   return evidence;
 }
 function normalizeRow(input){
   if(!input||!input.source)throw Error('منبع نامعتبر در فایل.');
   const row=makeRow(input.source);
   for(const [name,max] of Object.entries(FIELDS))row.fields[name]=clip(input.fields?.[name],max);
   row.evidence=(Array.isArray(input.evidence)?input.evidence:[]).slice(0,MAX_EVIDENCE).map(normalizeEvidence);
   row.updatedAt=/^\d{4}-/.test(input.updatedAt||'')?clip(input.updatedAt,40):row.updatedAt;
   return row;
 }
 function parse(raw){
   const input=typeof raw==='string'?JSON.parse(raw):raw;
   if(!input||input.app!=='AyinYarReviewMatrix'||input.schema!==SCHEMA||!Array.isArray(input.rows)||input.rows.length>MAX_ROWS)throw Error('ساختار فایل ماتریس معتبر نیست یا تعداد منابع بیش از حد است.');
   const ids=new Set();const rows=[];
   for(const x of input.rows){const r=normalizeRow(x);if(ids.has(r.source.id))throw Error('شناسه تکراری در داده‌ها.');ids.add(r.source.id);rows.push(r)}
   return {app:'AyinYarReviewMatrix',schema:SCHEMA,rows};
 }
 const wrap=rows=>({app:'AyinYarReviewMatrix',schema:SCHEMA,exportedAt:new Date().toISOString(),notice:'Claims and supporting quotations are user-entered; not independently verified by AyinYar.',rows:rows.map(normalizeRow)});
 const isChecked=e=>e.stance!=='unreviewed'&&!!(e.claim&&e.quote&&e.page);
 function summary(rows){
   let evidences=0,checked=0,needsReview=0,notes=0;
   for(const r of rows){notes+=Object.values(r.fields).filter(Boolean).length;evidences+=r.evidence.length;checked+=r.evidence.filter(isChecked).length;needsReview+=r.evidence.filter(e=>!isChecked(e)).length}
   return {sources:rows.length,evidences,checked,needsReview,notes};
 }
 const csvCell=x=>{let s=String(x??'');if(/^[\s]*[=+\-@\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const csv=rows=>{
   const header=['شناسه Zotero','عنوان','نویسندگان','تاریخ','DOI','هدف','روش','جامعه/نمونه','یافته‌ها','محدودیت‌ها','شکاف احتمالی','ارتباط با پژوهش','یادداشت‌ها','تعداد شواهد','شواهد دارای جزئیات'];
   const lines=[header.map(csvCell).join(',')];
   for(const r of rows)lines.push([r.source.id,r.source.title,r.source.authors,r.source.year,r.source.doi,...Object.keys(FIELDS).map(k=>r.fields[k]),r.evidence.length,r.evidence.filter(isChecked).length].map(csvCell).join(','));
   return '\ufeff'+lines.join('\r\n');
 };
 const evidenceCSV=rows=>{
   const header=['شناسه Zotero','عنوان مقاله','ادعای پژوهشی','نقل‌قول/شاهد واردشده','شماره صفحه','نوع شاهد (برچسب کاربر)','تفسیر یا یادداشت'];const lines=[header.map(csvCell).join(',')];
   for(const r of rows)for(const e of r.evidence)lines.push([r.source.id,r.source.title,e.claim,e.quote,e.page,STATUS_LABELS[e.stance],e.comment].map(csvCell).join(','));
   return '\ufeff'+lines.join('\r\n');
 };
 const escapeHTML=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 const html=rows=>{
   const headers=['منبع','هدف','روش','جامعه/نمونه','یافته‌ها','محدودیت‌ها','شکاف احتمالی','ارتباط با پژوهش'];
   const tbody=rows.map(r=>'<tr>'+[r.source.title+' — '+r.source.authors+' ('+r.source.year+')',...['aim','method','sample','findings','limitations','gap','relevance'].map(k=>r.fields[k])].map(t=>'<td>'+escapeHTML(t).replace(/\n/g,'<br>')+'</td>').join('')+'</tr>').join('');
   const passports=rows.flatMap(r=>r.evidence.map(e=>'<tr>'+[r.source.title,e.claim,e.quote,e.page,STATUS_LABELS[e.stance],e.comment].map(t=>'<td>'+escapeHTML(t).replace(/\n/g,'<br>')+'</td>').join('')+'</tr>')).join('');
   return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>ماتریس پیشینه — آیین‌یار</title><style>body{font:12pt Tahoma,Arial,sans-serif;direction:rtl}table{border-collapse:collapse;width:100%;margin:14px 0}td,th{border:1px solid #bacbd8;padding:9px;vertical-align:top}th{background:#e8f2f7}p{color:#5c6470}</style></head><body><h1>ماتریس پیشینه پژوهش</h1><p>اطلاعات تحلیلی و شواهد توسط کاربر وارد شده‌اند و به‌صورت مستقل تأیید نشده‌اند.</p><table><thead><tr>'+headers.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+tbody+'</tbody></table><h2>پاسپورت شواهد</h2><table><thead><tr>'+['منبع','ادعا','شاهد','صفحه','برچسب','توضیح'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+passports+'</tbody></table></body></html>';
 };
 function merge(existing,incoming){
   const all=new Map(existing.map(r=>[r.source.id,normalizeRow(r)]));let added=0,updated=0;
   for(const r of incoming){
     const x=normalizeRow(r);
     if(all.has(x.source.id))updated++;else added++;
     all.set(x.source.id,x);
   }
   if(all.size>MAX_ROWS)throw Error('حداکثر ۱۵۰ منبع مجاز است.');
   return {rows:Array.from(all.values()),added,updated};
 }
 root.AyinMatrixCore=Object.freeze({SCHEMA,MAX_ROWS,MAX_EVIDENCE,FIELDS,STANCES,STATUS_LABELS,clip,fromItem,makeRow,normalizeEvidence,normalizeRow,parse,wrap,merge,summary,csv,evidenceCSV,html,isChecked});
 if(typeof module==='object'&&module.exports)module.exports=root.AyinMatrixCore;
})(typeof window==='undefined'?globalThis:window);
