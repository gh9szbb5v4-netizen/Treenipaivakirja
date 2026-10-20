// Kirjaustapa ja toispuolisuus kirjauslomakkeessa (0.5.1, liikekirjaston
// vaihe 6). Kattaa: aika- ja kirjaustapa-apurit (parseTimeText,
// timeTextFromDigits, fmtTimeValue, kirjausMode, exerciseMode, fmtSetValue),
// kirjausruudun kentät ja otsikot jokaisella kirjaustavalla, toispuolisuuden
// yksikön (toistoa/puoli), Viime-sarakkeen vanhat ja uudet kerrat,
// kirjausnäppäimistön aika-, matka- ja avustuskentät, valmis-ehdot ja
// ilmoitukset, tallennuksen (kirjaustapa, toispuolinen, aika sekunteina),
// esitäytön seuraavalla kerralla, vanhojen merkintöjen säilymisen ja
// korjauksen vanhalla tavalla, Historian, RPE-ikkunan, varmuuskopion
// kierroksen ja kaksoistunnisteen, Kehityksen, simuloinnin, 360 px:n
// leveyden, axe-tarkistuksen sekä Ohjeen ja Muutokset-osion. Sisäiset
// funktiot luetaan kuten test_liikekirjasto.js:ssä (window.__t).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://127.0.0.1:8765/';
const URL = BASE + 'index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const nb = s => s == null ? s : String(s).replace(/[  ]/g, ' ');

const EXPOSE = ['parseTimeText', 'timeTextFromDigits', 'fmtTimeValue', 'kirjausMode', 'exerciseMode', 'storedMode', 'fmtSetValue',
  'draftMode', 'findExerciseById', 'isRowDoneEligible', 'modeIsWeightReps', 'state'];
function instrumentedHtml(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const marker = '})();\n</script>';
  const i = html.lastIndexOf(marker);
  if(i === -1) throw new Error('index.html: sovelluksen sulkeuman loppua ei löytynyt');
  const hook = 'window.__t = {' + EXPOSE.map(n => JSON.stringify(n) + ': (typeof ' + n + ' !== "undefined" ? ' + n + ' : null)').join(', ') + '};\n';
  return html.slice(0, i) + hook + html.slice(i);
}
async function newPage(context){
  const page = await context.newPage();
  page.on('pageerror', e => { fails++; console.log('  FAIL pageerror: ' + e.message); });
  const body = instrumentedHtml();
  await page.route('**/index.html', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00'));
  return page;
}

// ---------- tila ----------
function ex(id, name, liikeId, sets, reps, extra){
  return Object.assign({ id, name, sets: String(sets), reps: String(reps), unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true, liikeId }, extra || {});
}
const PROGRAM = { id: 'prog-k', name: 'Kirjaustapa', weeks: ['1', '2'], weekLabels: {}, days: [
  { id: 'day-k1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [
    ex('k-lankku', 'Lankku', 'lankku', 2, 1),
    ex('k-dippi', 'Dippi', 'dippi', 2, 8),
    ex('k-soutu', 'Yhden käden kulmasoutu käsipainolla', 'yhden-kaden-kulmasoutu-kasipainolla', 2, 10),
    ex('k-row', 'Soutulaite', 'soutulaite', 1, 1),
    ex('k-naru', 'Hyppynaru', 'hyppynaru', 2, 1),
    ex('k-avust', 'Avustettu leuanveto laitteessa', 'avustettu-leuanveto-laitteessa', 2, 8),
    ex('k-farm', 'Farmarikävely käsipainoilla', 'farmarikavely-kasipainoilla', 2, 1),
    ex('k-haara', 'Haarahyppy', 'haarahyppy', 2, 20),
    ex('k-penkki', 'Penkkipunnerrus tangolla', 'penkkipunnerrus-tangolla', 2, 5) ] },
  { id: 'day-k2', label: 'Päivä 1', name: 'Viikko 2 · Päivä 1', week: '2', exercises: [
    ex('k2-lankku', 'Lankku', 'lankku', 2, 1),
    ex('k2-dippi', 'Dippi', 'dippi', 2, 8),
    ex('k2-cluster', 'Lankku', 'lankku', 2, 6, { kind: 'cluster' }) ] } ] };
const S = (wt, r, rpe) => { const s = { weight: String(wt), reps: String(r), notes: '', done: true, kind: 'work' }; if(rpe) s.rpe = rpe; return s; };
const OLD_LANKKU = { name: 'Lankku', liikeId: 'lankku', alkuperainenNimi: 'Lankku', kind: 'plain', loggedAt: '2026-10-12T10:00:00.000Z', deload: false, warmups: [],
  plan: { sets: 2, reps: 1, suggestedWeight: null }, sets: [S(0, 1, 8), S(0, 1)] };
const OLD_PENKKI = { name: 'Penkkipunnerrus tangolla', liikeId: 'penkkipunnerrus-tangolla', kind: 'plain', loggedAt: '2026-10-12T10:10:00.000Z', deload: false, warmups: [],
  plan: { sets: 2, reps: 5, suggestedWeight: 80 }, sets: [S(80, 5), S(80, 5)] };
// Vanha (painona ja toistoina) tallennettu merkintä ohjelman rivillä k2-dippi.
const OLD_DIPPI = { name: 'Dippi', liikeId: 'dippi', kind: 'plain', loggedAt: '2026-10-13T10:00:00.000Z', deload: false, warmups: [],
  plan: { sets: 2, reps: 8, suggestedWeight: null }, sets: [S(0, 6, 8), S(0, 6, 9)] };
