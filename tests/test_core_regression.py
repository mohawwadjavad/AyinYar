#!/usr/bin/env python3
"""Mock-only tests guarding unmodified academic modules during UX redesign."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
code=r'''
const assert=require('node:assert/strict');
const root=process.argv[1];
const calendar=require(root+'/src/content/deadline-calendar.js');
const news=require(root+'/src/content/news-center.js');
const backup=require(root+'/src/content/backup-manager.js');
const providers=require(root+'/src/content/ai-providers.js');
const ai=require(root+'/src/content/ai-local.js');
assert.ok(calendar.parseJalali('1403/12/30'),'leap Esfand valid');
assert.equal(calendar.parseJalali('1404/12/30'),null,'non-leap Esfand invalid');
assert.equal(calendar.parseJalali('1405/12/31'),null,'31 Esfand impossible');
const entry=news.make({title:'مهلت آزمایشی دانشگاه',source_id:'iau-najafabad-site',category:'defense',published_jalali:'1405/08/01',deadline_jalali:'1405/08/07',excerpt:'توضیحات آزمایشی',post_url:''});
const items=calendar.assess([entry],{todayDay:calendar.jalaliDayNumber('1405/08/01')});
assert.equal(items.length,1);assert.equal(items[0].days,6);
const ics=calendar.makeICS([entry],{alarmDays:3});
assert.ok(ics.includes('BEGIN:VCALENDAR')&&ics.includes('BEGIN:VALARM')&&ics.includes('END:VCALENDAR'));
const b=backup.serialize([entry]);const norm=backup.normalize(b);assert.equal(norm.notices.length,1);
const plan=backup.plan([],norm.notices,'merge');assert.equal(plan.stats.added,1);assert.equal(plan.records.length,1);
const again=backup.plan(plan.records,norm.notices,'merge');assert.equal(again.stats.added,0);
const req=providers.makeRequest('gemini',providers.GEMINI_MODELS[0],'x'.repeat(25),{system:'Reply Persian',user:'Write a Persian paragraph'});
assert.ok(req.url.startsWith('https://generativelanguage.googleapis.com/'));assert.ok(!req.url.includes('xxxxxxxx'));
assert.equal(providers.validateModel('openrouter','paid/auto'),false);
assert.equal(ai.verifyQuote('عبارت دقیق','یک متن شامل عبارت دقیق است'),true);
assert.equal(ai.verifyQuote('عبارتی که نبود','متن پژوهش'),false);
console.log('Core smoke: Jalali leap/ICS, bulletin backup merge, AI provider validation and evidence matching PASS');
'''
subprocess.run(['node','-e',code,str(root)],check=True)
