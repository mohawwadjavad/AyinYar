/* AyinYar Reference Lab 0.12 — local-only research metadata and user-supplied quartile evidence.
   No publisher API, no fabricated quartiles, no automatic item edits. */
(function(root){
 'use strict';
 const trim=x=>String(x==null?'':x).trim();
 const normTitle=s=>trim(s).toLocaleLowerCase().normalize('NFKC').replace(/[\u200c\u200f\u200e\s\p{P}\p{S}]+/gu,'');
 const normDOI=s=>trim(s).replace(/^doi\s*:\s*/i,'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').toLowerCase();
 function normISSN(s){const t=trim(s).replace(/[^0-9xX]/g,'').toUpperCase();return t.length===8?t:'';}
 function validISSN(s){const t=normISSN(s);if(!t)return false;let total=0;for(let i=0;i<8;i++){let c=t[i]==='X'?10:Number(t[i]);if(i<7&&c===10)return false;total+=c*(8-i);}return total%11===0;}
 function issns(s){const chunks=trim(s).match(/\d{4}-?\d{3}[\dXx]/g)||[];return [...new Set(chunks.map(normISSN).filter(validISSN))];}
 function yearOf(s){const m=trim(s).match(/(?<!\d)(?:19\d{2}|20\d{2}|1[34]\d{2})(?!\d)/);return m?Number(m[0]):null;}
 function quality(record){
   const j=record.type==='journalArticle'; const type=record.type;
   const list=[['عنوان',Boolean(trim(record.title))],['پدیدآورنده',Number(record.creatorCount)>0],['تاریخ',Boolean(trim(record.date))]];
   if(j){list.push(['نام نشریه',Boolean(trim(record.publicationTitle))]);list.push(['ISSN',issns(record.ISSN).length>0]);}
   if(type==='bookSection')list.push(['عنوان کتاب',Boolean(trim(record.bookTitle))]);
   if(type==='thesis')list.push(['دانشگاه',Boolean(trim(record.university))]);
   const complete=list.filter(x=>x[1]).length;
   return {complete,total:list.length,ratio:Math.round(100*complete/list.length),missing:list.filter(x=>!x[1]).map(x=>x[0])};
 }
 function diagnose(record){const warnings=[];
   if(record.type==='journalArticle'){
     const raw=trim(record.ISSN);
     if(raw&&!issns(raw).length)warnings.push('ISSN وارد شده، اما رقم کنترلی یا ساختار آن معتبر نیست.');
     if(!raw)warnings.push('ISSN در رکورد ثبت نشده؛ تطبیق چارک ممکن است نیازمند تأیید عنوان نشریه باشد.');
   }
   if(record.DOI&&!/^10\.\d{4,9}\/\S+$/i.test(normDOI(record.DOI)))warnings.push('ساختار DOI نیازمند بررسی است.');
   if(record.type==='journalArticle'&&!trim(record.DOI))warnings.push('DOI ثبت نشده است؛ نبود DOI به‌تنهایی خطا نیست.');
   if(!record.attachmentCount)warnings.push('پیوست فایل ثبت نشده است؛ نبود PDF به‌تنهایی خطا نیست.');
   return warnings;
 }
 const sources=['SJR','JCR','CiteScore'];
 function normalizeEvidence(obj){
    const sourceRaw=trim(obj.source);const source=/^(sjr|scimago(?: journal rank)?)$/i.test(sourceRaw)?'SJR':/^jcr$/i.test(sourceRaw)?'JCR':/^citescore$/i.test(sourceRaw)?'CiteScore':sourceRaw;
    const q=trim(obj.quartile).toUpperCase();const y=Number(obj.year);
    const ss=issns(obj.issn);const journal=trim(obj.journal);
    const category=trim(obj.category);
    const url=trim(obj.url);
    if(!sources.includes(source)||!/^Q[1-4]$/.test(q)||!Number.isInteger(y)||y<1990||y>2100||(!ss.length&&!journal)||!category)throw new Error('رکورد چارک باید دارای منبع، سال، دسته، Q1–Q4 و عنوان مجله یا ISSN معتبر باشد.');
    if(url&&!/^https:\/\/[^\s<>]+$/i.test(url))throw new Error('نشانی شواهد باید HTTPS باشد.');
    return {issn:ss[0]||'',journal:journal.slice(0,240),year:y,category:category.slice(0,240),quartile:q,source,url:url.slice(0,900),status:'user_supplied_unverified'};
 }
 function keyOf(e){return [e.source,e.year,e.issn||normTitle(e.journal),e.category.toLocaleLowerCase()].join('|');}
 function distinct(entries){const m=new Map();entries.forEach(x=>{const e=normalizeEvidence(x);m.set(keyOf(e)+"|"+e.quartile,e);});return [...m.values()];}
 function match(record,entries){
   if(record.type!=='journalArticle')return {status:'not-applicable',matches:[]};
   const candidateIds=issns(record.ISSN);const title=normTitle(record.publicationTitle);
   const candidates=entries.filter(e=>candidateIds.length&&e.issn&&candidateIds.includes(e.issn));
   const byISSN=candidates.length>0;
   const items=byISSN?candidates:(!candidateIds.length&&title?entries.filter(e=>normTitle(e.journal)===title):[]);
   if(!items.length)return {status:candidateIds.length?'not-found':'missing-issn',matches:[],note:'چارک معتبر در بانک شواهد کاربر یافت نشد.'};
   const year=yearOf(record.date);
   if(!year)return {status:'year-missing',matches:[],availableYears:[...new Set(items.map(e=>e.year))].sort(),note:'سال مقاله قابل تشخیص نیست؛ چارک بدون سال نمایش داده نمی‌شود.'};
   const exact=items.filter(e=>e.year===year);
   if(!exact.length)return {status:'year-mismatch',matches:[],availableYears:[...new Set(items.map(e=>e.year))].sort(),note:'برای سال انتشار این مقاله داده‌ای ثبت نشده؛ رتبه سال‌های دیگر جایگزین نمی‌شود.'};
   const conflicts=exact.some(e=>exact.some(f=>e!==f&&keyOf(e)===keyOf(f)&&e.quartile!==f.quartile));
   return {status:conflicts?'conflict':byISSN?'issn-matched':'title-unverified',matches:exact,year,matchMethod:byISSN?'ISSN':'عنوان نشریه؛ نیازمند تأیید ISSN'};
 }
 function parseDelimited(raw,delimiter){const out=[];let row=[],field='',quoted=false;raw=String(raw).replace(/^\uFEFF/,'');
   for(let i=0;i<raw.length;i++){const c=raw[i];if(quoted){if(c==='"'&&raw[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
   else if(c==='"')quoted=true;else if(c===delimiter){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));out.push(row);row=[];field='';}else field+=c;}
   if(quoted)throw new Error('فایل CSV دارای نقل‌قول ناتمام است.'); if(field||row.length){row.push(field.replace(/\r$/,''));out.push(row);}return out;
 }
 function pickDelimiter(raw){const first=raw.split(/\r?\n/,1)[0];const options=[',',';','\t'];return options.sort((a,b)=>first.split(b).length-first.split(a).length)[0];}
 function importCSV(raw,options={}){
   if(raw.length>24*1024*1024)throw new Error('فایل بیش از ۲۴ مگابایت است؛ فهرست مرتبط را در CSV کوچک‌تری ذخیره کن.');
   const lines=parseDelimited(raw,pickDelimiter(raw));if(lines.length<2)throw new Error('CSV باید سطر سرستون و داده داشته باشد.');
   const normalizeHeader=x=>trim(x).toLowerCase().replace(/[\s_\-]+/g,'');
   const heads=lines.shift().map(normalizeHeader); const get=(row,names)=>{for(const s of names){let i=heads.indexOf(normalizeHeader(s));if(i>=0)return trim(row[i]);}return '';};
   if(!heads.some(h=>['issn','journal','title','sourcetitle','نامنشریه'].includes(h)))throw new Error('سرستون ISSN یا journal/Title در CSV پیدا نشد.');
   const fallbackYear=Number(options.defaultYear);const fallbackSource=options.source||'SJR';
   const result=[],bad=[];let read=0;
   for(const row of lines){if(!row.some(x=>trim(x)))continue;if(++read>65000)throw new Error('فایل بیش از ۶۵ هزار رکورد دارد؛ ابتدا به مجلات موردنظر محدودش کن.');
     try{
       const issn=get(row,['ISSN','Print ISSN','EISSN']);const journal=get(row,['journal','title','source title','نام نشریه']);
       const year=Number(get(row,['year','ranking year','سال'])||fallbackYear);
       const source=get(row,['source','ranking source','metric'])||fallbackSource;
       const url=get(row,['source url','url','link']);
       const cat=get(row,['category','subject category','categories','دسته'])||'';
       const q=get(row,['quartile','sjr best quartile','best quartile','q']);
       // SCImago Categories often includes: "Urban Studies (Q1); Architecture (Q2)".
       const expanded=[...cat.matchAll(/(?:^|;)\s*([^;]+?)\s*\((Q[1-4])\)\s*(?=;|$)/gi)];
       const idList=issns(issn);for(const ident of (idList.length?idList:[''])){
         if(expanded.length){for(const m of expanded)result.push(normalizeEvidence({issn:ident,journal,year,source,url,category:m[1].trim(),quartile:m[2]}));}
         else result.push(normalizeEvidence({issn:ident,journal,year,source,url,category:cat||'بهترین چارک؛ دسته نامشخص',quartile:q}));
       }
     }catch(error){if(bad.length<5)bad.push(`ردیف ${read+1}: ${error.message}`);}
   }
   return {entries:distinct(result),accepted:result.length,skipped:read-(result.length?Math.min(read,result.length):0),examples:bad,source:'user-supplied'};
 }
 function formatRowsForCSV(rows){const esc=x=>{let s=trim(x);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
   const out=[['کلید','عنوان','نشریه','ISSN','سال','DOI','کامل بودن فراداده','پیوست','چارک','منبع چارک','دسته','سال چارک','وضعیت تطبیق','موارد بررسی'].map(esc).join(',')];
   for(const r of rows){let m=r.quartile;let q=m.matches?.map(x=>x.quartile).join(' / ')||'',src=m.matches?.map(x=>x.source).join(' / ')||'',cat=m.matches?.map(x=>x.category).join(' | ')||'';
      out.push([r.record.key,r.record.title,r.record.publicationTitle,r.record.ISSN,r.record.date,r.record.DOI,`${r.quality.complete}/${r.quality.total}`,r.record.attachmentCount,q,src,cat,m.year||'',m.status,[...r.audit.issues,...r.advisories].join('؛ ')].map(esc).join(','));
   }return '\uFEFF'+out.join('\r\n');
 }
 root.AyinRefPro=Object.freeze({normTitle,normISSN,validISSN,issns,yearOf,quality,diagnose,normalizeEvidence,keyOf,distinct,match,importCSV,formatRowsForCSV});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.AyinRefPro;
})(typeof window!=='undefined'?window:globalThis);
