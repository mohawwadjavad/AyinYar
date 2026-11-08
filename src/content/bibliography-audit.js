/* AyinYar 0.6.0 — read-only displayed bibliography evidence check.
 * Evidence, not proof: bibliography editing, CSL styles and uncited items are valid.
 */
(function (root) {
 'use strict';
 const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const MAX_TEXT=2*1024*1024;
 function attr(node,key){return node?.getAttributeNS?.(W,key)||node?.getAttribute?.('w:'+key)||'';}
 function xmlDoc(xml){const d=new DOMParser().parseFromString(xml,'application/xml');if(d.getElementsByTagName('parsererror').length)throw new Error('XML فهرست منابع قابل خواندن نیست.');return d;}
 function normalize(input){return String(input||'').normalize('NFKC').toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f\u0670\u200c\u200d\u200e\u200f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();}
 function normalizeDOI(input){return String(input||'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').trim().toLowerCase().replace(/[\s\u200c]+/g,'');}
 function extractBibFields(xml,part){
   const doc=xmlDoc(xml),stack=[],out=[];
   let para=0;
   const nodes=doc.getElementsByTagName('*');
   for(const node of nodes){
     if(node.namespaceURI!==W)continue;
     const tag=node.localName;
     if(tag==='p'){
       para++;
       for(const entry of stack){if(entry.inResult&&entry.result.length&&entry.result.length<MAX_TEXT)entry.result+='\n';}
     }
     if(tag==='fldChar'){
       const t=attr(node,'fldCharType');
       if(t==='begin'){stack.push({instr:'',result:'',inResult:false,start_paragraph:para,paragraphs:{}});}
       else if(t==='separate'&&stack.length){stack[stack.length-1].inResult=true;}
       else if(t==='end'&&stack.length){const f=stack.pop();if(/\bZOTERO_BIBL\b/i.test(f.instr))out.push({part,start_paragraph:f.start_paragraph,instruction:f.instr.slice(0,10000),text:f.result.slice(0,MAX_TEXT),paragraphs:Object.entries(f.paragraphs).map(([n,t])=>({number:Number(n),text:t})),truncated:f.result.length>=MAX_TEXT});}
     }else if(tag==='instrText'&&stack.length&&!stack[stack.length-1].inResult){
       const f=stack[stack.length-1];if(f.instr.length<10000)f.instr+=(node.textContent||'').slice(0,10000-f.instr.length);
     }else if(tag==='t'||tag==='delText'){
       if(tag==='delText')continue;
       // Word can nest content. The result of the innermost field belongs to the outer bibliography too.
       for(const f of stack)if(f.inResult && f.result.length<MAX_TEXT){const chunk=(node.textContent||'').slice(0,MAX_TEXT-f.result.length);f.result+=chunk;f.paragraphs[para]=(f.paragraphs[para]||'')+chunk;}
     }else if((tag==='br'||tag==='tab')&&stack.length){
       for(const f of stack)if(f.inResult&&f.result.length<MAX_TEXT)f.result+=' ';
     }else if(tag==='fldSimple'){
       const instruction=attr(node,'instr');
       if(/\bZOTERO_BIBL\b/i.test(instruction)){
         const text=Array.from(node.getElementsByTagNameNS(W,'t')).map(x=>x.textContent||'').join('');
         out.push({part,start_paragraph:para,instruction:instruction.slice(0,10000),text:text.slice(0,MAX_TEXT),paragraphs:[{number:para,text:text.slice(0,MAX_TEXT)}],truncated:text.length>MAX_TEXT});
       }
     }
   }
   return out;
 }
 function settingsFromInstruction(instruction){
   const start=instruction.indexOf('{');if(start<0)return {status:'missing',uncited:[],omitted:[],custom:[]};
   let quote=false,esc=false,depth=0;
   for(let i=start;i<instruction.length;i++){
     const ch=instruction[i];
     if(quote){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')quote=false;continue;}
     if(ch==='"'){quote=true;continue;}
     if(ch==='{')depth++;
     else if(ch==='}'&&--depth===0){try{const o=JSON.parse(instruction.slice(start,i+1));return {status:'parsed',uncited:Array.isArray(o.uncited)?o.uncited:[],omitted:Array.isArray(o.omitted)?o.omitted:[],custom:Array.isArray(o.custom)?o.custom:[]};}catch(e){return {status:'unreadable',uncited:[],omitted:[],custom:[]};}}
   }
   return {status:'unreadable',uncited:[],omitted:[],custom:[]};
 }
 function audit(parts,citationAudit){
   const fields=[],errors=[];
   for(const [part,xml] of Object.entries(parts||{})){
     try{if(xml)fields.push(...extractBibFields(xml,part));}
     catch(e){errors.push(part+': '+e.message);}
   }
   const settingItems=fields.map(f=>settingsFromInstruction(f.instruction));
   const allText=fields.map(f=>f.text).join('\n');
   const textNorm=normalize(allText);
   const displayedDOIs=(allText.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/|\bdoi\s*:\s*)10\.\d{4,9}\/[\w.;()/:+-]+/gi)||[]).map(d=>normalizeDOI(d.replace(/^doi\s*:\s*/i,'')));
   const unique=new Map();
   for(const c of citationAudit?.citations||[])for(const i of c.items||[]){
     const id=i.uris?.[0]||((i.key||'')+'|'+(i.title||''));
     if(!id)continue;
     if(!unique.has(id))unique.set(id,{id,title:i.title||'',doi:i.doi||'',citation_field_numbers:[]});
     const v=unique.get(id);if(!v.citation_field_numbers.includes(citationAudit.citations.indexOf(c)+1))v.citation_field_numbers.push(citationAudit.citations.indexOf(c)+1);
   }
   const sources=[];
   for(const v of unique.values()){
     const titleNorm=normalize(v.title),doiNorm=normalizeDOI(v.doi);
     const matchedTitle=titleNorm.length>=12&&textNorm.includes(titleNorm);
     const matchedDOI=doiNorm.startsWith('10.')&&(displayedDOIs.includes(doiNorm)||allText.toLowerCase().includes(doiNorm));
     let status='review',evidence='';
     if(!fields.length){status='not_tested';evidence='هیچ فیلد زنده فهرست منابع پیدا نشد.';}
     else if(matchedDOI){status='observed';evidence='DOI منبع در متن نمایشی فهرست دیده شد.';}
     else if(matchedTitle){status='observed';evidence='عنوان منبع در متن نمایشی فهرست دیده شد.';}
     else if(!titleNorm&&!doiNorm){status='unknown';evidence='عنوان یا DOI برای مقایسه موجود نیست.';}
     else if(!allText.trim()){status='unknown';evidence='فیلد فهرست منابع موجود است اما متن نمایشی آن در XML قابل خواندن نیست.';}
     else{status='review';evidence='عنوان یا DOI در متن نمایشی بازیابی نشد؛ ممکن است سبک استناد، تغییر دستی، یا حذف عمدی علت باشد.';}
     const foundIn=[];
     if(status==='observed')for(const f of fields)for(const para of (f.paragraphs||[])){const np=normalize(para.text);if((titleNorm.length>=12&&np.includes(titleNorm))||(doiNorm.startsWith('10.')&&para.text.toLowerCase().includes(doiNorm)))foundIn.push({part:f.part,paragraph:para.number});}
     sources.push({source_uri:v.id,title:v.title,doi:v.doi,citation_field_numbers:v.citation_field_numbers,status,evidence,visible_entry_paragraphs:foundIn.slice(0,12)});
   }
   const totals={observed:sources.filter(s=>s.status==='observed').length,review:sources.filter(s=>s.status==='review').length,unknown:sources.filter(s=>s.status==='unknown').length,not_tested:sources.filter(s=>s.status==='not_tested').length};
   return {
     kind:'displayed-bibliography-evidence',field_count:fields.length,
     fields:fields.map((f,k)=>({number:k+1,part:f.part,paragraph_hint:f.start_paragraph,text_length:f.text.length,has_rendered_text:!!f.text.trim(),truncated:f.truncated,settings:settingItems[k]})),
     sources,totals,errors,limit:'مقایسه فقط با متن نمایشی فیلدهای زنده در DOCX انجام می‌شود. عنوان یا DOI یافت‌شده نشانه‌ای از حضور منبع است و تأیید صحت کامل مدخل یا تطابق APA نیست. حذف عمدی، منابع بدون استناد، اختصارات، تغییر دستی و فهرست‌های غیرزنده می‌توانند نتیجه را تغییر دهند.',
     exceptions:{uncited:settingItems.reduce((n,x)=>n+x.uncited.length,0),omitted:settingItems.reduce((n,x)=>n+x.omitted.length,0),custom:settingItems.reduce((n,x)=>n+x.custom.length,0)}
   };
 }
 root.AyinBibliography=Object.freeze({audit,extractBibFields,normalize,settingsFromInstruction});
})(typeof window!=='undefined'?window:globalThis);
