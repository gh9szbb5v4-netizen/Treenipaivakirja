// Kevennystieto varmuuskopioon (0.4.29, kevennys-sarja 2/4): merkintäosion
// viimeinen sarake Kevennys viennissä ja palautuksessa, palautetun
// kevennyksen vaikutus seuraavaan ehdotukseen, vanha tiedosto ilman
// saraketta, tuntematon arvo, Excelin yhteen soluun tallentama tiedosto ja
// kaksoistunniste (kehotteen tapaukset 1–6).
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const nb = s => s == null ? s : String(s).replace(/[  ]/g, ' ');
const ROW = 'Kulmasoutu tangolla';
const BENCH = 'Penkkipunnerrus tangolla';
const kb = n => n.trim().toLowerCase();

function pex(id, name, sets, reps){ return { id, name, sets, reps, unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }; }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [pex('A', ROW, '2', '10'), pex('B', BENCH, '2', '8'), pex('A2', ROW, '2', '10')] } ] };
const S = (wt, r) => ({ weight: String(wt), reps: String(r), notes: '', done: true });
function entry(date, id, name, sets, extra){
  return { date, exercises: { [id]: Object.assign({ name, sets, loggedAt: date + 'T15:00:00.000Z', kind: 'plain', warmups: [] }, extra || {}) } };
}
const ENTRIES = {
  '2026-09-26': entry('2026-09-26', 'x1', ROW, [S(100, 9), S(100, 9)]),
  '2026-09-30': entry('2026-09-30', 'x2', ROW, [S(100, 8), S(100, 8)]),
  '2026-10-05': entry('2026-10-05', 'B', BENCH, [S(70, 8), S(70, 8)], { warmups: [{ weight: '40', reps: '8', rpe: 6 }], deload: true, deloadKind: 'pyydetty' }),
  '2026-10-06': entry('2026-10-06', 'A', ROW, [S(90, 9), S(90, 9)], { deload: true })
};
const HEADER = '"Päivämäärä","Liike","Sarja","Paino (kg)","Toistot","Huomiot","Tyyppi","Tunniste","Tuntuma","Osasarjat","Kevennys"';