const ENTRIES = {
  '2026-10-12': { date: '2026-10-12', exercises: { 'old-lankku': OLD_LANKKU, 'old-penkki': OLD_PENKKI } },
  '2026-10-13': { date: '2026-10-13', exercises: { 'k2-dippi': OLD_DIPPI } }
};
const LS = (sets, date) => ({ sets: sets.map(s => ({ weight: s.weight, reps: s.reps, done: true, rpe: s.rpe || null })), date, prior: [], warmups: [] });
const LASTSET = { 'lankku': LS(OLD_LANKKU.sets, '2026-10-12'), 'penkkipunnerrus-tangolla': LS(OLD_PENKKI.sets, '2026-10-12'), 'dippi': LS(OLD_DIPPI.sets, '2026-10-13') };
const MARKER = { versio: '2026-10-19', taulukko: 'ohitetaan', tila: 'palautettu', aika: '2026-10-19T08:00:00.000Z', raportti: null, varmuuskopioLuotu: null };
function store(){
  const o = {
    'treenipk:koekaytto-hyvaksytty': '1', 'treenipk:first-log-hint-dismissed': '1', 'treenipk:rest-timer-enabled': '0',
    'treenipk:app-version': '0.5.0', 'treenipk:changelog-seen': '2026-10-19',
    'treenipk:liike-siirto': JSON.stringify(MARKER),
    'treenipk:workout-program': JSON.stringify(PROGRAM),
    'treenipk:last-set-log': JSON.stringify(LASTSET)
  };
  Object.keys(ENTRIES).forEach(d => { o['treenipk:entries:' + d] = JSON.stringify(ENTRIES[d]); });
  return o;
}
async function seed(page, s, ready){
  await page.goto(BASE + 'manifest.json');
  await page.evaluate(st => { localStorage.clear(); Object.keys(st).forEach(k => localStorage.setItem(k, st[k])); }, s);
  await page.goto(URL);
  await page.waitForSelector(ready || '.bottom-nav', { state: 'attached' }); await w(600);
}
const dump = page => page.evaluate(() => { const o = {}; Object.keys(localStorage).forEach(k => { o[k] = localStorage.getItem(k); }); return o; });
const toast = page => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
// Avaa liikkeen kirjausruudun: suljetaan avoin ruutu, Kaikki-tila ja päivä auki.
async function openEx(page, id){
  if(await page.$('[data-close-ex]')){ await page.click('[data-close-ex]'); await w(450); }
  if(await page.$('[data-week-mode="all"][aria-pressed="false"], [data-week-mode="all"]:not(.on)')){ await page.click('[data-week-mode="all"]').catch(() => null); await w(400); }
  const dayId = PROGRAM.days.find(d => d.exercises.some(e => e.id === id)).id;
  if(!(await page.$('.exercise-name-btn[data-id="' + id + '"]'))){ await page.click('.day-card [data-key="' + dayId + '"]'); await w(450); }
  await page.click('.exercise-name-btn[data-id="' + id + '"]'); await w(650);
}
const ledgerInfo = page => page.evaluate(() => ({
  head: Array.from(document.querySelectorAll('.ledger-row.ledger-head > div')).map(x => x.textContent.trim()),
  fields: Array.from(document.querySelectorAll('.ledger [data-set-field]')).map(i => ({ f: i.dataset.field, v: i.value, ph: i.placeholder, aria: i.getAttribute('aria-label'), span: i.classList.contains('span2') })),
  last: Array.from(document.querySelectorAll('.ledger .set-last[role=img]')).map(x => ({ t: x.textContent, aria: x.getAttribute('aria-label') })),
  target: (document.querySelector('.kirjaus-target') || {}).textContent || '',
  spec: (document.querySelector('.kirjaus-spec') || {}).textContent || '',
  warm: !!document.querySelector('[data-add-warmup]'), vol: !!document.querySelector('[data-volume-row]')
}));
async function markDone(page, id, idx){
  await page.click('[data-toggle-done][data-id="' + id + '"][data-idx="' + idx + '"]'); await w(350);
  if(await page.$('.sheet')){ await page.keyboard.press('Escape'); await w(350); }
}
async function keypadType(page, keys){ for(const k of keys){ await page.click('[data-keypad-key="' + k + '"]'); await w(60); } }
function sectionRows(text, name){
  const lines = text.replace(/^﻿/, '').split('\n');
  const i = lines.findIndex(l => l.trim() === '"' + name + '"');
  if(i === -1) return [];
  const out = [];
  for(let j = i + 1; j < lines.length && !/^"#/.test(lines[j].trim()); j++){ if(lines[j].trim()) out.push(lines[j]); }
  const rows = []; let row = [], f = '', q = false; const t = out.join('\n');
  for(let k = 0; k < t.length; k++){ const ch = t[k];
    if(q){ if(ch === '"'){ if(t[k+1] === '"'){ f += '"'; k++; } else q = false; } else f += ch; }
    else if(ch === '"') q = true; else if(ch === ','){ row.push(f); f = ''; } else if(ch === '\n'){ row.push(f); rows.push(row); row = []; f = ''; } else f += ch; }
  if(f || row.length){ row.push(f); rows.push(row); }
  const head = rows.shift();
  return rows.map(r => { const o = {}; head.forEach((h, k) => o[h] = r[k] || ''); return o; });
}
async function openSettings(page, key){
  if(await page.$('[data-close-ex]')){ await page.click('[data-close-ex]'); await w(450); }
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="' + key + '"]'); await w(450);
}

