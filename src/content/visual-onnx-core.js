/* AyinYar 0.21.4: pure, testable local layout/caption match helpers. */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const isRect=r=>r&&['x','y','w','h'].every(k=>Number.isFinite(r[k]))&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=1.01&&r.y+r.h<=1.01;
 function boxIoU(a,b){if(!isRect(a)||!isRect(b))return 0;
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-x),h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-y);
  const union=a.w*a.h+b.w*b.h-w*h;return union>0?w*h/union:0;
 }
 function paddedRect(r,amount=.008){if(!isRect(r))return null;
  const x=clamp(r.x-amount,0,1),y=clamp(r.y-amount,0,1);
  return {x:+x.toFixed(5),y:+y.toFixed(5),w:+clamp(r.x+r.w+amount-x,.001,1-x).toFixed(5),h:+clamp(r.y+r.h+amount-y,.001,1-y).toFixed(5)};
 }
 function captionType(caption,detected){const s=String(caption||'');
  if(detected==='table')return 'table';if(detected==='formula')return 'formula';
  if(/(?:\b(?:chart|graph|plot|curve|histogram|scatter|boxplot|heatmap)\b|نمودار|چارت|هیستوگرام|منحنی)/i.test(s))return 'chart';
  if(/(?:diagram|schema|schematic|flowchart|network|map|plan|elevation|section view|dendrogram|نقشه|پلان|دیاگرام|شماتیک|فلوچارت)/i.test(s))return 'drawing';
  return 'figure';
 }
 function matchCaption(region,category,captions){if(!isRect(region))return null;let best=null,score=-1;
  for(const cap of captions||[]){const line=cap.line;if(!line||!Number.isFinite(line.y))continue;
   const center=region.x+region.w/2,cc=clamp((line.x+(line.right||line.x+.1))/2,0,1);
   const horiz=Math.max(0,1-Math.abs(cc-center));
   // Caption below figure; above table. Soft fallback for unconventional journal layouts.
   const distance=category==='table'?region.y-line.y:line.y-(region.y+region.h);
   const positive=distance>=-.02&&distance<=.24;
   const closeness=Math.max(0,1-Math.abs(distance)/.32);
   if(Math.abs(distance)>.36||horiz<.40)continue;
   const rating=(positive?2:0)+closeness+horiz;
   if(rating>score){score=rating;best=cap;}
  }
  return score>=1.65?best:null;
 }
 function normalizeDetections(raw,captions,page){if(!Array.isArray(raw)||raw.length>600)throw Error('پاسخ مدل قابل اعتماد نیست.');
  const out=[];
  for(const box of raw){
   if(!['figure','table','formula'].includes(box?.category)||!isRect(box.region)||!Number.isFinite(box.score)||box.score<.15||box.score>1)continue;
   const region=paddedRect(box.region,.009);if(!region||region.w<.035||region.h<.014)continue;
   if(out.some(e=>e.modelCategory===box.category&&boxIoU(region,e.region)>.72))continue;
   const cap=matchCaption(region,box.category,captions);
   const category=captionType(cap?.caption,box.category);
   const name=cap?.caption||({'table':'جدول','figure':'شکل','formula':'فرمول'})[box.category]+' بدون عنوان';
   out.push({region,category,modelCategory:box.category,caption:name,confidence:Number(box.score.toFixed(3)),
     sourceCaption:cap?.caption||null,reviewRequired:true,classificationReviewed:false,
     captureMethod:'local-onnx-layout',page:page,model:'DocLayout-YOLO-DocStructBench'});
  }
  return out.slice(0,90);
 }
 root.AyinVisualONNXCore=Object.freeze({boxIoU,paddedRect,captionType,matchCaption,normalizeDetections,isRect});
})(window);
