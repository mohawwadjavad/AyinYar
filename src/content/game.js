/* AyinYar 0.20.2 — seven-stage research adventure with visual/audio polish. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const LEVELS=root.AyinGameLevels||{sources:root.AyinGameData};
 const STAGE_ORDER=['topics','proposal','sources','methods','analysis','writing','defense'];
 let stageId='topics',DATA=LEVELS[stageId];
 if(!DATA||!$('stage')) return;
 const canvas=$('stage'),ctx=canvas.getContext('2d');
 if(!ctx){$('storage-status').textContent='این محیط از Canvas دوبعدی پشتیبانی نمی‌کند.';return;}
 const W=1600,H=470,GROUND=376,HERO_X=400;
 const LEGACY_PREF='extensions.ayinyar.game.score.v1',PREF='extensions.ayinyar.game.score.v2',META_PREF='extensions.ayinyar.game.meta.v1';
 const AVATARS=Object.freeze({backpack:'🎒',student:'🧑‍🎓',graduate:'👩‍🎓'});
 const STAGE_ICONS=Object.freeze({topics:'🌳',proposal:'📜',sources:'📚',methods:'🧭',analysis:'🧪',writing:'📝',defense:'🎓'});
 let playMode='story',profile={nickname:'دانشجوی پژوهشگر',avatar:'backpack'},profileOpen=false;
 const modes={normal:{speed:248,lives:3,damage:16,risk:.065},calm:{speed:188,lives:5,damage:10,risk:.025},study:{speed:170,lives:999,damage:3,risk:0}};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Keep the tuition monster fully inside the visible playfield. Its position
 // follows the chase meter, never the world-distance coordinate.
 function hunterPosition(){return 70+(clamp(run?.danger??28,0,100)/100)*(HERO_X-92-70);}
 let difficulty='normal',mode='intro',raf=0,last=0,sfx=true,musicOn=true,voiceOn=true,audio=null,quietMotion=false,musicStep=0,dialogueTimer=0,activeVoice=null,voiceGeneration=0,voiceChunkTimer=0,lastHazardHint='';
 // Seven original, synthesized stage motifs. No network, external audio, or copyrighted tracks.
 const STAGE_MUSIC=Object.freeze({
  topics:{melody:[523,587,659,784,659,587,523,440,523,659,784,880,784,659,587,523],bass:[131,147,165,147],beat:.19},
  proposal:{melody:[494,587,659,587,494,440,392,440,494,587,740,659,587,494,440,392],bass:[123,147,165,147],beat:.185},
  sources:{melody:[523,659,784,659,587,698,880,698,523,659,784,988,880,784,659,587],bass:[131,147,165,147],beat:.18},
  methods:{melody:[392,466,587,698,587,466,392,349,392,466,587,784,698,587,466,392],bass:[98,117,147,117],beat:.175},
  analysis:{melody:[440,554,659,880,659,554,440,330,440,659,831,880,831,659,554,440],bass:[110,139,165,139],beat:.165},
  writing:{melody:[349,440,523,587,523,440,392,349,440,523,698,659,587,523,440,392],bass:[87,110,131,110],beat:.17},
  defense:{melody:[523,659,784,1047,988,784,659,523,659,784,988,1175,1047,988,784,659],bass:[131,165,196,165],beat:.15}
 });
 const STORY_CUES=Object.freeze({
  topics:['🌳 سرنخ‌های موضوعی را دنبال کن؛ عنوانِ مبهم دام است!','🔎 شکاف پژوهشی را با شواهد واقعی پیدا کن.','👾 شهریه‌چی: «موضوعت که تکراری نباشه!»'],
  proposal:['📜 مسئله، سؤال و روش باید با هم هماهنگ باشند.','🗂️ پیش‌نویس‌ها را بردار؛ شورای طرح نزدیک است.','👾 شهریه‌چی: «شورا تصویب کرد، من تسویه می‌خوام!»'],
  sources:['📚 مقاله مناسب را بشناس، فقط تعداد مهم نیست.','🔗 DOI را با کیفیت علمی اشتباه نگیر.','👾 شهریه‌چی: «قبض من هم شناسه داره!»'],
  methods:['🧭 از سؤال پژوهش شروع کن، بعد سراغ روش برو.','📐 نمونه‌گیری را با هدف مطالعه هماهنگ کن.','👾 شهریه‌چی: «از هزارتوی روش رد می‌شی؟!»'],
  analysis:['🧪 داده ناقص را بدون بررسی کنار نگذار.','📊 نمودار خوب، داستان داده را دقیق نشان می‌دهد.','👾 شهریه‌چی: «آمار بده، شهریه هم بده!»'],
  writing:['📝 اصلاحیه را بفهم؛ بعد دقیق بازنویسی کن.','📌 تغییرات را مستند و شفاف گزارش کن.','👾 شهریه‌چی: «نسخه نهایی؟ باز هم؟!»'],
  defense:['🎓 دفاع: کوتاه، مستند و دقیق پاسخ بده.','🎤 روی محدودیت‌ها صادقانه تأکید کن.','👾 شهریه‌چی: «قبل دفاع کارتخوان بزن!»']
 });
 const voiceCache=Object.create(null);
 const voiceText={stop:'دانشجو! وایسا ببینم! کارتخوانم آماده‌ست!',money:'پول من چی شد؟! نکنه دوباره مقاله خریدی؟',fixed:'شهریه ثابت رو بده! بعد برو سراغ مقاله‌هات!',variable:'شهریه متغیر رو بده! این یکی هم حساب داره!',debt:'بدهی مالی داری، دانشجو جان! فرار فایده نداره!',paper:'مقاله جمع می‌کنی؟ شهریه رو هم جمع کن!',caught:'گرفتیمت! ترم اضافه مبارک! کارتخوان آماده‌ست!',escape:'نههه! این ترم هم فرار کرد! ولی برمی‌گردم!',wrong:'جواب اشتباه بود! بدهی مالی داری، دانشجو جان!',coffee:'قهوه‌ات را بخور... شهریه‌ات را هم بده!'};
 let records=Object.fromEntries(STAGE_ORDER.map(id=>[id,{score:0,wins:0,bestStars:0}])),best=records.topics,run;
 const keys={left:false,right:false,down:false,revise:false,defend:false,focus:false,submit:false};
 try{quietMotion=Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);}catch(_){}
 function freshRun(){
   return {distance:0,heroY:GROUND-68,vy:0,onGround:true,ducking:false,invincible:0,hearts:modes[difficulty].lives,papers:0,insightTokens:0,topicsResolved:0,draftTokens:0,proposalsSubmitted:0,cleanSamples:0,revisionTokens:0,revisionsResolved:0,evidenceTokens:0,rebuttals:0,hits:0,stars:0,defenseTime:DATA.defenseControl?(difficulty==='normal'?54:difficulty==='calm'?78:Infinity):Infinity,graduation:null,score:0,correct:0,wrong:0,danger:28,questionIndex:0,responded:false,obstacles:DATA.obstacles.map(x=>({...x,hit:false})),pickups:DATA.pickups.map(x=>({...x,taken:false})),time:0,story:DATA.startStory,shield:0,particles:[],finished:false,death:null,musicClock:0,lastVoiceAt:-99,dialogueBand:0,bossDefeated:false,bonusAwarded:false,landingPulse:0,impactPulse:0,bossCueShown:false,bossCueTime:0,storyCueIndex:0,cueText:'',cueTime:0};
 }
 run=freshRun();
 function format(value){return Math.floor(value).toLocaleString('fa-IR')}
 function missionValue(){return DATA.bonusKey?Math.max(0,Number(run?.[DATA.bonusKey])||0):0;}
 function medalLabel(stars){return stars>=3?'🥇 سه ستاره · طلایی':stars===2?'🥈 دو ستاره · نقره‌ای':'🥉 یک ستاره · برنزی';}
 function calculateStars(){const accuracy=run.correct/Math.max(1,DATA.questions.length),missionDone=!DATA.bonusTarget||run.bonusAwarded;if(accuracy>=1&&run.hits===0&&missionDone)return 3;if(accuracy>=.8&&run.hits<=2)return 2;return 1;}
 // Optional, local-only profile and two play paths. Prior best-score data is never rewritten by changing these preferences.
 function readSetting(key){return root.AYINYAR_GAME_DEMO ? root.localStorage?.getItem(key) : root.AyinPrefs?.read(key,'');}
 function writeSetting(key,value){return root.AYINYAR_GAME_DEMO ? (root.localStorage?.setItem(key,value),true) : root.AyinPrefs?.write(key,value);}
 function cleanNickname(value){return String(value||'').trim().replace(/[<>\u0000-\u001f\u007f]/g,'').slice(0,24)||'دانشجوی پژوهشگر';}
 function readMeta(){
  try{const raw=readSetting(META_PREF);if(!raw)return;
   const data=JSON.parse(raw);if(!data||data.schema!==1)return;
   playMode=data.mode==='free'?'free':'story';
   const avatar=AVATARS[data.avatar]?data.avatar:'backpack';
   profile={nickname:cleanNickname(data.nickname),avatar};
  }catch(_){status('پروفایل محلی قابل خواندن نبود؛ از تنظیمات پیش‌فرض استفاده شد.');}
 }
 function saveMeta(){
  try{if(!writeSetting(META_PREF,JSON.stringify({schema:1,mode:playMode,nickname:profile.nickname,avatar:profile.avatar})))throw Error('not saved');}
  catch(_){status('ذخیره تنظیمات پروفایل ممکن نبود؛ تا بسته‌شدن بازی فعال می‌مانند.');}
 }
 function isUnlocked(id){const at=STAGE_ORDER.indexOf(id);if(at<0)return false;if(playMode==='free')return true;return at===0||STAGE_ORDER.slice(0,at).every(prev=>records[prev].wins>0);}
 function nextStoryStage(){return STAGE_ORDER.find(id=>records[id].wins===0)||STAGE_ORDER[0];}
 function completedStages(){return STAGE_ORDER.filter(id=>records[id].wins>0).length;}
 function renderMap(){
  const completed=completedStages();
  const summary=$('journey-summary');if(summary)summary.textContent=playMode==='story'?
   `🔓 مسیر داستانی · ${format(completed)} از ۷ خان به پایان رسیده · فقط خان‌های بازشده قابل انتخاب‌اند.`:
   `🎮 بازی آزاد · همه هفت خان در دسترس‌اند · ${format(completed)} خان تکمیل شده است.`;
  document.querySelectorAll('.play-mode-btn').forEach(btn=>{
   const active=btn.dataset.mode===playMode;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
  });
  document.querySelectorAll('.stage-btn').forEach((btn,i)=>{
   const id=btn.dataset.stage,record=records[id]||{wins:0,bestStars:0};
   const locked=!isUnlocked(id),active=id===stageId,stars=clamp(record.bestStars||0,0,3);
   btn.disabled=locked;btn.classList.toggle('is-locked',locked);btn.classList.toggle('is-complete',record.wins>0);
   btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
   btn.setAttribute('aria-label',`خان ${i+1}: ${LEVELS[id].shortName}؛ ${locked?'قفل':record.wins?'تکمیل‌شده':'آماده بازی'}${stars?'؛ '+stars+' ستاره':''}`);
   const state=btn.querySelector('.map-state');if(state)state.textContent=locked?'🔒 قفل':record.wins>0?('⭐'.repeat(stars||1)+' تکمیل'):'▶ آماده';
  });
  const avatar=$('student-profile-short');if(avatar)avatar.textContent=AVATARS[profile.avatar]+' '+profile.nickname+' · '+format(completed)+'/۷';
 }
 function renderProfile(){
  const done=completedStages(),wins=STAGE_ORDER.reduce((n,id)=>n+(records[id].wins||0),0),score=STAGE_ORDER.reduce((n,id)=>n+(records[id].score||0),0),gold=STAGE_ORDER.filter(id=>records[id].bestStars>=3).length;
  const details=$('profile-details');if(details)details.hidden=!profileOpen;
  const toggle=$('profile-toggle');if(toggle)toggle.setAttribute('aria-expanded',String(profileOpen));
  const numbers=$('profile-numbers');if(numbers)numbers.textContent=`${format(done)} خان تکمیل · ${format(wins)} پیروزی · ${format(gold)} مدال طلایی · ${format(score)} مجموع بهترین امتیازها`;
  const name=$('profile-nickname');if(name&&document.activeElement!==name)name.value=profile.nickname;
  document.querySelectorAll('.avatar-btn').forEach(btn=>{const selected=btn.dataset.avatar===profile.avatar;btn.classList.toggle('active',selected);btn.setAttribute('aria-pressed',String(selected));});
  const medals=$('profile-medals');if(!medals)return;
  medals.replaceChildren();
  for(const id of STAGE_ORDER){
   const r=records[id],el=document.createElementNS('http://www.w3.org/1999/xhtml','span');
   const stars=clamp(r.bestStars||0,0,3);
   el.className='medal-chip'+(r.wins?' earned':'');
   el.textContent=STAGE_ICONS[id]+' '+LEVELS[id].shortName+' '+(r.wins?('★'.repeat(stars)+'☆'.repeat(3-stars)):'○');
   el.title=r.wins?'بهترین نشان کسب‌شده':'هنوز این خان تکمیل نشده است';
   medals.appendChild(el);
  }
 }
 function switchPlayMode(next){
  if(!['intro','won','lost'].includes(mode)||!['story','free'].includes(next))return;
  playMode=next;
  saveMeta();
  if(!isUnlocked(stageId)){const suggested=nextStoryStage();setStage(isUnlocked(suggested)?suggested:'topics');}
  else{renderMap();renderProfile();}
 }
 function updateDifficultyNote(){const notes={normal:'🏃 عادی: سرعت استاندارد، ۳ فرصت؛ برخوردها و پاسخ‌های نادرست اثر دارند.',calm:'🌿 آرام: سرعت کمتر، ۵ فرصت و جریمه زمانی ملایم‌تر.',study:'📖 بدون فشار: زمان نامحدود و فرصت نامحدود؛ برای تمرین و یادگیری.'};const el=$('difficulty-note');if(el)el.textContent=notes[difficulty]||notes.normal;}
 function status(text){$('storage-status').textContent=text}
 function readBest(){
  try{
   const read=key=>root.AYINYAR_GAME_DEMO ? root.localStorage?.getItem(key) : root.AyinPrefs?.read(key,'');
   const raw=read(PREF),parsed=raw?JSON.parse(raw):null;
   if((parsed?.schema===2||parsed?.schema===3)&&parsed.stages){
    for(const name of STAGE_ORDER){
     const entry=parsed.stages[name];
     if(entry&&Number.isFinite(entry.score)&&entry.score>=0&&entry.score<1e8&&Number.isFinite(entry.wins)&&entry.wins>=0&&entry.wins<1e5){
      records[name]={score:Math.floor(entry.score),wins:Math.floor(entry.wins),bestStars:clamp(Math.floor(Number(entry.bestStars)||0),0,3)};
     }
    }
   }else{
    const legacy=read(LEGACY_PREF),original=legacy?JSON.parse(legacy):null;
    if(original&&Number.isFinite(original.score)&&original.score>=0&&original.score<1e8){
     records.sources={score:Math.floor(original.score),wins:clamp(Math.floor(Number(original.wins)||0),0,1e5),bestStars:0};
    }
   }
  }catch(e){status('رکورد پیشین در دسترس نیست؛ بازی بدون آن اجرا می‌شود.');}
  best=records[stageId];updateBest();renderMap();renderProfile();
 }
 function updateBest(){const stars=clamp(best.bestStars||0,0,3);$('best-badge').textContent='🏆 رکورد '+DATA.shortName+': '+format(best.score)+' · '+format(best.wins)+' پیروزی · نشان '+('★'.repeat(stars)+'☆'.repeat(3-stars));const completed=STAGE_ORDER.filter(id=>records[id].wins>0).length;const badge=$('campaign-badge');if(badge)badge.textContent=completed===STAGE_ORDER.length?'🏆 فاتح هفت‌خان پژوهش!':'🗺️ پیشرفت: '+format(completed)+' / ۷ خان به‌پایان رسیده';renderMap();renderProfile();}
 function saveBest(){
   if(run.score>best.score)best.score=Math.floor(run.score);
   if(run.finished){best.wins+=1;best.bestStars=Math.max(best.bestStars||0,run.stars||0);}
   updateBest();
   try{
     const data=JSON.stringify({schema:3,stages:records});
     if(root.AYINYAR_GAME_DEMO)root.localStorage?.setItem(PREF,data);
     else if(!root.AyinPrefs?.write(PREF,data))throw new Error('preferences unavailable');
     status('رکورد این خان به‌صورت محلی ثبت شد؛ داده‌ای ارسال نمی‌شود.');
   }catch(e){status('امکان ذخیره رکورد نبود؛ نتیجه این دور روی صفحه باقی می‌ماند.');}
 }
 function setStage(next){
  if(!LEVELS[next]||!isUnlocked(next)||!['intro','won','lost'].includes(mode))return;
  stopVoice();stageId=next;DATA=LEVELS[stageId];best=records[stageId]||{score:0,wins:0};
  keys.left=false;keys.right=false;keys.down=false;keys.revise=false;keys.defend=false;keys.focus=false;keys.submit=false;lastHazardHint='';run=freshRun();musicStep=0;
  document.querySelectorAll('.stage-btn').forEach(btn=>{const active=btn.dataset.stage===stageId;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
  $('stage-title').textContent=DATA.heading|| (stageId==='methods'?'🧭 خان چهارم: هزارتوی روش تحقیق':'📚 خان سوم: شکار منابع');
  $('stage-summary').textContent=DATA.story;
  $('artifact-label').textContent=DATA.hud;
  $('duck').hidden=!DATA.duckControl;$('duck-guide').hidden=!DATA.duckControl;
  $('focus').hidden=!DATA.focusControl;$('focus-guide').hidden=!DATA.focusControl;$('focus-status').hidden=!DATA.focusControl;
  $('submit-proposal').hidden=!DATA.submitControl;$('submit-guide').hidden=!DATA.submitControl;$('submit-status').hidden=!DATA.submitControl;
  $('revise').hidden=!DATA.revisionControl;$('revise-guide').hidden=!DATA.revisionControl;$('revision-status').hidden=!DATA.revisionControl;
  $('defend').hidden=!DATA.defenseControl;$('defend-guide').hidden=!DATA.defenseControl;$('defense-status').hidden=!DATA.defenseControl;
  $('progress-label').textContent=DATA.progressLabel||'🗺️ پیشروی تا دفاع';
  updateBest();updateHud();updateDifficultyNote();showOverlay('intro');
 }
 function ensureAudio(){
  try{if(!audio){const AudioContext=root.AudioContext||root.webkitAudioContext;if(!AudioContext)return null;audio=new AudioContext();}if(audio.state==='suspended')audio.resume();return audio;}catch(_){return null;}
 }
 function synthTone(freq,duration=.12,shape='triangle',volume=.025,when=null){
  const ac=ensureAudio();if(!ac)return;
  try{const startAt=when==null?ac.currentTime:when,osc=ac.createOscillator(),gain=ac.createGain();
   osc.type=shape;osc.frequency.setValueAtTime(freq,startAt);gain.gain.setValueAtTime(Math.max(.0001,volume),startAt);gain.gain.exponentialRampToValueAtTime(.0001,startAt+duration);
   osc.connect(gain).connect(ac.destination);osc.start(startAt);osc.stop(startAt+duration+.02);
  }catch(_){}
 }
 function audioNote(freq=440,duration=.08,shape='sine'){
  if(!sfx)return;
  synthTone(freq,duration,shape,.038);
 }
 function playEffect(name){
  if(!sfx)return;
  const patterns={
   click:[[500,.045,'sine',.018,0]],
   jump:[[560,.055,'triangle',.030,0],[820,.075,'triangle',.024,.055]],
   collect:[[660,.055,'sine',.022,0],[880,.095,'sine',.026,.055]],
   coffee:[[440,.065,'square',.018,0],[660,.085,'triangle',.025,.065],[880,.13,'triangle',.026,.15]],
   shield:[[440,.06,'sine',.020,0],[880,.11,'triangle',.025,.055]],
   hit:[[220,.10,'sawtooth',.027,0],[165,.14,'square',.022,.09]],
   correct:[[523,.07,'triangle',.024,0],[659,.07,'triangle',.026,.075],[784,.14,'triangle',.030,.15]],
   wrong:[[330,.09,'square',.022,0],[247,.15,'triangle',.024,.10]],
   win:[[523,.10,'triangle',.030,0],[659,.10,'triangle',.030,.10],[784,.14,'triangle',.030,.20],[1046,.26,'triangle',.030,.34]],
   caught:[[196,.12,'sawtooth',.025,0],[165,.14,'square',.024,.12],[130,.22,'triangle',.026,.26]],
   boss:[[392,.13,'triangle',.022,0],[494,.13,'triangle',.022,.14],[587,.16,'triangle',.027,.28],[784,.26,'triangle',.026,.45]],
   land:[[166,.040,'sine',.012,0]],
   milestone:[[587,.06,'sine',.011,0],[784,.11,'triangle',.016,.07]]
  };
  const ac=ensureAudio();if(!ac)return;
  for(const [freq,duration,shape,volume,offset] of (patterns[name]||patterns.click))synthTone(freq,duration,shape,volume,ac.currentTime+offset);
 }
 function playMusicStep(){
  if(!musicOn||mode!=='running')return;
  const ac=ensureAudio();if(!ac)return;
  const theme=STAGE_MUSIC[stageId]||STAGE_MUSIC.sources;
  const step=musicStep++%16,now=ac.currentTime+.012;
  // Boss approach changes the timbre without becoming excessively loud.
  const boss=run.bossCueShown;
  const pitch=boss&&step%4===3?1.125:1;
  synthTone(theme.melody[step]*pitch,.138,boss?'sawtooth':'triangle',boss?.0075:.010,now);
  if(step%4===0)synthTone(theme.bass[(step/4)%4],.39,'sine',.018,now);
  if(step===0||step===8){synthTone(90,.095,'sine',.017,now);synthTone(52,.11,'sine',.010,now+.03);}
  if(step===4||step===12)synthTone(boss?260:210,.035,'square',.003,now);
 }
 function musicTick(dt){
  if(!musicOn||mode!=='running')return;
  run.musicClock+=dt;
  const theme=STAGE_MUSIC[stageId]||STAGE_MUSIC.sources;
  // Do not queue a burst of notes after tab suspension or frame stalls.
  if(run.musicClock>theme.beat*2)run.musicClock=theme.beat;
  if(run.musicClock>=theme.beat){run.musicClock-=theme.beat;playMusicStep();}
 }
 function cue(text,seconds=2.6,playSound=false){
  run.cueText=text;run.cueTime=seconds;
  const a=$('cinematic-status');if(a)a.textContent=text;
  if(playSound)playEffect('milestone');
 }
 function showVoiceCaption(id){
  const el=$('voice-caption');if(!el)return;
  const text=voiceText[id]||'پول من چی شد؟';
  el.textContent='👾 شهریه‌چی: «'+text+'»';el.hidden=false;
  if(dialogueTimer)root.clearTimeout(dialogueTimer);
  const visibleFor=clamp(2300+text.length*82,3200,8200);
  dialogueTimer=root.setTimeout(()=>{if(el)el.hidden=true;},visibleFor);
 }
 function splitVoiceText(text,maxLength=46){
  const normalized=String(text||'').replace(/\s+/g,' ').replace(/\.{2,}/g,'…').trim();
  if(!normalized)return [];
  const sentences=normalized.match(/[^.!?؟؛،…]+[.!?؟؛،…]?/gu)||[normalized];
  const chunks=[];
  for(const raw of sentences){
   const part=raw.trim();if(!part)continue;
   if(part.length<=maxLength){chunks.push(part);continue;}
   let current='';
   for(const word of part.split(/\s+/)){
    const next=current?current+' '+word:word;
    if(next.length>maxLength&&current){chunks.push(current);current=word;}else current=next;
   }
   if(current)chunks.push(current);
  }
  return chunks.length?chunks:[normalized];
 }
 function stopVoice(){
  voiceGeneration++;
  if(voiceChunkTimer){root.clearTimeout(voiceChunkTimer);voiceChunkTimer=0;}
  try{if(root.speechSynthesis)root.speechSynthesis.cancel();}catch(_){}
  try{if(activeVoice){activeVoice.onended=null;activeVoice.onerror=null;activeVoice.pause();activeVoice.currentTime=0;}}catch(_){}
  activeVoice=null;
 }
 function speakSystemChunks(text,token){
  try{
   const synth=root.speechSynthesis,Utterance=root.SpeechSynthesisUtterance;
   if(!synth||!Utterance)return false;
   const voices=synth.getVoices?synth.getVoices():[];
   const voice=voices.find(v=>/^fa([_-]|$)/i.test(v.lang||'')||/persian|farsi|فارسی/i.test(v.name||''));
   if(!voice)return false;
   const chunks=splitVoiceText(text,46);let index=0;
   const speakNext=()=>{
    if(token!==voiceGeneration||!voiceOn||index>=chunks.length)return;
    const chunk=chunks[index++],utterance=new Utterance(chunk);let advanced=false;
    utterance.voice=voice;utterance.lang=voice.lang||'fa-IR';utterance.rate=.96;utterance.pitch=1.10;utterance.volume=1;
    let watchdog=0;
    const advance=()=>{if(advanced)return;advanced=true;if(watchdog)root.clearTimeout(watchdog);if(voiceChunkTimer)root.clearTimeout(voiceChunkTimer);voiceChunkTimer=root.setTimeout(()=>{voiceChunkTimer=0;speakNext();},150);};
    utterance.onend=advance;utterance.onerror=advance;
    watchdog=root.setTimeout(()=>{try{synth.cancel();}catch(_){}advance();},Math.max(5200,chunk.length*175));
    try{synth.speak(utterance);}catch(_){advance();}
   };
   speakNext();return true;
  }catch(_){return false;}
 }
 function playVoice(id,force=false){
  const text=voiceText[id];if(!text)return;
  if(!force&&run.time-run.lastVoiceAt<4.2)return;
  run.lastVoiceAt=run.time;showVoiceCaption(id);
  if(!voiceOn)return;
  stopVoice();const token=voiceGeneration;
  let fallbackStarted=false;
  const fallback=()=>{
   if(fallbackStarted||token!==voiceGeneration)return;fallbackStarted=true;
   if(!speakSystemChunks(text,token))status('صدای فارسی در این محیط در دسترس نیست؛ زیرنویس کامل دیالوگ فعال است.');
  };
  // Prefer the bundled offline character voice for consistent timbre and complete dialogue.
  try{
   const src=root.AyinGameAudioData?.[id]||('chrome://ayinyar-selector/content/assets/audio/'+id+'.ogg');
   const player=voiceCache[id]||(voiceCache[id]=new root.Audio(src));
   player.pause();player.currentTime=0;player.volume=1;player.playbackRate=1;activeVoice=player;
   player.onerror=fallback;
   const promise=player.play();if(promise&&promise.catch)promise.catch(fallback);
   return;
  }catch(_){fallback();}
 }
 function updateAudioButtons(){
  $('music-toggle').textContent=musicOn?'🎵 موسیقی: روشن':'🎵 موسیقی: خاموش';
  $('effects-toggle').textContent=sfx?'🔊 افکت‌ها: روشن':'🔇 افکت‌ها: خاموش';
  $('voice-toggle').textContent=voiceOn?'🗣️ صدای شهریه‌چی: روشن':'🗣️ صدای شهریه‌چی: خاموش';
  $('music-toggle').setAttribute('aria-pressed',String(musicOn));$('effects-toggle').setAttribute('aria-pressed',String(sfx));$('voice-toggle').setAttribute('aria-pressed',String(voiceOn));
 }
 function showOverlay(kind){
  const campaignCompleted=STAGE_ORDER.every(id=>records[id].wins>0);
  const wins={
   topics:['🌳 موضوع پژوهش پیدا شد!','از موضوع‌های مبهم و تکراری گذشتی؛ حالا نوبت تدوین پروپوزال است!'],
   proposal:['📜 پروپوزال برای بررسی آماده شد!','مسئله، سؤال و برنامه پژوهشت را هماهنگ کردی؛ این تأیید رسمی دانشگاه نیست و حالا باید سراغ منابع بروی!'],
   sources:['🎉 از خان شکار منابع گذشتی!','کتاب‌نامه آشفته را شکست دادی و شهریه‌چی را با قبض‌هایش تنها گذاشتی!'],
   methods:['🎉 هزارتوی روش تحقیق را فتح کردی!','از دام نمونه‌گیری و روش‌شناسی گذشتی و غول نمونه‌گیری را جا گذاشتی!'],
   analysis:['🎉 آزمایشگاه تحلیل داده را فتح کردی!',run.bossDefeated?'هیولای داده‌سازی شکست خورد؛ نتایج را شفاف گزارش کردی و از دست‌کاری داده‌ها دور ماندی!':'از آزمایشگاه فرار کردی؛ اما هیولای داده‌سازی هنوز آنجاست. دور بعدی می‌توانی با پاسخ درست شکستش بدهی!'],
   writing:['🎉 برج اصلاحات را فتح کردی!',run.bossDefeated?'داور شماره ۲ را با پاسخ‌های علمی و مستند قانع کردی!':'از برج عبور کردی؛ اما هنوز می‌توانی با پاسخ بهتر، غول داوری را شکست بدهی!'],
   defense:[campaignCompleted?'🏆 فاتح هفت‌خان پژوهش شدی!':'🎓 دفاع با موفقیت تمام شد!',campaignCompleted?'همه هفت خان را از انتخاب موضوع تا دفاع طی کردی! شهریه‌چی با کارتخوانش به جشن خیالی دعوت شد. این فقط یک موفقیت داستانی در بازی است.':'خان روز دفاع را پشت سر گذاشتی! برای تکمیل داستان، خان‌های دیگر را هم تجربه کن. این موفقیت فقط در دنیای طنز بازی است.']
  };
  const introTitles={topics:'آماده انتخاب موضوع علمی هستی؟',proposal:'برای تهیه پروپوزال آماده‌ای؟',sources:'آماده فرار از ترم اضافه‌ای؟',methods:'آماده ورود به هزارتوی روش تحقیق؟',analysis:'آماده ورود به آزمایشگاه داده‌ای؟',writing:'آماده ورود به برج اصلاحیه‌ها هستی؟',defense:'آماده روز دفاع نهایی هستی؟'};
  const [wonTitle,wonText]=wins[stageId];
  const labels={intro:['🎓',introTitles[stageId],DATA.story,'شروع ماجراجویی ←'],paused:['☕','استراحت کوتاه پژوهشی','بازی موقتاً متوقف شده است. هر وقت آماده بودی، ادامه بده.','ادامه بازی ←'],lost:['💳','دستگیر شدی! 😂','شهریه‌چی با قبض‌هایش گیرت انداخت؛ اما می‌توانی دوباره تلاش کنی!','دوباره تلاش کن ←'],won:['🎉',wonTitle,wonText,'یک دور دیگر ←']};
  const [icon,title,description,label]=labels[kind];
  $('overlay-icon').textContent=icon;$('overlay-title').textContent=title;$('overlay-description').textContent=description;$('overlay-primary').textContent=label;
  $('difficulty').hidden=kind==='paused';$('journey-controls').hidden=kind==='paused';$('overlay-secondary').hidden=kind!=='paused';$('result-details').hidden=kind==='intro'||kind==='paused';$('go-references').hidden=kind!=='won'||stageId!=='sources';
  const nextStage=STAGE_ORDER[STAGE_ORDER.indexOf(stageId)+1]||null;
  $('overlay-next-stage').hidden=kind!=='won'||!nextStage||!isUnlocked(nextStage);
  $('overlay-next-stage').textContent=nextStage?'➡️ ورود به '+LEVELS[nextStage].stage+' ←':'';
  if(kind==='won'||kind==='lost'){
   let extra=DATA.bonusTarget?` · ${DATA.bonusLabel}: ${format(missionValue())} از ${format(DATA.bonusTarget)}`:'';
   if(run.bonusAwarded)extra+=` · جایزه مأموریت: ${format(DATA.bonusScore||0)} امتیاز`;
   if(stageId==='topics')extra+=` · نشان نوآوری باقی‌مانده: ${format(run.insightTokens)}`;
   if(stageId==='proposal')extra+=` · پیش‌نویس باقی‌مانده: ${format(run.draftTokens)}`;
   if(stageId==='writing')extra+=` · نشانه اصلاح باقیمانده: ${format(run.revisionTokens)}`;
   if(stageId==='defense')extra+=` · پاسخ‌های ناگهانی: ${format(run.rebuttals)} · زمان باقیمانده: ${difficulty==='study'?'نامحدود':Math.ceil(Math.max(0,run.defenseTime)).toLocaleString('fa-IR')+' ثانیه'}`;
   $('result-details').textContent=`امتیاز: ${format(run.score)} · ${DATA.artifact}ها: ${format(run.papers)} · تصمیم درست: ${format(run.correct)} از ${format(DATA.questions.length)} · برخورد: ${format(run.hits)} · ${kind==='won'?'نشان عملکرد: '+medalLabel(run.stars):'نتیجه: تلاش دوباره'} · پیشروی: ${format(run.distance/DATA.finish*100)}٪${extra}`;
  }
  renderMap();renderProfile();
  $('overlay-content').classList.toggle('intro-layout',kind==='intro');
  $('intro-poster-wrap').hidden=kind!=='intro';
  $('overlay').hidden=false;$('overlay-primary').focus();
 }
 function start(){
  keys.left=false;keys.right=false;keys.down=false;keys.revise=false;keys.defend=false;keys.focus=false;keys.submit=false;lastHazardHint='';run=freshRun();mode='running';$('overlay').hidden=true;$('question-screen').hidden=true;cue('🎮 '+DATA.stage+' · موفق باشی!',2.6,false);
  status('خان '+DATA.shortName+' آغاز شد؛ موسیقی و صدای شهریه‌چی از تنظیمات بالا قابل کنترل‌اند.');
  ensureAudio();updateAudioButtons();playVoice('stop',true);
  updateHud();last=0;canvas.focus();
 }
 function pause(){if(mode!=='running')return;mode='paused';keys.left=false;keys.right=false;keys.down=false;keys.revise=false;keys.defend=false;keys.focus=false;keys.submit=false;run.ducking=false;stopVoice();showOverlay('paused');}
 function resume(){if(mode!=='paused')return;mode='running';$('overlay').hidden=true;ensureAudio();last=0;canvas.focus();}
 function finish(win){
   if(mode!=='running'&&mode!=='question'&&mode!=='caught'&&mode!=='graduating')return;
   mode=win?'won':'lost';run.finished=win;
   if(win){run.score+=320;const progress=missionValue();if(DATA.bonusTarget&&progress>=DATA.bonusTarget&&!run.bonusAwarded){run.bonusAwarded=true;run.score+=DATA.bonusScore||120;run.story=`🏅 مأموریت فرعی «${DATA.bonusLabel||'مرحله'}» کامل شد! جایزه گرفتی.`;}run.stars=calculateStars();playEffect('win');playVoice('escape',true);}else{run.stars=0;playEffect('caught');}
   saveBest();showOverlay(mode);updateHud();
 }
 function jump(){if(mode!=='running'||!run.onGround)return;keys.down=false;run.ducking=false;run.landingPulse=0;run.vy=-590;run.onGround=false;playEffect('jump');}
 function beginCaught(){
  if(mode!=='running')return;
  mode='caught';keys.left=false;keys.right=false;keys.down=false;keys.revise=false;keys.defend=false;keys.focus=false;keys.submit=false;run.ducking=false;run.death={elapsed:0,duration:2.35};
  stopVoice();playVoice('caught',true);playEffect('caught');
  status('شهریه‌چی دانشجو را گرفت! صحنه کارتونی دستگیری در حال اجراست.');
 }
 function makeParticles(x,y,color,count=7){if(quietMotion)return;for(let i=0;i<count;i++)run.particles.push({x,y,vx:(i-count/2)*18,vy:-Math.random()*75-25,life:.55,color});}
 function pick(p){p.taken=true;if(p.type==='coffee'){run.shield=Math.max(run.shield,4.5);run.danger=clamp(run.danger-8,0,100);run.score+=45;run.story='☕ قهوه پژوهشی! برای چند ثانیه سپر داری.';playEffect('coffee');playVoice('coffee');}else if(p.type==='insight'){run.insightTokens++;run.score+=35;run.danger=clamp(run.danger-2,0,100);run.story='🌱 نشان نوآوری گرفتی! با F موضوع تکراری پیش رو را بررسی کن.';playEffect('collect');}else if(p.type==='draft'){run.draftTokens++;run.score+=35;run.danger=clamp(run.danger-2,0,100);run.story='📑 یک پیش‌نویس آماده شد؛ با T از دروازه کمیته عبور کن.';playEffect('collect');}else if(p.type==='leaf'||p.type==='section'){run.papers++;run.score+=28;run.danger=clamp(run.danger-1.5,0,100);run.story=p.type==='leaf'?'🍃 سرنخ موضوعی پیدا کردی!':'📜 یک بخش پروپوزال مرتب شد!';playEffect('collect');}else if(p.type==='revision'){run.revisionTokens++;run.papers++;run.score+=30;run.story='🖍️ یک نشانه اصلاح گرفتی؛ نزدیک درخواست بازنگری، کلید E را یک بار بزن!';run.danger=clamp(run.danger-1.5,0,100);playEffect('collect');}else if(p.type==='evidence'){run.evidenceTokens++;run.score+=35;run.danger=clamp(run.danger-2,0,100);run.story='💡 یک برگه استدلال گرفتی! نزدیک پرسش ناگهانی، Q را یک بار بزن تا آن را خنثی کنی.';playEffect('collect');}else if(p.type==='slide'){run.papers++;run.score+=32;run.danger=clamp(run.danger-1.7,0,100);run.story='📽️ یک اسلاید دفاع آماده شد! برای جایزه دست‌کم ۶ اسلاید جمع کن.';playEffect('collect');}else if(p.type==='sample'){run.cleanSamples++;run.papers++;run.score+=38;run.danger=clamp(run.danger-2.5,0,100);run.story='🧫 نمونه سالم جمع شد! برای مأموریت فرعی ادامه بده.';playEffect('collect');if(run.cleanSamples%3===0)playVoice('paper');}else{run.papers++;run.score+=25;run.danger=clamp(run.danger-1.5,0,100);run.story=stageId==='methods'?'🧭 یک نشانه روش‌شناسی پیدا کردی!':'📄 یک منبع دیگر به پوشه پژوهش اضافه شد!';playEffect('collect');if(run.papers%3===0)playVoice('paper');}makeParticles(HERO_X,run.heroY,'#ffcf62');}
 function hit(o){
   o.hit=true;if(run.invincible>0)return;
   run.invincible=1.3;
   if(run.shield>0){run.score+=8;run.story='🛡️ قهوه کمکت کرد از این مانع بگذری!';playEffect('shield');return;}
   run.hits++;run.impactPulse=quietMotion?0:.46;
   if(difficulty!=='study')run.hearts=Math.max(0,run.hearts-1);
   run.danger=clamp(run.danger+modes[difficulty].damage,0,100);
   if(DATA.defenseControl&&difficulty!=='study')run.defenseTime=Math.max(0,run.defenseTime-(difficulty==='normal'?5:3));
   run.story=DATA.hitStory||(stageId==='methods'?'💥 وای! در دام روش تحقیق افتادی!':'💥 وای! یک اصلاحیه دیگر روی سرت خراب شد!');playEffect('hit');playVoice('debt');
   if(run.hearts<=0||run.danger>=100){beginCaught();}
 }
 function chooseQuestion(i){
   if(mode!=='question'||run.responded)return;
   const q=DATA.questions[run.questionIndex],correct=i===q.answer;run.responded=true;
   const buttons=[...$('question-options').querySelectorAll('button')];
   for(let j=0;j<buttons.length;j++){buttons[j].disabled=true;if(j===q.answer)buttons[j].classList.add('correct');else if(j===i)buttons[j].classList.add('wrong');}
   if(correct){run.correct++;run.score+=130;run.danger=clamp(run.danger-12,0,100);if(DATA.defenseControl&&difficulty!=='study')run.defenseTime+=5;   if(run.questionIndex===DATA.questions.length-1){
    run.bossDefeated=true;cue('🏆 '+DATA.finale+' شکست خورد!',3.5,true);run.score+=220;
    const victories={topics:'🌳 غول موضوع تکراری شکست خورد!',proposal:'📜 غول شورای بررسی آرام شد!',sources:'📚 کتاب‌نامه آشفته مرتب شد!',methods:'🧭 غول نمونه‌گیری شکست خورد!',analysis:'💥 هیولای داده‌سازی با گزارش شفاف شکست خورد!',writing:'🎉 داور شماره ۲ قانع شد!',defense:'🎓 دفاع علمی موفق! شهریه‌چی جا ماند!'};
    run.story=victories[stageId]||'🎉 غول پایانی شکست خورد!';makeParticles(HERO_X,GROUND-90,'#5fe0c1',18);
   }playEffect('correct');}
   else{run.wrong++;run.danger=clamp(run.danger+(difficulty==='study'?0:9),0,100);if(DATA.defenseControl&&difficulty!=='study')run.defenseTime=Math.max(0,run.defenseTime-(difficulty==='normal'?6:3));playEffect('wrong');playVoice('wrong');}
   $('question-feedback').hidden=false;
   $('question-feedback').textContent=(correct?'✅ آفرین! ':'📖 این بار مسیر دقیق‌تری وجود داشت. ')+q.tip+' '+(correct?q.quip:'');
   $('question-continue').hidden=false;$('question-continue').focus();updateHud();
 }
 function openQuestion(){
   mode='question';run.responded=false;keys.left=false;keys.right=false;
   keys.revise=false;keys.defend=false;keys.focus=false;keys.submit=false;const q=DATA.questions[run.questionIndex];
   $('question-number').textContent=`ایستگاه ${format(run.questionIndex+1)} از ${format(DATA.questions.length)}`;$('question-title').textContent=q.title;$('question-prompt').textContent=q.prompt;
   const opts=$('question-options');opts.replaceChildren();
   q.choices.forEach((text,i)=>{const b=document.createElementNS('http://www.w3.org/1999/xhtml','button');b.type='button';b.className='question-choice';b.textContent=`${format(i+1)}. ${text}`;b.addEventListener('click',()=>chooseQuestion(i));opts.appendChild(b);});
   $('question-feedback').hidden=true;$('question-continue').hidden=true;$('question-screen').hidden=false;
   opts.querySelector('button')?.focus();
 }
 function continueQuestion(){if(mode!=='question'||!run.responded)return;run.questionIndex++;$('question-screen').hidden=true;mode='running';last=0;canvas.focus();if(difficulty==='study')run.danger=clamp(run.danger,0,60);else if(run.danger>=100)run.danger=93;}
 function updateHud(){
   $('papers').textContent=format(run.papers);$('lives').textContent=difficulty==='study'?'∞':format(run.hearts);$('score').textContent=format(run.score);
   $('progress-fill').style.width=(clamp(run.distance/DATA.finish*100,0,100))+'%';
   $('chase-fill').style.width=clamp(run.danger,0,100)+'%';
   $('chase-text').textContent=run.danger>77?'خیلی نزدیک! 😱':run.danger>55?'نزدیک می‌شود!':'فاصله امن';
   $('focus-status').textContent=`🌱 نشان نوآوری: ${format(run.insightTokens)} · موضوع بررسی‌شده: ${format(run.topicsResolved)} / ${format(DATA.bonusTarget||3)}`;
   $('submit-status').textContent=`📑 پیش‌نویس: ${format(run.draftTokens)} · بخش ارائه‌شده: ${format(run.proposalsSubmitted)} / ${format(DATA.bonusTarget||3)}`;
   $('revision-status').textContent=`🖍️ نشانه: ${format(run.revisionTokens)} · اصلاحیه رفع‌شده: ${format(run.revisionsResolved)} / ${format(DATA.bonusTarget||3)}`;
   $('defense-status').textContent=`⏳ ${difficulty==='study'?'زمان نامحدود':format(Math.ceil(Math.max(0,run.defenseTime)))+' ثانیه تا پایان دفاع'} · 💡 برگه استدلال: ${format(run.evidenceTokens)} · ✅ پاسخ ناگهانی: ${format(run.rebuttals)}`;
   $('defense-status').classList.toggle('urgent',DATA.defenseControl&&run.defenseTime<16);
   const mission=$('mission-status');if(mission){const value=missionValue();mission.hidden=!DATA.bonusTarget;mission.textContent=`🎯 مأموریت فرعی: ${DATA.bonusLabel||'هدف مرحله'} · ${format(value)} / ${format(DATA.bonusTarget||0)}`;mission.classList.toggle('complete',Boolean(DATA.bonusTarget&&value>=DATA.bonusTarget));}
 }
 function activateFocus(){
   if(mode!=='running'||!DATA.focusControl||run.insightTokens<1)return false;
   const gate=run.obstacles.filter(o=>o.type==='topicgate'&&!o.hit&&o.at-run.distance>=13&&o.at-run.distance<=215).sort((a,b)=>a.at-b.at)[0];
   if(!gate)return false;
   gate.hit=true;gate.resolved=true;run.insightTokens--;run.topicsResolved++;run.score+=100;
   run.danger=clamp(run.danger-7,0,100);run.story='🌱 موضوع تکراری را با ارزیابی پیشینه و سهم واقعی پژوهش کنار زدی!';
   playEffect('correct');makeParticles(HERO_X+95,GROUND-88,'#b2f7be',12);updateHud();return true;
 }
 function activateSubmit(){
   if(mode!=='running'||!DATA.submitControl||run.draftTokens<1)return false;
   const gate=run.obstacles.filter(o=>o.type==='councilgate'&&!o.hit&&o.at-run.distance>=13&&o.at-run.distance<=215).sort((a,b)=>a.at-b.at)[0];
   if(!gate)return false;
   gate.hit=true;gate.resolved=true;run.draftTokens--;run.proposalsSubmitted++;run.score+=100;
   run.danger=clamp(run.danger-7,0,100);run.story='📜 بخش پروپوزال با توضیح مستدل ارائه شد؛ این یک امتیاز بازی است، نه تأیید واقعی!';
   playEffect('correct');makeParticles(HERO_X+95,GROUND-88,'#ffe19a',12);updateHud();return true;
 }
 function activateRevision(){
   if(mode!=='running'||!DATA.revisionControl||run.revisionTokens<1)return false;
   const candidates=run.obstacles.filter(o=>o.type==='reviewgate'&&!o.hit&&o.at-run.distance>=13&&o.at-run.distance<=215).sort((a,b)=>a.at-b.at);
   const o=candidates[0];if(!o)return false;
   o.hit=true;o.resolved=true;run.revisionTokens--;run.revisionsResolved++;run.score+=95;
   run.danger=clamp(run.danger-7,0,100);run.story='✅ درخواست بازنگری رفع شد! اصلاحیه را دقیق و مستند پاسخ دادی.';
   playEffect('correct');makeParticles(HERO_X+90,GROUND-88,'#a3efd1',11);
   updateHud();return true;
 }
 function activateDefense(){
   if(mode!=='running'||!DATA.defenseControl||run.evidenceTokens<1)return false;
   const candidate=run.obstacles.filter(o=>o.type==='questiongate'&&!o.hit&&o.at-run.distance>=13&&o.at-run.distance<=215).sort((a,b)=>a.at-b.at)[0];
   if(!candidate)return false;
   candidate.hit=true;candidate.resolved=true;run.evidenceTokens--;run.rebuttals++;run.score+=100;
   run.danger=clamp(run.danger-8,0,100);if(difficulty!=='study')run.defenseTime+=2;
   run.story='✅ پرسش ناگهانی با استدلال روشن پاسخ داده شد!';
   playEffect('correct');makeParticles(HERO_X+110,GROUND-98,'#ffeb9c',12);updateHud();return true;
 }
 function spotlightY(o,t){return GROUND-80+(Math.sin(t*2.4+(o.phase||0))+1)*14;}
 function startGraduation(){
   if(mode!=='running')return;
   mode='graduating';keys.left=false;keys.right=false;keys.down=false;keys.revise=false;keys.defend=false;keys.focus=false;keys.submit=false;
   run.graduation={elapsed:0,duration:3.2};run.story='🎓 دفاع تمام شد! مدرک خیالی آماده است!';
   stopVoice();playEffect('win');updateHud();
 }
 function vineY(o,t){return GROUND-110-(Math.sin(t*2.15+(o.phase||0))+1)*9;}
 function redTapeY(o,t){return GROUND-87+(Math.sin(t*2.1+(o.phase||0))+1)*10;}
 function stampY(o,t){return GROUND-70-(Math.sin(t*2.65+(o.phase||0))+1)*19;}
 function tick(dt){
   if(mode==='caught'){run.death.elapsed+=dt;if(run.death.elapsed>=run.death.duration)finish(false);return;}
   if(mode==='graduating'){run.graduation.elapsed+=dt;if(run.graduation.elapsed>=run.graduation.duration)finish(true);return;}
   if(mode!=='running')return;
   const m=modes[difficulty];
   run.time+=dt;
   run.cueTime=Math.max(0,run.cueTime-dt);
   run.bossCueTime=Math.max(0,run.bossCueTime-dt);
   run.impactPulse=Math.max(0,run.impactPulse-dt);
   run.landingPulse=Math.max(0,run.landingPulse-dt);
   if(DATA.defenseControl&&difficulty!=='study'){run.defenseTime=Math.max(0,run.defenseTime-dt);if(run.defenseTime<=0){run.story='⏳ زمان دفاع تمام شد! یک دور دیگر تلاش کن.';beginCaught();return;}}
   const modifier=keys.right ? 1.32 : (keys.left ? 0.70 : 1);
   const ramp=1+Math.min(.18,(run.distance/DATA.finish)*.18);
   const speed=m.speed*(DATA.pace||1)*modifier*ramp;const previous=run.distance;
   const oldDanger=run.danger;
   run.distance=Math.min(DATA.finish,run.distance+speed*dt);run.score+=dt*2.5;
   // Three optional story beats per stage; never block gameplay or questions.
   const cues=STORY_CUES[stageId]||STORY_CUES.sources,thresholds=[.22,.52,.78];
   if(run.storyCueIndex<thresholds.length&&previous<DATA.finish*thresholds[run.storyCueIndex]&&run.distance>=DATA.finish*thresholds[run.storyCueIndex]){
    cue(cues[run.storyCueIndex],3.3,true);run.storyCueIndex++;
   }
   const finalQuestion=DATA.questions[DATA.questions.length-1];
   if(!run.bossCueShown&&finalQuestion&&run.distance>=finalQuestion.at-820){
    run.bossCueShown=true;run.bossCueTime=3.2;cue('⚔️ غول پایانی: '+DATA.finale,3.2,false);playEffect('boss');
   }
   run.danger=clamp(run.danger+m.risk*dt,0,difficulty==='study'?60:100);
   if(oldDanger<38&&run.danger>=38)playVoice('money',true);
   if(oldDanger<58&&run.danger>=58)playVoice('fixed',true);
   if(oldDanger<76&&run.danger>=76)playVoice('variable',true);
   musicTick(dt);
   run.invincible=Math.max(0,run.invincible-dt);run.shield=Math.max(0,run.shield-dt);
   run.vy+=1390*dt;run.heroY+=run.vy*dt;
   if(run.heroY>=GROUND-68 && run.vy>=0){
    if(!run.onGround){run.landingPulse=quietMotion?0:.22;playEffect('land');}
    run.heroY=GROUND-68;run.vy=0;run.onGround=true;
   }
   run.ducking=Boolean(DATA.duckControl&&keys.down&&run.onGround);
   for(const p of run.pickups){if(p.taken)continue;const dx=p.at-run.distance;
     if(dx>0&&dx<65&&run.heroY<GROUND-4){pick(p);}
   }
   for(const o of run.obstacles){if(o.hit)continue;const dx=o.at-run.distance;
     if(dx<=5||dx>=65)continue;
     let collision=false;
     if(o.type==='scanner'||o.type==='spotlight'||o.type==='redtape'){const beamY=o.type==='spotlight'?spotlightY(o,run.time):o.type==='redtape'?redTapeY(o,run.time):scannerY(o,run.time);const top=run.ducking?GROUND-34:run.heroY;const bottom=run.ducking?GROUND:run.heroY+68;collision=top<beamY+9&&bottom>beamY-9;}
     else if(o.type==='stamp'||o.type==='vine'){const sy=o.type==='vine'?vineY(o,run.time):stampY(o,run.time);const top=run.ducking?GROUND-34:run.heroY;const bottom=run.ducking?GROUND:run.heroY+68;collision=top<sy+26&&bottom>sy-17;}
     else collision=run.heroY+68>GROUND-38;
     if(collision){hit(o);if(mode!=='running')return;}
   }
   for(const p of run.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}
   run.particles=run.particles.filter(p=>p.life>0);
   if(run.questionIndex<DATA.questions.length&&previous<DATA.questions[run.questionIndex].at&&run.distance>=DATA.questions[run.questionIndex].at){
     openQuestion();return;
   }
   if(run.danger>=100){beginCaught();return;}
   if(run.distance>=DATA.finish){if(DATA.defenseControl)startGraduation();else finish(true);}
   updateHud();
 }
 const rounded=(x,y,w,h,r)=>{r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()};
 function box(x,y,w,h,r,fill,stroke=null,sw=1){rounded(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}}
 function circle(x,y,r,fill,stroke=null,sw=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}}
 function poly(points,fill){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
 function world(){
  if(DATA.world==='forest'){worldForest();return;}
  if(DATA.world==='council'){worldCouncil();return;}
  if(DATA.world==='maze'){worldMaze();return;}
  if(DATA.world==='lab'){worldLab();return;}
  if(DATA.world==='tower'){worldTower();return;}
  if(DATA.world==='defense'){worldDefense();return;}
  const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#9ed5e9');sky.addColorStop(.82,'#e9f5eb');sky.addColorStop(1,'#f4eddb');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  circle(W-230,77,41,'#fff0b9');for(let i=0;i<7;i++){const x=((i*250+70-run.distance*.08)%1800+1800)%1800-80;circle(x,75+(i%3)*27,25,'#ffffffac');circle(x+25,72+(i%3)*27,19,'#ffffffac');box(x-22,77+(i%3)*27,74,18,10,'#ffffffac');}
  for(let i=0;i<10;i++){
    const x=((i*175-run.distance*.17)%1750+1750)%1750-125;
    box(x,211-(i%3)*14,94,164+(i%3)*14,7,'#b4d8d4');box(x+12,192-(i%3)*14,68,28,4,'#96b8bd');
    for(let r=0;r<3;r++)for(let c=0;c<2;c++)box(x+15+c*30,247+r*30,18,14,3,'#dff4ec');
  }
  for(let i=0;i<12;i++){const x=((i*132-run.distance*.36)%1750+1750)%1750-50;ctx.fillStyle='#8fbf91';ctx.fillRect(x+22,285,13,92);circle(x+20,289,35,'#81bb99');circle(x+40,269,32,'#91c5a1');}
  box(0,GROUND,W,H-GROUND,0,'#d6b88b');box(0,GROUND,W,12,0,'#a2d4a9');
  ctx.fillStyle='#f5d6a1';for(let i=0;i<14;i++){const x=((i*94-run.distance*.9)%1750+1750)%1750;box(x,416,48,5,2,'#ecd4b1');}
  for(let i=0;i<6;i++){const x=((i*225-run.distance*.9)%1850+1850)%1850-180;box(x,363,135,12,6,'#5b9479');}
 }
 function worldForest(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#9cdbc7');g.addColorStop(.52,'#dff1c5');g.addColorStop(1,'#f4e4aa');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  circle(W-215,85,47,'#ffedaa');
  for(let k=0;k<13;k++){
   const x=((k*168-run.distance*.17)%1980+1980)%1980-130;
   box(x+17,145+(k%3)*21,30,GROUND-140-(k%3)*21,8,'#789a80');
   circle(x+8,163+(k%2)*24,58,k%2?'#5d9f8b':'#73b399');circle(x+52,149+(k%3)*17,52,'#7dbd9d');
  }
  for(let i=0;i<9;i++){
   const x=((i*245+110-run.distance*.35)%2090+2090)%2090-150;
   box(x+35,238,23,140,7,'#8f785e');circle(x+12,234,46,'#4a9e79');circle(x+57,209,52,'#62b784');
   box(x+44,280,90,39,8,'#fff3d5','#947d5f',2);ctx.fillStyle='#496b5a';ctx.font='bold 14px Vazirmatn, Tahoma';ctx.textAlign='center';ctx.fillText(i%2?'موضوع؟':'شکاف؟',x+88,306);
  }
  for(let i=0;i<9;i++){const x=((i*225-run.distance*.58)%1900+1900)%1900;circle(x+60,344+(i%2)*12,17,'#9cc485');}
  box(0,GROUND,W,H-GROUND,0,'#b7ab78');box(0,GROUND,W,11,0,'#90ca93');
  for(let k=0;k<16;k++)box(((k*117-run.distance*.9)%1950+1950)%1950,420,55,5,2,'#ece4bc');
 }
 function worldCouncil(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#b6d3dc');g.addColorStop(.68,'#e8dfca');g.addColorStop(1,'#e6c59e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  for(let i=0;i<10;i++){
   const x=((i*230-run.distance*.22)%2290+2290)%2290-140;
   box(x,44,177,318,9,'#d8d1ca','#9aafba',3);box(x+20,62,137,175,9,'#f9f7e9','#9faeac',3);
   box(x+44,68,89,28,5,'#34647d');ctx.fillStyle='#f5e5cd';ctx.textAlign='center';ctx.font='bold 13px Vazirmatn, Tahoma';ctx.fillText(i%2?'بررسی طرح':'بیان مسئله',x+88,87);
   box(x+40,113,97,8,2,'#b2bbb5');box(x+40,136,81,8,2,'#c8c7b8');box(x+40,159,97,8,2,'#b2bbb5');
   box(x+18,282,141,14,6,'#a48570');box(x+29,297,14,64,4,'#806a62');box(x+137,297,14,64,4,'#806a62');
  }
  for(let i=0;i<8;i++){
   const x=((i*245+120-run.distance*.43)%2120+2120)%2120-120;
   box(x,225+(i%2)*22,107,66,7,'#eff2e8','#58849a',3);
   ctx.textAlign='center';ctx.font='bold 13px Vazirmatn, Tahoma';ctx.fillStyle='#416b7a';ctx.fillText(i%2?'زمان‌بندی':'پروپوزال',x+53,249+(i%2)*22);
  }
  box(0,GROUND,W,H-GROUND,0,'#b8a397');box(0,GROUND,W,12,0,'#7aa3a7');
  for(let i=0;i<15;i++)box(((i*120-run.distance*.8)%1900+1900)%1900,421,63,5,2,'#f2e0be');
 }
 function drawTopicBoss(x,t){
  if(x<-180||x>W+180)return;
  ctx.save();ctx.translate(x,GROUND-87+(quietMotion?0:Math.sin(t*3)*5));
  const won=run.bossDefeated;
  box(-57,-52,114,110,23,won?'#6eb898':'#438c77','#c4eab7',4);
  for(let i=0;i<5;i++){ctx.save();ctx.translate(-58+i*29,-62);ctx.rotate((i-2)*.15);circle(0,0,17,won?'#a4dcb4':'#3d865d');ctx.restore();}
  circle(-20,-12,8,'#fff1be');circle(20,-12,8,'#fff1be');circle(-20,-12,3,'#21484a');circle(20,-12,3,'#21484a');
  ctx.strokeStyle='#315e50';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,16,12,won?.15:Math.PI,won?Math.PI-.15:2*Math.PI);ctx.stroke();
  box(-54,54,108,20,8,'#fff1cf','#587c6f',3);ctx.textAlign='center';ctx.font='bold 13px Vazirmatn, Tahoma';ctx.fillStyle='#3e6554';ctx.fillText(won?'موضوع نو!':'غول تکرار',0,68);
  ctx.restore();
 }
 function drawProposalBoss(x,t){
  if(x<-180||x>W+180)return;
  ctx.save();ctx.translate(x,GROUND-90+(quietMotion?0:Math.sin(t*3.4)*4));const won=run.bossDefeated;
  box(-61,-68,122,119,16,won?'#5aab97':'#aa6b7b','#f9d6b7',5);
  box(-44,-55,88,95,7,'#fff4de','#856879',3);
  for(let j=0;j<5;j++)box(-28,-35+j*14,55-(j%2)*12,4,2,j===3?'#dd7f86':'#9c9faa');
  circle(-19,-64,7,'#ffe9af');circle(19,-64,7,'#ffe9af');circle(-19,-64,3,'#534352');circle(19,-64,3,'#534352');
  box(-52,48,104,20,7,'#ffdfab','#805974',2);ctx.textAlign='center';ctx.font='bold 13px Vazirmatn, Tahoma';ctx.fillStyle='#6f4b63';ctx.fillText(won?'بازبینی موفق!':'غول شورای طرح',0,62);
  if(!won){box(44,-40,30,33,5,'#dc6880','#fff0d8',3);ctx.font='bold 19px Tahoma';ctx.fillStyle='#fff';ctx.fillText('؟',58,-16);}
  ctx.restore();
 }
 function worldMaze(){
  // Stylized research-method labyrinth: static geometry with modest parallax.
  const grd=ctx.createLinearGradient(0,0,0,H);grd.addColorStop(0,'#1c365d');grd.addColorStop(.66,'#3d567a');grd.addColorStop(1,'#d9e4e3');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);
  for(let k=0;k<11;k++){
    const x=((k*170-run.distance*.24)%1900+1900)%1900-135;
    box(x,65+(k%2)*28,130,298,10,'#2b4d6c','#6381a0',3);
    box(x+14,83+(k%2)*28,100,44,8,'#e1cc94','#866d64',2);
    for(let a=0;a<3;a++){box(x+16,155+a*64,98,17,5,'#668e9e');box(x+28+(a%2)*28,173+a*55,66,6,2,'#abc7c7');}
  }
  // Direction arrows represent method choices and a navigational puzzle, not rules.
  for(let i=0;i<6;i++){
   const x=((i*340+180-run.distance*.43)%2100+2100)%2100-180;
   box(x,267,118,42,9,i%2?'#d2b878':'#8bc1b2','#244b67',3);
   ctx.fillStyle='#1f4d60';ctx.font='bold 17px Vazirmatn, Tahoma';ctx.textAlign='center';ctx.fillText(i%2?'کیفی ؟':'کمّی ؟',x+59,295);
  }
  box(0,GROUND,W,H-GROUND,0,'#405575');box(0,GROUND,W,11,0,'#a6d7c8');
  for(let i=0;i<18;i++)box(((i*103-run.distance*.9)%1900+1900)%1900,416,51,5,2,'#e2d3ad');
  for(let i=0;i<7;i++)box(((i*265-run.distance*.8)%2050+2050)%2050,363,146,12,5,'#88aaa2');
 }
 function worldLab(){
  const grd=ctx.createLinearGradient(0,0,0,H);grd.addColorStop(0,'#102c4c');grd.addColorStop(.58,'#28506b');grd.addColorStop(1,'#c9d8d0');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);
  // Laboratory windows, illuminated panels and a quiet data-grid parallax.
  ctx.strokeStyle='#8dd7d055';ctx.lineWidth=1;
  for(let x=0;x<W;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,GROUND);ctx.stroke();}
  for(let y=45;y<GROUND;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  for(let i=0;i<8;i++){
   const x=((i*245-run.distance*.19)%1900+1900)%1900-120;
   box(x,92+(i%3)*16,170,225,12,'#244763','#648a9a',3);box(x+13,107+(i%3)*16,144,76,8,'#17364f','#5e91a0',2);
   for(let j=0;j<4;j++){const bx=x+24+j*31;box(bx,205,20,68,5,j%2?'#376e7c':'#4a7183','#8bb3ae',2);box(bx+3,228,14,38,3,'#70c8b4aa');}
   box(x+22,294,125,9,4,'#8bb5a9');
  }
  // Floating plots and measurement marks.
  for(let i=0;i<7;i++){
   const x=((i*270+120-run.distance*.31)%1900+1900)%1900-100;
   box(x,45+(i%2)*20,92,55,8,'#e9f2e9d9','#7fc3b7',2);
   for(let k=0;k<4;k++)box(x+12+k*17,82-(k%2)*9,9,12+(k%3)*6,2,['#e0a65e','#55b6a6','#7199cf','#d16d79'][k]);
  }
  box(0,GROUND,W,H-GROUND,0,'#3b5d6b');box(0,GROUND,W,12,0,'#73bca9');
  for(let i=0;i<18;i++)box(((i*103-run.distance*.9)%1900+1900)%1900,416,51,5,2,'#d2e3c8');
  for(let i=0;i<8;i++){const x=((i*225-run.distance*.8)%2050+2050)%2050-180;box(x,363,146,12,5,'#6e9b91');}
 }
 function worldTower(){
  // Fictional manuscript-revision tower. Parallax noticeboards and library floors.
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#302944');g.addColorStop(.58,'#685472');g.addColorStop(1,'#e7c9a8');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  for(let k=0;k<11;k++){
   const x=((k*202-run.distance*.19)%2250+2250)%2250-180;
   box(x,56+(k%3)*14,151,303,8,k%2?'#675674':'#816982','#cba7aa',3);
   for(let fl=0;fl<4;fl++){box(x+14,77+(k%3)*14+fl*64,122,44,5,'#342e4f','#b8a2af',2);for(let t=0;t<3;t++)box(x+24+t*30,88+(k%3)*14+fl*64,21,4,2,'#e6d7cc');}
  }
  for(let i=0;i<8;i++){
   const x=((i*278+145-run.distance*.33)%2400+2400)%2400-120;
   box(x,86+(i%3)*40,107,67,7,'#fff2de','#d78f86',3);
   for(let j=0;j<4;j++)box(x+12,103+(i%3)*40+j*11,75-j*8,4,2,j===2?'#e17484':'#a28b94');
   ctx.textAlign='center';ctx.font='bold 13px Vazirmatn, Tahoma';ctx.fillStyle='#9b4258';ctx.fillText('اصلاحیه',x+53,100+(i%3)*40);
  }
  for(let i=0;i<6;i++){
   const x=((i*355+80-run.distance*.48)%2300+2300)%2300-150;
   box(x,246,112,57,7,'#e8d0b4','#714b67',4);ctx.fillStyle='#833d60';ctx.textAlign='center';ctx.font='bold 16px Vazirmatn, Tahoma';ctx.fillText(i%2?'فصل بعد!':'نسخه نهایی؟',x+56,281);
  }
  box(0,GROUND,W,H-GROUND,0,'#77576f');box(0,GROUND,W,12,0,'#efc28c');
  for(let i=0;i<16;i++)box(((i*109-run.distance*.9)%1850+1850)%1850,415,54,5,3,'#d9acc0');
  for(let i=0;i<8;i++)box(((i*240-run.distance*.86)%2050+2050)%2050,365,127,10,4,'#c197a4');
 }
 function worldDefense(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#142f4b');g.addColorStop(.6,'#314e68');g.addColorStop(1,'#8e7d69');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // Auditorium spotlights, committee desks, thesis charts. Completely fictional campus imagery.
  for(let k=0;k<6;k++){
   const x=((k*350-run.distance*.15)%2450+2450)%2450-160;
   box(x,42,260,215,16,'#1c4662','#7d9bb0',3);
   box(x+22,59,215,172,7,k%2?'#2c4e6c':'#26415d');
   box(x+48,88,158,105,7,'#f4f1df','#85bcc0',3);
   for(let i=0;i<4;i++)box(x+63+i*34,154-[28,42,24,58][i],22,[28,42,24,58][i],3,['#e6b76c','#61bcb2','#6e9bd5','#da818a'][i]);
  }
  for(let i=0;i<6;i++){
   const x=((i*340+100-run.distance*.31)%2100+2100)%2100-150;
   box(x,296,160,25,7,'#8b614d','#d8b48a',3);box(x+12,321,12,45,2,'#593d47');box(x+138,321,12,45,2,'#593d47');
   for(let d=0;d<3;d++){circle(x+36+d*46,276,14,'#ddbfaa');box(x+25+d*46,287,23,22,5,'#27415c');}
  }
  for(let i=0;i<5;i++){
   const x=((i*440-run.distance*.22)%2500+2500)%2500-200;
   ctx.save();ctx.globalAlpha=.15;poly([[x,27],[x+17,27],[x+160,GROUND-18],[x-80,GROUND-18]],'#fff9ce');ctx.restore();
  }
  box(0,GROUND,W,H-GROUND,0,'#836b62');box(0,GROUND,W,10,0,'#d2ae78');
  for(let i=0;i<16;i++)box(((i*113-run.distance*.9)%1960+1960)%1960,420,55,5,2,'#e9c99d');
  for(let i=0;i<8;i++)box(((i*225-run.distance*.8)%2050+2050)%2050,365,122,11,4,'#3f666b');
 }
 function scannerY(o,t){return GROUND-100+(Math.sin(t*2.15+(o.phase||0))+1)*16;}
 function drawSourceBoss(x,t){
  // The missing chapter-three boss: a cheerful tangle of bibliographic records.
  if(x<-170||x>W+170)return;
  const won=run.bossDefeated;
  ctx.save();ctx.translate(x,GROUND-84+(quietMotion?0:Math.sin(t*3.3)*5));
  ctx.strokeStyle='#31536b';ctx.lineWidth=6;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-38,28);ctx.lineTo(-51,52);ctx.moveTo(40,28);ctx.lineTo(51,52);ctx.stroke();
  for(let i=0;i<4;i++){
   ctx.save();ctx.translate((i-1.5)*9,-53-i*11);ctx.rotate(quietMotion?0:Math.sin(t*2.2+i)*.055);
   box(-52,-1,104,37,6,i%2?'#f6edce':'#f9fbf4',won?'#579a82':'#a36c76',3);
   for(let j=0;j<3;j++)box(-35,-0+j*9,55-j*7,3,1,won?'#6bb3a0':'#d27c8b');
   ctx.restore();
  }
  circle(-18,-21,7,won?'#a5e7c9':'#ffe2a1');circle(18,-21,7,won?'#a5e7c9':'#ffe2a1');
  circle(-18,-21,3,'#23394a');circle(18,-21,3,'#23394a');
  ctx.strokeStyle='#8b4e5b';ctx.lineWidth=3;ctx.beginPath();
  if(won)ctx.arc(0,-5,11,.1,Math.PI-.1);else{ctx.moveTo(-11,-4);ctx.lineTo(11,-4);}ctx.stroke();
  box(-53,43,106,21,7,won?'#c7f1d8':'#ffe2c7','#557788',2);
  ctx.textAlign='center';ctx.font='bold 13px Vazirmatn, Tahoma';ctx.fillStyle='#344d5d';
  ctx.fillText(won?'مرتب شد!':'غول کتاب‌نامه',0,58);
  ctx.restore();
 }
 function drawBossAura(x,t){
  if(x<-120||x>W+120||run.bossDefeated)return;
  ctx.save();ctx.globalAlpha=quietMotion?.13:(.12+.08*Math.sin(t*4));
  circle(x,GROUND-94,79,'#ffde8a');circle(x,GROUND-94,56,'#ffffff');
  ctx.restore();
 }
 function drawMethodBoss(x,t){
  if(x<-140||x>W+140)return;
  ctx.save();ctx.translate(x,GROUND-78+(quietMotion?0:Math.sin(t*3)*4));
  // A friendly absurd stack of sampling forms, no frightening or official symbols.
  box(-49,-64,98,124,14,run.bossDefeated?'#81c5a8':'#d0b783','#634a68',5);box(-36,-88,72,44,8,'#f8ecd7','#6c5360',3);
  box(-27,-43,55,23,5,'#35486a');circle(-13,-31,5,'#79f5ca');circle(13,-31,5,'#79f5ca');
  ctx.lineWidth=5;ctx.lineCap='round';ctx.strokeStyle='#634a68';ctx.beginPath();ctx.moveTo(-46,-13);ctx.lineTo(-68,5);ctx.moveTo(44,-13);ctx.lineTo(66,5);ctx.stroke();
  box(-34,12,67,12,5,'#9a5671');ctx.textAlign='center';ctx.fillStyle='#2c3a54';ctx.font='bold 16px Vazirmatn, Tahoma';ctx.fillText(run.bossDefeated?'روش روشن!':'غول نمونه',0,-59);
  ctx.restore();
 }
 function drawAnalysisBoss(x,t){
  if(x<-180||x>W+180)return;
  const defeated=run.bossDefeated;ctx.save();ctx.translate(x,GROUND-83+(quietMotion?0:Math.sin(t*2.6)*5));
  const grad=ctx.createLinearGradient(-65,-70,65,60);grad.addColorStop(0,defeated?'#9ce5ca':'#8b6bc2');grad.addColorStop(.55,defeated?'#43b59a':'#4f4d91');grad.addColorStop(1,defeated?'#267c77':'#263b69');
  // A playful monster assembled from chart bars and a torn data sheet.
  ctx.strokeStyle='#1d3c59';ctx.lineWidth=8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-39,28);ctx.lineTo(-55,53);ctx.moveTo(39,28);ctx.lineTo(56,52);ctx.moveTo(-43,-9);ctx.lineTo(-70,-28);ctx.moveTo(43,-9);ctx.lineTo(69,-29);ctx.stroke();
  box(-55,-58,110,108,25,grad,'#d3e7df',4);
  box(-34,-42,68,51,8,'#f3f6e9','#244e68',2);
  for(let i=0;i<4;i++){const h=[16,29,22,37][i];box(-27+i*17,2-h,10,h,2,['#e3a44f','#58b7a6','#719bd0','#d66e7e'][i]);}
  ctx.strokeStyle='#315a70';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-29,-8);ctx.lineTo(29,-8);ctx.stroke();
  circle(-19,-25,7,defeated?'#efffe8':'#fff0a5');circle(19,-25,7,defeated?'#efffe8':'#fff0a5');circle(-19,-25,2.8,'#1b3650');circle(19,-25,2.8,'#1b3650');
  ctx.strokeStyle='#233d5a';ctx.lineWidth=3;ctx.beginPath();if(defeated){ctx.arc(0,-4,12,.15,Math.PI-.15);}else{ctx.moveTo(-12,-2);ctx.lineTo(12,-2);ctx.moveTo(-8,4);ctx.lineTo(-4,9);ctx.lineTo(0,4);ctx.lineTo(4,9);ctx.lineTo(8,4);}ctx.stroke();
  box(-38,52,76,17,6,defeated?'#d6f4d9':'#f3d58d','#395c70',2);ctx.textAlign='center';ctx.fillStyle='#183d57';ctx.font='bold 13px Vazirmatn, Tahoma';ctx.fillText(defeated?'داده سالم!':'غول داده‌سازی',0,65);
  if(defeated&&!quietMotion){for(let i=0;i<5;i++){const a=t*3+i*1.25;circle(Math.cos(a)*62,-54+Math.sin(a)*12,4,'#ffe38a');}}
  ctx.restore();
 }
 function drawRevisionBoss(x,t){
  if(x<-160||x>W+180)return;
  const defeated=run.bossDefeated;
  ctx.save();ctx.translate(x,GROUND-88+(quietMotion?0:Math.sin(t*3)*4));
  ctx.strokeStyle='#5e3559';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-42,15);ctx.lineTo(-65,38);ctx.moveTo(43,15);ctx.lineTo(66,36);ctx.moveTo(-25,57);ctx.lineTo(-27,72);ctx.moveTo(23,57);ctx.lineTo(28,70);ctx.stroke();
  box(-58,-69,116,122,16,defeated?'#5ba68f':'#934e77','#e7c8b5',5);
  box(-41,-54,83,91,7,'#fff2df','#684764',3);
  for(let i=0;i<5;i++)box(-28,-35+i*14,56-i%2*13,5,2,i===1||i===3?'#df6479':'#a3a1ac');
  circle(-18,-61,7,defeated?'#c8ffe4':'#fff5bc');circle(18,-61,7,defeated?'#c8ffe4':'#fff5bc');
  circle(-17,-61,2.4,'#3c314e');circle(17,-61,2.4,'#3c314e');
  box(-42,41,84,18,5,defeated?'#d3f6e0':'#f5dfb4','#6d5363',2);
  ctx.textAlign='center';ctx.fillStyle='#4b344f';ctx.font='bold 14px Vazirmatn, Tahoma';ctx.fillText(defeated?'تأیید شد!':'داور شماره ۲',0,55);
  if(!quietMotion&&!defeated){ctx.save();ctx.translate(56,-76);ctx.rotate(Math.sin(t*4)*.2);box(-16,-12,35,29,5,'#ce5373','#f9d3bc',2);ctx.fillStyle='#fff';ctx.font='bold 23px Tahoma';ctx.fillText('!',1,11);ctx.restore();}
  if(defeated&&!quietMotion)for(let i=0;i<5;i++){const a=t*2.5+i*1.25;circle(Math.cos(a)*66,-66+Math.sin(a)*13,4,'#fbe59f');}
  ctx.restore();
 }
 function drawDefenseBoss(x,t){
  if(x<-200||x>W+200)return;
  ctx.save();ctx.translate(x,GROUND-89+(quietMotion?0:Math.sin(t*3.6)*4));
  const defeated=run.bossDefeated;
  circle(0,-12,70,defeated?'#8ff0cf45':'#ffbc7a33');
  box(-64,-75,128,124,24,defeated?'#448b78':'#ac3255','#ffd8ad',5);
  box(-50,-58,100,53,13,'#263451','#efc2b5',4);
  circle(-22,-36,8,defeated?'#8ce3c4':'#fff3bc');circle(22,-36,8,defeated?'#8ce3c4':'#fff3bc');
  box(-40,10,80,24,6,'#ffe4ba','#8a4051',3);
  ctx.font='bold 14px Vazirmatn, Tahoma';ctx.fillStyle='#8a2a4b';ctx.textAlign='center';ctx.fillText(defeated?'دفاع مبارک!':'شهریه‌چی نهایی',0,27);
  // Oversized point-of-sale terminal and rolls of fictional receipts.
  ctx.save();ctx.translate(72,-32);ctx.rotate(quietMotion?0:Math.sin(t*3)*.16);box(-13,-39,48,77,10,'#232f43','#e9bd91',4);box(-5,-28,32,26,4,'#9bbdd3');for(let j=0;j<3;j++)for(let k=0;k<3;k++)circle(1+k*10,11+j*9,3,['#e7cc7c','#c9d8e2','#e77d86'][j]);ctx.restore();
  ctx.restore();
 }
 function drawStudent(x,y,t){
  ctx.save();ctx.translate(x,y);
  const cadence=run.distance/17;
  const bob=run.onGround?(quietMotion?0:Math.sin(cadence)*2.5):0;
  ctx.translate(0,bob);
  if(!quietMotion&&run.landingPulse>0){const strength=run.landingPulse/.22;ctx.translate(0,4*strength);ctx.scale(1+.085*strength,1-.11*strength);}
  if(!run.onGround&&!quietMotion)ctx.rotate(clamp(run.vy/4200,-.11,.11));
  if(run.ducking){ctx.translate(0,20);ctx.scale(1,.68);}
  if(run.invincible>0&&Math.floor(t*13)%2===0)ctx.globalAlpha=.55;
  const stride=quietMotion?0:Math.sin(cadence)*10;
  // legs and shoes
  ctx.lineWidth=10;ctx.lineCap='round';ctx.strokeStyle='#243f67';ctx.beginPath();ctx.moveTo(-9,48);ctx.lineTo(-13-stride*.5,65);ctx.moveTo(10,48);ctx.lineTo(15+stride*.5,65);ctx.stroke();
  box(-27-stride*.5,62,23,9,4,'#172a45');box(3+stride*.5,62,24,9,4,'#172a45');
  // bright teal backpack and papers
  box(-33,7,21,37,7,'#f5ae48','#b97b32',2);box(-36,12,12,17,2,'#fff7e9');box(-33,8,12,5,1,'#db5e65');
  const shirtColor=profile.avatar==='graduate'?'#8c5aa2':profile.avatar==='student'?'#2b6797':'#1a88a1';
  box(-17,13,37,39,10,shirtColor,'#19516a',2);
  ctx.strokeStyle='#f8c3a2';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(15,23);ctx.lineTo(27,31+stride*.16);ctx.stroke();circle(27,31+stride*.16,5,'#f8c3a2');
  circle(0,0,19,'#f0bc98','#4d5665',2);ctx.fillStyle='#26384d';ctx.beginPath();ctx.arc(0,-5,19,Math.PI,Math.PI*2);ctx.fill();box(-18,-10,12,5,2,'#26384d');
  circle(7,0,2.2,'#17334e');ctx.strokeStyle='#985e55';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(6,8,4,0,Math.PI);ctx.stroke();
  box(-7,22,14,4,2,'#f5ddac');
  if(profile.avatar==='graduate'){box(-23,-21,46,9,2,'#283756');box(-6,-31,12,11,1,'#283756');circle(23,-18,4,'#efc75b');}
  else if(profile.avatar==='student'){box(-19,-13,38,6,3,'#216a9b');}
  if(run.shield>0){ctx.globalAlpha=.45;circle(0,25,47,'#71d8ed','#2a9ba8',3);ctx.globalAlpha=1;}
  ctx.restore();
 }
 function drawTuition(x,y,t){
  ctx.save();ctx.translate(x,y);const bounce=quietMotion?0:Math.sin(t*11)*4;ctx.translate(0,bounce);
  const grad=ctx.createLinearGradient(-35,-28,32,38);grad.addColorStop(0,'#ef5872');grad.addColorStop(.55,'#bd3154');grad.addColorStop(1,'#7a2450');
  ctx.strokeStyle='#642a4b';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-20,20);ctx.lineTo(-32,40);ctx.moveTo(19,20);ctx.lineTo(34,42);ctx.stroke();
  // absurd card reader monster; no university logo or official insignia
  box(-35,-38,70,72,20,grad,'#852449',3);box(-21,-21,42,26,6,'#272c4a','#ffbe9d',2);circle(-10,-8,4,'#9cf1d4');circle(12,-8,4,'#9cf1d4');
  box(-17,13,34,10,4,'#f5a4aa');for(let i=0;i<4;i++)box(-13+i*8,16,5,4,1,'#fff4e4');
  ctx.strokeStyle='#8c3250';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-29,-13);ctx.lineTo(-42,-4);ctx.moveTo(28,-12);ctx.lineTo(44,-3);ctx.stroke();
  // receipt banner instead of official branding
  box(24,-50,27,38,3,'#fff3d9','#be8e76',2);box(30,-40,13,3,1,'#bc8d7b');box(30,-32,13,3,1,'#bc8d7b');box(30,-24,9,3,1,'#bc8d7b');
  circle(-44,-3,6,'#f9a6a8');circle(45,-1,6,'#f9a6a8');ctx.restore();
 }
 function obstacle(o,x){
  const y=GROUND;
  if(o.type==='topicgate'){box(x-27,y-70,55,70,8,'#3c856b','#e2e9b7',3);box(x-20,y-61,41,50,5,'#f9f0d4','#7ab997',2);ctx.fillStyle='#3d6955';ctx.font='bold 12px Vazirmatn, Tahoma';ctx.textAlign='center';ctx.fillText('تکراری',x,y-37);ctx.fillText('؟',x,y-19);}
  else if(o.type==='bramble'){for(let i=0;i<5;i++){circle(x-19+i*10,y-13-(i%2)*9,12,'#49876b');}ctx.strokeStyle='#295d4d';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-32,y);ctx.lineTo(x+31,y);ctx.stroke();}
  else if(o.type==='fog'){ctx.save();ctx.globalAlpha=.65;for(let i=0;i<4;i++)circle(x-20+i*14,y-20-i%2*9,15,'#b2e1d5');ctx.restore();}
  else if(o.type==='vine'){const sy=vineY(o,run.time);box(x-5,0,9,sy-2,4,'#478462');circle(x,sy,22,'#5a9d6d','#b6e1a4',3);for(let i=0;i<3;i++)circle(x-14+i*13,sy+10,9,'#80bf83');}
  else if(o.type==='councilgate'){box(x-28,y-76,57,76,8,'#8c637c','#ffe5c4',3);box(x-21,y-66,43,54,5,'#fff4db','#a48d99',2);for(let j=0;j<3;j++)box(x-14,y-52+j*12,26,4,2,'#c8b0aa');ctx.font='bold 12px Vazirmatn, Tahoma';ctx.textAlign='center';ctx.fillStyle='#774c67';ctx.fillText('بررسی طرح',x,y-7);}
  else if(o.type==='redtape'){const sy=redTapeY(o,run.time);box(x-30,y-88,10,88,3,'#657a86');box(x+20,y-88,10,88,3,'#657a86');box(x-29,sy-6,60,11,3,'#da6d85','#f5c7aa',2);}
  else if(o.type==='deadline'){box(x-25,y-53,51,53,8,'#f6e2be','#a88b87',3);circle(x,y-35,15,'#fff8e1','#9e7788',2);ctx.strokeStyle='#9b5074';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y-35);ctx.lineTo(x+8,y-42);ctx.moveTo(x,y-35);ctx.lineTo(x,y-26);ctx.stroke();}
  else if(o.type==='blank'){box(x-23,y-41,46,41,4,'#fff9e8','#bbab92',3);ctx.fillStyle='#ab8e8e';ctx.font='bold 14px Vazirmatn, Tahoma';ctx.textAlign='center';ctx.fillText('...؟',x,y-17);}
  else if(o.type==='spotlight'){const beamY=spotlightY(o,run.time);box(x-29,GROUND-95,11,95,4,'#415c6c','#e1c48b',2);box(x+18,GROUND-95,11,95,4,'#415c6c','#e1c48b',2);box(x-30,beamY-5,61,10,5,'#ffd165','#fff0bc',2);ctx.save();ctx.globalAlpha=.25;box(x-33,beamY-13,68,26,9,'#fff1ae');ctx.restore();}
  else if(o.type==='questiongate'){box(x-28,y-70,56,70,8,'#873a57','#f4ba90',3);box(x-18,y-58,36,45,5,'#fff5de','#be7f77',2);ctx.textAlign='center';ctx.font='bold 25px Tahoma';ctx.fillStyle='#933f55';ctx.fillText('؟',x,y-19);box(x-34,y-10,68,12,4,'#b94c66');}
  else if(o.type==='mic'){box(x-22,y-52,44,52,7,'#415f75','#e9cfa5',3);circle(x,y-43,12,'#6c9ca8','#e6d7b1',3);box(x-6,y-31,12,21,3,'#334a60');box(x-22,y-5,44,7,3,'#f0b97c');}
  else if(o.type==='folder'){box(x-24,y-43,50,43,5,'#e2a960','#7e5363',3);box(x-20,y-52,29,14,3,'#f4d2a1','#99637b',2);box(x-15,y-28,30,5,2,'#fef0d0');}
  else if(o.type==='spill'){ctx.save();ctx.translate(x,y);ctx.fillStyle='#56c7b6';ctx.beginPath();ctx.ellipse(0,-5,34,9,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d8fff0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-10,-7,5,Math.PI,Math.PI*2);ctx.stroke();circle(17,-12,3,'#d5fff4');ctx.fillStyle='#eff6d8';ctx.font='bold 11px Vazirmatn, Tahoma';ctx.textAlign='center';ctx.fillText('نشت',0,-22);ctx.restore();}
  else if(o.type==='centrifuge'){box(x-23,y-55,46,55,9,'#567e8d','#d1e4d8',3);box(x-16,y-45,32,24,6,'#d9eee4','#477184',2);circle(x,y-33,9,'#55b7aa','#2f6874',2);circle(x,y-33,3,'#e7fbdf');box(x-18,y-12,36,7,3,'#d5a85f');}
  else if(o.type==='scanner'){const beamY=scannerY(o,run.time);box(x-25,y-72,12,72,4,'#345c75','#a5d3ce',2);box(x+13,y-72,12,72,4,'#345c75','#a5d3ce',2);box(x-24,beamY-4,48,8,4,'#ff5969','#ffd2bc',2);ctx.save();ctx.globalAlpha=.28;box(x-31,beamY-9,62,18,8,'#ff5169');ctx.restore();circle(x-19,y-65,4,'#f7d98e');circle(x+19,y-65,4,'#f7d98e');}
  else if(o.type==='reviewgate'){box(x-28,y-74,56,74,7,'#9a4464','#f6c5b0',4);box(x-19,y-65,38,52,4,'#fff0d9','#b5767a',2);for(let k=0;k<3;k++)box(x-12,y-52+k*12,23,4,2,'#de8592');circle(x+17,y-62,12,'#ffc3a2','#8f435e',3);ctx.fillStyle='#752e4f';ctx.font='bold 18px Tahoma';ctx.textAlign='center';ctx.fillText('!',x+17,y-56);ctx.fillStyle='#fff2e4';ctx.font='bold 12px Vazirmatn, Tahoma';ctx.fillText('بازنگری',x,y-5);}
  else if(o.type==='stamp'){const sy=stampY(o,run.time);box(x-5,48,10,sy-44,4,'#8a6380');box(x-28,sy-19,56,42,9,'#b75771','#f8d4bd',3);ctx.fillStyle='#fff7e8';ctx.textAlign='center';ctx.font='bold 15px Vazirmatn, Tahoma';ctx.fillText('اصلاح!',x,sy+6);}
  else if(o.type==='redline'){box(x-28,y-24,56,24,5,'#f3d5d8','#a45a74',3);for(let k=0;k<3;k++)box(x-18,y-19+k*7,34-k*5,3,1,'#d45b6d');}
  else if(o.type==='scroll'){box(x-23,y-58,48,58,7,'#f5dcba','#956277',3);for(let j=0;j<5;j++)box(x-14,y-46+j*9,30,3,1,j===3?'#d9607f':'#a58695');}
  else if(o.type==='stack'){for(let k=0;k<3;k++){box(x-19,y-13-k*13,47-k*5,14,2,['#2f6c8e','#d9666e','#4e8b91'][k],'#244e64',1);box(x-16,y-11-k*13,32-k*5,3,1,'#e9f2df');}}
  else if(o.type==='maze'){box(x-21,y-54,48,54,5,'#507b91','#e8d5a2',3);box(x-13,y-43,32,10,2,'#edd9a4');box(x-10,y-25,25,6,2,'#b4d9d2');}
  else if(o.type==='form'){box(x-18,y-54,38,53,3,'#e8e0c7','#625a76',3);for(let j=0;j<4;j++)box(x-12,y-46+j*10,24,3,1,'#856e94');}
  else if(o.type==='trap'){box(x-20,y-33,43,33,9,'#ab567b','#6f385e',2);circle(x,y-25,9,'#ffd9ac');}
  else if(o.type==='box'){box(x-19,y-39,42,39,4,'#bd895a','#825b3c',3);ctx.strokeStyle='#f0d0a3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-16,y-36);ctx.lineTo(x+20,y-4);ctx.moveTo(x+20,y-36);ctx.lineTo(x-16,y-4);ctx.stroke();}
  else{box(x-20,y-25,42,25,10,'#262f48','#4b5570',2);circle(x,y-20,10,'#414964');box(x-8,y-32,14,6,2,'#ee96c5');}
 }
 function pickup(p,x,t){const y=GROUND-88+(quietMotion?0:Math.sin(t*5+p.at)*8);
  if(p.type==='insight'){circle(x,y,23,'#d2ffd1','#518d67',3);ctx.fillStyle='#2a735c';ctx.textAlign='center';ctx.font='bold 25px Vazirmatn, Tahoma';ctx.fillText('✦',x,y+9);}
  else if(p.type==='leaf'){ctx.save();ctx.translate(x,y);ctx.rotate(quietMotion?0:Math.sin(t*4+p.at)*.2);ctx.fillStyle='#82d79d';ctx.beginPath();ctx.ellipse(0,0,13,22,.6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#357455';ctx.lineWidth=2;ctx.stroke();ctx.restore();}
  else if(p.type==='draft'){box(x-17,y-23,34,47,5,'#fff3d7','#b68f81',3);for(let i=0;i<4;i++)box(x-10,y-12+i*9,19,3,1,'#aa98a0');circle(x+15,y+17,7,'#e3a97c');}
  else if(p.type==='section'){box(x-20,y-23,40,46,5,'#f4f2d8','#6c9daa',3);box(x-12,y-13,24,5,2,'#428699');box(x-12,y-1,23,3,1,'#adb5b4');box(x-12,y+8,23,3,1,'#adb5b4');}
  else if(p.type==='evidence'){ctx.save();ctx.translate(x,y);circle(0,0,21,'#fff0ba','#dfa562',3);ctx.fillStyle='#87526a';ctx.font='bold 22px Tahoma';ctx.textAlign='center';ctx.fillText('!',0,8);ctx.restore();}else if(p.type==='slide'){box(x-23,y-25,46,41,6,'#f9efd8','#57a8a5',3);box(x-16,y-16,32,26,4,'#294c65');for(let i=0;i<3;i++)box(x-10+i*12,y-5-i*5,8,11+i*5,2,['#ffbf71','#69caad','#85b5df'][i]);}else if(p.type==='revision'){ctx.save();ctx.translate(x,y);ctx.rotate(quietMotion?0:Math.sin(t*4+p.at)*.14);box(-17,-20,34,41,7,'#fff3d8','#c7707a',3);for(let j=0;j<3;j++)box(-9,-11+j*9,20-j*3,3,1,'#d8a2aa');circle(12,10,8,'#79c5a9','#f2e6ce',2);ctx.restore();}else if(p.type==='sample'){ctx.save();ctx.translate(x,y);box(-12,-20,24,38,7,'#e8f8ef','#438b91',3);box(-7,-27,14,9,3,'#b9d5d3','#438b91',2);box(-8,1,16,10,4,'#4eb7a7');circle(0,7,3,'#d9fff1');ctx.restore();}else if(p.type==='coffee'){
   box(x-15,y-13,26,27,4,'#f8ca90','#9d644c',2);box(x-12,y-10,21,7,2,'#6c4144');ctx.strokeStyle='#9d644c';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x+13,y-3,10,-1.2,1.4);ctx.stroke();
  }else{ctx.save();ctx.translate(x,y);ctx.rotate(quietMotion?0:Math.sin(t*3+p.at)*.15);box(-15,-19,31,38,4,p.type==='compass'?'#e6f6eb':'#fffdfa',p.type==='compass'?'#46a4aa':'#e8a959',3);box(-9,-9,18,3,1,'#5aa2b4');box(-9,-1,18,3,1,'#a7c8d0');box(-9,7,13,3,1,'#a7c8d0');ctx.restore();}}
 function drawCaughtScene(){
  const e=run.death?.elapsed||0,progress=clamp(e/2.35,0,1),ease=progress*progress*(3-2*progress),t=run.time+e*3;
  world();
  const startHunter=hunterPosition(),hunterX=startHunter+(HERO_X-108-startHunter)*ease;
  drawTuition(hunterX,GROUND-42,t);
  const studentX=HERO_X-108*ease;
  const lift=Math.sin(Math.min(1,progress*1.4)*Math.PI)*27+Math.max(0,progress-.45)*26;
  const studentY=GROUND-68-lift;
  // The tuition monster comically hooks the student's backpack with an elastic arm.
  ctx.strokeStyle='#8c3250';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(hunterX+38,GROUND-54);ctx.quadraticCurveTo((hunterX+studentX)/2,GROUND-104,studentX-19,studentY+25);ctx.stroke();
  circle(studentX-19,studentY+25,8,'#f9a6a8','#8c3250',2);
  ctx.save();ctx.translate(studentX,studentY);ctx.rotate(quietMotion?0:Math.sin(e*13)*.12+ease*.58);drawStudent(0,0,t);ctx.restore();
  // Friendly cartoon flames and smoke: slapstick, no injury detail.
  if(!quietMotion){
   for(let i=0;i<7;i++){
    const phase=e*17+i*1.7,x=studentX-25+i*8+Math.sin(phase)*4,y=studentY+62-Math.abs(Math.sin(phase))*13;
    ctx.beginPath();ctx.moveTo(x-7,y+14);ctx.quadraticCurveTo(x-12,y-2-Math.sin(phase)*7,x,y-18-Math.abs(Math.sin(phase))*12);ctx.quadraticCurveTo(x+13,y-3,x+7,y+14);ctx.closePath();ctx.fillStyle=i%2?'#ffb52e':'#ff6847';ctx.fill();
    circle(x,y+4,3,'#fff0a5');
   }
   for(let i=0;i<5;i++){const a=e*5+i*1.25;circle(studentX+Math.cos(a)*31,studentY-25+Math.sin(a)*13,4+i%2*2,'#ffffffb8');}
   if(e>1.05)for(let i=0;i<3;i++){const a=e*8+i*2.1;ctx.save();ctx.translate(studentX+Math.cos(a)*28,studentY-28+Math.sin(a)*14);ctx.rotate(a);poly([[0,-8],[3,-2],[9,0],[3,3],[0,9],[-3,3],[-9,0],[-3,-3]],'#ffd45c');ctx.restore();}
  }
  if(e>1.25){ctx.font='bold 22px Vazirmatn, "Noto Sans Arabic", Tahoma, sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('😵‍💫  دانشجو: «فقط یه ترم دیگه... قول می‌دم!»',W/2,112);}
 }
 function drawGraduationScene(){
  worldDefense();const elapsed=run.graduation?.elapsed||0;
  // Floating celebratory papers and confetti; static arrangement when reduced motion requested.
  for(let i=0;i<72;i++){
   const a=(i*2.399),distance=65+(i*53)%660,x=W/2+Math.cos(a)*distance,
      y=40+((i*67+(quietMotion?0:elapsed*110*(.35+i%4*.17)))%(H+65));
   ctx.save();ctx.translate(x,y);ctx.rotate(quietMotion?0:a+elapsed*2.2);box(-5,-4,10,8,2,['#ffd17b','#65e1ba','#f79bb8','#fef4dc','#7dc4e7'][i%5]);ctx.restore();
  }
  // Student with academic hat; tuition monster embarrassed but friendly.
  drawTuition(W/2-180,GROUND-41,elapsed);
  drawStudent(W/2+180,GROUND-68,elapsed);
  // Graduation cap and rolled diploma, shown only after the fictional final defense.
  ctx.save();ctx.translate(W/2+180,GROUND-91);poly([[-30,-5],[0,-18],[30,-5],[0,7]],'#1b2d48');box(-3,0,6,14,2,'#1b2d48');
  ctx.strokeStyle='#ffc65b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(26,-4);ctx.lineTo(33,22);ctx.stroke();circle(33,22,4,'#ffcc67');ctx.restore();
  box(W/2+203,GROUND-74,27,11,5,'#fdf2cb','#dca355',2);box(W/2+214,GROUND-78,6,19,3,'#c64e67');
  box(W/2-320,58,640,168,24,'#102b4bea','#f4d99a',5);
  ctx.fillStyle='#ffe6a6';ctx.textAlign='center';ctx.font='bold 55px Vazirmatn, Tahoma';ctx.fillText('🎓 جشن دفاع!',W/2,128);
  ctx.fillStyle='#fef8ec';ctx.font='bold 24px Vazirmatn, Tahoma';ctx.fillText('شهریه‌چی فقط برای عکس یادگاری رسید! 😂',W/2,178);
  ctx.fillStyle='#eefdf1';ctx.font='bold 17px Vazirmatn, Tahoma';ctx.fillText('تبریک! این یک پیروزی داستانی در بازی است.',W/2,204);
 }
 function drawObstacleHint(){
  const live=run.obstacles.filter(o=>!o.hit&&o.at>run.distance).sort((a,b)=>a.at-b.at)[0];
  let label='';
  if(live){
   const gap=live.at-run.distance;
   if(gap<=700&&gap>=0){
    label='⚠️ مانع پیش رو · Space / ↑ پرش';
    if(live.type==='scanner'||live.type==='spotlight')label='🔻 نورافکن پیش رو · ↓ / S خم شو';
    else if(live.type==='topicgate')label=run.insightTokens>0?'🌱 موضوع تکراری · F را یک بار بزن':'🌱 موضوع تکراری · بپر یا نشان نوآوری بردار';
    else if(live.type==='councilgate')label=run.draftTokens>0?'📜 دروازه بررسی · T را یک بار بزن':'📜 دروازه بررسی · بپر یا پیش‌نویس بردار';
    else if(live.type==='redtape')label='🔻 روبان اداری · ↓ / S خم شو';
    else if(live.type==='vine')label='🌿 شاخه متحرک · پرش را زمان‌بندی کن';
    else if(live.type==='reviewgate')label=run.revisionTokens>0?'🖍️ اصلاحیه پیش رو · E یک بار بزن':'🖍️ اصلاحیه پیش رو · پرش کن یا نشانه جمع کن';
    else if(live.type==='questiongate')label=run.evidenceTokens>0?'💡 پرسش ناگهانی · Q یک بار بزن':'💡 پرسش ناگهانی · پرش کن یا برگه جمع کن';
    else if(live.type==='stamp')label='📑 مهر متحرک · زمان‌بندی پرش یا خم‌شدن';
    const hintCenter=$('voice-caption')?.hidden?W/2:W/2+130;
    box(hintCenter-205,18,410,38,10,'#fff6dfed','#e4bd72',2);
    ctx.fillStyle='#75512e';ctx.textAlign='center';ctx.font='bold 17px Vazirmatn, Tahoma';ctx.fillText(label,hintCenter,43);
   }
  }
  const accessible=$('hazard-status');
  if(accessible&&label!==lastHazardHint){accessible.textContent=label;lastHazardHint=label;}
 }
 function draw(){
  ctx.clearRect(0,0,W,H);if(mode==='caught'){drawCaughtScene();return;}if(mode==='graduating'){drawGraduationScene();return;}
  ctx.save();
  if(!quietMotion&&run.impactPulse>0){const a=run.impactPulse/.46;ctx.translate(Math.sin(run.time*110)*6*a,Math.cos(run.time*83)*3*a);}
  world();const t=run.time;
  // checkpoints/gate papers
  for(let i=run.questionIndex;i<DATA.questions.length;i++){const dist=DATA.questions[i].at-run.distance,x=HERO_X+dist;if(x<-30||x>W+80)continue;
    box(x-3,222,9,156,3,'#276b84');box(x-5,210,85,38,9,'#e7f7f6','#21859c',2);ctx.font='bold 15px Vazirmatn, "Noto Sans Arabic", Tahoma, sans-serif';ctx.fillStyle='#17657e';ctx.textAlign='center';ctx.fillText('ایستگاه '+(i+1),x+36,236);
  }
  const door=HERO_X+DATA.finish-run.distance;if(door>-80&&door<W+100){box(door,224,88,152,10,'#1a6686','#145171',5);box(door+10,235,68,135,5,'#f0d59f');ctx.font='bold 19px Vazirmatn, "Noto Sans Arabic", Tahoma, sans-serif';ctx.textAlign='center';ctx.fillStyle='#234a60';ctx.fillText(DATA.doorLabel|| (stageId==='methods'?'روش':'دفاع'),door+45,281);circle(door+65,326,4,'#c47c31');}
  if(run.distance>DATA.finish-2050){
   const offset=stageId==='writing'?40:stageId==='defense'?-90:-200;
   drawBossAura(HERO_X+(DATA.finish+offset)-run.distance,t);
  }
  if(stageId==='sources'&&run.distance>DATA.finish-2050)drawSourceBoss(HERO_X+(DATA.finish-200)-run.distance,t);
  if(stageId==='topics'&&run.distance>DATA.finish-2050)drawTopicBoss(HERO_X+(DATA.finish-200)-run.distance,t);
  if(stageId==='proposal'&&run.distance>DATA.finish-2050)drawProposalBoss(HERO_X+(DATA.finish-200)-run.distance,t);
  if(stageId==='methods'&&run.distance>DATA.finish-2050)drawMethodBoss(HERO_X+(DATA.finish-200)-run.distance,t);
  if(stageId==='analysis'&&run.distance>DATA.finish-2250)drawAnalysisBoss(HERO_X+(DATA.finish-200)-run.distance,t);
  if(stageId==='writing'&&run.distance>DATA.finish-2280)drawRevisionBoss(HERO_X+(DATA.finish+40)-run.distance,t);
  if(stageId==='defense'&&run.distance>DATA.finish-2200)drawDefenseBoss(HERO_X+(DATA.finish-90)-run.distance,t);
  for(const o of run.obstacles){const x=HERO_X+o.at-run.distance;if(!o.hit&&x>-60&&x<W+60)obstacle(o,x);}
  for(const p of run.pickups){const x=HERO_X+p.at-run.distance;if(!p.taken&&x>-30&&x<W+40)pickup(p,x,t);}
  const hunterX=hunterPosition();
  circle(hunterX,GROUND+8,36,'#24405b2c');drawTuition(hunterX,GROUND-42,t);
  if(!quietMotion&&run.onGround&&!run.ducking){
    // Footfall puffs driven by run distance, visually synchronized with walking speed.
    for(let k=0;k<3;k++){const phase=(run.distance/32+k*1.4)%4;
      ctx.save();ctx.globalAlpha=(1-phase/4)*.2;circle(HERO_X-25-phase*15,GROUND-8-k%2*5,3+phase*2,'#fff4dc');ctx.restore();}
  }
  circle(HERO_X,GROUND+8,29,'#24405b29');drawStudent(HERO_X,run.heroY,t);
  for(const p of run.particles){ctx.globalAlpha=clamp(p.life*2,0,1);circle(p.x,p.y,3,p.color);}ctx.globalAlpha=1;ctx.restore();
  // non-essential atmospheric sign, no educational content locked in canvas
  if($('voice-caption')?.hidden){box(22,18,390,36,9,'#174866bf');ctx.fillStyle='#f8f5e6';ctx.font='bold 15px Vazirmatn, "Noto Sans Arabic", Tahoma, sans-serif';ctx.textAlign='left';ctx.fillText(run.story.slice(0,52),37,41);}
  drawObstacleHint();
  if(run.cueTime>0){
   const fade=Math.min(1,run.cueTime*1.8),text=run.cueText;
   ctx.save();ctx.globalAlpha=fade;box(W/2-325,74,650,50,15,'#102b4de7','#ffe0a0',2);
   ctx.fillStyle='#fff8e9';ctx.font='bold 22px Vazirmatn, "Noto Sans Arabic", Tahoma, sans-serif';ctx.textAlign='center';ctx.fillText(text,W/2,106,620);ctx.restore();
  }
  if(!quietMotion&&run.impactPulse>0){ctx.save();ctx.globalAlpha=run.impactPulse*.24;ctx.fillStyle='#f45b65';ctx.fillRect(0,0,W,H);ctx.restore();}
  box(W-196,18,174,34,9,'#fef6e1cc');ctx.fillStyle='#24516c';ctx.textAlign='center';ctx.font='bold 14px Vazirmatn, "Noto Sans Arabic", Tahoma, sans-serif';ctx.fillText(DATA.worldLabel|| (stageId==='methods'?'🧭 هزارتوی روش‌شناسی':'📚 کتابخانه ماجراجویی'),W-109,40);
 }
 function frame(ts){
   if(!document.getElementById('stage'))return;
   let dt=last?(ts-last)/1000:0;last=ts;dt=clamp(dt,0,.034);
   tick(dt);draw();
   raf=root.requestAnimationFrame(frame);
 }
 function keydown(e){
  const tag=e.target?.tagName?.toLowerCase();if(tag==='input'||tag==='textarea')return;
  const key=e.key.toLowerCase();
  if(mode==='question'&&!run.responded&&['1','2','3','۱','۲','۳'].includes(key)){const index=['1','2','3','۱','۲','۳'].indexOf(key)%3;chooseQuestion(index);e.preventDefault();return;}
  if(key==='p'||key==='escape'){if(mode==='running')pause();else if(mode==='paused')resume();e.preventDefault();return;}
  if((key===' '||key==='arrowup'||key==='w')&&mode==='running'){jump();e.preventDefault();return;}
  if(key==='arrowright'||key==='d'){keys.right=true;if(mode==='running')e.preventDefault();}
  if(key==='arrowleft'||key==='a'){keys.left=true;if(mode==='running')e.preventDefault();}
  if((key==='arrowdown'||key==='s')&&mode==='running'&&DATA.duckControl){keys.down=true;e.preventDefault();}
  if((key==='e'||key==='r')&&mode==='running'&&DATA.revisionControl){if(!keys.revise){keys.revise=true;activateRevision();}e.preventDefault();}
  if(key==='f'&&mode==='running'&&DATA.focusControl){if(!keys.focus){keys.focus=true;activateFocus();}e.preventDefault();}
  if(key==='t'&&mode==='running'&&DATA.submitControl){if(!keys.submit){keys.submit=true;activateSubmit();}e.preventDefault();}
  if(key==='q'&&mode==='running'&&DATA.defenseControl){if(!keys.defend){keys.defend=true;activateDefense();}e.preventDefault();}
 }
 function keyup(e){const k=e.key.toLowerCase();if(k==='arrowright'||k==='d')keys.right=false;if(k==='arrowleft'||k==='a')keys.left=false;if(k==='arrowdown'||k==='s'){keys.down=false;run.ducking=false;}if(k==='e'||k==='r')keys.revise=false;if(k==='q')keys.defend=false;if(k==='f')keys.focus=false;if(k==='t')keys.submit=false;}
 function bindPress(id,field){const el=$(id);const hold=e=>{if(mode==='running'){if(!keys[field]){keys[field]=true;if(field==='revise')activateRevision();if(field==='defend')activateDefense();if(field==='focus')activateFocus();if(field==='submit')activateSubmit();}e.preventDefault();}};const release=()=>{keys[field]=false;};el.addEventListener('pointerdown',hold);for(const event of ['pointerup','pointercancel','pointerleave','blur'])el.addEventListener(event,release);}
 function exitToDashboard(){
  keys.left=false;keys.right=false;keys.down=false;keys.revise=false;keys.defend=false;keys.focus=false;keys.submit=false;
  if(mode==='running'||mode==='paused'||mode==='question'||mode==='caught')saveBest();
  mode='exited';root.cancelAnimationFrame(raf);stopVoice();
  try{if(audio){audio.close();audio=null;}}catch(_){}
  let returned=false;
  try{let parent=root.opener;if(!parent||parent.closed||typeof parent.AyinGameBridge?.openPage!=='function'){const argumentParent=root.arguments?.[0];if(argumentParent&&!argumentParent.closed)parent=argumentParent;}if(parent&&!parent.closed){if(typeof parent.AyinGameBridge?.openPage==='function')parent.AyinGameBridge.openPage('dashboard');parent.focus();root.close();returned=true;}}catch(_){}
  if(!returned){try{root.close();}catch(_){}status('برای بازگشت به داشبورد، پنجره بازی را ببند.');}
 }
 function bind(){
  document.querySelectorAll('.difficulty-btn').forEach(el=>el.addEventListener('click',()=>{if(mode!=='intro'&&mode!=='won'&&mode!=='lost')return;difficulty=el.dataset.difficulty;document.querySelectorAll('.difficulty-btn').forEach(x=>{x.classList.toggle('active',x===el);x.setAttribute('aria-pressed',String(x===el));});run=freshRun();updateHud();updateDifficultyNote();}));
  document.querySelectorAll('.stage-btn').forEach(el=>el.addEventListener('click',()=>setStage(el.dataset.stage)));
  document.querySelectorAll('.play-mode-btn').forEach(el=>el.addEventListener('click',()=>switchPlayMode(el.dataset.mode)));
  $('profile-toggle').addEventListener('click',()=>{profileOpen=!profileOpen;renderProfile();});
  document.querySelectorAll('.avatar-btn').forEach(el=>el.addEventListener('click',()=>{profile.avatar=el.dataset.avatar;saveMeta();renderMap();renderProfile();}));
  $('profile-nickname').addEventListener('change',e=>{profile.nickname=cleanNickname(e.target.value);e.target.value=profile.nickname;saveMeta();renderMap();renderProfile();});
  $('overlay-next-stage').addEventListener('click',()=>{const next=STAGE_ORDER[STAGE_ORDER.indexOf(stageId)+1]||null;if(next){setStage(next);start();}});
  $('overlay-primary').addEventListener('click',()=>{if(mode==='paused')resume();else start();});
  $('overlay-secondary').addEventListener('click',()=>{start()});
  $('pause').addEventListener('click',()=>{if(mode==='running')pause();else if(mode==='paused')resume();});
  $('exit-game')?.addEventListener('click',exitToDashboard);
  $('exit-game-bottom')?.addEventListener('click',exitToDashboard);
  $('music-toggle').addEventListener('click',()=>{musicOn=!musicOn;if(musicOn){ensureAudio();run.musicClock=0;}updateAudioButtons();});
  $('effects-toggle').addEventListener('click',()=>{sfx=!sfx;updateAudioButtons();if(sfx)playEffect('click');});
  $('voice-toggle').addEventListener('click',()=>{voiceOn=!voiceOn;if(!voiceOn)stopVoice();updateAudioButtons();if(voiceOn)playVoice('stop',true);});
  $('question-continue').addEventListener('click',continueQuestion);
  $('go-references').addEventListener('click',()=>{
    try{if(typeof root.opener?.AyinGameBridge?.openPage==='function'){root.opener.AyinGameBridge.openPage('references');root.opener.focus();root.close();}else status('برای تمرین، داشبورد آیین‌یار را باز کن و «بازرس منابع Zotero» را انتخاب کن.');}
    catch(_){status('برای تمرین، از منوی آیین‌یار بخش «بازرس منابع Zotero» را باز کن.');}
  });
  $('jump').addEventListener('click',jump);bindPress('slow','left');bindPress('fast','right');bindPress('duck','down');bindPress('revise','revise');bindPress('defend','defend');bindPress('focus','focus');bindPress('submit-proposal','submit');
  root.addEventListener('keydown',keydown);root.addEventListener('keyup',keyup);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  root.addEventListener('blur',()=>{if(mode==='running')pause();});
  root.addEventListener('unload',()=>{root.cancelAnimationFrame(raf);if(audio)try{audio.close()}catch(_){};});
 }
 bind();readMeta();readBest();setStage(stageId);updateAudioButtons();
 $('font-status').textContent='Vazirmatn در اولویت است؛ اگر نصب باشد استفاده می‌شود و در غیر این صورت فونت جایگزین سیستم نمایش داده می‌شود.';
 raf=root.requestAnimationFrame(frame);
 root.AyinGameDebug=Object.freeze({snapshot:()=>({mode,stageId,playMode,profile:{...profile},unlocked:STAGE_ORDER.filter(isUnlocked),finish:DATA.finish,questions:DATA.questions.length,stage:DATA.stage,records:JSON.parse(JSON.stringify(records)),difficulty,distance:run.distance,hunterX:hunterPosition(),heroY:run.heroY,onGround:run.onGround,ducking:run.ducking,cleanSamples:run.cleanSamples,insightTokens:run.insightTokens,topicsResolved:run.topicsResolved,draftTokens:run.draftTokens,proposalsSubmitted:run.proposalsSubmitted,revisionTokens:run.revisionTokens,hits:run.hits,stars:run.stars,bestStars:best.bestStars||0,pace:DATA.pace||1,missionValue:missionValue(),bonusTarget:DATA.bonusTarget||0,revisionsResolved:run.revisionsResolved,evidenceTokens:run.evidenceTokens,rebuttals:run.rebuttals,defenseTime:Number.isFinite(run.defenseTime)?run.defenseTime:null,graduationElapsed:run.graduation?.elapsed||0,bossDefeated:run.bossDefeated,bonusAwarded:run.bonusAwarded,obstacleTypes:[...new Set(run.obstacles.map(o=>o.type))],score:run.score,papers:run.papers,correct:run.correct,wrong:run.wrong,danger:run.danger,questionIndex:run.questionIndex,hearts:run.hearts,deathElapsed:run.death?.elapsed||0,speed:modes[difficulty].speed,effectiveSpeed:modes[difficulty].speed*(DATA.pace||1),musicStep,musicTheme:stageId,musicBeat:(STAGE_MUSIC[stageId]||STAGE_MUSIC.sources).beat,storyCueIndex:run.storyCueIndex,cueText:run.cueText,cueTime:run.cueTime,bossCueShown:run.bossCueShown,landingPulse:run.landingPulse,impactPulse:run.impactPulse,voiceIds:Object.keys(voiceCache),musicOn,voiceOn,sfx,audioState:audio?.state||'none',voiceChunks:splitVoiceText(voiceText.coffee),voiceText:{...voiceText}}),setProgressForTest:(distance)=>{if(!root.AYINYAR_GAME_DEMO)return;run.distance=clamp(distance,0,DATA.finish-1);},forceCaughtForTest:()=>{if(!root.AYINYAR_GAME_DEMO||mode!=='running')return;beginCaught();},setDangerForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.danger=clamp(Number(value)||0,0,100);},setInsightTokensForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.insightTokens=clamp(Math.floor(Number(value)||0),0,99);},setDraftTokensForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.draftTokens=clamp(Math.floor(Number(value)||0),0,99);},setTopicsResolvedForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.topicsResolved=clamp(Math.floor(Number(value)||0),0,99);},setProposalsSubmittedForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.proposalsSubmitted=clamp(Math.floor(Number(value)||0),0,99);},setCleanSamplesForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.cleanSamples=clamp(Math.floor(Number(value)||0),0,99);},setRevisionTokensForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.revisionTokens=clamp(Math.floor(Number(value)||0),0,99);},setRevisionsResolvedForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.revisionsResolved=clamp(Math.floor(Number(value)||0),0,99);},setEvidenceTokensForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.evidenceTokens=clamp(Math.floor(Number(value)||0),0,99);},setDefenseTimeForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.defenseTime=clamp(Number(value)||0,0,999);},setSlidesForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.papers=clamp(Math.floor(Number(value)||0),0,99);},setHeroJumpForTest:()=>{if(root.AYINYAR_GAME_DEMO)jump();},setHitsForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.hits=clamp(Math.floor(Number(value)||0),0,99);},setTimeForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.time=Math.max(0,Number(value)||0);},setBossDefeatedForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)run.bossDefeated=Boolean(value);},splitVoiceTextForTest:splitVoiceText,playVoiceForTest:(id)=>{if(root.AYINYAR_GAME_DEMO)playVoice(id,true);},stopVoiceForTest:stopVoice,exitForTest:exitToDashboard,selectStageForTest:(id)=>{if(root.AYINYAR_GAME_DEMO)setStage(id);},setPlayModeForTest:(value)=>{if(root.AYINYAR_GAME_DEMO)switchPlayMode(value);},profileOpenForTest:()=>{if(root.AYINYAR_GAME_DEMO){profileOpen=true;renderProfile();}}});
})(window);
