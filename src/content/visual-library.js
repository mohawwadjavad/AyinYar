/* AyinYar Visual Library 0.21.3 — local figure gallery, captions, and exports.
   Offline PDF.js page scans are heuristic; all proposed regions require human review. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const TYPES={all:'همه موارد',figure:'تصاویر و شکل‌ها',chart:'نمودارها و چارت‌ها',drawing:'نقشه و دیاگرام',table:'جدول‌ها',vector:'بردارها',formula:'فرمول‌ها',unknown:'نامشخص / بازبینی'};
 let records=[], manifest=null, folder=null, filter='all',search='',selected=new Set(),pageAbort=null,onnxAbort=null;
 function status(message){if($('visual-status'))$('visual-status').textContent=message;}
 function add(tag,css,text){const el=document.createElementNS('http://www.w3.org/1999/xhtml',tag);if(css)el.className=css;if(text!==undefined)el.textContent=String(text);return el;}
 function localFile(path){const file=Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsIFile);file.initWithPath(path);return file;}
 function safeChild(base,sub){
  if(typeof sub!=='string'||! /^(?:images|tables)\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|csv)$/.test(sub)||sub.includes('..'))throw new Error('مسیر تصویر نامعتبر است.');
  const chunks=sub.split('/');const dir=base.clone();dir.append(chunks[0]);const file=dir.clone();file.append(chunks[1]);
  if(!file.exists()||!file.isFile())throw new Error('فایل گالری پیدا نشد: '+chunks[1]);
  return file;
 }
 function uri(file){const io=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);return io.newFileURI(file).spec;}
 function parseManifest(raw){
  if(raw.length>5*1024*1024)throw new Error('فایل فهرست آلبوم بیش از حد بزرگ است.');
  const data=JSON.parse(raw);if(data?.schema!=='ayinyar.visual-album.v1'||!Array.isArray(data.items)||data.items.length>1400)throw new Error('این فایل خروجی معتبر آلبوم آیین‌یار نیست.');
  const seen=new Set();for(const x of data.items){if(!x||typeof x.id!=='string'||x.id.length>100||seen.has(x.id)||!TYPES[x.category]||x.category==='all'||!(x.page===null||x.page===undefined||(Number.isSafeInteger(x.page)&&x.page>=1&&x.page<=10000))||String(x.caption).length>1000)throw new Error('یکی از رکوردهای آلبوم نامعتبر است.');seen.add(x.id);
   if(!/^(?:images|tables)\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg)$/.test(x.filename)||x.filename.includes('..'))throw new Error('مسیر تصویر در آلبوم قابل‌قبول نیست.');
   if(x.table_csv&&(!/^tables\/[a-zA-Z0-9_.-]+\.csv$/.test(x.table_csv)||x.table_csv.includes('..')))throw new Error('مسیر فایل جدول نامعتبر است.');
  }return data;
 }
 async function openAlbum(){
  if(root.AYINYAR_DEMO){status('برای آزمایش واقعی، آلبوم خروجی ابزار محلی را داخل Zotero باز کن.');return;}
  try{
   const file=await root.AyinFileDialog.pick({mode:'open',title:'انتخاب album.json خروجی استخراج',filterTitle:'AyinYar Album JSON',filterPattern:'*.json'});
   if(!file)return;
   const raw=root.AyinFileDialog.readUTF8(file.path,5*1024*1024);
   const data=parseManifest(raw);
   // Verify every image belongs to the album directory and exists before changing state.
   for(const item of data.items){safeChild(file.parent,item.filename);if(item.table_csv)safeChild(file.parent,item.table_csv);}
   clearPreview();manifest=data;folder=file.parent;records=data.items.map(x=>Object.assign({},x,{_albumFolder:file.parent}));filter='all';search='';selected.clear();if($('visual-search'))$('visual-search').value='';updateFilters();render();
   status(`${records.length} عنصر از «${data.source_pdf||'فایل PDF'}» بارگذاری شد. نمایش و ذخیره‌سازی آفلاین است؛ دسته‌بندی‌ها تقریبی‌اند.`);
  }catch(e){status('بازکردن آلبوم ممکن نشد: '+e.message);try{root.Zotero?.logError(e);}catch(_){}}
 }
 async function findPDFs(){
  const z=root.opener?.Zotero||root.Zotero;
  const pane=root.opener?.ZoteroPane||z?.getActiveZoteroPane?.();
  if(!z||!pane)throw new Error('برای استخراج مستقیم، پنجره اصلی Zotero باید باز باشد.');
  const selected=(pane.getSelectedItems?.()||[]);
  const resolved=[],used=new Set();
  const addPDF=async item=>{
   if(!item||used.has(item.id))return;
   if(item.isAttachment?.()){
    if(!/pdf/i.test(item.attachmentContentType||'')&&!/\.pdf$/i.test(item.attachmentFilename||''))return;
    const path=await item.getFilePathAsync?.();if(!path)return;
    used.add(item.id);resolved.push({attachment:item,path,title:item.attachmentFilename||'PDF'});return;
   }
   if(item.isRegularItem?.()){
    for(const id of (item.getAttachments?.()||[])){
     const child=z.Items.get(id);await addPDF(child);
    }
   }
  };
  // Active reader tab (if Zotero exposes its item ID); otherwise selected library row.
  try{
   const mw=root.opener,tabID=mw?.Zotero_Tabs?.selectedID;
   const reader=mw?.Zotero?.Reader?.getByTabID?.(tabID);
   const id=reader?.itemID||reader?._itemID||mw?.Zotero_Tabs?._tabs?.find?.(t=>t.id===tabID)?.data?.itemID;
   if(id)await addPDF(z.Items.get(id));
  }catch(_){ /* tab internals differ by Zotero release */ }
  if(!resolved.length)for(const item of selected)await addPDF(item);
  return resolved.slice(0,6);
 }
 function clearPreview(){for(const x of records){if(x._url){try{URL.revokeObjectURL(x._url);}catch(_){}}}}
 async function scanSelected(){
  if(root.AYINYAR_DEMO){status('در پیش‌نمایش، اسکن PDF انتخاب‌شده فقط داخل Zotero فعال است.');return;}
  const button=$('visual-scan-zotero');if(button)button.disabled=true;
  try{
   const sources=await findPDFs();
   if(!sources.length){status('فایل PDF محلی پیدا نشد. یک مقاله/کتاب دارای پیوست PDF یا خود PDF را در Zotero انتخاب یا باز کن.');return;}
   const gathered=[];let unsupported=0, scanned=0;
   for(const source of sources){
    status(`در حال خواندن «${source.title}» (${scanned+1} از ${sources.length}) ...`);
    if(typeof IOUtils==='undefined')throw new Error('IOUtils در این نسخه Zotero در دسترس نیست.');
    const path=source.path;
    const native=root.AyinFileDialog.toNativeFile(path);
    if(!native.exists()||!native.isFile())throw new Error('پیوست PDF هنوز به‌صورت محلی دانلود نشده: '+source.title);
    const bytes=await IOUtils.read(path);
    const extracted=await root.AyinLocalPDF.extract(bytes,(n,t)=>{if(n%10===0&&t)status(`در حال استخراج تصویر ${n} از ${t} از «${source.title}» ...`);});
    for(const [idx,x] of extracted.items.entries()){
     x.id=`${source.attachment.key}-${idx}-${x.sourceObjectId}`;
     x.caption=`${source.title} · ${x.caption}`;
     x.sourcePDF=source.title;x.sourceItemKey=source.attachment.key;x.sourceItemID=source.attachment.id;x.captureMethod='embedded-image-object';x.reviewRequired=true;
     x.filename=`${source.attachment.key}-${x.filename}`;
     gathered.push(x);
    }
    unsupported+=extracted.skipped.length;scanned++;
   }
   mergeResults(gathered);manifest={source_pdf:sources.map(s=>s.title).join('، ')};folder=null;
   filter='all';search='';if($('visual-search'))$('visual-search').value='';updateFilters();render();
   const count=gathered.length;
   status(`از ${scanned} پیوست PDF، ${count} تصویر جاسازی‌شده استخراج شد؛ ${unsupported} شیء تصویری با قالب پشتیبانی‌نشده باقی ماند. این روش به‌تنهایی جدول‌های متنی و بردارها را شناسایی نمی‌کند؛ برای آن‌ها «اسکن صفحه‌های PDF باز» را بزن.`);
  }catch(e){status('استخراج مستقیم ناموفق بود: '+String(e.message||e));try{root.Zotero?.logError(e);}catch(_){}}
  finally{if(button)button.disabled=false;}
 }
 function mergeResults(items){
  const keys=new Set(records.map(x=>x.id));let added=0,duplicates=0;
  for(const x of items){
   if(!x?.id||keys.has(x.id)){duplicates++;continue;}
   // Spatial de-duplication across ONNX and old caption scanner for the same PDF page.
   if(x.region&&records.some(y=>x.sourceItemKey&&y.sourceItemKey===x.sourceItemKey&&x.page===y.page&&y.region&&
     root.AyinVisualONNXCore?.boxIoU?.(x.region,y.region)>=.72&&((x.category===y.category)||['figure','chart','drawing','vector'].includes(x.category)&&['figure','chart','drawing','vector'].includes(y.category)))){
     duplicates++;continue;
   }
   records.push(x);keys.add(x.id);added++;
  }
  return added;
 }
 function onnxStatus(msg){const node=$('visual-onnx-status');if(node)node.textContent=String(msg);}
 async function checkONNX(){const b=$('visual-onnx-test');if(b)b.disabled=true;
  try{if(root.AYINYAR_DEMO){onnxStatus('پیش‌نمایش فاقد سرویس ONNX است. اجرای واقعی فقط روی Zotero همراه با موتور محلی ممکن است.');return;}
   const result=await root.AyinVisualONNX.health();onnxStatus(`✅ موتور ${result.engine} آماده است · اجرای CPU · مدل محلی تأیید شد.`);
  }catch(e){onnxStatus(`❌ موتور ONNX در 127.0.0.1:45317 در دسترس نیست. ابتدا راه‌انداز Windows را اجرا کن. (${String(e.message||e).slice(0,160)})`);}
  finally{if(b)b.disabled=false;}
 }
 async function scanONNX(){
  if(root.AYINYAR_DEMO){onnxStatus('در پیش‌نمایش، پردازش مدل واقعی اجرا نمی‌شود؛ موتور را روی ویندوز راه‌اندازی کن.');return;}
  if(onnxAbort||pageAbort){onnxStatus('اسکن دیگری در حال اجراست؛ ابتدا آن را متوقف کن.');return;}
  if(!root.AyinVisualONNX?.scanOpen){onnxStatus('ماژول ONNX در افزونه بارگذاری نشده است.');return;}
  onnxAbort=new AbortController();const b=$('visual-onnx-scan'),stop=$('visual-onnx-stop');
  if(b)b.disabled=true;if(stop)stop.disabled=false;
  try{
   const result=await root.AyinVisualONNX.scanOpen({signal:onnxAbort.signal,progress({page,total,found}){
    onnxStatus(`🧠 مدل ONNX: صفحه ${page} از ${total} · ${found} عنصر شناسایی‌شده ...`);
   }});
   const added=mergeResults(result.items);filter='all';search='';if($('visual-search'))$('visual-search').value='';updateFilters();render();
   onnxStatus(`✅ ${result.pagesScanned} صفحه پردازش شد؛ ${added} برش جدید ثبت شد (از ${result.items.length} تشخیص مدل). همه موارد نیازمند بازبینی‌اند. ${result.warnings.slice(0,3).join(' | ')}`);
  }catch(e){onnxStatus('⛔ اسکن ONNX انجام نشد: '+String(e.message||e)+'. روش اسکن صفحه‌محور قبلی همچنان قابل استفاده است.');try{root.Zotero?.logError(e);}catch(_){}}
  finally{onnxAbort=null;if(b)b.disabled=false;if(stop)stop.disabled=true;}
 }

 async function scanOpenReader(){
  if(root.AYINYAR_DEMO){status('اسکن واقعی صفحه‌ها فقط داخل Zotero و با PDF بازشده انجام می‌شود.');return;}
  if(pageAbort){status('اسکن صفحه‌ها در حال اجراست.');return;}
  if(!root.AyinVisualPageScan?.scanOpen){status('ماژول اسکن صفحه در این بسته بارگذاری نشده است.');return;}
  pageAbort=new AbortController();const button=$('visual-scan-pages'),stop=$('visual-stop-pages');
  if(button)button.disabled=true;if(stop)stop.disabled=false;
  try{
   const result=await root.AyinVisualPageScan.scanOpen({signal:pageAbort.signal,progress({page,total,found}){
    status(`اسکن صفحه ${page} از ${total} · ${found} مورد با عنوان قابل تشخیص پیدا شده است ...`);
   }});
   const added=mergeResults(result.items);
   filter='all';search='';if($('visual-search'))$('visual-search').value='';updateFilters();render();
   status(`اسکن ${result.pagesScanned} صفحه پایان یافت؛ ${added} برش جدید بر اساس عنوان شکل/جدول به گالری اضافه شد (${result.items.length} مورد بازیابی). همه برش‌ها نیازمند بازبینی هستند. ${result.warnings.slice(0,3).join(' | ')}`);
  }catch(e){status('اسکن صفحه‌محور ممکن نشد: '+String(e.message||e));try{root.Zotero?.logError(e);}catch(_){}}
  finally{pageAbort=null;if(button)button.disabled=false;if(stop)stop.disabled=true;}
 }
 function clearGallery(){
  if(pageAbort||onnxAbort){status('ابتدا اسکن جاری را متوقف کن.');return;}
  if(!root.AYINYAR_DEMO&&records.length&&!root.confirm('تمام موارد گالری جاری پاک شوند؟ فایل PDF اصلی و فایل‌های ذخیره‌شده تغییر نمی‌کنند.'))return;
  clearPreview();records=[];folder=null;manifest=null;selected.clear();filter='all';search='';
  if($('visual-search'))$('visual-search').value='';updateFilters();render();status('گالری این نشست پاک شد.');
 }
 async function openSource(item){
  if(root.AYINYAR_DEMO){status('بازکردن PDF منبع در پیش‌نمایش فعال نیست.');return;}
  try{
   const z=root.opener?.Zotero||root.Zotero;
   if(!z?.Reader?.open||!item.sourceItemID)throw Error('شناسه پیوست PDF برای این مورد در دسترس نیست.');
   const location=Number.isSafeInteger(item.page)&&item.page>0?{pageIndex:item.page-1}:undefined;
   await z.Reader.open(item.sourceItemID,location?{location}:{});
  }catch(e){status('بازکردن PDF منبع ممکن نشد: '+String(e.message||e));}
 }
 function preview(item){
  const dialog=$('visual-viewer');if(!dialog)return;
  const img=$('visual-viewer-image'),title=$('visual-viewer-title'),meta=$('visual-viewer-meta');
  if(!img||!title||!meta)return;
  let url='';
  if(item._bytes){if(!item._url)item._url=URL.createObjectURL(new Blob([item._bytes],{type:item._mime}));url=item._url;}
  else if(item._albumFolder||folder){try{url=uri(safeChild(item._albumFolder||folder,item.filename));}catch(_){}}
  if(!url){status('تصویری برای پیش‌نمایش وجود ندارد.');return;}
  img.src=url;img.alt=item.caption||'نمای بزرگ تصویر';
  title.textContent=item.caption||'بدون عنوان';
  meta.textContent=`${TYPES[item.category]||'نامشخص'} · ${item.page?'صفحه '+item.page:'شماره صفحه نامشخص'} · ${item.width||'?'}×${item.height||'?'} · ${item.reviewRequired?'برش نیازمند بازبینی':'دسته‌بندی اعلام‌شده'}`;
  try{dialog.showModal();}catch(_){dialog.removeAttribute('hidden');dialog.setAttribute('open','open');}
 }
 function demo(){manifest={source_pdf:'مقاله-آزمایشی.pdf'};folder=null;records=[{id:'d1',page:2,category:'figure',caption:'Figure 1 · نمونه نمایشی تصویر',filename:'images/demo1.png',confidence:'low'},{id:'d2',page:3,category:'chart',caption:'Chart 2 · نمونه نمایشی نمودار',filename:'images/demo2.png',confidence:'low'},{id:'d3',page:4,category:'table',caption:'Table 1 · نمونه نمایشی جدول',filename:'images/demo3.png',confidence:'low'},{id:'d4',page:5,category:'drawing',caption:'Diagram 1 · نمونه نقشه و دیاگرام',filename:'images/demo4.png',confidence:'low'},{id:'d5',page:6,category:'vector',caption:'نمایش نمونه برداری',filename:'images/demo5.png',confidence:'low'},{id:'d6',page:7,category:'formula',caption:'Equation 3 · نمونه فرمول',filename:'images/demo6.png',confidence:'low'}];render();status('حالت نمایشی: برای دیدن عکس‌های واقعی فایل album.json را در Zotero وارد کن.');}
 function updateFilters(){for(const b of document.querySelectorAll('[data-visual-filter]')){const active=b.dataset.visualFilter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}}
 function visible(){const q=search.trim().toLowerCase();return records.filter(x=>(filter==='all'||x.category===filter)&&(!q||`${x.caption} ${x.page||''} ${TYPES[x.category]}`.toLowerCase().includes(q)));}
 function render(){const grid=$('visual-gallery');if(!grid)return;grid.replaceChildren();const list=visible();const counts=Object.fromEntries(Object.keys(TYPES).filter(x=>x!=='all').map(k=>[k,records.filter(x=>x.category===k).length]));
  $('visual-counts').textContent=`همه ${records.length} · تصویر ${counts.figure||0} · نمودار ${counts.chart||0} · نقشه ${counts.drawing||0} · جدول ${counts.table||0} · بردار ${counts.vector||0} · فرمول ${counts.formula||0} · نامشخص ${counts.unknown||0} · انتخاب‌شده ${selected.size}`;
  if(!records.length){grid.append(add('p','visual-empty','هنوز موردی استخراج نشده است. در Zotero یک مقاله، رساله، کتاب یا PDF پیوست را انتخاب و دکمه «استخراج PDF انتخاب‌شده» را بزن.'));return;}
  if(!list.length){grid.append(add('p','visual-empty','در این فیلتر موردی پیدا نشد.'));return;}
  for(const item of list.slice(0,700)){
   const card=add('article','visual-card');const img=add('img');img.alt=item.caption;img.loading='lazy';if(item._bytes){if(!item._url)item._url=URL.createObjectURL(new Blob([item._bytes],{type:item._mime}));img.src=item._url;}else if(item._albumFolder||folder){try{img.src=uri(safeChild(item._albumFolder||folder,item.filename));}catch(e){}}else {img.style.display='none';card.append(add('div','visual-placeholder','تصویر آزمایشی'));}img.addEventListener('click',()=>preview(item));img.title='برای مشاهده تصویر در ابعاد بزرگ کلیک کن';img.tabIndex=0;img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();preview(item);}});card.append(img);
   const header=add('div','visual-card-title',item.caption||'بدون عنوان');card.append(header);
   card.append(add('div','visual-meta',`${TYPES[item.category]} · ${item.page?'صفحه '+item.page:'شماره صفحه نامشخص'} · ${item.width||'?'}×${item.height||'?'} · ${item.reviewRequired?'نیازمند بازبینی':'دسته‌بندی اعلام‌شده'}`));
   const actions=add('div','visual-card-actions');const label=add('label','visual-check');const check=add('input');check.type='checkbox';check.checked=selected.has(item.id);check.addEventListener('change',()=>{if(check.checked)selected.add(item.id);else selected.delete(item.id);renderCounts()});label.append(check);label.append(add('span','','انتخاب'));actions.append(label);
   if(item.sourceItemID&&item.page){const go=add('button','action secondary','بازکردن صفحه PDF');go.type='button';go.addEventListener('click',()=>openSource(item));actions.append(go);}
   const save=add('button','action secondary','ذخیره تکی');save.type='button';save.addEventListener('click',()=>exportItems([item]));actions.append(save);
   if(item.table_csv){const csv=add('button','action secondary','CSV جدول');csv.type='button';csv.addEventListener('click',()=>exportCSV(item));actions.append(csv);}
   card.append(actions);
   {const cats=add('div','visual-tag-editor');cats.append(add('span','','نوع: '));
     for(const [id,name] of Object.entries(TYPES).filter(([id])=>id!=='all')){
       const btn=add('button','visual-tag'+(item.category===id?' active':''),name);btn.type='button';btn.addEventListener('click',()=>{item.category=id;item.categoryReviewed=true;render();});cats.append(btn);
     }card.append(cats);
   }
   grid.append(card);
  }
 }
 function addCaptured(item){
  if(!item||!item._bytes||!item.id)throw new Error('داده برش معتبر نیست.');
  if(records.some(x=>x.id===item.id))throw new Error('شناسه برش تکراری است.');
  records.unshift(item);filter='all';search='';if($('visual-search'))$('visual-search').value='';
  updateFilters();render();return records.length;
 }
 function renderCounts(){$('visual-counts').textContent=$('visual-counts').textContent.replace(/انتخاب‌شده \d+/,'انتخاب‌شده '+selected.size);}
 function makeUniqueName(base,fileName){let name=fileName,index=2;const dot=name.lastIndexOf('.');while(true){const dest=base.clone();dest.append(name);if(!dest.exists())return name;name=fileName.slice(0,dot)+'-'+index+fileName.slice(dot);index++;if(index>9999)throw new Error('فایل‌های همنام بسیار زیاد هستند.');}}
 async function doExport(items,withCSV=false){
  if(root.AYINYAR_DEMO||(!folder&&!items.some(x=>x._bytes||x._albumFolder))){status('هنوز تصویری برای ذخیره وجود ندارد.');return;}
  try{
   const target=await root.AyinFileDialog.pick({mode:'folder',title:'انتخاب پوشه ذخیره تصاویر پژوهشی'});if(!target)return;
   const images=target.clone();images.append('images');
   if(!images.exists())images.create(Components.interfaces.nsIFile.DIRECTORY_TYPE,0o755);
   if(!images.isDirectory())throw Error('پوشه images قابل استفاده نیست.');
   const tables=target.clone();tables.append('tables');
   if(withCSV&&!tables.exists())tables.create(Components.interfaces.nsIFile.DIRECTORY_TYPE,0o755);
   let done=0;const exported=[],albumItems=[];
   for(const x of items){
     const ext=x._mime==='image/jpeg'||/\.jpe?g$/i.test(x.filename||'')?'jpg':'png';
     const safeId=String(x.id).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64);
     const base=`AyinYar-${x.page?'p'+String(x.page).padStart(3,'0'):'obj'}-${x.category}-${safeId}.${ext}`;
     const name=makeUniqueName(images,base),dest=images.clone();dest.append(name);
     if(x._bytes){await IOUtils.write(dest.path,x._bytes,{mode:'create'});}
     else {const src=safeChild(x._albumFolder||folder,x.filename);src.copyTo(images,name);}
     let tableCsv=null;
     if(withCSV&&x.table_csv&&(x._albumFolder||folder)){
      const csv=safeChild(x._albumFolder||folder,x.table_csv);
      const csvName=makeUniqueName(tables,`AyinYar-table-${safeId}.csv`);
      csv.copyTo(tables,csvName);tableCsv=`tables/${csvName}`;
     }
     done++;
     const entry={id:String(x.id),filename:`images/${name}`,sourcePDF:x.sourcePDF||manifest?.source_pdf||null,
      sourceItemKey:x.sourceItemKey||null,page:x.page||null,category:x.category,caption:String(x.caption||''),
      confidence:x.confidence||'unclassified',method:x.captureMethod||'embedded-image',
      classification_reviewed:!!x.categoryReviewed,review_required:!!x.reviewRequired,
      region:x.region||null,width:x.width||null,height:x.height||null};
     if(tableCsv)entry.table_csv=tableCsv;
     exported.push({...entry,dimensions_px:{width:x.width||null,height:x.height||null}});
     albumItems.push(entry);
   }
   if(exported.length){
    const index=target.clone();index.append(makeUniqueName(target,'AyinYar-Visual-Index.json'));
    root.AyinFileDialog.writeUTF8(index.path,JSON.stringify({schema:'ayinyar.visual-export.v1',created_at:new Date().toISOString(),items:exported},null,2));
    const album=target.clone();album.append(makeUniqueName(target,'album.json'));
    root.AyinFileDialog.writeUTF8(album.path,JSON.stringify({schema:'ayinyar.visual-album.v1',created_at:new Date().toISOString(),source_pdf:manifest?.source_pdf||'Zotero PDF',items:albumItems},null,2));
   }
   status(`${done} مورد در پوشه images ذخیره شد؛ album.json هم برای بازکردن مجدد گالری ساخته شد. PDF اصلی تغییر نکرد.`);
  }catch(e){status('ذخیره انجام نشد: '+e.message);try{root.Zotero?.logError(e);}catch(_){}}
 }
 function exportItems(arr){return doExport(arr,true);}
 function exportCSV(item){if(!item.table_csv)return;return (async()=>{try{if(!folder&&!item._albumFolder){status('فایل CSV این جدول موجود نیست.');return;}const target=await root.AyinFileDialog.pick({mode:'folder',title:'انتخاب پوشه CSV'});if(target)safeChild(item._albumFolder||folder,item.table_csv).copyTo(target,makeUniqueName(target,`AyinYar-table-${item.id}.csv`));status('فایل CSV جدول ذخیره شد.');}catch(e){status('ذخیره CSV ناموفق: '+e.message);}})();}
 function init(){if(!$('visual-gallery'))return;
  $('visual-import').addEventListener('click',openAlbum);
  $('visual-scan-zotero')?.addEventListener('click',scanSelected);
  $('visual-scan-pages')?.addEventListener('click',scanOpenReader);
  $('visual-onnx-test')?.addEventListener('click',checkONNX);
  $('visual-onnx-scan')?.addEventListener('click',scanONNX);
  $('visual-onnx-stop')?.addEventListener('click',()=>{if(onnxAbort){onnxAbort.abort();onnxStatus('توقف ONNX درخواست شد. پس از عملیات جاری متوقف می‌شود.');}});
  $('visual-stop-pages')?.addEventListener('click',()=>{if(pageAbort){pageAbort.abort();status('درخواست توقف ثبت شد. پس از پایان صفحه جاری متوقف می‌شود.');}});
  $('visual-clear-gallery')?.addEventListener('click',clearGallery);
  $('visual-viewer-close')?.addEventListener('click',()=>{const dlg=$('visual-viewer');try{dlg.close();}catch(_){dlg.removeAttribute('open');dlg.setAttribute('hidden','hidden');}});
  $('visual-save-selected').addEventListener('click',()=>{const list=records.filter(x=>selected.has(x.id));if(!list.length){status('ابتدا تصاویر موردنظر را انتخاب کن.');return;}exportItems(list)});
  $('visual-save-all').addEventListener('click',()=>records.length?exportItems(records):status('ابتدا آلبوم را وارد کن.'));
  $('visual-select-visible').addEventListener('click',()=>{for(const x of visible())selected.add(x.id);render();});
  $('visual-clear-selection').addEventListener('click',()=>{selected.clear();render();});
  $('visual-search').addEventListener('input',e=>{search=e.target.value||'';render()});
  document.querySelectorAll('[data-visual-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.visualFilter;updateFilters();render()}));
  if(root.AYINYAR_DEMO)demo();else render();
  if(!root.AYINYAR_DEMO&&root.arguments?.[0]?.ayinyarScan){Promise.resolve().then(()=>{document.querySelector('.nav-btn[data-page="visuals"]')?.click();scanSelected();});}
 }
 root.AyinVisual={init,parseManifest,scanSelected,scanOpenReader,scanONNX,checkONNX,findPDFs,addCaptured,mergeResults,clearGallery};
})(window);
