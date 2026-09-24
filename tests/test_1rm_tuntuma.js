// Kehityksen 1RM-arvio tuntuma huomioiden (0.4.25): laskenta funktioita
// suoraan kutsumalla, kortin ja käyrän selitteet, 1RM-luettelon Käytä-painike,
// ennätykset ja varmuuskopion kierros.
// Sisäiset funktiot ovat sovelluksen sulkeuman sisällä, joten suorien kutsujen
// sivulle tarjoillaan reitityksessä index.html, jonka loppuun on lisätty
// window.__t-viittaukset; tiedostoon itseensä ei kosketa.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const NB = ' ';
const BENCH = 'Penkkipunnerrus tangolla, Suora tanko';
const SQUAT = 'Takakyykky tangolla, Suora tanko';
const kb = n => n.trim().toLowerCase();

const EXPOSE = ['oneRepMaxRir', 'tuntumaToRir', 'buildAllOneRepMaxSeries', 'computeProgress', 'buildRecordsByName',
  'loadAllEntries', 'loadMaxEstimates', 'maxEstimateFor', 'fmtOneRepMaxSet', 'floorToStep', 'roundToStep', 'state'];
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
function intensity(t){
  if(!t) return null;
  if(/^max$/i.test(t)) return { isMax: true, percents: [] };
  return { isMax: false, percents: (t.match(/\d+(?:[.,]\d+)?/g) || []).map(Number) };
}
function ex(id, name, sets, reps, teho){
  return { id, name, sets, reps, unit: '', weight: '', notes: teho || '', intensity: intensity(teho), kind: 'plain', autoCalc: true };
}
const PROGRAM = { days: [ { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [
    ex('b1', BENCH, '1', '1', 'MAX'), ex('k1', SQUAT, '3', '5', '80 %'), ex('r1', 'Kulmasoutu', '3', '8', '') ] } ],
  weeks: ['1'], weekLabels: {}, id: 'prog-1', name: 'Testi' };
