/* AyinYar 0.14.0 — local-only reference evidence and advisory audits. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const pageNames = { dashboard:'داشبورد پژوهشی', references:'بازرس منابع Zotero', related:'کشف مقالات مرتبط', matrix:'ماتریس پیشینه و شواهدیار', 'ai-local':'دستیار هوش مصنوعی', 'ai-rag':'گفت‌وگوی مستند با PDF', visuals:'گالری تصاویر و جداول', word:'بازرس فایل Word', compliance:'کنترل انطباق رساله', regulations:'بانک مقررات', news:'اطلاعیه‌ها و اخبار پژوهشی', deadlines:'مهلت‌ها و تقویم پژوهشی', university:'انتخاب واحد دانشگاهی', researcher:'پروفایل پژوهشگر', about:'درباره آیین‌یار' };
  let referenceReport = null;
  let refRows=[];let refEvidence=[];let refFilter='all',refSearch='',refPage=0;let refSource='SJR',refQuartile='Q1';
  const REF_PAGE_SIZE=45,REF_EVIDENCE_KEY='extensions.ayinyar.quartiles.user.v1';
  let wordReport = null;
  let complianceDegree = 'phd';
  let complianceReport = null;
  let paragraphFilter = 'all';
  let paragraphRoleFilter='all', paragraphSearch='', paragraphPage=0;
  const PARAGRAPH_PAGE_SIZE=80;
  const canAccessZotero = () => Boolean(window.opener && (window.opener.ZoteroPane || window.opener.Zotero));
  const getZotero = () => window.opener?.Zotero || window.Zotero;
  const show = (id, value) => { const node=$(id); if (node) node.textContent = value; };
  const add = (tag, className, text) => { const el=document.createElementNS('http://www.w3.org/1999/xhtml',tag); if(className) el.className=className; if(text!==undefined) el.textContent=text; return el; };
  function switchPage(id) {
    for (const pane of document.querySelectorAll('.page')) pane.classList.toggle('active',pane.id==='page-'+id);
    window.AyinSidebar?.activate(id);
    show('top-title',pageNames[id] || pageNames.dashboard);
    if(id==='deadlines')renderDeadlines();
  }
  function safeGet(item, field) { try { return item.getField(field) || ''; } catch (e) { return ''; } }
  function safeCount(item) { try { return item.getCreators().length; } catch (e) { return 0; } }
  function loadRefEvidence(){
    try{const raw=window.AYINYAR_DEMO?'[]':window.AyinPrefs.read(REF_EVIDENCE_KEY,'[]');
      const list=JSON.parse(raw);if(!Array.isArray(list))throw new Error('ساختار بانک شواهد صحیح نیست.');
      refEvidence=window.AyinRefPro.distinct(list);show('refpro-evidence-status',`${refEvidence.length} شاهد واردشده توسط کاربر در بانک محلی ثبت شده است؛ اصالت آن‌ها به‌طور مستقل تأیید نشده.`);
    }catch(e){refEvidence=[];show('refpro-evidence-status','خواندن بانک شواهد ممکن نبود: '+e.message);}
  }
  function saveRefEvidence(entries){
    if(entries.length>1500)throw new Error('بانک محلی حداکثر ۱۵۰۰ شاهد را نگه می‌دارد. CSV را به مجلات مورد نیاز محدود کن.');
    const clean=window.AyinRefPro.distinct(entries);const serialized=JSON.stringify(clean);
    if(serialized.length>600000)throw new Error('حجم شواهد برای تنظیمات محلی بیش از حد است؛ CSV کوچک‌تری وارد کن.');
    if(!window.AYINYAR_DEMO)window.AyinPrefs.write(REF_EVIDENCE_KEY,serialized);
    refEvidence=clean;show('refpro-evidence-status',`${refEvidence.length} شاهد ذخیره شد. رتبه‌ها از منابع واردشده توسط کاربر هستند و تأیید زنده نشده‌اند.`);
    if(referenceReport)refreshRefRows();
  }
  function collectSelectedReferences(){
    if(window.AYINYAR_DEMO)return (window.AYINYAR_DEMO.references||[]).map(x=>({...x,ISSN:x.ISSN||'',attachmentCount:x.attachmentCount||0,pdfCount:x.pdfCount||0,tagCount:x.tagCount||0,noteCount:x.noteCount||0}));
    const pane=window.opener?.ZoteroPane||getZotero()?.getActiveZoteroPane();
    if(!pane)throw new Error('پنجره اصلی Zotero در دسترس نیست.');
    const selected=pane.getSelectedItems()||[],results=[];
    for(const item of selected){
      if(!item||!item.isRegularItem||!item.isRegularItem())continue;
      const childIds=typeof item.getAttachments==='function'?item.getAttachments():[];
      let pdfCount=0;for(const id of childIds){try{const a=getZotero()?.Items.get(id);if(a&&(/pdf/i.test(a.attachmentContentType||'')||/\.pdf$/i.test(a.attachmentFilename||'')))pdfCount++;}catch(_){}}
      let tagCount=0,noteCount=0;try{tagCount=item.getTags().length;}catch(_){}try{noteCount=item.getNotes().length;}catch(_){}
      results.push({title:safeGet(item,'title'),type:item.itemType||'',date:safeGet(item,'date'),creatorCount:safeCount(item),publicationTitle:safeGet(item,'publicationTitle'),bookTitle:safeGet(item,'bookTitle'),university:safeGet(item,'university'),DOI:safeGet(item,'DOI'),ISSN:safeGet(item,'ISSN'),abstractNote:safeGet(item,'abstractNote'),url:safeGet(item,'url'),key:item.key,libraryID:item.libraryID,attachmentCount:childIds.length,pdfCount,tagCount,noteCount});
    }return results;
  }
  function inspectReferences(){
    let records=[];try{records=collectSelectedReferences();}catch(error){show('reference-status','دریافت منابع ممکن نشد: '+error.message);return;}
    if(!records.length){show('reference-status','هیچ منبع اصلی انتخاب نشده است؛ مقاله، کتاب یا رساله را انتخاب کن (نه فایل PDF تنها).');return;}
    const validations=records.map(r=>window.AyinValidators.auditItem(r));
    const seen=new Map();validations.forEach((r,i)=>{const k=window.AyinValidators.duplicateKey(records[i]);if(!k)return;
      if(seen.has(k)){const notice='احتمال تکراری بودن در همین انتخاب؛ بررسی انسانی، بدون حذف یا ادغام خودکار.';r.issues.push(notice);validations[seen.get(k)].issues.push(notice);}else seen.set(k,i);
    });
    refRows=records.map((r,i)=>({record:r,audit:validations[i],quality:window.AyinRefPro.quality(r),advisories:window.AyinRefPro.diagnose(r),quartile:window.AyinRefPro.match(r,refEvidence)}));
    refFilter='all';refSearch='';refPage=0;$('refpro-search').value='';setRefFilter('all');refreshRefRows();
  }
  function refreshRefRows(){
    refRows.forEach(r=>{r.quartile=window.AyinRefPro.match(r.record,refEvidence);});
    const issues=refRows.reduce((s,r)=>s+r.audit.issues.length,0);
    referenceReport={app:'AyinYar',version:'0.13.0',type:'reference-evidence-audit',university:'iau-najafabad',generated_at:new Date().toISOString(),selected_count:refRows.length,issues_count:issues,
      quartile_caution:'شواهد چارک صرفاً واردشده توسط کاربر هستند، با سال مقاله و دسته علمی تطبیق یافته‌اند، اما اعتبار آنلاین یا حقوق بازنشر آن‌ها تأیید نشده است. JCR و SJR معادل نیستند.',
      records:refRows.map(r=>({...r.audit,metadata:r.record,completeness:r.quality,advisories:r.advisories,quartile:r.quartile})),notice:'بدون تغییر در کتابخانه Zotero؛ کامل بودن فراداده کیفیت پژوهش را تعیین نمی‌کند.'};
    show('stat-items',String(refRows.length));show('stat-issues',String(issues));
    show('refpro-count',String(refRows.length));show('refpro-ready',String(refRows.filter(x=>x.quality.ratio===100).length));
    show('refpro-pdf',String(refRows.filter(x=>x.record.pdfCount>0).length));show('refpro-q',String(refRows.filter(x=>x.quartile.matches?.length&&x.quartile.status==='issn-matched').length));
    show('reference-status',`${refRows.length} منبع بررسی شد؛ ${issues} اخطار فراداده، ${refRows.filter(x=>x.quartile.status==='issn-matched').length} مورد چارک با تطبیق ISSN و سال. داده‌های اصلی تغییر نکردند.`);
    $('save-reference-report').disabled=false;$('save-reference-csv').disabled=false;renderRefRows();
  }
  function setRefFilter(value){refFilter=value;document.querySelectorAll('[data-ref-filter]').forEach(b=>{const active=b.dataset.refFilter===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});renderRefRows();}
  function quartileCell(r){
    const q=r.quartile,td=add('td');
    if(!q.matches?.length){td.appendChild(add('span','pill neutral','ناموجود'));td.appendChild(add('div','refpro-td-sub',q.note||'شواهد متناسب ثبت نشده است.'));if(q.availableYears?.length)td.appendChild(add('div','refpro-td-sub','سال‌های دیگر در بانک: '+q.availableYears.join('، ')));return td;}
    for(const x of q.matches.slice(0,6)){
      td.appendChild(add('span','refpro-q',x.source+' '+x.quartile+' · '+x.year));
      td.appendChild(add('div','refpro-td-sub',x.category));
      if(x.url){const a=add('a','refpro-evidence-link','مشاهده منبع واردشده');a.setAttribute('href',x.url);a.setAttribute('target','_blank');a.setAttribute('rel','noopener noreferrer');a.addEventListener('click',event=>{if(!window.AYINYAR_DEMO){try{const z=getZotero();if(typeof z?.launchURL==='function'){event.preventDefault();z.launchURL(x.url);}}catch(_){}}});td.appendChild(a);}
    }
    td.appendChild(add('div','refpro-td-sub',q.status==='issn-matched'?'تطبیق ISSN و سال · تأییدنشده توسط آیین‌یار':'تطبیق عنوان بدون ISSN · نیازمند تأیید'));
    return td;
  }
  function renderRefRows(){const target=$('reference-results');if(!target)return;target.replaceChildren();
    const needle=refSearch.trim().toLocaleLowerCase();
    const filtered=refRows.filter(r=>{
      const match=[r.record.title,r.record.publicationTitle,r.record.DOI,r.record.ISSN,r.record.key].some(x=>String(x||'').toLocaleLowerCase().includes(needle));
      if(!match)return false;
      if(refFilter==='attention')return Boolean(r.audit.issues.length||r.advisories.some(x=>!x.includes('به‌تنهایی خطا نیست'))||r.quality.missing.length);
      if(refFilter==='withq')return Boolean(r.quartile.matches?.length);if(refFilter==='noq')return !r.quartile.matches?.length;return true;});
    const totalPages=Math.max(1,Math.ceil(filtered.length/REF_PAGE_SIZE));refPage=Math.min(Math.max(refPage,0),totalPages-1);
    const rows=filtered.slice(refPage*REF_PAGE_SIZE,(refPage+1)*REF_PAGE_SIZE);
    if(!rows.length){const tr=add('tr');const td=add('td','empty','موردی مطابق این جست‌وجو و فیلتر پیدا نشد.');td.setAttribute('colspan','5');tr.appendChild(td);target.appendChild(tr);}
    for(const r of rows){const tr=add('tr');const title=add('td');title.appendChild(add('div','refpro-td-title',r.record.title||'بدون عنوان'));title.appendChild(add('div','refpro-td-sub',r.record.publicationTitle||r.record.type||'—'));
      title.appendChild(add('div','refpro-td-sub',r.record.ISSN?'ISSN: '+r.record.ISSN:r.record.DOI?'DOI: '+r.record.DOI:'شناسه نشریه ثبت نشده'));tr.appendChild(title);
      const quality=add('td');quality.appendChild(add('strong','',`${r.quality.complete} از ${r.quality.total}`));quality.appendChild(add('div','refpro-td-sub',r.quality.missing.length?'ناقص: '+r.quality.missing.join('، '):'فیلدهای منتخب کامل‌اند'));tr.appendChild(quality);
      tr.appendChild(add('td','',`PDF: ${r.record.pdfCount||0} · فایل: ${r.record.attachmentCount||0} · برچسب: ${r.record.tagCount||0} · یادداشت: ${r.record.noteCount||0}`));tr.appendChild(quartileCell(r));
      const issues=add('td','issue-lines');for(const text of [...r.audit.issues,...r.advisories])issues.appendChild(add('div','', '• '+text));if(!issues.hasChildNodes())issues.textContent='بدون ایراد آشکار در فیلدهای بررسی‌شده';tr.appendChild(issues);target.appendChild(tr);
    }
    show('refpro-count-status',`${filtered.length} نتیجه از ${refRows.length} منبع؛ هر صفحه تا ${REF_PAGE_SIZE} ردیف`);
    show('refpro-page',`صفحه ${refPage+1} از ${totalPages}`);$('refpro-prev').disabled=refPage===0;$('refpro-next').disabled=refPage>=totalPages-1;
  }
  async function importRefEvidence(){
    if(window.AYINYAR_DEMO){show('refpro-evidence-status','در پیش‌نمایش، واردکردن فایل غیرفعال است.');return;}
    try{const file=await window.AyinFileDialog.pick({mode:'open',title:'واردکردن فایل CSV چارک مجلات',filterTitle:'CSV (*.csv;*.tsv)',filterPattern:'*.csv;*.tsv'});if(!file)return;
      const raw=window.AyinFileDialog.readUTF8(file,24*1024*1024);
      const parsed=window.AyinRefPro.importCSV(raw,{defaultYear:Number($('refpro-import-year').value),source:refSource});
      // Store ONLY journals currently selected in Zotero (if selection exists); full SJR catalogs are not reproduced.
      const current=refRows.map(r=>r.record);
      if(!current.length)throw new Error('ابتدا منابع مجلات را در Zotero بررسی کن تا فقط شواهد مربوط به همان مجلات ذخیره شوند.');
      const ids=new Set(current.flatMap(r=>window.AyinRefPro.issns(r.ISSN)));const names=new Set(current.map(r=>window.AyinRefPro.normTitle(r.publicationTitle)).filter(Boolean));
      const scoped=parsed.entries.filter(e=>(e.issn&&ids.has(e.issn)) || (e.journal&&names.has(window.AyinRefPro.normTitle(e.journal))));
      if(!scoped.length){show('refpro-evidence-status',`فایل خوانده شد (${parsed.entries.length} شاهد) اما هیچ موردی با ISSN یا نام مجلات انتخاب‌شده مطابق نبود؛ داده‌ای ذخیره نشد.`);return;}
      saveRefEvidence([...refEvidence,...scoped]);show('refpro-evidence-status',`${scoped.length} شاهد مرتبط با مجلات منتخب ذخیره شد (${parsed.entries.length} شاهد قابل‌خواندن در فایل). داده‌ها تأیید رسمی نشده‌اند.`);
    }catch(e){show('refpro-evidence-status','واردکردن CSV ممکن نشد: '+e.message);}
  }
  function toggleRefButtons(selector,attribute,value){document.querySelectorAll(selector).forEach(b=>{const selected=b.getAttribute(attribute)===value;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}
  function saveManualEvidence(){
    try{const e=window.AyinRefPro.normalizeEvidence({issn:$('refpro-manual-issn').value,journal:$('refpro-manual-journal').value,year:$('refpro-manual-year').value,category:$('refpro-manual-category').value,url:$('refpro-manual-url').value,source:refSource,quartile:refQuartile});
      saveRefEvidence([...refEvidence,e]);
    }catch(error){show('refpro-evidence-status','ثبت شواهد انجام نشد: '+error.message);}
  }
  async function exportRefEvidence(){if(window.AYINYAR_DEMO)return;
    try{const file=await window.AyinFileDialog.pick({mode:'save',title:'نسخه پشتیبان شواهد چارک',filterTitle:'JSON (*.json)',filterPattern:'*.json',defaultString:'AyinYar-Quartile-Evidence.json',defaultExtension:'json'});if(!file)return;window.AyinFileDialog.writeUTF8(file,JSON.stringify({app:'AyinYar',type:'user-supplied-quartile-evidence',version:1,records:refEvidence},null,2));show('refpro-evidence-status','پشتیبان شواهد چارک ذخیره شد؛ مجوز بازتوزیع داده‌ها بر عهده دارنده آن است.');}
    catch(e){show('refpro-evidence-status','خروجی شواهد ممکن نشد: '+e.message);}
  }
  function parseXML(xml) {
    const parsed = new DOMParser().parseFromString(xml,'application/xml');
    if (parsed.getElementsByTagName('parsererror').length) throw new Error('ساختار XML فایل Word معتبر نیست.');
    return parsed;
  }
  function descendants(node, name) { return Array.from(node.getElementsByTagNameNS(W,name)); }
  function wattr(node, name) { return node?.getAttributeNS(W,name) || node?.getAttribute('w:'+name) || node?.getAttribute(name) || ''; }
  function titleCase(x) { return (x || '').trim(); }
  function extractDocxStructure(documentXml,stylesXml,filename) {
    const doc=parseXML(documentXml);
    const allP=descendants(doc,'p'); const allTables=descendants(doc,'tbl');
    let paragraphCount=0, textParts=[], headingCount=0, namedHeads=[];
    const fonts=new Set();const textSizes=new Set();
    for (const para of allP) {
      const directTexts=descendants(para,'t').map(x=>x.textContent || '').join('');
      if (directTexts.trim()) { paragraphCount++; textParts.push(directTexts.trim()); }
      const styleNode=descendants(para,'pStyle')[0];const styleId=wattr(styleNode,'val');
      if (/heading|title|فصل|تیتر/i.test(styleId)) { headingCount++;if(directTexts.trim()) namedHeads.push(directTexts.trim().slice(0,100)); }
      for (const e of descendants(para,'rFonts')) {
        for (const attr of ['ascii','hAnsi','eastAsia','cs']) { const v=wattr(e,attr); if(v)fonts.add(v); }
      }
      for (const e of descendants(para,'sz')) { const v=Number(wattr(e,'val')); if(v>0&&v<200)textSizes.add(v/2); }
    }
    if (stylesXml) {
      const sdoc=parseXML(stylesXml);
      for (const e of descendants(sdoc,'rFonts')) for (const attr of ['ascii','hAnsi','eastAsia','cs']) {const v=wattr(e,attr);if(v) fonts.add(v);}
      for (const e of descendants(sdoc,'sz')) {const v=Number(wattr(e,'val'));if(v>0&&v<200)textSizes.add(v/2);}
    }
    const sects=descendants(doc,'sectPr');const sect=sects.length?sects[sects.length-1]:null;
    const sz=sect?descendants(sect,'pgSz')[0]:null;
    const margins=sect?descendants(sect,'pgMar')[0]:null;
    const twipMM=n => n ? Math.round(Number(n)/1440*25.4*10)/10 : null;
    const pageW=twipMM(wattr(sz,'w')),pageH=twipMM(wattr(sz,'h'));
    const a4=pageW && pageH ? ((Math.abs(pageW-210)<3&&Math.abs(pageH-297)<3)||(Math.abs(pageW-297)<3&&Math.abs(pageH-210)<3)) : null;
    const dims=pageW?`${pageW} × ${pageH} میلی‌متر`:null;
    const sectionDetails=sects.map((section,index)=>{
      const sectionSz=descendants(section,'pgSz')[0], sectionMar=descendants(section,'pgMar')[0];
      const margins=sectionMar?Object.fromEntries(['top','bottom','right','left'].map(k=>[k,twipMM(wattr(sectionMar,k))])):null;
      return {section:index+1,width_mm:twipMM(wattr(sectionSz,'w')),height_mm:twipMM(wattr(sectionSz,'h')),margins_mm:margins};
    });
    const revisionCounts={insertions:descendants(doc,'ins').length,deletions:descendants(doc,'del').length,comment_refs:descendants(doc,'commentReference').length};
    const bibliographyMarkers=allP.filter(para=>/^(منابع|فهرست منابع|مراجع|references|bibliography)\s*[:：]?$/.test(descendants(para,'t').map(x=>x.textContent||'').join('').trim().toLowerCase())).length;
    const fieldStrings=descendants(doc,'instrText').map(x=>x.textContent||'').join('');
    const hasZotero=/ZOTERO_ITEM|ZOTERO_BIBL/i.test(fieldStrings);
    const hasCitationFields=/CSL_CITATION|ZOTERO_ITEM/i.test(fieldStrings);
    const text=textParts.join(' ');
    const countWords=text.trim() ? text.trim().split(/\s+/).length : 0;
    const openingText=textParts.slice(0,40).join(' ').normalize('NFKC');
    const openingSignals={
      institution:/دانشگاه|university of/i.test(openingText),
      thesisOrDissertation:/پایان\s*نامه|پایاننامه|رساله|thesis|dissertation/i.test(openingText),
      author:/نام\s*دانشجو|نگارنده|تهیه\s*و\s*تدوین|\bby\b/i.test(openingText),
      supervisor:/استاد\s*راهنما|supervisor/i.test(openingText),
      advisor:/استاد\s*مشاور|advisor/i.test(openingText),
      graduationDate:/سال\s*(تحصیلی|دفاع|آموختگی)|[۰-۹0-9]{4}/i.test(openingText),
      mastersMarker:/کارشناسی\s*ارشد|master(?:'s)?|m\.?sc\.?|m\.?a\.?/i.test(openingText),
      phdMarker:/دکتری|دکترای|ph\.?d|doctor of philosophy/i.test(openingText)
    };
    const report={app:'AyinYar',version:'0.11.1',type:'docx-structural-advisory',filename,generated_at:new Date().toISOString(),paragraphs:paragraphCount,words_approx:countWords,tables:allTables.length,pictures_approx:descendants(doc,'drawing').length,heading_styles_detected:headingCount,heading_examples:namedHeads.slice(0,8),opening_signals:openingSignals,defined_fonts:[...fonts].sort().slice(0,50),defined_sizes_pt:[...textSizes].sort((a,b)=>a-b).slice(0,30),page_size_mm:{width:pageW,height:pageH},looks_like_A4:a4,margins_mm:margins?{top:twipMM(wattr(margins,'top')),bottom:twipMM(wattr(margins,'bottom')),right:twipMM(wattr(margins,'right')),left:twipMM(wattr(margins,'left'))}:null,zotero_citation_fields_detected:hasZotero,citation_fields_detected:hasCitationFields,notes:['بعضی فونت‌ها و اندازه‌ها در سبک‌های تعریف‌شده هستند و ممکن است در متن استفاده نشده باشند.','سربرگ، پابرگ، اشکال شناور و ظاهر صفحه‌بندی‌شده به‌طور کامل بررسی نشده‌اند.','هیچ قاعده انطباق رسمی واحد نجف‌آباد در این نسخه فعال نیست.']};
    report.section_details=sectionDetails;
    report.revisions=revisionCounts;
    report.bibliography_heading_matches=bibliographyMarkers;
    report.technical_flags=[];
    if(sectionDetails.length>1){
      const fingerprints=new Set(sectionDetails.map(s=>JSON.stringify([s.width_mm,s.height_mm,s.margins_mm])));
      if(fingerprints.size>1)report.technical_flags.push('در بخش‌های مختلف سند، اندازه صفحه یا حاشیه‌ها یکسان نیست؛ ممکن است عمدی باشد.');
    }
    if(revisionCounts.insertions||revisionCounts.deletions)report.technical_flags.push('تغییرات رهگیری‌شده (Track Changes) در بدنه سند یافت شد.');
    if(revisionCounts.comment_refs)report.technical_flags.push('ارجاع به نظرها (Comments) در بدنه سند وجود دارد.');
    if(!stylesXml)report.technical_flags.push('فایل styles.xml پیدا نشد؛ تحلیل سبک‌ها ناقص است.');
    report.manual_profile_evaluation=null;
    return report;
  }
  if(window.AYINYAR_DEMO)window.AyinTest={extractDocxStructure};
  function unzipText(reader, fileName) {
    if (!reader.hasEntry(fileName)) return '';
    const entry=reader.getEntry(fileName);
    if (entry.realSize > 30*1024*1024) throw new Error('بخش XML برای بررسی ایمن بیش از حد بزرگ است.');
    const C=Components.classes, I=Components.interfaces;
    const stream=reader.getInputStream(fileName);
    const converter=C['@mozilla.org/intl/converter-input-stream;1'].createInstance(I.nsIConverterInputStream);
    converter.init(stream,'UTF-8',0,I.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    let text='',out={value:''};
    try { while(converter.readString(65536,out)) { text+=out.value; if(text.length>30*1024*1024)throw new Error('حجم XML از حد مجاز بیشتر است.'); } }
    finally {converter.close();}
    return text;
  }
  function inspectFileOnDisk(file) {
    const C=Components.classes,I=Components.interfaces;
    if (!/\.docx$/i.test(file.leafName)) throw new Error('فقط فایل DOCX پشتیبانی می‌شود.');
    if (file.fileSize > 150*1024*1024) throw new Error('فایل بیش از ۱۵۰ مگابایت است و در این نسخه بررسی نمی‌شود.');
    const reader=C['@mozilla.org/libjar/zip-reader;1'].createInstance(I.nsIZipReader);
    reader.open(file);
    try {
      if(!reader.hasEntry('word/document.xml')) throw new Error('فایل انتخابی DOCX معتبر نیست یا word/document.xml ندارد.');
      const docXml=unzipText(reader,'word/document.xml');
      const stylesXml=unzipText(reader,'word/styles.xml');
      const report=extractDocxStructure(docXml,stylesXml,file.leafName);
      report.paragraph_audit=window.AyinParagraphs.analyze(docXml,stylesXml);
      const parts={'word/document.xml':docXml};
      // Citations and bibliography fields can also live in notes, headers and footers.
      // Only inspect known WordprocessingML parts, and keep each individual XML size-limited.
      for(const part of ['word/footnotes.xml','word/endnotes.xml']){
        if(reader.hasEntry(part))parts[part]=unzipText(reader,part);
      }
      for(const prefix of ['header','footer']){
        for(let index=1;index<=30;index++){
          const part='word/'+prefix+index+'.xml';
          if(reader.hasEntry(part))parts[part]=unzipText(reader,part);
        }
      }
      report.citation_audit=window.AyinCitations.inspectParts(parts);
      report.citation_audit.bibliography_content_audit=window.AyinBibliography.audit(parts,report.citation_audit);
      report.citation_audit.bibliography_diagnostics.note += ' قسمت‌های بررسی‌شده: '+Object.keys(parts).join('، ')+'.';
      report.zotero_citation_fields_detected=report.citation_audit.summary.citation_fields>0;
      return report;
    } finally {reader.close();}
  }
  function addResult(name,value,hint) {
    const card=add('div','result-card');card.appendChild(add('h3','',name));card.appendChild(add('strong','',String(value)));if(hint)card.appendChild(add('p','',hint));$('word-results').appendChild(card);
  }
  function sizeIsA4(s) {
    if (!Number.isFinite(s.width_mm) || !Number.isFinite(s.height_mm)) return false;
    return ((Math.abs(s.width_mm-210)<=2 && Math.abs(s.height_mm-297)<=2)
      || (Math.abs(s.width_mm-297)<=2 && Math.abs(s.height_mm-210)<=2));
  }
  function showSectionDetails(details){
    if(!Array.isArray(details)||!details.length)return;
    const container=add('section','section-details-card');
    container.appendChild(add('h3','',`اندازه صفحه و حاشیه‌های تمام ${details.length} بخش سند`));
    container.appendChild(add('p','', 'اعداد بر حسب میلی‌متر هستند؛ این جدول فقط ساختار فایل را نشان می‌دهد، نه تأیید دانشگاه.'));
    const wrap=add('div','table-wrap');
    const table=add('table','section-table');
    const head=add('thead'); const headers=add('tr');
    for(const label of ['بخش','ابعاد صفحه','نوع اندازه','بالا','پایین','راست','چپ']) headers.appendChild(add('th','',label));
    head.appendChild(headers);table.appendChild(head);
    const body=add('tbody');
    for(const section of details){
      const row=add('tr');
      row.appendChild(add('td','',String(section.section??'؟')));
      const dimension=(section.width_mm!=null && section.height_mm!=null)?`${section.width_mm} × ${section.height_mm}`:'نامشخص';
      row.appendChild(add('td','',dimension));
      const sizeStatus=add('td');
      const sizeKnown=Number.isFinite(section.width_mm)&&Number.isFinite(section.height_mm);
      sizeStatus.appendChild(add('span','pill '+(!sizeKnown?'neutral':sizeIsA4(section)?'good':'warn'),!sizeKnown?'نامشخص':sizeIsA4(section)?'A4':'غیر A4'));
      row.appendChild(sizeStatus);
      for(const edge of ['top','bottom','right','left'])row.appendChild(add('td','',section.margins_mm?.[edge]??'نامشخص'));
      body.appendChild(row);
    }
    table.appendChild(body);wrap.appendChild(table);container.appendChild(wrap);
    $('word-results').appendChild(container);
  }
  function renderIntegrityTasks() {
    const target=$('integrity-rows'),status=$('integrity-summary');
    if(!target||!status)return;
    target.replaceChildren();
    const report=wordReport?.citation_audit?.integrity_review;
    if(!report){show('integrity-summary','برای مشاهده فهرست اقدامات پیشنهادی، یک DOCX تحلیل کنید.');$('save-integrity-csv').disabled=true;return;}
    const filter=$('integrity-filter').value;
    const findings=(report.findings||[]).filter(f=>filter==='all'||f.level===filter);
    show('integrity-summary',`${report.summary.total} مورد برای بررسی انسانی: ${report.summary.review} مورد نیازمند بازبینی · ${report.summary.info} اطلاع‌رسانی · ${findings.length} مورد نمایان`);
    $('save-integrity-csv').disabled=false;
    if(!findings.length){const r=add('tr');const c=add('td','','در این فیلتر، موردی گزارش نشده است.');c.setAttribute('colspan','4');r.appendChild(c);target.appendChild(r);}
    for(const f of findings.slice(0,500)){
      const r=add('tr');
      const label=add('td');label.appendChild(add('span','pill '+(f.level==='review'?'warn':'neutral'),f.level==='review'?'بازبینی':'اطلاع'));r.appendChild(label);
      r.appendChild(add('td','',f.source||'—'));
      r.appendChild(add('td','',`${f.location||'نامشخص'}${f.paragraph_hint?' · پاراگراف تقریبی '+f.paragraph_hint:''}`));
      const desc=add('td','');desc.appendChild(add('strong','',f.explanation));desc.appendChild(add('p','helper','پیشنهاد: '+f.action));r.appendChild(desc);target.appendChild(r);
    }
    if(findings.length>500)show('integrity-limit','فقط ۵۰۰ مورد اول در جدول نشان داده شده؛ فایل CSV کامل‌تر است.');else show('integrity-limit','این گزارش حکم انطباق رسمی دانشگاه نیست و هیچ فایل Word را اصلاح نمی‌کند.');
  }
  async function saveIntegrityCSV(){
    const r=wordReport?.citation_audit?.integrity_review;if(!r)return;
    if(window.AYINYAR_DEMO){alert('خروجی CSV در پیش‌نمایش غیرفعال است.');return;}
    try{
      const path=await window.AyinFileDialog.pick({mode:'save',title:'ذخیره فهرست اقدامات پیشنهادی',filterTitle:'CSV (*.csv)',filterPattern:'*.csv',defaultString:'AyinYar-Citation-Review.csv',defaultExtension:'csv'});
      if(!path)return;
      window.AyinFileDialog.writeUTF8(path,window.AyinIntegrity.csv(r));
      show('docx-status','فهرست اقدامات پیشنهادی ذخیره شد؛ فایل Word تغییر نکرد.');
    }catch(e){show('docx-status','ذخیره فهرست ناموفق بود: '+e.message);try{getZotero()?.logError(e)}catch(_){}}
  }
  function renderCitationAudit(data){
    const box=$('citation-results');if(!box)return;box.replaceChildren();
    if(!data){box.appendChild(add('p','helper','در این گزارش اطلاعات فیلدهای استناد موجود نیست.'));return;}
    renderIntegrityTasks();
    const n=data.summary;
    const stats=add('div','citation-stats');
    for(const [k,v] of [['فیلد استناد',n.citation_fields],['فیلد فهرست منابع',n.bibliography_fields],['منابع استنادشده',n.cited_items],['منطبق با کتابخانه محلی',n.linked_items],['نیازمند بررسی اتصال',n.unavailable_items]]){
      const card=add('div','citation-stat');card.appendChild(add('span','',k));card.appendChild(add('strong','',String(v)));stats.appendChild(card);
    }
    box.appendChild(stats);
    const quality=data.quality_assessment||window.AyinCitations.qualityAssessment(data);
    const qualityStats=add('div','citation-stats');
    for(const [k,v] of [['منابع یکتا',quality.unique_cited_sources],['تکرار در همان استناد',quality.duplicate_item_occurrences]]){
      const card=add('div','citation-stat');card.appendChild(add('span','',k));card.appendChild(add('strong','',String(v)));qualityStats.appendChild(card);
    }
    box.appendChild(qualityStats);
    for(const issue of quality.flags){
      box.appendChild(add('p','manual-disclaimer',issue.message+' راهکار: '+issue.action));
    }
    box.appendChild(add('p','helper',quality.limitation));
    const biblio=data.bibliography_content_audit;
    if(biblio){
      const summary=add('section','bib-evidence');
      summary.appendChild(add('h3','','مقایسه شواهد فهرست منابع با استنادها'));
      summary.appendChild(add('p','helper','تعداد منابع دارای نشانه حضور در فهرست: '+biblio.totals.observed+' · نیازمند بررسی: '+biblio.totals.review+' · نامشخص: '+biblio.totals.unknown+' · بررسی‌نشده: '+biblio.totals.not_tested));
      const exceptions=biblio.exceptions||{};
      if((exceptions.uncited||0)||(exceptions.omitted||0)||(exceptions.custom||0)) summary.appendChild(add('p','helper','تنظیمات فهرست: منابع افزوده‌شده بدون استناد '+(exceptions.uncited||0)+' · حذف عمدی '+(exceptions.omitted||0)+' · مدخل سفارشی '+(exceptions.custom||0)+'. این موارد لزوماً خطا نیستند.'));
      if(biblio.sources.length){
        const wrap=add('div','table-wrap'),table=add('table','citation-table'),thead=add('thead'),head=add('tr');
        for(const h of ['منبع استنادشده','نشانه در فهرست','محل در Word (تقریبی)','توضیح'])head.appendChild(add('th','',h));
        thead.appendChild(head);table.appendChild(thead);
        const body=add('tbody');
        for(const src of biblio.sources.slice(0,200)){
          const tr=add('tr');tr.appendChild(add('td','',src.title||'عنوان نامشخص'));
          const label=src.status==='observed'?'نشانه یافت شد':src.status==='review'?'نیازمند بررسی':src.status==='not_tested'?'بررسی نشد':'نامشخص';
          const td=add('td');td.appendChild(add('span','pill '+(src.status==='observed'?'good':src.status==='review'?'warn':'neutral'),label));tr.appendChild(td);
          const citePositions=src.citation_field_numbers.map(n=>{const f=data.citations[n-1];return f?.paragraph_number?('استناد §'+f.paragraph_number):('استناد '+n);});
          const bibPositions=(src.visible_entry_paragraphs||[]).map(q=>'فهرست §'+q.paragraph);
          tr.appendChild(add('td','',citePositions.concat(bibPositions).join(' | ')||'—'));tr.appendChild(add('td','',src.evidence));body.appendChild(tr);
        }
        table.appendChild(body);wrap.appendChild(table);summary.appendChild(wrap);
        if(biblio.sources.length>200)summary.appendChild(add('p','helper','فقط ۲۰۰ منبع نخست در رابط نمایش داده می‌شوند؛ موارد بیشتر در JSON هستند.'));
      }
      summary.appendChild(add('p','manual-disclaimer',biblio.limit));
      if(biblio.errors.length)summary.appendChild(add('p','helper','مشکلات خواندن: '+biblio.errors.join(' | ').slice(0,250)));
      box.appendChild(summary);
    }
    const diag=data.bibliography_diagnostics;
    if(diag){
      const message=add('p','helper', 'وضعیت فهرست منابع: '+diag.note);
      box.appendChild(message);
      if(n.bibliography_fields===0){
        box.appendChild(add('p','manual-disclaimer','اگر فهرست منابع در Word دیده می‌شود، پس از ذخیره فایل با Ctrl+S، کلید Alt+F9 را بزن و در کدهای سند ZOTERO_BIBL را جست‌وجو کن. این بررسی فقط تشخیصی است و فایل را تغییر نمی‌دهد.'));
      }
    }
    if(!n.citation_fields){box.appendChild(add('p','helper','فیلد زنده Zotero شناسایی نشد. ممکن است سند از استنادهای تایپی یا Bookmarks استفاده کرده باشد.'));return;}
    const table=add('table','citation-table'),thead=add('thead'),hr=add('tr');
    for(const h of ['شماره','محل در DOCX','منابع','وضعیت بررسی'])hr.appendChild(add('th','',h));
    thead.appendChild(hr);table.appendChild(thead);
    const tbody=add('tbody');
    for(const [index,cite] of data.citations.slice(0,250).entries()){
      const row=add('tr');row.appendChild(add('td','',String(index+1)));
      row.appendChild(add('td','',cite.location+(cite.paragraph_number?' · پاراگراف '+cite.paragraph_number:'')));
      row.appendChild(add('td','',cite.items.map(i=>i.title||i.key||'بدون شناسه').join('، ').slice(0,250)||'نامشخص'));
      const messages=[...cite.issues];
      for(const item of cite.items){
        if(item.lookup_status==='linked')messages.push('در کتابخانه محلی پیدا شد');
        else if(item.lookup_status==='unavailable')messages.push('در کتابخانه فعلی پیدا نشد؛ شاید از کتابخانه همکار باشد');
        else if(item.lookup_status==='no_uri')messages.push('URI برای تطبیق ندارد');
        else messages.push('اتصال قابل تأیید نیست');
      }
      row.appendChild(add('td','',Array.from(new Set(messages)).join(' | ')||'بدون اخطار آشکار'));
      tbody.appendChild(row);
    }
    table.appendChild(tbody);const wrap=add('div','table-wrap');wrap.appendChild(table);box.appendChild(wrap);
    if(data.citations.length>250)box.appendChild(add('p','helper','فقط ۲۵۰ سطر اول در رابط نمایش داده شده؛ گزارش JSON کامل‌تر است.'));
    if(data.issues.length)box.appendChild(add('p','helper','محدودیت تحلیل: '+data.issues.join(' | ').slice(0,400)));
    box.appendChild(add('p','manual-disclaimer','این بازرسی فقط فیلدهای زنده موجود در DOCX را می‌خواند. نبود فیلد به معنی نبود استناد نیست؛ پیدا نشدن URI هم لزوماً خطا یا حذف منبع نیست. هیچ اطلاعاتی در Word یا Zotero تغییر نکرده است.'));
  }
  function renderWord(report) {
    const t=$('word-results');t.replaceChildren();
    addResult('فایل',report.filename,'تحلیل روی رایانه انجام شده است.');
    addResult('تعداد پاراگراف دارای متن',report.paragraphs,'برآورد آماری؛ شامل همه بخش‌های سند نیست.');
    addResult('تعداد تقریبی واژه‌ها',report.words_approx,'شمارش ساده بر اساس فاصله‌ها.');
    addResult('اندازه صفحه آخرین بخش',report.page_size_mm.width?`${report.page_size_mm.width} × ${report.page_size_mm.height} mm`:'نامشخص',report.looks_like_A4===true?'از نظر اندازه نزدیک A4 است (نه تأیید شیوه‌نامه).':'براساس فایل، اندازه صفحه نیازمند بررسی است.');
    const m=report.margins_mm;
    addResult('حاشیه‌های آخرین بخش',m?`بالا ${m.top} · پایین ${m.bottom} · راست ${m.right} · چپ ${m.left} mm`:'نامشخص','مقدار مصوب دانشگاه هنوز مشخص نشده است.');
    addResult('تیترهای دارای سبک شناسایی‌شده',report.heading_styles_detected,'تیترهایی که فقط به‌صورت Bold نوشته شده‌اند ممکن است شناسایی نشوند.');
    addResult('فونت‌های تعریف‌شده',report.defined_fonts.length?report.defined_fonts.join('، '):'نامشخص','فونت‌های سبک‌ها و متن؛ لزوماً همه استفاده نشده‌اند.');
    if(report.paragraph_audit)addResult('پاراگراف‌های تحلیل‌شده با جزئیات',report.paragraph_audit.analyzed,'شامل فونت، اندازه قلم و فاصله خطوط محاسبه‌شده از XML و سبک‌ها؛ گزارش تفصیلی در کنترل انطباق.');
    addResult('فیلد استناد Zotero',report.citation_audit ? report.citation_audit.summary.citation_fields : (report.zotero_citation_fields_detected?'شناسایی شد':'شناسایی نشد'),'فقط فیلدهای زنده Word تحلیل شده‌اند؛ متن استناد تایپ‌شده در این شمارش نیست.');
    renderCitationAudit(report.citation_audit);
    addResult('جدول / تصویر (تقریبی)',`${report.tables} / ${report.pictures_approx}`,'بعضی اشکال ممکن است خارج از بدنه اصلی باشند.');
    addResult('تعداد بخش‌های سند',report.section_details?.length ?? 'نامشخص','حاشیه‌ها و ابعاد هر بخش به‌طور مستقل بررسی‌پذیرند.');
    showSectionDetails(report.section_details);
    addResult('تغییرات رهگیری‌شده',report.revisions?`${report.revisions.insertions} درج / ${report.revisions.deletions} حذف`:'نامشخص','وجود Track Changes الزاماً خطا نیست، اما قبل از تحویل باید بررسی شود.');
    if(report.technical_flags?.length)addResult('موارد فنی قابل توجه',report.technical_flags.length,report.technical_flags.join(' | '));
    $('manual-audit').disabled=false;
    $('save-docx-report').disabled=false;
    // The A4 checkbox is enabled by default. Evaluate it locally right after file selection.
    // This is a user-defined technical comparison, not a university regulation.
    runManualAudit();
  }
  function runManualAudit(){
    if(!wordReport){show('manual-results','ابتدا یک فایل Word را بررسی کن.');return;}
    try {
      const profile=window.AyinManual.readProfile({A4:$('manual-a4').checked,top:$('manual-top').value,bottom:$('manual-bottom').value,right:$('manual-right').value,left:$('manual-left').value});
      const result=window.AyinManual.evaluate(wordReport,profile);
      wordReport.manual_profile_evaluation=result;
      const tgt=$('manual-results');tgt.replaceChildren();
      tgt.appendChild(add('p','',`نتیجه با معیارهای شخصی: ${result.pass} مطابق · ${result.review} متفاوت · ${result.unknown} نامشخص`));
      for(const x of result.results){
        const line=add('div','manual-line '+x.level,`بخش ${x.section||'؟'}: ${x.message} ${x.expected?`(انتظار: ${x.expected} / فایل: ${x.actual})`:''}`);
        tgt.appendChild(line);
      }
      tgt.appendChild(add('p','manual-disclaimer',result.disclaimer));
    } catch(e){show('manual-results','امکان مقایسه وجود ندارد: '+e.message);}
  }
  function renderParagraphReview(review){
    const status=$('paragraph-review-status'),tbody=$('paragraph-review-rows');
    if(!status||!tbody)return;
    tbody.replaceChildren();
    if(!review){status.textContent='پس از بررسی فایل Word، جزئیات پاراگراف‌ها نمایش داده می‌شود.';return;}
    const all=review.items||[];
    const norm=v=>String(v||'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').toLowerCase();
    const q=norm(paragraphSearch).trim();
    let chosen=all.filter(p=>{
      if(paragraphFilter!=='all'&&p.level!==paragraphFilter)return false;
      if(paragraphRoleFilter==='headings'&&!['heading-styled','chapter-heading-candidate','section-heading-candidate','front-matter-candidate'].includes(p.role))return false;
      if(paragraphRoleFilter==='captions'&&!['figure-caption-candidate','table-caption-candidate'].includes(p.role))return false;
      if(paragraphRoleFilter==='body'&&p.role!=='body-candidate')return false;
      if(paragraphRoleFilter==='toc'&&p.role!=='toc-entry')return false;
      return !q||norm([p.text_preview,p.paragraph_number,p.style_id,p.role,p.reason].join(' ')).includes(q);
    });
    const pages=Math.max(1,Math.ceil(chosen.length/PARAGRAPH_PAGE_SIZE));
    paragraphPage=Math.max(0,Math.min(paragraphPage,pages-1));
    const start=paragraphPage*PARAGRAPH_PAGE_SIZE,visible=chosen.slice(start,start+PARAGRAPH_PAGE_SIZE);
    const roleCounts=review.role_counts||{};
    const sum=keys=>keys.reduce((n,k)=>n+(roleCounts[k]||0),0);
    show('paragraph-role-summary',`شواهد استخراج‌شده: ${sum(['heading-styled','chapter-heading-candidate','section-heading-candidate','front-matter-candidate'])} عنوان/تیتر احتمالی · ${sum(['figure-caption-candidate','table-caption-candidate'])} عنوان شکل/جدول · ${roleCounts['body-candidate']||0} متن طولانی احتمالی · ${roleCounts['toc-entry']||0} مدخل فهرست. نقش‌های احتمالی تأیید علمی یا قالب‌بندی نیستند.`);
    status.textContent=`${review.analyzed} پاراگراف تحلیل شد؛ ${review.review} بازبینی و ${review.unknown} نامشخص. ${chosen.length} نتیجه با فیلتر و جست‌وجو · صفحه ${paragraphPage+1} از ${pages} · ردیف ${chosen.length?start+1:0} تا ${start+visible.length}. اطلاعات فایل اصلی تغییر نکرد.`;
    document.querySelectorAll('[data-paragraph-filter]').forEach(b=>{
      const active=b.dataset.paragraphFilter===paragraphFilter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
    document.querySelectorAll('[data-paragraph-role]').forEach(b=>{
      const active=b.dataset.paragraphRole===paragraphRoleFilter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
    if($('paragraph-page-prev'))$('paragraph-page-prev').disabled=paragraphPage===0;
    if($('paragraph-page-next'))$('paragraph-page-next').disabled=paragraphPage>=pages-1;
    show('paragraph-page-label',`صفحه ${paragraphPage+1} از ${pages}`);
    for(const p of visible){
      const tr=add('tr');
      tr.appendChild(add('td','',String(p.paragraph_number)));
      tr.appendChild(add('td','',p.text_preview||'—'));
      const roles={'heading-styled':'تیتر (سبک Word)','chapter-heading-candidate':'فصل احتمالی','section-heading-candidate':'عنوان بخش احتمالی','front-matter-candidate':'عنوان مقدماتی','toc-entry':'مدخل فهرست','figure-caption-candidate':'عنوان شکل احتمالی','table-caption-candidate':'عنوان جدول احتمالی','body-candidate':'متن طولانی احتمالی','unclassified':'طبقه‌بندی‌نشده'};
      tr.appendChild(add('td','',`${roles[p.role]||p.role||'—'} · ${p.style_id||'—'}`));
      const showFont=s=>s?.status==='not-present'?'—':`${s?.font||'نامشخص'} · ${s?.sizePt??'؟'} pt`;
      tr.appendChild(add('td','',showFont(p.fa)));
      tr.appendChild(add('td','',showFont(p.en)));
      tr.appendChild(add('td','',p.line_spacing?p.line_spacing.unit==='multiple'?`${p.line_spacing.value} برابر`:`${p.line_spacing.value} pt`:'نامشخص'));
      tr.appendChild(add('td','',`${p.space_before_pt??'؟'} / ${p.space_after_pt??'؟'} pt`));
      tr.appendChild(add('td','',p.alignment||'نامشخص'));
      tr.appendChild(add('td','',p.level==='review'?'بازبینی':p.level==='unknown'?'نامشخص':'شاهد فنی'));
      tr.appendChild(add('td','',p.reason||'—'));
      tbody.appendChild(tr);
    }
    if(!visible.length){const tr=add('tr'),td=add('td','', 'با این جست‌وجو و فیلتر موردی پیدا نشد.');td.colSpan=10;tr.appendChild(td);tbody.appendChild(tr);}
  }
  function renderComplianceDegree(){
    document.querySelectorAll('[data-compliance-degree]').forEach(b=>{
      const active=b.getAttribute('data-compliance-degree')===complianceDegree;
      b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
    show('compliance-degree-status',complianceDegree==='phd'?'پروفایل دکتری تخصصی انتخاب شده است. مقادیر قالب‌بندی از مرجع دانشگاه تهران گرفته شده‌اند؛ قواعد رسمی نجف‌آباد فعال نیستند.':'پروفایل کارشناسی ارشد انتخاب شده است. افزون بر مرجع عمومی دانشگاه تهران، اندازه A4 فقط به‌صورت مقایسه‌ای از راهنمای قدیمی‌تر دانشکده معماری دانشگاه تهران بررسی می‌شود.');
    const arch=$('compliance-architecture-source-card');if(arch)arch.classList.toggle('muted-source',complianceDegree!=='masters');
    if(wordReport)runComplianceAudit();
  }
  function renderComplianceReport(report){
    const target=$('compliance-rows');if(!target)return;target.replaceChildren();
    const statusMap={reference_match:['good','مطابق مرجع'],review:['warn','بازبینی'],evidence:['neutral','شاهد محدود'],unknown:['neutral','نامشخص']};
    for(const item of report.results){
      const tr=add('tr');const st=add('td');const spec=statusMap[item.level]||statusMap.unknown;st.appendChild(add('span','pill '+spec[0],spec[1]));tr.appendChild(st);
      tr.appendChild(add('td','',item.category||item.code));tr.appendChild(add('td','',item.section==null?'—':String(item.section)));
      tr.appendChild(add('td','',item.expected||'—'));tr.appendChild(add('td','',item.actual||item.message||'—'));
      const sourceCell=add('td');sourceCell.appendChild(add('div','compliance-source-title',item.source_title||'—'));
      if(item.source_url){const link=add('a','source-link','بازکردن منبع');link.setAttribute('href',item.source_url);link.setAttribute('target','_blank');link.setAttribute('rel','noopener noreferrer');link.addEventListener('click',e=>{if(!window.AYINYAR_DEMO){try{const z=getZotero();if(z&&typeof z.launchURL==='function'){e.preventDefault();z.launchURL(item.source_url);}}catch(_){}}});sourceCell.appendChild(link);}
      if(item.note)sourceCell.appendChild(add('p','compliance-note',item.note));tr.appendChild(sourceCell);target.appendChild(tr);
    }
    const s=report.summary;
    show('compliance-stat-match',String(s.reference_match||0));show('compliance-stat-review',String(s.review||0));show('compliance-stat-evidence',String((s.evidence||0)+(s.unknown||0)));
    show('compliance-summary',`مقطع: ${report.degree_label} · ${s.total} کنترل فنی · ${s.reference_match} مورد مطابق مرجع مقایسه‌ای · ${s.review} مورد نیازمند بازبینی · ${s.evidence} شاهد محدود · ${s.unknown} نامشخص. این نتیجه تأیید رسمی واحد نجف‌آباد نیست.`);
    const manual=$('compliance-manual-checks');manual.replaceChildren();
    for(const item of report.manual_checks||[]){const card=add('article','compliance-manual-item');card.appendChild(add('strong','',item.title));card.appendChild(add('p','',item.why));if(item.source_id){const src=window.AyinCompliance.sources[item.source_id];if(src?.url){const l=add('a','source-link','منبع');l.setAttribute('href',src.url);l.setAttribute('target','_blank');l.setAttribute('rel','noopener noreferrer');l.addEventListener('click',e=>{if(!window.AYINYAR_DEMO){try{const z=getZotero();if(z&&typeof z.launchURL==='function'){e.preventDefault();z.launchURL(src.url);}}catch(_){}}});card.appendChild(l);}}manual.appendChild(card);}
    renderParagraphReview(report.paragraph_review||null);
    $('compliance-run').disabled=false;$('compliance-save-json').disabled=false;
  }
  function runComplianceAudit(){
    if(!wordReport){show('compliance-summary','ابتدا یک فایل DOCX را انتخاب و تحلیل کن.');$('compliance-run').disabled=true;$('compliance-save-json').disabled=true;return;}
    try{complianceReport=window.AyinCompliance.evaluate(wordReport,complianceDegree);wordReport.compliance_audit=complianceReport;renderComplianceReport(complianceReport);show('compliance-file-status','فایل تحلیل‌شده: '+wordReport.filename+' · فایل اصلی تغییر نکرد.');}
    catch(e){show('compliance-summary','اجرای کنترل انطباق ناموفق بود: '+e.message);try{getZotero()?.logError(e)}catch(_){}}
  }
  function chooseComplianceDocx(){
    const before=wordReport;
    chooseWord().then(()=>{
      switchPage('compliance');
      if(wordReport && wordReport!==before){runComplianceAudit();}
      else if(wordReport){runComplianceAudit();}
    }).catch(e=>show('compliance-file-status','انتخاب فایل ناموفق بود: '+e.message));
  }
  async function chooseWord() {
    if (window.AYINYAR_DEMO) {
      show('docx-status','پیش‌نمایش: نمونه نمایشی (فایل Word واقعی خوانده نشده است).');
      const sample={filename:'رساله-نمونه-فرضی.docx',paragraphs:540,words_approx:14320,tables:12,pictures_approx:23,heading_styles_detected:18,opening_signals:{institution:true,thesisOrDissertation:true,author:true,supervisor:true,advisor:true,graduationDate:true,mastersMarker:false,phdMarker:true},defined_fonts:['IRANSansX','Times New Roman'],defined_sizes_pt:[12,14],page_size_mm:{width:210,height:297},looks_like_A4:true,margins_mm:{top:25,bottom:25,right:30,left:25},zotero_citation_fields_detected:true,section_details:[{section:1,width_mm:210,height_mm:297,margins_mm:{top:25,bottom:25,right:30,left:25}}],revisions:{insertions:0,deletions:0,comment_refs:0},technical_flags:[]};
      sample.citation_audit={citations:[{kind:'citation',location:'word/document.xml',issues:[],items:[{title:'نمونه ساختگی استناد',lookup_status:'unchecked'}]}],bibliographies:[{kind:'bibliography'}],issues:[],summary:{citation_fields:1,bibliography_fields:1,cited_items:1,linked_items:0,unavailable_items:0}};
      sample.paragraph_audit={analyzed:2,paragraphs_with_text:2,truncated:false,paragraphs:[{paragraph_number:1,text_preview:'متن نمونه فارسی برای آزمون چیدمان کنترل پاراگراف',style_id:'BodyText',role:'body-or-other',fa:{status:'resolved',font:'B Nazanin',sizePt:14,confidence:'defined'},en:{status:'not-present'},line_spacing:{unit:'multiple',value:1.5},space_before_pt:0,space_after_pt:6,alignment:'both',issues:[]},{paragraph_number:2,text_preview:'نمونه آزمایشی با اندازه قلم متفاوت',style_id:'BodyText',role:'body-or-other',fa:{status:'resolved',font:'B Lotus',sizePt:12,confidence:'defined'},en:{status:'not-present'},line_spacing:{unit:'multiple',value:1},space_before_pt:0,space_after_pt:0,alignment:'right',issues:[]} ]};
      wordReport=sample;sample.citation_audit.integrity_review=window.AyinIntegrity.build(sample.citation_audit);renderWord(sample);return;
    }
    const btn=$('choose-docx');
    btn.disabled=true;
    show('docx-status','در حال بازکردن پنجره انتخاب فایل...');
    try {
      const path=await window.AyinFileDialog.pick({mode:'open',title:'انتخاب فایل Word برای تحلیل محلی',filterTitle:'Word Document (*.docx)',filterPattern:'*.docx'});
      if (!path) {show('docx-status','انتخاب فایل لغو شد؛ اطلاعات قبلی تغییر نکرد.');return;}
      // The official FilePicker returns a path string, whereas nsIZipReader needs an nsIFile.
      const file=window.AyinFileDialog.toNativeFile(path);
      const nextReport=inspectFileOnDisk(file);
      wordReport=nextReport;
      await window.AyinCitations.matchWithLibrary(wordReport.citation_audit,getZotero());
      wordReport.citation_audit.integrity_review=window.AyinIntegrity.build(wordReport.citation_audit);
      renderWord(wordReport);
      show('docx-status','تحلیل ساختاری فایل «'+wordReport.filename+'» کامل شد؛ فایل اصلی تغییر نکرد.');
    } catch(e){
      show('docx-status','بازکردن یا تحلیل فایل ناموفق بود: '+e.message);
      try{getZotero()?.logError(e)}catch(_){}
    } finally {btn.disabled=false;}
  }

  async function saveJSON(data, defaultName) {
    if (!data) return;
    if (window.AYINYAR_DEMO) {alert('این بخش در پیش‌نمایش فقط نمایشی است؛ گزارش واقعی در افزونه Zotero ذخیره می‌شود.');return;}
    try {
      const path=await window.AyinFileDialog.pick({mode:'save',title:'ذخیره گزارش آیین‌یار',filterTitle:'JSON (*.json)',filterPattern:'*.json',defaultString:defaultName,defaultExtension:'json'});
      if(!path)return;
      window.AyinFileDialog.writeUTF8(path,JSON.stringify(data,null,2));
      alert('گزارش JSON ذخیره شد.');
    } catch(error) {alert('ذخیره گزارش JSON ناموفق بود: '+error.message);try{getZotero()?.logError(error)}catch(_){} }
  }
  function toCSV(records){
    const escape=x=>{let s=String(x??'');if(/^[\t\r\n ]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const lines=[['شناسه منبع','عنوان','نوع','وضعیت','مورد قابل بررسی'].map(escape).join(',')];
    for(const r of records)for(const issue of (r.issues.length?r.issues:['']))lines.push([r.key,r.title,r.type,r.status,issue].map(escape).join(','));
    return '\uFEFF'+lines.join('\r\n');
  }
  async function saveReferenceCSV(){
    if(!referenceReport)return;
    if(window.AYINYAR_DEMO){alert('در پیش‌نمایش، ذخیره فایل غیرفعال است.');return;}
    try {
      const path=await window.AyinFileDialog.pick({mode:'save',title:'ذخیره گزارش CSV',filterTitle:'CSV (*.csv)',filterPattern:'*.csv',defaultString:'AyinYar-References-Report.csv',defaultExtension:'csv'});
      if(!path)return;
      window.AyinFileDialog.writeUTF8(path,window.AyinRefPro.formatRowsForCSV(refRows));
      show('reference-status','خروجی CSV ذخیره شد؛ منابع اصلی تغییر نکردند.');
    } catch(e){show('reference-status','ذخیره CSV ناموفق بود: '+e.message);try{getZotero()?.logError(e)}catch(_){} }
  }
  function statusLabel(r) {
    if(r.status?.includes('historical')||r.status==='reported_superseded')return 'تاریخی / نیازمند اعتبارسنجی';
    if(r.status?.includes('facsimile'))return 'نسخه تصویری یافت شده؛ تأیید رسمی لازم';
    return 'مدرک یا شمول نیازمند تأیید';
  }
  function renderRegulations(needle) {
    const target=$('rules-list');target.replaceChildren();
    const all=window.AYINYAR_BANK?.regulations||[];
    const query=(needle||'').trim().toLowerCase();
    const filtered=all.filter(r=>[r.id,r.title,r.claim,r.doc_id,r.category].join(' ').toLowerCase().includes(query));
    show('reg-count',`${filtered.length} از ${all.length} رکورد`);show('reg-count-home',String(all.length));
    for (const r of filtered) {
      const card=add('article','rule'); card.appendChild(add('div','rule-title',r.title));
      card.appendChild(add('div','rule-info',`شماره/شناسه: ${r.doc_id||'نامشخص'} · ${r.published||'بی‌تاریخ'} · ${r.scope==='iaun'?'واحد نجف‌آباد':'مرکزی'}`));
      card.appendChild(add('span','pill neutral',statusLabel(r)));card.appendChild(add('p','rule-text',r.claim));
      const sourceNames=(r.source_ids||[]).map(id=>(window.AYINYAR_BANK.sources||[]).find(s=>s.id===id)?.title).filter(Boolean);
      if(sourceNames.length)card.appendChild(add('p','rule-info','منابع: '+sourceNames.join(' | ').slice(0,260)));
      const links=add('div','source-links');
      for(const sid of (r.source_ids||[]).slice(0,3)){
        const source=(window.AYINYAR_BANK.sources||[]).find(s=>s.id===sid);
        if(source && /^https:\/\/[^\s<>]+$/i.test(source.url||'')){
          const a=add('a','source-link','مشاهده منبع '+sid);a.setAttribute('href',source.url);
          a.setAttribute('rel','noopener noreferrer');a.setAttribute('target','_blank');
          a.addEventListener('click',e=>{if(window.AYINYAR_DEMO)return;try{const z=getZotero();if(z && typeof z.launchURL==='function'){e.preventDefault();z.launchURL(source.url);}}catch(err){}});
          links.appendChild(a);
        }
      }
      card.appendChild(links);
      target.appendChild(card);
    }
  }
  function saveUnit() {
    if (window.AYINYAR_DEMO) {show('unit-status','پیش‌نمایش: واحد نجف‌آباد انتخاب شده است؛ ذخیره فقط در نسخه Zotero انجام می‌شود.');return;}
    try {
      window.AyinPrefs.write('extensions.ayinyar.selectedUnit','iau-najafabad');
      show('unit-status','واحد نجف‌آباد در تنظیمات محلی Zotero ثبت شد.');
    }catch(error){show('unit-status','ذخیره تنظیمات ممکن نبود: '+error.message);}
  }

  /* Local, read-only-source bulletin center. Imported notices are NEVER treated as rules. */
  const NEWS_PREF='extensions.ayinyar.news.manual.v1';
  const NEWS_ROLLBACK_PREF='extensions.ayinyar.news.preimport.v1';
  let pendingBackup=null, backupMode='merge';
  let newsRecords=[];
  let newsStorageOK=true;

  function openTrustedLink(url){
    if(!window.AyinNews.safeURL(url))return;
    try{const z=getZotero(); if(z&&typeof z.launchURL==='function'){z.launchURL(url);return;}}catch(e){}
    // In the standalone demo, ordinary links with rel=noopener are preferred.
    if(window.AYINYAR_DEMO && typeof window.open==='function') window.open(url,'_blank','noopener');
  }
  function aboutLinkStatus(message){
    const node=$('about-link-status');
    if(node)node.textContent=message;
  }
  function copyAboutContact(value){
    const bridge=window.arguments?.[0]?.ayinyarCopyText;
    if(typeof bridge==='function'){bridge(value);return true;}
    try{if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value);return true;}}catch(_){}
    return false;
  }
  function handleAboutContactClick(event){
    const link=event.target?.closest?.('#page-about .about-contact-link');
    if(!link)return;
    const url=String(link.getAttribute('href')||'').trim();
    const match=url.match(/^([a-z][a-z0-9+.-]*):/i);
    const scheme=match?match[1].toLowerCase():'';
    if(!['https','mailto','tel'].includes(scheme))return;
    if(window.AYINYAR_DEMO)return;
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
    let lastError=null;
    // Use Zotero's own launcher first. This is the preferred path for HTTPS and
    // works for mailto/tel on Zotero builds with the Gecko 140 protocol fix.
    try{
      const z=getZotero();
      if(z&&typeof z.launchURL==='function'){
        z.launchURL(url);
        aboutLinkStatus(scheme==='https'?'درخواست بازکردن وب‌سایت در مرورگر پیش‌فرض ارسال شد.':scheme==='mailto'?'درخواست بازکردن برنامه ایمیل ارسال شد.':'درخواست بازکردن برنامه تماس ارسال شد.');
        return;
      }
    }catch(error){lastError=error;}
    // Compatibility bridge: supplies an explicit system principal for Gecko's
    // external-protocol service (including Zotero 10.0.2).
    try{
      const bridge=window.arguments?.[0]?.ayinyarOpenExternalURL;
      if(typeof bridge==='function'){
        bridge(url);
        aboutLinkStatus(scheme==='https'?'وب‌سایت برای بازشدن در مرورگر پیش‌فرض ارسال شد.':scheme==='mailto'?'پیوند ایمیل به برنامه پیش‌فرض ارسال شد.':'پیوند تماس به برنامه پیش‌فرض ارسال شد.');
        return;
      }
    }catch(error){lastError=error;}
    // A desktop may have no mail or telephone handler. Preserve a useful action
    // instead of silently failing: copy the address/number and explain why.
    if(scheme==='tel'||scheme==='mailto'){
      const value=url.replace(/^(tel:|mailto:)/i,'');
      try{
        if(copyAboutContact(value)){
          aboutLinkStatus(scheme==='tel'?'برنامه تماس در ویندوز پیدا نشد؛ شماره تلفن در کلیپ‌بورد کپی شد.':'برنامه ایمیل پیش‌فرض پیدا نشد؛ نشانی ایمیل در کلیپ‌بورد کپی شد.');
          return;
        }
      }catch(error){lastError=error;}
      aboutLinkStatus('بازکردن پیوند ممکن نشد. نشانی: '+value);
      try{window.alert('برنامه پیش‌فرض برای این پیوند در سیستم پیدا نشد.\n'+value);}catch(_){}
      return;
    }
    aboutLinkStatus('بازکردن وب‌سایت ممکن نشد. لطفاً اتصال و مرورگر پیش‌فرض را بررسی کن.');
    try{getZotero()?.logError(lastError||new Error('AyinYar could not open About link: '+url));}catch(_){}
  }
  function renderNewsSources(){
    const container=$('news-sources');if(!container)return;container.replaceChildren();
    for(const s of window.AyinNews.DEFAULT_SOURCES){
      const card=add('article','news-source');
      const pill=add('span','pill '+(s.verification==='institutional_domain'?'good':'warn'),s.verification==='institutional_domain'?'وب‌سایت دانشگاه':'انتساب رسمی کانال تأیید نشده');
      card.appendChild(pill);card.appendChild(add('h3','',s.name));card.appendChild(add('p','source-caption',s.note));
      const link=add('a','source-link','باز کردن منبع');link.setAttribute('href',s.url);link.setAttribute('target','_blank');link.setAttribute('rel','noopener noreferrer');
      if(!window.AYINYAR_DEMO)link.addEventListener('click',e=>{e.preventDefault();openTrustedLink(s.url)});
      card.appendChild(link);container.appendChild(card);
    }
  }
  function loadNews(){
    if(window.AYINYAR_DEMO)return [];
    try{
      const raw=window.AyinPrefs.read(NEWS_PREF,'[]');
      return window.AyinNews.sanitizeStored(JSON.parse(raw));
    }catch(e){
      show('news-status','هشدار: بارگذاری آرشیو محلی ممکن نشد؛ ذخیره جدید غیرفعال است تا داده قدیمی از بین نرود. '+e.message);
      newsStorageOK=false;
      try{getZotero()?.logError(e)}catch(_){}
      return [];
    }
  }
  function persistNews(list){
    if(window.AYINYAR_DEMO)return;
    const serialized=JSON.stringify(list);
    if(serialized.length>220000)throw Error('ظرفیت ذخیره محلی تکمیل شده است؛ از داده‌ها پشتیبان بگیر.');
    if(!newsStorageOK)throw Error('آرشیو قبلی قابل خواندن نیست. به‌دلیل حفاظت از داده‌ها ثبت جدید انجام نمی‌شود.');
    window.AyinPrefs.write(NEWS_PREF,serialized);
  }
  function renderNews(){
    const dest=$('news-results');if(!dest)return;dest.replaceChildren();
    const filtered=window.AyinNews.filter(newsRecords,{query:$('news-search').value,category:$('news-filter').value});
    show('news-count',`${filtered.length} از ${newsRecords.length}`);
    if(!filtered.length){dest.appendChild(add('p','helper','اطلاعیه‌ای در این فیلتر وجود ندارد. محتوای کانال بله به‌صورت خودکار خوانده نمی‌شود.'));return;}
    for(const n of filtered){
      const source=window.AyinNews.getSource(n.source_id);
      const card=add('article','news-record');card.appendChild(add('div','news-record-title',n.title));
      card.appendChild(add('div','news-record-meta',`${window.AyinNews.CATEGORIES[n.category]} · ${source?.name||'منبع نامشخص'}`));
      card.appendChild(add('div','news-record-meta',`انتشار: ${n.published_jalali||'نامشخص'}${n.deadline_jalali?' · تاریخ اعلام‌شده برای اقدام: '+n.deadline_jalali:''}`));
      if(n.excerpt)card.appendChild(add('p','news-record-body',n.excerpt));
      const f=add('div','news-record-footer');f.appendChild(add('span','pill neutral','ثبت کاربر · غیرمعتبر به‌عنوان قانون'));
      const u=n.post_url||source?.url;
      if(window.AyinNews.safeURL(u)){
        const link=add('a','source-link','مشاهده اصل اطلاعیه');link.setAttribute('href',u);link.setAttribute('target','_blank');link.setAttribute('rel','noopener noreferrer');
        if(!window.AYINYAR_DEMO)link.addEventListener('click',e=>{e.preventDefault();openTrustedLink(u)});
        f.appendChild(link);
      }
      const del=add('button','news-danger','حذف');del.setAttribute('type','button');del.addEventListener('click',()=>{
        if(!confirm('این اطلاعیه از آرشیو محلی حذف شود؟'))return;
        try{const next=newsRecords.filter(r=>r.id!==n.id);persistNews(next);newsRecords=next;renderNews();renderDeadlines();show('news-status','اطلاعیه از آرشیو محلی حذف شد.');}catch(e){show('news-status','حذف ناموفق: '+e.message)}
      });f.appendChild(del);card.appendChild(f);dest.appendChild(card);
    }
  }
  function addNewsRecord(){
    try{
      if(newsRecords.length>=window.AyinNews.MAX_ENTRIES)throw Error('ظرفیت ۱۰۰ اطلاعیه تکمیل شده است؛ خروجی پشتیبان بگیر.');
      for(const id of ['news-published','news-deadline']){const raw=$(id).value.trim();if(raw&&!window.AyinCalendar.parseJalali(raw))throw Error('تاریخ شمسی نامعتبر است؛ روزهای ماه و سال کبیسه را بررسی کن.');}
      const record=window.AyinNews.make({title:$('news-title').value,source_id:$('news-source').value,category:$('news-category').value,published_jalali:$('news-published').value,deadline_jalali:$('news-deadline').value,excerpt:$('news-excerpt').value,post_url:$('news-link').value});
      const updated=[record,...newsRecords];persistNews(updated);newsRecords=updated;
      $('news-title').value='';$('news-excerpt').value='';$('news-link').value='';$('news-published').value='';$('news-deadline').value='';
      show('news-status','اطلاعیه ثبت شد. این ثبت تأیید صحت محتوا یا اعتبار بخشنامه نیست.');renderNews();renderDeadlines();
    }catch(e){show('news-status','ثبت اطلاعیه ناموفق: '+e.message);try{getZotero()?.logError(e)}catch(_){}}
  }
  async function exportNews(){
    if(!newsRecords.length){show('news-status','آرشیو خالی است؛ ابتدا اطلاعیه‌ای ثبت کن.');return}
    if(window.AYINYAR_DEMO){show('news-status','ذخیره فایل فقط در نسخه نصب‌شده Zotero فعال است.');return}
    try{
      const path=await window.AyinFileDialog.pick({mode:'save',title:'ذخیره نسخه پشتیبان اطلاعیه‌ها',filterTitle:'JSON (*.json)',filterPattern:'*.json',defaultString:'AyinYar-Personal-Backup-v1.json',defaultExtension:'json'});
      if(!path)return;
      window.AyinFileDialog.writeUTF8(path,window.AyinBackup.serialize(newsRecords));
      show('news-status','فایل پشتیبان JSON ذخیره شد؛ هیچ متنی از بله خودکار دریافت نشده است.');
    }catch(e){show('news-status','ذخیره پشتیبان ناموفق: '+e.message);try{getZotero()?.logError(e)}catch(_){}}
  }
  function backupMessage(message){show('backup-status',message);}
  function previewBackupPlan(){
    if(!pendingBackup)return;
    try{
      const {stats}=window.AyinBackup.plan(newsRecords,pendingBackup.notices,backupMode);
      show('backup-preview',`نسخه فایل: ${pendingBackup.source==='legacy'?'پشتیبان قدیمی':'پشتیبان ۱'} | تعداد فایل: ${stats.from_file}\nآرشیو فعلی: ${stats.before} | پس از ${backupMode==='merge'?'ادغام':'جایگزینی'}: ${stats.after}\nورودی جدید: ${stats.added} | تکراری: ${stats.skipped} | شناسه متعارض و حفظ‌شده: ${stats.conflicts}`);
      $('backup-apply').disabled=false;
    }catch(e){show('backup-preview','بازیابی ایمن نیست: '+e.message);$('backup-apply').disabled=true;}
    for(const [id,value] of [['backup-merge','merge'],['backup-replace','replace']]){
      const selected=value===backupMode;const b=$(id);b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));
    }
  }
  async function chooseBackup(){
    if(!newsStorageOK){backupMessage('آرشیو محلی مشکل خواندن دارد؛ ابتدا خطای ذخیره‌سازی را برطرف کن.');return;}
    if(window.AYINYAR_DEMO){backupMessage('انتخاب فایل فقط داخل Zotero فعال است. در پیش‌نمایش می‌توان حالت‌های بازیابی را دید.');return;}
    try{
      const path=await window.AyinFileDialog.pick({mode:'open',title:'انتخاب پشتیبان قبلی آیین‌یار',filterTitle:'JSON (*.json)',filterPattern:'*.json'});
      if(!path){backupMessage('انتخاب فایل لغو شد؛ هیچ داده‌ای تغییر نکرد.');return;}
      const content=window.AyinFileDialog.readUTF8(path,1000000);
      const candidate=window.AyinBackup.normalize(content);
      pendingBackup=candidate;backupMode='merge';$('backup-choices').removeAttribute('hidden');
      previewBackupPlan();backupMessage('فایل بررسی شد. هیچ تغییری اعمال نشده است؛ حالت بازیابی را انتخاب و تأیید کن.');
    }catch(e){pendingBackup=null;$('backup-choices').setAttribute('hidden','hidden');$('backup-apply').disabled=true;backupMessage('فایل پشتیبان پذیرفته نشد: '+e.message);try{getZotero()?.logError(e)}catch(_){}}
  }
  function applyBackup(){
    if(!pendingBackup || !newsStorageOK){backupMessage('فایل معتبر برای بازیابی انتخاب نشده است.');return;}
    try{
      const {records,stats}=window.AyinBackup.plan(newsRecords,pendingBackup.notices,backupMode);
      if(backupMode==='replace' && !confirm('اخطار: جایگزینی کامل همه اطلاعیه‌های فعلی را با داده فایل عوض می‌کند. نسخه بازگشت محلی ذخیره می‌شود. ادامه می‌دهی؟')){
        backupMessage('جایگزینی لغو شد و هیچ داده‌ای تغییر نکرد.');return;
      }
      if(backupMode==='merge' && stats.added===0){backupMessage('مورد تازه‌ای برای ادغام نبود؛ اطلاعیه‌های موجود بدون تغییر باقی ماندند.');return;}
      // Write and verify rollback snapshot BEFORE modifying the active archive.
      const original=window.AyinPrefs.read(NEWS_PREF,'[]');
      window.AyinPrefs.write(NEWS_ROLLBACK_PREF,original);
      try{persistNews(records);}catch(e){
        // persistNews checks its own write; restore old if a storage implementation partially wrote.
        try{window.AyinPrefs.write(NEWS_PREF,original);}catch(restoreError){throw Error('بازنویسی ناموفق بود و بازگردانی خودکار هم ناموفق شد: '+restoreError.message);}
        throw e;
      }
      newsRecords=records;pendingBackup=null;$('backup-choices').setAttribute('hidden','hidden');$('backup-apply').disabled=true;
      renderNews();renderDeadlines();
      backupMessage('بازیابی تأیید شد: '+stats.added+' مورد جدید، '+stats.skipped+' تکراری و '+stats.conflicts+' تعارض شناسه. نسخه قبل از بازیابی برای بازگشت محلی ذخیره شده است.');
      show('news-status','آرشیو پس از بازیابی به‌روز شد. همه اطلاعیه‌های واردشده غیررسمی و ثبت کاربر محسوب می‌شوند.');
    }catch(e){backupMessage('بازیابی انجام نشد: '+e.message);try{getZotero()?.logError(e)}catch(_){}}
  }
  function undoBackup(){
    if(!newsStorageOK){backupMessage('بازیابی محلی به علت خطای ذخیره‌سازی غیرفعال است.');return;}
    try{
      const old=window.AyinPrefs.read(NEWS_ROLLBACK_PREF,'');
      if(!old){backupMessage('نسخه بازگشت محلی پیدا نشد.');return;}
      const parsed=JSON.parse(old);
      if(!Array.isArray(parsed))throw Error('نسخه بازگشت معتبر نیست.');
      const restored=window.AyinNews.sanitizeStored(parsed);
      if(restored.length!==parsed.length)throw Error('نسخه بازگشت رکورد ناقص یا نامعتبر دارد؛ تغییر انجام نشد.');
      if(!confirm('آرشیو فعلی با وضعیت پیش از آخرین بازیابی جایگزین شود؟ لطفاً پیش از ادامه از وضعیت فعلی خروجی بگیر.'))return;
      persistNews(restored);newsRecords=restored;
      window.AyinPrefs.write(NEWS_ROLLBACK_PREF,'');
      pendingBackup=null;$('backup-choices').setAttribute('hidden','hidden');$('backup-apply').disabled=true;
      renderNews();renderDeadlines();
      backupMessage('آخرین بازیابی برگشت داده شد؛ '+restored.length+' اطلاعیه بازیابی شد.');
    }catch(e){backupMessage('بازگشت به وضعیت قبل ممکن نشد: '+e.message);try{getZotero()?.logError(e)}catch(_){}}
  }
  function initializeNews(){
    renderNewsSources();newsRecords=loadNews();
    if(window.AYINYAR_DEMO) newsRecords=[window.AyinNews.make({title:'نمونه نمایشی: ثبت درخواست پیش‌دفاع',source_id:'aau-re-bale',category:'defense',published_jalali:'1405/08/01',deadline_jalali:'1405/08/12',excerpt:'صرفاً داده آزمایشی برای پیش‌نمایش، نه اطلاعیه واقعی دانشگاه.',post_url:''},'2026-10-28T12:00:00Z'),window.AyinNews.make({title:'نمونه نمایشی: کارگاه روش تحقیق',source_id:'iau-najafabad-site',category:'workshop',published_jalali:'1405/07/20',deadline_jalali:'1405/07/27',excerpt:'نمایشی و ساختگی؛ منبع واقعی منتشر نشده است.',post_url:''},'2026-10-28T11:00:00Z')];
    renderNews();renderDeadlines();
    $('news-save').addEventListener('click',addNewsRecord);
    $('news-export').addEventListener('click',exportNews);
    $('backup-choose').addEventListener('click',chooseBackup);
    $('backup-merge').addEventListener('click',()=>{backupMode='merge';previewBackupPlan();});
    $('backup-replace').addEventListener('click',()=>{backupMode='replace';previewBackupPlan();});
    $('backup-apply').addEventListener('click',applyBackup);
    $('backup-undo').addEventListener('click',undoBackup);
    $('news-search').addEventListener('input',renderNews);
    $('news-filter').addEventListener('change',renderNews);
  }

  /* v0.9.1: robust deadline controls (no native SELECT in XUL). Preserve v0.8 notice storage. */
  let deadlineFilter='all';
  let deadlineReminderDays=1;
  const deadlineFilterLabels={all:'همه',near:'۷ روز آینده',upcoming:'آینده',past:'گذشته',invalid:'تاریخ نامعتبر'};
  function updateDeadlineSelections(){
    document.querySelectorAll('[data-deadline-filter]').forEach(b=>{
      const selected=b.getAttribute('data-deadline-filter')===deadlineFilter;
      b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));
    });
    document.querySelectorAll('[data-reminder-days]').forEach(b=>{
      const selected=Number(b.getAttribute('data-reminder-days'))===deadlineReminderDays;
      b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));
    });
    const alarm=deadlineReminderDays?'یادآور '+deadlineReminderDays+' روز قبل':'بدون یادآور';
    show('deadlines-selection-status','فیلتر «'+deadlineFilterLabels[deadlineFilter]+'» انتخاب شد. '+alarm+' برای فایل تقویم تنظیم شده است.');
  }
  function openNewsEntry(){
    switchPage('news');
    show('news-status','برای افزودن مهلت، عنوان و تاریخ «مهلت اقدام شمسی» را وارد کن و روی «ثبت اطلاعیه» بزن.');
    const focus=$('news-title');
    try{focus?.focus()}catch(e){}
  }
  function renderDeadlines(){
    const target=$('deadlines-results');if(!target||!window.AyinCalendar)return;
    target.replaceChildren();
    const all=window.AyinCalendar.assess(newsRecords,{windowDays:7});
    const totals=window.AyinCalendar.counts(all);
    show('deadline-count-home',String(totals.today+totals.soon));
    show('deadline-stat-soon',String(totals.today+totals.soon));
    show('deadline-stat-past',String(totals.past));
    show('deadline-stat-invalid',String(totals.invalid));
    const items=all.filter(x=>deadlineFilter==='all'||
       (deadlineFilter==='upcoming'&&['today','soon','later'].includes(x.state))||
       (deadlineFilter==='near'&&['today','soon'].includes(x.state))||
       (deadlineFilter===x.state));
    const label={invalid:'تاریخ نامعتبر',today:'امروز',soon:'نزدیک',later:'آینده',past:'گذشته'};
    show('deadlines-status',all.length?`${items.length} مهلت در فیلتر «${deadlineFilterLabels[deadlineFilter]}» از ${all.length} مهلت ثبت‌شده`:'هنوز مهلتی ثبت نشده است. برای شروع، از «ثبت اطلاعیه و مهلت جدید» استفاده کن.');
    for(const x of items){
      const n=x.record,source=window.AyinNews.getSource(n.source_id);
      const box=add('article','deadline-card');
      const header=add('div','deadline-head');
      header.appendChild(add('strong','',n.title));
      header.appendChild(add('span','pill '+(x.state==='today'||x.state==='soon'?'warn':'neutral'),label[x.state]));
      box.appendChild(header);
      const remaining=x.days==null?'قابل محاسبه نیست':x.days<0?`${-x.days} روز گذشته`:x.days===0?'سررسید امروز':`${x.days} روز مانده`;
      box.appendChild(add('div','deadline-date',`تاریخ اعلام‌شده: ${n.deadline_jalali} · ${remaining}`));
      if(x.date)box.appendChild(add('div','deadline-meta',`معادل میلادی: ${x.date.iso}`));
      box.appendChild(add('div','deadline-meta',`منبع: ${source?.name||'نامشخص'} · ثبت دستی کاربر، تأییدنشده`));
      const buttons=add('div','news-record-footer');
      const btn=add('button','action secondary deadline-mini','دیدن اطلاعیه در آرشیو');btn.setAttribute('type','button');
      btn.addEventListener('click',()=>{$('news-search').value='';$('news-filter').value='all'; window.AyinChoices?.sync('news-filter'); switchPage('news');renderNews();});
      buttons.appendChild(btn);box.appendChild(buttons);target.appendChild(box);
    }
    if(!items.length){
      const empty=add('div','deadline-empty');
      empty.appendChild(add('strong','',all.length?'در این فیلتر مهلتی وجود ندارد':'هنوز هیچ مهلتی ثبت نشده است'));
      empty.appendChild(add('p','',all.length?'فیلتر دیگری انتخاب کن یا از آرشیو اطلاعیه‌ها مهلت جدیدی ثبت کن.':'یک اطلاعیه با عنوان و تاریخ شمسی ثبت کن تا در این صفحه ظاهر شود. فیلترها بدون داده فقط وضعیت نمایش را تغییر می‌دهند.'));
      const addButton=add('button','action secondary','رفتن به ثبت اطلاعیه');addButton.setAttribute('type','button');
      addButton.addEventListener('click',openNewsEntry);empty.appendChild(addButton);target.appendChild(empty);
    }
  }
  async function exportDeadlinesICS(){
    const valid=window.AyinCalendar.assess(newsRecords).some(x=>Boolean(x.date));
    if(!valid){show('deadlines-export-status','فایل تقویم ساخته نشد: هنوز مهلت دارای تاریخ معتبر ثبت نکرده‌ای. از دکمه «ثبت اطلاعیه و مهلت جدید» استفاده کن.');return;}
    if(window.AYINYAR_DEMO){show('deadlines-export-status','در پیش‌نمایش، ساخت فایل غیرفعال است. تنظیمات انتخاب‌شده اعمال شدند؛ در نسخه نصب‌شده Zotero خروجی ICS ذخیره می‌شود.');return;}
    try{
      const ics=window.AyinCalendar.makeICS(newsRecords,{alarmDays:deadlineReminderDays,generatedAt:new Date()});
      const path=await window.AyinFileDialog.pick({mode:'save',title:'ذخیره تقویم مهلت‌های پژوهشی',filterTitle:'iCalendar (*.ics)',filterPattern:'*.ics',defaultString:'AyinYar-Research-Deadlines.ics',defaultExtension:'ics'});
      if(!path){show('deadlines-export-status','ذخیره فایل توسط کاربر لغو شد.');return;}
      window.AyinFileDialog.writeUTF8(path,ics);
      show('deadlines-export-status','فایل ICS ذخیره شد. برای اعلان در زمان بسته بودن Zotero آن را به برنامه تقویم وارد کن.');
    }catch(e){show('deadlines-export-status','ساخت تقویم ممکن نشد: '+e.message);try{getZotero()?.logError(e)}catch(_){} }
  }
  // An isolated mini-game window: never touches Zotero selections or research data.
  function openResearchGame(){
    const status=$('game-launch-status');
    try{
      if(window.AYINYAR_DEMO){
        const popup=window.open('AyinYar_Game_v0.21.4_Playable_Preview.html','ayinyar-game-preview','width=1220,height=850,resizable=yes');
        if(!popup)throw new Error('مرورگر پنجره بازی را مسدود کرده است.');
      }else{
        const popup=window.openDialog('chrome://ayinyar-selector/content/game.xhtml','ayinyar-game','chrome,centerscreen,resizable,dialog=no,width=1230,height=875',window);
        if(!popup)throw new Error('بازکردن پنجره بازی ممکن نشد.');
      }
      if(status)status.textContent='پنجره بازی باز شد. کتابخانه Zotero دست‌نخورده می‌ماند.';
    }catch(error){if(status)status.textContent='اجرای بازی ممکن نشد: '+error.message;try{getZotero()?.logError(error)}catch(_){}}
  }
  function init() {
    // Explicit, opt-in bridge used only by the win-screen action of the game.
    window.AyinGameBridge=Object.freeze({openPage(id){if(id==='references'||id==='dashboard'){switchPage(id);window.focus();return true;}return false;}});
    $('open-game')?.addEventListener('click',openResearchGame);
    // Explicit external-link dispatch is required inside Zotero's chrome dialog.
    document.addEventListener('click',handleAboutContactClick,true);
    window.AyinSidebar?.init();
    window.AyinChoices?.initialize();
    window.AyinVisual?.init();
    window.AyinPdfCrop?.init();
    document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.page)));
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.go)));
    loadRefEvidence();
    $('audit-references').addEventListener('click',inspectReferences);
    $('refpro-import').addEventListener('click',importRefEvidence);
    $('refpro-manual-save').addEventListener('click',saveManualEvidence);
    $('refpro-evidence-export').addEventListener('click',exportRefEvidence);
    document.querySelectorAll('[data-ref-source]').forEach(b=>b.addEventListener('click',()=>{refSource=b.dataset.refSource;toggleRefButtons('[data-ref-source]','data-ref-source',refSource)}));
    document.querySelectorAll('[data-ref-quartile]').forEach(b=>b.addEventListener('click',()=>{refQuartile=b.dataset.refQuartile;toggleRefButtons('[data-ref-quartile]','data-ref-quartile',refQuartile)}));
    document.querySelectorAll('[data-ref-filter]').forEach(b=>b.addEventListener('click',()=>{refPage=0;setRefFilter(b.dataset.refFilter)}));
    $('refpro-search').addEventListener('input',e=>{refSearch=e.target.value||'';refPage=0;renderRefRows()});
    $('refpro-prev').addEventListener('click',()=>{refPage=Math.max(0,refPage-1);renderRefRows()});
    $('refpro-next').addEventListener('click',()=>{refPage++;renderRefRows()});
    $('choose-docx').addEventListener('click',chooseWord);
    $('compliance-choose-docx').addEventListener('click',chooseComplianceDocx);
    $('compliance-run').addEventListener('click',runComplianceAudit);
    $('compliance-save-json').addEventListener('click',()=>saveJSON(complianceReport,'AyinYar-Thesis-Compliance-Report.json'));
    document.querySelectorAll('[data-compliance-degree]').forEach(b=>b.addEventListener('click',()=>{complianceDegree=b.getAttribute('data-compliance-degree');renderComplianceDegree();}));
    document.querySelectorAll('[data-paragraph-filter]').forEach(b=>b.addEventListener('click',()=>{paragraphFilter=b.dataset.paragraphFilter;paragraphPage=0;renderParagraphReview(complianceReport?.paragraph_review||null);}));
    document.querySelectorAll('[data-paragraph-role]').forEach(b=>b.addEventListener('click',()=>{paragraphRoleFilter=b.dataset.paragraphRole;paragraphPage=0;renderParagraphReview(complianceReport?.paragraph_review||null);}));
    $('paragraph-search')?.addEventListener('input',e=>{paragraphSearch=e.target.value||'';paragraphPage=0;renderParagraphReview(complianceReport?.paragraph_review||null);});
    $('paragraph-page-prev')?.addEventListener('click',()=>{paragraphPage--;renderParagraphReview(complianceReport?.paragraph_review||null);});
    $('paragraph-page-next')?.addEventListener('click',()=>{paragraphPage++;renderParagraphReview(complianceReport?.paragraph_review||null);});
    document.querySelectorAll('[data-compliance-source]').forEach(a=>a.addEventListener('click',e=>{if(!window.AYINYAR_DEMO){try{const z=getZotero();if(z&&typeof z.launchURL==='function'){e.preventDefault();z.launchURL(a.href);}}catch(_){}}}));
    renderComplianceDegree();
    $('manual-audit').addEventListener('click',runManualAudit);
    $('save-reference-csv').addEventListener('click',saveReferenceCSV);
    $('save-unit').addEventListener('click',saveUnit);
    $('save-reference-report').addEventListener('click',()=>saveJSON(referenceReport,'AyinYar-References-Report.json'));
    $('save-docx-report').addEventListener('click',()=>saveJSON(wordReport,'AyinYar-DOCX-Report.json'));
    $('save-integrity-csv').addEventListener('click',saveIntegrityCSV);
    $('integrity-filter').addEventListener('change',renderIntegrityTasks);
    $('rule-search').addEventListener('input',e=>renderRegulations(e.target.value));
    renderRegulations('');
    initializeNews();
    document.querySelectorAll('[data-deadline-filter]').forEach(button=>button.addEventListener('click',()=>{
      deadlineFilter=button.getAttribute('data-deadline-filter');
      updateDeadlineSelections();renderDeadlines();
    }));
    document.querySelectorAll('[data-reminder-days]').forEach(button=>button.addEventListener('click',()=>{
      deadlineReminderDays=Number(button.getAttribute('data-reminder-days'));
      updateDeadlineSelections();
    }));
    $('deadline-add-notice').addEventListener('click',openNewsEntry);
    $('deadline-ics-export').addEventListener('click',exportDeadlinesICS);
    updateDeadlineSelections();
    if(window.AYINYAR_DEMO)show('reference-status','حالت پیش‌نمایش: دکمه بررسی، چند منبع فرضی را نمایش می‌دهد.');
    else if(!canAccessZotero())show('reference-status','پنجره اصلی Zotero پیدا نشد؛ از منوی Tools افزونه را باز کنید.');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
