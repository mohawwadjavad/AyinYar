/* AyinYar 0.16.0 — free scholarly discovery; consent-based online requests */
(function(root){
'use strict';
const LIMIT=12, CACHE_MS=10*60*1000, ENDPOINTS=Object.freeze({crossref:'https://api.crossref.org',openalex:'https://api.openalex.org',semantic:'https://api.semanticscholar.org'});
const $=id=>typeof document!=='undefined'?document.getElementById(id):null;
const NS='http://www.w3.org/1999/xhtml';
const el=(tag,cls,text)=>{const n=document.createElementNS(NS,tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const string=(v,max=500)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
function doi(v){return string(v,240).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').trim().toLowerCase();}
function onlySafeUrl(v){try{const u=new URL(String(v));return u.protocol==='https:'?u.href:'';}catch(_){return '';}}
function normalizeKey(v){return string(v,500).normalize('NFKC').toLocaleLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/\u064a/g,'ی').replace(/\u0643/g,'ک').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function tokens(v){return [...new Set(normalizeKey(v).split(/\s+/).filter(w=>w.length>2&&!['the','and','for','with','from','this','that','are','یک','برای','های','است','در','از','به'].includes(w)))];}
function similarity(a,b){const left=tokens(a),right=new Set(tokens(b));return left.length?left.filter(w=>right.has(w)).length:0;}
function makeQuery(title,keywords){return [string(title,200),...keywords.slice(0,3).map(w=>string(w,55))].filter(Boolean).join(' ').slice(0,320);}
function yearFromCrossref(v){const parts=v?.['date-parts']?.[0]||[];return Number(parts[0])||null;}
function mapCrossref(data){return (data?.message?.items||[]).map(x=>({source:'Crossref',title:string(x.title?.[0]||'',350),year:yearFromCrossref(x.published||x.issued||x.created),authors:(x.author||[]).slice(0,5).map(a=>string([a.given,a.family].filter(Boolean).join(' '),90)),venue:string(x['container-title']?.[0]||'',140),doi:doi(x.DOI),url:onlySafeUrl(x.URL||'')}));}
function mapOpenalex(data){return (data?.results||[]).map(x=>({source:'OpenAlex',title:string(x.title||x.display_name||'',350),year:Number(x.publication_year)||null,authors:(x.authorships||[]).slice(0,5).map(a=>string(a.author?.display_name||'',90)),venue:string(x.primary_location?.source?.display_name||'',140),doi:doi(x.doi),url:onlySafeUrl(x.primary_location?.landing_page_url||x.doi||x.id||'')}));}
function mapSemantic(data){return (data?.data||[]).map(x=>({source:'Semantic Scholar',title:string(x.title||'',350),year:Number(x.year)||null,authors:(x.authors||[]).slice(0,5).map(a=>string(a.name||'',90)),venue:string(x.venue||'',140),doi:doi(x.externalIds?.DOI),url:onlySafeUrl(x.url||'')}));}
function normalizeResults(rows,sourceTitle,sourceDOI){const seen=new Map(),sourceDoi=doi(sourceDOI),sourceName=normalizeKey(sourceTitle);for(const row of rows){
  if(!row.title)continue; if(sourceDoi&&row.doi===sourceDoi)continue;if(sourceName&&normalizeKey(row.title)===sourceName)continue;
  const key=row.doi?'doi:'+row.doi:'title:'+normalizeKey(row.title)+':'+(row.year||'');
  if(!key||key==='title::')continue;
  const entry={...row,id:key,url:onlySafeUrl(row.url||(row.doi?'https://doi.org/'+encodeURIComponent(row.doi):'')),sources:[row.source],overlap:similarity(sourceTitle,row.title)};
  if(!seen.has(key))seen.set(key,entry);else{const old=seen.get(key);if(!old.sources.includes(row.source))old.sources.push(row.source);if(!old.doi&&row.doi)old.doi=row.doi;if(!old.url&&entry.url)old.url=entry.url;}
 }return Array.from(seen.values()).sort((a,b)=>b.overlap-a.overlap||(b.year||0)-(a.year||0));}
function externalLinks(query){return {
 scholar:'https://scholar.google.com/scholar?q='+encodeURIComponent(query),
 openalex:'https://openalex.org/works?search='+encodeURIComponent(query),
 semantic:'https://www.semanticscholar.org/search?q='+encodeURIComponent(query),
 crossref:'https://search.crossref.org/?q='+encodeURIComponent(query)
};}
function buildRequests(query,choices,key=''){const q=encodeURIComponent(query);let list=[];
 if(choices.includes('crossref'))list.push({provider:'Crossref',url:ENDPOINTS.crossref+'/works?query.bibliographic='+q+'&rows='+LIMIT});
 if(choices.includes('openalex'))list.push({provider:'OpenAlex',url:ENDPOINTS.openalex+'/works?search='+q+'&per_page='+LIMIT+(key?'&api_key='+encodeURIComponent(key):'')});
 if(choices.includes('semantic'))list.push({provider:'Semantic Scholar',url:ENDPOINTS.semantic+'/graph/v1/paper/search?query='+q+'&limit='+LIMIT+'&fields=title,year,authors,externalIds,url,venue'});
 return list;
}
function htmlSafe(s){return string(s,2000).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function noteMarkup(seed,entries){const label=htmlSafe(seed.title);return '<h2>آیین‌یار — مقالات مرتبط با «'+label+'»</h2><p>نتایج جست‌وجوی آنلاین پیشنهادی؛ رابطه علمی و اعتبار هر نتیجه باید بررسی شود. تاریخ: '+htmlSafe(new Date().toISOString().slice(0,10))+'</p><ol>'+entries.map(r=>'<li><a href="'+htmlSafe(onlySafeUrl(r.url))+'">'+htmlSafe(r.title)+'</a> — '+htmlSafe(r.year||'بی‌سال')+'؛ '+htmlSafe(r.sources.join(' / '))+(r.doi?'؛ DOI: '+htmlSafe(r.doi):'')+'</li>').join('')+'</ol>';}
const API=Object.freeze({doi,normalizeKey,tokens,similarity,makeQuery,mapCrossref,mapOpenalex,mapSemantic,normalizeResults,externalLinks,buildRequests,noteMarkup,onlySafeUrl});
root.AyinRelated=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(typeof document==='undefined')return;
let source=null,cache=new Map(),rows=[],lastKey='',searching=false;
let selected=new Set(),enabled=new Set(['crossref','openalex']);
function msg(value){const n=$('related-status');if(n)n.textContent=value;}
function zotero(){return window.opener?.Zotero||window.Zotero||null;}
function selectedZotero(){const pane=window.opener?.ZoteroPane||zotero()?.getActiveZoteroPane?.();const items=pane?.getSelectedItems?.()||[];return items.find(it=>it?.isRegularItem?.())||null;}
function readSeed(){if(root.AYINYAR_DEMO){return {title:'Public space and social interaction in architecture',keywords:['public space','social interaction','urban design'],doi:'',item:null};}
 const item=selectedZotero();if(!item)throw new Error('ابتدا یک مقاله، رساله یا کتاب را در پنجره اصلی Zotero انتخاب کن.');
 let title='',DOI='',tags=[];try{title=item.getField('title')||'';DOI=item.getField('DOI')||'';}catch(_){}try{tags=(item.getTags()||[]).map(x=>x.tag).filter(Boolean).slice(0,10);}catch(_){}
 if(!title)throw new Error('عنوان منبع انتخاب‌شده خالی است؛ ابتدا عنوان را در Zotero تکمیل کن.');
 return {title:string(title,300),keywords:tags,doi:DOI,item};
}
function updateButtons(){document.querySelectorAll('[data-related-source]').forEach(b=>{const on=enabled.has(b.dataset.relatedSource);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});}
function applySeed(){try{source=readSeed();$('related-title').value=source.title;$('related-keywords').value=source.keywords.join('، ');msg('منبع انتخاب‌شده خوانده شد. جست‌وجو فقط با فشردن دکمه آغاز می‌شود؛ عنوان و کلیدواژه‌ها به پایگاه‌های انتخاب‌شده ارسال خواهند شد.');}catch(e){source=null;msg(e.message);}}
function openUrl(url){url=onlySafeUrl(url);if(!url)return;try{if(!root.AYINYAR_DEMO&&zotero()?.launchURL){zotero().launchURL(url);return;}}catch(_){}window.open(url,'_blank','noopener');}
function render(){const holder=$('related-results');holder.replaceChildren();$('related-count').textContent=String(rows.length);
 if(!rows.length){holder.appendChild(el('p','related-empty','هنوز نتیجه‌ای دریافت نشده است. پایگاه و عنوان را انتخاب کن و «جست‌وجوی مرتبط» را بزن.'));}
 for(const row of rows){const card=el('article','related-card');const head=el('div','related-card-head');const check=el('input','');check.setAttribute('type','checkbox');check.checked=selected.has(row.id);check.setAttribute('aria-label','انتخاب برای ثبت پیوند در Zotero');check.addEventListener('change',()=>{if(check.checked)selected.add(row.id);else selected.delete(row.id);updateSelection();});head.append(check,el('strong','',row.title));card.append(head);
 const detail=[row.year||'سال نامعلوم',row.venue,...row.sources].filter(Boolean).join(' · ');card.appendChild(el('div','related-meta',detail));
 if(row.authors.length)card.appendChild(el('div','related-meta',row.authors.join('، ')));if(row.doi)card.appendChild(el('div','related-doi','DOI: '+row.doi));
 const btns=el('div','related-actions');const link=el('button','action secondary','مشاهده مقاله');link.type='button';link.disabled=!row.url;link.addEventListener('click',()=>openUrl(row.url));btns.appendChild(link);btns.appendChild(el('span','related-overlap','واژگان مشترک عنوان: '+row.overlap));card.appendChild(btns);holder.appendChild(card);
 }updateSelection();}
function updateSelection(){const n=rows.filter(x=>selected.has(x.id)&&x.url).length;$('related-selected').textContent=String(n);$('related-save-note').disabled=n===0||!source?.item||Boolean(root.AYINYAR_DEMO);}
function parseResponse(response){let v=response?.response??response?.responseText??response;if(typeof v==='string')return JSON.parse(v);if(typeof v==='object'&&v!==null)return v;throw new Error('پاسخ پایگاه در قالب JSON قابل خواندن نیست.');}
async function requestJSON(url){const z=zotero();if(!z?.HTTP?.request)throw new Error('سرویس درخواست آنلاین Zotero در این پنجره موجود نیست.');
 const response=await z.HTTP.request('GET',url,{responseType:'json',timeout:18000});return parseResponse(response);}
async function search(){if(searching)return;const title=string($('related-title').value,300);const keys=string($('related-keywords').value,300).split(/[,،;؛\n]+/).map(x=>x.trim()).filter(Boolean);if(title.length<5){msg('عنوان باید دست‌کم پنج کاراکتر باشد.');return;}if(!enabled.size){msg('حداقل یکی از پایگاه‌ها را انتخاب کن.');return;}
 const q=makeQuery(title,keys);lastKey=q;const freeKey=string($('related-openalex-key').value,256);const reqs=buildRequests(q,Array.from(enabled),freeKey);
 searching=true;$('related-run').disabled=true;msg('در حال جست‌وجو… عنوان و کلیدواژه‌ها به پایگاه‌های انتخابی ارسال می‌شوند.');rows=[];selected.clear();render();
 const errors=[],all=[],used=[];for(const request of reqs){try{const cacheKey=request.url.replace(/api_key=[^&]+/,'api_key=***');let content=cache.get(cacheKey);if(!content||Date.now()-content.time>CACHE_MS){content={time:Date.now(),value:await requestJSON(request.url)};cache.set(cacheKey,content);}const mapping=request.provider==='Crossref'?mapCrossref:request.provider==='OpenAlex'?mapOpenalex:mapSemantic;all.push(...mapping(content.value));used.push(request.provider);}catch(e){const message=String(e.message||e).slice(0,140);errors.push(request.provider+': '+message);}}
 rows=normalizeResults(all,title,source?.doi).slice(0,35);render();searching=false;$('related-run').disabled=false;
 const status=`${rows.length} نتیجه پیشنهادی از ${used.join('، ')||'هیچ پایگاه'} دریافت شد. امتیاز واژگان مشترک، معیار کیفیت علمی نیست.`;
 msg(status+(errors.length?' خطای پایگاه‌ها: '+errors.join(' | '):''));}
async function saveNote(){if(!source?.item){msg('برای ثبت پیوندها ابتدا یک منبع را از Zotero انتخاب کن و «خواندن منبع» را بزن.');return;}
 const entries=rows.filter(x=>selected.has(x.id)&&x.url);if(!entries.length){msg('ابتدا نتایج دلخواه را علامت بزن.');return;}
 if(!window.confirm(`آیا ${entries.length} پیوند پیشنهادی به‌عنوان یادداشت فرزند منبع انتخاب‌شده در Zotero ذخیره شود؟`))return;
 try{const z=zotero();const note=new z.Item('note');note.libraryID=source.item.libraryID;note.parentID=source.item.id;note.setNote(noteMarkup(source,entries));await note.saveTx();msg(`${entries.length} پیوند در یک یادداشت فرزند در Zotero ذخیره شد. هیچ مقاله‌ای خودکار به کتابخانه وارد نشده است.`);}catch(e){msg('ذخیره یادداشت ممکن نشد: '+e.message);}}
function getExternal(){const title=string($('related-title').value,300);const keys=string($('related-keywords').value,300).split(/[,،;؛]+/).map(s=>s.trim()).filter(Boolean);return externalLinks(makeQuery(title,keys));}
function init(){if(!$('related-run'))return;updateButtons();$('related-pick').addEventListener('click',applySeed);applySeed();
 document.querySelectorAll('[data-related-source]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.relatedSource;if(enabled.has(key))enabled.delete(key);else enabled.add(key);updateButtons();}));
 $('related-run').addEventListener('click',search);$('related-save-note').addEventListener('click',saveNote);
 $('related-google').addEventListener('click',()=>{const q=getExternal().scholar;openUrl(q);msg('Google Scholar در مرورگر باز شد؛ نتایج آن داخل افزونه خوانده یا ذخیره نمی‌شوند.');});
 $('related-external-openalex').addEventListener('click',()=>openUrl(getExternal().openalex));
 $('related-external-semantic').addEventListener('click',()=>openUrl(getExternal().semantic));render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window==='undefined'?globalThis:window);
