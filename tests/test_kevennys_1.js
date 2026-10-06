// Kevennysmerkinnän säilyminen saman päivän uudelleentallennuksessa (0.4.28,
// kevennys-sarja 1/4): jumikevennyksen tallennus, saman päivän uudelleen-
// tallennus, seuraavan kerran ehdotus, tavallinen liike ja korjaus toiselle
// päivälle (kehotteen tapaukset 1–5) sekä deloadForSave suoraan kutsuen.
// Luonnoksen tyypin lukemiseksi sivulle tarjoillaan reitityksessä index.html,
// jonka sulkeuman loppuun on lisätty window.__t-viittaukset; tiedostoon
// itseensä ei kosketa.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const nb = s => s == null ? s : String(s).replace(/[  ]/g, ' ');
const ROW = 'Kulmasoutu tangolla';
const BENCH = 'Penkkipunnerrus tangolla';
const kb = n => n.trim().toLowerCase();

const EXPOSE = ['state', 'deloadForSave'];
function instrumentedHtml(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const marker = '})();\n</script>';
  const i = html.lastIndexOf(marker);
  if(i === -1) throw new Error('index.html: sovelluksen sulkeuman loppua ei löytynyt');
  const hook = 'window.__t = {' + EXPOSE.map(n => JSON.stringify(n) + ': (typeof ' + n + ' !== "undefined" ? ' + n + ' : null)').join(', ') + '};\n';
  return html.slice(0, i) + hook + html.slice(i);
}
function pex(id, name, sets, reps){ return { id, name, sets, reps, unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }; }
const prog = exercises => ({ id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises } ] });
// lastSet-kerta: sarjat ilman tuntumaa.
const S = (wt, r) => ({ weight: String(wt), reps: String(r), done: true, rpe: null });
const sess = (date, wt, r, extra) => Object.assign({ sets: [S(wt, r), S(wt, r)], date }, extra || {});
const LAST_ROW = { [kb(ROW)]: Object.assign(sess('2026-09-30', 100, 8), { prior: [sess('2026-09-26', 100, 9), sess('2026-09-22', 100, 10)] }) };

