/* AyinYar 0.9 — offline Jalali deadlines and RFC 5545 calendar export.
 * Persian new-year arithmetic follows the break-year method used by
 * jalaali-js (MIT license, github.com/jalaali/jalaali-js), adapted for
 * conversion via JavaScript's UTC Date arithmetic. No network calls.
 */
(function(root){
 'use strict';
 const breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
 const dayMS=86400000;
 const div=(a,b)=>Math.trunc(a/b), mod=(a,b)=>a-div(a,b)*b;
 function marchDay(jy){
   if(!Number.isInteger(jy)||jy<breaks[0]||jy>=breaks[breaks.length-1])throw Error('سال شمسی خارج از محدوده محاسبه است.');
   let gy=jy+621, leapJ=-14,jp=breaks[0],jump=0;
   for(let i=1;i<breaks.length;i++){
     const jm=breaks[i];jump=jm-jp;if(jy<jm)break;
     leapJ+=div(jump,33)*8+div(mod(jump,33),4);jp=jm;
   }
   const n=jy-jp;
   leapJ+=div(n,33)*8+div(mod(n,33)+3,4);
   if(mod(jump,33)===4 && jump-n===4)leapJ+=1;
   const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;
   return {gy,day:20+leapJ-leapG};
 }
 function startOfJalali(jy){const m=marchDay(jy);return Math.round(Date.UTC(m.gy,2,m.day)/dayMS);}
 function normalizeDigits(s){return String(s??'').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));}
 function parseJalali(value){
   const s=normalizeDigits(value).trim().replace(/-/g,'/');
   const mat=/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
   if(!mat)return null;
   const year=Number(mat[1]),month=Number(mat[2]),day=Number(mat[3]);
   if(year<1300||year>1500||month<1||month>12||day<1)return null;
   const leap=(startOfJalali(year+1)-startOfJalali(year))===366;
   const max=month<=6?31:month<=11?30:(leap?30:29);
   if(day>max)return null;
   return {year,month,day,canonical:`${year}/${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`};
 }
 function jalaliDayNumber(value){
   const d=typeof value==='string'?parseJalali(value):value;
   if(!d)return null;
   return startOfJalali(d.year)+(d.month<=7?(d.month-1)*31:186+(d.month-7)*30)+d.day-1;
 }
 function gregorianFromJalali(value){
   const dn=jalaliDayNumber(value);if(dn===null)return null;
   const t=new Date(dn*dayMS);
   return {year:t.getUTCFullYear(),month:t.getUTCMonth()+1,day:t.getUTCDate(),iso:t.toISOString().slice(0,10),dayNumber:dn};
 }
 function nowIranDay(now=new Date()){
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
   const partsMap=Object.fromEntries(parts.map(p=>[p.type,p.value]));
   return Math.round(Date.UTC(+partsMap.year,+partsMap.month-1,+partsMap.day)/dayMS);
 }
 function assess(records,{todayDay=nowIranDay(),windowDays=7,showPast=true}={}){
   const result=[];
   for(const raw of records||[]){
     if(!raw || !raw.deadline_jalali)continue;
     const d=gregorianFromJalali(raw.deadline_jalali);
     if(!d){ result.push({record:raw,state:'invalid',days:null,date:null});continue; }
     const days=d.dayNumber-todayDay;
     if(!showPast&&days<0)continue;
     const state=days<0?'past':days===0?'today':days<=windowDays?'soon':'later';
     result.push({record:raw,state,days,date:d});
   }
   const order={invalid:0,today:1,soon:2,later:3,past:4};
   result.sort((a,b)=>order[a.state]-order[b.state]||(a.days??Infinity)-(b.days??Infinity)||(a.record.title||'').localeCompare(b.record.title||''));
   return result;
 }
 function counts(items){return Object.fromEntries(['invalid','today','soon','later','past'].map(k=>[k,items.filter(x=>x.state===k).length]));}
 const esc=s=>String(s??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 function foldLine(line){
   // RFC5545 says fold at <=75 UTF-8 octets (not characters), continuation starts with one space.
   let parts=[],buf='',n=0;
   for(const c of line){const bytes=unescape(encodeURIComponent(c)).length;const limit=parts.length?74:75;
     if(n+bytes>limit && buf){parts.push(buf);buf=' ';n=1;}
     buf+=c;n+=bytes;
   }
   if(buf)parts.push(buf);
   return parts.join('\r\n');
 }
 function makeICS(records, {alarmDays=1, generatedAt=new Date()}={}){
   if(![0,1,3,7].includes(alarmDays))throw Error('تنظیم یادآوری نامعتبر است.');
   const items=assess(records,{todayDay:0}).filter(x=>x.date);
   if(!items.length)throw Error('هیچ مهلت شمسی معتبر برای خروجی تقویم وجود ندارد.');
   const stamp=generatedAt.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
   const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AyinYar//Research Deadlines 0.9//FA','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+esc('مهلت‌های پژوهشی آیین‌یار')];
   for(const item of items){
     const r=item.record,d=item.date;
     const compact=d.iso.replace(/-/g,'');
     const end=new Date((d.dayNumber+1)*dayMS).toISOString().slice(0,10).replace(/-/g,'');
     const id=String(r.id||'unknown').replace(/[^a-zA-Z0-9-]/g,'').slice(0,85);
     const desc=[r.excerpt||'',`تاریخ اعلام‌شده: ${r.deadline_jalali}`, 'ثبت دستی کاربر؛ اعتبار اطلاعیه و تمدید مهلت مستقلاً تأیید نشده است.'].filter(Boolean).join('\n');
     const link=String(r.post_url||'');
     lines.push('BEGIN:VEVENT',`UID:${id}@ayinyar.local`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${compact}`,`DTEND;VALUE=DATE:${end}`,'SUMMARY:'+esc('مهلت پژوهشی: '+r.title),'DESCRIPTION:'+esc(desc));
     if(/^https:\/\//i.test(link))lines.push('URL:'+link.replace(/[\r\n]/g,''));
     if(alarmDays>0)lines.push('BEGIN:VALARM','ACTION:DISPLAY',`TRIGGER:-P${alarmDays}D`,'DESCRIPTION:'+esc('یادآوری مهلت: '+r.title),'END:VALARM');
     lines.push('END:VEVENT');
   }
   lines.push('END:VCALENDAR');
   return lines.map(foldLine).join('\r\n')+'\r\n';
 }
 const api={parseJalali,normalizeDigits,gregorianFromJalali,jalaliDayNumber,nowIranDay,assess,counts,makeICS,marchDay};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.AyinCalendar=Object.freeze(api);
})(typeof window==='undefined'?globalThis:window);
