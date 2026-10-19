// Uusi liikekirjasto ja treenihistorian siirto tunnisteisiin (0.5.0).
// Kattaa: kirjaston generoinnin (448 liikettä, tunnisteet, näyttönimet,
// haku muilla ja englanninkielisillä nimillä), siirron puhtaan ytimen
// (migrateLiikeData) jokaiselle nimimuunnosten sovellusriville, määrien,
// painojen, toistojen ja 1RM-arvojen säilymisen, idempotenssin, ennalleen
// jäävät nimet ja yhdistyvät tiedot sekä käyttöliittymän kautta automaattisen
// siirron käynnistyksessä, varmuuskopion (laitteen kopio, JSON-tiedosto,
// epäonnistunut tallennus), CSV-viennin uusilla nimillä, vanhan ja uuden
// varmuuskopion palautuksen, painoehdotuksen ja 1RM-pohjan jatkuvuuden sekä
// Asetusten Liikekirjasto-osion (axe). Sisäiset funktiot luetaan kuten
// test_1rm_tuntuma.js:ssä: reitityksessä tarjoiltu index.html, jonka
// sulkeuman loppuun on lisätty window.__t.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://127.0.0.1:8765/';
const URL = BASE + 'index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const nb = s => s == null ? s : String(s).replace(/[  ]/g, ' ');

// ---------- lähdedata ----------
function parseCSV(text){
  const rows = []; let row = [], f = '', q = false;
  text = text.replace(/^﻿/, '');
  for(let i = 0; i < text.length; i++){
    const ch = text[i];
    if(q){ if(ch === '"'){ if(text[i+1] === '"'){ f += '"'; i++; } else q = false; } else f += ch; }
    else if(ch === '"') q = true;
    else if(ch === ','){ row.push(f); f = ''; }
    else if(ch === '\n'){ row.push(f); rows.push(row); row = []; f = ''; }
    else if(ch !== '\r') f += ch;
  }
  if(f || row.length){ row.push(f); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length > 1).map(r => { const o = {}; head.forEach((h, k) => o[h] = (r[k] || '').trim()); return o; });
}
const DATA = path.join(__dirname, '..', 'data', 'liikekirjasto');
const LIB_CSV = parseCSV(fs.readFileSync(path.join(DATA, 'liikekirjasto_v19.10.2026.csv'), 'utf8'));
const MAP_CSV = parseCSV(fs.readFileSync(path.join(DATA, 'nimimuunnokset_v19.10.2026.csv'), 'utf8'))
  .filter(r => r['Lähde'] === 'Treenipäiväkirja ja -ohjelmat 23.9.2026');

const EXPOSE = ['LIIKEKIRJASTO', 'LIIKEKIRJASTO_VERSIO', 'NIMIMUUNNOKSET', 'migrateLiikeData', 'liikeById', 'liikeByName',
  'nimimuunnosFor', 'catalogPartsFor', 'baseExerciseName', 'exerciseKeyOf', 'resolveLiikeForName', 'renderExercisePickList',
  'findExerciseById', 'buildDraftRows', 'ledgerLastSession', 'renderHistoryExercise', 'oneRepMaxKeyFor', 'exerciseRecognition', 'kehitysKeyFor', 'state'];
function instrumentedHtml(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const marker = '})();\n</script>';
  const i = html.lastIndexOf(marker);
  if(i === -1) throw new Error('index.html: sovelluksen sulkeuman loppua ei löytynyt');
  const hook = 'window.__t = {' + EXPOSE.map(n => JSON.stringify(n) + ': (typeof ' + n + ' !== "undefined" ? ' + n + ' : null)').join(', ') + '};\n';
  return html.slice(0, i) + hook + html.slice(i);
}
async function newPage(context, opts){
  const page = await context.newPage();
  page.on('pageerror', e => { fails++; console.log('  FAIL pageerror: ' + e.message); });
  if(opts && opts.instrumented){
    const body = instrumentedHtml();
    await page.route('**/index.html', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  }
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
  return page;
}

// ---------- vanhan version tila (vanhat nimet) ----------
const OLD_BENCH = 'Penkkipunnerrus tangolla, Suora tanko';
function intensity(t){
  if(!t) return null;
  if(/^max$/i.test(t)) return { isMax: true, percents: [] };
  return { isMax: false, percents: (t.match(/\d+(?:[.,]\d+)?/g) || []).map(Number) };
}
function ex(id, name, sets, reps, teho, extra){
  return Object.assign({ id, name, sets, reps, unit: '', weight: '', notes: teho || '', intensity: intensity(teho), kind: 'plain', autoCalc: true }, extra || {});
}
const PROGRAM = { id: 'prog-1', name: 'Syksy', weeks: ['1', '2'], weekLabels: {}, days: [
  { id: 'day-1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [
    ex('ex-1', OLD_BENCH, '1', '1', 'MAX'),
    ex('ex-2', 'Pysäytyspenkkipunnerrus tangolla, Suora tanko', '3', '5', '80 %', { maxRef: OLD_BENCH }),
    ex('ex-3', 'Sivunosto taljassa', '3', '10', ''),
    ex('ex-4', 'Takavipunosto laitteessa istuen', '3', '12', ''),
    ex('ex-5', 'PC: Cardiolaite / Punnerrus / Burpee (12 min)', '1', '1', '') ] },
  { id: 'day-2', label: 'Päivä 1', name: 'Viikko 2 · Päivä 1', week: '2', exercises: [
    ex('ex-6', 'Ojentajadippi', '3', '8', ''),
    ex('ex-7', OLD_BENCH, '3', '5', '85 %'),
    ex('ex-8', 'V-jalkojen nosto', '3', '10', ''),
    ex('ex-9', 'PC: V-jalkojen nosto', '3', '12', '') ] } ] };
const LIBRARY = [{ id: 'prog-2', name: 'Kevät', weeks: ['1'], weekLabels: {}, days: [
  { id: 'day-3', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [
    ex('ex-20', 'Bulgarialainen askelkyykky käsipainoilla', '3', '8', ''),
    ex('ex-21', 'Hack-kyykky kelkalla', '3', '10', '') ] }] }];
