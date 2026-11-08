/* AyinYar 0.21.4: bridge between Zotero PDF.js and optional CPU ONNX local helper.
 * Never transmits documents to a remote service; only image bytes to loopback.
 * If the helper is unavailable, use the prior caption-based scanner.
 */
(function(root){
 'use strict';
 const ENDPOINT='http://127.0.0.1:45317/v1';
 const MAX_PAGES=350,MAX_RESULTS=800;
 const core=root.AyinVisualONNXCore;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const pause=()=>new Promise(resolve=>root.setTimeout(resolve,0));
 function timeoutSignal(signal,ms){const controller=new AbortController();
  if(signal)signal.addEventListener('abort',()=>controller.abort(),{once:true});
  let timer=root.setTimeout(()=>controller.abort(),ms);
  return {signal:controller.signal,clear(){root.clearTimeout(timer);}};
 }
 async function health(){const control=timeoutSignal(null,3000);
  try{const r=await fetch(ENDPOINT+'/health',{cache:'no-store',signal:control.signal,credentials:'omit'});
   if(!r.ok)throw Error('سرویس با کد '+r.status+' پاسخ داد.');
   const j=await r.json();if(!j?.ok||j.engine!=='DocLayout-YOLO-ONNX'||j.local!==true)throw Error('سرویس پاسخ غیرمنتظره داد.');
   return j;
  }finally{control.clear();}
 }
 function canvasJpegBase64(source){const size=1024;
  const ratio=Math.min(1,size/Math.max(source.width,source.height));
  const c=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');
  c.width=Math.max(1,Math.round(source.width*ratio));c.height=Math.max(1,Math.round(source.height*ratio));
  const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,0,0,c.width,c.height);
  const data=c.toDataURL('image/jpeg',.82);c.width=0;c.height=0;
  if(!data.startsWith('data:image/jpeg;base64,')||data.length>11*1024*1024)throw Error('صفحه PDF برای مدل بیش از حد بزرگ است.');
  return data.split(',')[1];
 }
 async function detect(canvas,{signal,threshold=.27}={}){
  const image=canvasJpegBase64(canvas);const ctl=timeoutSignal(signal,75000);
  try{
   const r=await fetch(ENDPOINT+'/detect',{method:'POST',headers:{'Content-Type':'application/json','X-AyinYar-Client':'visual-library'},
     body:JSON.stringify({image,threshold}),signal:ctl.signal,credentials:'omit',cache:'no-store'});
   const result=await r.json();if(!r.ok||!result?.ok||!Array.isArray(result.boxes))throw Error(result?.error||'پاسخ سرویس ONNX معتبر نیست.');
   return result.boxes;
  }finally{ctl.clear();}
 }
 async function scanOpen({signal,progress,maxPages=MAX_PAGES}={}){
  const scanner=root.AyinVisualPageScan;
  if(!scanner?.readerContext||!scanner?.pageToCanvas||!scanner?.crop)throw Error('موتور PDF.js آماده نیست.');
  await health();
  const context=scanner.readerContext(),pdf=context.pdfDocument;
  const total=pdf?Math.min(Number(pdf.numPages)||0,MAX_PAGES,maxPages):context.renderedPages.length;
  if(!total)throw Error('صفحه قابل خواندن پیدا نشد.');
  const items=[],warnings=[];let pagesScanned=0,failures=0;
  for(let i=1;i<=total;i++){
   if(signal?.aborted){warnings.push('پردازش به درخواست کاربر متوقف شد.');break;}
   const pdfPage=pdf?await pdf.getPage(i):null;
   const domPage=pdf?null:context.renderedPages[i-1];
   const pageNumber=pdf?i:Number(domPage?.getAttribute('data-page-number'))||i;
   progress?.({page:i,total,found:items.length});
   let pageCanvas=null;
   try{
    pageCanvas=pdf?await scanner.pageToCanvas(pdfPage):(domPage?.querySelector('.canvasWrapper canvas')||domPage?.querySelector('canvas'));
    if(!pageCanvas?.width||!pageCanvas?.height)throw Error('صفحه رندر نشده است.');
    let lines=[];
    if(pdfPage){try{const text=await pdfPage.getTextContent();lines=scanner.fromTextItems(text.items,pdfPage.getViewport({scale:1}));}catch(_){}}
    else if(domPage)lines=scanner.fromDOM(domPage);
    const captions=scanner.candidatesFromLines(lines,pageNumber);
    const boxes=await detect(pageCanvas,{signal});
    const regions=core.normalizeDetections(boxes,captions,pageNumber);
    for(let j=0;j<regions.length;j++){
     if(signal?.aborted||items.length>=MAX_RESULTS)break;
     const c=regions[j],img=await scanner.crop(pageCanvas,c.region);
     if(!img)continue;
     // Quantized coordinates form a stable dedupe id for repeated scans.
     const r=c.region,idParts=[pageNumber,c.modelCategory,Math.round(r.x*1000),Math.round(r.y*1000),Math.round(r.w*1000),Math.round(r.h*1000)];
     items.push({...c,id:`onnx-${context.sourceItemKey||context.sourceItemID||'pdf'}-${idParts.join('-')}`,
      sourcePDF:context.sourcePDF,sourceItemKey:context.sourceItemKey,sourceItemID:context.sourceItemID,
      filename:`onnx-p${pageNumber}-${j}.png`,_bytes:img.bytes,_mime:'image/png',width:img.width,height:img.height});
    }
    pagesScanned++;failures=0;
   }catch(e){if(signal?.aborted){warnings.push('پردازش متوقف شد.');break;}
     warnings.push(`صفحه ${pageNumber}: ${String(e.message||e)}`);pagesScanned++;failures++;
     if(failures>=3)throw Error('سه صفحه پیاپی ناموفق بود؛ برای پیشگیری از اتلاف زمان و منابع، اسکن متوقف شد. '+String(e.message||e));
   }finally{if(pdfPage){try{pdfPage.cleanup?.();}catch(_){}}if(pdf&&pageCanvas){pageCanvas.width=0;pageCanvas.height=0;}}
   if(items.length>=MAX_RESULTS){warnings.push('سقف ایمنی ۸۰۰ عنصر تکمیل شد.');break;}
   if(i%2===0)await pause();
  }
  progress?.({page:pagesScanned,total,found:items.length,done:true});
  if(!pdf)warnings.push('در این نسخه Zotero فقط صفحه‌های رندرشده قابل دسترس بودند؛ ممکن است تمام PDF اسکن نشده باشد.');
  if(pdf&&pdf.numPages>total)warnings.push(`${pdf.numPages-total} صفحه به دلیل سقف پردازش اسکن نشد.`);
  return {items,warnings,pagesScanned,total,method:'local-onnx-layout',model:'DocLayout-YOLO-DocStructBench',reviewRequired:true};
 }
 root.AyinVisualONNX=Object.freeze({health,detect,scanOpen,canvasJpegBase64});
})(window);
