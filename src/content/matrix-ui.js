/* AyinYar 0.21.0 — evidence matrix UI. No Zotero library modifications. */
(function(root){
 'use strict';
 const M=root.AyinMatrixCore, PREF='extensions.ayinyar.review.matrix.v1';
 const $=id=>document.getElementById(id);
 const fkeys=Object.keys(M.FIELDS), ns='http://www.w3.org/1999/xhtml';
 let rows=[],selected='',filter='all',stance='unreviewed',saving=null,ready=false,saveOK=true,matrixPage=0,editingEvidenceID='',storageBlocked=false;
 let demoMemory='';
 function text(message,error=false){let el=$('matrix-status');if(!el)return;el.textContent=message;el.classList.toggle('error',error)}
 function create(tag,className,content){const el=document.createElementNS(ns,tag);if(className)el.className=className;if(content!==undefined)el.textContent=String(content);return el}
 function storageRead(){
   if(root.AYINYAR_DEMO){try{return root.localStorage?.getItem(PREF)||demoMemory}catch(_){return demoMemory}}
   return root.AyinPrefs.read(PREF,'');
 }
 function storageWrite(value){
   if(root.AYINYAR_DEMO){demoMemory=value;try{root.localStorage?.setItem(PREF,value)}catch(_){}return true}
   return root.AyinPrefs.write(PREF,value);
 }
 function persist(notice=''){
   if(saving){clearTimeout(saving);saving=null}
   try{
     if(storageBlocked)throw Error('ذخیره قبلی قابل خواندن نیست؛ ابتدا فایل پشتیبان معتبر را بازیابی کن.');
     const json=JSON.stringify(M.wrap(rows));
     if(json.length>480000)throw Error('حجم یادداشت‌ها به سقف ذخیره محلی نزدیک شده است؛ ابتدا خروجی JSON بگیر و بخشی از منابع را حذف کن.');
     if(storageWrite(json)===false)throw Error('تنظیمات محلی اجازه نوشتن نداد.');saveOK=true;
     if(notice)text(notice);
     return true;
   }catch(e){saveOK=false;text('ذخیره محلی ناموفق بود: '+e.message+' — برای حفظ داده‌ها خروجی JSON بگیر.',true);return false}
 }
 function schedule(){if(saving)clearTimeout(saving);saving=setTimeout(()=>{syncFields();persist('تغییرات یادداشت‌ها روی دستگاه ذخیره شد.');renderList();updateSummary()},750)}
 function current(){return rows.find(r=>r.source.id===selected)}
 function syncFields(){const r=current();if(!r||!$('matrix-editor-body')||$('matrix-editor-body').hidden)return;
   for(const k of fkeys){const el=$('matrix-'+k);if(el)r.fields[k]=M.clip(el.value,M.FIELDS[k])}
   r.updatedAt=new Date().toISOString();
 }
 function updateSummary(){const sum=M.summary(rows);[['matrix-count',sum.sources],['matrix-notes-count',sum.notes],['matrix-evidence-count',sum.evidences],['matrix-reviewed-count',sum.checked]].forEach(([k,v])=>{if($(k))$(k).textContent=String(v).toLocaleString('fa-IR')})}
 function filteredRows(){
   const term=String($('matrix-search')?.value||'').trim().toLocaleLowerCase();
   return rows.filter(r=>{
     if(term&&![r.source.title,r.source.authors,r.source.doi,r.source.year,...Object.values(r.fields)].join(' ').toLocaleLowerCase().includes(term))return false;
     if(filter==='annotated')return Object.values(r.fields).some(Boolean);
     if(filter==='evidenced')return r.evidence.length>0;
     if(filter==='pending')return r.evidence.length===0||r.evidence.some(e=>!M.isChecked(e));
     return true;
   });
 }
 function renderList(){
   const list=$('matrix-list');if(!list)return;list.replaceChildren();
   const found=filteredRows();renderOverview(found);
   $('matrix-filter-count').textContent=found.length.toLocaleString('fa-IR')+' از '+rows.length.toLocaleString('fa-IR')+' منبع';
   if(!found.length){list.appendChild(create('p','helper',rows.length?'هیچ موردی با این فیلتر پیدا نشد.':'هنوز منبعی ثبت نشده است. ابتدا رکوردهای Zotero را انتخاب کن یا منبع دستی بساز.'));return}
   for(const r of found){
     const card=create('article','matrix-source'+(r.source.id===selected?' active':''));
     card.appendChild(create('div','matrix-source-title',r.source.title));
     card.appendChild(create('div','matrix-source-meta',[r.source.authors,r.source.year,r.source.doi&&'DOI: '+r.source.doi].filter(Boolean).join(' · ')));
     const count=r.evidence.length+' شاهد · '+Object.values(r.fields).filter(Boolean).length+' یادداشت';card.appendChild(create('div','matrix-hint',count));
     const actions=create('div','matrix-source-actions');const button=create('button','matrix-mini-btn','ویرایش و شواهد');button.type='button';button.addEventListener('click',()=>select(r.source.id));actions.appendChild(button);
     card.appendChild(actions);list.appendChild(card)
   }
 }
 function renderOverview(found){
   const body=$('matrix-overview-body');if(!body)return;body.replaceChildren();
   const per=25,pages=Math.max(1,Math.ceil(found.length/per));matrixPage=Math.min(matrixPage,pages-1);
   const displayed=found.slice(matrixPage*per,(matrixPage+1)*per);
   if(!displayed.length){const tr=create('tr'),td=create('td','empty','برای مشاهده مقایسه، منابعی را به ماتریس اضافه کن.');td.setAttribute('colspan','7');tr.appendChild(td);body.appendChild(tr)}
   for(const r of displayed){
     const tr=create('tr');
     const values=[r.source.title+' ('+(r.source.year||'—')+')',r.fields.aim,r.fields.method,r.fields.findings,[r.fields.limitations,r.fields.gap].filter(Boolean).join(' / '),String(r.evidence.filter(M.isChecked).length)+' / '+String(r.evidence.length)];
     for(let i=0;i<values.length;i++){const td=create('td',i===0?'matrix-tbl-source':'',values[i]||'—');tr.appendChild(td)}
     const action=create('td'),button=create('button','matrix-mini-btn','ویرایش');button.type='button';button.addEventListener('click',()=>{select(r.source.id);$('matrix-editor')?.scrollIntoView({behavior:'smooth',block:'start'})});action.appendChild(button);tr.appendChild(action);body.appendChild(tr)
   }
   $('matrix-page-number').textContent='صفحه '+(matrixPage+1)+' از '+pages+' · '+found.length+' منبع';
   $('matrix-prev-page').disabled=matrixPage<=0;$('matrix-next-page').disabled=matrixPage>=pages-1;
 }
 function setStance(value){stance=M.STANCES.includes(value)?value:'unreviewed';document.querySelectorAll('[data-matrix-stance]').forEach(b=>{const a=b.dataset.matrixStance===stance;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a))})}
 function select(id){
   if(saving){syncFields();persist();}
   else if(selected&&selected!==id){syncFields();persist()}
   const r=rows.find(x=>x.source.id===id);if(!r)return;
   if(selected!==id)root.AyinMatrixAI?.resetPreview?.();
   selected=id;$('matrix-empty-editor').hidden=true;$('matrix-editor-body').hidden=false;
   $('matrix-editor-title').textContent=r.source.title;
   $('matrix-editor-meta').textContent=[r.source.authors,r.source.year,r.source.type,r.source.doi&&'DOI: '+r.source.doi].filter(Boolean).join(' · ');
   $('matrix-abstract-text').textContent=r.source.abstract||'چکیده‌ای در فراداده این رکورد وجود ندارد.';
   $('matrix-zotero-jump').hidden=!(r.source.zoteroItemID>0&&!root.AYINYAR_DEMO);
   for(const k of fkeys)$('matrix-'+k).value=r.fields[k]||'';
   clearEvidenceForm();renderEvidence();renderList();
 }
 function clearEvidenceForm(){editingEvidenceID='';$('matrix-add-evidence').textContent='ثبت شاهد در این منبع';for(const k of ['claim','quote','page','evidence-comment'])$('matrix-'+k).value='';setStance('unreviewed')}
 function renderEvidence(){const r=current(),node=$('matrix-evidence-list');if(!node)return;node.replaceChildren();if(!r)return;
   if(!r.evidence.length){node.appendChild(create('p','helper','هنوز شاهدی برای این منبع ثبت نشده است.'));return}
   for(const evidence of r.evidence){
     const box=create('article','matrix-evidence-item');const head=create('div','matrix-section-title');head.appendChild(create('strong','',evidence.claim||'ادعای ثبت‌نشده'));
     const tag=create('span','matrix-stamp'+(M.isChecked(evidence)?' checked':''),M.STATUS_LABELS[evidence.stance]);head.appendChild(tag);box.appendChild(head);
     const q=create('blockquote','',evidence.quote||'— نقل‌قول ثبت نشده —');box.appendChild(q);
     box.appendChild(create('p','matrix-hint','صفحه: '+(evidence.page||'نامشخص')+(evidence.origin?.kind==='local-ai'?' · پیشنهاد مبتنی بر متن PDF (بازبینی انسانی لازم)':'')+(evidence.comment?' · '+evidence.comment:'')));
     const action=create('div','matrix-source-actions');const edit=create('button','matrix-mini-btn','ویرایش شاهد');edit.type='button';edit.addEventListener('click',()=>{editingEvidenceID=evidence.id;$('matrix-claim').value=evidence.claim;$('matrix-quote').value=evidence.quote;$('matrix-page').value=evidence.page;$('matrix-evidence-comment').value=evidence.comment;setStance(evidence.stance);$('matrix-add-evidence').textContent='ذخیره تغییرات شاهد';$('matrix-claim').focus()});action.appendChild(edit);const rm=create('button','matrix-mini-btn matrix-danger','حذف شاهد');rm.type='button';rm.addEventListener('click',()=>{if(!root.confirm('این شاهد فقط از ماتریس حذف شود؟'))return;r.evidence=r.evidence.filter(e=>e.id!==evidence.id);persist('شاهد از ماتریس حذف شد.');renderEvidence();updateSummary();renderList()});action.appendChild(rm);box.appendChild(action);node.appendChild(box)
   }
 }
 function addEvidence(){const r=current();if(!r){text('ابتدا یک منبع انتخاب کن.',true);return}
   syncFields();if(!editingEvidenceID&&r.evidence.length>=M.MAX_EVIDENCE){text('حداکثر ۱۲ شاهد برای هر منبع مجاز است.',true);return}
   try{
     const previous=editingEvidenceID?r.evidence.find(x=>x.id===editingEvidenceID):null;
     const ev=M.normalizeEvidence({id:editingEvidenceID||('e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),claim:$('matrix-claim').value,quote:$('matrix-quote').value,page:$('matrix-page').value,stance,comment:$('matrix-evidence-comment').value,origin:previous?.quote===$('matrix-quote').value.trim()?previous?.origin:null});
     if(!ev.claim)throw Error('برای ثبت شاهد باید ادعا یا نکته پژوهشی را وارد کنی.');
     if(editingEvidenceID){const idx=r.evidence.findIndex(x=>x.id===editingEvidenceID);if(idx<0)throw Error('شاهد مورد ویرایش پیدا نشد.');r.evidence[idx]=ev}else r.evidence.push(ev);persist('شاهد و تغییرات آن ذخیره شد؛ دسته‌بندی آن نیازمند تأیید پژوهشگر است.');renderEvidence();clearEvidenceForm();updateSummary();renderList();
   }catch(e){text('ثبت شاهد ممکن نشد: '+e.message,true)}
 }
 function getPane(){return root.opener?.ZoteroPane||root.opener?.Zotero?.getActiveZoteroPane?.()||root.Zotero?.getActiveZoteroPane?.()}
 function getZotero(){return root.opener?.Zotero||root.Zotero}
 function addSelected(){
   if(root.AYINYAR_DEMO){text('در پیش‌نمایش مرورگر به Zotero دسترسی نداریم؛ از «نمونه‌های فرضی» یا منبع دستی استفاده کن.');return}
   const pane=getPane();if(!pane){text('پنجره Zotero پیدا نشد؛ آیین‌یار را از منوی Tools در Zotero اجرا کن.',true);return}
   let items=[];try{items=pane.getSelectedItems?.()||[]}catch(e){text('خواندن انتخاب Zotero ممکن نشد: '+e.message,true);return}let added=0,updated=0,ignored=0,last='';
   for(const item of items){
     let meta;try{meta=M.fromItem(item)}catch(_){ignored++;continue}if(!meta){ignored++;continue}
     const found=rows.find(r=>r.source.id===meta.id);
     if(found){found.source={...M.makeRow(meta).source};updated++}
     else if(rows.length<M.MAX_ROWS){rows.push(M.makeRow(meta));added++}
     else {ignored++;}
     last=meta.id;
   }
   if(last){syncFields();persist();select(last)}else updateSummary();renderList();
   text(added+' منبع جدید وارد شد؛ فراداده '+updated+' منبع به‌روزرسانی شد؛ '+ignored+' مورد نادیده گرفته شد. یادداشت‌های قبلی حفظ شدند.');root.AyinMatrixBatch?.refreshList?.();
 }
 function addManual(){const card=$('matrix-manual-form');card.hidden=!card.hidden;if(!card.hidden)$('matrix-manual-title').focus()}
 function confirmManual(){
   const title=M.clip($('matrix-manual-title').value,350);if(!title){text('عنوان منبع دستی را وارد کن.',true);return}
   if(rows.length>=M.MAX_ROWS){text('سقف ۱۵۰ منبع پر شده است.',true);return}
   const id='local:M'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
   const row=M.makeRow({id,title,authors:$('matrix-manual-authors').value,year:$('matrix-manual-year').value,doi:$('matrix-manual-doi').value,type:'manual',zoteroItemID:0});rows.push(row);
   $('matrix-manual-form').hidden=true;for(const k of ['title','authors','year','doi'])$('matrix-manual-'+k).value='';
   persist('منبع دستی فقط در ماتریس ثبت شد.');updateSummary();select(row.source.id);root.AyinMatrixBatch?.refreshList?.()
 }
 async function jumpZotero(){const r=current();if(!r||!r.source.zoteroItemID)return;
   try{
     const pane=getPane(),z=getZotero();if(!pane||!z)throw Error('پنجره Zotero پیدا نشد.');
     const item=z.Items.get(r.source.zoteroItemID);
     if(!item||[String(item.libraryID),String(item.key)].join(':')!==r.source.id)throw Error('شناسه رکورد در کتابخانه فعلی یافت نشد.');
     if(typeof pane.selectItem==='function')await pane.selectItem(item.id);
     else if(typeof pane.itemsView?.selectItems==='function')await pane.itemsView.selectItems([item.id]);
     else throw Error('انتخاب رکورد در این نسخه از Zotero پشتیبانی نمی‌شود.');
     root.opener?.focus();text('منبع در کتابخانه Zotero انتخاب شد. برای دیدن صفحه، PDF را از همان کتابخانه باز کن.');
   }catch(e){text('نمایش در Zotero ناموفق بود: '+e.message,true)}
 }
 function outputFile(name,content,extension,mime){
   if(root.AYINYAR_DEMO){
     const blob=new Blob([content],{type:mime||'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);text('فایل پیش‌نمایش در مرورگر دریافت شد.');return Promise.resolve();
   }
   return (async()=>{
     const path=await root.AyinFileDialog.pick({mode:'save',title:'خروجی ماتریس آیین‌یار',filterTitle:extension.toUpperCase()+' (*.'+extension+')',filterPattern:'*.'+extension,defaultString:name,defaultExtension:extension});
     if(!path)return;
     root.AyinFileDialog.writeUTF8(path,content);text('فایل خروجی با موفقیت ذخیره شد.');
   })().catch(e=>text('ذخیره خروجی ناموفق بود: '+e.message,true));
 }
 function doExport(kind){if(saving){syncFields();persist()}else syncFields();
   if(!rows.length){text('برای خروجی گرفتن، ابتدا منبعی اضافه کن.',true);return}
   try{
     if(kind==='csv')return outputFile('AyinYar-Review-Matrix.csv',M.csv(rows),'csv','text/csv;charset=utf-8');
     if(kind==='evidence')return outputFile('AyinYar-Evidence-Passports.csv',M.evidenceCSV(rows),'csv','text/csv;charset=utf-8');
     if(kind==='word')return outputFile('AyinYar-Review-Matrix-Word.html',M.html(rows),'html','text/html;charset=utf-8');
     if(kind==='json')return outputFile('AyinYar-Review-Matrix-Backup.json',JSON.stringify(M.wrap(rows),null,2),'json','application/json;charset=utf-8');
   }catch(e){text('ایجاد فایل خروجی ناموفق بود: '+e.message,true)}
 }
 async function importJSON(){
   try{
     let raw;
     if(root.AYINYAR_DEMO){text('واردکردن JSON در پیش‌نمایش مرورگر غیرفعال است؛ نسخه Zotero از انتخابگر امن فایل استفاده می‌کند.');return}
     const path=await root.AyinFileDialog.pick({mode:'open',title:'انتخاب پشتیبان ماتریس',filterTitle:'JSON (*.json)',filterPattern:'*.json'});if(!path)return;
     raw=root.AyinFileDialog.readUTF8(path,1000000);
     const parsed=M.parse(raw);
     if(!root.confirm('تعداد '+parsed.rows.length+' منبع در پشتیبان است. موارد هم‌شناسه با داده‌های فایل جایگزین و سایر منابع حفظ می‌شوند. ادامه؟'))return;
     syncFields();const merged=M.merge(rows,parsed.rows);rows=merged.rows;selected='';storageBlocked=false;persist();updateSummary();renderList();$('matrix-empty-editor').hidden=false;$('matrix-editor-body').hidden=true;
     text(merged.added+' منبع اضافه و '+merged.updated+' منبع با داده‌های پشتیبان جایگزین شد.');root.AyinMatrixBatch?.refreshList?.();
   }catch(e){text('بازیابی ناموفق بود: '+e.message,true)}
 }
 function addDemo(){
   if(!root.AYINYAR_DEMO)return;
   const demos=[
     {id:'1:DEMO001',title:'[نمونه فرضی] آموزش در فضای انعطاف‌پذیر',authors:'پژوهشگر نمونه الف',year:'2024',type:'journalArticle'},
     {id:'1:DEMO002',title:'[نمونه فرضی] مشارکت دانشجویان در محیط‌های یادگیری',authors:'پژوهشگر نمونه ب',year:'2023',type:'journalArticle'},
     {id:'1:DEMO003',title:'[نمونه فرضی] طراحی مبتنی بر شواهد',authors:'پژوهشگر نمونه ج',year:'2025',type:'book'}
   ];
   const incoming=demos.map((x,i)=>{const row=M.makeRow(x);row.fields.aim=['بررسی تأثیر طرح فضایی بر فعالیت دانشجویی','مطالعه تجربه مشارکت در کلاس‌های تعاملی','مرور رویکردهای تصمیم‌گیری طراحی'][i];row.fields.method=['مطالعه میدانی فرضی','مصاحبه فرضی','مرور ادبیات فرضی'][i];return row});
   const old=rows.map(r=>r.source.id);const merged=M.merge(rows,incoming.filter(x=>!old.includes(x.source.id)));rows=merged.rows;persist('منابع کاملاً فرضی برای آزمون رابط اضافه شدند.');updateSummary();renderList();if(incoming[0])select(incoming[0].source.id);root.AyinMatrixBatch?.refreshList?.()
 }
 function init(){if(ready||!$('page-matrix'))return;ready=true;
   try{const raw=storageRead();if(raw)rows=M.parse(raw).rows;text(rows.length+' منبع از حافظه محلی ماتریس بازیابی شد.');}
   catch(e){text('خواندن داده‌های قبلی ناموفق بود؛ قبل از ثبت اطلاعات تازه، پشتیبان اصلی را بررسی کن: '+e.message,true);saveOK=false;storageBlocked=true}
   $('matrix-demo').hidden=!root.AYINYAR_DEMO;
   $('matrix-import-zotero').addEventListener('click',addSelected);
   $('matrix-demo').addEventListener('click',addDemo);
   $('matrix-add-manual').addEventListener('click',addManual);
   $('matrix-manual-cancel').addEventListener('click',()=>{$('matrix-manual-form').hidden=true});
   $('matrix-manual-confirm').addEventListener('click',confirmManual);
   $('matrix-zotero-jump').addEventListener('click',jumpZotero);
   $('matrix-save-row').addEventListener('click',()=>{syncFields();persist('یادداشت‌های این منبع ذخیره شدند.');renderList();updateSummary()});
   $('matrix-remove-row').addEventListener('click',()=>{const r=current();if(!r||!root.confirm('فقط اطلاعات این منبع از ماتریس حذف شود؟ رکورد Zotero حذف نخواهد شد.'))return;rows=rows.filter(x=>x.source.id!==r.source.id);selected='';$('matrix-empty-editor').hidden=false;$('matrix-editor-body').hidden=true;persist('منبع فقط از ماتریس حذف شد.');renderList();updateSummary();root.AyinMatrixBatch?.refreshList?.()});
   $('matrix-add-evidence').addEventListener('click',addEvidence);
   for(const k of fkeys)$('matrix-'+k).addEventListener('input',schedule);
   $('matrix-search').addEventListener('input',()=>{matrixPage=0;renderList()});
   $('matrix-prev-page').addEventListener('click',()=>{matrixPage=Math.max(0,matrixPage-1);renderList()});
   $('matrix-next-page').addEventListener('click',()=>{matrixPage++;renderList()});
   document.querySelectorAll('[data-matrix-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.matrixFilter;matrixPage=0;document.querySelectorAll('[data-matrix-filter]').forEach(el=>{const active=el===b;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active))});renderList()}));
   document.querySelectorAll('[data-matrix-stance]').forEach(b=>b.addEventListener('click',()=>setStance(b.dataset.matrixStance)));
   [['matrix-export-csv','csv'],['matrix-export-evidence','evidence'],['matrix-export-word','word'],['matrix-export-json','json']].forEach(([id,kind])=>$(id).addEventListener('click',()=>doExport(kind)));
   $('matrix-import-json').addEventListener('click',importJSON);
   updateSummary();renderList();
 }
 function applyAISuggestionsToSource(sourceID,proposals){
   if(storageBlocked)throw Error('حافظه ماتریس قابل خواندن نیست؛ ابتدا پشتیبان را بازیابی کن.');
   const index=rows.findIndex(x=>x.source.id===sourceID);if(index<0)throw Error('منبع برای ثبت پیشنهاد در ماتریس پیدا نشد.');
   if(!Array.isArray(proposals)||proposals.length>8)throw Error('تعداد پیشنهادها معتبر نیست.');
   if(saving){clearTimeout(saving);saving=null}syncFields();
   const candidate=M.normalizeRow(rows[index]);let fields=0,evidences=0,skipped=0;
   for(const suggestion of proposals){
     const field=suggestion?.field;
     if(!['aim','method','sample','findings','limitations'].includes(field)||!suggestion.quote||!suggestion.chunkId){skipped++;continue}
     // An approved suggestion is still NOT a peer-reviewed scientific claim.
     if(!candidate.fields[field]&&suggestion.text){candidate.fields[field]=M.clip(suggestion.text,M.FIELDS[field]);fields++}else skipped++;
     if(candidate.evidence.length>=M.MAX_EVIDENCE){skipped++;continue}
     const claim=M.clip('پیشنهاد برای '+({aim:'هدف',method:'روش',sample:'جامعه و نمونه',findings:'یافته‌ها',limitations:'محدودیت‌ها'}[field])+': '+suggestion.text,440);
     if(candidate.evidence.some(e=>e.quote===suggestion.quote&&e.origin?.chunkId===suggestion.chunkId)){skipped++;continue}
     candidate.evidence.push(M.normalizeEvidence({id:'ai'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),claim,quote:suggestion.quote,page:suggestion.page?String(suggestion.page):'',stance:'unreviewed',comment:'پیشنهاد مدل محلی؛ نقل‌قول در نمایه PDF پیدا شده، اما تفسیر و شماره صفحه باید توسط پژوهشگر بررسی شوند.',origin:{kind:'local-ai',attachmentKey:suggestion.attachmentKey,chunkId:suggestion.chunkId,pageSource:suggestion.pageSource}}));
     evidences++;
   }
   const prev=rows[index];rows[index]=candidate;
   if(!persist()){rows[index]=prev;throw Error('ذخیره محلی انجام نشد؛ داده پیشین حفظ شد.');}
   if(selected===sourceID){for(const k of fkeys)$('matrix-'+k).value=candidate.fields[k]||'';renderEvidence()}
   renderList();updateSummary();return {fields,evidences,skipped};
 }
 function applyAISuggestions(sourceID,proposals){
   if(current()?.source.id!==sourceID)throw Error('شناسه منبع انتخابی تغییر کرده است.');
   return applyAISuggestionsToSource(sourceID,proposals);
 }
 function saveExport(name,content,extension,mime){return outputFile(name,content,extension,mime)}
 function snapshot(){syncFields();return rows.map(M.normalizeRow)}
 root.AyinMatrixUI=Object.freeze({init,getRows:snapshot,getCurrent:()=>current()?M.normalizeRow(current()):null,applyAISuggestions,applyAISuggestionsToSource,saveExport,select});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
