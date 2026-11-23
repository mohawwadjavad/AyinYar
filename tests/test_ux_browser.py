#!/usr/bin/env python3
"""Optional Playwright UX smoke test — browser mock, NOT a Zotero runtime test.
Requirements: playwright, chromium. Run scripts/preview_static.py first.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'preview.html').read_text('utf-8')
ALL_PAGES=['dashboard','references','matrix','related','word','visuals','ai-local','ai-rag','compliance','regulations','news','deadlines','researcher','university','about']
async def run():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for width,height in [(1440,900),(1100,850),(900,750),(800,720),(430,760)]:
      page=await b.new_page(viewport={'width':width,'height':height})
      page.set_default_timeout(4000)
      errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
      await page.set_content(HTML,wait_until='domcontentloaded')
      assert await page.locator('.ux-onboarding').count()==1
      assert await page.locator('.ux-page-hint').count()==14
      assert not await page.evaluate('document.body.scrollWidth > innerWidth'),f'Horizontal body overflow width={width}'
      # Every tool remains navigable without making network requests or changing Zotero data.
      for id in ALL_PAGES:
        assert await page.evaluate('(id) => window.AyinUX.navigate(id)',id),f'Cannot navigate to {id}'
        assert await page.locator('.page.active').get_attribute('id')=='page-'+id
      assert await page.evaluate('() => window.AyinUX.navigate("NOT_A_PAGE")') is False
      assert await page.locator('.page.active').get_attribute('id')=='page-about'
      await page.locator('#ux-search-trigger').click()
      await page.locator('#ux-command-input').fill('ورد')
      assert 'بازرس فایل Word' in await page.locator('.ux-command-result').first.inner_text()
      await page.locator('#ux-command-input').press('Enter')
      assert await page.locator('.page.active').get_attribute('id')=='page-word'
      await page.locator('#ux-help-toggle').click()
      assert await page.locator('#ux-help-title').inner_text()=='بازرس فایل Word'
      await page.keyboard.press('Escape')
      assert not await page.locator('#ux-help-panel').is_visible()
      assert await page.locator('#ux-back').is_visible()
      await page.locator('#ux-back').click()
      assert await page.locator('.page.active').get_attribute('id')=='page-about'
      if width<=900:
        await page.locator('#ux-mobile-menu').click()
        assert await page.locator('#ux-sidebar-scrim').is_visible()
        await page.locator('#ux-sidebar-scrim').click(position={'x':20,'y':300})
        assert not await page.locator('#ux-sidebar-scrim').is_visible()
      assert not errors,(width,errors[:4])
      print(f'UX browser mock PASS: {width}×{height}; 15 routes, search, help, back, menu, no page errors')
      await page.close()
    await b.close()
asyncio.run(run())