async function seed(page, opts){
  opts = opts || {};
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    if(o.program) localStorage.setItem('treenipk:workout-program', JSON.stringify(o.program));
    if(o.max) localStorage.setItem('treenipk:manual-1rm', JSON.stringify(o.max));
    Object.keys(o.entries || {}).forEach(d => localStorage.setItem('treenipk:entries:' + d, JSON.stringify(o.entries[d])));
  }, { program: opts.program === undefined ? PROGRAM : opts.program, max: opts.max || null, entries: opts.entries || {} });
  await page.goto(URL);
  await page.waitForSelector(opts.program === null ? '.choice-card' : '.bottom-nav'); await w(400);
}
// Sarja [paino, toistot, rpe?]; rpe 6 Kevyt … 10 Äärirajoilla.
const S = (wt, r, rpe) => { const o = { weight: String(wt), reps: String(r), notes: '', done: true }; if(rpe !== undefined) o.rpe = rpe; return o; };
function day(date, list){
  const e = { date, exercises: {} };
  list.forEach((x, i) => { e.exercises[x.id] = Object.assign({ loggedAt: date + 'T1' + i + ':00:00.000Z', kind: 'plain', warmups: [] }, x); });
  return e;
}
// Penkki: 10.9. sinkku äärirajoilla (mittaus 100), 17.9. 100 × 3 Työläs
// (116,67 → 117,5) lämmittelyllä 120 × 3 Kevyt, 20.9. 90 × 1 Sujuva (102 → 102,5).
// Kyykky: 100 × 5 ilman tuntumaa (116,67 → 117,5) ja cluster-merkintä tuntumalla.
function entries(withRpe){
  const r = v => withRpe ? v : undefined;
  return {
    '2026-09-10': day('2026-09-10', [{ id: 'h1', name: BENCH, sets: [S(100, 1, r(10))] }]),
    '2026-09-17': day('2026-09-17', [
      { id: 'h2', name: BENCH, sets: [S(100, 3, r(8)), S(95, 3, r(9))], warmups: [{ weight: '120', reps: '3', rpe: r(6) === undefined ? null : 6 }] },
      { id: 'h3', name: SQUAT, sets: [S(100, 5), S(100, 5)] },
      { id: 'h4', name: 'Kulmasoutu', sets: [S(60, 8, r(7)), S(60, 8, r(8))] }]),
    '2026-09-19': day('2026-09-19', [{ id: 'h5', name: SQUAT, kind: 'cluster', sets: [Object.assign(S(110, 6, r(6)), { subsets: 4 })] }]),
    '2026-09-20': day('2026-09-20', [{ id: 'h6', name: BENCH, sets: [S(90, 1, r(7))] }])
  };
}
const savedMax = page => page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:manual-1rm') || '{}'));
async function openSettings(page, key){
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="' + key + '"]'); await w(600);
}
async function openKehitysRow(page, name){
  await page.click('.tab[data-tab="kehitys"]'); await page.waitForSelector('main .segmented, main .empty-state'); await w(500);
  await page.click('[data-kehitys-front-tab="liikkeet"]'); await w(400);
  await page.click('.kehitys-row:has(.kehitys-row-name:text-is("' + name + '"))'); await w(600);
}
const card = page => page.evaluate(() => {
  const c = document.querySelector('.kehitys-card');
  return { hero: c.querySelector('.kehitys-hero-value').firstChild.textContent, notes: [...c.querySelectorAll('.kehitys-note')].map(n => n.textContent),
    caption: (c.querySelector('.chart-caption') || {}).textContent || '' };
});
const maxRow = (page, key) => page.evaluate(k => {
  const row = [...document.querySelectorAll('.ledger-row')].find(r => (r.firstElementChild.firstElementChild || {}).textContent.trim().toLowerCase() === k);
  if(!row) return null;
  const est = row.querySelector('.max-estimate');
  const btn = row.querySelector('[data-adopt-max]');
  return { est: est ? est.querySelector('span').textContent.trim() : null, btn: btn ? btn.textContent.trim() : null, btnWeight: btn ? btn.getAttribute('data-weight') : null };
}, key);
async function download(page){
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  return fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
}
// 1RM-sarjan vertailukelpoinen tiivistelmä: pisteet ja luettelon arviot.
const seriesSummary = page => page.evaluate(async () => {
  const t = window.__t;
  const series = t.buildAllOneRepMaxSeries(await t.loadAllEntries());
  const out = {};
  Object.keys(series).sort().forEach(norm => {
    out[norm] = series[norm].points.map(p => ({ date: p.date, value: p.value, raw: p.raw, measured: p.measured, set: p.set }));
  });
  await t.loadMaxEstimates();
  return { series: out, estimates: t.state.maxEstimates };
});

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  console.log('=== 1 funktiot suoraan: oneRepMaxRir ja buildAllOneRepMaxSeries');
  const tp = await newPage(browser, true);
  tp.on('pageerror', e => errors.push(String(e)));
  await seed(tp, { entries: {} });
  const rirs = await tp.evaluate(() => [null, undefined, '', 6, 7, 8, 9, 10, '8'].map(v => window.__t.oneRepMaxRir(v)));
  ok(JSON.stringify(rirs) === '[0,0,0,4,3,2,1,0,2]', '1 oneRepMaxRir: puuttuva 0, muuten TUNTUMA_RIR (Kevyt 4): ' + JSON.stringify(rirs));
  const trirs = await tp.evaluate(() => [null, 6, 10].map(v => window.__t.tuntumaToRir(v)));
  ok(JSON.stringify(trirs) === '[2,4,0]', '1 tuntumaToRir ennallaan (puuttuva TARGET_RIR 2): ' + JSON.stringify(trirs));
  const c = await tp.evaluate(() => {
    const t = window.__t;
    const S = (wt, r, rpe) => { const o = { weight: String(wt), reps: String(r), notes: '' }; if(rpe !== undefined) o.rpe = rpe; return o; };
    function one(sets, extra){
      const data = Object.assign({ name: 'Penkkipunnerrus tangolla, Suora tanko', sets, kind: 'plain', loggedAt: '2026-09-20T10:00:00.000Z' }, extra || {});
      const s = t.buildAllOneRepMaxSeries([{ date: '2026-09-20', entry: { date: '2026-09-20', exercises: { a: data } } }])['penkkipunnerrus tangolla'];
      if(!s) return null;
      const p = s.points[0], prog = t.computeProgress(s.points);
      return { value: p.value, raw: p.raw, measured: p.measured, reps: p.set.reps, weight: p.set.weight, adopt: t.floorToStep(prog.currentRaw, 2.5), text: t.fmtOneRepMaxSet(p.set) };
    }
    return {
      plain3: one([S(100, 3)]), tyolas3: one([S(100, 3, 8)]), single: one([S(100, 1)]), singleMax: one([S(100, 1, 10)]),
      singleKevyt: one([S(100, 1, 6)]), sameDay: one([S(100, 1, 7), S(95, 3, 9)]), sameDayRev: one([S(95, 3, 9), S(100, 1, 7)]),
      sameDay2: one([S(90, 1, 7), S(95, 3, 9)]), warmup: one([S(100, 3)], { warmups: [{ weight: '120', reps: '3', rpe: 6 }] }),
      cluster: one([Object.assign(S(100, 6, 6), { subsets: 4 })], { kind: 'cluster' }), zero: one([S(100, 0, 9)]), exact: one([S(87.5, 10, 8)])
    };
  });
  ok(c.plain3.value === 110 && c.plain3.raw === 110 && !c.plain3.measured && c.plain3.adopt === 110 && c.plain3.text === '100' + NB + 'kg × 3', '1 100 × 3 ilman tuntumaa → 110 kuten ennen: ' + JSON.stringify(c.plain3));
  ok(Math.abs(c.tyolas3.raw - 116.67) < 0.005 && c.tyolas3.value === 117.5 && c.tyolas3.adopt === 115 && !c.tyolas3.measured, '1 100 × 3 Työläs → pyöristämätön 116,67, näkyvä 117,5, Käytä 115: ' + JSON.stringify(c.tyolas3));
  ok(c.tyolas3.text === '100' + NB + 'kg × 3, Työläs', '1 selitteen sarja tuntumineen: ' + c.tyolas3.text);
  ok(c.single.value === 100 && c.single.raw === 100 && c.single.measured && c.singleMax.value === 100 && c.singleMax.raw === 100 && c.singleMax.measured, '1 100 × 1 ilman tuntumaa ja Äärirajoilla → 100 mittauksena: ' + JSON.stringify([c.single, c.singleMax]));
  ok(c.singleMax.text === '100' + NB + 'kg × 1', '1 Äärirajoilla ei vaikuta arvoon eikä näy selitteessä: ' + c.singleMax.text);
  ok(Math.abs(c.singleKevyt.raw - 116.67) < 0.005 && c.singleKevyt.value === 117.5 && !c.singleKevyt.measured && c.singleKevyt.text === '100' + NB + 'kg × 1, Kevyt', '1 100 × 1 Kevyt → 116,67 laskennallisena: ' + JSON.stringify(c.singleKevyt));
  ok(c.sameDay.value === 112.5 && c.sameDay.weight === 100 && c.sameDay.reps === 1 && c.sameDayRev.value === 112.5 && c.sameDayRev.weight === 100, '1 saman päivän 100 × 1 Sujuva (113,33) ja 95 × 3 Raskas (107,67) → suurempi kummassakin järjestyksessä: ' + JSON.stringify([c.sameDay, c.sameDayRev]));
  ok(c.sameDay2.value === 107.5 && c.sameDay2.weight === 95 && c.sameDay2.text === '95' + NB + 'kg × 3, Raskas', '1 90 × 1 Sujuva (102) ja 95 × 3 Raskas (107,67) → Raskas-kolmonen: ' + JSON.stringify(c.sameDay2));
  ok(c.warmup.value === 110 && c.warmup.weight === 100, '1 lämmittely tuntumalla ei vaikuta: ' + JSON.stringify(c.warmup));
  ok(c.cluster === null, '1 cluster-merkintä ei tuota pistettä');
  ok(c.zero.value === 100 && !c.zero.measured && c.zero.text === '100' + NB + 'kg × 0', '1 nollan toiston sarjan tuntuma ohitetaan (arvo kuten ennen): ' + JSON.stringify(c.zero));
  ok(c.exact.raw === 122.5 && c.exact.adopt === 122.5, '1 87,5 × 10 Työläs = 122,5 ilman liukulukuvirhettä, Käytä 122,5: ' + JSON.stringify(c.exact));
  // Ilman tuntumaa arvo ja mittaus ovat täsmälleen entisen kaavan mukaiset.
  const grid = await tp.evaluate(() => {
    const t = window.__t, bad = [];
    [20, 22.5, 42.5, 52.5, 60, 87.5, 100, 102.5, 112.5, 118, 150, 162.5, 250].forEach(wt => {
      for(let r = 0; r <= 20; r++){
        const s = t.buildAllOneRepMaxSeries([{ date: '2026-09-01', entry: { date: '2026-09-01', exercises: { a: { name: 'Kulmasoutu', sets: [{ weight: String(wt), reps: String(r) }] } } } }]).kulmasoutu;
        const old = r === 1 ? wt : t.roundToStep(wt * (1 + r / 30), 2.5);
        const p = s.points[0];
        if(p.value !== old || p.measured !== (r === 1)) bad.push(wt + '×' + r + ': ' + p.value + ' vs ' + old);
      }
    });
    return bad;
  });
  ok(grid.length === 0, '1 ilman tuntumaa arvo ja mittaus = entinen kaava (13 painoa × 0–20 toistoa): ' + JSON.stringify(grid.slice(0, 5)));
  const rec = await tp.evaluate(a => {
    const list = x => Object.keys(x).sort().map(d => ({ date: d, entry: x[d] }));
    return [JSON.stringify(window.__t.buildRecordsByName(list(a[0]))), JSON.stringify(window.__t.buildRecordsByName(list(a[1])))];
  }, [entries(true), entries(false)]);
  ok(rec[0] === rec[1], '1 ennätykset samat tuntumalla ja ilman');

  console.log('=== 2 Kehityksen kortti ja käyrä: tuntuma selitteessä');
  const page = await newPage(browser, false);
  page.on('pageerror', e => errors.push(String(e)));
  await seed(page, { entries: entries(true) });
  await openKehitysRow(page, 'Penkkipunnerrus tangolla');
  let k = await card(page);
  ok(k.hero === '117,5', '2 paras 4 vk 117,5 (100 × 3 Työläs): ' + k.hero);
  ok(k.notes[0] === 'Laskennallinen 100' + NB + 'kg × 3, Työläs, Torstai 17. syyskuuta', '2 paras-selite tuntumineen: ' + k.notes[0]);
  ok(k.notes[1] === 'Viimeisin treeni 102,5' + NB + 'kg (90' + NB + 'kg × 1, Sujuva), Sunnuntai 20. syyskuuta', '2 viimeisin treeni tuntumineen: ' + k.notes[1]);
  ok(k.caption === '20.9. · 102,5 kg laskennallinen (90' + NB + 'kg × 1, Sujuva) · paras 4 vk 117,5 kg', '2 käyrän oletusselite: ' + k.caption);
  await page.click('.kehitys-card rect.chart-hit >> nth=0'); await w(200);
  k = await card(page);
  ok(k.caption === '10.9. · 100 kg mitattu (100' + NB + 'kg × 1) · paras 4 vk 100 kg', '2 äärirajoilla tehty sinkku on mittaus ilman tuntumaa selitteessä: ' + k.caption);
  await page.click('.kehitys-card rect.chart-hit >> nth=1'); await w(200);
  k = await card(page);
  ok(k.caption === '17.9. · 117,5 kg laskennallinen (100' + NB + 'kg × 3, Työläs) · paras 4 vk 117,5 kg', '2 Työläs-kolmosen piste: ' + k.caption);
  await page.click('[data-kehitys-tab="ennatykset"]'); await w(400);
  const recWith = await page.$eval('.kehitys-card', el => el.innerHTML);
  await seed(page, { entries: entries(false) });
  await openKehitysRow(page, 'Penkkipunnerrus tangolla');
  k = await card(page);
  ok(k.hero === '110' && k.notes[0] === 'Laskennallinen 100' + NB + 'kg × 3, Torstai 17. syyskuuta' && k.notes[1] === 'Viimeisin treeni 90' + NB + 'kg (90' + NB + 'kg × 1), Sunnuntai 20. syyskuuta', '2 ilman tuntumaa entiset arvot ja selitteet: ' + JSON.stringify(k));
  await page.click('[data-kehitys-tab="ennatykset"]'); await w(400);
  const recWithout = await page.$eval('.kehitys-card', el => el.innerHTML);
  ok(recWith === recWithout && recWith.indexOf('Raskain paino') !== -1, '2 Ennätykset-välilehti sama tuntumalla ja ilman');

  console.log('=== 3 1RM-luettelo: arvio ja Käytä pyöristämättömästä');
  await seed(page, { entries: entries(true), max: { [kb(BENCH)]: { weight: 100, date: '2026-09-01' } } });
  await openSettings(page, '1rm'); await w(500);
  let bench = await maxRow(page, kb(BENCH)), squat = await maxRow(page, kb(SQUAT));
  ok(bench && bench.est === 'Kehityksen arvio 117,5 kg (17.9.)' && bench.btn === 'Käytä 115 kg' && bench.btnWeight === '115', '3 penkki: arvio 117,5, Käytä 115: ' + JSON.stringify(bench));
  ok(squat && squat.est === 'Kehityksen arvio 117,5 kg (17.9.)' && squat.btn === 'Käytä 115 kg', '3 kyykky ilman tuntumaa (100 × 5 = 116,67): Käytä 115, cluster ohitetaan: ' + JSON.stringify(squat));
  let mx = await savedMax(page);
  ok(mx[kb(BENCH)].weight === 100 && !mx[kb(SQUAT)], '3 arvio ei muuta tallennettua itsestään');
  await page.click('[data-adopt-max][data-name="' + kb(BENCH) + '"]'); await w(400);
  mx = await savedMax(page);
  bench = await maxRow(page, kb(BENCH));
  ok(mx[kb(BENCH)].weight === 115 && mx[kb(BENCH)].date === '2026-09-24', '3 Käytä tallentaa 115 kg tälle päivälle: ' + JSON.stringify(mx[kb(BENCH)]));
  ok(bench.est === 'Kehityksen arvio 117,5 kg (17.9.)' && bench.btn === null, '3 arvio näkyy yhä, painike poistui (sama pyöristettynä alaspäin): ' + JSON.stringify(bench));

  console.log('=== 4 varmuuskopion kierros: samat arviot');
  await seed(tp, { entries: entries(true) });
  const before = await seriesSummary(tp);
  ok(before.series['penkkipunnerrus tangolla'].map(p => p.value).join() === '100,117.5,102.5' && Math.abs(before.estimates['penkkipunnerrus tangolla'].raw - 116.67) < 0.005, '4 lähtötilanne: ' + JSON.stringify(before.series['penkkipunnerrus tangolla'].map(p => p.value)));
  await openSettings(tp, 'varmuuskopio');
  const backup = await download(tp);
  const feelCol = backup.split('\n').filter(l => /^"2026-09-/.test(l)).map(l => l.split('","')[8]);
  ok(['Äärirajoilla', 'Työläs', 'Raskas', 'Sujuva', 'Kevyt'].every(f => feelCol.indexOf(f) !== -1), '4 Tuntuma-sarake viedään sanoina: ' + JSON.stringify(feelCol));
  await seed(tp, { program: null });
  await tp.setInputFiles('#import-entries-input', { name: 'varmuuskopio.csv', mimeType: 'text/csv', buffer: Buffer.from(backup, 'utf8') });
  await w(700);
  await tp.click('[data-restore-confirm]'); await w(900);
  const after = await seriesSummary(tp);
  ok(JSON.stringify(after.series) === JSON.stringify(before.series), '4 palautetun historian 1RM-pisteet samat kuin ennen vientiä');
  ok(JSON.stringify(after.estimates) === JSON.stringify(before.estimates), '4 1RM-luettelon arviot samat: ' + JSON.stringify(after.estimates));

  ok(errors.length === 0, 'ei sivuvirheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
