/* AyinYar 0.11.1 — evidence-aware, provisional thesis compliance comparator. */
(function(root){
 'use strict';
 const SOURCES={
  'TECH-DOCX':{id:'TECH-DOCX',title:'مشاهده فنی ساختار DOCX (بدون حکم دانشگاهی)',url:'',status:'داده استخراج‌شده از فایل؛ بدون مرجع الزام‌آور'},
  'UT-GENERAL-1403':{id:'UT-GENERAL-1403',title:'شیوه‌نامه تدوین پایان‌نامه/رساله دانشجویی دانشگاه تهران، ویرایش دوم آبان ۱۴۰۳',url:'https://library.ut.ac.ir/file/download/page/1738658763-67a1d3cb7a0fa-.pdf',status:'مرجع رسمی دانشگاه تهران؛ غیرالزام‌آور برای دانشگاه آزاد'},
  'UT-ARCH-MA-1398':{id:'UT-ARCH-MA-1398',title:'دستورالعمل پایان‌نامه کارشناسی ارشد دانشکده معماری دانشگاه تهران، بازنگری خرداد ۱۳۹۸',url:'https://arch.ut.ac.ir/documents/438260/690212/%D8%B1%D8%A7%D9%87%D9%86%D9%85%D8%A7%2B%D8%A7%D8%B1%D8%B4%D8%AF.pdf/be056eda-1c75-0005-58dc-441ff003edb1?download=true&t=1710086754869',status:'مرجع رسمی دانشکده معماری؛ قدیمی‌تر و فقط برای مقایسه A4 کارشناسی ارشد'},
  'IAU-PARDIS-1395':{id:'IAU-PARDIS-1395',title:'راهنمای واحد پردیس دانشگاه آزاد، تابستان ۱۳۹۵',url:'https://tmrg.ir/File/Proposal_Form/IAU-Pardis-Branch.pdf',status:'واحدی/قدیمی؛ غیرفعال در موتور'}
 };
 const PROFILES={
  masters:{id:'provisional-masters-ut-reference-1403',degree:'masters',label:'کارشناسی ارشد',status:'provisional_reference_only',sourceIds:['UT-GENERAL-1403','UT-ARCH-MA-1398'],margins:{top:30,bottom:25,right:35,left:25},pageA4Source:'UT-ARCH-MA-1398',persianFont:'B Nazanin',englishFont:'Times New Roman',persianBodyPt:14,englishBodyPt:12,chapterPt:17,englishChapterPt:16,degreeRegex:/کارشناسی\s*ارشد|master(?:'s)?|m\.?sc\.?|m\.?a\.?/i,degreeLabel:'کارشناسی ارشد'},
  phd:{id:'provisional-phd-ut-reference-1403',degree:'phd',label:'دکتری تخصصی',status:'provisional_reference_only',sourceIds:['UT-GENERAL-1403'],margins:{top:30,bottom:25,right:35,left:25},pageA4Source:null,persianFont:'B Nazanin',englishFont:'Times New Roman',persianBodyPt:14,englishBodyPt:12,chapterPt:17,englishChapterPt:16,degreeRegex:/دکتری|دکترای|ph\.?d|doctor of philosophy/i,degreeLabel:'دکتری تخصصی'}
 };
 const labels={top:'بالا',bottom:'پایین',right:'راست',left:'چپ'};
 function norm(s){return String(s||'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').toLowerCase();}
 function unique(a){return [...new Set((a||[]).map(x=>String(x||'').trim()).filter(Boolean))];}
 function source(id){return SOURCES[id]||{id,title:'منبع مشخص نشده',url:'',status:'نامشخص'};}
 function getProfile(degree){return PROFILES[degree==='masters'?'masters':'phd'];}
 function result({code,category,section=null,level,message,expected=null,actual=null,sourceId='UT-GENERAL-1403',note=''}){
   return {code,category,section,level,message,expected,actual,source_id:sourceId,source_title:source(sourceId).title,source_url:source(sourceId).url,source_status:source(sourceId).status,note};
 }
 function evaluate(report,degree='phd'){
   const p=getProfile(degree),results=[],manual=[];
   if(!report||typeof report!=='object')throw new Error('گزارش DOCX برای بررسی در دسترس نیست.');
   const sections=Array.isArray(report.section_details)?report.section_details:[];
   if(!sections.length){results.push(result({code:'sections-missing',category:'ساختار صفحه',level:'unknown',message:'اطلاعات بخش‌های سند برای مقایسه استخراج نشده است.',sourceId:p.sourceIds[0]}));}
   else{
     for(const s of sections){
       if(p.pageA4Source){
         const valid=Number.isFinite(s.width_mm)&&Number.isFinite(s.height_mm);
         const a4=valid&&((Math.abs(s.width_mm-210)<=2&&Math.abs(s.height_mm-297)<=2)||(Math.abs(s.width_mm-297)<=2&&Math.abs(s.height_mm-210)<=2));
         results.push(result({code:'page-size-a4',category:'اندازه صفحه',section:s.section,level:!valid?'unknown':a4?'reference_match':'review',message:!valid?'اندازه صفحه قابل استخراج نیست.':a4?'اندازه این بخش با A4 در مرجع رشته‌ای کارشناسی ارشد مطابقت دارد.':'اندازه این بخش با A4 در مرجع رشته‌ای کارشناسی ارشد تفاوت دارد؛ این تفاوت به‌تنهایی مغایرت دانشگاه آزاد نیست.',expected:'A4 · 210×297 mm',actual:valid?`${s.width_mm}×${s.height_mm} mm`:'نامشخص',sourceId:p.pageA4Source,note:'این کنترل فقط در پروفایل کارشناسی ارشد و بر مبنای راهنمای دانشکده معماری دانشگاه تهران (۱۳۹۸) اجرا می‌شود.'}));
       }
       // The document page size is always observable, even when no academic A4 rule is verified.
       if(!p.pageA4Source){
         const hasSize=typeof s.width_mm==='number'&&Number.isFinite(s.width_mm)&&typeof s.height_mm==='number'&&Number.isFinite(s.height_mm);
         const a4=hasSize&&((Math.abs(s.width_mm-210)<=2&&Math.abs(s.height_mm-297)<=2)||(Math.abs(s.width_mm-297)<=2&&Math.abs(s.height_mm-210)<=2));
         results.push(result({code:'page-size-observation',category:'اندازه صفحه · مشاهده فنی',section:s.section,
           level:hasSize?'evidence':'unknown',message:hasSize?(a4?'ابعاد این بخش نزدیک به A4 است؛ در پروفایل دکتری قاعده رسمی اندازه صفحه هنوز تأیید نشده است.':'ابعاد این بخش A4 نیست؛ این فقط ثبت فنی اندازه فایل است و هیچ حکم عدم انطباق دانشگاهی صادر نمی‌شود.'):'اندازه این بخش قابل استخراج نیست.',
           expected:'بدون مقدار الزام‌آور تأییدشده برای این پروفایل',actual:hasSize?`${s.width_mm}×${s.height_mm} mm`:'نامشخص',sourceId:'TECH-DOCX',
           note:'اندازه فایل در هر مقطع قابل مشاهده است، اما برای دکتری قاعده A4 از منابع بررسی‌شده تأیید نشده است.'}));
       }
       for(const k of ['top','bottom','right','left']){
         const actual=s.margins_mm?.[k],expected=p.margins[k],valid=typeof actual==='number'&&Number.isFinite(actual),good=valid&&Math.abs(actual-expected)<=1.5;
         results.push(result({code:'margin-'+k,category:'حاشیه '+labels[k],section:s.section,level:!valid?'unknown':good?'reference_match':'review',message:!valid?'مقدار حاشیه از این بخش قابل استخراج نیست.':good?'حاشیه با مقدار مرجع دانشگاه تهران مطابقت دارد.':'حاشیه با مقدار مرجع دانشگاه تهران تفاوت دارد؛ این یک هشدار مقایسه‌ای است، نه حکم عدم انطباق با نجف‌آباد.',expected:`${expected} mm`,actual:valid?`${actual} mm`:'نامشخص',sourceId:'UT-GENERAL-1403',note:'تلورانس مقایسه فنی: ±۱٫۵ میلی‌متر. این مقدار از مرجع دانشگاه تهران گرفته شده و برای واحد نجف‌آباد تأیید نشده است.'}));
       }
     }
   }
   const fonts=unique(report.defined_fonts),fontNorm=fonts.map(norm);
   for(const [label,expected] of [['فونت فارسی مرجع',p.persianFont],['فونت لاتین مرجع',p.englishFont]]){
     const found=fontNorm.some(f=>f===norm(expected)||f.includes(norm(expected)));
     results.push(result({code:'font-family-'+(label.includes('فارسی')?'fa':'en'),category:label,level:found?'evidence':'review',message:found?'نام فونت در فهرست فونت‌های دیده‌شده/سبک‌های DOCX وجود دارد؛ استفاده درست در تمام پاراگراف‌ها از این داده ثابت نمی‌شود.':'نام فونت مرجع در فهرست استخراج‌شده دیده نشد؛ ممکن است فونت به ارث رسیده یا در بخش بررسی‌نشده باشد.',expected,actual:fonts.length?fonts.join('، '):'فونتی استخراج نشد',sourceId:'UT-GENERAL-1403',note:'بازرس فعلی فهرست فونت‌ها را از XML و سبک‌ها می‌خواند؛ تخصیص واقعی هر فونت به هر پاراگراف را کامل بررسی نمی‌کند.'}));
   }
   const sizes=unique((report.defined_sizes_pt||[]).map(x=>String(x)+' pt'));
   // A style-font-size registry is NOT a per-paragraph audit. Missing a nominal size is informational, never a defect.
   results.push(result({code:'font-sizes-evidence',category:'اندازه قلم‌ها',level:sizes.length?'evidence':'unknown',
     message:sizes.length?'فهرست اندازه قلم‌های تعریف‌شده شناسایی شد. از این فهرست نمی‌توان نتیجه گرفت متن یا تیتر مشخصی با اندازه نادرست نوشته شده است.':'اندازه‌های قلم از سند استخراج نشدند؛ بررسی واقعی پاراگراف‌ها امکان‌پذیر نیست.',
     expected:`مقادیر مرجع: فارسی ${p.persianBodyPt} pt؛ لاتین ${p.englishBodyPt} pt؛ عنوان فصل ${p.chapterPt}/${p.englishChapterPt} pt`,
     actual:sizes.length?sizes.join('، '):'اندازه‌ای استخراج نشد',sourceId:'UT-GENERAL-1403',
     note:'فهرست سبک‌ها ممکن است شامل اندازه‌های استفاده‌نشده باشد یا اندازه واقعی از سبک‌ها به ارث برسد. تا تحلیل تک‌تک پاراگراف‌ها، عدم حضور عدد ۱۷ pt خطا یا هشدار قالب‌بندی نیست.'}));
   const sig=report.opening_signals||{};
   const signalChecks=[
    ['institution','نشانه نام دانشگاه','دانشگاه / University'],
    ['thesisOrDissertation','نشانه عنوان پایان‌نامه/رساله','پایان‌نامه / رساله / Thesis / Dissertation'],
    ['author','نشانه نام نگارنده','نام دانشجو / نگارنده / By'],
    ['supervisor','نشانه استاد راهنما','استاد راهنما / Supervisor'],
    ['graduationDate','نشانه سال یا تاریخ','سال دفاع/دانش‌آموختگی']
   ];
   for(const [key,label,expected] of signalChecks){
     const found=sig[key]===true;
     results.push(result({code:'front-'+key,category:'صفحه عنوان · '+label,level:found?'evidence':'review',message:found?'یک نشانه متنی در ابتدای سند پیدا شد؛ صحت و جایگاه آن باید انسانی تأیید شود.':'نشانه متنی در ۴۰ پاراگراف غیرخالی اول پیدا نشد؛ ممکن است با عبارت دیگری نوشته شده یا بیرون از محدوده جست‌وجو باشد.',expected,actual:found?'نشانه یافت شد':'نشانه یافت نشد',sourceId:'UT-GENERAL-1403',note:'جست‌وجو بر پایه ۴۰ پاراگراف اول DOCX است، نه تشخیص صفحه فیزیکی عنوان.'}));
   }
   const foundMasters=sig.mastersMarker===true||sig.degreeMarker==='masters';
   const foundPhd=sig.phdMarker===true||sig.degreeMarker==='phd';
   const degreeFound=degree==='masters'?foundMasters:foundPhd;
   const oppositeFound=degree==='masters'?foundPhd:foundMasters;
   const degreeLevel=(degreeFound&&oppositeFound)?'unknown':degreeFound?'evidence':'review';
   let degreeMessage;
   if(degreeFound&&oppositeFound)degreeMessage='نشانه هر دو مقطع در متن آغازین دیده شد؛ ممکن است یکی از آن‌ها در توضیحات باشد. تشخیص صفحه عنوان باید دستی انجام شود.';
   else if(degreeFound)degreeMessage='نشانه متنی متناسب با مقطع انتخابی دیده شد؛ متن دقیق صفحه عنوان را بررسی کن.';
   else if(oppositeFound)degreeMessage='در ابتدای فایل، نشانه مقطع دیگر دیده شد اما نشانه مقطع انتخابی پیدا نشد. احتمالاً پروفایل اشتباه انتخاب شده است؛ صفحه عنوان را بررسی کن.';
   else degreeMessage='نشانه روشن مقطع انتخابی در ابتدای سند پیدا نشد؛ ممکن است عنوان به شکل دیگری نوشته شده باشد.';
   results.push(result({code:'front-degree',category:'عبارت مقطع در صفحات آغازین',level:degreeLevel,message:degreeMessage,expected:degree==='masters'?'کارشناسی ارشد / Master’s':'دکتری تخصصی / PhD',actual:`نشانه ارشد: ${foundMasters?'بله':'خیر'}؛ نشانه دکتری: ${foundPhd?'بله':'خیر'}`,sourceId:'UT-GENERAL-1403',note:'این بررسی متکی به متن آغازین و نه تشخیص قطعی صفحه عنوان است؛ اشاره به هر مقطع در متن می‌تواند نتیجه را تغییر دهد.'}));
   manual.push({id:'front-matter-order',title:'ترتیب صفحات آغازین، چکیده و فهرست‌ها',why:'ترتیب پیشنهادی در مرجع دانشگاه تهران آمده است؛ بازرس فعلی صفحه‌بندی واقعی و ترتیب همه اجزا را با اطمینان کامل استخراج نمی‌کند.',source_id:'UT-GENERAL-1403'});
   manual.push({id:'reference-language-order',title:'ترتیب منابع فارسی و غیرفارسی',why:'راهنمای مرجع دانشگاه تهران منابع فارسی را پیش از منابع انگلیسی قرار می‌دهد؛ این کنترل در نسخه فعلی خودکار نیست.',source_id:'UT-GENERAL-1403'});
   manual.push({id:'ai-use-disclosure',title:'توضیح استفاده از ابزارهای هوش مصنوعی (در صورت استفاده)',why:'مرجع دانشگاه تهران می‌گوید در صورت استفاده، میزان و روش استفاده در صفحه‌ای جداگانه توضیح داده شود. افزونه نمی‌تواند از روی فایل به‌تنهایی بداند آیا از ابزار استفاده شده است.',source_id:'UT-GENERAL-1403'});
   manual.push({id:'architecture-specific',title:'قواعد اختصاصی رشته/گرایش معماری و واحد نجف‌آباد',why:'تا دریافت و تأیید اصل شیوه‌نامه جاری نجف‌آباد، قالب جلد، جزئیات خاص گروه، تعداد فصل‌ها و قواعد اختصاصی دانشگاه فعال نمی‌شوند.',source_id:null});
   // Paragraph-level evidence: only recognized BodyText/Heading styles are compared
   // to a non-binding reference. Normal styles and unknown fonts are never errors.
   const para=report.paragraph_audit||null;
   const paragraphReview={analyzed:para?.analyzed||0,truncated:!!para?.truncated,items:[],review:0,unknown:0,evidence:0,
     guidance:'برچسب‌های نقش متنی (تیتر احتمالی، عنوان شکل، متن طولانی) صرفاً بر اساس الگوی متن هستند و حکم قالب‌بندی یا مقررات رسمی نیستند.'};
   for(const row of (para?.paragraphs||[])){
     const refBody=/(body(?:\s*text)?|textbody|متن(?:[-_ ]|$))/i.test(row.style_id||'');
     const refHeading=row.role==='heading-styled' && /heading\s*1|title|عنوان\s*فصل/i.test(row.style_id||'');
     let level='evidence',reasons=[];
     for(const [script,label,font,pt] of [['fa','فارسی',p.persianFont,refHeading?p.chapterPt:p.persianBodyPt],['en','لاتین',p.englishFont,refHeading?p.englishChapterPt:p.englishBodyPt]]){
       const x=row[script];if(!x||x.status==='not-present')continue;
       if(x.status==='mixed'){level='review';reasons.push('چند فونت/اندازه در متن '+label+'؛ بررسی عمدی‌بودن لازم است.');}
       if((refBody||refHeading)&&x.status==='resolved'&&x.confidence==='defined'){
         if(x.font&&norm(x.font)!==norm(font)){level='review';reasons.push(`فونت ${label}: ${x.font} / مرجع موقت ${font}`);}
         if(x.sizePt!=null&&Math.abs(x.sizePt-pt)>0.25){level='review';reasons.push(`اندازه ${label}: ${x.sizePt} / مرجع موقت ${pt} pt`);}
       }
       if(x.unknownRuns>0&&level!=='review'){level='unknown';reasons.push('برخی ویژگی‌های فونت/اندازه حل نشده‌اند.');}
     }
     if(!row.line_spacing&&level==='evidence'){
       level='unknown';reasons.push('فاصله خطوط از سبک‌های قابل خواندن تعیین نشده است.');
     }
     if(!refBody&&!refHeading)reasons.push('نقش احتمالی: '+(row.role||'نامشخص')+'؛ صرفاً شواهد ساختاری، نه کنترل الزام‌آور.');
     paragraphReview.items.push({...row,level,reason:reasons.join(' | ')||'مشخصات استخراج‌شده؛ بدون هشدار قطعی',reference_scope:(refBody?'body-text':refHeading?'heading':'unclassified')});
   }
   paragraphReview.role_counts={};
   paragraphReview.font_counts={};
   for(const r of paragraphReview.items){
     const role=r.role||'unclassified';paragraphReview.role_counts[role]=(paragraphReview.role_counts[role]||0)+1;
     for(const script of ['fa','en'])if(r[script]?.font){const font=r[script].font;paragraphReview.font_counts[font]=(paragraphReview.font_counts[font]||0)+1;}
   }
   paragraphReview.review=paragraphReview.items.filter(r=>r.level==='review').length;
   paragraphReview.unknown=paragraphReview.items.filter(r=>r.level==='unknown').length;
   paragraphReview.evidence=paragraphReview.items.filter(r=>r.level==='evidence').length;
   const counts={reference_match:results.filter(x=>x.level==='reference_match').length,review:results.filter(x=>x.level==='review').length,evidence:results.filter(x=>x.level==='evidence').length,unknown:results.filter(x=>x.level==='unknown').length};
   return {app:'AyinYar',version:'0.11.1',type:'provisional-thesis-compliance-comparison',generated_at:new Date().toISOString(),filename:report.filename||'DOCX',degree:p.degree,degree_label:p.label,profile_id:p.id,profile_status:p.status,university_target:'دانشگاه آزاد اسلامی واحد نجف‌آباد',official_iaun_rules_active:0,source_registry:Object.values(SOURCES),results,manual_checks:manual,paragraph_review:paragraphReview,summary:{total:results.length,...counts,manual_checks:manual.length},disclaimer:'این گزارش فقط مقایسه فنی با منابع مرجع دانشگاه تهران است. هیچ قاعده قالب‌بندی جاری از سازمان مرکزی دانشگاه آزاد یا واحد نجف‌آباد در این نسخه تأیید نشده؛ بنابراین اختلاف‌ها تخلف یا رد رسمی رساله محسوب نمی‌شوند. هیچ فایل Word تغییر نمی‌کند.'};
 }
 const api=Object.freeze({evaluate,getProfile,sources:SOURCES,profiles:PROFILES});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.AyinCompliance=api;
})(typeof window==='undefined'?globalThis:window);