async function seed(page, entries){
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(o.program));
    Object.keys(o.entries || {}).forEach(d => localStorage.setItem('treenipk:entries:' + d, JSON.stringify(o.entries[d])));
  }, { program: PROGRAM, entries });
  await page.goto(URL);
  await page.waitForSelector('.bottom-nav'); await w(400);
}
async function openSettings(page, key){
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="' + key + '"]'); await w(450);
}
async function download(page){
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  return fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
}
function sectionLines(text, name){
  const lines = text.split('\n');
  const i = lines.findIndex(l => l.trim() === '"' + name + '"');
  if(i === -1) return [];
  const out = [];
  for(let j=i+1;j<lines.length && !/^"#/.test(lines[j].trim());j++){ if(lines[j].trim()) out.push(lines[j]); }
  return out;
}
// Merkintäosion rivit muunnetaan; muut rivit sellaisinaan.
function mapEntryLines(text, fn){
  const lines = text.split('\n');
  const start = lines.findIndex(l => l.trim() === '"#MERKINNÄT"');
  let end = lines.findIndex((l, j) => j > start && /^"#/.test(l.trim()));
  if(end === -1) end = lines.length;
  return lines.map((l, i) => (i > start && i < end && l.trim()) ? fn(l) : l).join('\n');
}
// Testidatan kentissä ei ole lainausmerkkejä eikä pilkkuja.
const fieldsOf = line => line.trim().slice(1, -1).split('","');
async function restore(page, text, name){
  await openSettings(page, 'varmuuskopio');
  await page.setInputFiles('#import-entries-input', { name: name || 'varmuuskopio.csv', mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') });
  await w(700);
  await page.click('[data-restore-confirm]'); await w(1000);
}
const toast = page => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const allEntries = page => page.evaluate(() => {
  const out = {};
  Object.keys(localStorage).filter(k => k.indexOf('treenipk:entries:') === 0).sort().forEach(k => { out[k.replace('treenipk:entries:', '')] = JSON.parse(localStorage.getItem(k)); });
  return out;
});
const lastSet = page => page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:last-set-log') || '{}'));
async function openA2(page){
  await page.click('.tab[data-tab="ohjelma"]'); await w(500);
  if(!(await page.$('[data-toggle-ex][data-id="A2"]'))){ await page.click('[data-toggle-day-summary][data-key="d1"]'); await w(400); }
  await page.click('[data-toggle-ex][data-id="A2"]'); await page.waitForSelector('.ledger [data-id="A2"]'); await w(450);
  const r = await page.evaluate(() => ({ weights: [...document.querySelectorAll('.ledger [data-set-field][data-id="A2"][data-field="weight"]')].map(e => e.value),
    target: (document.querySelector('main .exercise-target') || {}).textContent || null }));
  await page.click('[data-close-ex]'); await w(500);
  return r;
}
const deloadKeys = entries => Object.keys(entries).map(d => Object.keys(entries[d].exercises).map(id => {
  const x = entries[d].exercises[id];
  return d + '/' + id + ':' + ('deload' in x ? String(x.deload) : '-') + ('deloadKind' in x ? '/' + x.deloadKind : '');
}).join(',')).join(' ');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-10-09T12:00:00'));
  let e, ls, a2;

  console.log('=== 1 vienti');
  await seed(page, ENTRIES);
  await openSettings(page, 'varmuuskopio');
  const backup = await download(page);
  const lines = sectionLines(backup, '#MERKINNÄT');
  ok(lines[0] === HEADER, '1 merkintäosion otsikko päättyy Kevennys-sarakkeeseen: ' + lines[0]);
  const rows = lines.slice(1).map(fieldsOf);
  const lastOf = id => rows.filter(f => f[7] === id).map(f => f[2] + ':' + f[10]).join(' ');
  ok(rows.every(f => f.length === 11), '1 jokaisella rivillä 11 saraketta');
  ok(lastOf('B') === '1:pyydetty 2:pyydetty L1:pyydetty', '1 B:n sarjat 1, 2 ja L1 "pyydetty": ' + lastOf('B'));
  ok(lastOf('A') === '1:automaattinen 2:automaattinen', '1 A:n rivit "automaattinen": ' + lastOf('A'));
  ok(lastOf('x1') === '1: 2:' && lastOf('x2') === '1: 2:', '1 x1:n ja x2:n riveillä tyhjä: ' + lastOf('x1') + ' / ' + lastOf('x2'));
  ok(rows.filter(f => f[7] === 'B' && f[2] === 'L1').map(f => f[8]).join() === 'Kevyt', '1 L1-rivin tuntuma ennallaan (Kevyt)');

  console.log('=== 2 palautus tyhjälle laitteelle');
  await seed(page, {});
  await restore(page, backup);
  e = await allEntries(page);
  const b2 = e['2026-10-05'] && e['2026-10-05'].exercises.B;
  const a2e = e['2026-10-06'] && e['2026-10-06'].exercises.A;
  ok(b2 && b2.deload === true && b2.deloadKind === 'pyydetty' && b2.warmups && b2.warmups.length === 1 && b2.warmups[0].weight === '40' && b2.warmups[0].rpe === 6, '2 B: deload true, deloadKind pyydetty, yksi lämmittely: ' + JSON.stringify(b2 && [b2.deload, b2.deloadKind, b2.warmups]));
  ok(a2e && a2e.deload === true && !('deloadKind' in a2e), '2 A: deload true ilman deloadKind-kenttää: ' + JSON.stringify(a2e && [a2e.deload, a2e.deloadKind]));
  ok(e['2026-09-26'] && !('deload' in e['2026-09-26'].exercises.x1) && e['2026-09-30'] && !('deload' in e['2026-09-30'].exercises.x2), '2 x1:llä ja x2:lla ei deload-kenttää: ' + deloadKeys(e));
  ls = await lastSet(page);
  ok(ls[kb(ROW)] && ls[kb(ROW)].date === '2026-10-06' && ls[kb(ROW)].deload === true, '2 lastSet kulmasoutu 6.10. deload true: ' + JSON.stringify(ls[kb(ROW)] && [ls[kb(ROW)].date, ls[kb(ROW)].deload]));
  ok(ls[kb(BENCH)] && ls[kb(BENCH)].deload === true, '2 lastSet penkki deload true');

  console.log('=== 3 palautuksen vaikutus ehdotukseen');
  a2 = await openA2(page);
  ok(JSON.stringify(a2.weights) === '["90","90"]' && nb(a2.target) === '2 sarjaa · 10 toistoa · RPE 8 · ehdotus sama paino', '3 A2: 90 ja 90, ehdotus sama paino: ' + JSON.stringify([a2.weights, nb(a2.target)]));

  console.log('=== 4 vanha tiedosto ilman saraketta');
  const oldBackup = mapEntryLines(backup, l => l.slice(0, l.lastIndexOf('","') + 1));
  ok(sectionLines(oldBackup, '#MERKINNÄT')[0] === HEADER.replace(',"Kevennys"', '') && sectionLines(oldBackup, '#MERKINNÄT').every(l => fieldsOf(l).length === 10), '4 vanhan muodon otsikko päättyy Osasarjat-sarakkeeseen');
  await seed(page, {});
  await restore(page, oldBackup, 'vanha.csv');
  e = await allEntries(page);
  ok(Object.keys(e).length === 4 && Object.keys(e).every(d => Object.keys(e[d].exercises).every(id => !('deload' in e[d].exercises[id]) && !('deloadKind' in e[d].exercises[id]))), '4 yhdelläkään merkinnällä ei deload-kenttää: ' + deloadKeys(e));
  ls = await lastSet(page);
  ok(ls[kb(ROW)] && !ls[kb(ROW)].deload, '4 lastSet kulmasoutu ilman kevennystä');
  a2 = await openA2(page);
  ok(JSON.stringify(a2.weights) === '["80","80"]' && nb(a2.target) === '2 sarjaa · 10 toistoa · RPE 8 · kevennys −10 kg', '4 A2: 80 ja 80, kevennys −10 kg (entinen toiminta): ' + JSON.stringify([a2.weights, nb(a2.target)]));

  console.log('=== 5 tuntematon arvo ja Excel-muoto');
  const oddBackup = backup.split('"automaattinen"').join('"kyllä"');
  // Varmuuskopiossa on "kyllä" myös ohjelmaosion Käytössä-sarakkeessa, joten vain merkintäosio lasketaan.
  const oddRows = sectionLines(oddBackup, '#MERKINNÄT').slice(1).map(fieldsOf);
  ok(oddBackup.indexOf('"automaattinen"') === -1 && oddRows.filter(f => f[10] === 'kyllä').map(f => f[7]).join() === 'A,A', '5 A:n rivien Kevennys-arvo "kyllä"');
  await seed(page, {});
  await restore(page, oddBackup, 'outo.csv');
  e = await allEntries(page);
  const a5 = e['2026-10-06'] && e['2026-10-06'].exercises.A;
  ok(a5 && !('deload' in a5) && a5.sets.length === 2, '5 A palautuu ilman deload-kenttää: ' + JSON.stringify(a5 && [a5.deload, a5.sets.length]));
  ok(e['2026-10-05'] && e['2026-10-05'].exercises.B.deloadKind === 'pyydetty', '5 muut rivit ennallaan (B pyydetty)');
  // Excel suomalaisilla asetuksilla: rivi yhdeksi soluksi, ensimmäinen kenttä
  // ilman lainausmerkkejä ja sisäiset lainausmerkit kahdennettuina.
  const excelBackup = mapEntryLines(backup, l => {
    const f = fieldsOf(l);
    const inner = f[0] + ',' + f.slice(1).map(x => '"' + x + '"').join(',');
    return '"' + inner.replace(/"/g, '""') + '"';
  });
  ok(sectionLines(excelBackup, '#MERKINNÄT')[0].indexOf('"Päivämäärä,""Liike""') === 0, '5 Excel-muodon otsikkorivi on yksi solu');
  await seed(page, {});
  await restore(page, excelBackup, 'excel.csv');
  e = await allEntries(page);
  ok(e['2026-10-05'] && e['2026-10-05'].exercises.B.deload === true && e['2026-10-05'].exercises.B.deloadKind === 'pyydetty' &&
    e['2026-10-06'] && e['2026-10-06'].exercises.A.deload === true && !('deloadKind' in e['2026-10-06'].exercises.A) &&
    !('deload' in e['2026-09-26'].exercises.x1), '5 Excelin yhteen soluun tallentama tiedosto puretaan sarakkeittain: ' + deloadKeys(e));

  console.log('=== 6 kaksoistunniste');
  await seed(page, ENTRIES);
  const before = await allEntries(page);
  await restore(page, backup, 'sama.csv');
  const t6 = await toast(page);
  const after = await allEntries(page);
  ok(t6.indexOf('(ohitettu 4 jo olemassa olevaa)') !== -1, '6 ilmoitus: ' + t6);
  ok(JSON.stringify(after) === JSON.stringify(before), '6 yhtäkään merkintää ei muutettu');

  console.log('=== 7 Muutokset');
  await openSettings(page, 'muutokset');
  const muutokset = await page.evaluate(() => document.querySelector('main').textContent);
  ok(muutokset.indexOf('Varmuuskopio sisältää nyt kevennystiedon (versio 0.4.29)') !== -1, '7 Muutokset-merkintä 0.4.29');

  ok(errors.length === 0, 'ei sivuvirheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
