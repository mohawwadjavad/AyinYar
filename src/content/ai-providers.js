/* AyinYar 0.22.0 — online AI providers with fixed, no-charge model choices.
 * No keys persisted. No arbitrary endpoints. Uses Zotero.HTTP.request from chrome context.
 */
(function(root){
 'use strict';
 const GEMINI_MODELS=Object.freeze(['gemini-3.5-flash-lite','gemini-3.1-flash-lite']);
 const PROVIDERS=Object.freeze(['ollama','gemini','openrouter']);
 const MAX_OUTPUT_CHARS=18000;
 function validProvider(p){return PROVIDERS.includes(p);}
 function validateModel(provider,model){
  if(provider==='gemini')return GEMINI_MODELS.includes(model);
  if(provider==='openrouter')return model==='openrouter/free';
  return false;
 }
 function keyOK(provider,key){
  const x=String(key||'').trim();
  return (provider==='gemini'||provider==='openrouter')&&x.length>=15&&x.length<=512&&!/[\s\r\n]/.test(x);
 }
 function safeError(err,provider){
  const code=Number(err?.status||err?.statusCode||err?.response?.status||0);
  if(code===401||code===403)return 'دسترسی رد شد. اعتبار کلید API یا مجاز بودن مدل رایگان را بررسی کن ('+code+').';
  if(code===429)return 'سهمیه رایگان یا محدودیت سرعت درخواست تکمیل شده است (429). بعداً دوباره امتحان کن.';
  if(code===402)return 'اعتبار یا سهمیه حساب کافی نیست (402). هیچ مدل پولی به‌طور خودکار انتخاب نمی‌شود.';
  if(code===400)return 'درخواست توسط ارائه‌دهنده پذیرفته نشد (400). مدل انتخابی یا متن ورودی را بررسی کن.';
  if(code>=500&&code<=599)return 'سرویس هوش مصنوعی موقتاً خطا داده است ('+code+').';
  if(err?.name==='AbortError')return 'مهلت انتظار اتصال به پایان رسید.';
  return 'اتصال آنلاین برقرار نشد. اینترنت، تنظیمات شبکه و دسترسی به سرویس '+(provider==='gemini'?'Gemini':'OpenRouter')+' را بررسی کن.';
 }
 function parseResponse(x){
  const val=x?.response??x?.responseText??x;
  if(typeof val==='string')return JSON.parse(val);
  if(val&&typeof val==='object')return val;
  throw new Error('پاسخ سرویس در قالب معتبر نبود.');
 }
 function makeRequest(provider,model,key,prompt){
  if(!validProvider(provider)||provider==='ollama')throw new Error('ارائه‌دهنده آنلاین نامعتبر است.');
  if(!validateModel(provider,model))throw new Error('این مدل در فهرست رایگان مجاز آیین‌یار نیست.');
  if(!keyOK(provider,key))throw new Error('کلید API معتبر وارد نشده است.');
  if(typeof prompt?.system!=='string'||typeof prompt?.user!=='string'||prompt.user.length>11000)throw new Error('متن ورودی نامعتبر یا بیش از حد بزرگ است.');
  if(provider==='gemini')return {
   url:'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',
   headers:{'Content-Type':'application/json','Accept':'application/json','x-goog-api-key':String(key).trim()},
   payload:{systemInstruction:{parts:[{text:prompt.system}]},contents:[{role:'user',parts:[{text:prompt.user}]}],generationConfig:{temperature:0.2,maxOutputTokens:1800,responseMimeType:'application/json',thinkingConfig:{thinkingLevel:'minimal'}}}
  };
  return {
   url:'https://openrouter.ai/api/v1/chat/completions',
   headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':'Bearer '+String(key).trim(),'X-Title':'AyinYar Research'},
   payload:{model:'openrouter/free',messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}],temperature:0.2,max_tokens:1800,stream:false}
  };
 }
 function getText(provider,data){
  const obj=parseResponse(data);
  let message='';
  if(provider==='gemini'){
   if(!Array.isArray(obj.candidates)||!obj.candidates.length)throw new Error('مدل پاسخ متنی ارائه نکرد؛ ممکن است درخواست مسدود شده باشد.');
   message=(obj.candidates[0]?.content?.parts||[]).filter(x=>typeof x?.text==='string').map(x=>x.text).join('\n');
  }else if(provider==='openrouter'){
   const c=obj?.choices?.[0]?.message?.content;
   message=typeof c==='string'?c:Array.isArray(c)?c.filter(x=>x?.type==='text'&&typeof x?.text==='string').map(x=>x.text).join('\n'):'';
  }
  if(!message.trim()||message.length>MAX_OUTPUT_CHARS)throw new Error('متن پاسخ سرویس خالی یا بیش از حد بزرگ است.');
  return {message:{content:message}};
 }
 async function generate({provider,model,key,prompt,http}){
  if(typeof http!=='function')throw new Error('رابط درخواست شبکه Zotero در دسترس نیست.');
  const req=makeRequest(provider,model,key,prompt);
  let response;
  try{response=await http('POST',req.url,{responseType:'json',timeout:90000,headers:req.headers,body:JSON.stringify(req.payload)});}
  catch(e){throw new Error(safeError(e,provider));}
  return getText(provider,response);
 }
 const API=Object.freeze({GEMINI_MODELS,PROVIDERS,validProvider,validateModel,keyOK,makeRequest,getText,generate,safeError});
 root.AyinAIProviders=API;
 if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window==='undefined'?globalThis:window);
