/* AyinYar 0.21.3 — independent local caption-anchored page scanner.
 * Uses the PDF document already opened in Zotero's Reader (PDF.js), without
 * uploading documents, external binaries, ML inference, or upstream code reuse.
 * All crops are approximate PNG renderings and MUST be reviewed by a person.
 */
(function(root){
 'use strict';
 const NS='http://www.w3.org/1999/xhtml';
 const MAX_PAGES=500,MAX_RESULTS=850,MAX_PAGE_PIXELS=9000000,MAX_SIDE=2600;
 const LABEL=/^(?:(fig(?:ure)?\.?|table|chart|graph|plot|diagram|scheme|map|plate|photo(?:graph)?|equation|formula)\s*(?:no\.?\s*)?([\d۰-۹٠-٩IVXivx]+(?:[.\-][\d۰-۹٠-٩a-zA-Z]+)?)|((?:شکل|تصویر|عکس|جدول|نمودار|چارت|نقشه|پلان|دیاگرام|فرمول|معادله))\s*(?:شماره\s*)?([\d۰-۹٠-٩]+(?:[.\-][\d۰-۹٠-٩]+)?))\s*[:.،)\-–]?/i;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function category(text){
  const t=String(text||'').trim();
  if(/^(?:table\b|جدول(?:\s|[۰-۹0-9]))/i.test(t))return 'table';
  if(/^(?:equation|formula|فرمول|معادله)/i.test(t))return 'formula';
  if(/(?:chart|graph|plot|bar\s+chart|scatter|histogram|heatmap|curve|نمودار|چارت|هیستوگرام)/i.test(t))return 'chart';
  if(/(?:diagram|scheme|flowchart|network\s+diagram|floor\s+plan|site\s+plan|map|دیاگرام|شماتیک|فلوچارت|نقشه|پلان)/i.test(t))return 'drawing';
  return 'figure';
 }
 function captionMatch(text){
  const s=String(text||'').replace(/[\u200c\u200e\u200f]/g,' ').trim();
  if(s.length<5||s.length>340)return null;
  const m=s.match(LABEL);if(!m)return null;
  const cat=category(s);
  return {category:cat,caption:s.slice(0,210),label:(m[1]||m[3]||'').trim(),number:(m[2]||m[4]||'').trim()};
 }
 function mergeLines(parts){
  const raw=parts.filter(p=>p&&p.text&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.y>=0&&p.y<=1).sort((a,b)=>a.y-b.y||a.x-b.x);
  const grouped=[];
  for(const item of raw){
   let line=grouped.find(l=>Math.abs(l.y-item.y)<0.007&&Math.abs(l.x-item.x)<.48);
   if(!line){line={y:item.y,x:item.x,items:[]};grouped.push(line);}
   line.items.push(item);
  }
  const out=[];
  for(const group of grouped){
   group.items.sort((a,b)=>a.x-b.x);
   const segments=[];let seg=[];let lastRight=0;
   for(const p of group.items){
    if(seg.length&&p.x-lastRight>.095){segments.push(seg);seg=[];}
    seg.push(p);lastRight=Math.max(lastRight,p.x+(p.w||0));
   }
   if(seg.length)segments.push(seg);
   for(const s of segments){const text=s.map(p=>p.text.trim()).join(' ').replace(/\s+/g,' ').trim();
    if(text)out.push({text,y:group.y,x:Math.min(...s.map(p=>p.x)),right:Math.max(...s.map(p=>p.x+(p.w||.02)))});
   }
  }
  return out.sort((a,b)=>a.y-b.y);
 }
 function fromTextItems(items,viewport){
  if(!viewport||!viewport.width||!viewport.height)return [];
  const parts=[];
  for(const item of items||[]){
   if(!item||typeof item.str!=='string'||!item.str.trim()||!item.transform)continue;
   try{const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
    const h=Number(item.height||Math.hypot(item.transform[2],item.transform[3])||8);
    parts.push({text:item.str,x:clamp(x/viewport.width,0,1),y:clamp((y-h)/viewport.height,0,1),w:clamp((Number(item.width)||10)/viewport.width,0,1)});
   }catch(_){ /* malformed glyph position */ }
  }
  return mergeLines(parts);
 }
 function fromDOM(page){
  const box=page?.getBoundingClientRect?.();if(!box||box.width<50)return [];
  const parts=[];
  for(const span of page.querySelectorAll('.textLayer span')){
   const r=span.getBoundingClientRect();if(r.width<3||r.height<3)continue;
   parts.push({text:span.textContent||'',x:clamp((r.left-box.left)/box.width,0,1),y:clamp((r.top-box.top)/box.height,0,1),w:clamp(r.width/box.width,0,1)});
  }
  return mergeLines(parts);
 }
 function regionFor(line,cat,all){
  // The expected reading convention: Table caption above table; Figure caption below figure.
  // This is an *initial candidate*, not a measured figure boundary.
  const y=line.y,table=cat==='table';
  const other=all.filter(x=>x!==line&&Math.abs(x.y-y)>.015).sort((a,b)=>a.y-b.y);
  const previous=other.filter(x=>x.y<y).slice(-1)[0],next=other.find(x=>x.y>y);
  const twoColumns=(line.x>.47||line.right<.53)&&line.right-line.x<.42;
  const x=twoColumns?(line.x>.45?.515:.035):.055;
  const w=twoColumns?.45:.89;
  let top,bottom;
  if(table){top=y+.022;bottom=Math.min(y+.40,next?next.y-.022:.97);}
  else {bottom=y-.012;top=Math.max(y-.40,previous?previous.y+.045:.035);}
  if(bottom-top<.10){top=table?clamp(y+.014,0,.82):clamp(y-.31,.025,.8);bottom=table?Math.min(.97,top+.30):Math.max(top+.1,y-.008);}
  const clippedTop=clamp(top,.01,.89);
  return {x:+x.toFixed(4),y:+clippedTop.toFixed(4),w:+Math.min(w,1-x).toFixed(4),h:+clamp(bottom-top,.08,Math.min(.55,1-clippedTop-.01)).toFixed(4)};
 }
 function candidatesFromLines(lines,pageNumber){
  const captions=[];const used=new Set();
  for(const line of lines||[]){
   const cap=captionMatch(line.text);if(!cap)continue;
   const key=cap.label.toLowerCase()+cap.number+':'+Math.round(line.y*70);
   if(used.has(key))continue;used.add(key);
   captions.push({...cap,page:pageNumber,line});
  }
  return captions.slice(0,40).map((cap,index)=>({
   id:`caption-p${pageNumber}-${index}-${cap.label.toLowerCase()}-${cap.number}`,
   category:cap.category,caption:cap.caption,page:pageNumber,
   region:regionFor(cap.line,cap.category,captions.map(c=>c.line)),
   confidence:'caption-heuristic',reviewRequired:true,captureMethod:'caption-anchored-pdf-page',
   pdfLabel:cap.label,number:cap.number
  }));
 }
 function readerContext(){
  const mw=root.opener||root;const z=mw.Zotero||root.Zotero;const tab=mw.Zotero_Tabs?.selectedID;
  let reader=null;
  try{reader=tab&&z?.Reader?.getByTabID?.(tab);}catch(_){}
  if(!reader){
   const selection=mw.ZoteroPane?.getSelectedItems?.()||[];
   for(const item of selection){if(item?.isAttachment?.()&&/pdf/i.test(item.attachmentContentType||'')){
    try{reader=z?.Reader?.getByItemID?.(item.id);}catch(_){}if(reader)break;
   }}
  }
  if(!reader)throw Error('PDF موردنظر در نمایشگر Zotero باز نیست. آن را در تب مطالعه باز کن و دوباره اسکن را بزن.');
  const internal=reader._internalReader||reader,view=internal._primaryView||internal;
  const win=view._iframeWindow||reader._iframeWindow||view._window;
  let app=null;try{app=win?.PDFViewerApplication||win?.wrappedJSObject?.PDFViewerApplication;}catch(_){}
  const doc=app?.pdfDocument||app?.pdfViewer?.pdfDocument||view._pdfDocument||internal._pdfDocument||null;
  const id=reader.itemID||reader._itemID||view._itemID;
  const item=id?z?.Items?.get?.(id):null;
  const availableDoc=doc&&typeof doc.getPage==='function'?doc:null;
  const renderedPages=Array.from(win?.document?.querySelectorAll?.('.page[data-page-number]')||[]).filter(x=>!!x.querySelector('.canvasWrapper canvas, canvas'));
  if(!availableDoc&&!renderedPages.length)throw Error('سند PDF رندرشده در این نسخه از Zotero در دسترس نیست. روش استخراج مستقیم یا برش دستی همچنان قابل استفاده است.');
  return {pdfDocument:availableDoc,renderedPages,sourcePDF:item?.attachmentFilename||item?.getField?.('title')||'PDF بازشده',sourceItemKey:item?.key||'',sourceItemID:item?.id||null,reader};
 }
 async function pageToCanvas(pdfPage){
  const unit=pdfPage.getViewport({scale:1});
  const factor=Math.min(2.5,MAX_SIDE/Math.max(unit.width,unit.height),Math.sqrt(MAX_PAGE_PIXELS/(unit.width*unit.height)));
  const viewport=pdfPage.getViewport({scale:factor});
  const canvas=root.document.createElementNS(NS,'canvas');canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
  if(canvas.width*canvas.height>MAX_PAGE_PIXELS+10000)throw Error('صفحه بیش از اندازه بزرگ است.');
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas برای رندر PDF در دسترس نیست.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const task=pdfPage.render({canvasContext:ctx,viewport});
  await (task.promise||task);
  return canvas;
 }
 async function crop(canvas,rect){
  const px=Math.round(rect.x*canvas.width),py=Math.round(rect.y*canvas.height),
   w=Math.max(1,Math.min(canvas.width-px,Math.round(rect.w*canvas.width))),
   h=Math.max(1,Math.min(canvas.height-py,Math.round(rect.h*canvas.height)));
  if(w<35||h<35)return null;
  const out=root.document.createElementNS(NS,'canvas');out.width=w;out.height=h;
  const ctx=out.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
  ctx.drawImage(canvas,px,py,w,h,0,0,w,h);
  const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('ساخت PNG ممکن نشد.')),'image/png'));
  if(blob.size>12*1024*1024)throw Error('حجم تصویر استخراجی بیش از حد مجاز است.');
  return {bytes:new Uint8Array(await blob.arrayBuffer()),width:w,height:h};
 }
 async function scanRenderedDOM(context,{progress,signal}={}){
  // Compatibility fallback for Zotero readers that expose rendered canvases/text layers
  // but not a public PDF.js PDFDocument. This only sees *rendered* pages.
  const rendered=context.renderedPages||[],items=[],warnings=[];let pagesScanned=0;
  for(const page of rendered){
   if(signal?.aborted){warnings.push('اسکن متوقف شد.');break;}
   const number=Number(page.getAttribute('data-page-number'))||pagesScanned+1;
   progress?.({page:pagesScanned+1,total:rendered.length,found:items.length});
   const canvas=page.querySelector('.canvasWrapper canvas')||page.querySelector('canvas');
   if(!canvas?.width||!canvas?.height){warnings.push(`صفحه ${number} هنوز رندر نشده است.`);continue;}
   try{
    const cands=candidatesFromLines(fromDOM(page),number);
    for(const c of cands){
     if(items.length>=MAX_RESULTS)break;
     const img=await crop(canvas,c.region);if(!img)continue;
     items.push({...c,id:`${context.sourceItemKey||'open'}-${c.id}`,sourcePDF:context.sourcePDF,
      sourceItemKey:context.sourceItemKey,sourceItemID:context.sourceItemID,
      filename:`p${number}-${items.length}.png`,width:img.width,height:img.height,_bytes:img.bytes,_mime:'image/png',captureMethod:'reader-rendered-page-fallback'});
    }
   }catch(e){warnings.push(`صفحه ${number}: ${String(e.message||e)}`);}
   pagesScanned++;
   if(items.length>=MAX_RESULTS)break;
  }
  warnings.push('در این نسخه Zotero فقط صفحه‌های رندرشده قابل اسکن بودند؛ برای صفحات دیگر PDF را در Reader نمایش بده یا از روش استخراج مستقیم استفاده کن.');
  progress?.({page:pagesScanned,total:rendered.length,found:items.length,done:true});
  return {items,pagesScanned,pagesWithCaptions:items.length,total:null,warnings,method:'rendered-dom-fallback'};
 }
 async function scanOpen({progress,signal,maxPages=MAX_PAGES}={}){
  const context=readerContext(),pdf=context.pdfDocument;
  if(!pdf)return scanRenderedDOM(context,{progress,signal});
  const total=Math.min(Number(pdf.numPages)||0,Math.min(MAX_PAGES,maxPages));
  if(!total)throw Error('این PDF هیچ صفحه قابل خواندن ندارد.');
  const results=[],warnings=[];let pagesScanned=0,pagesWithCaptions=0;
  for(let n=1;n<=total;n++){
   if(signal?.aborted){warnings.push('پردازش توسط کاربر متوقف شد.');break;}
   progress?.({page:n,total,found:results.length});
   try{
    const page=await pdf.getPage(n),unit=page.getViewport({scale:1});
    let lines=[];
    try{const content=await page.getTextContent({disableCombineTextItems:false});lines=fromTextItems(content.items,unit);}catch(_){}
    if(!lines.length){const mw=root.opener||root;
     const view=context.reader?._internalReader?._primaryView?._iframeWindow?.document?.querySelector(`.page[data-page-number="${n}"]`);
     if(view)lines=fromDOM(view);
    }
    const candidates=candidatesFromLines(lines,n);
    if(candidates.length){pagesWithCaptions++;
     const pageCanvas=await pageToCanvas(page);
     for(const candidate of candidates){
      if(signal?.aborted||results.length>=MAX_RESULTS)break;
      try{const img=await crop(pageCanvas,candidate.region);if(!img)continue;
       results.push({...candidate,id:`${context.sourceItemKey||'open'}-${candidate.id}`,sourcePDF:context.sourcePDF,
        sourceItemKey:context.sourceItemKey,sourceItemID:context.sourceItemID,filename:`p${n}-${results.length}.png`,width:img.width,height:img.height,
        _bytes:img.bytes,_mime:'image/png'});
      }catch(err){warnings.push(`صفحه ${n}: ${String(err.message||err)}`);}
     }
     pageCanvas.width=0;pageCanvas.height=0;
    }
    try{page.cleanup?.();}catch(_){}
   }catch(e){warnings.push(`صفحه ${n}: ${String(e.message||e)}`);}
   pagesScanned++;
   if(results.length>=MAX_RESULTS){warnings.push('به سقف ایمنی ۸۵۰ عنصر رسیدیم.');break;}
   if(n%4===0)await new Promise(resolve=>root.setTimeout(resolve,0));
  }
  if(pdf.numPages>total)warnings.push(`برای حفظ عملکرد، فقط ${total} صفحه از ${pdf.numPages} صفحه اسکن شد.`);
  progress?.({page:pagesScanned,total,found:results.length,done:true});
  return {items:results,pagesScanned,pagesWithCaptions,total:Number(pdf.numPages),warnings,
   method:'caption-anchored-pdfjs',note:'برش‌ها تقریبی‌اند و شکل‌های بدون عنوان ممکن است پیدا نشوند.'};
 }
 root.AyinVisualPageScan=Object.freeze({scanOpen,captionMatch,category,candidatesFromLines,fromTextItems,fromDOM,mergeLines,regionFor,readerContext,pageToCanvas,crop});
})(window);
