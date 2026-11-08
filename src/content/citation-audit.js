/* AyinYar 0.7.0 — read-only Zotero Word field scanner with bibliography diagnostics. */
(function(root) {
 'use strict';
 const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const MAX_FIELDS=2500;
 const LIMIT_INSTRUCTION=1000000;
 function getAttr(node,key){return node?.getAttributeNS?.(W,key)||node?.getAttribute?.('w:'+key)||node?.getAttribute?.(key)||'';}
 function jsonObjectFrom(text){
   const start=text.indexOf('{');
   if(start<0)return {data:null,error:'فیلد استناد فاقد داده JSON است.'};
   let depth=0,quoted=false,escaped=false;
   for(let i=start;i<text.length;i++){
     const ch=text[i];
     if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
     if(ch==='"'){quoted=true;continue;}
     if(ch==='{')depth++;
     if(ch==='}' && --depth===0){
       try{return {data:JSON.parse(text.slice(start,i+1)),error:null};}
       catch(e){return {data:null,error:'داده JSON استناد قابل خواندن نیست.'};}
     }
   }
   return {data:null,error:'کد استناد ناتمام یا ناقص است.'};
 }
 function parseInstruction(instr,location,ordinal,paragraph_number){
   const code=String(instr||'');
   if(!/\b(?:ZOTERO_ITEM|ZOTERO_BIBL|ZOTERO_PREF)\b/i.test(code))return null;
   const isCite=/\bZOTERO_ITEM\s+CSL_CITATION\b/i.test(code);
   const isBib=/\bZOTERO_BIBL\b/i.test(code);
   if(!isCite&&!isBib)return null;
   if(isBib)return {kind:'bibliography',location,ordinal,paragraph_number:paragraph_number||null,issues:[]};
   const tail=code.slice(code.search(/\bCSL_CITATION\b/i)+12).slice(0,LIMIT_INSTRUCTION);
   const parsed=jsonObjectFrom(tail);
   const issues=[];
   if(parsed.error)issues.push(parsed.error);
   const data=parsed.data;
   if(data && !Array.isArray(data.citationItems))issues.push('فهرست citationItems در فیلد وجود ندارد.');
   else if(data && data.citationItems.length===0)issues.push('استناد هیچ منبعی ندارد.');
   const items=(Array.isArray(data?.citationItems)?data.citationItems:[]).slice(0,100).map(item=>{
     const uris=(Array.isArray(item?.uris)?item.uris:[]).filter(v=>typeof v==='string'&&/^(https?:\/\/)?(?:www\.)?zotero\.org\//i.test(v)).slice(0,10);
     return {key:String(item?.id??'').slice(0,90),uris,locator:String(item?.locator??'').slice(0,80),title:String(item?.itemData?.title??'').slice(0,300),doi:String(item?.itemData?.DOI??item?.itemData?.doi??'').slice(0,150),lookup_status:uris.length?'unchecked':'no_uri'};
   });
   if(data?.citationItems?.length>100)issues.push('بیش از ۱۰۰ ارجاع در یک فیلد؛ خروجی محدود شده است.');
   if(items.some(v=>!v.uris.length))issues.push('برخی منابع فاقد شناسه URI قابل بررسی هستند.');
   const seenInField=new Set();
   for(const v of items){
     const signature=v.uris[0]||('id:'+v.key);
     if(signature==='id:' || seenInField.has(signature)){
       if(signature!=='id:' && !issues.includes('یک منبع در همین فیلد استناد بیش از یک بار آمده است؛ بررسی دستی لازم است.')) issues.push('یک منبع در همین فیلد استناد بیش از یک بار آمده است؛ بررسی دستی لازم است.');
     }else seenInField.add(signature);
   }
   return {kind:'citation',location,ordinal,paragraph_number:paragraph_number||null,issues,citation_id:String(data?.citationID??'').slice(0,120),items};
 }
 function collectInstructions(xml, location){
   const doc=new DOMParser().parseFromString(xml,'application/xml');
   if(doc.getElementsByTagName('parsererror').length)throw new Error('XML بخش '+location+' صحیح نیست.');
   const stack=[];const fields=[];
   const all=doc.getElementsByTagName('*');
   let ordinal=0,paragraph=0;
   for(const node of all){
     if(node.namespaceURI!==W)continue;
     if(node.localName==='p')paragraph++;
     if(node.localName==='fldSimple'){
       const i=getAttr(node,'instr');if(i)fields.push({text:i,location,ordinal:++ordinal,paragraph_number:paragraph});
     }
     if(node.localName==='fldChar'){
       const k=getAttr(node,'fldCharType');
       if(k==='begin')stack.push({parts:[],collecting:true,paragraph_number:paragraph});
       else if(k==='separate'&&stack.length)stack[stack.length-1].collecting=false;
       else if(k==='end'&&stack.length){const f=stack.pop();fields.push({text:f.parts.join(''),location,ordinal:++ordinal,paragraph_number:f.paragraph_number});}
     }
     if(node.localName==='instrText'&&stack.length&&stack[stack.length-1].collecting){
       const f=stack[stack.length-1];
       if(f.parts.join('').length<LIMIT_INSTRUCTION)f.parts.push(node.textContent||'');
     }
   }
   for(const f of stack)if(f.parts.length)fields.push({text:f.parts.join(''),location,ordinal:++ordinal,paragraph_number:f.paragraph_number,truncated:true});
   return fields;
 }
 function inspectParts(parts){
   const out={citations:[],bibliographies:[],issues:[],parts_checked:[],summary:null,bibliography_diagnostics:null};
   const bibRawParts=[];
   const bibInInstructionParts=[];
   const bibBookmarkParts=[];
   for(const [name,xml] of Object.entries(parts)){
     if(!xml)continue;
     out.parts_checked.push(name);
     // Checking raw XML as well as parsed field instructions provides a useful
     // diagnostic when Word stores the bibliography in an unsupported structure.
     if(/ZOTERO_BIBL/i.test(xml))bibRawParts.push(name);
     if(/<w:bookmarkStart\b[^>]*ZOTERO_BIBL/i.test(xml))bibBookmarkParts.push(name);
     let fields;
     try{fields=collectInstructions(xml,name);}catch(e){out.issues.push(name+': '+e.message);continue;}
     for(const f of fields){
       if(out.citations.length+out.bibliographies.length>=MAX_FIELDS){out.issues.push('شمار فیلدها بیش از حد تحلیل نسخه آزمایشی است.');break;}
       const v=parseInstruction(f.text,f.location,f.ordinal,f.paragraph_number);
       if(!v)continue;
       if(f.truncated)v.issues.push('فیلد در XML پایان مشخص ندارد.');
       if(v.kind==='citation')out.citations.push(v);
       else {out.bibliographies.push(v);if(!bibInInstructionParts.includes(name))bibInInstructionParts.push(name);}
     }
   }
   let state='not_found_in_scanned_xml';
   if(out.bibliographies.length)state='recognized_field';
   else if(bibBookmarkParts.length)state='possible_bookmark';
   else if(bibRawParts.length)state='marker_present_but_unrecognized';
   out.bibliography_diagnostics={
     state,
     scanned_parts:out.parts_checked.length,
     raw_marker_parts:bibRawParts,
     recognized_field_parts:bibInInstructionParts,
     possible_bookmark_parts:bibBookmarkParts,
     note:state==='recognized_field'?'فیلد زنده فهرست منابع شناسایی شد.':
       state==='marker_present_but_unrecognized'?'عبارت ZOTERO_BIBL در XML دیده می‌شود ولی بازرس نتوانست آن را به فیلد استاندارد تبدیل کند؛ ساختار نیازمند بررسی است.':
       state==='possible_bookmark'?'نشانگر ممکن است با Bookmark ذخیره شده باشد؛ بررسی دستی لازم است.':
       'در بخش‌های XML بررسی‌شده نشانه‌ای از ZOTERO_BIBL پیدا نشد؛ این نتیجه به معنی اضافه‌نشدن قطعی فهرست در Word نیست. پس از ذخیره سند، کد فیلدها را بررسی کنید.'
   };
   out.summary=summarize(out);
   out.quality_assessment=qualityAssessment(out);
   return out;
 }
 // Distinguish citation occurrences from unique sources; do not claim that a
 // Zotero bibliography's rendered content is validated by reading field markers.
 function qualityAssessment(data){
   const unique=new Set(),duplicateFields=[],missingIds=[];
   let repeatedOccurrences=0;
   for(const [index,cite] of (data.citations||[]).entries()){
     const within=new Set();let repeated=false;
     for(const item of (cite.items||[])){
       const uri=(item.uris||[]).find(u=>/zotero\.org\//i.test(u||''));
       const signature=uri||((item.key&&item.title)?'local:'+item.key+':'+item.title:'');
       if(!signature){missingIds.push(index+1);continue;}
       unique.add(signature);
       if(within.has(signature)){repeated=true;repeatedOccurrences++;}
       within.add(signature);
     }
     if(repeated)duplicateFields.push({field_number:index+1,location:cite.location,citation_id:cite.citation_id||'',message:'یک منبع در یک فیلد استناد تکرار شده است؛ در Word با Add/Edit Citation بررسی شود.'});
   }
   const hasBib=(data.bibliographies||[]).length>0;
   const citations=(data.citations||[]).length;
   const flags=[];
   if(citations&&!hasBib)flags.push({code:'no-live-bibliography',severity:'review',message:'در بخش‌های بررسی‌شده فهرست منابع زنده Zotero پیدا نشد.',action:'وجود Bibliography را در Word بررسی کنید و پس از ذخیره دوباره تحلیل کنید.'});
   if(duplicateFields.length)flags.push({code:'duplicate-within-field',severity:'review',message:duplicateFields.length+' فیلد استناد دارای منبع تکراری است.',action:'استنادهای علامت‌خورده را از تب Zotero در Word ویرایش کنید؛ آیین‌یار خودکار تغییری نمی‌دهد.'});
   if(missingIds.length)flags.push({code:'unidentified-items',severity:'unknown',message:'برخی آیتم‌ها شناسه قابل اتکا برای مقایسه ندارند.',action:'استنادها و اتصال به منابع را دستی بررسی کنید.'});
   return {citation_fields:citations,citation_item_occurrences:(data.citations||[]).reduce((n,c)=>n+(c.items||[]).length,0),unique_cited_sources:unique.size,duplicate_item_occurrences:repeatedOccurrences,duplicate_citation_fields:duplicateFields,unidentified_item_field_numbers:[...new Set(missingIds)],live_bibliography_fields:(data.bibliographies||[]).length,bibliography_content_verified:false,flags,limitation:'وجود فیلد Bibliography ثابت نمی‌کند تمام مدخل‌های فهرست به‌روز یا درست قالب‌بندی شده‌اند. این نسخه تطبیق تک‌تک مدخل‌های نمایشی فهرست با منابع را انجام نمی‌دهد.'};
 }
 function summarize(data){
   let totalItems=0,withoutUri=0,malformed=0,linked=0,unavailable=0,unchecked=0;
   for(const cite of data.citations){
     totalItems+=cite.items.length;
     if(cite.issues.some(s=>/JSON|citationItems|ناتمام|ناقص/.test(s)))malformed++;
     for(const i of cite.items){
       if(!i.uris.length)withoutUri++;
       if(i.lookup_status==='linked')linked++;
       else if(i.lookup_status==='unavailable')unavailable++;
       else if(i.lookup_status==='unchecked')unchecked++;
     }
   }
   return {citation_fields:data.citations.length,bibliography_fields:data.bibliographies.length,cited_items:totalItems,missing_uri:withoutUri,malformed_fields:malformed,linked_items:linked,unavailable_items:unavailable,unchecked_items:unchecked};
 }
 function metaNorm(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f\u0670\u200c\u200d]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
 function doiNorm(s){return String(s||'').trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/\s+/g,'').replace(/[.,;]+$/g,'');}
 function compareLibraryMetadata(item,record){
   const embeddedDOI=doiNorm(item.doi),currentDOI=doiNorm(record?.getField?.('DOI'));
   const embeddedTitle=metaNorm(item.title),currentTitle=metaNorm(record?.getField?.('title'));
   // Only compare identifiers after successful local URI resolution; skip missing values.
   const doi_conflict=!!(embeddedDOI&&currentDOI&&embeddedDOI!==currentDOI);
   const a=new Set(embeddedTitle.split(' ').filter(x=>x.length>1)),b=new Set(currentTitle.split(' ').filter(x=>x.length>1));
   const intersection=[...a].filter(x=>b.has(x)).length,union=new Set([...a,...b]).size;
   const similarity=union?intersection/union:1;
   const title_conflict=!!(embeddedTitle.length>=18&&currentTitle.length>=18&&similarity<0.55);
   return {doi_conflict,title_conflict,has_comparable_doi:!!(embeddedDOI&&currentDOI),has_comparable_title:!!(embeddedTitle&&currentTitle),
     // report only what is needed to investigate a conflict
     ...(doi_conflict?{embedded_doi:item.doi,current_doi:String(record.getField('DOI')).slice(0,180)}:{}),
     ...(title_conflict?{current_title:String(record.getField('title')).slice(0,300)}:{})};
 }
 async function matchWithLibrary(data,zotero){
   if(!zotero?.URI?.getURIItem){data.issues.push('اتصال به کتابخانه محلی Zotero در این پنجره در دسترس نیست.');data.summary=summarize(data);data.quality_assessment=qualityAssessment(data);return data;}
   const cache=new Map();
   for(const cite of data.citations){
     for(const item of cite.items){
       if(!item.uris.length)continue;
       let any=false,checked=false;
       for(const uri of item.uris){
         try{
           // Do not use network APIs: Zotero.URI.getURIItem is local lookup.
           if(!cache.has(uri))cache.set(uri,Promise.resolve(zotero.URI.getURIItem(uri)).catch(()=>false));
           const obj=await cache.get(uri);
           checked=true;
           if(obj && !obj.deleted){any=true;item.library_key=obj.key||null;item.library_id=obj.libraryID||null;try{item.metadata_review=compareLibraryMetadata(item,obj);}catch(e){item.metadata_review={unavailable:true};}break;}
         }catch(e){/* URI belongs to an inaccessible or unknown library */}
       }
       item.lookup_status=any?'linked':checked?'unavailable':'not_resolvable';
     }
   }
   data.summary=summarize(data);
   data.quality_assessment=qualityAssessment(data);
   return data;
 }
 root.AyinCitations=Object.freeze({parseInstruction,inspectParts,matchWithLibrary,compareLibraryMetadata,summarize,qualityAssessment});
})(typeof window!=='undefined'?window:globalThis);
