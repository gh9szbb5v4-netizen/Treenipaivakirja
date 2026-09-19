// Kirjaus-kehotteet 2–5: otsikkorivi, tavoiterivi, desimaalipilkku, seuraava sarja.
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
const PREV = 'http://127.0.0.1:8766/index_prev.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const nb = s => s == null ? s : String(s).replace(/[  ]/g, ' ');
function pex(id, name, sets, reps, extra){ return Object.assign({ id, name, sets, reps, unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [
    pex('A', 'Kulmasoutu tangolla', '2', '10'),
    pex('B', 'Kyykky tangolla', '2', '6', { kind: 'cluster', autoCalc: false }),
    pex('C', 'Cardiolaite / Punnerrus, 12 min', '1', '12', { unit: 'min' }),
    pex('D', 'Penkkipunnerrus tangolla', '2', '8'),
    pex('E', 'Maastaveto', '1', '1', { notes: 'MAX', intensity: { isMax: true, percents: [] } }),
    pex('F', 'Pystypunnerrus', '2', '10') ] } ] };
const sess = (w, r, extra) => Object.assign({ sets: [{ weight: w, reps: r, done: true }, { weight: w, reps: r, done: true }] }, extra || {});
async function load(page, opts, url){
  opts = opts || {}; url = url || URL;
  await page.goto(url.replace(/index[^/]*\.html$/, 'manifest.json'));
  await page.evaluate(({ PROGRAM, opts }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(PROGRAM));
    if(opts.last) localStorage.setItem('treenipk:last-set-log', JSON.stringify(opts.last));
    (opts.entries || []).forEach(e => localStorage.setItem('treenipk:entries:' + e.date, JSON.stringify(e)));
  }, { PROGRAM, opts });
  await page.goto(url);
  await page.waitForSelector('.next-card');
  await page.waitForTimeout(300);
}
async function open(page, id){
  if(!(await page.$('.day-exercises'))){ await page.click('[data-toggle-day-summary][data-key="d1"]'); await page.waitForTimeout(400); }
  await page.click('[data-toggle-ex][data-id="' + id + '"]'); await page.waitForSelector('.ledger'); await page.waitForTimeout(500);
}
async function done(page, id, idx){ await page.click('[data-toggle-done][data-id="' + id + '"][data-idx="' + idx + '"]'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
const head = page => page.evaluate(() => {
  const h = document.querySelector('header'), m = document.querySelector('main');
  const sh = m.querySelector('.screen-head');
  const first = m.firstElementChild;
  const back = sh ? sh.querySelector('button.icon-btn') : null;
  const title = sh ? sh.querySelector('.screen-title') : null;
  const info = sh ? sh.querySelector('.screen-head-right .info-btn') : null;
  const r = info ? info.getBoundingClientRect() : null;
  const firstRow = m.querySelector('.ledger-row:not(.ledger-head)');
  return { logo: !!h.querySelector('.app-logo'), ohje: !!h.querySelector('[data-tab="ohje"]'), nav: !!h.querySelector('nav.bottom-nav'), firstIsHead: first === sh,
    back: back ? { attrs: [...back.attributes].map(a => a.name).filter(n => n.startsWith('data-')).join(','), label: back.getAttribute('aria-label') } : null,
    kicker: sh ? (sh.querySelector('.screen-kicker') || {}).textContent || null : null, titleTag: title ? title.tagName : null, titleId: title ? title.id : null, titleText: title ? title.textContent : null,
    info: !!info, infoSize: r ? [Math.round(r.width), Math.round(r.height)] : null, chip: title ? !!title.querySelector('.chip') : null,
    h1s: document.querySelectorAll('h1').length, landmarks: !!document.querySelector('header') && !!document.querySelector('nav') && !!document.querySelector('main'),
    rowTop: firstRow ? Math.round(firstRow.getBoundingClientRect().top + window.scrollY) : null, active: document.activeElement ? document.activeElement.id : null, scrollY: window.scrollY,
    target: (m.querySelector('.exercise-target') || {}).innerHTML || null, targetText: (m.querySelector('.exercise-target') || {}).textContent || null };
});
const rows = page => page.evaluate(() => [...document.querySelectorAll('.ledger .ledger-row:not(.ledger-head)')].map(r => ({
  next: r.classList.contains('next'), cur: r.getAttribute('aria-current'), num: r.querySelector('.set-num').textContent, numColor: getComputedStyle(r.querySelector('.set-num')).color,
  left: Math.round(r.getBoundingClientRect().left), ledgerLeft: Math.round(document.querySelector('.ledger').getBoundingClientRect().left),
  weight: r.querySelector('[data-field="weight"]') ? r.querySelector('[data-field="weight"]').value : null, placeholder: r.querySelector('[data-field="weight"]') ? r.querySelector('[data-field="weight"]').placeholder : null,
  kt: !!r.querySelector('.keypad-target') })));
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  const LAST = { 'kulmasoutu tangolla': Object.assign(sess(50, 10), { date: '2026-09-10', prior: [], warmups: [{ weight: 40.5, reps: 8, rpe: 6 }] }) };

  console.log('=== Kehote 2: otsikkorivi');
  // Vertailu edelliseen versioon (0.4.11, index_prev.html palvelimessa 8766):
  // ensimmäisen sarjarivin sijainti. Ajetaan vain, jos vertailuversio on
  // tarjolla; repossa sitä ei ole, jolloin mitattu arvo (114 px) on kirjattu
  // CLAUDE.md:hen.
  let prevTop = null;
  const prevAvailable = await page.request.get(PREV).then(r => r.ok()).catch(() => false);
  if(prevAvailable){ await load(page, { last: LAST }, PREV); await open(page, 'A'); prevTop = (await head(page)).rowTop; }
  else console.log('  skip 1 vertailu edelliseen versioon (index_prev.html ei tarjolla)');
  await load(page, { last: LAST }); await open(page, 'A');
  let h = await head(page);
  ok(!h.logo && !h.ohje && h.nav, '1 header ilman logoa ja ?-painiketta, navigaatio näkyy');
  ok(h.firstIsHead && h.back && h.back.attrs === 'data-close-ex,data-id' && h.back.label === 'Takaisin ohjelmaan', '1 main alkaa otsikkorivillä: ' + JSON.stringify(h.back));
  ok(h.kicker === 'Viikko 1 · Päivä 1 · liike 1 / 6' && h.titleTag === 'H1' && h.titleId === 'kirjaus-title' && h.info && h.infoSize[0] === 44 && h.infoSize[1] === 44, '1 kicker, h1, ⓘ 44×44: ' + JSON.stringify([h.kicker, h.titleTag, h.infoSize]));
  if(prevTop !== null) ok(prevTop - h.rowTop >= 90, '1 ensimmäinen sarjarivi ' + (prevTop - h.rowTop) + ' px ylempänä (' + prevTop + ' → ' + h.rowTop + ')');
  ok(h.active === 'kirjaus-title' && h.scrollY === 0, '3 fokus h1#kirjaus-title, scrollY 0');
  ok(h.h1s === 1 && h.landmarks, '10 yksi h1, maamerkit');
  await page.click('.screen-head [data-close-ex]'); await page.waitForTimeout(700);
  h = await head(page);
  ok(!!(await page.$('.next-card')) && h.logo && h.ohje, '2 takaisin listaan, 7 logo ja ? juuressa');
  // 4 Kehityksen liikenäkymä kapea (pysähtynyt Pystypunnerrus)
  const decl = [['2026-07-01',60],['2026-07-15',58],['2026-08-01',56],['2026-08-20',54],['2026-09-10',52]].map(p => ({ date: p[0], exercises: { F: { name: 'Pystypunnerrus', sets: [{ weight: p[1], reps: 1, done: true }], kind: 'plain' } } }));
  await load(page, { entries: decl });
  await page.click('.tab[data-tab="kehitys"]'); await page.waitForSelector('main .segmented'); await page.waitForTimeout(400);
  h = await head(page); ok(h.logo && h.ohje, '7 Kehitys-etusivu logoineen');
  await page.click('[data-kehitys-front-tab="liikkeet"]'); await page.waitForTimeout(300);
  await page.click('.kehitys-row'); await page.waitForTimeout(700);
  h = await head(page);
  ok(!h.logo && h.firstIsHead && h.back && h.back.attrs === 'data-close-kehitys' && h.back.label === 'Takaisin Kehitykseen' && h.kicker === 'Kehitys' && h.titleTag === 'H1' && h.titleText.indexOf('Pystypunnerrus') === 0 && h.chip && h.h1s === 1, '4 liikenäkymä: ' + JSON.stringify([h.back, h.kicker, h.titleTag, h.chip, h.h1s]));
  ok(!!(await page.$('[data-kehitys-tab]')), '4 välilehdet ennallaan');
  await page.click('.screen-head [data-close-kehitys]'); await page.waitForTimeout(800);
  // 6 Asetukset
  await page.click('.tab[data-tab="asetukset"]'); await page.waitForTimeout(800);
  h = await head(page); ok(h.logo && h.ohje, '6 Asetusten luettelo logoineen');
  await page.click('[data-settings-section="lepo"]'); await page.waitForTimeout(500);
  h = await head(page);
  ok(!h.logo && h.firstIsHead && h.back.attrs === 'data-settings-back' && h.back.label === 'Takaisin asetuksiin' && h.kicker === 'Asetukset' && h.titleTag === 'H1' && h.titleText === 'Lepoajastin' && h.h1s === 1, '6 alinäkymä: ' + JSON.stringify([h.back, h.kicker, h.titleText, h.h1s]));
  await page.click('.screen-head [data-settings-back]'); await page.waitForTimeout(500);
  ok((await head(page)).logo, '6 takaisin luetteloon: logo');
  await page.click('.tab[data-tab="historia"]'); await page.waitForTimeout(800);
  h = await head(page); ok(h.logo && h.ohje, '7 Historia logoineen');
  await page.click('.tab[data-tab="ohjelma"]'); await page.waitForTimeout(800);
  // 8 muokkaustila
  await page.click('[data-edit-program]'); await page.waitForTimeout(600);
  // 0.4.21 alkaen muokkaustila avautuu viikkotasolle omalla otsikkorivillään
  // (logorivi vain juuritasolla); navigaatio ei näy kummallakaan.
  const ed = await page.evaluate(() => ({ logo: !!document.querySelector('header .app-logo'), nav: !!document.querySelector('nav.bottom-nav'), head: !!document.querySelector('main .screen-head [data-edit-back]') }));
  ok(!ed.nav && (ed.logo || ed.head), '8 muokkaustila: ei navigaatiota, logorivi tai tason otsikkorivi ' + JSON.stringify(ed));
  await page.click('.edit-bar button:has-text("Peruuta")').catch(() => {}); await page.waitForTimeout(500);
  // 5 leveä paneeli
  const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  wide.on('pageerror', e => errors.push('wide: ' + e));
  await load(wide, { entries: decl });
  await wide.click('.tab[data-tab="kehitys"]'); await wide.waitForSelector('main .kehitys-cols'); await wide.waitForTimeout(400);
  await wide.click('[data-kehitys-front-tab="liikkeet"]'); await wide.waitForTimeout(300);
  await wide.click('.kehitys-row'); await wide.waitForTimeout(500);
  const wp = await wide.evaluate(() => { const p = document.querySelector('.kehitys-pane .screen-head'); return { logo: !!document.querySelector('header .app-logo'), head: !!p, back: p ? !!p.querySelector('button') : null, tag: p ? p.querySelector('.screen-title').tagName : null, h1s: document.querySelectorAll('h1').length }; });
  ok(wp.logo && wp.head && !wp.back && wp.tag === 'H2' && wp.h1s === 1, '5 leveä: logo, paneelin otsikkorivi ilman painiketta ' + JSON.stringify(wp));

  console.log('=== Kehote 3: tavoiterivi');
  await load(page, { last: LAST }); await open(page, 'A');
  h = await head(page);
  ok(/^2 sarjaa · 10 toistoa · RPE 8 · ehdotus (sama paino|[+−][\d,]+ kg)$/.test(nb(h.targetText)) && h.target.indexOf('<span class="accent">ehdotus') !== -1, '1 avoin: ' + nb(h.targetText));
  // 4 plateau
  const PLAT = { 'kulmasoutu tangolla': Object.assign(sess(50, 8), { date: '2026-09-10', prior: [Object.assign(sess(50, 10), { date: '2026-09-05' }), Object.assign(sess(50, 10), { date: '2026-09-01' })] }) };
  await load(page, { last: PLAT }); await open(page, 'A');
  h = await head(page);
  ok(nb(h.targetText) === '2 sarjaa · 10 toistoa · RPE 8 · kevennys −5 kg', '4 kevennys: ' + nb(h.targetText));
  // 3 vaje → ehdotus laskee
  const SHORT = { 'kulmasoutu tangolla': Object.assign({ sets: [{ weight: 50, reps: 6, done: true }, { weight: 50, reps: 6, done: true }] }, { date: '2026-09-10', prior: [] }) };
  await load(page, { last: SHORT }); await open(page, 'A');
  h = await head(page);
  ok(/ehdotus −[\d,]+ kg$/.test(nb(h.targetText)), '3 vaje: ' + nb(h.targetText));
  // 5 ensimmäinen kerta
  await load(page, {}); await open(page, 'A');
  h = await head(page);
  ok(nb(h.targetText) === '2 sarjaa · 10 toistoa · RPE 8' && h.target.indexOf('accent') === -1, '5 ilman historiaa: ' + nb(h.targetText));
  // 10 suljettu kortti listalla: avataan päivä, luetaan kortin D tavoiterivi
  const closed = await page.evaluate(() => { const c = [...document.querySelectorAll('.day-exercises .exercise')].find(e => e.textContent.indexOf('Penkkipunnerrus') !== -1); return c ? null : 'not-in-list'; });
  await page.click('.screen-head [data-close-ex]'); await page.waitForTimeout(700);
  const closedTarget = await page.evaluate(() => { const c = [...document.querySelectorAll('.day-exercises .exercise')].find(e => e.textContent.indexOf('Kulmasoutu') !== -1); return c ? c.querySelector('.exercise-target').textContent : null; });
  ok(nb(closedTarget) === '2 sarjaa · 10 toistoa', '10 suljettu kortti: ' + nb(closedTarget));
  // 6 tallennettu, 7 MAX, 8 cluster, 9 yhdistelmä
  const today = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); });
  await load(page, { last: LAST, entries: [{ date: today, exercises: { A: { name: 'Kulmasoutu tangolla', sets: [{ weight: 82.5, reps: 10, done: true }, { weight: 82.5, reps: 10, done: true }], kind: 'plain' } } }] });
  await open(page, 'A'); h = await head(page);
  ok(nb(h.targetText) === '2 sarjaa · 10 toistoa · RPE 8', '6 tallennettu: ' + nb(h.targetText));
  let r = await rows(page);
  ok(r.every(x => x.weight === '82,5') && r.every(x => !x.next), '4/6 tallennettu: kentät 82,5, 5/8 ei next-riviä: ' + JSON.stringify(r.map(x => [x.weight, x.next])));
  await page.click('.screen-head [data-close-ex]'); await page.waitForTimeout(700);
  await open(page, 'E'); h = await head(page);
  ok(nb(h.targetText).indexOf('RPE 8') !== -1 && h.target.indexOf('accent') === -1, '7 MAX: ' + nb(h.targetText));
  await page.click('.screen-head [data-close-ex]'); await page.waitForTimeout(700);
  await open(page, 'B'); h = await head(page);
  ok(nb(h.targetText).indexOf('RPE') === -1 && h.target.indexOf('accent') === -1, '8 cluster: ' + nb(h.targetText));
  await page.click('.screen-head [data-close-ex]'); await page.waitForTimeout(700);
  await open(page, 'C'); h = await head(page);
  ok(nb(h.targetText) === '1 sarja · 12 min' && h.target.indexOf('accent') === -1, '9 yhdistelmä: ' + nb(h.targetText));
  // 11 leveä paneeli
  await load(wide, { last: LAST });
  await wide.click('[data-toggle-day-summary][data-key="d1"]'); await wide.waitForTimeout(400);
  await wide.click('[data-toggle-ex][data-id="A"]'); await wide.waitForSelector('.ohjelma-pane .ledger'); await wide.waitForTimeout(400);
  const wt = await wide.evaluate(() => ({ pane: document.querySelector('.ohjelma-pane .exercise-target').textContent, list: [...document.querySelectorAll('.ohjelma-list .exercise')].find(e => e.textContent.indexOf('Kulmasoutu') !== -1).querySelector('.exercise-target').textContent }));
  ok(/RPE 8 · ehdotus/.test(nb(wt.pane)) && nb(wt.list) === '2 sarjaa · 10 toistoa', '11 paneeli sama rivi, listan kortti ennallaan: ' + JSON.stringify([nb(wt.pane), nb(wt.list)]));

  console.log('=== Kehote 4: desimaalipilkku');
  await load(page, { last: LAST }); await open(page, 'A');
  r = await rows(page);
  ok(r[0].weight === '52,5' && r[1].weight === '52,5', '1 esitäyttö 52,5: ' + JSON.stringify(r.map(x => x.weight)));
  await page.click('[data-add-warmup][data-id="A"]'); await page.waitForTimeout(400); await page.click('[data-keypad-close]').catch(() => {}); await page.waitForTimeout(200);
  r = await rows(page);
  ok(r[0].num === 'L1' && r[0].weight === '42,5', '7 lämmittelyehdotus 42,5: ' + JSON.stringify([r[0].num, r[0].weight]));
  // 3 +2,5 ketju
  await page.click('[data-set-field][data-id="A"][data-idx="1"][data-field="weight"]'); await page.waitForTimeout(300);
  await page.click('[data-weight-step][data-step="2.5"]'); await page.waitForTimeout(150);
  let v = await page.evaluate(() => document.querySelector('[data-set-field][data-id="A"][data-idx="1"][data-field="weight"]').value);
  ok(v === '55', '3 +2,5 → 55: ' + v);
  await page.click('[data-weight-step][data-step="2.5"]'); await page.waitForTimeout(150);
  v = await page.evaluate(() => document.querySelector('[data-set-field][data-id="A"][data-idx="1"][data-field="weight"]').value);
  ok(v === '57,5', '3 +2,5 → 57,5 pilkulla: ' + v);
  // 2 näppäimistö 5 2 , 5 (replace-tilassa ensimmäinen numero korvaa)
  await page.click('[data-keypad-key="back"]'); await page.click('[data-keypad-key="back"]'); await page.click('[data-keypad-key="back"]'); await page.click('[data-keypad-key="back"]');
  for(const k of ['5','2',',','5']){ await page.click('[data-keypad-key="' + k + '"]'); await page.waitForTimeout(80); }
  await page.waitForTimeout(200);
  const kv = await page.evaluate(() => ({ field: document.querySelector('[data-set-field][data-id="A"][data-idx="1"][data-field="weight"]').value, planned: document.querySelector('[data-volume-planned]').textContent }));
  ok(kv.field === '52,5', '2 näppäimistö: ' + JSON.stringify(kv));
  await page.click('[data-keypad-close]'); await page.waitForTimeout(200);
  // 4 kokonaisluku, 5 tyhjä, 8 fyysinen näppäimistö "52.5"
  await page.evaluate(() => { const el = document.querySelector('[data-set-field][data-id="A"][data-idx="2"][data-field="weight"]'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.focus('[data-set-field][data-id="A"][data-idx="2"][data-field="weight"]'); await page.keyboard.type('60'); await page.waitForTimeout(150);
  await page.evaluate(() => { const el = document.querySelector('[data-set-field][data-id="A"][data-idx="1"][data-field="weight"]'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.focus('[data-set-field][data-id="A"][data-idx="1"][data-field="weight"]'); await page.keyboard.type('52.5'); await page.waitForTimeout(150);
  let typed = await page.evaluate(() => ({ a: document.querySelector('[data-set-field][data-id="A"][data-idx="1"][data-field="weight"]').value, b: document.querySelector('[data-set-field][data-id="A"][data-idx="2"][data-field="weight"]').value }));
  ok(typed.a === '52.5' && typed.b === '60', '8 kirjoitettu 52.5 säilyy kesken kirjoituksen, 4 kokonaisluku 60: ' + JSON.stringify(typed));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await done(page, 'A', 0); // piirto
  typed = await page.evaluate(() => ({ a: document.querySelector('[data-set-field][data-id="A"][data-idx="1"][data-field="weight"]').value, b: document.querySelector('[data-set-field][data-id="A"][data-idx="2"][data-field="weight"]').value, planned: document.querySelector('[data-volume-planned]').textContent }));
  ok(typed.a === '52,5' && typed.b === '60' && nb(typed.planned) === '1 125 kg', '8 piirron jälkeen 52,5; volyymi 525 + 600: ' + JSON.stringify(typed));
  await page.evaluate(() => { const el = document.querySelector('[data-set-field][data-id="A"][data-idx="2"][data-field="weight"]'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await done(page, 'A', 0); await done(page, 'A', 0);
  r = await rows(page);
  ok(r[2].weight === '' && r[2].placeholder === 'kg', '5 tyhjä kenttä, placeholder kg');

  console.log('=== Kehote 5: seuraava sarja');
  await load(page, { last: LAST }); await open(page, 'A');
  r = await rows(page);
  ok(r.length === 2 && r[0].next && r[0].cur === 'step' && r[0].numColor === 'rgb(201, 162, 39)' && !r[1].next && r[1].cur === null, '1 rivi 1 next: ' + JSON.stringify(r.map(x => [x.next, x.cur, x.numColor])));
  ok(r[0].left === r[0].ledgerLeft, '9 tausta kortin sisäreunasta: ' + r[0].left + ' / ' + r[0].ledgerLeft);
  await done(page, 'A', 0);
  r = await rows(page);
  ok(!r[0].next && r[0].numColor === 'rgb(111, 174, 111)' && r[1].next && r[1].cur === 'step', '2 next siirtyy riville 2, 1 vihreä');
  await done(page, 'A', 1);
  r = await rows(page);
  ok(r.every(x => !x.next && x.cur === null), '3 kaikki ✓: ei next-riviä');
  await page.click('[data-add-set][data-id="A"]'); await page.waitForTimeout(400);
  r = await rows(page);
  ok(r.length === 3 && r[2].next && r[2].num === '3', '6 + Sarja: next rivillä 3');
  await done(page, 'A', 0);
  r = await rows(page);
  ok(r[0].next && !r[2].next && r.filter(x => x.cur === 'step').length === 1, '7/10 ✓ pois riviltä 1: next palaa, yksi aria-current');
  // 4 lämmittely, 5 näppäimistö sarjalla 2
  await load(page, { last: LAST }); await open(page, 'A');
  await page.click('[data-add-warmup][data-id="A"]'); await page.waitForTimeout(400); await page.click('[data-keypad-close]').catch(() => {}); await page.waitForTimeout(200);
  r = await rows(page);
  ok(r[0].num === 'L1' && r[0].next && !r[1].next, '4 next on L1');
  await done(page, 'A', 0);
  r = await rows(page);
  ok(!r[0].next && r[1].next && r[1].num === '1', '4 L1 ✓ → next sarjalla 1');
  await page.click('[data-set-field][data-id="A"][data-idx="2"][data-field="weight"]'); await page.waitForTimeout(300);
  r = await rows(page);
  ok(r[1].next && !r[2].next && r[2].kt && !r[1].kt, '5 sarja 1 next, sarjan 2 kenttä keypad-target');
  await page.click('[data-keypad-close]'); await page.waitForTimeout(200);

  await wide.close();
  console.log('virheet');
  ok(errors.length === 0, 'ei JS-virheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? ('\nEPÄONNISTUI: ' + fails) : '\nKAIKKI OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
