/* AyinYar 0.21.2 — consented sequential multi-paper extraction and comparison.
 * Drafts exist in memory only until the user individually selects and confirms them.
 */
(function(root){
'use strict';
const B=root.AyinMatrixBatchCore,A=root.AyinMatrixAICore,R=root.AyinRAGCore;
const $=id=>document.getElementById(id),NS='http://www.w3.org/1999/xhtml';
const ui=()=>root.AyinMatrixUI,ai=()=>root.AyinMatrixAI;
let picked=new Set(),results=[],model='',models=[],running=false,cancelRequested=false,report=null,ready=false,checkedDrafts=new Set();
const make=(tag,cls,txt)=>{const e=document.createElementNS(NS,tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e};
const put=(id,txt)=>{const e=$(id);if(e)e.textContent=txt};
function status(msg,error=false){const e=$('matrix-batch-status');if(e){e.textContent=msg;e.classList.toggle('error',error)}}
function getRows(){return ui()?.getRows?.()||[]}
function eligible(rows){return rows.filter(r=>root.AYINYAR_DEMO?true:(Number.isSafeInteger(r.source.zoteroItemID)&&r.source.zoteroItemID>0))}
function selection(){return [...picked]}
function refreshList(){
 const list=$('matrix-batch-list');if(!list)return;
 const eligibleRows=eligible(getRows());const valid=new Set(eligibleRows.map(r=>r.source.id));
 picked=new Set([...picked].filter(x=>valid.has(x)));
 list.replaceChildren();
 if(!eligibleRows.length){list.appendChild(make('p','helper',root.AYINYAR_DEMO?'ابتدا روی «افزودن نمونه‌های فرضی» کلیک کن، سپس «بازخوانی منابع» را بزن.':'ابتدا چند منبع PDFدار از Zotero به ماتریس وارد کن. فقط منابع واقعی Zotero در صف پردازش پذیرفته می‌شوند.'));}
 for(const row of eligibleRows){
  const label=make('label','matrix-batch-source');const cb=make('input');cb.type='checkbox';cb.checked=picked.has(row.source.id);cb.disabled=running||(!cb.checked&&picked.size>=B.MAX_BATCH);
  cb.addEventListener('change',()=>{if(cb.checked){if(picked.size>=B.MAX_BATCH){cb.checked=false;status('در هر نوبت حداکثر هشت منبع مجاز است.',true);return}picked.add(row.source.id)}else picked.delete(row.source.id);refreshList()});
  const text=make('span');text.appendChild(make('strong','',row.source.title));text.appendChild(make('small','',row.source.authors+(row.source.year?' · '+row.source.year:'')));
  label.append(cb,text);list.appendChild(label);
 }
 put('matrix-batch-count',picked.size.toLocaleString('fa-IR')+' از '+B.MAX_BATCH.toLocaleString('fa-IR')+' منبع انتخاب شده');
 $('matrix-batch-start').disabled=running||picked.size===0;
 $('matrix-batch-compare').disabled=running||picked.size===0;
 $('matrix-batch-select-eight').disabled=running||!eligibleRows.length;
 $('matrix-batch-refresh').disabled=running;
}
function modelButtons(){const list=$('matrix-batch-models');list.replaceChildren();
 if(!models.length){list.appendChild(make('span','matrix-hint','مدلی انتخاب نشده است؛ دکمه «بررسی مدل‌های محلی» را بزن.'));return}
 for(const name of models){const b=make('button','matrix-filter'+(model===name?' active':''),name);b.type='button';b.setAttribute('aria-pressed',String(model===name));b.disabled=running;
  b.addEventListener('click',()=>{model=name;modelButtons();status('مدل محلی انتخاب شد: '+name)});list.appendChild(b)}
}
async function checkModels(){if(running)return;$('matrix-batch-check').disabled=true;
 try{
  if(root.AYINYAR_DEMO){models=['شبیه‌ساز آموزشی'];model=models[0];modelButtons();status('حالت پیش‌نمایش: هیچ درخواست واقعی به Ollama یا Zotero ارسال نمی‌شود.');return}
  const res=await ai().localCall('/api/tags');
  models=(res.models||[]).map(x=>x.name||x.model).filter(n=>R.safeModel(n)&&!R.isEmbeddingName(n)&&!/cloud|remote/i.test(n));
  if(!models.includes(model))model=models.find(x=>/^qwen3:4b/.test(x))||models[0]||'';
  modelButtons();status(models.length?'تعداد '+models.length+' مدل محلی قابل استفاده یافت شد.':'مدل محلی متنی یافت نشد.',!models.length);
 }catch(e){status('Ollama در دسترس نیست: '+String(e.message).slice(0,200),true)}finally{$('matrix-batch-check').disabled=false}
}
function demonstrationDocument(row,index){
 const texts=[
  'هدف پژوهش بررسی تأثیر چیدمان فضا بر مشارکت گروهی بود. روش تحقیق مشاهده میدانی در کلاس های آموزشی بود. جامعه پژوهش دانشجویان داوطلب در محیط های یادگیری بودند. یافته‌های پژوهش افزایش تعامل در گروه های کوچک را نشان دادند. محدودیت پژوهش نمونه کم و موقعیت مکانی محدود بود.',
  'هدف پژوهش تحلیل تجربه دانشجویان از یادگیری مشارکتی بود. روش تحقیق مصاحبه کیفی با شرکت کنندگان بود. جامعه پژوهش دانشجویان چند کلاس مختلف بودند. یافته‌های پژوهش تفاوت تجربه تعامل در فضاهای گوناگون را نشان دادند. محدودیت پژوهش خودگزارشی شرکت کنندگان بود.',
  'هدف پژوهش مرور تصمیم گیری طراحی براساس شواهد بود. روش تحقیق مرور منابع و تحلیل اسناد بود. جامعه پژوهش اسناد طراحی فضاهای آموزشی بود. یافته‌های پژوهش نیاز به ثبت شواهد معتبر را نشان دادند. محدودیت پژوهش پراکندگی منابع مورد بررسی بود.'
 ];
 return {key:row.source.id,attachmentKey:'DEMO_'+index,title:row.source.title,pages:[{page:index+3,text:(texts[index%3]+' ').repeat(5)}]};
}
async function processOne(row,index){
 let chunks;
 if(root.AYINYAR_DEMO){chunks=R.assembleIndex([demonstrationDocument(row,index)]);}else{
  const found=ai().getAttachment(row);A.validateSource(row,found.attachment);
  const pdf=await ai().readIndexedPDF(found.attachment,found.parent);
  chunks=R.assembleIndex([pdf.doc]);
 }
 if(!chunks?.length)throw Error('متن نمایه‌شده PDF در دسترس نیست.');
 const excerpts=A.chooseChunks(chunks);if(!excerpts.length)throw Error('قطعه متنی کافی برای استخراج پیدا نشد.');
 const response=root.AYINYAR_DEMO?ai().demoResponse(excerpts):await ai().localCall('/api/chat',A.request(model,excerpts));
 return A.verify(A.parseResponse(response),excerpts);
}
function locked(value){running=value;
 for(const id of ['matrix-batch-start','matrix-batch-check','matrix-batch-select-eight','matrix-batch-refresh','matrix-batch-clear','matrix-batch-approve','matrix-batch-compare','matrix-batch-export-html','matrix-batch-export-csv']){$(id).disabled=value}
 $('matrix-batch-cancel').disabled=!value;
 refreshList();modelButtons();
}
async function run(){if(running)return;
 let targets;try{targets=B.selection(getRows(),selection(),Boolean(root.AYINYAR_DEMO));}catch(e){status(e.message,true);return}
 if(!root.AYINYAR_DEMO&&!model){status('ابتدا مدل Ollama محلی را انتخاب کن.',true);return}
 if(!$('matrix-batch-consent').checked){status('اجازه ارسال قطعات همین PDFها به Ollama محلی را فعال کن.',true);return}
 const ids=targets.map(x=>x.source.id);results=[];checkedDrafts.clear();cancelRequested=false;
 locked(true);renderResults();report=null;$('matrix-batch-report').replaceChildren();
 let ok=0,fail=0;try{
  for(let i=0;i<targets.length;i++){
   if(cancelRequested)break;
   const row=targets[i],item={sourceID:row.source.id,title:row.source.title,accepted:[],rejectedCount:0,status:'running',error:'',appliedIndices:new Set()};
   results.push(item);renderResults();put('matrix-batch-progress',`مقاله ${i+1} از ${targets.length}: ${row.source.title}`);
   try{const data=await processOne(row,i);item.accepted=data.accepted;item.rejectedCount=data.rejectedCount;item.status=data.accepted.length?'ready':'empty';ok++;}
   catch(e){item.error=String(e.message).slice(0,230);item.status='error';fail++;}
   renderResults();$('matrix-batch-bar').style.width=(((i+1)/targets.length)*100).toFixed(1)+'%';
  }
  const suffix=cancelRequested?' پردازش به درخواست کاربر پس از مقاله جاری متوقف شد.':'';
  status(`${ok} مقاله پردازش شد؛ ${fail} خطا؛ ${results.reduce((n,x)=>n+x.accepted.length,0)} پیشنهاد دارای نقل‌قول تطبیق‌یافته آماده بازبینی است. هیچ پیشنهادی خودکار ذخیره نشده.${suffix}`);
 }finally{locked(false);put('matrix-batch-progress',cancelRequested?'متوقف‌شده':'پردازش پایان یافت');$('matrix-batch-approve').disabled=!checkedDrafts.size;$('matrix-batch-cancel').disabled=true;}
}
function renderResults(){const list=$('matrix-batch-results');list.replaceChildren();
 if(!results.length){list.appendChild(make('p','helper','پس از اجرای استخراج، پیشنهادهای هر مقاله جداگانه نمایش داده می‌شوند.'));return}
 for(const item of results){
  const card=make('details','matrix-batch-result');card.open=item.status==='ready'||item.status==='partial'||item.status==='error';const head=make('summary');
  head.appendChild(make('strong','',item.title));head.appendChild(make('span','matrix-batch-pill '+item.status,({running:'در حال پردازش',ready:'آماده بازبینی',partial:'بخشی ثبت شده',empty:'بدون پیشنهاد منطبق',error:'خطا',approved:'ثبت شد'})[item.status]||''));card.appendChild(head);
  if(item.error)card.appendChild(make('p','matrix-batch-error',item.error));
  if(item.rejectedCount)card.appendChild(make('p','matrix-hint',item.rejectedCount+' پیشنهاد نامعتبر یا بدون نقل‌قول منطبق رد شد.'));
  for(let i=0;i<item.accepted.length;i++){
   const d=item.accepted[i],key=item.sourceID+'|'+i;
   const box=make('label','matrix-batch-draft');const cb=make('input');cb.type='checkbox';cb.checked=checkedDrafts.has(key);cb.disabled=item.appliedIndices.has(i);
   cb.addEventListener('change',()=>{cb.checked?checkedDrafts.add(key):checkedDrafts.delete(key);$('matrix-batch-approve').disabled=!checkedDrafts.size||running});
   const content=make('span');content.appendChild(make('strong','',A.LABELS[d.field]+' · '+(d.page?'صفحه PDF '+d.page:'صفحه نامشخص')));
   content.appendChild(make('span','matrix-batch-draft-text',d.text));content.appendChild(make('blockquote','',d.quote));
   box.append(cb,content);card.appendChild(box);
  }
  if(item.status==='empty')card.appendChild(make('p','matrix-hint','این مقاله شواهد قابل تطبیق تولید نکرد؛ PDF یا نمایه متن آن را بررسی کن.'));
  list.appendChild(card);
 }
 $('matrix-batch-approve').disabled=running||!checkedDrafts.size;
}
function approve(){if(running||!checkedDrafts.size)return;
 const choices=results.map(item=>({item,indices:item.accepted.map((_,i)=>i).filter(i=>checkedDrafts.has(item.sourceID+'|'+i)&&!item.appliedIndices.has(i))})).filter(x=>x.indices.length);
 if(!choices.length)return;
 const n=choices.reduce((a,x)=>a+x.indices.length,0);
 if(!root.confirm(`آیا ${n} پیشنهاد انتخاب‌شده را به عنوان اطلاعات بازبینی‌نشده وارد ماتریس کنیم؟ اطلاعات قبلی بازنویسی نمی‌شوند و فقط منابع متناظر تغییر می‌کنند.`))return;
 let fields=0,evidences=0,failures=[];
 for(const x of choices){try{
   const output=ui().applyAISuggestionsToSource(x.item.sourceID,x.indices.map(i=>x.item.accepted[i]));fields+=output.fields;evidences+=output.evidences;
   for(const i of x.indices){checkedDrafts.delete(x.item.sourceID+'|'+i);x.item.appliedIndices.add(i)}
   x.item.status=x.item.appliedIndices.size===x.item.accepted.length?'approved':'partial';
  }catch(e){failures.push(x.item.title+': '+String(e.message).slice(0,90))}}
 renderResults();status(`${fields} فیلد خالی و ${evidences} شاهد با برچسب «نیازمند بررسی» ثبت شد. ${failures.length?'خطا در '+failures.length+' منبع: '+failures.join('؛ '):'برای استناد علمی، حتماً PDF اصلی را بازبینی کن.'}`,!!failures.length);
}
function buildReport(){if(running)return;
 try{report=B.report(getRows(),selection());renderReport(report);status('گزارش تطبیقی صرفاً از داده‌های ذخیره‌شده همین منابع ساخته شد؛ پیشنهادهای تأییدنشده وارد گزارش نشدند.');}
 catch(e){status('ساخت گزارش ممکن نشد: '+e.message,true)}
}
function renderReport(rep){const area=$('matrix-batch-report');area.replaceChildren();
 const head=make('div','matrix-batch-stats');for(const [value,label] of [[rep.totals.sources,'منبع'],[rep.totals.evidences,'شاهد ثبت‌شده'],[rep.totals.pending,'شاهد نیازمند بازبینی']]){const box=make('div');box.appendChild(make('strong','',value.toLocaleString('fa-IR')));box.appendChild(make('small','',label));head.appendChild(box)}area.appendChild(head);
 area.appendChild(make('h4','','پوشش اطلاعات پنج محور'));
 const coverage=make('div','matrix-batch-coverage');for(const f of rep.coverage){const item=make('div');item.appendChild(make('span','',f.label));item.appendChild(make('strong','',f.present+' / '+f.total));coverage.appendChild(item)}area.appendChild(coverage);
 const wrap=make('div','matrix-batch-report-wrap'),table=make('table','matrix-batch-table'),thead=make('thead'),tr=make('tr');
 for(const x of ['منبع',...B.FIELDS.map(k=>B.LABELS[k]),'شواهد','موارد خالی'])tr.appendChild(make('th','',x));thead.appendChild(tr);table.appendChild(thead);
 const body=make('tbody');for(const e of rep.entries){const row=make('tr');for(const x of [e.title+' ('+e.year+')',...B.FIELDS.map(k=>e.fields[k]||'—'),e.reviewed+' / '+e.evidenceCount,e.missing.map(k=>B.LABELS[k]).join('، ')||'—'])row.appendChild(make('td','',x));body.appendChild(row)}table.appendChild(body);wrap.appendChild(table);area.appendChild(wrap);
 area.appendChild(make('h4','','نشانه‌های هم‌پوشانی صرفاً واژگانی'));
 area.appendChild(make('p','matrix-hint',rep.sharedTerms.length?rep.sharedTerms.map(t=>t.term+' ('+t.count+' مقاله)').join(' · '):'واژه مشترک برجسته‌ای شناسایی نشد.'));
 area.appendChild(make('p','matrix-batch-warning',rep.disclaimer));
 $('matrix-batch-export-html').disabled=false;$('matrix-batch-export-csv').disabled=false;
}
function clear(){if(running)return;results=[];checkedDrafts.clear();report=null;$('matrix-batch-bar').style.width='0%';$('matrix-batch-report').replaceChildren();$('matrix-batch-results').replaceChildren();$('matrix-batch-export-html').disabled=true;$('matrix-batch-export-csv').disabled=true;$('matrix-batch-approve').disabled=true;status('پیش‌نویس‌های این جلسه پاک شدند؛ اطلاعات ثبت‌شده ماتریس دست‌نخورده باقی مانده‌اند.');}
function selectEight(){const rows=eligible(getRows());picked=new Set(rows.slice(0,B.MAX_BATCH).map(r=>r.source.id));refreshList()}
function init(){if(ready||!$('matrix-batch-panel'))return;ready=true;
 $('matrix-batch-refresh').addEventListener('click',refreshList);
 $('matrix-batch-select-eight').addEventListener('click',selectEight);
 $('matrix-batch-check').addEventListener('click',checkModels);
 $('matrix-batch-start').addEventListener('click',run);
 $('matrix-batch-cancel').addEventListener('click',()=>{cancelRequested=true;status('توقف درخواست شد؛ در صورت انجام فراخوانی Ollama، پس از پایان همان مقاله متوقف می‌شود.')});
 $('matrix-batch-approve').addEventListener('click',approve);
 $('matrix-batch-clear').addEventListener('click',clear);
 $('matrix-batch-compare').addEventListener('click',buildReport);
 $('matrix-batch-export-html').addEventListener('click',()=>{if(report)ui().saveExport('AyinYar-Comparative-Report.html',B.html(report),'html','text/html;charset=utf-8')});
 $('matrix-batch-export-csv').addEventListener('click',()=>{if(report)ui().saveExport('AyinYar-Comparative-Report.csv',B.csv(report),'csv','text/csv;charset=utf-8')});
 $('matrix-batch-cancel').disabled=true;$('matrix-batch-approve').disabled=true;
 $('matrix-batch-export-html').disabled=true;$('matrix-batch-export-csv').disabled=true;
 refreshList();modelButtons();
}
root.AyinMatrixBatch=Object.freeze({init,refreshList,getResults:()=>results.map(x=>({sourceID:x.sourceID,status:x.status,count:x.accepted.length})),getReport:()=>report});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
