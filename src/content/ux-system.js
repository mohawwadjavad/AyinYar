/* AyinYar 0.30.0 — local-first, accessible navigation and onboarding layer.
 * Does not read or modify library records, API keys, settings or documents.
 * All navigation passes through existing [data-page] handlers in app.js.
 */
(function (root) {
  'use strict';
  const byId = id => document.getElementById(id);
  const el = (tag, cls, value) => {
    const n = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    if (cls) n.className = cls;
    if (value !== undefined) n.textContent = value;
    return n;
  };
  const GUIDE = Object.freeze({
    dashboard: {group:'شروع',name:'داشبورد',why:'یک مسیر مشخص انتخاب کن؛ برای شروع لازم نیست همه ابزارها را بشناسی.',steps:['اگر منابعی در Zotero داری، از «بازرس منابع» شروع کن.','برای بررسی پایان‌نامه، فایل DOCX را در «بازرس Word» انتخاب کن.','برای تحلیل هوش مصنوعی، اول نوع موتور و پیش‌نیاز اتصال را مشخص کن.'],aliases:'خانه شروع راهنما اول'},
    references:{group:'منابع و مقالات',name:'بازرس منابع Zotero',why:'کیفیت اطلاعات منابع را بدون تغییر فایل‌ها و رکوردهای کتابخانه بررسی می‌کند.',steps:['به پنجرهٔ اصلی Zotero برو و چند منبع اصلی را انتخاب کن؛ خود فایل PDF را به‌تنهایی انتخاب نکن.','به آیین‌یار برگرد و «بررسی منابع انتخاب‌شده» را بزن.','اخطارها را مرور کن و در صورت نیاز گزارش بگیر؛ هیچ موردی خودکار اصلاح نمی‌شود.'],aliases:'doi کتاب مقاله اشتباه ناقص منابع'},
    matrix:{group:'منابع و مقالات',name:'ماتریس پیشینه و شواهدیار',why:'منابع پژوهش را کنار هم سازمان‌دهی و شواهد قابل‌پیگیری ثبت می‌کند.',steps:['منابع منتخب Zotero را اضافه کن یا یک منبع دستی ثبت کن.','برای هر منبع، روش، یافته و شواهد را تکمیل و بازبینی کن.','پس از کنترل اطلاعات، از ماتریس یا شواهد خروجی بگیر.'],aliases:'جدول پیشینه مرور ادبیات مقایسه مقاله'},
    related:{group:'منابع و مقالات',name:'کشف مقالات مرتبط',why:'جست‌وجوی پژوهش‌های مرتبط با استفاده از سرویس‌های علمی عمومی؛ نیازمند اینترنت.',steps:['عنوان یا DOI را وارد کن، یا منبع انتخابی Zotero را بخوان.','پایگاه‌های جست‌وجو را انتخاب و جست‌وجو را اجرا کن.','نتایج را از نظر ارتباط و اعتبار بررسی کن؛ ذخیره در Zotero فقط با تأیید توست.'],aliases:'مقاله جدید مشابه crossref openalex semantic scholar'},
    'ai-local':{group:'تحلیل و هوش مصنوعی',name:'هوش مصنوعی محلی و آنلاین',why:'خلاصه، پرسش‌وپاسخ و تحلیل اولیه متن با مدل محلی یا سرویس آنلاین.',steps:['یک موتور انتخاب کن: Ollama (نصب محلی)، یا Gemini / OpenRouter (کلید API).','اتصال را بررسی کن؛ برای سرویس‌های آنلاین راهنمای ساخت کلید کنار کادر کلید است.','متن را وارد کن، اجازهٔ ارسال را با دقت بخوان و سپس تحلیل را اجرا کن؛ نتیجه نیازمند بازبینی انسانی است.'],aliases:'هوش مصنوعی خلاصه چت ollama gemini openrouter api'},
    'ai-rag':{group:'تحلیل و هوش مصنوعی',name:'گفت‌وگو با PDF',why:'پاسخ به سؤال بر اساس متن PDF منتخب، با ارجاع به بخش‌های بازیابی‌شده.',steps:['در Zotero، مقاله یا پیوست PDF موردنظر را انتخاب کن.','ابتدا PDF را بخوان و مدل محلی Ollama را بررسی کن.','سؤال مشخص بپرس و متن شاهد را با فایل اصلی تطبیق بده.'],aliases:'rag پی دی اف پرسش پاسخ مقاله'},
    word:{group:'تحلیل و هوش مصنوعی',name:'بازرس فایل Word',why:'ساختار فایل DOCX را در حافظه تحلیل می‌کند؛ متن اصلی ویرایش نمی‌شود.',steps:['فایل DOCX پایان‌نامه یا مقاله را از دستگاه انتخاب کن.','گزارش و موارد نیازمند بازبینی را مرور کن.','خروجی دلخواه را ذخیره کن یا معیارهای شخصی را به‌صورت آزمایشی بررسی کن.'],aliases:'ورد docx پاراگراف جداول عکس استناد'},
    visuals:{group:'تحلیل و هوش مصنوعی',name:'گالری تصاویر و جداول',why:'شکل‌ها، جداول و نمودارهای PDF را برای مشاهده و خروجی آماده می‌کند.',steps:['PDF را در Zotero باز کن یا یک پیوست مرتبط انتخاب کن.','ابتدا اسکن بدون AI را اجرا کن؛ بخش ONNX پیشرفته و وابسته به موتور محلی است.','موارد درست را انتخاب کن و فایل‌ها را ذخیره کن؛ دسته‌بندی خودکار ممکن است اشتباه کند.'],aliases:'تصویر نمودار جدول شکل crop onnx pdf'},
    compliance:{group:'ضوابط و راهنمای پژوهش',name:'کنترل انطباق رساله',why:'بررسی مشورتی در برابر منابع در دسترس؛ جایگزین ارزیابی رسمی دانشگاه نیست.',steps:['مقطع تحصیلی را انتخاب کن.','DOCX خود را وارد کن و گزارش انطباق را اجرا کن.','برای هر هشدار، مرجع و میزان اطمینان را بررسی کن؛ موارد فاقد منبع رسمی صرفاً پیشنهادی‌اند.'],aliases:'شیوه نامه پایان نامه رساله مقررات دانشگاه'},
    regulations:{group:'ضوابط و راهنمای پژوهش',name:'بانک مقررات',why:'بسته اطلاعات پژوهشی و لینک منابع؛ اعتبار و تاریخ انتشار هر مرجع را بررسی کن.',steps:['کلیدواژه مقرره موردنظر را جست‌وجو کن.','برای هر مورد منبع و وضعیت به‌روزرسانی را بخوان.','قبل از استناد رسمی، آخرین متن معتبر را از دانشگاه دریافت کن.'],aliases:'قانون آیین نامه بخشنامه جستجو'},
    news:{group:'خدمات پژوهشی',name:'اطلاعیه‌ها و اخبار پژوهشی',why:'ثبت و مدیریت محلی اطلاعیه‌ها؛ موارد ذخیره‌شده الزاماً خبر تأییدشده دانشگاه نیستند.',steps:['برای افزودن، عنوان و منبع و تاریخ را با دقت وارد کن.','برای یافتن مورد قبلی از فیلتر و جست‌وجو استفاده کن.','پیش از بازیابی پشتیبان، حتماً شیوهٔ ادغام یا جایگزینی را بررسی کن.'],aliases:'خبر اطلاعیه رویداد کارگاه پشتیبان'},
    deadlines:{group:'خدمات پژوهشی',name:'مهلت‌ها و تقویم',why:'موعدها را از اطلاعیه‌های ثبت‌شده نمایش می‌دهد و فایل تقویم می‌سازد.',steps:['اول اطلاعیه‌ای با تاریخ معتبر ثبت کن.','فیلتر بازه زمانی و گزینهٔ یادآوری را انتخاب کن.','فایل ICS بساز و در برنامه تقویم خود وارد کن؛ آیین‌یار اعلان پس‌زمینه‌ای ارسال نمی‌کند.'],aliases:'سررسید تقویم تاریخ deadline ics یادآوری'},
    researcher:{group:'حساب و راهنما',name:'پروفایل پژوهشگر',why:'شخصی‌سازی نام نمایشی و اطلاعات اختیاری در تنظیمات محلی.',steps:['در صورت تمایل نام نمایشی و مقطع را وارد کن.','روی «ذخیره پروفایل» بزن.','برای تغییر یا پاک‌سازی، در همین صفحه اقدام کن.'],aliases:'نام کاربری اسم حساب zotero'},
    university:{group:'حساب و راهنما',name:'انتخاب واحد دانشگاهی',why:'در این نسخه فقط بستهٔ دانشگاه آزاد اسلامی واحد نجف‌آباد فعال است.',steps:['نام واحد دانشگاهی فعال را بررسی کن.','در صورت استفاده از همین واحد، آن را ثبت کن.','برای دانشجوی واحدهای دیگر، قواعد این بسته را به‌عنوان مقررات رسمی واحد خود تلقی نکن.'],aliases:'دانشگاه نجف آباد آزاد انتخاب واحد'},
    about:{group:'حساب و راهنما',name:'درباره افزونه',why:'مشخصات نسخه، سازنده و راه ارتباطی برای ارائه بازخورد.',steps:['برای ارسال پیشنهاد یا گزارش خطا از ایمیل درج‌شده استفاده کن.','گزارش خطا را با نام ابزار، گام‌های تکرار، نسخه Zotero و نتیجه مورد انتظار کامل کن.','اطلاعات حساس، کلید API یا محتوای خصوصی پژوهش را در گزارش عمومی قرار نده.'],aliases:'تماس پشتیبانی گزارش باگ نسخه ایمیل'}
  });
  let current = 'dashboard';
  const backStack = [];
  let skipHistory = false;
  let commandOpen = false;
  let helpOpen = false;
  let menuOpen = false;
  let lastFocus = null;
  let searchMatches = [];
  let activeIndex = 0;

  function normalize(s) {
    return String(s||'').toLocaleLowerCase('fa').replace(/[يى]/g,'ی').replace(/ك/g,'ک')
      .replace(/[أإٱ]/g,'ا').replace(/[ًٌٍَُِّْ]/g,'').replace(/\u200c/g,' ')
      .replace(/[\u06f0-\u06f9]/g,x=>String(x.charCodeAt(0)-0x06f0))
      .replace(/\s+/g,' ').trim();
  }
  function navigate(id) {
    if (!Object.prototype.hasOwnProperty.call(GUIDE,id)) return false;
    const target = Array.from(document.querySelectorAll('.nav-btn[data-page]')).find(x=>x.dataset.page===id);
    if (!target) return false;
    target.click();
    return true;
  }
  function setMenu(show) {
    menuOpen=Boolean(show);
    byId('app')?.classList.toggle('ux-mobile-open', menuOpen);
    const btn=byId('ux-mobile-menu');
    if(btn)btn.setAttribute('aria-expanded',String(menuOpen));
    const scrim=byId('ux-sidebar-scrim');if(scrim)scrim.hidden=!menuOpen;
  }
  function toggleHelp(show) {
    helpOpen=Boolean(show);
    const panel=byId('ux-help-panel');
    if(!panel)return;
    panel.hidden=!helpOpen;
    byId('ux-help-toggle')?.setAttribute('aria-expanded',String(helpOpen));
    if(helpOpen){renderHelp();byId('ux-help-close')?.focus({preventScroll:true});}
    else byId('ux-help-toggle')?.focus({preventScroll:true});
  }
  function renderHelp() {
    const guide=GUIDE[current]||GUIDE.dashboard;
    byId('ux-help-title').textContent=guide.name;
    byId('ux-help-summary').textContent=guide.why;
    const list=byId('ux-help-steps');list.replaceChildren();
    for(const line of guide.steps)list.appendChild(el('li','',line));
  }
  function updateCommandResults() {
    const query=normalize(byId('ux-command-input')?.value);
    const keys=query.split(' ').filter(Boolean);
    searchMatches=Object.entries(GUIDE).filter(([key, info])=>{
      const hay=normalize([key,info.name,info.group,info.why,info.aliases].join(' '));
      return keys.every(word=>hay.includes(word));
    });
    // Prefer an exact tool/alias match over an incidental substring in a description.
    if(keys.length){
      const relevance=([key,info])=>keys.reduce((score,word)=>{
        const title=normalize(info.name),alias=normalize(info.aliases),group=normalize(info.group);
        const t=title.split(' '),a=alias.split(' ');
        return score+(title===word?20:t.includes(word)?16:a.includes(word)?14:title.includes(word)?7:alias.includes(word)?5:group.includes(word)?2:0);
      },0);
      searchMatches.sort((a,b)=>relevance(b)-relevance(a));
    }
    const list=byId('ux-command-results');list.replaceChildren();
    activeIndex=0;
    if(!searchMatches.length){byId('ux-command-input').removeAttribute('aria-activedescendant');list.appendChild(el('p','ux-command-empty','ابزاری پیدا نشد. نام ساده‌تری مثل «مقاله»، «Word» یا «هوش مصنوعی» بنویس.'));return;}
    for(const [idx,[id,info]] of searchMatches.entries()){
      const button=el('button','ux-command-result');button.type='button';
      button.setAttribute('role','option');button.id='ux-command-result-'+idx;
      button.setAttribute('aria-selected', String(idx===0));
      button.appendChild(el('strong','',info.name));
      button.appendChild(el('small','',info.group+' · '+info.why));
      button.addEventListener('mouseenter',()=>highlight(idx));
      button.addEventListener('click',()=>{hideCommand();navigate(id);});
      list.appendChild(button);
    }
    byId('ux-command-input').setAttribute('aria-activedescendant','ux-command-result-0');
  }
  function highlight(idx){
    const options=Array.from(byId('ux-command-results').querySelectorAll('[role="option"]'));
    if(!options.length)return;
    activeIndex=(idx+options.length)%options.length;
    for(let i=0;i<options.length;i++)options[i].setAttribute('aria-selected',String(i===activeIndex));
    byId('ux-command-input').setAttribute('aria-activedescendant',options[activeIndex].id);
    options[activeIndex].scrollIntoView({block:'nearest'});
  }
  function openCommand() {
    if(commandOpen)return;
    lastFocus=document.activeElement;
    commandOpen=true;
    if(menuOpen)setMenu(false);
    if(helpOpen)toggleHelp(false);
    const overlay=byId('ux-command-overlay');overlay.hidden=false;
    byId('ux-command-input').value='';updateCommandResults();byId('ux-command-input').focus();
  }
  function hideCommand() {
    if(!commandOpen)return;
    commandOpen=false;byId('ux-command-overlay').hidden=true;
    if(lastFocus?.isConnected && typeof lastFocus.focus==='function')lastFocus.focus({preventScroll:true});
    else byId('ux-search-trigger')?.focus({preventScroll:true});
  }
  function onNavigate(id) {
    if(!Object.prototype.hasOwnProperty.call(GUIDE,id))return;
    if(id!==current){if(!skipHistory){backStack.push(current);if(backStack.length>30)backStack.shift();}current=id;}
    skipHistory=false;
    const back=byId('ux-back');if(back)back.hidden=!backStack.length;
    const breadcrumb=byId('ux-breadcrumb');if(breadcrumb)breadcrumb.textContent=GUIDE[id].group+' / '+GUIDE[id].name;
    if(helpOpen)renderHelp();
    if(menuOpen)setMenu(false);
    const view=byId('ux-main');if(view)view.scrollTop=0;
    const page=byId('page-'+id);
    const heading=page?.querySelector('h1');
    if(heading && id!=='dashboard'){
      heading.setAttribute('tabindex','-1');
      try{heading.focus({preventScroll:true});}catch(_){/* Gecko focus compatibility */}
    }
  }
  function goBack(){
    while(backStack.length){const id=backStack.pop();if(id!==current&&GUIDE[id]){skipHistory=true; if(!navigate(id))skipHistory=false;return;}}
  }
  function addPageHints() {
    for(const section of document.querySelectorAll('.page[id^="page-"]')){
      const id=section.id.slice(5), info=GUIDE[id];
      if(!info || id==='dashboard' || section.querySelector('.ux-page-hint'))continue;
      const details=el('details','ux-page-hint');
      const summary=el('summary','','راهنمای سریع استفاده از این ابزار');details.appendChild(summary);
      details.appendChild(el('p','ux-hint-why',info.why));
      const list=el('ol','ux-hint-steps');for(const text of info.steps)list.appendChild(el('li','',text));details.appendChild(list);
      const anchor=section.querySelector('.lead') || section.querySelector('h1');
      if(anchor)anchor.insertAdjacentElement('afterend', details);
      else section.insertBefore(details,section.firstChild);
    }
  }
  function addOnboarding() {
    const page=byId('page-dashboard');const stats=page?.querySelector('.stats');
    if(!stats || page.querySelector('.ux-onboarding'))return;
    const panel=el('section','ux-onboarding');panel.setAttribute('aria-labelledby','ux-onboarding-title');
    const head=el('div','ux-onboarding-head');
    const label=el('div');label.appendChild(el('span','ux-kicker','برای اولین استفاده'));label.appendChild(el('h2','', 'چه کاری می‌خواهی انجام بدهی؟')).id='ux-onboarding-title';
    head.appendChild(label);
    const search=el('button','ux-onboarding-search','جست‌وجوی همه ابزارها ⌕');search.type='button';search.addEventListener('click',openCommand);head.appendChild(search);
    panel.appendChild(head);
    const choices=el('div','ux-onboarding-grid');
    const items=[
      {id:'references',symbol:'▤',title:'بررسی منابع',desc:'مقاله‌ها و کتاب‌های انتخاب‌شده در Zotero'},
      {id:'word',symbol:'▧',title:'بررسی پایان‌نامه',desc:'ساختار و مشکلات احتمالی یک فایل Word'},
      {id:'ai-local',symbol:'✦',title:'خلاصه با هوش مصنوعی',desc:'Ollama محلی یا Gemini و OpenRouter'},
      {id:'visuals',symbol:'▥',title:'استخراج از PDF',desc:'تصاویر، نمودارها و جداول مقاله'}
    ];
    for(const item of items){
      const btn=el('button','ux-workflow');btn.type='button';btn.dataset.uxTarget=item.id;
      btn.appendChild(el('span','ux-workflow-symbol',item.symbol));
      const copy=el('span','ux-workflow-copy');copy.appendChild(el('strong','',item.title));copy.appendChild(el('small','',item.desc));btn.appendChild(copy);
      btn.addEventListener('click',()=>navigate(item.id));choices.appendChild(btn);
    }
    panel.appendChild(choices);
    panel.appendChild(el('p','ux-onboarding-note','نکته: هیچ‌یک از این ابزارها بدون تأیید شما اطلاعات کتابخانه را تغییر نمی‌دهند. گزارش‌ها نیازمند بررسی پژوهشگر هستند.'));
    page.insertBefore(panel,stats);
  }
  function upgradeStatusAccessibility() {
    const candidates=Array.from(document.querySelectorAll('[id$="-status"], [id$="-summary"], .matrix-status'));
    for(const node of candidates){
      if(node.getAttribute('role')==='alert'||node.getAttribute('role')==='status')continue;
      node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');
    }
  }
  function reportIssue(){
    const page=GUIDE[current]||GUIDE.dashboard;
    const subject='گزارش مشکل آیین‌یار v0.30.0 — '+page.name;
    const body=['سلام،','در بخش «'+page.name+'» آیین‌یار با مشکل زیر مواجه شدم:','','۱) سیستم‌عامل و نسخه Zotero:','۲) کارهایی که انجام دادم:','۳) انتظار داشتم چه اتفاقی بیفتد:','۴) چه اتفاقی افتاد / متن خطا:','۵) آیا مشکل تکرارپذیر است؟:','','لطفاً کلید API و متن محرمانه پژوهش را ضمیمه نکنید.'].join('\n');
    if(root.AYINYAR_DEMO){byId('ux-report-status').textContent='ارسال گزارش در نسخهٔ نصب‌شده Zotero فعال می‌شود.';return;}
    const target='mailto:pumortem@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    try{
      const bridge=root.arguments?.[0]?.ayinyarOpenExternalURL;
      if(typeof bridge==='function'){bridge(target);byId('ux-report-status').textContent='درخواست بازکردن برنامه ایمیل ارسال شد. ارسال گزارش فقط پس از تأیید خود شما انجام می‌شود.';return;}
      const z=root.opener?.Zotero||root.Zotero;
      if(typeof z?.launchURL==='function'){z.launchURL(target);byId('ux-report-status').textContent='برنامهٔ ایمیل درخواست شد؛ ارسال نهایی با شماست.';return;}
    }catch(_){/* Show safe manual alternative instead of claiming success. */}
    byId('ux-report-status').textContent='بازکردن ایمیل ممکن نشد؛ به pumortem@gmail.com بنویس و نام این بخش، مراحل تکرار و متن خطا را شرح بده.';
  }
  function bind() {
    byId('ux-mobile-menu')?.addEventListener('click',()=>setMenu(!menuOpen));
    byId('ux-sidebar-scrim')?.addEventListener('click',()=>setMenu(false));
    byId('ux-search-trigger')?.addEventListener('click',openCommand);
    byId('ux-help-toggle')?.addEventListener('click',()=>toggleHelp(!helpOpen));
    byId('ux-help-close')?.addEventListener('click',()=>toggleHelp(false));
    byId('ux-report-issue')?.addEventListener('click',reportIssue);
    byId('ux-command-close')?.addEventListener('click',hideCommand);
    byId('ux-command-overlay')?.addEventListener('click',event=>{if(event.target===byId('ux-command-overlay'))hideCommand();});
    byId('ux-command-input')?.addEventListener('input',updateCommandResults);
    byId('ux-command-input')?.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();highlight(activeIndex+(e.key==='ArrowDown'?1:-1));}
      else if(e.key==='Enter'&&searchMatches.length){e.preventDefault();const id=searchMatches[activeIndex][0];hideCommand();navigate(id);}
    });
    byId('ux-back')?.addEventListener('click',goBack);
    root.addEventListener('resize',()=>{if(root.innerWidth>900&&menuOpen)setMenu(false);});
    document.addEventListener('keydown',e=>{
      const field=e.target?.matches?.('input,textarea,[contenteditable="true"]');
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){e.preventDefault();commandOpen?hideCommand():openCommand();return;}
      if(e.key==='/'&&!field&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();openCommand();return;}
      if(e.key==='Tab' && commandOpen){
        const focusables=Array.from(byId('ux-command-overlay')?.querySelectorAll('button:not([disabled]),input:not([disabled])')||[]).filter(x=>x.offsetParent!==null);
        if(focusables.length){const first=focusables[0],last=focusables[focusables.length-1];
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      }
      if(e.key==='Escape'){if(commandOpen){e.preventDefault();hideCommand();}else if(helpOpen){e.preventDefault();toggleHelp(false);}else if(menuOpen){e.preventDefault();setMenu(false);}}
    });
  }
  function init(){
    if(!byId('ux-search-trigger'))return;
    addPageHints();addOnboarding();upgradeStatusAccessibility();bind();onNavigate('dashboard');
  }
  root.AyinUX=Object.freeze({init,onNavigate,normalize,openCommand,navigate});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
