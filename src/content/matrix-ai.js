/* AyinYar 0.21.1 — opt-in local PDF extraction, verification, human approval. */
(function(root){
'use strict';
const A=root.AyinMatrixAICore,R=root.AyinRAGCore,M=root.AyinMatrixCore,$=id=>document.getElementById(id),NS='http://www.w3.org/1999/xhtml';
let chunks=[],attachment=null,sourceID='',models=[],model='',draft=[],busy=false,ready=false;
const node=(tag,cls,text)=>{const e=document.createElementNS(NS,tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const state=(message,error=false)=>{const el=$('matrix-ai-status');if(el){el.textContent=message;el.classList.toggle('error',!!error)}};
const z=()=>root.opener?.Zotero||root.Zotero;
const p=()=>root.opener?.ZoteroPane||z()?.getActiveZoteroPane?.();
function selection(){return root.AyinMatrixUI?.getCurrent?.()||null}
function lock(value){busy=!!value;for(const id of ['matrix-ai-read','matrix-ai-check','matrix-ai-analyze','matrix-ai-apply']){const x=$(id);if(x)x.disabled=!!value;}}
function resetPreview(){chunks=[];attachment=null;sourceID='';draft=[];if($('matrix-ai-suggestions'))$('matrix-ai-suggestions').replaceChildren();if($('matrix-ai-apply'))$('matrix-ai-apply').disabled=true;if($('matrix-ai-open-pdf'))$('matrix-ai-open-pdf').disabled=true;state('برای این منبع، ابتدا پیوست PDF نمایه‌شده را بخوان.');}
function getAttachment(row){
 const api=z(),parent=api?.Items?.get?.(row.source.zoteroItemID);
 if(!parent||String(parent.libraryID)+':'+String(parent.key)!==row.source.id||!parent.isRegularItem?.())throw Error('رکورد اصلی Zotero تغییر کرده یا در دسترس نیست.');
 const found=(parent.getAttachments?.()||[]).map(id=>{try{return api.Items.get(id)}catch(_){return null}}).filter(a=>a?.isAttachment?.()&&(/pdf/i.test(String(a.attachmentContentType||''))||/\.pdf$/i.test(String(a.attachmentFilename||''))));
 if(!found.length)throw Error('برای این منبع پیوست PDF وجود ندارد.');
 return {parent,attachment:found[0]};
}
async function readIndexedPDF(a,parent){
 const api=z();let content=null;
 for(const method of ['getItemContent','getItemContentAsync']){
  try{
   if(typeof api?.Fulltext?.[method]!=='function')continue;
   const v=await api.Fulltext[method](a.id);
   if(typeof v==='string'&&v.trim().length>50){content={content:v};break}
   const validPages=v&&Array.isArray(v.pages)&&v.pages.length&&v.pages.every(x=>Number.isSafeInteger(x?.page)&&x.page>0&&typeof x.text==='string')&&v.pages.some(x=>x.text.trim().length>50);
   if(validPages||(v&&typeof v.content==='string'&&v.content.trim().length>50)){content=v;break}
  }catch(_){}
 }
 if(!content){
  // Use the documented attachment text interface if the fulltext cache getter is unavailable.
  try{const raw=await a.attachmentText;if(typeof raw==='string'&&raw.trim().length>50)content={content:raw}}catch(_){}
 }
 if(!content){
  // Zotero's own *local* PDF full-text cache, never OCR or remote processing.
  const path=await a.getFilePathAsync?.();if(!path)throw Error('پیوست PDF روی این رایانه در دسترس نیست.');
  const utils=root.opener?.PathUtils||root.PathUtils;
  const dir=utils?.parent?.(path)||String(path).replace(/[\\/][^\\/]+$/,'');
  const file=utils?.join?.(dir,'.zotero-ft-cache')||dir+(String(path).includes('\\')?'\\':'/')+'.zotero-ft-cache';
  if(typeof api?.File?.getContentsAsync!=='function')throw Error('خواننده متن محلی Zotero در دسترس نیست.');
  const raw=await api.File.getContentsAsync(file);if(!raw||String(raw).trim().length<50)throw Error('نمایه متن PDF خالی است؛ روی پیوست گزینه Reindex Item را اجرا کن.');
  content={content:String(raw)};
 }
 const pages=Array.isArray(content.pages)&&content.pages.length&&content.pages.every(x=>Number.isSafeInteger(x?.page)&&x.page>0&&typeof x.text==='string')?content.pages.map(x=>({page:x.page,text:x.text})):null;
 const doc={key:parent.key,attachmentKey:a.key,title:parent.getField?.('title')||a.attachmentFilename||'PDF',pages:pages||null,text:pages?'':String(content.content||'')};
 if(doc.text.length>R.MAX_CHARS_PER_DOC)doc.text=doc.text.slice(0,R.MAX_CHARS_PER_DOC);
 return {doc,hasPages:!!pages};
}
async function localCall(path,payload){
 if(!['/api/tags','/api/chat'].includes(path))throw Error('آدرس مجاز نیست.');
 const api=z();if(!api?.HTTP?.request)throw Error('ماژول HTTP داخلی Zotero در دسترس نیست.');
 const options={responseType:'json',timeout:path==='/api/tags'?15000:240000,headers:{'Accept':'application/json'}};
 if(payload){options.headers['Content-Type']='application/json';options.body=JSON.stringify(payload)}
 const response=await api.HTTP.request(payload?'POST':'GET',R.HOST+path,options);
 const value=response?.response??response;
 if(typeof value==='string')return JSON.parse(value);
 if(value&&typeof value==='object')return value;
 throw Error('پاسخ Ollama خالی بود.');
}
function renderModels(){const box=$('matrix-ai-models');box.replaceChildren();if(!models.length){box.appendChild(node('span','helper','مدل محلی پیدا نشد.'));return}
 for(const name of models){const button=node('button','matrix-filter'+(model===name?' active':''),name);button.type='button';button.setAttribute('aria-pressed',String(model===name));button.addEventListener('click',()=>{model=name;renderModels();state('مدل '+name+' انتخاب شد. متن به سرویس محلی ارسال خواهد شد، نه اینترنت.')});box.appendChild(button)}
}
async function checkModels(){if(busy)return;lock(true);try{
 if(root.AYINYAR_DEMO){models=['نمایش آزمایشی بدون مدل'];model=models[0];renderModels();state('پیش‌نمایش مستقل: استخراج با داده‌های فرضی شبیه‌سازی می‌شود و Ollama فراخوانی نمی‌شود.');return}
 const res=await localCall('/api/tags');models=(res.models||[]).map(x=>x.name||x.model).filter(x=>R.safeModel(x)&&!R.isEmbeddingName(x));
 if(!models.includes(model))model=models.find(x=>/^qwen3:4b/.test(x))||models[0]||'';renderModels();state(model?'Ollama محلی در دسترس است. مدل انتخاب‌شده: '+model:'سرویس پاسخ داد اما مدل متن قابل استفاده پیدا نشد.');
 }catch(e){state('اتصال Ollama برقرار نشد: '+String(e.message).slice(0,240),true)}finally{lock(false)}}
async function loadPDF(){if(busy)return;const row=selection();if(!row){state('ابتدا یک منبع از ماتریس باز کن.',true);return}lock(true);draft=[];$('matrix-ai-suggestions').replaceChildren();
 try{
  if(root.AYINYAR_DEMO){
   const doc={key:'DEMO001',attachmentKey:'SIMULATED',title:'مقاله کاملاً فرضی',pages:[{page:4,text:'هدف پژوهش بررسی رابطه میان چیدمان کلاس و مشارکت دانشجویان بود. روش تحقیق توصیفی و مبتنی بر مشاهده میدانی در محیط آموزشی بود. جامعه پژوهش دانشجویان داوطلب یک دانشگاه فرضی بودند. یافته‌های پژوهش افزایش مشارکت در چیدمان گروهی را نشان دادند. محدودیت پژوهش حجم نمونه کوچک و محدودیت مکانی مطالعه بود.'.repeat(4)}]};
   chunks=R.assembleIndex([doc]);sourceID=row.source.id;attachment={key:'SIMULATED'};$('matrix-ai-open-pdf').disabled=true;state('نمونه فرضی یک PDF صفحه‌بندی‌شده برای آزمون رابط آماده شد. این داده‌ها واقعی نیستند.');return;
  }
  const found=getAttachment(row);A.validateSource(row,found.attachment);
  const {doc,hasPages}=await readIndexedPDF(found.attachment,found.parent);
  chunks=R.assembleIndex([doc]);if(!chunks.length)throw Error('متن PDF برای استخراج کافی نیست.');
  attachment=found.attachment;sourceID=row.source.id;$('matrix-ai-open-pdf').disabled=false;
  state(`${chunks.length.toLocaleString('fa-IR')} قطعه از PDF «${doc.title}» خوانده شد. ${hasPages?'داده صفحه‌بندی‌شده موجود است؛ شماره صفحه بر اساس شماره صفحه PDF نمایش داده می‌شود.':'نمایه Zotero شماره صفحه دقیق ندارد؛ صفحه‌ها خالی می‌مانند تا دستی بررسی شوند.'} متن فقط در حافظه همین پنجره است.`);
 }catch(e){chunks=[];attachment=null;sourceID='';state('خواندن PDF موفق نشد: '+String(e.message).slice(0,340),true)}finally{lock(false)}}
async function openAttachment(){
 if(root.AYINYAR_DEMO){state('در پیش‌نمایش مرورگر پیوست Zotero واقعی وجود ندارد.');return;}
 if(!attachment||!selection()||selection().source.id!==sourceID){state('ابتدا پیوست مربوط به منبع فعلی را بخوان.',true);return}
 try{
   const pane=p();if(!pane)throw Error('پنجره Zotero در دسترس نیست.');
   if(typeof pane.selectItem==='function')await pane.selectItem(attachment.id);
   else if(typeof pane.itemsView?.selectItems==='function')await pane.itemsView.selectItems([attachment.id]);
   else throw Error('انتخاب پیوست در این نسخه Zotero پشتیبانی نمی‌شود.');
   root.opener?.focus?.();state('پیوست در Zotero انتخاب شد. PDF را از کتابخانه باز کن و صفحه و نقل‌قول را بررسی کن.');
 }catch(e){state('نمایش پیوست موفق نبود: '+String(e.message).slice(0,240),true)}
}
function demoResponse(excerpts){
 const c=excerpts[0];if(!c)return {message:{content:JSON.stringify({suggestions:[]})}};
 const fields=['aim','method','sample','findings','limitations'];const starts=['هدف پژوهش','روش تحقیق','جامعه پژوهش','یافته‌های پژوهش','محدودیت پژوهش'];
 const suggestions=fields.map((field,i)=>{const m=c.text.match(new RegExp(starts[i]+'[^.]{14,120}\\.'));return m?{field,text:'[پیشنهاد فرضی] '+m[0],quote:m[0],chunk_id:c.id}:null}).filter(Boolean);
 return {message:{content:JSON.stringify({suggestions})}};
}
function renderSuggestions(result){draft=result.accepted;const area=$('matrix-ai-suggestions');area.replaceChildren();$('matrix-ai-apply').disabled=!draft.length;
 if(!draft.length){area.appendChild(node('p','helper','هیچ پیشنهاد دارای نقل‌قول منطبق با متن اصلی تولید نشد؛ چیزی به ماتریس منتقل نشده است.'));return}
 for(let i=0;i<draft.length;i++){
  const d=draft[i],box=node('article','matrix-ai-item');
  const title=node('div','matrix-ai-head');const cb=node('input');cb.type='checkbox';cb.className='matrix-ai-choice';cb.dataset.aiIndex=String(i);cb.setAttribute('aria-label','انتخاب پیشنهاد '+A.LABELS[d.field]);title.appendChild(cb);title.appendChild(node('strong','',A.LABELS[d.field]));
  title.appendChild(node('span','matrix-ai-page',d.page?'شماره صفحه PDF: '+d.page:'صفحه نامشخص'));box.appendChild(title);
  box.appendChild(node('p','matrix-ai-proposal',d.text));box.appendChild(node('blockquote','',d.quote));
  box.appendChild(node('p','matrix-hint','تطبیق واژه‌به‌واژه در قطعه '+d.chunkId+' از فایل پیوست؛ این بررسی، صحت علمی یا معنای ادعا را تأیید نمی‌کند.'));
  area.appendChild(box);
 }
}
async function analyze(){if(busy)return;const row=selection();if(!row||row.source.id!==sourceID||!chunks.length){state('ابتدا PDF همین منبع را بخوان.',true);return}
 if(!root.AYINYAR_DEMO&&!model){state('ابتدا اتصال Ollama و مدل متنی را بررسی کن.',true);return}
 if(!$('matrix-ai-consent').checked){state('برای پردازش قطعات PDF توسط Ollama همین رایانه، رضایت را فعال کن.',true);return}
 lock(true);draft=[];$('matrix-ai-suggestions').replaceChildren();state('در حال بررسی قطعات متن و تولید پیشنهادها…');
 try{const excerpts=A.chooseChunks(chunks);if(!excerpts.length)throw Error('قطعه‌ای با متن کافی پیدا نشد.');
 const response=root.AYINYAR_DEMO?demoResponse(excerpts):await localCall('/api/chat',A.request(model,excerpts));
 if(selection()?.source.id!==sourceID)throw Error('منبع هنگام پردازش تغییر کرده است. دوباره آغاز کن.');
 const result=A.verify(A.parseResponse(response),excerpts);renderSuggestions(result);
 state(`${result.accepted.length} پیشنهاد با نقل‌قول موجود در متن PDF تطبیق یافت. ${result.rejectedCount} پیشنهاد بدون تطبیق یا نامعتبر حذف شد. برای ثبت، موارد را انتخاب و تأیید کن. هیچ متن تولیدشده‌ای خودکار ذخیره نشده است.`);
 }catch(e){state('استخراج پیشنهادی ناموفق بود: '+String(e.message).slice(0,300),true)}finally{lock(false);$('matrix-ai-apply').disabled=!draft.length}}
function apply(){const row=selection();if(!row||row.source.id!==sourceID||!draft.length){state('پیشنهاد مربوط به منبع فعلی نیست.',true);return}
 const list=[...document.querySelectorAll('.matrix-ai-choice:checked')].map(c=>draft[Number(c.dataset.aiIndex)]).filter(Boolean);
 if(!list.length){state('حداقل یک پیشنهاد را برای تأیید انتخاب کن.',true);return}
 if(!root.confirm('آیا این '+list.length+' پیشنهاد را به عنوان اطلاعات «بازبینی‌نشده توسط پژوهشگر» وارد ماتریس کنیم؟ فیلدهای از قبل پرشده جایگزین نخواهند شد.'))return;
 try{const info=root.AyinMatrixUI.applyAISuggestions(sourceID,list);state(`${info.fields} فیلد خالی و ${info.evidences} شاهد بازبینی‌نشده ثبت شد. ${info.skipped} مورد تکراری یا فیلد پر نادیده گرفته شد. لطفاً نقل‌قول، متن و صفحه را در PDF اصلی بازبینی کن.`);draft=[];$('matrix-ai-suggestions').replaceChildren();$('matrix-ai-apply').disabled=true}
 catch(e){state('ثبت تأییدشده انجام نشد: '+String(e.message).slice(0,250),true)}
}
function init(){if(ready||!$('matrix-ai-read'))return;ready=true;
 $('matrix-ai-read').addEventListener('click',loadPDF);$('matrix-ai-open-pdf').addEventListener('click',openAttachment);$('matrix-ai-check').addEventListener('click',checkModels);
 $('matrix-ai-analyze').addEventListener('click',analyze);$('matrix-ai-apply').addEventListener('click',apply);
 $('matrix-ai-apply').disabled=true;
 if(root.AYINYAR_DEMO)state('پیش‌نمایش: ابتدا منابع فرضی را اضافه کن؛ مدل و PDF نیز در این نسخه فقط شبیه‌سازی می‌شوند.');
}
root.AyinMatrixAI=Object.freeze({init,resetPreview,getAttachment,readIndexedPDF,localCall,demoResponse});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
