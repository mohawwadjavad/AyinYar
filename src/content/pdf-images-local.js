/* AyinYar 0.14 — direct embedded-raster extraction from PDFs.
 * No external executable, API, upload, payment or network. Incomplete by design:
 * not a PDF renderer; vector graphics, text-built tables and scans without image
 * XObjects are not automatically segmented. Never report full figure coverage.
 */
(function(root){
 'use strict';
 const MAX_PDF_BYTES = 130 * 1024 * 1024;
 const MAX_IMAGE_BYTES = 28 * 1024 * 1024;
 const MAX_IMAGE_COUNT = 800;
 const MAX_PIXELS = 18000000;
 const decoder = new TextDecoder('latin1');
 function num(h,k){const m=h.match(new RegExp('\\/'+k+'\\s+(\\d+)\\b'));return m?Number(m[1]):null;}
 function extractObjects(bytes){
  if(!(bytes instanceof Uint8Array))throw new Error('داده PDF معتبر نیست.');
  if(bytes.byteLength>MAX_PDF_BYTES)throw new Error('PDF از حد آزمایشی ۱۳۰ مگابایت بزرگ‌تر است.');
  if(decoder.decode(bytes.slice(0,7)).indexOf('%PDF-')!==0)throw new Error('فایل انتخاب‌شده PDF معتبر نیست.');
  const txt=decoder.decode(bytes);const re=/(\d+)\s+(\d+)\s+obj\b/g, objects=[];
  let m;
  while((m=re.exec(txt))!==null){
   let pos=re.lastIndex;
   const stream=/\bstream(?:\r\n|\n|\r)/g;stream.lastIndex=pos;
   const sm=stream.exec(txt);
   const endobj=txt.indexOf('endobj',pos);
   if(endobj===-1)break;
   // The dictionary and the stream must belong to this object.
   if(!sm||sm.index>=endobj){re.lastIndex=endobj+6;continue;}
   const header=txt.slice(pos,sm.index);
   if(!/\/Subtype\s*\/Image\b/.test(header)){re.lastIndex=endobj+6;continue;}
   const width=num(header,'Width'),height=num(header,'Height'),bpc=num(header,'BitsPerComponent');
   if(!width||!height||width*height>MAX_PIXELS){re.lastIndex=endobj+6;continue;}
   const start=stream.lastIndex;
   // PDF stream Length may be an indirect ref. endstream is a fallback only.
   const exactLength=header.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)\b/);
   const naturalEnd=txt.indexOf('endstream',start);
   if(naturalEnd<0){re.lastIndex=endobj+6;continue;}
   let end=naturalEnd,precise=false;
   if(exactLength){const reported=start+Number(exactLength[1]);if(reported<=naturalEnd+2&&reported>start){end=reported;precise=true;}}
   if(!precise)while(end>start && (bytes[end-1]===10||bytes[end-1]===13))end--;
   if(end-start>MAX_IMAGE_BYTES||end<=start){re.lastIndex=endobj+6;continue;}
   let filters=[];const arr=header.match(/\/Filter\s*\[([^\]]+)\]/);
   if(arr)filters=[...arr[1].matchAll(/\/([\w]+)/g)].map(x=>x[1]);
   else {const single=header.match(/\/Filter\s*\/([\w]+)/);if(single)filters=[single[1]];}
   const color=/\/DeviceGray\b/.test(header)?'DeviceGray':/\/DeviceRGB\b/.test(header)?'DeviceRGB':/\/DeviceCMYK\b/.test(header)?'DeviceCMYK':'Other';
   objects.push({objectId:Number(m[1]),width,height,bpc,color,filters,header,compressed:bytes.slice(start,end)});
   if(objects.length>=MAX_IMAGE_COUNT)break;
   re.lastIndex=endobj+6;
  }
  return objects;
 }
 async function decompress(src,maxBytes){
  if(typeof DecompressionStream==='undefined')throw new Error('بازکردن تصاویر Flate در این محیط پشتیبانی نمی‌شود.');
  const reader=new Blob([src]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;
    if(size>maxBytes)throw new Error('حجم تصویر فشرده‌گشایی‌شده بیش از حد مجاز است.');
    chunks.push(value);
  }}finally{try{await reader.cancel();}catch(_){}}
  const result=new Uint8Array(size);let at=0;for(const part of chunks){result.set(part,at);at+=part.length;}return result;
 }
 function decodeASCII85(bytes){
  const filtered=[];let i=0;while(i<bytes.length){const ch=bytes[i++];if(ch===60&&bytes[i]===126){i++;continue;}if(ch===126)break;if(ch===32||ch===10||ch===13||ch===9||ch===12)continue;if(ch===122){filtered.push([0,0,0,0]);continue;}if(ch>=33&&ch<=117)filtered.push(ch);}
  const out=[],buf=[];for(const token of filtered){if(Array.isArray(token)){if(buf.length)throw new Error('داده ASCII85 نامعتبر است.');out.push(...token);continue;}buf.push(token-33);if(buf.length===5){let n=0;for(const d of buf)n=n*85+d;if(n>4294967295)throw new Error('مقدار ASCII85 بزرگ‌تر از مجاز است.');out.push((n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255);buf.length=0;}}
  if(buf.length){const count=buf.length;while(buf.length<5)buf.push(84);let n=0;for(const d of buf)n=n*85+d;for(let j=0;j<count-1;j++)out.push((n>>>(24-j*8))&255);}
  return new Uint8Array(out);
 }
 function crc32(buf){let crc=0xffffffff;for(const byte of buf){crc^=byte;for(let i=0;i<8;i++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}return (crc^0xffffffff)>>>0;}
 function chunk(type, data){const result=new Uint8Array(12+data.length),length=data.length;result[0]=(length>>>24)&255;result[1]=(length>>>16)&255;result[2]=(length>>>8)&255;result[3]=length&255;const t=new TextEncoder().encode(type);result.set(t,4);result.set(data,8);const crc=crc32(result.subarray(4,8+length));for(let i=0;i<4;i++)result[8+length+i]=(crc>>>(24-8*i))&255;return result;}
 function be32(v){return new Uint8Array([(v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255]);}
 async function makePNG(samples,width,height,channels){
  if(typeof CompressionStream==='undefined')throw new Error('ساخت PNG در این موتور امکان‌پذیر نیست.');
  const stride=width*4,raw=new Uint8Array(height*(stride+1));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const dest=y*(stride+1)+1+x*4,src=(y*width+x)*channels;
   raw[dest]=samples[src];raw[dest+1]=channels===3?samples[src+1]:samples[src];raw[dest+2]=channels===3?samples[src+2]:samples[src];raw[dest+3]=255;
  }
  const compressed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const ihdr=new Uint8Array(13);ihdr.set(be32(width));ihdr.set(be32(height),4);ihdr[8]=8;ihdr[9]=6;
  const groups=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())];
  const size=groups.reduce((sum,x)=>sum+x.length,0),data=new Uint8Array(size);let i=0;for(const g of groups){data.set(g,i);i+=g.length;}return data;
 }
 function paeth(a,b,c){const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;}
 function undoPredictors(raw, width, height, bpp, predictor){
  const stride=width*bpp;
  if(predictor===1||predictor===0){if(raw.length<stride*height)throw new Error('داده تصویر ناقص است.');return raw.subarray(0,stride*height);}
  if(predictor===2){if(raw.length<stride*height)throw new Error('داده تصویر ناقص است.');const out=raw.slice(0,stride*height);for(let r=0;r<height;r++)for(let i=bpp;i<stride;i++)out[r*stride+i]=(out[r*stride+i]+out[r*stride+i-bpp])&255;return out;}
  if(predictor>=10&&predictor<=15){
   if(raw.length<(stride+1)*height)throw new Error('داده PNG predictor ناقص است.');
   const out=new Uint8Array(stride*height);
   for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)]; if(filter>4)throw new Error('فیلتر تصویر پشتیبانی نمی‌شود.');
    for(let i=0;i<stride;i++){
     const at=y*stride+i, curr=raw[y*(stride+1)+i+1],left=i>=bpp?out[at-bpp]:0,above=y?out[at-stride]:0,upperLeft=y&&i>=bpp?out[at-stride-bpp]:0;
     out[at]=(curr+([0,left,above,Math.floor((left+above)/2),paeth(left,above,upperLeft)][filter]))&255;
    }
   }
   return out;
  }
  throw new Error('پیش‌پردازش رنگ در PDF پشتیبانی نمی‌شود.');
 }
 function toBytesFromDataUrl(dataURL){const b64=dataURL.split(',')[1],bin=atob(b64);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
 async function decodedImage(obj){
  let stream=obj.compressed,filters=obj.filters.slice();
  if(filters[0]==='ASCII85Decode'){stream=decodeASCII85(stream);filters.shift();}
  if(filters.length===1&&filters[0]==='DCTDecode'&&stream[0]===255&&stream[1]===216)return {bytes:stream,extension:'jpg',mime:'image/jpeg'};
  if(filters.length!==1||filters[0]!=='FlateDecode')return null;
  if(obj.bpc!==8||!(obj.color==='DeviceRGB'||obj.color==='DeviceGray'))return null;
  const channels=obj.color==='DeviceRGB'?3:1;
  const predictor=num(obj.header,'Predictor')||1;
  const colors=num(obj.header,'Colors')||channels;
  const columns=num(obj.header,'Columns')||obj.width;
  if(colors!==channels||columns!==obj.width)return null;
  const decoded=await decompress(stream,obj.width*obj.height*channels+obj.height+65536);
  const samples=undoPredictors(decoded,obj.width,obj.height,channels,predictor);
  return {bytes:await makePNG(samples,obj.width,obj.height,channels),extension:'png',mime:'image/png'};
 }
 async function extract(bytes,progress){
  const objects=extractObjects(bytes),items=[],skipped=[];
  for(let n=0;n<objects.length;n++){
   const x=objects[n];if(progress)progress(n,objects.length);
   try{
    const data=await decodedImage(x);
    if(!data){skipped.push({id:x.objectId,reason:'فیلتر یا قالب تصویر پشتیبانی نمی‌شود'});continue;}
    const filename=`image-${String(x.objectId).padStart(5,'0')}.${data.extension}`;
    items.push({id:`pdf-${x.objectId}`,page:null,category:'figure',caption:`تصویر جاسازی‌شده PDF · شیء ${x.objectId}`,filename,confidence:'unclassified',width:x.width,height:x.height,sourceObjectId:x.objectId,_bytes:data.bytes,_mime:data.mime});
   }catch(err){skipped.push({id:x.objectId,reason:String(err.message||err)});}
  }
  if(progress)progress(objects.length,objects.length);
  return {items,found:objects.length,skipped,limit:MAX_IMAGE_COUNT};
 }
 root.AyinLocalPDF=Object.freeze({extract,extractObjects,undoPredictors});
})(window);
