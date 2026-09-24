// 1RM-pohja, 1RM-luettelo, Kehityksen arvio ja varmuuskopion 1RM-yhdistäminen (0.4.24).
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const BENCH = 'Penkkipunnerrus tangolla, Suora tanko';
const PAUSE = 'Pysäytyspenkkipunnerrus tangolla, Suora tanko';
const SQUAT = 'Takakyykky tangolla, Suora tanko';
const kb = n => n.trim().toLowerCase();
function intensity(t){
  if(!t) return null;
  if(/^max$/i.test(t)) return { isMax: true, percents: [] };
  return { isMax: false, percents: (t.match(/\d+(?:[.,]\d+)?/g) || []).map(Number) };
}
// Sama avainjärjestys kuin parseProgramCSV():ssä (1RM-pohja viimeisenä).
function ex(id, name, sets, reps, teho, maxRef){
  const o = { id, name, sets, reps, unit: '', weight: '', notes: teho || '', intensity: intensity(teho), kind: 'plain', autoCalc: true };
  if(maxRef) o.maxRef = maxRef;
  return o;
}
function program(benchMaxRef){
  return { days: [ { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [
      ex('b1', BENCH, '1', '1', 'MAX', benchMaxRef),
      ex('p1', PAUSE, '3', '3', '70 %', BENCH),
      ex('k1', SQUAT, '3', '5', '80 %'),
      ex('r1', 'Kulmasoutu', '3', '8', '') ] } ],
    weeks: ['1'], weekLabels: {}, id: 'prog-1', name: 'Testi' };
}
const PROGRAM = program(null);
// Kanoninen JSON (avaimet aakkosjärjestyksessä) rakenteen vertailuun.
function canon(v){
  if(Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if(v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
async function seed(page, opts){
  opts = opts || {};
  await page.clock.setFixedTime(new Date('2026-09-24T12:00:00'));
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
const savedProgram = page => page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:workout-program')));
const savedMax = page => page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:manual-1rm') || '{}'));
const toast = page => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const weights = (page, id) => page.$$eval('[data-set-field][data-field="weight"][data-id="' + id + '"]', els => els.map(e => e.value));
async function openEx(page, id){
  if(!(await page.$('[data-toggle-ex][data-id="' + id + '"]'))){ await page.click('[data-toggle-day-summary][data-key="d1"]'); await w(400); }
  await page.click('[data-toggle-ex][data-id="' + id + '"]'); await page.waitForSelector('.ledger [data-id="' + id + '"]'); await w(500);
}
async function calcSheetText(page){
  await page.click('.info-btn[data-open-sheet="laskenta"]'); await page.waitForSelector('.sheet'); await w(300);
  const t = await page.$eval('.sheet', el => el.textContent.replace(/\s+/g, ' '));
  await page.keyboard.press('Escape'); await w(300);
  return t;
}
async function openSettings(page, key){
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="' + key + '"]'); await w(450);
}
async function saveMaxInSettings(page, name, weight){
  await openSettings(page, '1rm');
  await page.fill('#max-name-input', name);
  await page.fill('#max-weight-input', weight);
  await page.click('#save-max-btn'); await w(400);
}
async function editorDay(page){
  await page.click('[data-edit-program]'); await w(500);
  while(await page.$('[data-edit-back]')){ await page.click('[data-edit-back]'); await w(350); }
  await page.click('[data-edit-open-week="1"]'); await w(350);
  await page.click('[data-edit-open-day="d1"]'); await w(350);
}
async function pick(page, name){
  await page.fill('#liike-haku', name); await w(200);
  await page.click('#liike-lista [data-pick-exercise="' + name + '"]'); await w(400);
}
const maxRow = (page, key) => page.evaluate(k => {
  const rows = [...document.querySelectorAll('.ledger-row')].filter(r => r.querySelector('[data-delete-max], [data-adopt-max]') || r.textContent);
  const row = rows.find(r => (r.firstElementChild.firstElementChild || {}).textContent.trim().toLowerCase() === k);
  if(!row) return null;
  const cells = row.children;
  const est = row.querySelector('.max-estimate');
  const btn = row.querySelector('[data-adopt-max]');
  const valEl = cells[1] && !cells[1].classList.contains('max-estimate') ? cells[1] : null;
  return { value: valEl ? valEl.textContent.trim() : '', spans: row.firstElementChild.style.gridColumn || '', note: (row.querySelector('.max-row-note') || {}).textContent || null,
    est: est ? est.querySelector('span').textContent.trim() : null, btn: btn ? btn.textContent.trim() : null,
    btnWeight: btn ? btn.getAttribute('data-weight') : null, del: !!row.querySelector('[data-delete-max]') };
}, key);
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
async function uploadBackup(page, text, name){
  await page.setInputFiles('#import-entries-input', { name: name || 'varmuuskopio.csv', mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') });
  await w(700);
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('=== 1 prosenttiteho 1RM-pohjasta (kapea)');
  await seed(page, { max: { [kb(BENCH)]: { weight: 100, date: '2026-09-01' } } });
  await openEx(page, 'p1');
  ok((await weights(page, 'p1')).join() === '70,70,70', '1 70 % penkin 1RM:stä 100 kg = 70 kg: ' + (await weights(page, 'p1')).join());
  let t = await calcSheetText(page);
  ok(t.indexOf('Paino 70 % 1RM-pohjan ”' + BENCH + '” 1RM:stä (100 kg).') !== -1, '1 ⓘ kertoo 1RM-pohjan ja sen arvon: ' + t.slice(0, 200));

  console.log('=== 2 pohjan 1RM 102,5 kg → 72,5 kg ilman muita toimia (kapea)');
  await saveMaxInSettings(page, BENCH, '102,5');
  let mx = await savedMax(page);
  ok(mx[kb(BENCH)] && mx[kb(BENCH)].weight === 102.5, '2 penkin 1RM tallentui 102,5: ' + JSON.stringify(mx));
  await page.click('[data-tab="ohjelma"]'); await w(500);
  await openEx(page, 'p1');
  ok((await weights(page, 'p1')).join() === '72,5,72,5,72,5', '2 ehdotus 72,5 kg: ' + (await weights(page, 'p1')).join('|'));
  t = await calcSheetText(page);
  ok(t.indexOf('1RM-pohjan ”' + BENCH + '” 1RM:stä (102,5 kg)') !== -1, '2 ⓘ kertoo uuden arvon');

  console.log('=== 3 sama leveässä asettelussa: avoin paneeli päivittyy');
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page, { max: { [kb(BENCH)]: { weight: 100, date: '2026-09-01' } } });
  await openEx(page, 'p1');
  ok((await weights(page, 'p1')).join() === '70,70,70', '3 paneelissa 70 kg');
  await saveMaxInSettings(page, BENCH, '102,5');
  await page.click('[data-tab="ohjelma"]'); await w(500);
  const stillOpen = !!(await page.$('.ohjelma-pane [data-set-field][data-id="p1"]'));
  if(!stillOpen) await openEx(page, 'p1');
  ok((await weights(page, 'p1')).join() === '72,5,72,5,72,5', '3 ehdotus 72,5 kg (' + (stillOpen ? 'paneeli auki, ei uudelleenavausta' : 'avattu uudelleen') + '): ' + (await weights(page, 'p1')).join('|'));
  ok(stillOpen, '3 paneeli pysyi auki välilehden vaihdon yli');
  await page.setViewportSize({ width: 390, height: 900 });

  console.log('=== 4 pohjalla ei 1RM:ää');
  await seed(page, {});
  await openEx(page, 'p1');
  ok((await weights(page, 'p1')).join() === ',,', '4 ei ehdotusta');
  t = await calcSheetText(page);
  ok(t.indexOf('Liikkeelle ”' + BENCH + '” (1RM-pohja) ei ole vielä 1RM-arvoa, joten painoa ei ehdotettu.') !== -1, '4 ⓘ kertoo puuttuvan pohjan 1RM:n: ' + t.slice(0, 200));

  console.log('=== 5 MAX käyttää ja päivittää omaa 1RM:ää, 1RM-pohja ei vaikuta');
  await seed(page, { program: program(SQUAT), max: { [kb(BENCH)]: { weight: 100, date: '2026-09-01' }, [kb(SQUAT)]: { weight: 150, date: '2026-09-01' } } });
  await openEx(page, 'b1');
  ok((await weights(page, 'b1')).join() === '100', '5 MAX-sarjassa oma 1RM 100, ei pohjan 150: ' + (await weights(page, 'b1')).join());
  await page.evaluate(() => { const el = document.querySelector('[data-set-field][data-field="weight"][data-id="b1"]'); el.value = '105'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await w(200);
  await page.click('[data-toggle-done][data-id="b1"][data-idx="0"]'); await w(350);
  await page.keyboard.press('Escape'); await w(300);
  await page.click('[data-save-ex][data-id="b1"]'); await w(700);
  mx = await savedMax(page);
  ok(mx[kb(BENCH)].weight === 105 && mx[kb(SQUAT)].weight === 150, '5 MAX-kirjaus päivitti oman 1RM:n (105), pohja ennallaan (150): ' + JSON.stringify(mx));
  if(await page.$('[data-close-ex]')){ await page.click('[data-close-ex]'); await w(400); }
  await openEx(page, 'p1');
  ok((await weights(page, 'p1')).join() === '72,5,72,5,72,5', '5 pysäytyspenkki seuraa penkin uutta 1RM:ää (105 × 70 % → 72,5)');

  console.log('=== 6 CSV-tuonti 1RM-pohja-sarakkeella ja ilman');
  await seed(page, { program: null });
  const csv1 = 'Viikko;Treenipäivä;Liike;Sarjat;Toistot;Teho;1RM-pohja\n' +
    '1;1;' + BENCH + ';1;1;MAX;\n' +
    '1;1;' + PAUSE + ';3;3;70 %;' + BENCH + '\n' +
    '1;1;Kulmasoutu;3;8;;\n';
  await page.setInputFiles('#program-file-initial', { name: 'ohjelma.csv', mimeType: 'text/csv', buffer: Buffer.from(csv1, 'utf8') });
  await w(900);
  let p = await savedProgram(page);
  let exs = p ? p.days[0].exercises : [];
  ok(exs.length === 3 && exs[0].name === BENCH && exs[1].name === PAUSE && exs[2].name === 'Kulmasoutu', '6 liikkeiden nimet oikein (1RM-pohja ei vie Liike-saraketta): ' + exs.map(e => e.name).join(' | '));
  ok(exs[1] && exs[1].maxRef === BENCH && exs[1].intensity && exs[1].intensity.percents.join() === '70', '6 1RM-pohja luettu ja teho ennallaan');
  ok(exs[0] && !('maxRef' in exs[0]) && !('maxRef' in exs[2]), '6 tyhjä solu ei lisää kenttää');
  ok(exs[1] && Object.keys(exs[1]).join() === 'id,name,sets,reps,unit,weight,notes,intensity,kind,autoCalc,maxRef', '6 avainjärjestys (1RM-pohja viimeisenä): ' + (exs[1] ? Object.keys(exs[1]).join() : ''));
  await seed(page, { program: null });
  const csv2 = 'Viikko;Treenipäivä;Liike;Sarjat;Toistot;Teho\n1;1;' + PAUSE + ';3;3;70 %\n1;1;Kulmasoutu;3;8;\n';
  await page.setInputFiles('#program-file-initial', { name: 'vanha.csv', mimeType: 'text/csv', buffer: Buffer.from(csv2, 'utf8') });
  await w(900);
  p = await savedProgram(page);
  exs = p ? p.days[0].exercises : [];
  ok(exs.length === 2 && exs.every(e => Object.keys(e).join() === 'id,name,sets,reps,unit,weight,notes,intensity,kind,autoCalc'), '6 sarakkeeton CSV tuodaan ennallaan: ' + exs.map(e => Object.keys(e).join()).join(' | '));
  await seed(page, { program: null });
  const csv3 = 'Liike;Sarjat;Toistot;Teho;1RM pohja;Huomiot\n' + PAUSE + ';3;3;70 %;' + BENCH + ';tauko rinnalla\n';
  await page.setInputFiles('#program-file-initial', { name: 'alias.csv', mimeType: 'text/csv', buffer: Buffer.from(csv3, 'utf8') });
  await w(900);
  p = await savedProgram(page);
  exs = p ? p.days[0].exercises : [];
  ok(exs[0] && exs[0].maxRef === BENCH && exs[0].name === PAUSE && exs[0].notes === 'tauko rinnalla', '6 alias "1RM pohja" tunnistetaan, huomiot ennallaan');

  console.log('=== 7 varmuuskopio: 1RM-pohja viimeisenä sarakkeena ja kierros');
  await seed(page, { max: { [kb(BENCH)]: { weight: 100, date: '2026-09-01' } } });
  await openSettings(page, 'varmuuskopio');
  const backup = await download(page);
  const progLines = sectionLines(backup, '#OHJELMA');
  ok(progLines[0] && /,"Viitetoistot","1RM-pohja"$/.test(progLines[0]), '7 otsikon viimeiset sarakkeet Viitetoistot, 1RM-pohja: ' + (progLines[0] || '').slice(-40));
  const pauseLine = progLines.find(l => l.indexOf('"p1"') !== -1) || '';
  ok(/,"Penkkipunnerrus tangolla, Suora tanko"$/.test(pauseLine), '7 pysäytyspenkin rivillä 1RM-pohja: ' + pauseLine.slice(-60));
  ok(progLines.filter(l => l.indexOf('"b1"') !== -1 || l.indexOf('"k1"') !== -1).every(l => /,""$/.test(l)), '7 muilla riveillä tyhjä 1RM-pohja');
  await seed(page, { program: null });
  await uploadBackup(page, backup);
  await page.click('[data-restore-confirm]'); await w(900);
  p = await savedProgram(page);
  ok(p && canon(p.days) === canon(PROGRAM.days), '7 palautettu ohjelma = alkuperäinen, 1RM-pohja mukana');
  ok(p && JSON.stringify(p.days[0].exercises) === JSON.stringify(PROGRAM.days[0].exercises), '7 liikkeet merkkijonona samat (avainjärjestys)');
  mx = await savedMax(page);
  ok(mx[kb(BENCH)] && mx[kb(BENCH)].weight === 100 && mx[kb(BENCH)].date === '2026-09-01', '7 1RM palautui päivineen');

  console.log('=== 8 vanha varmuuskopio ilman 1RM-pohja-saraketta');
  const oldBackup = backup.split('\n').map((l, i, all) => {
    const start = all.findIndex(x => x.trim() === '"#OHJELMA"');
    let end = all.findIndex((x, j) => j > start && /^"#/.test(x.trim()));
    if(end === -1) end = all.length;
    return (i > start && i < end && l.trim()) ? l.slice(0, l.lastIndexOf('","') + 1) : l;
  }).join('\n');
  ok(/,"Viitetoistot"$/.test(sectionLines(oldBackup, '#OHJELMA')[0]) && sectionLines(oldBackup, '#OHJELMA').every(l => l.indexOf('1RM-pohja') === -1 && !/,"Penkkipunnerrus tangolla, Suora tanko"$/.test(l)), '8 vanhan muodon otsikko päättyy Viitetoistot-sarakkeeseen');
  await seed(page, { program: null });
  await uploadBackup(page, oldBackup, 'vanha.csv');
  await page.click('[data-restore-confirm]'); await w(900);
  p = await savedProgram(page);
  const expectOld = JSON.parse(JSON.stringify(PROGRAM.days));
  expectOld[0].exercises.forEach(e => { delete e.maxRef; });
  ok(p && JSON.stringify(p.days) === JSON.stringify(expectOld), '8 palautuu ennallaan ilman 1RM-pohjaa');

  console.log('=== 9 1RM-yhdistäminen päivämäärän mukaan');
  await seed(page, { max: { [kb(BENCH)]: { weight: 105, date: '2026-09-20' }, [kb(SQUAT)]: { weight: 150, date: '2026-09-01' } } });
  await openSettings(page, 'varmuuskopio');
  const max1 = '"#1RM"\n"Liike","1RM (kg)","Päivitetty"\n' +
    '"' + BENCH + '","100","2026-09-10"\n' +      // vanhempi → ohitetaan
    '"' + SQUAT + '","160","2026-09-22"\n' +      // uudempi → päivitetään
    '"Maastaveto","200","2026-09-05"\n' +         // puuttuu → lisätään
    '"' + PAUSE + '","80",""\n';                  // puuttuu, ei päivää → lisätään tälle päivälle
  await uploadBackup(page, max1, 'max1.csv');
  const t9 = await toast(page);
  mx = await savedMax(page);
  ok(mx[kb(BENCH)].weight === 105 && mx[kb(BENCH)].date === '2026-09-20', '9 vanhempi varmuuskopio ei laske tuoreempaa arvoa: ' + JSON.stringify(mx[kb(BENCH)]));
  ok(mx[kb(SQUAT)].weight === 160 && mx[kb(SQUAT)].date === '2026-09-22', '9 uudempi varmuuskopion arvo päivittyy: ' + JSON.stringify(mx[kb(SQUAT)]));
  ok(mx.maastaveto && mx.maastaveto.weight === 200 && mx.maastaveto.date === '2026-09-05', '9 puuttuva arvo lisätään päivineen');
  ok(mx[kb(PAUSE)] && mx[kb(PAUSE)].weight === 80 && mx[kb(PAUSE)].date === '2026-09-24', '9 päivätön lisätään tälle päivälle');
  ok(t9.indexOf('1RM-arvot (lisätty 2, päivitetty 1, ohitettu 1)') !== -1, '9 ilmoitus: ' + t9);
  const max2 = '"#1RM"\n"Liike","1RM (kg)","Päivitetty"\n' +
    '"' + BENCH + '","110","2026-09-20"\n' +      // sama päivä → ohitetaan
    '"' + SQUAT + '","170",""\n' +                // ei päivää → ohitetaan
    '"Maastaveto","210","2026-09-23"\n';          // uudempi → päivitetään
  await uploadBackup(page, max2, 'max2.csv');
  const t9b = await toast(page);
  mx = await savedMax(page);
  ok(mx[kb(BENCH)].weight === 105 && mx[kb(SQUAT)].weight === 160 && mx.maastaveto.weight === 210, '9 sama päivä ja päivätön ohitetaan, uudempi päivittyy: ' + JSON.stringify(mx));
  ok(t9b.indexOf('1RM-arvot (lisätty 0, päivitetty 1, ohitettu 2)') !== -1, '9 ilmoitus 2: ' + t9b);

  console.log('=== 10 1RM-luettelo: teholiikkeet, 1RM-pohja ja Kehityksen arvio');
  const H = (name, sets, kind) => ({ name, sets, kind: kind || 'plain', loggedAt: '' });
  const entries = {
    '2026-09-10': { date: '2026-09-10', exercises: { h1: Object.assign(H(SQUAT, [{ weight: '118', reps: '1' }]), { loggedAt: '2026-09-10T10:00:00.000Z' }) } },
    '2026-09-12': { date: '2026-09-12', exercises: { h2: Object.assign(H(BENCH, [{ weight: '100', reps: '3' }]), { loggedAt: '2026-09-12T10:00:00.000Z' }) } },
    '2026-09-15': { date: '2026-09-15', exercises: { h3: Object.assign(H(PAUSE, [{ weight: '70', reps: '3' }]), { loggedAt: '2026-09-15T10:00:00.000Z' }) } },
    '2026-09-18': { date: '2026-09-18', exercises: { h4: Object.assign(H(SQUAT, [{ weight: '130', reps: '6', subsets: 4 }], 'cluster'), { loggedAt: '2026-09-18T10:00:00.000Z' }) } },
    '2026-09-20': { date: '2026-09-20', exercises: { h5: Object.assign(H(BENCH, [{ weight: '105', reps: '1' }]), { loggedAt: '2026-09-20T10:00:00.000Z' }) } }
  };
  const maxBefore = { [kb(BENCH)]: { weight: 100, date: '2026-09-01' }, maastaveto: { weight: 200, date: '2026-08-01' } };
  await seed(page, { max: maxBefore, entries });
  await openSettings(page, '1rm');
  await w(500);
  const names10 = await page.$$eval('.ledger-row', rs => rs.map(r => r.firstElementChild.firstElementChild.textContent.trim()));
  ok(names10.join(' | ') === ['Maastaveto', BENCH, PAUSE, SQUAT].join(' | '), '10 luettelossa MAX-, prosentti- ja tallennetut liikkeet, ei tehotonta: ' + names10.join(' | '));
  let bench = await maxRow(page, kb(BENCH)), pause = await maxRow(page, kb(PAUSE)), squat = await maxRow(page, kb(SQUAT)), dl10 = await maxRow(page, 'maastaveto');
  ok(bench && bench.value === '100 kg' && bench.est === 'Kehityksen arvio 110 kg (12.9.)' && bench.btn === 'Käytä 110 kg', '10 penkki: arvio 4 vk parhaasta (100 × 3 → 110) ja painike: ' + JSON.stringify(bench));
  ok(pause && pause.value === '' && pause.spans !== '' && pause.note === 'Käyttää liikkeen ”' + BENCH + '” (100 kg) 1RM:ää' && pause.btn === null && !pause.del, '10 1RM-pohjan liike ilman omaa arvoa ja painiketta: ' + JSON.stringify(pause));
  ok(pause && pause.est === 'Kehityksen arvio 77,5 kg (15.9.)', '10 pohjaliikkeen oma arvio näkyy ilman painiketta');
  ok(squat && squat.value === 'Ei vielä asetettu' && squat.est === 'Kehityksen arvio 118 kg (10.9.)' && squat.btn === 'Käytä 117,5 kg', '10 kyykky: cluster ohitetaan, painike pyöristää alaspäin: ' + JSON.stringify(squat));
  ok(dl10 && dl10.value === '200 kg' && dl10.est === null && dl10.del, '10 tallennettu arvo ilman merkintöjä: ' + JSON.stringify(dl10));
  mx = await savedMax(page);
  ok(canon(mx) === canon(maxBefore), '10 arvio ei muuta tallennettua arvoa itsestään');
  await page.click('[data-adopt-max][data-name="' + kb(SQUAT) + '"]'); await w(400);
  mx = await savedMax(page);
  squat = await maxRow(page, kb(SQUAT));
  ok(mx[kb(SQUAT)] && mx[kb(SQUAT)].weight === 117.5 && mx[kb(SQUAT)].date === '2026-09-24', '10 Käytä tallentaa 117,5 kg tälle päivälle: ' + JSON.stringify(mx[kb(SQUAT)]));
  ok(squat.value === '117,5 kg' && squat.est === 'Kehityksen arvio 118 kg (10.9.)' && squat.btn === null, '10 arvio näkyy yhä (poikkeaa), painike poistui (sama pyöristettynä): ' + JSON.stringify(squat));
  await page.click('[data-adopt-max][data-name="' + kb(BENCH) + '"]'); await w(400);
  bench = await maxRow(page, kb(BENCH));
  ok(bench.value === '110 kg' && bench.est === null, '10 penkin arvio otettu käyttöön, rivi ei enää poikkea: ' + JSON.stringify(bench));
  pause = await maxRow(page, kb(PAUSE));
  ok(pause.note === 'Käyttää liikkeen ”' + BENCH + '” (110 kg) 1RM:ää', '10 pohjaliikkeen selite seuraa uutta arvoa');
  const axeSrc = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  await page.addScriptTag({ content: axeSrc });
  let axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
  ok(axe.filter(v => v.indexOf('color-contrast') !== 0).length === 0, '10 axe: ' + JSON.stringify(axe));
  await page.click('[data-tab="ohjelma"]'); await w(500);
  await openEx(page, 'p1');
  ok((await weights(page, 'p1')).join() === '77,5,77,5,77,5', '10 käyttöön otettu arvio näkyy pohjaliikkeen ehdotuksessa (110 × 70 % → 77,5)');

  console.log('=== 10b sama liike sekä 1RM-pohjalla että omalla 1RM:llä');
  const mixed = program(null);
  mixed.days[0].exercises.push(ex('p2', PAUSE, '1', '1', 'MAX'));
  await seed(page, { program: mixed, max: maxBefore, entries });
  await openSettings(page, '1rm');
  await w(500);
  pause = await maxRow(page, kb(PAUSE));
  ok(pause && pause.value === 'Ei vielä asetettu' && pause.note === 'Prosenttisarjat käyttävät liikkeen ”' + BENCH + '” (100 kg) 1RM:ää' && pause.est === 'Kehityksen arvio 77,5 kg (15.9.)' && pause.btn === null,
    '10b oma arvo, selite ja arvio, ei painiketta (liikkeellä on 1RM-pohja): ' + JSON.stringify(pause));

  console.log('=== 11 tyhjä luettelo');
  await seed(page, { program: { days: [ { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [ ex('r1', 'Kulmasoutu', '3', '8', '') ] } ], weeks: ['1'], weekLabels: {}, id: 'prog-1', name: 'Testi' } });
  await openSettings(page, '1rm');
  const empty = await page.$eval('.empty-state', el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
  ok(empty && empty.indexOf('Ei teholiikkeitä') !== -1, '11 tyhjän luettelon teksti: ' + empty);

  console.log('=== 12 muokkaustila: 1RM-pohja valitaan liikelistasta');
  await seed(page, { max: { [kb(BENCH)]: { weight: 100, date: '2026-09-01' } } });
  await editorDay(page);
  await page.click('[data-edit-exercise="p1"]'); await w(400);
  let field = await page.$eval('[data-editor-maxref]', el => ({ text: el.textContent.trim(), label: el.getAttribute('aria-label') })).catch(() => null);
  ok(field && field.text === '1RM-pohja: ' + BENCH && !!(await page.$('[data-editor-maxref-clear]')), '12 Lisää asetuksia auki ja 1RM-pohja näkyy: ' + JSON.stringify(field));
  await page.click('[data-editor-maxref]'); await w(400);
  const sheet = await page.evaluate(() => ({ title: (document.querySelector('.sheet-title span') || {}).textContent, current: (document.querySelector('.pick-current b') || {}).textContent, focus: document.activeElement && document.activeElement.id }));
  ok(sheet.title === 'Valitse 1RM-pohja' && sheet.current === BENCH && sheet.focus === 'liike-haku', '12 sama liikelista otsikolla Valitse 1RM-pohja: ' + JSON.stringify(sheet));
  await pick(page, SQUAT);
  const after = await page.evaluate(() => ({ ref: (document.querySelector('[data-editor-maxref]') || {}).textContent, name: (document.querySelector('[data-editor-name]') || {}).textContent, focus: !!(document.activeElement && document.activeElement.hasAttribute('data-editor-maxref')) }));
  ok(after.ref.trim() === '1RM-pohja: ' + SQUAT && after.name.trim() === PAUSE && after.focus, '12 valinta kirjoittaa 1RM-pohjan, nimi ennallaan, fokus kenttään: ' + JSON.stringify(after));
  await page.addScriptTag({ content: axeSrc });
  axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
  ok(axe.filter(v => v.indexOf('color-contrast') !== 0).length === 0, '12 axe lomake: ' + JSON.stringify(axe));
  await page.click('[data-edit-form-save]'); await w(400);
  await page.click('[data-edit-done]'); await w(700);
  p = await savedProgram(page);
  let pe = p.days[0].exercises.find(e => e.name === PAUSE);
  ok(pe && pe.id === 'p1' && pe.maxRef === SQUAT, '12 tallentui, id ennallaan: ' + JSON.stringify(pe));
  await editorDay(page);
  await page.click('[data-edit-exercise="p1"]'); await w(400);
  await page.click('[data-editor-maxref-clear]'); await w(400);
  field = await page.$eval('[data-editor-maxref]', el => ({ text: el.textContent.trim(), focus: document.activeElement === el }));
  ok(field.text === '1RM-pohja (valinnainen)' && field.focus && !(await page.$('[data-editor-maxref-clear]')), '12 Tyhjennä poistaa 1RM-pohjan kentästä: ' + JSON.stringify(field));
  await page.click('[data-edit-form-save]'); await w(400);
  await page.click('[data-edit-done]'); await w(700);
  p = await savedProgram(page);
  pe = p.days[0].exercises.find(e => e.id === 'p1');
  ok(pe && !('maxRef' in pe), '12 poistettu 1RM-pohja ei jää ohjelmaan');

  console.log('=== 13 uusi liike 1RM-pohjalla');
  await editorDay(page);
  await page.click('[data-edit-add-exercise="d1"]'); await w(500);
  await pick(page, 'Kulmasoutu');
  if(!(await page.$('[data-editor-maxref]'))){ await page.click('[data-edit-form-more]'); await w(300); }
  await page.fill('[data-editor-field="teho"]', '75 %');
  await page.click('[data-editor-maxref]'); await w(400);
  await pick(page, BENCH);
  await page.click('[data-editor-name]'); await w(400);
  const nameSheet = await page.evaluate(() => ({ title: (document.querySelector('.sheet-title span') || {}).textContent, current: (document.querySelector('.pick-current b') || {}).textContent }));
  ok(nameSheet.title === 'Valitse liike' && nameSheet.current === 'Kulmasoutu', '13 nimikenttä avaa liikevalitsimen nimelle: ' + JSON.stringify(nameSheet));
  await page.keyboard.press('Escape'); await w(300);
  await page.click('[data-edit-form-save]'); await w(400);
  await page.click('[data-edit-done]'); await w(700);
  p = await savedProgram(page);
  const added = p.days[0].exercises[p.days[0].exercises.length - 1];
  ok(added && added.name === 'Kulmasoutu' && added.maxRef === BENCH && added.intensity && added.intensity.percents.join() === '75' && Object.keys(added).pop() === 'maxRef', '13 uusi liike 1RM-pohjineen (viimeinen avain): ' + JSON.stringify(added));

  ok(errors.length === 0, 'ei sivuvirheitä: ' + errors.join('; '));
  await browser.close();
  console.log(fails ? ('FAILS: ' + fails) : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