const S = (wt, r, rpe) => { const s = { weight: String(wt), reps: String(r), notes: '', done: true, kind: 'work' }; if(rpe) s.rpe = rpe; return s; };
function rec(name, sets, at, extra){
  return Object.assign({ name, sets, loggedAt: at, deload: false, warmups: [], plan: { sets: sets.length, reps: 10, suggestedWeight: null }, kind: 'plain' }, extra || {});
}
const ENTRIES = {
  '2026-10-01': { date: '2026-10-01', exercises: {
    'ex-1': rec(OLD_BENCH, [S(100, 1, 9)], '2026-10-01T16:00:00.000Z', { warmups: [{ weight: '60', reps: '5', rpe: 6 }, { weight: '80', reps: '3', rpe: 7 }] }),
    'ex-3': rec('Sivunosto taljassa', [S(20, 10, 8), S(20, 10, 8), S(20, 10, 9)], '2026-10-01T16:20:00.000Z'),
    'ex-4': rec('Takavipunosto laitteessa istuen', [S(15, 12)], '2026-10-01T16:30:00.000Z'),
    'ex-5': rec('PC: Cardiolaite / Punnerrus / Burpee (12 min)', [{ weight: '', reps: '12', notes: 'kova', done: true, kind: 'work' }], '2026-10-01T16:40:00.000Z') } },
  '2026-10-03': { date: '2026-10-03', exercises: {
    'ex-6': rec('Ojentajadippi', [S(10, 8), S(10, 8), S(10, 7)], '2026-10-03T16:00:00.000Z', { deload: true }),
    'ex-8': rec('V-jalkojen nosto', [S('', 10), S('', 10)], '2026-10-03T16:10:00.000Z') } },
  '2026-10-05': { date: '2026-10-05', exercises: {
    'ex-9': rec('PC: V-jalkojen nosto', [S('', 12), S('', 12)], '2026-10-05T16:10:00.000Z', { deload: true, deloadKind: 'pyydetty' }) } }
};
const LS = (sets, date, extra) => Object.assign({ sets: sets.map(s => ({ weight: s.weight, reps: s.reps, done: true, rpe: s.rpe || null })), date, prior: [], warmups: [] }, extra || {});
const LASTSET = {
  'penkkipunnerrus tangolla, suora tanko': LS(ENTRIES['2026-10-01'].exercises['ex-1'].sets, '2026-10-01', { warmups: [{ weight: '60', reps: '5', rpe: 6 }, { weight: '80', reps: '3', rpe: 7 }] }),
  'sivunosto taljassa': LS(ENTRIES['2026-10-01'].exercises['ex-3'].sets, '2026-10-01'),
  'takavipunosto laitteessa istuen': LS(ENTRIES['2026-10-01'].exercises['ex-4'].sets, '2026-10-01'),
  'ojentajadippi': LS(ENTRIES['2026-10-03'].exercises['ex-6'].sets, '2026-10-03', { deload: true }),
  'v-jalkojen nosto': LS(ENTRIES['2026-10-03'].exercises['ex-8'].sets, '2026-10-03'),
  'pc: v-jalkojen nosto': LS(ENTRIES['2026-10-05'].exercises['ex-9'].sets, '2026-10-05', { deload: true, deloadKind: 'pyydetty' })
};
const MANUALMAX = {
  'penkkipunnerrus tangolla, suora tanko': { weight: 100, date: '2026-10-01' },
  'v-jalkojen nosto': { weight: 10, date: '2026-09-01' },
  'pc: v-jalkojen nosto': { weight: 12, date: '2026-10-05' },
  'takavipunosto laitteessa istuen': { weight: 50, date: '2026-10-01' }
};
function oldStore(){
  const o = {
    'treenipk:koekaytto-hyvaksytty': '1', 'treenipk:first-log-hint-dismissed': '1', 'treenipk:rest-timer-enabled': '0',
    'treenipk:app-version': '0.4.32',
    'treenipk:workout-program': JSON.stringify(PROGRAM),
    'treenipk:programs': JSON.stringify(LIBRARY),
    'treenipk:last-set-log': JSON.stringify(LASTSET),
    'treenipk:manual-1rm': JSON.stringify(MANUALMAX)
  };
  Object.keys(ENTRIES).forEach(d => { o['treenipk:entries:' + d] = JSON.stringify(ENTRIES[d]); });
  return o;
}
async function seed(page, store, ready){
  await page.goto(BASE + 'manifest.json');
  await page.evaluate(s => { localStorage.clear(); Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); }, store);
  await page.goto(URL);
  await page.waitForSelector(ready || '.bottom-nav', { state: 'attached' }); await w(600);
}
// Tyhjä laite: aloitusruutu, jossa varmuuskopion palautus on mukana.
const EMPTY = { 'treenipk:koekaytto-hyvaksytty': '1', 'treenipk:first-log-hint-dismissed': '1' };
// Vähimmäisohjelma ilman taulukon nimiä (Asetukset käytettävissä).
const MINI = Object.assign({ 'treenipk:workout-program': JSON.stringify({ id: 'prog-9', name: 'Mini', weeks: ['1'], weekLabels: {}, days: [{ id: 'day-9', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [ex('ex-90', 'Oma liike', '3', '10', '')] }] }) }, EMPTY);
const dump = page => page.evaluate(() => { const o = {}; Object.keys(localStorage).forEach(k => { o[k] = localStorage.getItem(k); }); return o; });
const toast = page => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
async function openSettings(page, key){
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="' + key + '"]'); await w(450);
}
function sectionRows(text, name){
  const lines = text.replace(/^﻿/, '').split('\n');
  const i = lines.findIndex(l => l.trim() === '"' + name + '"');
  if(i === -1) return [];
  const out = [];
  for(let j = i + 1; j < lines.length && !/^"#/.test(lines[j].trim()); j++){ if(lines[j].trim()) out.push(lines[j]); }
  return parseCSV(out.join('\n'));
}
function csvLine(arr){ return arr.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(','); }
// Vanhan version (0.4.32) vientimuoto ilman Liiketunniste-sarakkeita.
function oldBackupCsv(){
  const out = ['"#MERKINNÄT"', '', csvLine(['Päivämäärä','Liike','Sarja','Paino (kg)','Toistot','Huomiot','Tyyppi','Tunniste','Tuntuma','Osasarjat','Kevennys'])];
  Object.keys(ENTRIES).forEach(d => Object.keys(ENTRIES[d].exercises).forEach(k => {
    const r = ENTRIES[d].exercises[k];
    r.sets.forEach((s, i) => out.push(csvLine([d, r.name, i + 1, s.weight, s.reps, s.notes, 'plain', k, '', '', r.deload ? (r.deloadKind ? 'pyydetty' : 'automaattinen') : ''])));
  }));
  out.push('', '"#1RM"', '', csvLine(['Liike','1RM (kg)','Päivitetty']));
  out.push(csvLine([OLD_BENCH, '100', '2026-10-01']));
  return out.join('\n');
}

(async () => {
  const browser = await chromium.launch();

  // ===== A. Kirjasto ja nimimuunnokset =====
  console.log('A. Kirjasto');
  let ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  let page = await newPage(ctx, { instrumented: true });
  await seed(page, MINI);
  const lib = await page.evaluate(() => ({ rows: window.__t.LIIKEKIRJASTO, map: window.__t.NIMIMUUNNOKSET, ver: window.__t.LIIKEKIRJASTO_VERSIO }));
  ok(lib.rows.length === 448 && LIB_CSV.length === 448, 'A1 448 liikettä (CSV ' + LIB_CSV.length + ', sovellus ' + lib.rows.length + ')');
  ok(new Set(lib.rows.map(r => r.id)).size === 448 && lib.rows.every(r => /^[a-z0-9-]+$/.test(r.id)), 'A2 tunnisteet yksilöllisiä ja ASCII');
  const csvById = {}; LIB_CSV.forEach(r => { csvById[r['Tunniste']] = r; });
  const colsOk = lib.rows.every(r => {
    const c = csvById[r.id];
    return c && c['Näyttönimi'] === r.nimi && c['Liikkeen nimi'] === r.liike && (c['Variaatio (esim etu, taka)'] || null) === r.variaatio &&
      (c['Lisävariaatio'] || null) === r.lisavariaatio && c['Lihasryhmä'] === r.lihasryhma && c['Avustavat lihasryhmät'] === r.avustavat &&
      c['Liikeperhe'] === r.liikeperhe && c['Liikemalli'] === r.liikemalli && c['Väline'] === r.valine && c['Harjoitustyyppi'] === r.harjoitustyyppi &&
      c['Kirjaustapa'] === r.kirjaustapa && (c['Toispuolinen'] === 'Kyllä') === r.toispuolinen && c['Englanninkielinen nimi'] === r.englanti &&
      c['Muut nimet'] === r.muutNimet && c['Huomio'] === r.huomio;
  });
  ok(colsOk, 'A3 kaikki 16 saraketta säilyvät rivillä');
  ok(lib.map.length === 45 && MAP_CSV.length === 45, 'A4 45 sovelluksen nimimuunnosta');
  const mapOk = MAP_CSV.every(r => {
    const m = lib.map.find(x => x.vanha === r['Vanha nimi (nimi | variaatio | lisävariaatio)']);
    const id = (r['Uusi tunniste'] === '–' || !r['Uusi tunniste']) ? null : r['Uusi tunniste'];
    return m && m.id === id && m.toimenpide === r['Toimenpide'];
  });
  ok(mapOk, 'A5 sovelluksen taulukko vastaa CSV:tä riveittäin');
  ok(lib.ver === '2026-10-19', 'A6 versio');
  const parts = await page.evaluate(() => {
    const t = window.__t;
    const p = n => { const x = t.catalogPartsFor(n); return x ? [x.liike, x.details.join(' · '), x.id] : null; };
    return {
      bench: p('Penkkipunnerrus tangolla'), curl: p('Hauiskääntö tangolla myötäotteella, Scott-tanko'), hihnat: p('Hauiskääntö taljassa, Hihnat'),
      unknown: p('Kyykky tangolla 2 s pysäytyksellä, Suora tanko'),
      g1: t.baseExerciseName('Hauiskääntö taljassa, Hihnat') === t.baseExerciseName('Hauiskääntö taljassa, Scott-kahva'),
      g2: t.baseExerciseName('Ristikkäistalja keskeltä') !== t.baseExerciseName('Ristikkäistalja alhaalta ylös'),
      g3: t.baseExerciseName('Kulmasoutu tangolla, Suora tanko') !== t.baseExerciseName('Kulmasoutu tangolla vastaotteella, Suora tanko'),
      byName: (t.liikeByName('  penkkipunnerrus TANGOLLA ') || {}).id,
      byOld: (t.nimimuunnosFor('Sivunosto taljassa') || {}).id
    };
  });
  ok(JSON.stringify(parts.bench) === JSON.stringify(['Penkkipunnerrus tangolla', 'Tanko · Rinta', 'penkkipunnerrus-tangolla']), 'A7 otsikko ja tarkenne: ' + JSON.stringify(parts.bench));
  ok(parts.curl && parts.curl[0] === 'Hauiskääntö tangolla myötäotteella' && parts.curl[1] === 'Tanko · Scott-tanko · Kyynärvarret', 'A8 lisävariaatio otsikossa, varuste tarkenteessa: ' + JSON.stringify(parts.curl));
  ok(parts.unknown === null, 'A9 kirjaston ulkopuolinen nimi ei tunnistu');
  ok(parts.g1 && parts.g2 && parts.g3, 'A10 Kehityksen ryhmittely: varusteet yhdistyvät, ote ja suunta eivät');
  ok(parts.byName === 'penkkipunnerrus-tangolla' && parts.byOld === 'vipunosto-sivulle-taljassa', 'A11 haku näyttönimellä ja vanhalla nimellä');
  const pick = await page.evaluate(() => {
    const t = window.__t, names = h => Array.from(new DOMParser().parseFromString(h, 'text/html').querySelectorAll('[data-pick-exercise]:not([data-pick-free])')).map(b => b.textContent);
    return { bench: names(t.renderExercisePickList('bench press')), alt: names(t.renderExercisePickList('sivunosto')), plain: names(t.renderExercisePickList('vipunosto sivulle')) };
  });
  ok(pick.bench.some(n => n.indexOf('Penkkipunnerrus tangolla') === 0 && /Barbell bench press/.test(n)), 'A12 haku englanninkielisellä nimellä näyttää osuman syyn: ' + pick.bench.slice(0, 3).join(' | '));
  ok(pick.alt.some(n => n.indexOf('Vipunosto sivulle taljassa') === 0), 'A13 haku vanhalla nimellä (Muut nimet): ' + pick.alt.slice(0, 3).join(' | '));
  ok(pick.plain.some(n => n === 'Vipunosto sivulle taljassa'), 'A14 nimellä osuessa ei muita nimiä');
  const histHtml = await page.evaluate(() => window.__t.renderHistoryExercise('2026-10-01', 'x', { name: 'Hauiskääntö taljassa, Hihnat', sets: [{ weight: '20', reps: '10' }], kind: 'plain' }));
  ok(histHtml.indexOf('Hauiskääntö taljassa<span class="history-ex-variant">, Hihnat</span>') !== -1, 'A15 Historian nimessä varuste harmaana');
  await ctx.close();

  // ===== B. Siirron ydin =====
  console.log('B. Siirron ydin (migrateLiikeData)');
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  page = await newPage(ctx, { instrumented: true });
  await seed(page, MINI);
  const core = await page.evaluate(() => {
    const t = window.__t, out = {};
    // Jokainen taulukon rivi: ohjelmarivi, merkintä, painoehdotus ja 1RM.
    const program = { id: 'p', days: [{ id: 'd', exercises: [] }] }, entries = {}, lastSet = {}, manualMax = {};
    t.NIMIMUUNNOKSET.forEach((m, i) => {
      program.days[0].exercises.push({ id: 'ex-' + i, name: m.vanha, sets: '3', reps: '10', notes: 'n' + i });
      entries['2026-09-' + String(1 + (i % 28)).padStart(2, '0') + ''] = entries['2026-09-' + String(1 + (i % 28)).padStart(2, '0')] || { exercises: {} };
      entries['2026-09-' + String(1 + (i % 28)).padStart(2, '0')].exercises['ex-' + i] = { name: m.vanha, sets: [{ weight: String(10 + i), reps: String(5 + (i % 7)), rpe: 8, notes: 'h' + i, done: true }], warmups: [{ weight: '5', reps: '8', rpe: 6 }], loggedAt: '2026-09-01T10:00:00.000Z', plan: { sets: 1 } };
    });
    const clone = o => JSON.parse(JSON.stringify(o));
    const before = clone({ program, entries });
    const res = t.migrateLiikeData({ programs: [program], entries, lastSet, manualMax });
    out.rows = t.NIMIMUUNNOKSET.map((m, i) => {
      const pr = program.days[0].exercises[i];
      const date = Object.keys(entries).find(d => entries[d].exercises['ex-' + i]);
      const er = entries[date].exercises['ex-' + i];
      const row = m.id ? t.liikeById(m.id) : null;
      const okRow = m.id
        ? (pr.liikeId === m.id && er.liikeId === m.id && pr.name === row.nimi && er.name === row.nimi && pr.alkuperainenNimi === m.vanha && er.alkuperainenNimi === m.vanha)
        : (!pr.liikeId && !er.liikeId && pr.name === m.vanha && er.name === m.vanha && !pr.alkuperainenNimi);
      return okRow ? null : m.vanha;
    }).filter(Boolean);
    // Muut kentät ennallaan.
    const strip = o => { const c = clone(o); delete c.name; delete c.liikeId; delete c.alkuperainenNimi; return c; };
    out.sameOther = before.program.days[0].exercises.every((e, i) => JSON.stringify(strip(e)) === JSON.stringify(strip(program.days[0].exercises[i]))) &&
      Object.keys(before.entries).every(d => Object.keys(before.entries[d].exercises).every(k => JSON.stringify(strip(before.entries[d].exercises[k])) === JSON.stringify(strip(entries[d].exercises[k]))));
    out.counts = [Object.keys(before.entries).reduce((n, d) => n + Object.keys(before.entries[d].exercises).length, 0), Object.keys(entries).reduce((n, d) => n + Object.keys(entries[d].exercises).length, 0),
      before.program.days[0].exercises.length, program.days[0].exercises.length];
    out.report = Object.keys(res.report.siirretyt).length + '/' + Object.keys(res.report.eiKohdistettu).length;
    // Uudelleenajo ei muuta mitään.
    const snap = JSON.stringify({ program, entries });
    const res2 = t.migrateLiikeData({ programs: [program], entries, lastSet: {}, manualMax: {} });
    out.idem = !res2.changed.any && JSON.stringify({ program, entries }) === snap;
    return out;
  });
  ok(core.rows.length === 0, 'B1 jokainen 45 taulukon rivistä kohdistuu oikeaan tunnisteeseen (virheet: ' + JSON.stringify(core.rows) + ')');
  ok(core.sameOther, 'B2 painot, toistot, tuntumat, huomiot, lämmittelyt, ajat ja ex-tunnisteet ennallaan');
  ok(core.counts[0] === core.counts[1] && core.counts[2] === core.counts[3] && core.counts[0] === 45, 'B3 merkintöjen ja ohjelmarivien määrä sama: ' + core.counts.join('/'));
  ok(core.report === '43/2', 'B4 raportissa 43 siirrettyä ja 2 kohdistamatonta: ' + core.report);
  ok(core.idem, 'B5 uudelleenajo ei muuta mitään');
  const keys = await page.evaluate(() => {
    const t = window.__t;
    const lastSet = { 'sivunosto taljassa': { sets: [{ weight: '20', reps: '10' }], date: '2026-10-01', prior: [] }, 'v-jalkojen nosto': { sets: [{ weight: '', reps: '10' }], date: '2026-10-03', prior: [] },
      'pc: v-jalkojen nosto': { sets: [{ weight: '', reps: '12' }], date: '2026-10-05', prior: [] }, 'lankku': { sets: [{ weight: '', reps: '1' }], date: '2026-10-02', prior: [] }, 'oma liike': { sets: [], date: '2026-10-01', prior: [] } };
    const manualMax = { 'penkkipunnerrus tangolla, suora tanko': { weight: 107.5, date: '2026-10-05' }, 'v-jalkojen nosto': { weight: 10, date: '2026-10-06' }, 'pc: v-jalkojen nosto': { weight: 12, date: '2026-10-05' }, 'oma liike': { weight: 40, date: '2026-10-01' } };
    const res = t.migrateLiikeData({ programs: [], entries: {}, lastSet, manualMax });
    return { ls: Object.keys(lastSet).sort(), mm: manualMax, rebuild: res.rebuildKeys, collisions: res.report.tormaykset.length, left: Object.keys(res.report.ennallaan) };
  });
  ok(JSON.stringify(keys.ls) === JSON.stringify(['lankku', 'linkkuveitsi', 'oma liike', 'vipunosto-sivulle-taljassa']), 'B6 painoehdotuksen avaimet tunnisteiksi, tuntematon ennallaan: ' + keys.ls.join(', '));
  ok(keys.mm['penkkipunnerrus-tangolla'].weight === 107.5 && keys.mm['penkkipunnerrus-tangolla'].date === '2026-10-05' && !keys.mm['penkkipunnerrus tangolla, suora tanko'], 'B7 1RM siirtyy tunnisteelle arvo ja päivä ennallaan');
  ok(keys.mm.linkkuveitsi.weight === 10 && keys.mm['oma liike'].weight === 40, 'B8 yhdistyvä 1RM: myöhemmin päivitetty voittaa; tuntematon ennallaan');
  ok(JSON.stringify(keys.rebuild) === JSON.stringify(['linkkuveitsi']) && keys.collisions === 2 && keys.left.indexOf('oma liike') !== -1, 'B9 yhdistyvä painoehdotus rakennetaan merkinnöistä, törmäykset raportissa');
  const resolve = await page.evaluate(() => {
    const t = window.__t, r = n => { const x = t.resolveLiikeForName(n, true); return x ? x.row.id + (x.mapped ? '*' : '') : null; };
    return [r('Sivunosto taljassa'), r('Penkkipunnerrus tangolla'), r('Bulgarialainen askelkyykky käsipainoilla'), r('PC: V-jalkojen nosto'), r('Tuntematon liike'), (t.resolveLiikeForName('Penkkipunnerrus tangolla', false) || null)];
  });
  ok(JSON.stringify(resolve) === JSON.stringify(['vipunosto-sivulle-taljassa*', 'penkkipunnerrus-tangolla', 'bulgarialainen-askelkyykky-kasipainoilla', 'linkkuveitsi*', null, null]), 'B10 tuonnin kohdistus: vanha nimi, näyttönimi, ei arvausta: ' + JSON.stringify(resolve));
  await ctx.close();

  // ===== C. Siirto käynnistyksessä =====
  console.log('C. Siirto käynnistyksessä');
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, acceptDownloads: true });
  page = await newPage(ctx, { instrumented: true });
  const pre = oldStore();
  await seed(page, pre);
  const t1 = nb(await toast(page));
  ok(/siirrettiin uuteen liikekirjastoon/.test(t1), 'C1 ilmoitus siirrosta: ' + t1);
  const st1 = await dump(page);
  const marker = JSON.parse(st1['treenipk:liike-siirto'] || 'null');
  ok(marker && marker.tila === 'valmis' && marker.versio === '2026-10-19' && marker.varmuuskopioLuotu, 'C2 siirron merkintä');
  const snap = JSON.parse(st1['treenipk:liike-siirto-varmuuskopio'] || 'null');
  const snapKeys = snap ? Object.keys(snap.avaimet).sort() : [];
  const expectKeys = ['entries:2026-10-01', 'entries:2026-10-03', 'entries:2026-10-05', 'last-set-log', 'manual-1rm', 'programs', 'user-exercises', 'workout-program'];
  ok(snap && snap.tyyppi === 'treenipaivakirja-liikesiirto-varmuuskopio' && JSON.stringify(snapKeys) === JSON.stringify(expectKeys), 'C3 varmuuskopion avaimet: ' + snapKeys.join(', '));
  ok(snap && snapKeys.every(k => snap.avaimet[k] === (pre['treenipk:' + k] === undefined ? null : pre['treenipk:' + k])), 'C4 varmuuskopio on täsmälleen siirtoa edeltävä tila');
  const prog1 = JSON.parse(st1['treenipk:workout-program']);
  const byId = {}; prog1.days.forEach(d => d.exercises.forEach(e => { byId[e.id] = e; }));
  ok(byId['ex-1'].name === 'Penkkipunnerrus tangolla' && byId['ex-1'].liikeId === 'penkkipunnerrus-tangolla' && byId['ex-1'].alkuperainenNimi === OLD_BENCH, 'C5 ohjelmarivi siirtyi');
  ok(byId['ex-2'].name === 'Pysäytyspenkkipunnerrus tangolla, Suora tanko' && !byId['ex-2'].liikeId && byId['ex-2'].maxRef === 'Penkkipunnerrus tangolla' && byId['ex-2'].maxRefId === 'penkkipunnerrus-tangolla', 'C6 1RM-pohja siirtyi, taulukon ulkopuolinen nimi ennallaan');
  ok(byId['ex-4'].name === 'Takavipunosto laitteessa istuen' && !byId['ex-4'].liikeId && byId['ex-5'].name.indexOf('PC: Cardiolaite') === 0 && !byId['ex-5'].liikeId, 'C7 ennalleen jäävät ja kohdistamattomat');
  ok(byId['ex-8'].liikeId === 'linkkuveitsi' && byId['ex-9'].liikeId === 'linkkuveitsi' && byId['ex-6'].name === 'Dippi', 'C8 tulkitut rivit taulukon mukaan');
  const lib1 = JSON.parse(st1['treenipk:programs'])[0].days[0].exercises;
  ok(!lib1[0].liikeId && lib1[0].name === 'Bulgarialainen askelkyykky käsipainoilla' && lib1[1].liikeId === 'hack-kyykky-laitteessa', 'C9 kirjaston ohjelma: täsmäävä näyttönimi ei kuulu taulukkoon eikä liity, taulukon nimi siirtyy');
  const ent1 = JSON.parse(st1['treenipk:entries:2026-10-01']).exercises;
  ok(ent1['ex-1'].name === 'Penkkipunnerrus tangolla' && ent1['ex-1'].liikeId === 'penkkipunnerrus-tangolla' && JSON.stringify(ent1['ex-1'].sets) === JSON.stringify(ENTRIES['2026-10-01'].exercises['ex-1'].sets) &&
     JSON.stringify(ent1['ex-1'].warmups) === JSON.stringify(ENTRIES['2026-10-01'].exercises['ex-1'].warmups), 'C10 merkintä siirtyi, sarjat ja lämmittelyt ennallaan');
  const ls1 = JSON.parse(st1['treenipk:last-set-log']), mm1 = JSON.parse(st1['treenipk:manual-1rm']);
  ok(JSON.stringify(ls1['penkkipunnerrus-tangolla']) === JSON.stringify(LASTSET['penkkipunnerrus tangolla, suora tanko']) && ls1['takavipunosto laitteessa istuen'] && !ls1['sivunosto taljassa'], 'C11 painoehdotus siirtyi tunnisteelle sellaisenaan');
  ok(ls1.linkkuveitsi && ls1.linkkuveitsi.date === '2026-10-05' && ls1.linkkuveitsi.deloadKind === 'pyydetty' && ls1.linkkuveitsi.prior.length === 1 && ls1.linkkuveitsi.prior[0].date === '2026-10-03', 'C12 yhdistynyt painoehdotus rakennettu merkinnöistä');
  ok(JSON.stringify(mm1) === JSON.stringify({ 'takavipunosto laitteessa istuen': MANUALMAX['takavipunosto laitteessa istuen'], 'penkkipunnerrus-tangolla': MANUALMAX[OLD_BENCH.toLowerCase()], 'linkkuveitsi': MANUALMAX['pc: v-jalkojen nosto'] }), 'C13 1RM-arvot: ' + JSON.stringify(mm1));
  const cont = await page.evaluate(() => {
    const t = window.__t;
    const e2 = t.findExerciseById('ex-2'), e3 = t.findExerciseById('ex-3');
    return { pct: t.buildDraftRows(e2, 'ex-2').map(r => r.weight), key: t.oneRepMaxKeyFor(e2), last: (t.state.lastSet[t.exerciseKeyOf(e3)] || {}).sets, rec: t.exerciseRecognition(e3.name, e3.liikeId).status };
  });
  ok(cont.key === 'penkkipunnerrus-tangolla' && cont.pct.join(',') === '80,80,80', 'C14 1RM-pohjan prosenttipaino jatkuu tunnisteella: ' + cont.pct.join(','));
  ok(cont.last && cont.last.length === 3 && cont.last[0].weight === '20', 'C15 painoehdotuksen viitekerta löytyy uudella nimellä');
  ok(cont.rec === 'history', 'C16 tunnistus historiassa');
  // Uudelleenlataus: mikään ei muutu.
  await page.reload(); await page.waitForSelector('.bottom-nav'); await w(800);
  const st2 = await dump(page);
  const changedKeys = Object.keys(Object.assign({}, st1, st2)).filter(k => st1[k] !== st2[k]);
  ok(changedKeys.length === 0, 'C17 uudelleenlataus ei muuta tallennusta: ' + changedKeys.join(', '));
  // Näkymät uusilla nimillä
  // Kaikki viikot ja päivät auki, jotta liikkeiden nimet näkyvät.
  await page.click('[data-week-mode="all"]'); await w(500);
  for(const key of await page.$$eval('.day-card [data-key]', els => els.map(e => e.getAttribute('data-key')))){
    await page.click('.day-card [data-key="' + key + '"]').catch(() => null); await w(350);
    const txt = nb(await page.textContent('#app'));
    if(/Vipunosto sivulle taljassa/.test(txt)) break;
  }
  const ohjelma = nb(await page.textContent('#app'));
  ok(/Vipunosto sivulle taljassa|Linkkuveitsi/.test(ohjelma) && !/Sivunosto taljassa|Ojentajadippi|V-jalkojen nosto|Penkkipunnerrus tangolla, Suora tanko/.test(ohjelma), 'C18 Ohjelma-näkymä uusilla nimillä: ' + (ohjelma.match(/Viikko \d[^·]{0,40}/) || [''])[0]);
  await page.click('[data-tab="historia"]'); await w(700);
  ok(!!(await page.$('#history-list')) && /Ma 5\.10\.|Su 5\.10\.|5\.10\./.test(nb(await page.textContent('#app'))), 'C19 Historia avautuu');
  await page.click('[data-tab="kehitys"]'); await w(900);
  await page.evaluate(() => { const b = document.querySelector('[data-kehitys-front-tab="liikkeet"]'); if(b) b.click(); }); await w(600);
  const keh = nb(await page.textContent('#app'));
  ok(/Penkkipunnerrus tangolla/.test(keh), 'C20 Kehityksen liikelista uudella nimellä');
  // Vienti
  await openSettings(page, 'varmuuskopio');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  const mrows = sectionRows(csv, '#MERKINNÄT');
  ok(mrows.length === 15 && mrows.filter(r => r['Liike'] === 'Penkkipunnerrus tangolla' && r['Liiketunniste'] === 'penkkipunnerrus-tangolla' && r['Alkuperäinen nimi'] === OLD_BENCH).length === 3, 'C21 vienti: merkinnät uusilla näyttönimillä ja tunnisteella (' + mrows.length + ' riviä)');
  ok(mrows.some(r => r['Liike'] === 'Takavipunosto laitteessa istuen' && r['Liiketunniste'] === ''), 'C22 vienti: ennalleen jäänyt nimi ilman tunnistetta');
  const prows = sectionRows(csv, '#OHJELMA');
  ok(prows.length === 11 && prows.some(r => r['Liike'] === 'Dippi' && r['Liiketunniste'] === 'dippi' && r['Alkuperäinen nimi'] === 'Ojentajadippi') &&
     prows.some(r => r['1RM-pohja'] === 'Penkkipunnerrus tangolla' && r['1RM-pohjan liiketunniste'] === 'penkkipunnerrus-tangolla'), 'C23 vienti: ohjelma uusilla nimillä');
  const xrows = sectionRows(csv, '#1RM');
  ok(xrows.some(r => r['Liike'] === 'Penkkipunnerrus tangolla' && r['Liiketunniste'] === 'penkkipunnerrus-tangolla' && r['1RM (kg)'] === '100'), 'C24 vienti: 1RM uudella nimellä: ' + JSON.stringify(xrows));
  // Vanhan muodon varmuuskopio siirron jälkeen: ei kaksoiskappaleita.
  await page.setInputFiles('#import-entries-input', { name: 'vanha.csv', mimeType: 'text/csv', buffer: Buffer.from(oldBackupCsv(), 'utf8') });
  await w(1500);
  const t2 = nb(await toast(page));
  const st3 = await dump(page);
  ok(/0 merkintää \(ohitettu 7 jo olemassa olevaa\)/.test(t2) && /1RM-arvot \(lisätty 0, päivitetty 0, ohitettu 1\)/.test(t2), 'C25 vanha varmuuskopio: vanhoilla nimillä olevat merkinnät tunnistetaan jo olemassa oleviksi: ' + t2);
  ok(['treenipk:entries:2026-10-01', 'treenipk:entries:2026-10-03', 'treenipk:entries:2026-10-05'].every(k => st3[k] === st2[k]), 'C26 merkinnät ennallaan palautuksen jälkeen');
  // Liikekirjasto-osio
  await page.click('[data-settings-back]'); await w(400);
  const subtitle = nb(await page.textContent('[data-settings-section="liikekirjasto"]'));
  ok(/448 liikettä · siirto tehty 19\.10\./.test(subtitle), 'C27 Asetusten rivi: ' + subtitle);
  await page.click('[data-settings-section="liikekirjasto"]'); await w(500);
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  const sect = nb(await page.textContent('#app'));
  ok(/Siirretty 6 liikenimeä: 5 merkintää \(11 sarjaa, 2 lämmittelyä\), 7 ohjelmariviä, 3 1RM-arvoa, 5 painoehdotusta ja 1 1RM-pohja\./.test(sect), 'C28 yhteenveto: ' + (sect.match(/Siirretty[^.]*\./) || [''])[0]);
  ok(/Tulkitut kohdistukset \(3\)/.test(sect) && /Ojentajadippi → Dippi/.test(sect) && /V-jalkojen nosto → Linkkuveitsi/.test(sect), 'C29 tulkitut kohdistukset luetellaan');
  ok(/Ennalleen jääneet nimet \(3\)/.test(sect) && /Takavipunosto laitteessa istuen/.test(sect) && /Bulgarialainen askelkyykky käsipainoilla/.test(sect) && /Pysäytyspenkkipunnerrus/.test(sect), 'C30 ennalleen jääneet nimet luetellaan');
  ok(/Ei kohdistettu \(1\)/.test(sect) && /Yhdistyneet tiedot \(2\)/.test(sect), 'C31 kohdistamattomat ja yhdistyneet');
  const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  await page.addScriptTag({ content: axeSrc });
  const axe = await page.evaluate(async () => { const r = await axe.run(document.querySelector('#app'), { runOnly: ['wcag2a', 'wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
  ok(axe.filter(v => v.indexOf('color-contrast') !== 0).length === 0, 'C32 axe: ' + JSON.stringify(axe));
  // Lataus JSON-tiedostona
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-liike-snapshot-download]')]);
  const snapFile = path.join(require('os').tmpdir(), 'liikesiirto-testi.json');
  fs.copyFileSync(await dl2.path(), snapFile);
  const snapDl = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
  ok(dl2.suggestedFilename() === 'treenipaivakirja_ennen-liikesiirtoa_2026-10-19.json' && JSON.stringify(snapDl) === JSON.stringify(snap), 'C33 ladattu varmuuskopio vastaa laitteen kopiota');
  // Palautus laitteen kopiosta (kaksivaiheinen); siirron jälkeen tehty merkintä poistuu.
  await page.evaluate(() => localStorage.setItem('treenipk:entries:2026-10-19', JSON.stringify({ date: '2026-10-19', exercises: { 'ex-3': { name: 'Vipunosto sivulle taljassa', liikeId: 'vipunosto-sivulle-taljassa', sets: [{ weight: '22.5', reps: '10' }] } } })));
  await page.click('[data-liike-snapshot-restore]'); await w(400);
  const confirmTxt = nb(await page.textContent('[data-liike-snapshot-restore]'));
  ok(/Vahvista palautus/.test(confirmTxt), 'C34 palautus vaatii vahvistuksen');
  await Promise.all([page.waitForNavigation({ timeout: 8000 }).catch(() => null), page.click('[data-liike-snapshot-restore]')]);
  await page.waitForSelector('.bottom-nav'); await w(900);
  const st4 = await dump(page);
  const restoredOk = expectKeys.every(k => (st4['treenipk:' + k] === undefined ? null : st4['treenipk:' + k]) === (pre['treenipk:' + k] === undefined ? null : pre['treenipk:' + k]));
  ok(restoredOk && st4['treenipk:entries:2026-10-19'] === undefined, 'C35 palautus: tallennus täsmälleen siirtoa edeltävä, myöhempi merkintä poistui');
  const m4 = JSON.parse(st4['treenipk:liike-siirto']);
  ok(m4.tila === 'palautettu', 'C36 siirron tila palautettu');
  await page.reload(); await page.waitForSelector('.bottom-nav'); await w(800);
  const st5 = await dump(page);
  ok(st5['treenipk:workout-program'] === pre['treenipk:workout-program'], 'C37 palautettu tila ei siirry uudelleen käynnistyksessä');
  await openSettings(page, 'liikekirjasto');
  ok(/Siirto on peruttu/.test(nb(await page.textContent('#app'))), 'C38 osio kertoo perumisesta');
  await page.click('[data-liike-migrate]'); await w(1500);
  const st6 = await dump(page);
  ok(JSON.parse(st6['treenipk:workout-program']).days[0].exercises[0].liikeId === 'penkkipunnerrus-tangolla' && JSON.parse(st6['treenipk:liike-siirto']).tila === 'valmis', 'C39 siirron voi ajaa uudelleen painikkeesta');
  await ctx.close();

  // ===== D. Palautus JSON-tiedostosta tyhjälle laitteelle =====
  console.log('D. Palautus tiedostosta');
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  page = await newPage(ctx);
  await seed(page, MINI);
  await openSettings(page, 'liikekirjasto');
  await page.setInputFiles('#liike-snapshot-input', { name: 'ennen.json', mimeType: 'application/json', buffer: fs.readFileSync(snapFile) });
  await w(600);
  ok(/Palautetaanko tila ennen liikekirjaston siirtoa\?/.test(nb(await page.textContent('#app'))), 'D1 tiedoston palautus kysyy vahvistuksen');
  await Promise.all([page.waitForNavigation({ timeout: 8000 }).catch(() => null), page.click('[data-liike-file-restore-confirm]')]);
  await page.waitForSelector('.bottom-nav'); await w(900);
  const sd = await dump(page);
  ok(sd['treenipk:workout-program'] === pre['treenipk:workout-program'] && sd['treenipk:entries:2026-10-05'] === pre['treenipk:entries:2026-10-05'] && JSON.parse(sd['treenipk:liike-siirto']).tila === 'palautettu', 'D2 tiedostosta palautettu tila');
  await openSettings(page, 'liikekirjasto');
  await page.setInputFiles('#liike-snapshot-input', { name: 'roska.json', mimeType: 'application/json', buffer: Buffer.from('{"tyyppi":"muu","avaimet":{"consent":"1"}}') }).catch(() => null);
  await w(500);
  ok(/ei ole liikekirjaston siirtoa edeltävä varmuuskopio/.test(nb(await toast(page))), 'D3 kelpaamaton tiedosto hylätään');
  await ctx.close();

  // ===== E. Uuden varmuuskopion palautus tyhjälle laitteelle =====
  console.log('E. CSV-varmuuskopio tyhjälle laitteelle');
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  page = await newPage(ctx);
  await seed(page, EMPTY, '#import-entries-input');
  await page.setInputFiles('#import-entries-input', { name: 'uusi.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await w(800);
  await page.click('[data-restore-confirm]'); await w(1500);
  const se = await dump(page);
  const eRec = JSON.parse(se['treenipk:entries:2026-10-01']).exercises['ex-1'];
  ok(eRec.name === 'Penkkipunnerrus tangolla' && eRec.liikeId === 'penkkipunnerrus-tangolla' && eRec.alkuperainenNimi === OLD_BENCH, 'E1 merkintä palautui tunnisteineen ja alkuperäisine nimineen');
  const eProg = JSON.parse(se['treenipk:workout-program']);
  const ep = {}; eProg.days.forEach(d => d.exercises.forEach(x => { ep[x.id] = x; }));
  ok(ep['ex-6'].liikeId === 'dippi' && ep['ex-6'].alkuperainenNimi === 'Ojentajadippi' && ep['ex-2'].maxRefId === 'penkkipunnerrus-tangolla' && !ep['ex-4'].liikeId, 'E2 ohjelma palautui tunnisteineen');
  const eLs = JSON.parse(se['treenipk:last-set-log'] || '{}'), eMm = JSON.parse(se['treenipk:manual-1rm'] || '{}');
  ok(eLs['vipunosto-sivulle-taljassa'] && eLs['takavipunosto laitteessa istuen'] && eMm['penkkipunnerrus-tangolla'] && eMm['penkkipunnerrus-tangolla'].weight === 100, 'E3 painoehdotus ja 1RM tunnisteilla');
  await ctx.close();

  // ===== F. Vanhan muodon varmuuskopio uudelle laitteelle =====
  console.log('F. Vanha varmuuskopio uudelle laitteelle');
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  page = await newPage(ctx);
  await seed(page, EMPTY, '#import-entries-input');
  await page.setInputFiles('#import-entries-input', { name: 'vanha.csv', mimeType: 'text/csv', buffer: Buffer.from(oldBackupCsv(), 'utf8') });
  await w(1500);
  const sf = await dump(page);
  const fRec = JSON.parse(sf['treenipk:entries:2026-10-03']).exercises['ex-6'];
  ok(fRec.name === 'Dippi' && fRec.liikeId === 'dippi' && fRec.alkuperainenNimi === 'Ojentajadippi' && fRec.deload === true, 'F1 vanhan nimen merkintä kohdistui taulukon mukaan');
  ok(JSON.parse(sf['treenipk:manual-1rm'])['penkkipunnerrus-tangolla'].weight === 100, 'F2 vanhan nimen 1RM tunnisteelle');
  await ctx.close();

  // ===== G. Varmuuskopio ei tallennu: siirto keskeytyy =====
  console.log('G. Epäonnistunut varmuuskopio');
  ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v){ if(String(k).indexOf('liike-siirto-varmuuskopio') !== -1) throw new Error('QuotaExceededError'); return orig.call(this, k, v); };
  });
  page = await newPage(ctx, { instrumented: true });
  await seed(page, pre);
  const sg = await dump(page);
  ok(['treenipk:workout-program', 'treenipk:programs', 'treenipk:last-set-log', 'treenipk:manual-1rm', 'treenipk:entries:2026-10-01', 'treenipk:entries:2026-10-03', 'treenipk:entries:2026-10-05'].every(k => sg[k] === pre[k]), 'G1 tietoihin ei koskettu');
  ok(!sg['treenipk:liike-siirto'] && !sg['treenipk:liike-siirto-varmuuskopio'], 'G2 siirron merkintää ei tallennettu (yritetään uudelleen seuraavalla käynnistyksellä)');
  const gState = await page.evaluate(() => ({ mode: window.__t.state.storageMode, tila: (window.__t.state.liikeSiirto || {}).tila }));
  ok(gState.mode === 'local' && gState.tila === 'keskeytetty', 'G3 tallennustila ei vaihtunut muistiin, tila keskeytetty: ' + JSON.stringify(gState));
  await openSettings(page, 'liikekirjasto');
  ok(/Siirto keskeytyi/.test(nb(await page.textContent('#app'))) && /Yritä uudelleen/.test(nb(await page.textContent('#app'))), 'G4 osio kertoo keskeytyksestä');
  await ctx.close();

  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
