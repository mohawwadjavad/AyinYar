/* AyinYar 0.9.2 — no native SELECT popups in mixed XUL/XHTML windows. */
(function(){
  'use strict';
  const get=id=>document.getElementById(id);
  function syncOne(group){
    const field=get(group.getAttribute('data-choice-for'));
    if(!field)return;
    group.querySelectorAll('[data-choice-value]').forEach(button=>{
      const selected=button.getAttribute('data-choice-value')===field.value;
      button.classList.toggle('is-selected',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  function sync(id){
    document.querySelectorAll('[data-choice-for]').forEach(group=>{
      if(!id||group.getAttribute('data-choice-for')===id) syncOne(group);
    });
  }
  function select(id,value){
    const field=get(id);
    const group=Array.from(document.querySelectorAll('[data-choice-for]')).find(g=>g.getAttribute('data-choice-for')===id);
    if(!field||!group)return false;
    const matches=Array.from(group.querySelectorAll('[data-choice-value]')).some(b=>b.getAttribute('data-choice-value')===value);
    if(!matches)return false;
    const changed=field.value!==value;
    field.value=value;
    syncOne(group);
    if(changed)field.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function initialize(){
    document.querySelectorAll('[data-choice-for]').forEach(group=>{
      if(group.getAttribute('data-choices-ready')==='true')return;
      group.setAttribute('data-choices-ready','true');
      group.querySelectorAll('[data-choice-value]').forEach(button=>{
        button.addEventListener('click',()=>select(group.getAttribute('data-choice-for'),button.getAttribute('data-choice-value')));
      });
      syncOne(group);
    });
  }
  window.AyinChoices={initialize,sync,select};
})();