(async () => {
  const browser = await chromium.launch();
  let ctx, page;

  // ===== A. Apurit =====
  console.log('A. Apurit');
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  page = await newPage(ctx);
  await seed(page, store());
  const a = await page.evaluate(() => {
    const t = window.__t;
    const m = (tapa, side) => t.kirjausMode(tapa, side);
    const v = (set, tapa, side) => t.fmtSetValue(set, m(tapa, side)).text;
    const em = id => { const x = t.exerciseMode(t.findExerciseById(id)); return x.tapa + (x.perSide ? '/puoli' : ''); };
    return {
      parse: ['130', '90', '1:30', '0:90', '1:05:00', '10000', '45', '', '1:', 'abc', '1:2:3:4'].map(x => t.parseTimeText(x)),
      digits: ['9', '90', '905', '0130', '10000', ''].map(x => t.timeTextFromDigits(x)),
      fmt: [90, 45, 3900, 0, '', 'x'].map(x => t.fmtTimeValue(x)),
      unknown: m('Juoksu', false).tapa, fields: m('Matka ja aika').fields.join(','),
      modes: ['k-lankku', 'k-dippi', 'k-soutu', 'k-row', 'k-naru', 'k-avust', 'k-farm', 'k-haara', 'k-penkki', 'k2-cluster'].map(em),
      noLib: t.exerciseMode({ id: 'x', name: 'Oma liike', kind: 'plain' }).tapa,
      stored: [t.storedMode({}).tapa, t.storedMode({ kirjaustapa: 'Aika', toispuolinen: true }).tapa + '/' + t.storedMode({ kirjaustapa: 'Aika', toispuolinen: true }).perSide],
      vals: [
        v({ weight: '82.5', reps: '6' }, 'Paino ja toistot'), v({ weight: '82.5', reps: '6' }, 'Paino ja toistot', true),
        v({ weight: '10', reps: '6' }, 'Lisäpaino ja toistot'), v({ weight: '0', reps: '6' }, 'Lisäpaino ja toistot'), v({ weight: '', reps: '1' }, 'Lisäpaino ja toistot'),
        v({ assist: '20', reps: '8' }, 'Avustus ja toistot'), v({ assist: '', reps: '8' }, 'Avustus ja toistot'),
        v({ reps: '12' }, 'Toistot'), v({ reps: '12' }, 'Toistot', true), v({ time: '90' }, 'Aika'), v({ time: '45' }, 'Aika', true),
        v({ weight: '10', time: '60' }, 'Lisäpaino ja aika'), v({ weight: '0', time: '60' }, 'Lisäpaino ja aika'),
        v({ weight: '40', distance: '20' }, 'Paino ja matka'), v({ distance: '2000', time: '450' }, 'Matka ja aika'), v({ distance: '2000' }, 'Matka ja aika'), v({}, 'Aika')
      ].map(s => s.replace(/[  ]/g, ' '))
    };
  });
  ok(JSON.stringify(a.parse.map(x => isNaN(x) ? null : x)) === JSON.stringify([90, 90, 90, 90, 3900, 3600, 45, null, null, null, null]), 'A1 parseTimeText: ' + JSON.stringify(a.parse));
  ok(JSON.stringify(a.digits) === JSON.stringify(['0:09', '0:90', '9:05', '1:30', '1:00:00', '']), 'A2 timeTextFromDigits: ' + JSON.stringify(a.digits));
  ok(JSON.stringify(a.fmt) === JSON.stringify(['1:30', '0:45', '1:05:00', '0:00', '', '']), 'A3 fmtTimeValue: ' + JSON.stringify(a.fmt));
  ok(a.unknown === 'Paino ja toistot' && a.fields === 'distance,time' && a.noLib === 'Paino ja toistot', 'A4 tuntematon tapa ja kirjaston ulkopuolinen liike = paino ja toistot');
  ok(JSON.stringify(a.modes) === JSON.stringify(['Lisäpaino ja aika', 'Lisäpaino ja toistot', 'Paino ja toistot/puoli', 'Matka ja aika', 'Aika', 'Avustus ja toistot', 'Paino ja matka', 'Toistot', 'Paino ja toistot', 'Paino ja toistot']),
    'A5 liikkeiden kirjaustavat kirjastosta (cluster painona ja toistoina): ' + JSON.stringify(a.modes));
  ok(a.stored[0] === 'Paino ja toistot' && a.stored[1] === 'Aika/true', 'A6 tallennetun merkinnän tapa (puuttuva = paino ja toistot)');
  ok(JSON.stringify(a.vals) === JSON.stringify(['82,5 kg × 6', '82,5 kg × 6/puoli', '+10 kg × 6', '6 toistoa', '1 toisto', 'avustus 20 kg × 8', '8 toistoa',
    '12 toistoa', '12 toistoa/puoli', '1:30', '0:45/puoli', '+10 kg · 1:00', '1:00', '40 kg · 20 m', '2 000 m · 7:30', '2 000 m', '–']), 'A7 fmtSetValue: ' + JSON.stringify(a.vals));
  await ctx.close();

  // ===== B. Kirjausruudun kentät =====
  console.log('B. Kirjausruudun kentät');
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, acceptDownloads: true });
  page = await newPage(ctx);
  await seed(page, store());
  await openEx(page, 'k-lankku');
  let li = await ledgerInfo(page);
  ok(JSON.stringify(li.head.slice(2, 4)) === JSON.stringify(['Lisä kg', 'Aika']) && li.fields.map(f => f.f).join(',') === 'weight,time,weight,time', 'B1 lankku: lisäpaino ja aika: ' + li.head.join('|'));
  ok(li.fields[0].v === '0' && li.fields[1].v === '' && li.fields[1].ph === 'm:ss' && li.fields[0].aria === 'Sarja 1 lisäpaino kiloina' && li.fields[1].aria === 'Sarja 1 aika minuutteina ja sekunteina',
    'B2 lisäpaino 0 vanhasta kerrasta, aikaa ei johdeta toistoista: ' + JSON.stringify(li.fields.slice(0, 2)));
  ok(nb(li.last[0].t) === '0×1RPE 8' && li.last[0].aria === 'Sarja 1 viime kerralla 0 kg × 1, RPE 8 (työläs)', 'B3 Viime: vanha kerta painona ja toistoina: ' + li.last[0].t);
  ok(!li.warm && !li.vol && !/RPE 8/.test(li.target) && /3|2 sarjaa · 1 toisto/.test(li.target), 'B4 ei lämmittelyä, volyymiä eikä RPE-tavoitetta: ' + li.target);
  await page.click('[data-open-sheet="laskenta"]'); await w(400);
  const calc = nb(await page.textContent('.sheet'));
  ok(/kirjaustavalla: lisäpaino ja aika/.test(calc) && /1, 3, 0 on 1:30/.test(calc) && /esitäytetty edelliseltä kerralta 12\.10\./i.test(calc), 'B5 Painojen laskenta kertoo kirjaustavan ja esitäytön');
  await page.keyboard.press('Escape'); await w(300);

  await openEx(page, 'k-dippi');
  li = await ledgerInfo(page);
  ok(li.head[2] === 'Lisä kg' && li.head[3] === 'Toistot' && li.warm && li.vol && li.fields[0].aria === 'Sarja 1 lisäpaino kiloina', 'B6 dippi: lisäpaino ja toistot, lämmittely ja volyymi kuten ennen');
  await openEx(page, 'k-soutu');
  li = await ledgerInfo(page);
  ok(li.head[2] === 'Kg' && nb(li.head[3]) === 'Toistot/puoli' && li.fields[1].aria === 'Sarja 1 toistot puolta kohden' && /10 toistoa\/puoli/.test(li.target) && /3|2 × 10\/puoli/.test(li.spec), 'B7 toispuolinen: toistoa/puoli: ' + li.target + ' | ' + li.spec);
  await openEx(page, 'k-row');
  li = await ledgerInfo(page);
  ok(li.head[2] === 'Matka' && li.head[3] === 'Aika' && li.fields.map(f => f.f).join(',') === 'distance,time' && li.fields[0].aria === 'Sarja 1 matka metreinä', 'B8 soutulaite: matka ja aika');
  await openEx(page, 'k-naru');
  li = await ledgerInfo(page);
  ok(li.head.length === 5 && li.head[2] === 'Aika' && li.fields.every(f => f.f === 'time' && f.span), 'B9 hyppynaru: yksi aikakenttä kahden sarakkeen levyisenä');
  await openEx(page, 'k-avust');
  li = await ledgerInfo(page);
  ok(li.head[2] === 'Avustus' && li.fields[0].f === 'assist' && li.fields[1].v === '8' && !li.warm && /RPE 8/.test(li.target), 'B10 avustettu leuanveto: avustus ja toistot, toistot ohjelmasta');
  await openEx(page, 'k-farm');
  li = await ledgerInfo(page);
  ok(li.head[2] === 'Kg' && li.head[3] === 'Matka' && li.fields.map(f => f.f).join(',') === 'weight,distance,weight,distance', 'B11 farmarikävely: paino ja matka');
  await openEx(page, 'k-haara');
  li = await ledgerInfo(page);
  ok(li.head[2] === 'Toistot' && li.fields.every(f => f.f === 'reps' && f.span && f.v === '20'), 'B12 haarahyppy: pelkät toistot ohjelman tavoitteella');
  await openEx(page, 'k-penkki');
  li = await ledgerInfo(page);
  ok(JSON.stringify(li.head.slice(2, 4)) === JSON.stringify(['Kg', 'Toistot']) && li.fields[0].aria === 'Sarja 1 paino kiloina' && li.fields[1].aria === 'Sarja 1 toistot' && nb(li.last[0].t) === '80×5', 'B13 paino ja toistot ennallaan');

  // ===== C. Näppäimistö =====
  console.log('C. Näppäimistö');
  await openEx(page, 'k-naru');
  await page.click('[data-set-field][data-id="k-naru"][data-idx="0"][data-field="time"]'); await w(300);
  const kp1 = await page.evaluate(() => ({ label: document.getElementById('keypad-label').textContent, comma: document.querySelector('[data-keypad-key=","]').disabled, steps: !!document.querySelector('#keypad [data-weight-step]'), unit: !!document.querySelector('.keypad-unit') }));
  ok(kp1.label === 'Sarja 1 · Aika' && kp1.comma && !kp1.steps && !kp1.unit, 'C1 aikanäppäimistö: ei pilkkua, ±:aa eikä yksikköä: ' + JSON.stringify(kp1));
  await keypadType(page, ['1', '3', '0']);
  let kv = await page.evaluate(() => ({ field: document.querySelector('[data-set-field][data-id="k-naru"][data-idx="0"]').value, read: document.getElementById('keypad-value').textContent, row: window.__t.state.draftSets['k-naru'][0].time }));
  ok(kv.field === '1:30' && kv.read === '1:30' && kv.row === '90', 'C2 1, 3, 0 → 1:30 (90 s): ' + JSON.stringify(kv));
  await keypadType(page, ['back']);
  kv = await page.evaluate(() => ({ field: document.querySelector('[data-set-field][data-id="k-naru"][data-idx="0"]').value, row: window.__t.state.draftSets['k-naru'][0].time }));
  ok(kv.field === '0:13' && kv.row === '13', 'C3 askelpalautin poistaa numeron: ' + JSON.stringify(kv));
  await keypadType(page, ['0', 'next', '9', '0', '5']);
  kv = await page.evaluate(() => ({ r0: window.__t.state.draftSets['k-naru'][0].time, f1: document.querySelector('[data-set-field][data-id="k-naru"][data-idx="1"]').value, r1: window.__t.state.draftSets['k-naru'][1].time }));
  ok(kv.r0 === '90' && kv.f1 === '9:05' && kv.r1 === '545', 'C4 Seuraava siirtyy seuraavan sarjan aikaan; 9, 0, 5 → 9:05: ' + JSON.stringify(kv));
  await page.click('[data-keypad-close]'); await w(300);
  await openEx(page, 'k-row');
  await page.click('[data-set-field][data-id="k-row"][data-idx="0"][data-field="distance"]'); await w(300);
  const kp2 = await page.evaluate(() => ({ label: document.getElementById('keypad-label').textContent, comma: document.querySelector('[data-keypad-key=","]').disabled, unit: (document.querySelector('.keypad-unit') || {}).textContent }));
  await keypadType(page, ['2', '0', '0', '0', 'next']);
  kv = await page.evaluate(() => ({ row: window.__t.state.draftSets['k-row'][0], open: !!document.getElementById('keypad') }));
  ok(kp2.label === 'Sarja 1 · Matka' && !kp2.comma && kp2.unit === 'm' && kv.row.distance === '2000' && !kv.open, 'C5 matka metreinä (pilkku käytössä); Seuraava viimeiseltä riviltä sulkee: ' + JSON.stringify(kp2));
  await page.click('[data-set-field][data-id="k-row"][data-idx="0"][data-field="time"]'); await w(250);
  await keypadType(page, ['7', '3', '0']);
  kv = await page.evaluate(() => window.__t.state.draftSets['k-row'][0]);
  ok(kv.time === '450', 'C6 soutulaitteen aika 7:30 = 450 s');
  await page.click('[data-keypad-close]'); await w(250);
  await openEx(page, 'k-avust');
  await page.click('[data-set-field][data-id="k-avust"][data-idx="0"][data-field="assist"]'); await w(300);
  const kp3 = await page.evaluate(() => ({ label: document.getElementById('keypad-label').textContent, plus: (document.querySelector('#keypad [data-weight-step][data-step="2.5"]') || {}).getAttribute ? document.querySelector('#keypad [data-weight-step][data-step="2.5"]').getAttribute('aria-label') : null }));
  await page.click('#keypad [data-weight-step][data-step="2.5"]'); await w(150);
  await page.click('#keypad [data-weight-step][data-step="2.5"]'); await w(150);
  kv = await page.evaluate(() => ({ row: window.__t.state.draftSets['k-avust'][0].assist, field: document.querySelector('[data-set-field][data-id="k-avust"][data-idx="0"][data-field="assist"]').value, read: document.getElementById('keypad-value').textContent }));
  ok(kp3.label === 'Sarja 1 · Avustus' && kp3.plus === 'Lisää avustusta 2,5 kg' && kv.row === '5' && kv.field === '5', 'C7 avustuksen ±2,5 kg: ' + JSON.stringify([kp3, kv]));
  await page.click('[data-keypad-close]'); await w(250);
  await openEx(page, 'k-soutu');
  await page.click('[data-set-field][data-id="k-soutu"][data-idx="0"][data-field="reps"]'); await w(300);
  ok((await page.textContent('#keypad-label')) === 'Sarja 1 · Toistot/puoli', 'C8 toispuolisen toistot näppäimistön otsakkeessa');
  await page.click('[data-keypad-close]'); await w(250);

  // ===== D. Valmis-ehdot =====
  console.log('D. Valmis-ehdot');
  await openEx(page, 'k-lankku');
  await page.click('[data-toggle-done][data-id="k-lankku"][data-idx="0"]'); await w(300);
  ok(/Syötä aika ennen kuin merkitset sarjan valmiiksi/.test(nb(await toast(page))) && !(await page.$('.sheet')), 'D1 aikaliike ilman aikaa: ilmoitus');
  const elig = await page.evaluate(() => {
    const t = window.__t, e = id => t.findExerciseById(id);
    return [
      t.isRowDoneEligible(e('k-dippi'), { weight: '', reps: '8', kind: 'work' }), t.isRowDoneEligible(e('k-dippi'), { weight: '10', reps: '', kind: 'work' }),
      t.isRowDoneEligible(e('k-avust'), { assist: '', reps: '8', kind: 'work' }), t.isRowDoneEligible(e('k-haara'), { reps: '', kind: 'work' }),
      t.isRowDoneEligible(e('k-farm'), { weight: '40', distance: '', kind: 'work' }), t.isRowDoneEligible(e('k-farm'), { weight: '40', distance: '20', kind: 'work' }),
      t.isRowDoneEligible(e('k-row'), { distance: '', time: '300', kind: 'work' }), t.isRowDoneEligible(e('k-row'), { distance: '500', time: '', kind: 'work' }), t.isRowDoneEligible(e('k-row'), { distance: '', time: '', kind: 'work' }),
      t.isRowDoneEligible(e('k-naru'), { time: '0', kind: 'work' }), t.isRowDoneEligible(e('k-penkki'), { weight: '', reps: '5', kind: 'work' })
    ];
  });
  ok(JSON.stringify(elig) === JSON.stringify([true, false, true, false, false, true, true, true, false, false, false]), 'D2 valmis-ehdot kirjaustavoittain: ' + JSON.stringify(elig));
  await openEx(page, 'k-farm');
  await page.click('[data-set-field][data-id="k-farm"][data-idx="0"][data-field="weight"]'); await w(250);
  await keypadType(page, ['4', '0']);
  await page.click('[data-keypad-close]'); await w(250);
  await page.click('[data-toggle-done][data-id="k-farm"][data-idx="0"]'); await w(300);
  ok(/Syötä paino ja matka ennen kuin merkitset sarjan valmiiksi/.test(nb(await toast(page))), 'D3 paino ja matka: molemmat');

  // ===== E. Tallennus, Historia ja seuraava kerta =====
  console.log('E. Tallennus');
  await openEx(page, 'k-lankku');
  await page.click('[data-set-field][data-id="k-lankku"][data-idx="0"][data-field="time"]'); await w(250);
  await keypadType(page, ['1', '0', '0', 'next', '1', '1', '5']);
  await page.click('[data-keypad-close]').catch(() => null); await w(250);
  await page.click('[data-toggle-done][data-id="k-lankku"][data-idx="0"]'); await w(350);
  const rpeSheet = await page.evaluate(() => ({ q: document.querySelector('.rpe-sheet-q').textContent, prompt: document.querySelector('.rpe-sheet-prompt').textContent,
    desc: Array.from(document.querySelectorAll('.rpe-pick-desc')).map(x => x.textContent), target: !!document.querySelector('.rpe-target') }));
  ok(nb(rpeSheet.q) === 'Lankku · 1:00' && rpeSheet.prompt === 'Kuinka raskas sarja oli?' && rpeSheet.desc[2] === 'Vähän varaa jäljellä' && !rpeSheet.target, 'E1 RPE-ikkuna aikaliikkeelle: ' + JSON.stringify(rpeSheet));
  await page.click('[data-warmup-rpe][data-rpe="8"]'); await w(350);
  await markDone(page, 'k-lankku', 1);
  await page.click('[data-save-ex][data-id="k-lankku"]'); await w(900);
  let st = await dump(page);
  const today = JSON.parse(st['treenipk:entries:2026-10-20'] || '{}').exercises || {};
  const rl = today['k-lankku'];
  ok(rl && rl.kirjaustapa === 'Lisäpaino ja aika' && !rl.toispuolinen && rl.sets.length === 2 && rl.sets[0].time === '60' && rl.sets[1].time === '75' && rl.sets[0].weight === '0' && rl.sets[0].rpe === 8 && rl.sets[0].reps === undefined,
    'E2 merkintä: kirjaustapa, aika sekunteina, lisäpaino, ei toistoja: ' + JSON.stringify(rl && rl.sets));
  const lsl = JSON.parse(st['treenipk:last-set-log']).lankku;
  ok(lsl.kirjaustapa === 'Lisäpaino ja aika' && lsl.sets[0].time === '60' && lsl.prior[0].date === '2026-10-12' && !lsl.prior[0].kirjaustapa, 'E3 painoehdotuksen kerta tallentaa tavan; vanha kerta ennallaan');
  ok(st['treenipk:entries:2026-10-12'] === JSON.stringify(ENTRIES['2026-10-12']) && st['treenipk:entries:2026-10-13'] === JSON.stringify(ENTRIES['2026-10-13']), 'E4 vanhat merkinnät täsmälleen ennallaan');
  // Toispuolinen ja matka ja aika
  await openEx(page, 'k-soutu');
  for(const idx of [0, 1]){
    await page.click('[data-set-field][data-id="k-soutu"][data-idx="' + idx + '"][data-field="weight"]'); await w(200);
    await keypadType(page, ['2', '2', ',', '5']);
    await page.click('[data-keypad-close]'); await w(200);
    await markDone(page, 'k-soutu', idx);
  }
  await page.click('[data-save-ex][data-id="k-soutu"]'); await w(900);
  await openEx(page, 'k-row');
  await markDone(page, 'k-row', 0);
  await page.click('[data-save-ex][data-id="k-row"]'); await w(900);
  await openEx(page, 'k-dippi');
  await page.evaluate(() => { const r = window.__t.state.draftSets['k-dippi']; r.forEach(x => { if(x.kind === 'work'){ x.weight = ''; } }); });
  await markDone(page, 'k-dippi', 0); await markDone(page, 'k-dippi', 1);
  await page.click('[data-save-ex][data-id="k-dippi"]'); await w(900);
  st = await dump(page);
  const td = JSON.parse(st['treenipk:entries:2026-10-20']).exercises;
  ok(td['k-soutu'].toispuolinen === true && !td['k-soutu'].kirjaustapa && td['k-soutu'].sets[0].weight === '22,5' && td['k-soutu'].sets[0].reps === '10', 'E5 toispuolinen merkintä: toispuolinen, ei kirjaustapaa');
  ok(td['k-row'].kirjaustapa === 'Matka ja aika' && td['k-row'].sets[0].distance === '2000' && td['k-row'].sets[0].time === '450', 'E6 soutulaite: matka ja aika');
  ok(td['k-dippi'].kirjaustapa === 'Lisäpaino ja toistot' && td['k-dippi'].sets.length === 2 && td['k-dippi'].sets[0].weight === '' && td['k-dippi'].sets[0].reps === '8', 'E7 dippi ilman lisäpainoa');
  // Historia
  if(await page.$('[data-close-ex]')){ await page.click('[data-close-ex]'); await w(400); }
  await page.click('[data-tab="historia"]'); await w(700);
  await page.click('[data-history-date][data-date="2026-10-20"]'); await w(500);
  const hist = await page.evaluate(() => Array.from(document.querySelectorAll('.history-set')).map(x => x.getAttribute('aria-label')));
  ok(hist.indexOf('Sarja 1: 1:00, RPE 8') !== -1 && hist.indexOf('Sarja 2: 1:15') !== -1 && hist.indexOf('Sarja 1: 22,5 kg × 10/puoli') !== -1 && hist.some(h => /^Sarja 1: 2 000 m · 7:30$/.test(nb(h))) && hist.indexOf('Sarja 1: 8 toistoa') !== -1,
    'E8 Historia kirjaustavan mukaan: ' + JSON.stringify(hist));
  await page.click('[data-history-date][data-date="2026-10-20"]'); await w(300);
  await page.click('[data-history-date][data-date="2026-10-12"]'); await w(500);
  const histOld = await page.evaluate(() => Array.from(document.querySelectorAll('.history-set')).map(x => x.getAttribute('aria-label')));
  ok(histOld.indexOf('Sarja 1: 0 kg × 1, RPE 8') !== -1 && histOld.indexOf('Sarja 1: 80 kg × 5') !== -1, 'E9 vanha lankku Historiassa painona ja toistoina: ' + JSON.stringify(histOld));
  // Uudelleenavaus: tallennettu merkintä kirjaustavallaan
  await page.click('[data-tab="ohjelma"]'); await w(600);
  await openEx(page, 'k-lankku');
  li = await ledgerInfo(page);
  ok(li.head[2] === 'Lisä kg' && li.head[3] === 'Aika' && li.fields[1].v === '1:00' && li.fields[3].v === '1:15', 'E10 tallennettu merkintä avautuu ajan kanssa');
  // Seuraava kerta (viikko 2): Viime ja esitäyttö uudesta kerrasta
  await openEx(page, 'k2-lankku');
  li = await ledgerInfo(page);
  ok(li.fields[1].v === '1:00' && li.fields[3].v === '1:15' && li.fields[0].v === '0' && nb(li.last[0].t) === '1:00RPE 8' && li.last[0].aria === 'Sarja 1 viime kerralla 1:00, RPE 8 (työläs)', 'E11 seuraava kerta: aika esitäytetään ja Viime näyttää ajan: ' + JSON.stringify(li.last[0]));
  // Vanha merkintä korjataan vanhalla tavalla
  await openEx(page, 'k2-dippi');
  li = await ledgerInfo(page);
  ok(li.head[2] === 'Kg' && li.head[3] === 'Toistot' && li.fields[0].v === '0' && li.fields[1].v === '6', 'E12 vanha tallennettu merkintä avautuu painona ja toistoina');
  await page.click('[data-set-field][data-id="k2-dippi"][data-idx="1"][data-field="reps"]'); await w(250);
  await keypadType(page, ['7']);
  await page.click('[data-keypad-close]'); await w(250);
  await page.click('[data-save-ex][data-id="k2-dippi"]'); await w(900);
  st = await dump(page);
  const fixed = JSON.parse(st['treenipk:entries:2026-10-13']).exercises['k2-dippi'];
  ok(fixed.sets[1].reps === '7' && fixed.kirjaustapa === undefined && fixed.editedAt, 'E13 korjaus säilyy painona ja toistoina (ei kirjaustapaa)');
  // Cluster: painona ja toistoina
  await openEx(page, 'k2-cluster');
  li = await ledgerInfo(page);
  ok(li.head[2] === 'Kg' && !!(await page.$('[data-cluster-step]')), 'E14 cluster kirjataan painona ja toistoina');

  // ===== F. Varmuuskopio =====
  console.log('F. Varmuuskopio');
  await openSettings(page, 'varmuuskopio');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  const mrows = sectionRows(csv, '#MERKINNÄT');
  const head = Object.keys(mrows[0] || {});
  ok(JSON.stringify(head.slice(-5)) === JSON.stringify(['Kirjaustapa', 'Toispuolinen', 'Aika (s)', 'Matka (m)', 'Avustus (kg)']), 'F1 uudet sarakkeet viimeisinä: ' + head.slice(-5).join(', '));
  const lr = mrows.filter(r => r['Tunniste'] === 'k-lankku');
  const sr = mrows.filter(r => r['Tunniste'] === 'k-soutu');
  const oldr = mrows.filter(r => r['Tunniste'] === 'old-lankku');
  ok(lr.length === 2 && lr[0]['Kirjaustapa'] === 'Lisäpaino ja aika' && lr[0]['Aika (s)'] === '60' && lr[0]['Paino (kg)'] === '0' && lr[0]['Toistot'] === '', 'F2 lankun rivit: aika sekunteina');
  ok(sr[0]['Toispuolinen'] === 'kyllä' && sr[0]['Kirjaustapa'] === '' && oldr[0]['Kirjaustapa'] === '' && oldr[0]['Toistot'] === '1' && oldr[0]['Aika (s)'] === '', 'F3 toispuolisuus ja vanha merkintä ennallaan');
  const rr = mrows.find(r => r['Tunniste'] === 'k-row');
  ok(rr['Matka (m)'] === '2000' && rr['Aika (s)'] === '450', 'F4 matka ja aika');
  // Palautus tyhjälle laitteelle
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const p2 = await newPage(ctx2);
  await seed(p2, { 'treenipk:koekaytto-hyvaksytty': '1', 'treenipk:first-log-hint-dismissed': '1' }, '#import-entries-input');
  await p2.setInputFiles('#import-entries-input', { name: 'k.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await w(800);
  await p2.click('[data-restore-confirm]'); await w(1500);
  const s2 = await dump(p2);
  const imp = JSON.parse(s2['treenipk:entries:2026-10-20']).exercises;
  const impOld = JSON.parse(s2['treenipk:entries:2026-10-12']).exercises['old-lankku'];
  ok(imp['k-lankku'].kirjaustapa === 'Lisäpaino ja aika' && imp['k-lankku'].sets[0].time === '60' && imp['k-soutu'].toispuolinen === true && imp['k-row'].sets[0].distance === '2000' && imp['k-row'].sets[0].time === '450',
    'F5 palautus: kirjaustapa, toispuolisuus, aika ja matka');
  ok(!impOld.kirjaustapa && impOld.sets[0].reps === '1' && impOld.sets[0].time === undefined, 'F6 vanha merkintä palautuu painona ja toistoina');
  const lsImp = JSON.parse(s2['treenipk:last-set-log']).lankku;
  ok(lsImp.kirjaustapa === 'Lisäpaino ja aika' && lsImp.sets[0].time === '60' && !lsImp.prior[0].kirjaustapa, 'F7 painoehdotuksen ketju rakennetaan kirjaustapoineen');
  // Sama tiedosto uudelleen: kaikki ohitetaan (kaksoistunniste sisältää ajan ja matkan)
  await p2.click('[data-tab="asetukset"]'); await w(400);
  await p2.click('[data-settings-section="varmuuskopio"]'); await w(400);
  await p2.setInputFiles('#import-entries-input', { name: 'k.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await w(800);
  if(await p2.$('[data-restore-confirm]')){ await p2.click('[data-restore-confirm]'); }
  await w(1500);
  const t2 = nb(await toast(p2));
  ok(/0 merkintää \(ohitettu \d+ jo olemassa olevaa\)/.test(t2), 'F8 uudelleentuonti ohittaa kaikki: ' + t2);
  // Eri aika samalle päivälle ei ole kaksoiskappale
  const csv2 = csv.split('\n').map(l => (l.indexOf('"k-lankku"') !== -1 && l.indexOf('"2026-10-20","Lankku","1"') === 0) ? l.replace('"Lisäpaino ja aika","","60"', '"Lisäpaino ja aika","","61"') : l).join('\n');
  ok(csv2 !== csv, 'F9a muokattu tiedosto');
  if(!(await p2.$('#import-entries-input'))){ await p2.click('[data-tab="asetukset"]'); await w(400); await p2.click('[data-settings-section="varmuuskopio"]'); await w(400); }
  await p2.setInputFiles('#import-entries-input', { name: 'k2.csv', mimeType: 'text/csv', buffer: Buffer.from(csv2, 'utf8') });
  await w(800);
  if(await p2.$('[data-restore-confirm]')){ await p2.click('[data-restore-confirm]'); }
  await w(1500);
  ok(/[^0-9]1 merkintä \(ohitettu \d+ jo olemassa olevaa\)/.test(nb(await toast(p2))), 'F9 eri aika tuodaan omana merkintänään: ' + nb(await toast(p2)));
  await ctx2.close();

  // ===== G. Kehitys, Muutokset ja Ohje =====
  console.log('G. Kehitys ja tekstit');
  await page.click('[data-settings-back]'); await w(300);
  await page.click('[data-tab="kehitys"]'); await w(900);
  await page.evaluate(() => { const b = document.querySelector('[data-kehitys-front-tab="liikkeet"]'); if(b) b.click(); }); await w(500);
  const keh = nb(await page.textContent('#app'));
  ok(/Penkkipunnerrus tangolla/.test(keh) && !/Lankku/.test(keh) && !/Soutulaite/.test(keh), 'G1 Kehitys: aikaliikkeet eivät tuota 1RM-sarjaa');
  await page.click('[data-tab="asetukset"]'); await w(400);
  await page.click('[data-settings-section="muutokset"]'); await w(400);
  const ch = nb(await page.textContent('#app'));
  ok(/versio 0\.5\.1/.test(ch) && /1, 3, 0 on 1:30/.test(ch) && /toistoa\/puoli/.test(ch) && /Aika \(s\), Matka \(m\) ja Avustus \(kg\)/.test(ch), 'G2 Muutokset kertoo kirjaustavasta');
  await page.click('[data-settings-back]'); await w(300);
  await page.click('[data-tab="ohje"]'); await w(500);
  const oh = nb(await page.textContent('#app'));
  ok(/Kirjaustapa tulee liikekirjastosta/.test(oh) && /lankku lisäpainona ja aikana/.test(oh) && /vanhat merkinnät näkyvät ja viedään sellaisina kuin ne kirjattiin/.test(oh), 'G3 Ohje kertoo kirjaustavasta');
  await ctx.close();

  // ===== H. Simulointi =====
  console.log('H. Simulointi');
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  page = await newPage(ctx);
  const simStore = store();
  delete simStore['treenipk:entries:2026-10-12']; delete simStore['treenipk:entries:2026-10-13']; delete simStore['treenipk:last-set-log'];
  await seed(page, simStore);
  await page.click('[data-tab="asetukset"]'); await w(400);
  await page.click('[data-settings-section="lisaa"]'); await w(400);
  await page.click('#simulation-toggle-btn'); await w(2000);
  const sim = await dump(page);
  const simEntries = Object.keys(sim).filter(k => k.indexOf('treenipk:entries:') === 0).map(k => JSON.parse(sim[k]));
  const simL = simEntries.map(e => e.exercises['k-lankku']).filter(Boolean)[0];
  const simR = simEntries.map(e => e.exercises['k-row']).filter(Boolean)[0];
  const simP = simEntries.map(e => e.exercises['k-penkki']).filter(Boolean)[0];
  ok(simL && simL.kirjaustapa === 'Lisäpaino ja aika' && simL.sets[0].weight === '0' && Number(simL.sets[0].time) >= 60 && simR.sets[0].distance && simR.sets[0].time && simP.sets[0].weight && simP.sets[0].reps === '5' && !simP.kirjaustapa,
    'H1 simulointi kirjaustavan mukaan: ' + JSON.stringify([simL && simL.sets[0], simR && simR.sets[0], simP && simP.sets[0]]));
  await ctx.close();

  // ===== I. Leveys ja axe =====
  console.log('I. 360 px ja axe');
  ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  page = await newPage(ctx);
  await seed(page, store());
  const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  for(const id of ['k-row', 'k-soutu', 'k-naru']){
    await openEx(page, id);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // Kirjaustavan sarakeotsikot (Viime on alle 375 px:n näytöllä vain
    // ruudunlukijalle; Sarja-otsikko ei kuulu tähän muutokseen).
    const head = await page.evaluate(() => Array.from(document.querySelectorAll('.ledger-row.ledger-head > div.head-center:not(.set-last)')).map(d => { const r = d.getBoundingClientRect(); return { t: d.textContent, fit: d.scrollWidth <= Math.ceil(r.width) + 1, sw: d.scrollWidth, w: Math.round(r.width) }; }));
    ok(over <= 0 && head.every(h => h.fit), 'I1 ' + id + ' 360 px: ei vaakavieritystä, otsikot mahtuvat: ' + over + ' ' + JSON.stringify(head.filter(h => !h.fit)));
    await page.addScriptTag({ content: axeSrc }).catch(() => null);
    const ax = await page.evaluate(async () => { const r = await axe.run(document.querySelector('#app'), { runOnly: ['wcag2a', 'wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
    ok(ax.length === 0, 'I2 axe ' + id + ': ' + JSON.stringify(ax));
  }
  await ctx.close();

  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
