// Kirjausruudun testit (kehotteen tapaukset 1–23).
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function ex(id, name, sets, extra){ return Object.assign({ id, name, sets, reps: '10', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
function program(){
  return { id: 'prog-1', name: 'Testi', weeks: ['1','2'], weekLabels: {}, days: [
    { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [ex('A','A','3'), ex('B','B','4'), ex('C','C','3')] },
    { id: 'd2', label: 'Päivä 2', name: 'Viikko 1 · Päivä 2', week: '1', exercises: [ex('D','D','3'), ex('E','E','3')] },
    { id: 'd3', label: 'Päivä 1', name: 'Viikko 2 · Päivä 1', week: '2', exercises: [ex('F','F','3'), ex('G','G','3')] } ] };
}
function entry(date, ids, sets){
  const exs = {}; ids.forEach(id => { exs[id] = { name: id, sets: sets || [{ weight: 60, reps: 10, done: true }], kind: 'plain' }; });
  return { date, exercises: exs };
}
async function seed(page, prog, entries, extra, url){
  // Tyhjennys sivulla, jossa sovellus ei ole käynnissä (lepoajastin
  // kirjoittaisi tilansa muuten uudelleen).
  await page.goto((url || URL).replace(/index[^/]*\.html$/, 'manifest.json'));
  await page.evaluate(({ prog, entries, extra }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(prog));
    (entries || []).forEach(e => localStorage.setItem('treenipk:entries:' + e.date, JSON.stringify(e)));
    Object.keys(extra || {}).forEach(k => localStorage.setItem('treenipk:' + k, extra[k]));
  }, { prog, entries, extra });
}
async function load(page, prog, entries, extra){
  await seed(page, prog, entries, extra);
  await page.goto(URL);
  await page.waitForSelector('.date-picker-row');
  await page.waitForTimeout(300);
}
const hs = page => page.evaluate(() => { const s = history.state; return s ? { view: s.view, detail: s.detail, depth: s.depth } : null; });
const screen = page => page.evaluate(() => ({
  head: !!document.querySelector('main .screen-head'),
  title: (document.getElementById('kirjaus-title') || {}).textContent || null,
  kicker: (document.querySelector('.screen-kicker') || {}).textContent || null,
  cards: document.querySelectorAll('.exercise.open.kirjaus-card').length,
  ledger: !!document.querySelector('.kirjaus-card .ledger'),
  next: !!document.querySelector('.next-card'), week: !!document.querySelector('.week-head'), days: document.querySelectorAll('.day-card-head').length,
  scrollY: window.scrollY, active: document.activeElement ? document.activeElement.id || document.activeElement.tagName : null,
  pane: !!document.querySelector('.ohjelma-pane .exercise.open'),
  pencil: !!document.querySelector('[data-edit-program]'), ohje: !!document.querySelector('[data-tab="ohje"]'),
  banners: [...document.querySelectorAll('header .banner')].map(b => b.textContent.trim().slice(0, 30)),
  tab: (document.querySelector('.tab.active') || {}).textContent || null,
  nextSub: (document.querySelector('.next-card-sub') || {}).textContent || null, nextBtn: (document.querySelector('.next-card button') || {}).textContent || null,
  nextTitle: (document.querySelector('.next-card-title') || {}).textContent || null,
}));
async function fill(page, id, idx, field, val){
  await page.evaluate(({ id, idx, field, val }) => {
    const el = document.querySelector('[data-set-field][data-id="' + id + '"][data-idx="' + idx + '"][data-field="' + field + '"]');
    el.value = val; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, idx, field, val });
}
async function done(page, id, idx, pickRpe){
  await page.click('[data-toggle-done][data-id="' + id + '"][data-idx="' + idx + '"]');
  await page.waitForTimeout(300);
  if(pickRpe) await page.click('[data-warmup-rpe][data-rpe="8"]'); else await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
async function finishAll(page, id, n){
  for(let i = 0; i < n; i++){
    const already = await page.evaluate(({ id, i }) => document.querySelector('[data-toggle-done][data-id="' + id + '"][data-idx="' + i + '"]').getAttribute('aria-pressed') === 'true', { id, i });
    if(already) continue;
    await fill(page, id, i, 'weight', '50'); await fill(page, id, i, 'reps', '10'); await done(page, id, i);
  }
  await page.click('[data-save-ex][data-id="' + id + '"]');
  await page.waitForTimeout(700);
}
async function jatka(page){ await page.click('.next-card [data-start-day]'); await page.waitForTimeout(600); }
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('1 Aloita avaa ruudun');
  await load(page, program(), []);
  let h0 = await hs(page);
  ok(h0 && h0.view === 'ohjelma' && !h0.detail && h0.depth === 0, 'juuri ' + JSON.stringify(h0));
  await jatka(page);
  let s = await screen(page); let h = await hs(page);
  ok(h.view === 'ohjelma' && h.detail === 'A' && h.depth === 2, 'pino ' + JSON.stringify(h));
  ok(s.head && s.title === 'A' && s.kicker === 'Viikko 1 · Päivä 1 · liike 1 / 3' && s.cards === 1 && s.ledger, 'ruutu ' + JSON.stringify([s.title, s.kicker, s.cards, s.ledger]));
  ok(!s.next && !s.week && s.days === 0, 'ei korttia, viikon otsikkoa eikä päiväkortteja');
  ok(s.scrollY === 0 && s.active === 'kirjaus-title', 'scroll 0, fokus otsikossa: ' + s.scrollY + ' ' + s.active);
  console.log('23 ruudunlukija');
  const a11y = await page.evaluate(() => ({ back: document.querySelector('.screen-head [data-close-ex]').getAttribute('aria-label'), h2: document.getElementById('kirjaus-title').tagName, ti: document.getElementById('kirjaus-title').getAttribute('tabindex'), inputs: document.querySelectorAll('.kirjaus-card [data-set-field][aria-label]').length }));
  ok(a11y.back === 'Takaisin ohjelmaan' && a11y.h2 === 'H1' && a11y.ti === '-1' && a11y.inputs === 6, JSON.stringify(a11y));
  console.log('19 otsikkorivi ruudulla');
  ok(!s.pencil && !s.ohje, 'ei kynää eikä ?-painiketta (0.4.12)');

  console.log('2 taaksepäin-ele');
  await page.goBack(); await page.waitForTimeout(500);
  s = await screen(page); h = await hs(page);
  ok(!s.head && s.next && h.depth === 0 && !h.detail, 'lista, pino juuri ' + JSON.stringify(h));

  console.log('3 sarja 1 valmiiksi, ‹ Ohjelma');
  await jatka(page);
  await fill(page, 'A', 0, 'weight', '50'); await fill(page, 'A', 0, 'reps', '10'); await done(page, 'A', 0, true);
  await page.click('.screen-head [data-close-ex]'); await page.waitForTimeout(600);
  s = await screen(page); h = await hs(page);
  ok(!s.head && h.depth === 0 && s.nextSub === 'A · sarja 2 / 3' && s.nextBtn === 'Jatka', 'lista ' + JSON.stringify([h, s.nextSub, s.nextBtn]));
  const len3 = await page.evaluate(() => history.length);

  console.log('4 Jatka palauttaa luonnoksen');
  await jatka(page);
  const st4 = await page.evaluate(() => ({ len: history.length, pressed: document.querySelector('[data-toggle-done][data-id="A"][data-idx="0"]').getAttribute('aria-pressed') }));
  h = await hs(page); s = await screen(page);
  ok(s.head && s.title === 'A' && st4.pressed === 'true' && h.detail === 'A' && h.depth === 2, 'ruutu A, sarja 1 valmis ' + JSON.stringify([st4, h]));
  ok(st4.len - len3 <= 1, 'history.length kasvoi enintään yhdellä: ' + len3 + ' → ' + st4.len);
  await page.goBack(); await page.waitForTimeout(500);
  h = await hs(page); ok(h.depth === 0 && !(await screen(page)).head, 'yksi paluu riittää listaan');

  console.log('5 tallennus vaihtaa seuraavaan liikkeeseen');
  await jatka(page);
  await finishAll(page, 'A', 3);
  s = await screen(page); h = await hs(page);
  ok(s.head && s.title === 'B' && s.kicker === 'Viikko 1 · Päivä 1 · liike 2 / 3' && h.detail === 'B' && h.depth === 2, 'B ruudulla ' + JSON.stringify([s.title, s.kicker, h]));
  await page.goBack(); await page.waitForTimeout(500);
  s = await screen(page); h = await hs(page);
  ok(!s.head && h.depth === 0, 'paluu listaan, ei A:han');

  console.log('6 päivän viimeinen liike');
  await load(page, program(), [entry('2026-09-11', ['A','B'])]);
  await jatka(page);
  s = await screen(page); ok(s.title === 'C', 'C auki');
  await finishAll(page, 'C', 3);
  s = await screen(page); h = await hs(page);
  const day6 = await page.evaluate(() => ({ ring: !!document.querySelector('.day-card-head .day-ring.done'), open: document.querySelectorAll('.day-open').length, toast: (document.getElementById('toast') || document.querySelector('[role="status"]') || {}).textContent || '' }));
  ok(!s.head && h.depth === 0 && !h.detail && s.nextTitle === 'Viikko 1 · Päivä 2' && s.nextBtn === 'Aloita', 'lista ja seuraava päivä ' + JSON.stringify([h, s.nextTitle, s.nextBtn]));
  ok(day6.ring && day6.open === 0 && day6.toast.indexOf('Merkintä tallennettu') !== -1, 'päivä kiinni tehty-renkaalla, ilmoitus: ' + JSON.stringify(day6));

  console.log('7 välilehti sulkee ruudun');
  await load(page, program(), []);
  await jatka(page);
  await fill(page, 'A', 0, 'weight', '50'); await fill(page, 'A', 0, 'reps', '10'); await done(page, 'A', 0);
  await page.click('.tab[data-tab="historia"]'); await page.waitForTimeout(1200);
  s = await screen(page); h = await hs(page);
  ok(s.tab === 'Historia' && h.view === 'historia' && h.depth === 1, 'Historia syvyydellä 1 ' + JSON.stringify([s.tab, h]));
  console.log('8 takaisin Ohjelmaan');
  await page.click('.tab[data-tab="ohjelma"]'); await page.waitForTimeout(1200);
  s = await screen(page); h = await hs(page);
  ok(!s.head && s.next && h.depth === 0 && s.nextBtn === 'Jatka', 'lista ' + JSON.stringify([h, s.nextBtn]));
  await jatka(page);
  const p8 = await page.evaluate(() => document.querySelector('[data-toggle-done][data-id="A"][data-idx="0"]').getAttribute('aria-pressed'));
  ok((await screen(page)).head && p8 === 'true', 'luonnos säilyi');

  console.log('9 aktiivinen Ohjelma-välilehti sulkee');
  await page.click('.tab[data-tab="ohjelma"]'); await page.waitForTimeout(1200);
  s = await screen(page); h = await hs(page);
  ok(!s.head && h.depth === 0, 'lista ' + JSON.stringify(h));

  console.log('10 uudelleenlataus ruudulla');
  await jatka(page);
  await page.reload(); await page.waitForSelector('main'); await page.waitForTimeout(800);
  s = await screen(page); h = await hs(page);
  ok(s.head && s.title === 'A' && s.ledger && h.depth === 2 && h.detail === 'A', 'ruutu palasi ' + JSON.stringify([s.title, h]));

  console.log('11 uudelleenlataus poistetulla id:llä');
  await page.evaluate(() => history.replaceState({ view: 'ohjelma', detail: 'poistettu-id', depth: 2 }, '', location.href));
  await page.reload(); await page.waitForSelector('main'); await page.waitForTimeout(800);
  s = await screen(page); h = await hs(page);
  ok(!s.head && s.next && h.depth === 0 && !h.detail, 'lista, pino korjattu ' + JSON.stringify(h));

  console.log('12 liikkeen vaihto');
  await load(page, program(), []);
  await jatka(page);
  await page.click('[data-swap-open][data-id="A"]'); await page.waitForTimeout(400);
  await page.selectOption('[data-variant-liike]', 'Alasoutu levypainokoneessa'); await page.waitForTimeout(400);
  await page.click('[data-swap-confirm]'); await page.waitForTimeout(600);
  s = await screen(page); h = await hs(page);
  ok(s.head && s.title === 'Alasoutu levypainokoneessa' && h.depth === 2 && h.detail && h.detail !== 'A', 'X ruudulla ' + JSON.stringify([s.title, h]));
  await page.goBack(); await page.waitForTimeout(500);
  ok(!(await screen(page)).head && (await hs(page)).depth === 0, 'paluu listaan');

  console.log('13 tietopainike');
  await load(page, program(), []);
  await jatka(page);
  const hBefore = JSON.stringify(await hs(page));
  await page.click('.screen-head .info-btn'); await page.waitForTimeout(400);
  const sheet13 = await page.evaluate(() => (document.querySelector('.sheet, [data-close-sheet]') ? document.body.textContent.indexOf('Painojen laskenta') !== -1 : false));
  ok(sheet13, 'laskenta-ikkuna avautui');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok(JSON.stringify(await hs(page)) === hBefore && (await screen(page)).head, 'pino ennallaan, ruutu auki');

  console.log('14 näppäimistö');
  await page.click('[data-set-field][data-id="A"][data-idx="0"][data-field="weight"]'); await page.waitForTimeout(400);
  const k14 = await page.evaluate(() => ({ keypad: !!document.getElementById('keypad'), cls: document.getElementById('app').className, nav: getComputedStyle(document.querySelector('.bottom-nav')).visibility }));
  ok(k14.keypad && k14.cls.indexOf('keypad-open') !== -1 && k14.nav === 'hidden', 'näppäimistö auki, navigaatio piilossa ' + JSON.stringify(k14));
  await page.click('[data-keypad-close]'); await page.waitForTimeout(400);
  ok(JSON.stringify(await hs(page)) === hBefore && !(await page.$('#keypad')), 'suljettu, pino ennallaan');

  console.log('15 ✓ → RPE → lepoajastin');
  await fill(page, 'A', 0, 'weight', '50'); await fill(page, 'A', 0, 'reps', '10'); await done(page, 'A', 0, true);
  const t15 = await page.evaluate(() => { const m = document.getElementById('rest-timer-mini'); return m ? getComputedStyle(m).display !== 'none' : false; });
  ok(t15 && JSON.stringify(await hs(page)) === hBefore && (await screen(page)).head, 'pieni ajastin, pino ennallaan');

  console.log('21 Poista merkintä ja laske uudelleen');
  await load(page, program(), [entry('2026-09-11', ['A'])]);
  await page.click('[data-toggle-day-summary][data-key="d1"]'); await page.waitForTimeout(400);
  await page.click('[data-toggle-ex][data-id="A"]'); await page.waitForTimeout(600);
  s = await screen(page); ok(s.head && s.title.indexOf('A') === 0 && !!(await page.$('#kirjaus-title .saved-badge')), 'tallennettu A ruudulla, tallennettu-merkki');
  const h21 = JSON.stringify(await hs(page));
  await page.click('.screen-head .info-btn'); await page.waitForTimeout(400);
  await page.click('[data-recalc]'); await page.waitForTimeout(600);
  s = await screen(page);
  ok(s.head && s.title === 'A' && JSON.stringify(await hs(page)) === h21 && !(await page.$('#kirjaus-title .saved-badge')), 'ruutu auki ilman merkkiä, pino ennallaan');

  console.log('20 ilman History APIa');
  const ctx20 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p20 = await ctx20.newPage(); p20.on('pageerror', e => errors.push('noHistory: ' + e));
  await p20.addInitScript(() => { try{ Object.defineProperty(History.prototype, 'pushState', { value: undefined }); }catch(e){} });
  await seed(p20, program(), []);
  await p20.goto(URL); await p20.waitForSelector('.date-picker-row'); await p20.waitForTimeout(300);
  await jatka(p20);
  ok((await screen(p20)).head, 'ruutu avautui ilman History APIa');
  await p20.click('.screen-head [data-close-ex]'); await p20.waitForTimeout(1200);
  ok(!(await screen(p20)).head && (await screen(p20)).next, 'lista ilman History APIa');
  await ctx20.close();

  console.log('16 leveä asettelu');
  const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  wide.on('pageerror', e => errors.push('wide: ' + e));
  await load(wide, program(), []);
  await jatka(wide);
  s = await screen(wide); h = await hs(wide);
  ok(!s.head && s.pane && h.depth === 0 && !h.detail, 'paneeli, pino juuri ' + JSON.stringify(h));
  console.log('17 leveä → kapea');
  await wide.setViewportSize({ width: 390, height: 844 }); await wide.waitForTimeout(600);
  s = await screen(wide); h = await hs(wide);
  ok(s.head && s.title === 'A' && h.depth === 2 && h.detail === 'A', 'ruutu ' + JSON.stringify(h));
  await wide.goBack(); await wide.waitForTimeout(500);
  ok(!(await screen(wide)).head && (await hs(wide)).depth === 0, 'ele sulkee ruudun');
  console.log('18 kapea → leveä');
  await jatka(wide);
  await wide.setViewportSize({ width: 1280, height: 900 }); await wide.waitForTimeout(600);
  s = await screen(wide); h = await hs(wide);
  ok(!s.head && s.pane && h.depth === 0 && !h.detail, 'paneeli, pino juuri ' + JSON.stringify(h));
  await wide.close();

  console.log('19 vientimuistutus ja vihje');
  await load(page, program(), [], { 'last-export-date': '2026-01-01' });
  s = await screen(page);
  ok(s.banners.some(b => b.indexOf('Varmuuskopio') !== -1), 'muistutus listalla: ' + JSON.stringify(s.banners));
  await jatka(page);
  s = await screen(page);
  ok(s.banners.length === 0 && !s.pencil, 'ei bannereita eikä kynää ruudulla');

  console.log('22 regressio: HTML-vertailu vanhaan versioon ohitetaan (kortin alaosa ja otsikkorivi muuttuivat tarkoituksella 0.4.11–0.4.13)');
  console.log('virheet');
  ok(errors.length === 0, 'ei JS-virheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? ('\nEPÄONNISTUI: ' + fails) : '\nKAIKKI OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
