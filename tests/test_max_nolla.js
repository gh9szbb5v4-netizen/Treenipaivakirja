// MAX-rivin 1RM raskaimmasta onnistuneesta nostosta ja nollan toiston sarjat
// Kehityksen 1RM-arviossa (0.4.26). Tallennuslogiikka ja laskenta kutsutaan
// suoraan: sivulle tarjoillaan reitityksessä index.html, jonka sulkeuman
// loppuun on lisätty window.__t-viittaukset; tiedostoon itseensä ei kosketa.
// Lisäksi sama kirjaus käyttöliittymän kautta, ohjetekstit, käyrä ja
// 1RM-luettelo.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const NB = ' ';
const BENCH = 'Penkkipunnerrus tangolla, Suora tanko';
const KEY = BENCH.toLowerCase();
const DL = 'Maastaveto';

const EXPOSE = ['heaviestSuccessfulLift', 'saveExerciseLog', 'moveHistoryExercise', 'buildAllOneRepMaxSeries',
  'computeProgress', 'buildRecordsByName', 'floorToStep', 'state'];
function instrumentedHtml(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const marker = '})();\n</script>';
  const i = html.lastIndexOf(marker);
  if(i === -1) throw new Error('index.html: sovelluksen sulkeuman loppua ei löytynyt');
  const hook = 'window.__t = {' + EXPOSE.map(n => JSON.stringify(n) + ': (typeof ' + n + ' !== "undefined" ? ' + n + ' : null)').join(', ') + '};\n';
  return html.slice(0, i) + hook + html.slice(i);
}
async function newPage(browser, instrumented){
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  if(instrumented){
    const body = instrumentedHtml();
    await page.route('**/index.html', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  }
  await page.clock.setFixedTime(new Date('2026-09-24T12:00:00'));
  return page;
}
function ex(id, name, teho){
  return { id, name, sets: '1', reps: '1', unit: '', weight: '', notes: teho || '', intensity: teho === 'MAX' ? { isMax: true, percents: [] } : null, kind: 'plain', autoCalc: true };
}
const PROGRAM = { days: [ { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [ex('b1', BENCH, 'MAX'), ex('m1', DL, 'MAX')] } ],
  weeks: ['1'], weekLabels: {}, id: 'prog-1', name: 'Testi' };
const MAX175 = { [KEY]: { weight: 175, date: '2026-09-01' } };
async function seed(page, opts){
  opts = opts || {};
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(o.program));
    if(o.max) localStorage.setItem('treenipk:manual-1rm', JSON.stringify(o.max));
    Object.keys(o.entries || {}).forEach(d => localStorage.setItem('treenipk:entries:' + d, JSON.stringify(o.entries[d])));
  }, { program: PROGRAM, max: opts.max === undefined ? MAX175 : opts.max, entries: opts.entries || {} });
  await page.goto(URL);
  await page.waitForSelector('.bottom-nav'); await w(400);
}
// Sarja [paino, toistot, valmis?]; merkinnän sarjat valmiina kuten kirjauksessa.
const row = (wt, r, done) => ({ weight: String(wt), reps: String(r), notes: '', done: done !== false, kind: 'work' });
function entry(date, id, name, sets, extra){
  return { date, exercises: { [id]: Object.assign({ name, sets, kind: 'plain', loggedAt: date + 'T10:00:00.000Z', warmups: [] }, extra || {}) } };
}
const saveMax = (page, rows) => page.evaluate(async rows => {
  const t = window.__t;
  t.state.draftSets.b1 = rows;
  await t.saveExerciseLog('b1');
  return { max: t.state.manualMax['penkkipunnerrus tangolla, suora tanko'] || null, toast: (document.getElementById('toast') || {}).textContent || '',
    stored: JSON.parse(localStorage.getItem('treenipk:manual-1rm') || '{}')['penkkipunnerrus tangolla, suora tanko'] || null };
}, rows);
const storedEntry = (page, date) => page.evaluate(d => JSON.parse(localStorage.getItem('treenipk:entries:' + d) || 'null'), date);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const tp = await newPage(browser, true);
  tp.on('pageerror', e => errors.push(String(e)));

  console.log('=== 1 heaviestSuccessfulLift');
  await seed(tp);
  const h = await tp.evaluate(() => {
    const f = window.__t.heaviestSuccessfulLift;
    return [f([]), f([{ weight: '185', reps: '0', done: true }]), f([{ weight: '180', reps: '1', done: true }, { weight: '185', reps: '0', done: true }]),
      f([{ weight: '175', reps: '1', done: true }, { weight: '180', reps: '1', done: true }]), f([{ weight: '190', reps: '1', done: false }, { weight: '180', reps: '1', done: true }]),
      f([{ weight: '182,5', reps: '1' }]), f([{ weight: '180', reps: '' , done: true }]), f([{ weight: '', reps: '1', done: true }]), f([{ weight: '170', reps: '2', done: true }])];
  });
  ok(JSON.stringify(h) === '[0,0,180,180,180,182.5,0,0,170]', '1 tyhjä 0, 185 × 0 → 0, 180 × 1 + 185 × 0 → 180, 175 + 180 → 180, merkitsemätön ohitetaan, done puuttuu (tuonti) kelpaa, toistot/paino puuttuu → 0, 170 × 2 kelpaa: ' + JSON.stringify(h));

  console.log('=== 2 MAX-tallennus (nykyinen 1RM 175 kg)');
  let r = await saveMax(tp, [row(180, 1)]);
  ok(r.max && r.max.weight === 180 && r.max.date === '2026-09-24' && r.stored.weight === 180, '2 180 × 1 → 1RM 180, päivä merkinnän päivä: ' + JSON.stringify(r.max));
  ok(r.toast === 'Tallennettu — 1RM nyt 180 kg', '2 ilmoitus: ' + r.toast);
  await seed(tp);
  r = await saveMax(tp, [row(185, 0)]);
  ok(r.max.weight === 175 && r.max.date === '2026-09-01' && r.stored.weight === 175, '2 185 × 0 → 1RM pysyy 175: ' + JSON.stringify(r.max));
  ok(r.toast === 'Merkintä tallennettu — 1RM ei muuttunut, koska onnistunutta nostoa ei ollut', '2 ilmoitus kertoo syyn: ' + r.toast);
  let e = await storedEntry(tp, '2026-09-24');
  ok(e && e.exercises.b1 && e.exercises.b1.sets.length === 1 && e.exercises.b1.sets[0].reps === '0', '2 epäonnistunut yritys tallentuu merkintään');
  await seed(tp);
  r = await saveMax(tp, [row(180, 1), row(185, 0)]);
  ok(r.max.weight === 180 && r.toast === 'Tallennettu — 1RM nyt 180 kg', '2 180 × 1 ja 185 × 0 → 180: ' + JSON.stringify([r.max, r.toast]));
  await seed(tp);
  r = await saveMax(tp, [row(175, 1), row(180, 1)]);
  ok(r.max.weight === 180, '2 175 × 1 ja 180 × 1 → 180 (ei ensimmäinen sarja): ' + JSON.stringify(r.max));
  await seed(tp);
  r = await saveMax(tp, [row(190, 1, false), row(180, 1)]);
  ok(r.max.weight === 180, '2 merkitsemätön 190 × 1 ei kelpaa → 180: ' + JSON.stringify(r.max));

  console.log('=== 3 korjaus ei muuta 1RM:ää');
  const corrMax = { [KEY]: { weight: 175, date: '2026-09-22' } };
  await seed(tp, { max: corrMax, entries: { '2026-09-20': entry('2026-09-20', 'b1', BENCH, [row(180, 1)]) } });
  r = await saveMax(tp, [row(182.5, 1)]);
  e = await storedEntry(tp, '2026-09-20');
  ok(r.max.weight === 175 && r.max.date === '2026-09-22' && r.stored.weight === 175, '3 korjaus 182,5 × 1 → 1RM ennallaan 175: ' + JSON.stringify(r.max));
  ok(r.toast === 'Merkintä korjattu (20.9.)' && e.exercises.b1.sets[0].weight === '182.5' && !!e.exercises.b1.editedAt, '3 merkintä korjattu alkuperäiselle päivälle: ' + r.toast);
  ok(!(await storedEntry(tp, '2026-09-24')), '3 korjaus ei luo merkintää kirjauspäivälle');
  await seed(tp, { max: corrMax, entries: { '2026-09-20': entry('2026-09-20', 'b1', BENCH, [row(180, 1)]) } });
  r = await saveMax(tp, [row(185, 0)]);
  ok(r.max.weight === 175 && r.toast === 'Merkintä korjattu (20.9.)', '3 korjaus 185 × 0 → 1RM ennallaan, ei 1RM-ilmoitusta: ' + JSON.stringify([r.max, r.toast]));

  console.log('=== 4 Historian siirto laskee 1RM:n samalla säännöllä');
  const move = (page, from, to) => page.evaluate(async a => {
    await window.__t.moveHistoryExercise(a[0], 'b1', a[1]);
    return window.__t.state.manualMax['penkkipunnerrus tangolla, suora tanko'] || null;
  }, [from, to]);
  await seed(tp, { max: corrMax, entries: { '2026-09-20': entry('2026-09-20', 'b1', BENCH, [row(180, 1), row(185, 0)]) } });
  await tp.click('.tab[data-tab="historia"]'); await w(500);
  let m = await move(tp, '2026-09-20', '2026-09-21');
  ok(m && m.weight === 180 && m.date === '2026-09-21', '4 siirto: 180 × 1 ja 185 × 0 → 180 (ei epäonnistunut 185): ' + JSON.stringify(m));
  await seed(tp, { max: corrMax, entries: { '2026-09-20': entry('2026-09-20', 'b1', BENCH, [row(185, 0)]) } });
  await tp.click('.tab[data-tab="historia"]'); await w(500);
  m = await move(tp, '2026-09-20', '2026-09-21');
  ok(m && m.weight === 175 && m.date === '2026-09-22', '4 siirto: pelkkä 185 × 0 → 1RM ennallaan (ei poistu): ' + JSON.stringify(m));

  console.log('=== 5 Kehityksen 1RM: nollan toiston sarjat ohitetaan');
  await seed(tp);
  const k = await tp.evaluate(() => {
    const t = window.__t;
    const S = (wt, r, rpe) => { const o = { weight: String(wt), reps: String(r), notes: '', done: true }; if(rpe !== undefined) o.rpe = rpe; return o; };
    const day = (date, sets) => ({ date, entry: { date, exercises: { a: { name: 'Kulmasoutu', sets, kind: 'plain', loggedAt: date + 'T10:00:00.000Z' } } } });
    const pts = list => { const s = t.buildAllOneRepMaxSeries(list).kulmasoutu; return s ? s.points.map(p => ({ date: p.date, value: p.value, raw: p.raw, measured: p.measured, set: p.set })) : null; };
    const zeroOnly = pts([day('2026-09-10', [S(150, 0)])]);
    const mixed = pts([day('2026-09-10', [S(150, 0), S(140, 3)])]);
    const plain = pts([day('2026-09-10', [S(140, 3)])]);
    const tyolas = pts([day('2026-09-10', [S(100, 3, 8)])]);
    const multi = pts([day('2026-09-10', [S(140, 3)]), day('2026-09-15', [S(150, 0)]), day('2026-09-20', [S(150, 0), S(140, 3)])]);
    const withZero = [day('2026-09-10', [S(150, 0), S(140, 3)]), day('2026-09-15', [S(150, 0)])];
    const noZero = [day('2026-09-10', [S(140, 3)])];
    return { zeroOnly, mixed, plain, tyolas, multi, rec: [JSON.stringify(t.buildRecordsByName(withZero)), JSON.stringify(t.buildRecordsByName(noZero))] };
  });
  ok(k.zeroOnly === null, '5 päivä, jolla vain 150 × 0 → ei pistettä: ' + JSON.stringify(k.zeroOnly));
  ok(k.mixed && JSON.stringify(k.mixed) === JSON.stringify(k.plain) && k.mixed[0].value === 155 && k.mixed[0].raw === 154, '5 150 × 0 ja 140 × 3 = pelkkä 140 × 3 (154, näkyvä 155): ' + JSON.stringify(k.mixed));
  ok(k.tyolas && k.tyolas[0].value === 117.5 && Math.abs(k.tyolas[0].raw - 116.67) < 0.005, '5 100 × 3 Työläs → 117,5 (raw 116,67): ' + JSON.stringify(k.tyolas));
  ok(k.multi && k.multi.map(p => p.date).join() === '2026-09-10,2026-09-20', '5 käyrän pisteet vain päiviltä, joilla onnistunut sarja: ' + JSON.stringify(k.multi && k.multi.map(p => p.date)));
  ok(k.rec[0] === k.rec[1], '5 ennätykset samat nollan toiston sarjojen kanssa ja ilman');

  console.log('=== 6 käyttöliittymä: MAX-kirjaus 185 × 0, ohjetekstit');
  const page = await newPage(browser, false);
  page.on('pageerror', e2 => errors.push(String(e2)));
  await seed(page);
  const openEx = async id => {
    if(!(await page.$('[data-toggle-ex][data-id="' + id + '"]'))){ await page.click('[data-toggle-day-summary][data-key="d1"]'); await w(400); }
    await page.click('[data-toggle-ex][data-id="' + id + '"]'); await page.waitForSelector('.ledger [data-id="' + id + '"]'); await w(500);
  };
  const sheetText = async () => {
    await page.click('.info-btn[data-open-sheet="laskenta"]'); await page.waitForSelector('.sheet'); await w(300);
    const t = await page.$eval('.sheet', el => el.textContent.replace(/\s+/g, ' '));
    await page.keyboard.press('Escape'); await w(300);
    return t;
  };
  await openEx('b1');
  let sh = await sheetText();
  ok(sh.indexOf('Sarjassa 1 on valmiina nykyinen 1RM (175 kg). Voit kirjata useamman yrityksen lisäämällä sarjoja (+ Sarja); kirjaa epäonnistunut yritys nollalla toistolla. 1RM:ksi tallentuu raskain onnistunut nosto (vähintään 1 toisto), ja se korvaa nykyisen 1RM:n.') !== -1, '6 MAX-rivin ohjeteksti: ' + sh.slice(0, 320));
  const setField = (id, idx, field, value) => page.evaluate(a => {
    const el = document.querySelector('[data-set-field][data-id="' + a[0] + '"][data-idx="' + a[1] + '"][data-field="' + a[2] + '"]');
    el.value = a[3]; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [id, idx, field, value]);
  await setField('b1', 0, 'weight', '185'); await setField('b1', 0, 'reps', '0'); await w(200);
  await page.click('[data-toggle-done][data-id="b1"][data-idx="0"]'); await w(300); await page.keyboard.press('Escape'); await w(300);
  await page.click('[data-save-ex][data-id="b1"]'); await w(500);
  const uiToast = await page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  const uiMax = await page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:manual-1rm') || '{}'));
  const uiEntry = await storedEntry(page, '2026-09-24');
  ok(uiToast === 'Merkintä tallennettu — 1RM ei muuttunut, koska onnistunutta nostoa ei ollut', '6 ilmoitus käyttöliittymässä: ' + uiToast);
  ok(uiMax[KEY].weight === 175 && uiMax[KEY].date === '2026-09-01' && uiEntry.exercises.b1.sets[0].weight === '185' && uiEntry.exercises.b1.sets[0].reps === '0', '6 1RM ennallaan, merkintä 185 × 0 tallessa: ' + JSON.stringify(uiMax[KEY]));
  // Tallennus avaa päivän seuraavan liikkeen (m1) itsestään.
  if(!(await page.$('.ledger [data-id="m1"]'))) await openEx('m1');
  sh = await sheetText();
  ok(sh.indexOf('Maksimitesti: kirjaa jokainen yritys omaksi sarjakseen (+ Sarja) ja epäonnistunut yritys nollalla toistolla. Raskain onnistunut nosto (vähintään 1 toisto) tallentuu liikkeen 1RM:ksi, josta prosenttipainot lasketaan.') !== -1, '6 MAX ilman 1RM:ää: ' + sh.slice(0, 260));
  await page.click('[data-close-ex]').catch(() => {}); await w(600);
  await page.click('[data-tab="ohje"]'); await w(600);
  const ohje = await page.evaluate(() => document.querySelector('main').textContent.replace(/\s+/g, ' '));
  ok(ohje.indexOf('MAX-rivin tallennus päivittää 1RM:n automaattisesti raskaimmasta onnistuneesta nostosta') !== -1 && ohje.indexOf('Jo tallennetun merkinnän korjaus ei muuta 1RM:ää.') !== -1, '6 Ohje: MAX-sarjan kirjaus');
  ok(ohje.indexOf('Sarjat, joissa on alle yksi toisto (epäonnistuneet ja tekemättä jääneet yritykset), eivät kuulu arvioon') !== -1 && ohje.indexOf('cluster-merkinnät ja nollan toiston sarjat pois lukien') !== -1, '6 Ohje: Kehityksen ja 1RM-luettelon arvio');

  console.log('=== 7 käyttöliittymä: käyrä, kortti ja 1RM-luettelo');
  const hist = {
    '2026-09-10': entry('2026-09-10', 'h1', BENCH, [row(140, 3)]),
    '2026-09-15': entry('2026-09-15', 'h2', BENCH, [row(150, 0)]),
    '2026-09-20': entry('2026-09-20', 'h3', BENCH, [row(150, 0), row(140, 3)])
  };
  await seed(page, { entries: hist });
  await page.click('.tab[data-tab="kehitys"]'); await page.waitForSelector('main .segmented, main .empty-state'); await w(500);
  await page.click('[data-kehitys-front-tab="liikkeet"]'); await w(400);
  await page.click('.kehitys-row:has(.kehitys-row-name:text-is("Penkkipunnerrus tangolla"))'); await w(600);
  const card = await page.evaluate(() => ({ hits: document.querySelectorAll('.kehitys-card rect.chart-hit').length, caption: (document.querySelector('.kehitys-card .chart-caption') || {}).textContent,
    hero: document.querySelector('.kehitys-hero-value').firstChild.textContent }));
  ok(card.hits === 2 && card.hero === '155', '7 käyrässä 2 pistettä (15.9. vain 150 × 0 ei näy), paras 155: ' + JSON.stringify(card));
  ok(card.caption === '20.9. · 155 kg laskennallinen (140' + NB + 'kg × 3) · paras 4 vk 155 kg', '7 20.9. arvo 140 × 3:sta: ' + card.caption);
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="1rm"]'); await w(900);
  const est = await page.evaluate(k2 => {
    const rowEl = [...document.querySelectorAll('.ledger-row')].find(rr => (rr.firstElementChild.firstElementChild || {}).textContent.trim().toLowerCase() === k2);
    const e2 = rowEl && rowEl.querySelector('.max-estimate');
    const b = rowEl && rowEl.querySelector('[data-adopt-max]');
    return { est: e2 ? e2.querySelector('span').textContent.trim() : null, btn: b ? b.textContent.trim() : null };
  }, KEY);
  ok(est.est === 'Kehityksen arvio 155 kg (10.9.)' && est.btn === 'Käytä 152,5 kg', '7 1RM-luettelon arvio ilman 150 × 0 -sarjoja: ' + JSON.stringify(est));
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="muutokset"]'); await w(500);
  const muutokset = await page.evaluate(() => document.querySelector('main').textContent);
  ok(muutokset.indexOf('(versio 0.4.26)') !== -1 && muutokset.indexOf('Nollan toiston sarjat poistuvat myös Kehityksen 1RM-arvioista') !== -1, '7 Muutokset-merkintä 0.4.26');

  ok(errors.length === 0, 'ei sivuvirheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
