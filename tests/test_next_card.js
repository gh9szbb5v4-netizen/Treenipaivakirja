// Seuraavaksi-kortin testit (kehotteen tapaukset 1–21).
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function ex(id, name, sets){ return { id, name, sets, reps: '10', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }; }
function program(opts){
  opts = opts || {};
  return {
    id: 'prog-1', name: 'Testi', weeks: opts.weeks || ['1','2'], weekLabels: opts.weekLabels || {},
    days: opts.days || [
      { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [ex('A','A','3'), ex('B','B','4'), ex('C','C','3')] },
      { id: 'd2', label: 'Päivä 2', name: 'Viikko 1 · Päivä 2', week: '1', exercises: [ex('D','D','3'), ex('E','E','3')] },
      { id: 'd3', label: 'Päivä 1', name: 'Viikko 2 · Päivä 1', week: '2', exercises: [ex('F','F','3'), ex('G','G','3')] },
    ]
  };
}
function entry(date, ids){
  const exs = {};
  ids.forEach(id => { exs[id] = { name: id, sets: [{ weight: 60, reps: 10, done: true }], kind: 'plain' }; });
  return { date, exercises: exs };
}
async function load(page, prog, entries, extra){
  extra = extra || {};
  await page.goto(URL);
  await page.evaluate(({ prog, entries, extra }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(prog));
    (entries || []).forEach(e => localStorage.setItem('treenipk:entries:' + e.date, JSON.stringify(e)));
    Object.keys(extra).forEach(k => localStorage.setItem('treenipk:' + k, extra[k]));
  }, { prog, entries, extra });
  await page.goto(URL);
  await page.waitForSelector('.date-picker-row');
  await page.waitForTimeout(300);
}
async function card(page){
  return page.evaluate(() => {
    const c = document.querySelector('.next-card');
    if(!c) return null;
    const fill = c.querySelector('.next-progress-fill');
    const bar = c.querySelector('.next-progress');
    const labels = [...c.querySelectorAll('.next-progress-labels span')].map(s => s.textContent);
    const btn = c.querySelector('button');
    return {
      tag: c.tagName, labelledby: c.getAttribute('aria-labelledby'), done: c.classList.contains('next-card-done'),
      kicker: c.querySelector('.next-card-kicker').textContent,
      title: c.querySelector('.next-card-title').textContent, titleTag: c.querySelector('.next-card-title').tagName,
      sub: c.querySelector('.next-card-sub').textContent,
      role: bar.getAttribute('role'), min: bar.getAttribute('aria-valuemin'), max: bar.getAttribute('aria-valuemax'), now: bar.getAttribute('aria-valuenow'), ariaLabel: bar.getAttribute('aria-label'),
      width: fill.style.width, fillDone: fill.classList.contains('done'), labels,
      btn: btn ? btn.textContent : null, btnClass: btn ? btn.className : null, btnKey: btn ? btn.dataset.key : null, btnNav: btn ? btn.dataset.weekNav : null, btnTag: btn ? btn.tagName : null,
      hasStart: !!c.querySelector('[data-start-day]'),
      pos: c.parentElement.className + '#' + [...c.parentElement.children].indexOf(c),
      prevIsBanner: !!(c.previousElementSibling && c.previousElementSibling.classList.contains('banner')),
      nextIsPicker: !!(c.nextElementSibling && c.nextElementSibling.classList.contains('date-picker-row')),
    };
  });
}
async function dayCards(page){
  return page.evaluate(() => [...document.querySelectorAll('.day-card-head')].map(h => ({
    key: h.querySelector('[data-toggle-day-summary]').dataset.key,
    hasBtn: !!h.querySelector('button'), hasChevron: !!h.querySelector('.chevron')
  })));
}
async function openEx(page, id){
  await page.click('[data-toggle-ex][data-id="' + id + '"]');
  await page.waitForSelector('.exercise.open .ledger');
  await page.waitForTimeout(300);
}
async function done(page, id, idx){
  await page.click('[data-toggle-done][data-id="' + id + '"][data-idx="' + idx + '"]');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
async function back(page){ await page.click('.screen-head [data-close-ex]'); await page.waitForTimeout(600); }
async function fill(page, id, idx, field, val){
  await page.evaluate(({ id, idx, field, val }) => {
    const el = document.querySelector('[data-set-field][data-id="' + id + '"][data-idx="' + idx + '"][data-field="' + field + '"]');
    el.value = val; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, idx, field, val });
}
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  console.log('1 ei merkintöjä');
  await load(page, program(), []);
  let c = await card(page);
  ok(c && c.kicker === 'Seuraavaksi', 'kicker ' + (c && c.kicker));
  ok(c.title === 'Viikko 1 · Päivä 1', 'otsikko ' + c.title);
  ok(c.sub === 'A', 'alarivi ' + c.sub);
  ok(c.width === '0%' && c.now === '0' && c.max === '3', 'palkki ' + c.width + ' ' + c.now + '/' + c.max);
  ok(c.labels[0] === '0 / 3 liikettä tallennettu' && c.labels[1] === '', 'selitteet ' + JSON.stringify(c.labels));
  ok(c.btn === 'Aloita' && c.btnKey === 'd1' && c.hasStart, 'painike ' + c.btn + ' key=' + c.btnKey);
  let dc = await dayCards(page);
  ok(dc.every(d => !d.hasBtn && d.hasChevron), 'päiväkorteissa nuoli, ei painiketta ' + JSON.stringify(dc));
  ok(c.nextIsPicker, 'kortti on valitsimen yläpuolella');
  console.log('19 ensikirjausbanneri');
  const bannerText = await page.evaluate(() => { const b = document.querySelector('.banner'); return b ? b.textContent.trim() : null; });
  ok(bannerText && bannerText.indexOf('Paina ylimmän kortin Aloita.') === 0, 'bannerin teksti: ' + bannerText);
  ok(c.prevIsBanner, 'kortti bannerin alapuolella');
  console.log('20 ruudunlukija');
  ok(c.tag === 'SECTION' && c.labelledby === 'next-card-title' && c.titleTag === 'H2' && c.role === 'progressbar' && c.min === '0' && c.btnTag === 'BUTTON' && c.ariaLabel === 'Tallennetut liikkeet', 'semantiikka');

  console.log('2 A tallennettu');
  await load(page, program(), [entry('2026-09-11', ['A'])]);
  c = await card(page);
  ok(c.title === 'Viikko 1 · Päivä 1' && c.sub === 'B', 'otsikko/alarivi ' + c.title + ' / ' + c.sub);
  ok(c.width === '33.3%', 'width ' + c.width);
  ok(c.labels[0] === '1 / 3 liikettä tallennettu' && c.labels[1] === 'viimeksi 11.9.', 'selitteet ' + JSON.stringify(c.labels));
  ok(c.btn === 'Jatka', 'painike ' + c.btn);

  console.log('16 kortin Jatka avaa päivän ja B:n');
  await page.click('.next-card [data-start-day]');
  await page.waitForTimeout(600);
  const st16 = await page.evaluate(() => ({
    title: (document.getElementById('kirjaus-title') || {}).textContent || null,
    ledger: !!document.querySelector('.kirjaus-card [data-set-field][data-id="B"]'),
    focused: document.activeElement ? document.activeElement.id : null,
    hs: history.state,
  }));
  ok(st16.title === 'B' && st16.ledger && st16.hs.detail === 'B', 'kirjausruutu B:llä ' + JSON.stringify(st16));
  ok(st16.focused === 'kirjaus-title', 'fokus ruudun otsikossa (revealOpenExercise)');

  console.log('3 B auki, 2/4 done');
  await back(page); c = await card(page);
  ok(c.sub === 'B · sarja 1 / 4', 'avattu luonnos ilman ✓: alarivi ' + c.sub);
  await page.click('.next-card [data-start-day]'); await page.waitForTimeout(600);
  await fill(page, 'B', 0, 'weight', '50'); await fill(page, 'B', 0, 'reps', '10');
  await fill(page, 'B', 1, 'weight', '50'); await fill(page, 'B', 1, 'reps', '10');
  await done(page, 'B', 0); await done(page, 'B', 1);
  await back(page); c = await card(page);
  ok(c.sub === 'B · sarja 3 / 4', 'alarivi ' + c.sub);
  await page.click('.next-card [data-start-day]'); await page.waitForTimeout(600);
  ok(c.btn === 'Jatka' && c.width === '33.3%' && c.labels[0] === '1 / 3 liikettä tallennettu' && c.labels[1] === 'viimeksi 11.9.', 'palkki ja selitteet kuten 2');

  console.log('4 kaikki 4 done');
  await fill(page, 'B', 2, 'weight', '50'); await fill(page, 'B', 2, 'reps', '10');
  await fill(page, 'B', 3, 'weight', '50'); await fill(page, 'B', 3, 'reps', '10');
  await done(page, 'B', 2); await done(page, 'B', 3);
  await back(page); c = await card(page);
  ok(c.sub === 'B · sarja 4 / 4' && c.btn === 'Jatka', 'alarivi ' + c.sub + ' ' + c.btn);

  console.log('5 ei merkintöjä, A auki 1/3 done');
  await load(page, program(), []);
  await page.click('.next-card [data-start-day]');
  await page.waitForTimeout(600);
  await fill(page, 'A', 0, 'weight', '50'); await fill(page, 'A', 0, 'reps', '10');
  await done(page, 'A', 0);
  await back(page); c = await card(page);
  ok(c.sub === 'A · sarja 2 / 3' && c.labels[0] === '0 / 3 liikettä tallennettu' && c.labels[1] === '' && c.btn === 'Jatka', JSON.stringify([c.sub, c.labels, c.btn]));

  console.log('6 lämmittely ei laske');
  await load(page, program(), [entry('2026-09-11', ['A'])]);
  await page.click('.next-card [data-start-day]');
  await page.waitForTimeout(600);
  await page.click('[data-add-warmup][data-id="B"]');
  await page.waitForTimeout(300);
  const warm = await page.evaluate(() => [...document.querySelectorAll('.exercise.open [data-toggle-done]')].map(b => b.dataset.idx));
  ok(warm.length === 5 && warm[0] === '0', 'lämmittelyrivi lisätty indeksiin 0: ' + warm.join(','));
  await fill(page, 'B', 0, 'weight', '20'); await fill(page, 'B', 0, 'reps', '10');
  await done(page, 'B', 0);
  await fill(page, 'B', 1, 'weight', '50'); await fill(page, 'B', 1, 'reps', '10');
  await done(page, 'B', 1);
  await back(page); c = await card(page);
  ok(c.sub === 'B · sarja 2 / 4', 'alarivi ' + c.sub);

  console.log('7 päivä 1 tehty');
  await load(page, program(), [entry('2026-09-11', ['A','B']), entry('2026-09-12', ['C'])]);
  c = await card(page);
  ok(c.title === 'Viikko 1 · Päivä 2' && c.sub === 'D' && c.labels[0] === '0 / 2 liikettä tallennettu' && c.labels[1] === '' && c.btn === 'Aloita', JSON.stringify([c.title, c.sub, c.labels, c.btn]));

  console.log('8 viikko 1 tehty');
  await load(page, program(), [entry('2026-09-11', ['A','B','C']), entry('2026-09-13', ['D','E'])]);
  c = await card(page);
  ok(c.kicker === 'Tämä viikko' && c.title === 'Kaikki tehty', 'kicker/otsikko ' + c.kicker + ' / ' + c.title);
  ok(c.sub === '2 treenipäivää · viimeksi 13.9.', 'alarivi ' + c.sub);
  ok(c.width === '100%' && c.fillDone && c.done && c.ariaLabel === 'Tehdyt treenipäivät' && c.max === '2' && c.now === '2', 'palkki');
  ok(c.btn === 'Seuraava viikko' && c.btnClass === 'btn-secondary' && c.btnNav === 'next' && !c.hasStart, 'painike ' + c.btn + ' ' + c.btnClass);
  console.log('17 Seuraava viikko');
  await page.click('.next-card [data-week-nav="next"]');
  await page.waitForTimeout(400);
  c = await card(page);
  const weekTitle = await page.evaluate(() => document.querySelector('.week-head h2').textContent);
  ok(weekTitle === 'Viikko 2' && c.title === 'Viikko 2 · Päivä 1' && c.btn === 'Aloita', 'viikko 2: ' + weekTitle + ' ' + c.title + ' ' + c.btn);

  console.log('9 kuten 8, Kaikki-tila');
  await load(page, program(), [entry('2026-09-11', ['A','B','C']), entry('2026-09-13', ['D','E'])]);
  await page.click('[data-week-mode="all"]');
  await page.waitForTimeout(400);
  c = await card(page);
  ok(c.title === 'Viikko 2 · Päivä 1' && c.sub === 'F' && c.btn === 'Aloita' && c.kicker === 'Seuraavaksi', JSON.stringify([c.kicker, c.title, c.sub, c.btn]));
  ok(!(await page.$('.next-card [data-week-nav]')), 'ei Seuraava viikko -painiketta');

  console.log('10 koko ohjelma tehty, viikko 2');
  const allDone = [entry('2026-09-11', ['A','B','C']), entry('2026-09-13', ['D','E']), entry('2026-09-15', ['F','G'])];
  await load(page, program(), allDone);
  const wk = await page.evaluate(() => document.querySelector('.week-head h2').textContent);
  if(wk !== 'Viikko 2'){ await page.click('[data-week-nav="next"]'); await page.waitForTimeout(400); }
  c = await card(page);
  ok(c.kicker === 'Tämä viikko' && c.title === 'Kaikki tehty' && c.btn === null, JSON.stringify([c.kicker, c.title, c.btn]));

  console.log('11 koko ohjelma tehty, Kaikki-tila');
  await page.click('[data-week-mode="all"]');
  await page.waitForTimeout(400);
  c = await card(page);
  ok(c.kicker === 'Ohjelma' && c.sub === '3 treenipäivää · viimeksi 15.9.' && c.btn === null, JSON.stringify([c.kicker, c.sub, c.btn]));

  console.log('12 tyhjä viikko');
  const p12 = program(); p12.days = p12.days.filter(d => d.week !== '1');
  await load(page, p12, []);
  const wk12 = await page.evaluate(() => document.querySelector('.week-head h2').textContent);
  if(wk12 !== 'Viikko 1'){ await page.click('[data-week-nav="prev"]'); await page.waitForTimeout(400); }
  c = await card(page);
  const empty12 = await page.$('.empty-state');
  ok(c === null && !!empty12, 'ei korttia, tyhjä tila näkyy (viikko ' + (await page.evaluate(() => document.querySelector('.week-head h2').textContent)) + ')');

  console.log('13 viikon nimi');
  await load(page, program({ weekLabels: { '1': 'Kevennysviikko' } }), []);
  c = await card(page);
  ok(c.title === 'Kevennysviikko · Päivä 1', 'otsikko ' + c.title);

  console.log('14 ohjelma ilman viikkoja');
  const p14 = program({ weeks: [], days: [{ id: 'd0', label: 'Ohjelma', name: 'Ohjelma', week: null, exercises: [ex('A','A','3')] }] });
  await load(page, p14, []);
  c = await card(page);
  ok(c.title === 'Ohjelma' && c.kicker === 'Seuraavaksi', 'otsikko ' + c.title + ' kicker ' + c.kicker);
  await load(page, p14, [entry('2026-09-11', ['A'])]);
  c = await card(page);
  ok(c.kicker === 'Ohjelma' && c.title === 'Kaikki tehty' && c.btn === null, 'tila C: ' + c.kicker + ' ' + c.btn);

  console.log('15 katalogin nimi');
  const p15 = program(); p15.days[0].exercises[0] = ex('A', 'Alaviistopenkkipunnerrus tangolla, Suora tanko', '3');
  await load(page, p15, []);
  c = await card(page);
  await page.click('[data-toggle-day-summary][data-key="d1"]');
  await page.waitForTimeout(400);
  const exTitle = await page.evaluate(() => {
    const t = document.querySelector('.exercise[data-id="A"] .exercise-name-btn, .exercise-name-btn'); return t ? t.querySelector('.exercise-name') ? t.querySelector('.exercise-name').textContent.trim() : t.textContent.trim() : null;
  });
  const cat = await page.evaluate(() => !!document.querySelector('.exercise-detail'));
  ok(cat, 'liike osuu katalogiin (tarkennerivi näkyy)');
  ok(exTitle !== null && c.sub === 'Alaviistopenkkipunnerrus tangolla' && exTitle.indexOf(c.sub) === 0 && exTitle.indexOf('Suora tanko') === -1, 'kortin alarivi "' + c.sub + '" vs renderExercise "' + exTitle + '"');

  console.log('18 leveä asettelu');
  const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  wide.on('pageerror', e => errors.push(String(e)));
  await load(wide, program(), []);
  const w = await wide.evaluate(() => {
    const list = document.querySelector('.ohjelma-list');
    const kids = [...list.children];
    const idx = kids.findIndex(k => k.classList.contains('next-card'));
    return { idx, before: kids.slice(0, idx).map(k => k.className), paneHasCard: !!document.querySelector('.ohjelma-pane .next-card'), pane: !!document.querySelector('.ohjelma-pane .empty-state') };
  });
  ok(w.idx >= 0 && w.before.every(cn => cn.indexOf('banner') !== -1) && !w.paneHasCard && w.pane, 'kortti listan alussa bannerien jälkeen ' + JSON.stringify(w));
  await wide.close();

  console.log('21 regressio');
  ok(errors.length === 0, 'ei JS-virheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? ('\nEPÄONNISTUI: ' + fails) : '\nKAIKKI OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
