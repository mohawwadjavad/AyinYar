/* Pure metadata checks; no university-specific mandates are asserted. */
(function (root) {
  'use strict';
  function val(v) { return String(v == null ? '' : v).trim(); }
  function isDOI(text) { return /^10\.\d{4,9}\/\S+$/i.test(val(text).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')); }
  function isYearLike(v) { return /(?:1[3-4]\d{2}|(?:18|19|20)\d{2})/.test(val(v)); }
  function auditItem(item) {
    const notes=[];
    const type=val(item.type || '');
    if (!val(item.title)) notes.push('عنوان منبع ثبت نشده است.');
    if (!(item.creatorCount > 0)) notes.push('نویسنده یا پدیدآورنده ثبت نشده است؛ در منابع سازمانی و بدون نویسنده بررسی انسانی لازم است.');
    if (!val(item.date)) notes.push('تاریخ انتشار خالی است؛ ممکن است منبع بدون تاریخ باشد.');
    else if (!isYearLike(item.date)) notes.push('سال انتشار از تاریخ واردشده به‌سادگی قابل تشخیص نیست.');
    if (type === 'journalArticle' && !val(item.publicationTitle)) notes.push('نام نشریه خالی است.');
    if (type === 'bookSection' && !val(item.bookTitle)) notes.push('نام کتاب مادر ثبت نشده است.');
    if (type === 'thesis' && !val(item.university)) notes.push('نام دانشگاه برای رساله/پایان‌نامه ثبت نشده است.');
    if (val(item.DOI) && !isDOI(item.DOI)) notes.push('ساختار DOI واردشده نیازمند بررسی است (اعتبار واقعی آنلاین بررسی نشده).');
    return { title:val(item.title) || 'بدون عنوان', type:type || 'نامشخص', key:val(item.key), libraryID:item.libraryID || null, issues:notes, status:notes.length ? 'review' : 'no_obvious_issue' };
  }
  function duplicateKey(item){
    const doi=val(item.DOI).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').toLowerCase();
    if(doi&&isDOI(doi))return 'doi:'+doi;
    const title=val(item.title).toLocaleLowerCase().replace(/[\s\p{P}\p{S}\u200c]+/gu,'').slice(0,160);
    const date=val(item.date).match(/(?:1[3-4]\d{2}|(?:18|19|20)\d{2})/);
    return title.length>=12&&date?'title:'+title+':'+date[0]:null;
  }
  root.AyinValidators = { auditItem, isDOI, isYearLike, duplicateKey };
})(typeof window !== 'undefined' ? window : globalThis);
