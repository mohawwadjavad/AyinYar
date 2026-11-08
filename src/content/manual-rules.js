/* AyinYar 0.3 — local user-entered technical checks, NEVER university law. */
(function(root){
  'use strict';
  function numeric(v) { if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:NaN; }
  function readProfile(value) {
    const src=value||{};
    const fields=['top','bottom','right','left'];
    const margins={};
    for(const k of fields){const n=numeric(src[k]); if(Number.isNaN(n)||n!==null&&(n<0||n>80))throw new Error('حاشیه '+k+' باید بین ۰ و ۸۰ میلی‌متر باشد.'); margins[k]=n;}
    return {kind:'user-entered-unverified',A4:Boolean(src.A4),margins_mm:margins,tolerance_mm:1.5,official:false,issued_by:'کاربر / تنظیم شخصی'};
  }
  function evaluate(report,profile) {
    const results=[]; const sections=Array.isArray(report.section_details)?report.section_details:[];
    if(!profile||profile.kind!=='user-entered-unverified'||profile.official!==false)throw new Error('پروفایل کنترل فاقد مشخصات ایمنی است.');
    if(!profile.A4 && Object.values(profile.margins_mm||{}).every(x=>x===null))throw new Error('حداقل یک معیار برای مقایسه انتخاب کن.');
    if(!sections.length)results.push({code:'no-sections',level:'unknown',message:'اطلاعات بخش‌های سند برای بررسی موجود نیست.'});
    for(const [index,s] of sections.entries()){
      const section=index+1;
      if(profile.A4){
        const found=s.width_mm!=null&&s.height_mm!=null;
        const fits=found&&((Math.abs(s.width_mm-210)<=2&&Math.abs(s.height_mm-297)<=2)||(Math.abs(s.width_mm-297)<=2&&Math.abs(s.height_mm-210)<=2));
        results.push({code:'page-size',section,level:!found?'unknown':fits?'pass':'review',message:!found?'اندازه صفحه مشخص نیست.':fits?'ابعاد صفحه مطابق مقدار A4 انتخاب‌شده است.':'اندازه صفحه با A4 انتخاب‌شده تفاوت دارد.',expected:'A4 (210×297 mm)',actual:found?`${s.width_mm}×${s.height_mm} mm`:'نامشخص'});
      }
      for(const k of ['top','bottom','right','left']){
        const requested=profile.margins_mm?.[k];if(requested===null||requested===undefined)continue;
        const actual=s.margins_mm?.[k]; const valid=typeof actual==='number'&&Number.isFinite(actual);
        const good=valid&&Math.abs(actual-requested)<=profile.tolerance_mm;
        const label={top:'بالا',bottom:'پایین',right:'راست',left:'چپ'}[k];
        results.push({code:'margin-'+k,section,level:!valid?'unknown':good?'pass':'review',message:!valid?'حاشیه '+label+' قابل استخراج نیست.':good?'حاشیه '+label+' با مقدار انتخاب‌شده مطابقت دارد.':'حاشیه '+label+' با مقدار انتخاب‌شده متفاوت است.',expected:`${requested} mm`,actual:valid?`${actual} mm`:'نامشخص'});
      }
    }
    return {type:'user-defined-docx-check',official:false,disclaimer:'این نتایج فقط براساس اعداد واردشده توسط کاربر هستند؛ هیچ ادعای انطباق با شیوه‌نامه دانشگاه ندارند.',profile,results,pass:results.filter(x=>x.level==='pass').length,review:results.filter(x=>x.level==='review').length,unknown:results.filter(x=>x.level==='unknown').length};
  }
  root.AyinManual={readProfile,evaluate};
})(typeof window!=='undefined'?window:globalThis);