async function seed(page, o){
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(o.program));
    if(o.last) localStorage.setItem('treenipk:last-set-log', JSON.stringify(o.last));
    Object.keys(o.entries || {}).forEach(d => localStorage.setItem('treenipk:entries:' + d, JSON.stringify(o.entries[d])));
  }, o);
  await page.goto(URL);
  await page.waitForSelector('.next-card'); await w(400);
}
async function openEx(page, id){
  if(!(await page.$('[data-toggle-ex][data-id="' + id + '"]'))){ await page.click('[data-toggle-day-summary][data-key="d1"]'); await w(400); }
  await page.click('[data-toggle-ex][data-id="' + id + '"]');
  await page.waitForSelector('.ledger [data-save-ex][data-id="' + id + '"]'); await w(450);
}
async function closeKeypad(page){
  if(await page.$('#keypad')){ await page.click('[data-keypad-close]'); await w(300); }
}
// Kentän arvo samaa polkua kuin kirjoitettaessa (input-tapahtuma).
async function fill(page, id, idx, field, val){
  await page.evaluate(a => {
    const el = document.querySelector('.ledger [data-set-field][data-id="' + a.id + '"][data-idx="' + a.idx + '"][data-field="' + a.field + '"]');
    el.value = a.val; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, idx, field, val });
  await w(150);
}
// ✓ avaa RPE-ikkunan, joka suljetaan Escapella valitsematta tuntumaa.
async function done(page, id, idx){
  await closeKeypad(page);
  await page.click('.ledger [data-toggle-done][data-id="' + id + '"][data-idx="' + idx + '"]'); await w(350);
  await page.keyboard.press('Escape'); await w(350);
}
async function save(page, id){
  await closeKeypad(page);
  await page.click('.ledger [data-save-ex][data-id="' + id + '"]'); await w(900);
}
const view = (page, id) => page.evaluate(id => {
  const val = (i, f) => { const el = document.querySelector('.ledger [data-set-field][data-id="' + id + '"][data-idx="' + i + '"][data-field="' + f + '"]'); return el ? el.value : null; };
  const info = window.__t.state.autoCalcInfo[id] || {};
  const save = document.querySelector('.ledger [data-save-ex][data-id="' + id + '"]');
  return { weights: [val(0, 'weight'), val(1, 'weight')], reps: [val(0, 'reps'), val(1, 'reps')], type: info.type || null, plateau: !!info.plateau,
    target: (document.querySelector('main .exercise-target') || {}).textContent || null, saveEnabled: !!save && !save.disabled };
}, id);
const stored = (page, date, name) => page.evaluate(a => {
  const e = JSON.parse(localStorage.getItem('treenipk:entries:' + a.date) || 'null');
  const all = JSON.parse(localStorage.getItem('treenipk:last-set-log') || '{}');
  const top = all[a.key] || null;
  return { entry: e, top: top ? { date: top.date, deload: top.deload, priorDates: (top.prior || []).map(p => p.date), priorDeload: (top.prior || []).map(p => !!p.deload) } : null };
}, { date, key: kb(name) });

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  const body = instrumentedHtml();
  await page.route('**/index.html', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00'));
  let v, s;

  console.log('=== 0 deloadForSave suoraan');
  await seed(page, { program: prog([pex('A', ROW, '2', '10')]), last: LAST_ROW });
  const u = await page.evaluate(() => {
    const f = window.__t.deloadForSave;
    const j = x => JSON.stringify(x);
    return {
      newPlateau: j(f(undefined, { type: 'formula', plateau: true })), newPlain: j(f(undefined, { type: 'formula' })), newNone: j(f(undefined, undefined)),
      savedTrue: j(f({ date: '2026-10-06', data: { deload: true } }, { type: 'saved' })),
      savedFalseWins: j(f({ date: '2026-10-06', data: { deload: false } }, { type: 'formula', plateau: true })),
      oldNoField: j(f({ date: '2026-10-01', data: {} }, { plateau: true })),
      correctionTrue: j(f({ date: '2026-10-01', data: { deload: true } }, { type: 'saved' }))
    };
  });
  ok(u.newPlateau === '{"deload":true}' && u.newPlain === '{"deload":false}' && u.newNone === '{"deload":false}', '0 uusi kirjaus: kevennys jumitunnistuksesta (plateau), muuten false');
  ok(u.savedTrue === '{"deload":true}' && u.correctionTrue === '{"deload":true}', '0 tallennettu merkintä deload: true säilyy (sama päivä ja korjaus)');
  ok(u.savedFalseWins === '{"deload":false}' && u.oldNoField === '{"deload":false}', '0 tallennettu merkintä voittaa luonnoksen plateau-tiedon; vanha merkintä ilman kenttää → false');

  console.log('=== 1 jumikevennys ja ensimmäinen tallennus (6.10.)');
  await openEx(page, 'A');
  v = await view(page, 'A');
  ok(JSON.stringify(v.weights) === '["90","90"]' && v.plateau && nb(v.target) === '2 sarjaa · 10 toistoa · RPE 8 · kevennys −10 kg', '1 painot 90 ja 90, tavoiterivillä kevennys −10 kg: ' + JSON.stringify([v.weights, nb(v.target)]));
  await fill(page, 'A', 0, 'reps', '9'); await fill(page, 'A', 1, 'reps', '9');
  await done(page, 'A', 0); await done(page, 'A', 1);
  await save(page, 'A');
  s = await stored(page, '2026-10-06', ROW);
  ok(s.entry && s.entry.exercises.A && s.entry.exercises.A.deload === true, '1 merkinnän deload true: ' + JSON.stringify(s.entry && s.entry.exercises.A && s.entry.exercises.A.deload));
  ok(s.entry && JSON.stringify(s.entry.exercises.A.sets.map(x => [x.weight, x.reps])) === '[["90","9"],["90","9"]]', '1 sarjat 90 × 9 ja 90 × 9');
  ok(s.top && s.top.date === '2026-10-06' && s.top.deload === true && JSON.stringify(s.top.priorDates) === '["2026-09-30","2026-09-26"]', '1 lastSet päällimmäinen 6.10. deload true, prior 30.9. ja 26.9.: ' + JSON.stringify(s.top));

  console.log('=== 2 saman päivän uudelleentallennus (luonnos "saved")');
  await openEx(page, 'A');
  v = await view(page, 'A');
  ok(v.type === 'saved' && !v.plateau && v.saveEnabled && JSON.stringify(v.reps) === '["9","9"]', '2 avattu tallennetusta merkinnästä, Tallenna käytössä: ' + JSON.stringify([v.type, v.saveEnabled, v.reps]));
  await save(page, 'A');
  s = await stored(page, '2026-10-06', ROW);
  ok(s.entry && s.entry.exercises.A.deload === true && !s.entry.exercises.A.editedAt, '2 merkinnän deload säilyy true (ennen korjausta false): ' + JSON.stringify(s.entry && s.entry.exercises.A.deload));
  ok(s.top && s.top.date === '2026-10-06' && s.top.deload === true, '2 lastSet päällimmäinen deload säilyy true: ' + JSON.stringify(s.top));
  ok(s.top && JSON.stringify(s.top.priorDates) === '["2026-09-30","2026-09-26"]', '2 prior ennallaan: ' + JSON.stringify(s.top && s.top.priorDates));
  await page.click('.tab[data-tab="historia"]'); await page.waitForSelector('#history-list'); await w(450);
  const badge = await page.evaluate(() => [...document.querySelectorAll('.history-date-head[data-date="2026-10-06"] .history-badge')].map(b => b.textContent));
  ok(JSON.stringify(badge) === '["kevennys"]', '2 Historian päiväkortissa kevennys-merkki: ' + JSON.stringify(badge));

  console.log('=== 3 seuraava kerta (9.10.) ei kevennä uudelleen');
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(p => localStorage.setItem('treenipk:workout-program', JSON.stringify(p)), prog([pex('A', ROW, '2', '10'), pex('A2', ROW, '2', '10')]));
  await page.clock.setFixedTime(new Date('2026-10-09T12:00:00'));
  await page.goto(URL);
  await page.waitForSelector('.bottom-nav'); await w(400);
  if(await page.$('[data-close-ex]')){ await page.click('[data-close-ex]'); await w(600); }
  await page.waitForSelector('.next-card'); await w(300);
  const draftDate = await page.evaluate(() => window.__t.state.draftDate);
  await openEx(page, 'A2');
  v = await view(page, 'A2');
  ok(draftDate === '2026-10-09' && JSON.stringify(v.weights) === '["90","90"]' && !v.plateau, '3 painot 90 ja 90 (ennen korjausta 80 ja 80): ' + JSON.stringify([draftDate, v.weights]));
  ok(nb(v.target) === '2 sarjaa · 10 toistoa · RPE 8 · ehdotus sama paino', '3 tavoiterivillä ehdotus sama paino: ' + nb(v.target));
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00'));

  console.log('=== 4 tavallinen liike ei saa kevennystä');
  await seed(page, { program: prog([pex('B', BENCH, '2', '8')]), last: { [kb(BENCH)]: Object.assign(sess('2026-10-02', 80, 8), { prior: [] }) } });
  await openEx(page, 'B');
  v = await view(page, 'B');
  ok(JSON.stringify(v.weights) === '["82,5","82,5"]' && !v.plateau, '4 ehdotus 82,5 ja 82,5: ' + JSON.stringify(v.weights));
  await done(page, 'B', 0); await done(page, 'B', 1);
  await save(page, 'B');
  s = await stored(page, '2026-10-06', BENCH);
  const b1 = s.entry && s.entry.exercises.B;
  ok(b1 && b1.deload === false && b1.plan && b1.plan.suggestedWeight === 82.5, '4 ensimmäinen tallennus: deload false, plan.suggestedWeight 82,5: ' + JSON.stringify(b1 && [b1.deload, b1.plan]));
  await openEx(page, 'B');
  v = await view(page, 'B');
  ok(v.type === 'saved', '4 avattu tallennetusta merkinnästä');
  await save(page, 'B');
  s = await stored(page, '2026-10-06', BENCH);
  const b2 = s.entry && s.entry.exercises.B;
  ok(b2 && b2.deload === false && b2.plan && b2.plan.suggestedWeight === 82.5, '4 uudelleentallennus: deload false, plan.suggestedWeight 82,5: ' + JSON.stringify(b2 && [b2.deload, b2.plan]));
  ok(s.top && s.top.date === '2026-10-06' && !s.top.deload && JSON.stringify(s.top.priorDates) === '["2026-10-02"]', '4 lastSet päällimmäinen ilman kevennystä, prior 2.10.: ' + JSON.stringify(s.top));

  console.log('=== 5 korjaus toiselle päivälle ennallaan');
  const plan5 = { sets: 2, reps: 10, suggestedWeight: 90 };
  const entry1 = { date: '2026-10-01', exercises: { A: { name: ROW, sets: [{ weight: '90', reps: '9', notes: '', done: true, kind: 'work' }, { weight: '90', reps: '9', notes: '', done: true, kind: 'work' }],
    loggedAt: '2026-10-01T10:00:00.000Z', deload: true, warmups: [], plan: plan5, kind: 'plain' } } };
  await seed(page, { program: prog([pex('A', ROW, '2', '10')]), entries: { '2026-10-01': entry1 },
    last: { [kb(ROW)]: Object.assign(sess('2026-10-01', 90, 9), { deload: true, prior: [sess('2026-09-30', 100, 8), sess('2026-09-26', 100, 9)] }) } });
  await openEx(page, 'A');
  v = await view(page, 'A');
  ok(v.type === 'saved' && JSON.stringify(v.reps) === '["9","9"]', '5 avattu 1.10. merkinnästä: ' + JSON.stringify([v.type, v.reps]));
  await fill(page, 'A', 1, 'reps', '10');
  await save(page, 'A');
  const toast = await page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  s = await stored(page, '2026-10-01', ROW);
  const a5 = s.entry && s.entry.exercises.A;
  ok(a5 && a5.deload === true && !!a5.editedAt && JSON.stringify(a5.sets.map(x => x.reps)) === '["9","10"]', '5 korjattu merkintä: deload true, editedAt, toistot 9 ja 10: ' + JSON.stringify(a5 && [a5.deload, a5.editedAt, a5.sets.map(x => x.reps)]));
  ok(a5 && JSON.stringify(a5.plan) === JSON.stringify(plan5), '5 plan ennallaan: ' + JSON.stringify(a5 && a5.plan));
  const e6 = await page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:entries:2026-10-06') || 'null'));
  ok(!(e6 && e6.exercises && e6.exercises.A), '5 6.10. merkinnässä ei A:ta: ' + JSON.stringify(e6));
  ok(toast === 'Merkintä korjattu (1.10.)' && s.top && s.top.date === '2026-10-01' && s.top.deload === true, '5 ilmoitus ja lastSet rakennettu merkinnöistä kevennyksineen: ' + JSON.stringify([toast, s.top]));

  console.log('=== 6 Muutokset');
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="muutokset"]'); await w(500);
  const muutokset = await page.evaluate(() => document.querySelector('main').textContent);
  ok(muutokset.indexOf('Kevennysmerkintä säilyy nyt, kun jo tallennettu liike tallennetaan samana päivänä uudelleen (versio 0.4.28)') !== -1, '6 Muutokset-merkintä 0.4.28');

  ok(errors.length === 0, 'ei sivuvirheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
