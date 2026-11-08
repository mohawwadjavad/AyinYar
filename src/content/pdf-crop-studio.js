/* AyinYar 0.15.0 — manual crop of already-rendered Zotero PDF reader canvas.
 * Uses private, version-dependent Zotero reader internals; degrades with clear errors.
 * Never modifies the source PDF. No network, external process, or paid API. */
(function(root){
 'use strict';
 const $ = id => document.getElementById(id);
 const NS='http://www.w3.org/1999/xhtml';
 const CATEGORIES={figure:'تصویر / شکل',chart:'نمودار',drawing:'پلان / دیاگرام',table:'جدول'};
 let image=null, selection=null, origin=null, dragging=false, category='figure';
 let candidateList=[];
 function status(message){if($('crop-status'))$('crop-status').textContent=String(message);}
 function canvas(){return $('crop-page-canvas');}
 function roundRect(rect){return {x:+rect.x.toFixed(5),y:+rect.y.toFixed(5),w:+rect.w.toFixed(5),h:+rect.h.toFixed(5)};}
 function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
 function normalize(a,b){const x=Math.min(a.x,b.x), y=Math.min(a.y,b.y); return {x,y,w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};}
 function valid(r){return r&&r.w>=0.015&&r.h>=0.012&&r.x>=0&&r.y>=0&&r.x+r.w<=1.001&&r.y+r.h<=1.001;}
 function viewBox(){const el=canvas();return el?.getBoundingClientRect();}
 function coords(evt){const box=viewBox();if(!box||box.width<2||box.height<2)throw Error('پیش‌نمایش صفحه آماده نیست.'); return {x:clamp((evt.clientX-box.left)/box.width,0,1),y:clamp((evt.clientY-box.top)/box.height,0,1)};}
 function select(r){selection=r&&valid(r)?roundRect(r):null;
  const box=$('crop-selection');if(box){box.hidden=!selection;
   if(selection){box.style.left=(selection.x*100)+'%';box.style.top=(selection.y*100)+'%';box.style.width=(selection.w*100)+'%';box.style.height=(selection.h*100)+'%';}}
  if($('crop-save'))$('crop-save').disabled=!selection;
 }
 function pointerDown(e){if(!image||e.button!==0)return;dragging=true;origin=coords(e);select(null);try{canvas().setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();}
 function pointerMove(e){if(!dragging)return;const r=normalize(origin,coords(e));if(valid(r))select(r);}
 function pointerUp(e){if(!dragging)return;dragging=false;const r=normalize(origin,coords(e));select(valid(r)?r:null);status(selection?'محدوده انتخاب شد. نوع و عنوان را مشخص و «افزودن به گالری» را بزن.':'محدوده کوچک است؛ یک مستطیل بزرگ‌تر بکش.');}
 function visibleReader(){
  const mw=root.opener||root;
  const zotero=mw.Zotero||root.Zotero;
  const tabs=mw.Zotero_Tabs;
  if(!zotero?.Reader)throw Error('کتابخانه Zotero در دسترس نیست.');
  let reader=null;
  try{reader=tabs?.selectedID&&zotero.Reader.getByTabID?.(tabs.selectedID);}catch(_){}
  // Optional lookup from selected PDF if reader pane is no longer focused.
  if(!reader){try{const list=mw.ZoteroPane?.getSelectedItems?.()||[];
   for(const item of list){if(item?.isAttachment?.() && /pdf/i.test(item.attachmentContentType||'')){
    reader=zotero.Reader.getByItemID?.(item.id);if(reader)break;
   }}
  }catch(_){}}
  if(!reader)throw Error('PDF باز پیدا نشد. مقاله را در تب داخلی Zotero باز کن و صفحه موردنظر را نمایش بده.');
  const internal=reader._internalReader||reader;
  const view=internal._primaryView||internal;
  const win=view._iframeWindow||reader._iframeWindow||view._window;
  if(!win?.document)throw Error('نمای داخلی PDF در این نسخه Zotero در دسترس افزونه نیست.');
  const doc=win.document;
  let pdfApp=null;
  try{pdfApp=win.PDFViewerApplication||win.wrappedJSObject?.PDFViewerApplication||null;}catch(_){}
  const current=Number(pdfApp?.pdfViewer?.currentPageNumber||pdfApp?.page||0);
  const pages=Array.from(doc.querySelectorAll('.page[data-page-number]'));
  let page=pages.find(p=>Number(p.getAttribute('data-page-number'))===current)||null;
  if(!page){page=pages.find(p=>{const r=p.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<win.innerHeight;})||null;}
  if(!page){page=doc.querySelector('.page[data-page-number]');}
  if(!page)throw Error('صفحه PDF هنوز رندر نشده است. به تب PDF برگرد، صفحه را نمایش بده و دوباره تلاش کن.');
  let canvasElem=page.querySelector('.canvasWrapper canvas')||page.querySelector('canvas');
  // Choose actual page image instead of an overlay / annotations canvas.
  if(!canvasElem||!canvasElem.width||!canvasElem.height)throw Error('تصویر این صفحه هنوز آماده نیست. چند لحظه پس از نمایش صفحه دوباره امتحان کن.');
  const pageNumber=Number(page.getAttribute('data-page-number'))||current||1;
  const itemID=reader.itemID||reader._itemID||view._itemID||null;
  const item=itemID?zotero.Items?.get(itemID):null;
  const name=item?.attachmentFilename||item?.getField?.('title')||`PDF Zotero ${itemID||''}`;
  return {page,source:canvasElem,doc,pageNumber,itemID,itemKey:item?.key||'',name};
 }
 function makeCapture(source,maxSide=2600){
  const w=source.width,h=source.height;
  if(!Number.isFinite(w*h)||w*h===0)throw Error('صفحه برای کپی‌کردن آماده نیست.');
  const factor=Math.min(1,maxSide/Math.max(w,h));
  const out=document.createElementNS(NS,'canvas');out.width=Math.max(1,Math.round(w*factor));out.height=Math.max(1,Math.round(h*factor));
  const ctx=out.getContext('2d',{alpha:false});if(!ctx)throw Error('امکان ساخت پیش‌نمایش Canvas وجود ندارد.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(source,0,0,out.width,out.height);
  return out;
 }
 function textSuggestions(reader){
  const wrapper=reader.page.getBoundingClientRect();
  if(wrapper.width<20)return [];
  const elems=Array.from(reader.page.querySelectorAll('.textLayer span'));
  const suggestions=[];const seen=new Set();
  for(const el of elems){const s=(el.textContent||'').trim();if(s.length<4||s.length>110)continue;
   const match=s.match(/(?:^(?:figure|fig\.?|chart|table|diagram)\s*[\dIVX\w-]+)|(?:^(?:شکل|تصویر|نمودار|جدول|نقشه|پلان)\s*[۰-۹0-9]+)/i);
   if(!match)continue;
   const r=el.getBoundingClientRect(); if(r.width<8||r.height<5)continue;
   const isTable=/^(?:table|جدول)/i.test(s);
   const cx=clamp((r.left+r.width/2-wrapper.left)/wrapper.width,0,1);
   const captionY=clamp((r.top-wrapper.top)/wrapper.height,0,1);
   // A caption is only a hint. The suggested crop can be moved/resized by dragging.
   const box={x:clamp(cx-.42,0,.15),y:0,w:.84,h:.30};
   box.y=isTable?clamp(captionY+.018,0,.70):clamp(captionY-.34,0,.70);
   box.w=Math.min(.96,1-box.x);box.h=Math.min(.31,1-box.y);
   const key=`${Math.round(captionY*35)}-${isTable?'t':'f'}`;if(seen.has(key))continue;seen.add(key);
   suggestions.push({caption:s.slice(0,95),type:isTable?'table':'figure',rect:box});if(suggestions.length>=16)break;
  }
  return suggestions;
 }
 function renderSuggestions(){const box=$('crop-suggestions');if(!box)return;box.replaceChildren();
  if(!candidateList.length){const p=document.createElementNS(NS,'p');p.className='helper';p.textContent='عنوان شکل/جدولِ قابل تشخیص در لایه متن این صفحه پیدا نشد. خودت محدوده را بکش.';box.append(p);return;}
  const text=document.createElementNS(NS,'p');text.className='helper';text.textContent=`${candidateList.length} پیشنهاد تقریبی از عنوان‌های صفحه؛ هرکدام را می‌توانی با ماوس اصلاح کنی.`;box.append(text);
  for(const [i,s] of candidateList.entries()){const b=document.createElementNS(NS,'button');b.type='button';b.className='deadline-chip';b.textContent=`${i+1}. ${s.caption}`;b.title='انتخاب محدوده پیشنهادی؛ نیازمند بررسی دستی';b.addEventListener('click',()=>{
   select(s.rect);category=s.type;updateCategory();if($('crop-caption'))$('crop-caption').value=s.caption;
   status('محدوده پیشنهادی انتخاب شد؛ مرزهای آن را کنترل کن و در صورت نیاز محدوده جدید بکش.');
  });box.append(b);}
 }
 async function capture(){
  const button=$('crop-capture');if(button)button.disabled=true;
  try{
   if(root.AYINYAR_DEMO){const existing=$('crop-page-canvas');if(!existing.width||!existing.height){drawDemo();}image={source:'نمونه نمایشی (PDF واقعی نیست)',page:1,key:'demo',width:canvas().width,height:canvas().height};status('نمونه نمایشی بارگذاری شد. روی صفحه مستطیل بکش.');return;}
   const reader=visibleReader();
   const out=makeCapture(reader.source);const dest=canvas();dest.width=out.width;dest.height=out.height;dest.getContext('2d').drawImage(out,0,0);
   image={source:reader.name,page:reader.pageNumber,key:reader.itemKey||`item${reader.itemID||''}`,itemID:reader.itemID,width:out.width,height:out.height};
   select(null);candidateList=textSuggestions(reader);renderSuggestions();
   $('crop-preview-wrap').hidden=false;
   status(`صفحه ${reader.pageNumber} از «${reader.name}» دریافت شد (${out.width}×${out.height} پیکسل). با کشیدن مستطیل برش بزن. فقط همین صفحه رندرشده خوانده شد.`);
  }catch(e){status('دریافت صفحه PDF ممکن نشد: '+String(e.message||e));try{root.Zotero?.logError(e);}catch(_){}}
  finally{if(button)button.disabled=false;}
 }
 function updateCategory(){for(const b of document.querySelectorAll('[data-crop-category]')){const active=b.dataset.cropCategory===category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}}
 async function cropBytes(src,r){
  if(!valid(r))throw Error('محدوده برش انتخاب نشده است.');
  const x=Math.round(r.x*src.width), y=Math.round(r.y*src.height), w=Math.min(src.width-x,Math.round(r.w*src.width)),h=Math.min(src.height-y,Math.round(r.h*src.height));
  if(w<12||h<12||w*h>26000000)throw Error('محدوده برش بسیار کوچک یا بزرگ است.');
  const out=document.createElementNS(NS,'canvas');out.width=w;out.height=h;
  const ctx=out.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(src,x,y,w,h,0,0,w,h);
  const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('ساخت تصویر PNG ناموفق بود.')),'image/png'));
  return {bytes:new Uint8Array(await blob.arrayBuffer()),width:w,height:h};
 }
 async function save(){if(!image||!selection)return;
  const b=$('crop-save');if(b)b.disabled=true;
  try{const r=roundRect(selection),result=await cropBytes(canvas(),r);const label=($('crop-caption').value||'').trim().slice(0,160);
   const id=`crop-${Date.now().toString(36)}-${Math.floor(Math.random()*1e7).toString(36)}`;
   const item={id,page:image.page,category,confidence:'manual',caption:label||`${CATEGORIES[category]} · صفحه ${image.page}`,filename:`${id}.png`,_bytes:result.bytes,_mime:'image/png',width:result.width,height:result.height,
      sourcePDF:image.source,sourceItemKey:image.key,captureMethod:'rendered-page-manual-crop',region:r,
      note:'برش از صفحه نمایش‌داده‌شده PDF در Zotero؛ دقت تابع بزرگنمایی صفحه PDF است.'};
   if(!root.AyinVisual?.addCaptured)throw Error('گالری آیین‌یار آماده نیست.');
   root.AyinVisual.addCaptured(item);
   status(`«${item.caption}» به گالری اضافه شد (${item.width}×${item.height}). برای ذخیره فایل، دکمه ذخیره تکی یا گروهی گالری را بزن.`);
  }catch(e){status('برش ذخیره نشد: '+String(e.message||e));}
  finally{if(b)b.disabled=!selection;}
 }
 function drawDemo(){const c=canvas();c.width=760;c.height=1060;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,760,1060);
  x.fillStyle='#17395b';x.font='bold 24px sans-serif';x.fillText('Research Article · Visual Crop Demo',38,64);
  x.fillStyle='#65758a';x.font='18px sans-serif';x.fillText('Synthetic page for interface testing (not an academic article)',38,96);
  x.strokeStyle='#16689c';x.lineWidth=8;x.strokeRect(70,150,610,400);for(let i=0;i<5;i++){x.strokeRect(90+i*23,180+i*18,500-i*46,330-i*36);}
  x.fillStyle='#17395b';x.font='18px sans-serif';x.fillText('Figure 1. Schematic spatial plan',70,584);
  x.fillStyle='#edf4fa';x.fillRect(70,645,610,225);x.strokeStyle='#8faabf';x.lineWidth=2;
  for(let i=0;i<5;i++){x.strokeRect(70,645+i*45,610,45);}for(let i=1;i<4;i++)x.strokeRect(70+i*152.5,645,0,225);
  x.fillStyle='#17395b';x.font='18px sans-serif';x.fillText('Table 1. Sample values for interface QA',70,910);
  $('crop-preview-wrap').hidden=false;select(null);candidateList=[];renderSuggestions();}
 function init(){if(!$('crop-capture'))return;
  $('crop-capture').addEventListener('click',capture);
  $('crop-save').addEventListener('click',save);
  $('crop-clear').addEventListener('click',()=>{select(null);status('محدوده پاک شد؛ مستطیل جدید بکش.');});
  for(const btn of document.querySelectorAll('[data-crop-category]'))btn.addEventListener('click',()=>{category=btn.dataset.cropCategory;updateCategory();});
  const c=canvas();c.addEventListener('pointerdown',pointerDown);c.addEventListener('pointermove',pointerMove);c.addEventListener('pointerup',pointerUp);c.addEventListener('pointercancel',()=>{dragging=false;});
  updateCategory();if(root.AYINYAR_DEMO){drawDemo();image={source:'نمونه نمایشی',page:1,key:'demo'};status('در حالت نمایشی، برش و گالری با یک صفحه ساختگی آزمایش می‌شوند؛ در Zotero PDF واقعی را باز کن.');}
 }
 root.AyinPdfCrop={init,capture,save,select,normalize,valid,cropBytes,textSuggestions};
})(window);
