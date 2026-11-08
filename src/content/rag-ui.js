/* AyinYar 0.18.0 — local indexed-fulltext RAG user interface; Zotero 10 technical preview. */
(function(root){
'use strict';
if(typeof document==='undefined')return;
const C=root.AyinRAGCore, NS='http://www.w3.org/1999/xhtml';
const $=id=>document.getElementById(id);const z=()=>root.opener?.Zotero||root.Zotero;
const make=(tag,cls,label)=>{const e=document.createElementNS(NS,tag);if(cls)e.className=cls;if(label!==undefined)e.textContent=label;return e;};
let chunks=[],sources=[],models=[],activeModel='',embeddingModel='',last=null,working=false,lastQuestion='';
const set=(id,t)=>{if($(id))$(id).textContent=t;};
function pane(){return root.opener?.ZoteroPane||z()?.getActiveZoteroPane?.();}
async function localCall(path,body){if(!['/api/tags','/api/chat','/api/embed'].includes(path))throw new Error('آدرس محلی مجاز نیست.');const method=body?'POST':'GET',api=z();if(!api?.HTTP?.request)throw new Error('ماژول HTTP برنامه Zotero یافت نشد.');
 const opts={responseType:'json',timeout:path==='/api/tags'?12000:240000,headers:{Accept:'application/json'}};
 if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
 const response=await api.HTTP.request(method,C.HOST+path,opts);
 if(response?.response&&typeof response.response==='object')return response.response;
 if(typeof response?.response==='string')return JSON.parse(response.response);
 if(response&&typeof response==='object'&&response.models)return response;
 throw new Error('پاسخ سرویس محلی معتبر نیست.');}
function allSelectedPDFs(){const selected=pane()?.getSelectedItems?.()||[];const api=z(),seen=new Set(),found=[];
 function push(a,parent){if(!a||seen.has(a.id))return;const mime=String(a.attachmentContentType||'');if(!/pdf/i.test(mime)&&!/\.pdf$/i.test(String(a.attachmentFilename||'')))return;seen.add(a.id);found.push({attachment:a,parent:parent||api?.Items?.get?.(a.parentID)||null});}
 for(const item of selected){if(item?.isAttachment?.())push(item);else if(item?.isRegularItem?.())for(const id of item.getAttachments?.()||[]){try{push(api.Items.get(id),item);}catch(_){}}}
 return found.slice(0,C.MAX_DOCS);
}
async function readCachedPDF(info){const api=z(),a=info.attachment;
 // Prefer Zotero's own indexed full text. Return page data only if provided as numbered pages.
 const fulltext=api?.Fulltext;
 let data=null;
 for(const meth of ['getItemContent','getItemContentAsync']){
  if(typeof fulltext?.[meth]!=='function')continue;
  try{const x=await fulltext[meth](a.id);if(typeof x==='string'&&x.trim().length>50){data={content:x};break;}
   if(x&&typeof x==='object'&&typeof x.content==='string'&&x.content.trim().length>50){data=x;break;}}
  catch(_){/* Try the existing local cache next. */}
 }
 if(!data){
  const path=await a.getFilePathAsync?.();if(!path)throw new Error('فایل PDF این پیوست روی رایانه در دسترس نیست.');
  const tools=root.opener?.PathUtils||root.PathUtils;
  const dir=(tools?.parent?.(path))||String(path).replace(/[\\/][^\\/]+$/,'');
  const cache=dir&&(tools?.join?.(dir,'.zotero-ft-cache')||dir+(String(path).includes('\\')?'\\':'/')+'.zotero-ft-cache');
  if(!cache)throw new Error('مسیر نمایه متن PDF قابل تشخیص نیست.');
  let t;
  if(typeof api?.File?.getContentsAsync==='function')t=await api.File.getContentsAsync(cache);
  else throw new Error('خواننده نمایه محلی Zotero در دسترس نیست.');
  if(!t||String(t).trim().length<50)throw new Error('نمایه PDF خالی است؛ فایل را در Zotero مجدداً Reindex کن.');
  data={content:String(t)};
 }
 const raw=String(data.content||'');
 const pages=Array.isArray(data.pages)&&data.pages.every(x=>Number.isSafeInteger(x.page)&&x.page>=1&&typeof x.text==='string')?data.pages:null;
 const title=String(info.parent?.getField?.('title')||a.getField?.('title')||a.attachmentFilename||'منبع بدون عنوان');
 const parent=info.parent||a;return {key:parent.key||'',attachmentKey:a.key||'',title,Cached:true,text:pages?'':raw.slice(0,C.MAX_CHARS_PER_DOC),pages,reportedPages:Number(data.indexedPages)||null,totalPages:Number(data.totalPages)||null};
}
function reportSources(){const box=$('rag-sources');if(!box)return;box.replaceChildren();for(const s of sources){const line=make('div','rag-source');line.appendChild(make('strong','',s.title));line.appendChild(make('span','',`شناسه ${s.key||'—'} · ${s.length.toLocaleString('fa-IR')} نویسه · ${s.count.toLocaleString('fa-IR')} قطعه · ${s.hasPages?'صفحات تأییدشده':'شماره صفحات نامشخص'}`));box.appendChild(line);}}
async function indexSelected(){if(working)return;working=true;$('rag-load').disabled=true;set('rag-read-status','در حال خواندن نمایه‌های محلی PDF از Zotero…');
 try{const selection=allSelectedPDFs();if(!selection.length)throw new Error('یک یا چند منبع دارای PDF یا خود پیوست PDF را در Zotero انتخاب کن.');
  const docs=[],rejected=[];for(const info of selection){try{docs.push(await readCachedPDF(info));}catch(e){rejected.push(String(info.attachment.attachmentFilename||info.attachment.key)+' — '+String(e.message).slice(0,140));}}
  if(!docs.length)throw new Error('برای فایل‌های انتخاب‌شده متن نمایه‌شده پیدا نشد. '+rejected.join(' | '));
  const next=C.assembleIndex(docs);if(!next.length)throw new Error('متن قابل تقسیم به قطعات وجود ندارد.');
  chunks=next;sources=docs.map((d,i)=>({key:d.key,title:d.title,count:next.filter(x=>x.sourceNumber===i+1).length,length:d.text.length||d.pages?.reduce((sum,x)=>sum+x.text.length,0)||0,hasPages:!!d.pages}));
  reportSources();set('rag-read-status',`${sources.length} سند و ${chunks.length} قطعه متن آماده شد. ${rejected.length?'موارد غیرقابل خواندن: '+rejected.join('؛ '):''} متن فقط در حافظه همین پنجره نگهداری می‌شود.`);last=null;$('rag-save').disabled=true;$('rag-answer').textContent='';$('rag-evidence').replaceChildren();
 }catch(e){set('rag-read-status','خواندن PDF موفق نبود: '+String(e.message).slice(0,380));}finally{working=false;$('rag-load').disabled=false;}}
function drawModels(){const target=$('rag-models');target.replaceChildren();for(const name of models.filter(x=>!C.isEmbeddingName(x))){const b=make('button','ai-model',name);b.type='button';b.classList.toggle('is-selected',name===activeModel);b.setAttribute('aria-pressed',String(name===activeModel));b.addEventListener('click',()=>{activeModel=name;drawModels();set('rag-model-status','مدل تحلیل '+name+' انتخاب شد.');});target.appendChild(b);}}
async function check(){if(working)return;working=true;$('rag-check').disabled=true;try{const response=await localCall('/api/tags');models=(response.models||[]).map(x=>x.name||x.model).filter(C.safeModel);if(!models.includes(activeModel))activeModel=models.find(x=>/^qwen3:4b/.test(x))||models.find(x=>!C.isEmbeddingName(x))||'';embeddingModel=models.find(C.isEmbeddingName)||'';drawModels();
 set('rag-model-status',activeModel?`Ollama متصل است؛ مدل متنی ${activeModel}. ${embeddingModel?'جست‌وجوی معنایی اختیاری: '+embeddingModel:'جست‌وجوی واژگانی فعال؛ برای جست‌وجوی معنایی می‌توانی بعداً مدل bge-m3 را نصب کنی.'}`:'Ollama پاسخ داد، اما مدل متنی محلی پیدا نشد.');}
 catch(e){models=[];activeModel='';embeddingModel='';drawModels();set('rag-model-status','اتصال ممکن نشد: '+e.message);}finally{working=false;$('rag-check').disabled=false;}}
function displayEvidence(list){const box=$('rag-evidence');box.replaceChildren();if(!list.length){box.textContent='مدل شناسه شاهد قابل تأیید ارائه نکرد؛ پاسخ را بدون استناد معتبر تلقی نکن.';return;}
 for(const e of list){const div=make('div','rag-evidence-card'),header=make('strong','',`[${e.id}] ${e.sourceTitle} · ${e.page===null?'شماره صفحه نامشخص':'صفحه '+e.page}`);div.appendChild(header);div.appendChild(make('p','',e.text.slice(0,650)));box.appendChild(div);}}
async function ask(){if(working)return;const q=String($('rag-question').value||'').trim();if(q.length<8){set('rag-answer-status','یک سؤال پژوهشی دقیق‌تر بنویس.');return;}if(!chunks.length){set('rag-answer-status','ابتدا PDFها را از Zotero بخوان.');return;}
 if(!activeModel){set('rag-answer-status','ابتدا اتصال Ollama و مدل متنی را بررسی کن.');return;}
 if(!$('rag-consent').checked){set('rag-answer-status','برای ارسال قطعات بازیابی‌شده فقط به Ollama محلی رضایت بده.');return;}
 working=true;$('rag-ask').disabled=true;$('rag-save').disabled=true;set('rag-answer-status','در حال انتخاب قطعات مرتبط و ساخت پاسخ محلی…');$('rag-answer').textContent='';$('rag-evidence').replaceChildren();
 try{let candidates=C.lexicalRank(chunks,q,embeddingModel?16:7),ranked=candidates;
  if(embeddingModel&&candidates.length){try{const reply=await localCall('/api/embed',{model:embeddingModel,input:[q,...candidates.map(x=>x.text)],truncate:true,keep_alive:'30s'});ranked=C.semanticRank(candidates,reply.embeddings,7);}
   catch(err){set('rag-answer-status','جست‌وجوی معنایی در دسترس نبود؛ جست‌وجوی متنی ادامه پیدا می‌کند: '+String(err.message).slice(0,120));ranked=candidates.slice(0,7);}}
  const evidence=ranked.slice(0,7).map(x=>({id:x.id,sourceTitle:x.sourceTitle,sourceKey:x.sourceKey,attachmentKey:x.attachmentKey,page:x.page,text:x.text}));if(!evidence.length)throw new Error('برای سؤال شما هیچ قطعه مرتبطی پیدا نشد. سؤال را با اصطلاحات موجود در مقاله دقیق‌تر کن.');
  const response=await localCall('/api/chat',C.chatRequest(activeModel,q,evidence));last=C.normalizeAnswer(response,evidence);lastQuestion=q;
  $('rag-answer').textContent=last.answer;displayEvidence(last.evidence);set('rag-answer-status',`پاسخ تولید شد؛ ${last.evidence.length} شناسه شاهد واقعی به آن متصل است. ${last.unverifiedIds.length?'شناسه‌های ساختگی مدل حذف شدند.':''} هر ادعا را با متن اصلی بررسی کن.`);
  $('rag-save').disabled=false;
 }catch(e){set('rag-answer-status','پاسخ تولید نشد: '+String(e.message).slice(0,320));}
 finally{working=false;$('rag-ask').disabled=false;}}
async function save(){if(!last||!sources.length)return;if(!root.confirm('آیا می‌خواهی این پاسخ تولیدشده با AI و شواهد قابل بازیابی را به‌صورت یادداشت Zotero زیر منبع اول ذخیره کنی؟ صحت ادعاها خودکار تأیید نشده است.'))return;
 try{const api=z(),p=pane(),item=(p?.getSelectedItems?.()||[]).find(x=>x?.isRegularItem?.());if(!item)throw new Error('برای ذخیره یک منبع اصلی Zotero انتخاب کن.');const note=new api.Item('note');note.libraryID=item.libraryID;note.parentID=item.id;note.setNote(C.noteHTML(lastQuestion,last));await note.saveTx();set('rag-answer-status','یادداشت با تأیید شما ذخیره شد. مقاله‌ها و فایل‌های PDF تغییر نکردند.');}
 catch(e){set('rag-answer-status','ذخیره ناموفق بود: '+String(e.message).slice(0,250));}}
function init(){if(!$('rag-load'))return;$('rag-load').addEventListener('click',indexSelected);$('rag-check').addEventListener('click',check);$('rag-ask').addEventListener('click',ask);$('rag-save').addEventListener('click',save);
 if(root.AYINYAR_DEMO){const docs=[{number:1,key:'DEMO001',title:'نمونه فضاهای جمعی',text:'این مقاله با مشاهده میدانی اثر انعطاف‌پذیری فضا بر تعاملات اجتماعی را بررسی می‌کند. نتایج نشان می‌دهند تنوع فعالیت‌ها با الگوی نشستن و گردش افراد مرتبط است.\n'.repeat(20)}];chunks=C.assembleIndex(docs);sources=[{key:'DEMO001',title:docs[0].title,count:chunks.length,length:docs[0].text.length,hasPages:false}];reportSources();set('rag-read-status','داده نمایشی بارگذاری شد. در Zotero متن نمایه‌شده پیوست‌های انتخاب‌شده استفاده می‌شود.');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
