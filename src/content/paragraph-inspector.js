/* AyinYar 0.11.1 — read-only WordprocessingML paragraph evidence inspector.
   Best-effort computed styles; never pretend to perform Word's actual layout. */
(function(root){
'use strict';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MAX_PARAGRAPHS=12000, MAX_SAMPLES=450, MAX_TEXT=110;
function parse(xml){const d=new DOMParser().parseFromString(xml,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('XML پاراگراف‌ها قابل خواندن نیست');return d;}
function children(n,name){return n?Array.from(n.childNodes).filter(x=>x.nodeType===1&&x.namespaceURI===W&&(!name||x.localName===name)):[];}
function child(n,name){return children(n,name)[0]||null;}
function att(n,k){return n?.getAttributeNS(W,k)||n?.getAttribute('w:'+k)||n?.getAttribute(k)||'';}
function all(n,name){return n?Array.from(n.getElementsByTagNameNS(W,name)):[];}
function number(n,scale=1){const v=Number(att(n,'val'));return Number.isFinite(v)&&att(n,'val')!==''?Math.round(v*scale*100)/100:null;}
function round(n){return n==null?null:Math.round(n*100)/100;}
function propsR(r){
  if(!r)return {};
  const f=child(r,'rFonts'),sz=child(r,'sz'),szCs=child(r,'szCs');
  const v={};
  if(f){for(const key of ['ascii','hAnsi','eastAsia','cs','asciiTheme','hAnsiTheme','csTheme','eastAsiaTheme']){const a=att(f,key);if(a)v[key]=a;}}
  if(sz)v.sizePt=number(sz,.5);
  if(szCs)v.complexSizePt=number(szCs,.5);
  const bold=child(r,'b');if(bold)v.bold=!['0','false','off'].includes(att(bold,'val').toLowerCase());
  const italic=child(r,'i');if(italic)v.italic=!['0','false','off'].includes(att(italic,'val').toLowerCase());
  const rtl=child(r,'rtl');if(rtl)v.rtl=!['0','false','off'].includes(att(rtl,'val').toLowerCase());
  return v;
}
function propsP(p){
  if(!p)return {};
  const v={},spacing=child(p,'spacing'),jc=child(p,'jc');
  if(jc)v.alignment=att(jc,'val')||null;
  if(spacing){
    const line=att(spacing,'line'),rule=att(spacing,'lineRule')||'auto';
    if(line!==''){
      const n=Number(line);
      if(Number.isFinite(n)){
        v.lineRule=rule;
        if(rule==='auto')v.lineMultiple=round(n/240);
        else v.linePt=round(n/20);
      }
    }
    for(const [k,xml] of [['beforePt','before'],['afterPt','after']]){
      const x=att(spacing,xml);if(x!==''){const n=Number(x);if(Number.isFinite(n))v[k]=round(n/20);}
    }
    for(const [k,xml] of [['beforeLines','beforeLines'],['afterLines','afterLines']]){
      const x=att(spacing,xml);if(x!==''){const n=Number(x);if(Number.isFinite(n))v[k]=round(n/100);}
    }
  }
  if(child(p,'bidi'))v.bidi=true;
  return v;
}
function merge(out,obj,origin){
  if(obj?.lineMultiple!=null){delete out.linePt;delete out._source.linePt;}
  if(obj?.linePt!=null){delete out.lineMultiple;delete out._source.lineMultiple;}
  // In WordprocessingML a theme font can supersede a literal font from an inherited style.
  for(const [literal,theme] of [['ascii','asciiTheme'],['hAnsi','hAnsiTheme'],['cs','csTheme'],['eastAsia','eastAsiaTheme']]){
    if(obj?.[literal]){delete out[theme];delete out._source[theme];}
    if(obj?.[theme]){delete out[literal];delete out._source[literal];}
  }
  for(const [k,v] of Object.entries(obj||{}))if(k!=='_source'&&v!==undefined&&v!==null&&v!==''){out[k]=v;out._source[k]=obj._source?.[k]||origin;}
  return out;
}
function newProps(){return {_source:{}};}
function styleDefs(styles){
  const doc=styles?parse(styles):null;
  const map=new Map();let defaultPara=null;
  const defaults=child(doc?.documentElement,'docDefaults');
  const runBase=propsR(child(child(defaults,'rPrDefault'),'rPr'));
  const paraBase=propsP(child(child(defaults,'pPrDefault'),'pPr'));
  for(const st of all(doc,'style')){
    const id=att(st,'styleId');if(!id)continue;
    const type=att(st,'type');if(type==='paragraph'&&att(st,'default')==='1')defaultPara=id;
    map.set(id,{id,type,basedOn:att(child(st,'basedOn'),'val'),p:propsP(child(st,'pPr')),r:propsR(child(st,'rPr'))});
  }
  return {map,defaultPara,runBase,paraBase};
}
function chain(map,id,kind,depth=0,visited=new Set()){
  if(!id||depth>18||visited.has(id))return [];
  visited.add(id);const s=map.get(id);if(!s||s.type!==kind)return [];
  return [...chain(map,s.basedOn,kind,depth+1,visited),s];
}
function pick(r,script){
  // When Word resolves fonts through theme / OS substitution, not all actual glyph fonts can be known.
  let family,via;
  if(script==='fa'){
    family=r.cs||r.eastAsia||null;via=r.cs?'cs':r.eastAsia?'eastAsia':null;
    if(!family&&(r.csTheme||r.eastAsiaTheme)){return {font:null,confidence:'unresolved-theme',slot:'cs-theme'};}
    if(!family&&(r.ascii||r.hAnsi)){family=r.hAnsi||r.ascii;via='latin-fallback';}
  }else{
    family=r.ascii||r.hAnsi||null;via=r.ascii?'ascii':r.hAnsi?'hAnsi':null;
    if(!family&&(r.asciiTheme||r.hAnsiTheme))return {font:null,confidence:'unresolved-theme',slot:'latin-theme'};
  }
  return {font:family,confidence:family?(via==='latin-fallback'?'inferred-fallback':'ooxml-defined'):'unknown',slot:via||null,sizePt:script==='fa'?(r.complexSizePt??r.sizePt??null):(r.sizePt??null)};
}
function textOfRun(run){return all(run,'t').map(t=>t.textContent||'').join('');}
function runNodes(p){
 const nodes=[];
 function walk(node){for(const el of children(node)){
   if(el.localName==='r')nodes.push(el);
   else if(['hyperlink','smartTag','sdt','sdtContent','ins'].includes(el.localName))walk(el);
 }}walk(p);return nodes;
}
function classify(text){let fa=0,en=0;for(const ch of text){if(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u.test(ch))fa++;else if(/[A-Za-z]/.test(ch))en++;}return fa&&!en?'fa':en&&!fa?'en':fa&&en?'mixed':'other';}
// Semantic classification is evidence, never an enforceable university rule.
// Do not classify table-of-contents entries as actual chapter headings/captions.
function roleOf(text,style,language){
 const t=String(text||'').replace(/[\u200c\u200d]/g,' ').replace(/\s+/g,' ').trim();
 const st=String(style||'');
 if(/heading|title|\bتیتر\b|\bعنوان\b/i.test(st))return {role:'heading-styled',confidence:'style-declared'};
 const dots=/(?:\.{4,}|…{2,}|[.·…ـ]{5,})/.test(t);
 if(dots&&(/(?:[۰-۹0-9]+\s*$|صفحه\s*[۰-۹0-9]+)/.test(t)))return {role:'toc-entry',confidence:'text-pattern'};
 if(/^(?:شکل|تصویر|نمودار|عکس|نقشه)\s*[۰-۹0-9]+(?:\s*[-_–.:٫]\s*[۰-۹0-9]+)*/i.test(t))return {role:'figure-caption-candidate',confidence:'text-pattern'};
 if(/^جدول\s*[۰-۹0-9]+(?:\s*[-_–.:٫]\s*[۰-۹0-9]+)*/i.test(t))return {role:'table-caption-candidate',confidence:'text-pattern'};
 if(t.length<=170&&/^فصل\s+(?:[۰-۹0-9]+|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم)(?:$|[:： ])/i.test(t))return {role:'chapter-heading-candidate',confidence:'text-pattern'};
 if(t.length<=170&&/^[۰-۹0-9]+(?:\s*[-_.ـ]\s*[۰-۹0-9]+){1,5}\s*[-_.ـ:،]?\s*[^\d۰-۹]/.test(t))return {role:'section-heading-candidate',confidence:'text-pattern'};
 if(t.length<=95&&/^(?:فهرست(?:\s+(?:مطالب|جداول|شکل|نمودار|منابع))?|چکیده|سپاسگزاری|تقدیم|منابع|مراجع|پیوست(?:\s+[۰-۹0-9]+)?)\s*$/i.test(t))return {role:'front-matter-candidate',confidence:'text-pattern'};
 if(t.length>=85&&(language==='fa'||language==='mixed'||language==='en'))return {role:'body-candidate',confidence:'length-only'};
 return {role:'unclassified',confidence:'unclassified'};
}
function summarize(runs,script){
 const chosen=runs.filter(x=>x.script===script||x.script==='mixed');
 if(!chosen.length)return {status:'not-present',font:null,sizePt:null};
 const vals=chosen.map(x=>x[script]);
 const ff=[...new Set(vals.map(x=>x.font).filter(Boolean))];
 const zz=[...new Set(vals.map(x=>x.sizePt).filter(x=>x!=null))];
 return {status:ff.length>1||zz.length>1?'mixed':ff.length===1&&zz.length===1?'resolved':'partial',font:ff.length===1?ff[0]:null,sizePt:zz.length===1?zz[0]:null,fonts:ff.slice(0,6),sizesPt:zz.slice(0,6),unknownRuns:vals.filter(x=>!x.font||x.sizePt==null).length,confidence:vals.some(x=>x.confidence!=='ooxml-defined')?'limited':'defined'};
}
function analyze(documentXml,stylesXml,opts={}){
  const d=parse(documentXml),defs=styleDefs(stylesXml),limit=Math.min(MAX_PARAGRAPHS,Math.max(1,opts.maxParagraphs||MAX_PARAGRAPHS));
  const body=child(d.documentElement,'body')||d.documentElement;
  const paragraphs=all(body,'p');
  const rows=[];let totalWithText=0,mixed=0,unresolved=0,directOverrides=0;
  for(let i=0;i<paragraphs.length;i++){
    const para=paragraphs[i],text=all(para,'t').map(x=>x.textContent||'').join('').trim();
    if(!text)continue;totalWithText++;
    if(rows.length>=limit)continue;
    const pPr=child(para,'pPr');
    const id=att(child(pPr,'pStyle'),'val')||defs.defaultPara;
    const paraChain=chain(defs.map,id,'paragraph');
    const pp=newProps(),rr=newProps();
    merge(pp,defs.paraBase,'docDefaults');merge(rr,defs.runBase,'docDefaults');
    for(const st of paraChain){merge(pp,st.p,'paragraph-style:'+st.id);merge(rr,st.r,'paragraph-style:'+st.id);}
    merge(pp,propsP(pPr),'direct-paragraph');
    const details=[];
    for(const node of runNodes(para)){
      const t=textOfRun(node);if(!t||!t.trim())continue;
      const rpr=child(node,'rPr'),crId=att(child(rpr,'rStyle'),'val');
      const computed=newProps();merge(computed,rr,'paragraph-inherited');
      for(const st of chain(defs.map,crId,'character'))merge(computed,st.r,'character-style:'+st.id);
      const direct=propsR(rpr);merge(computed,direct,'direct-run');
      if(Object.keys(direct).length)directOverrides++;
      const kind=classify(t);
      const rec={script:kind,textLength:t.length,fa:pick(computed,'fa'),en:pick(computed,'en'),source:computed._source};
      details.push(rec);
    }
    const fr=summarize(details,'fa'),en=summarize(details,'en');
    if(fr.status==='mixed'||en.status==='mixed')mixed++;
    if(fr.status==='partial'||en.status==='partial')unresolved++;
    const semantic=roleOf(text,id||'',classify(text));
    const row={paragraph_number:i+1,text_preview:text.slice(0,MAX_TEXT),style_id:id||null,role:semantic.role,role_confidence:semantic.confidence,
       alignment:pp.alignment??null,line_spacing:pp.lineMultiple!=null?{unit:'multiple',value:pp.lineMultiple,source:pp._source.lineMultiple}:pp.linePt!=null?{unit:'pt',value:pp.linePt,rule:pp.lineRule||'exact',source:pp._source.linePt}:null,
       space_before_pt:pp.beforePt??null,space_after_pt:pp.afterPt??null,
       paragraph_sources:{alignment:pp._source.alignment||null,spacing:pp._source.lineMultiple||pp._source.linePt||null,before:pp._source.beforePt||null,after:pp._source.afterPt||null},
       language:classify(text),fa:fr,en,run_count:details.length,
       issues:[]};
    if(fr.status==='mixed'||en.status==='mixed')row.issues.push('یک پاراگراف دارای چند فونت یا اندازه قلم برای یک زبان است؛ ممکن است عمدی باشد.');
    if(pp.lineMultiple==null&&pp.linePt==null)row.issues.push('فاصله خطوط از XML/سبک‌ها قابل تعیین نیست.');
    if(fr.unknownRuns||en.unknownRuns)row.issues.push('برخی فونت‌ها یا اندازه‌ها از سبک یا قالب سند به‌طور قطعی حل نشدند.');
    rows.push(row);
  }
  return {version:'0.11.1',scope:'main-document-paragraphs',paragraphs_with_text:totalWithText,analyzed:rows.length,truncated:totalWithText>limit,
     notes:['فقط پاراگراف‌های متن اصلی Word بررسی شده‌اند؛ سربرگ، پابرگ، پاورقی و اشیای شناور ممکن است پوشش داده نشوند.',
       'قلم نمایش‌داده‌شده توسط Word ممکن است به‌دلیل جایگزینی فونت سیستم با مقدار XML متفاوت باشد.',
       'شماره پاراگراف براساس ترتیب XML است، نه شماره صفحه چاپ‌شده یا شماره پاراگراف در Word.',
       'اعداد اندازه قلم و فاصله خطوط از سبک‌ها و فرمت مستقیم محاسبه شده‌اند؛ بعضی موارد مانند تم، جدول و نشانه‌های فهرست نیازمند کنترل دستی‌اند.'],
     summary:{mixed_language_format_paragraphs:mixed,partially_unresolved_paragraphs:unresolved,run_level_overrides:directOverrides},paragraphs:rows};
}
const api=Object.freeze({analyze,roleOf});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.AyinParagraphs=api;
})(typeof window==='undefined'?globalThis:window);
