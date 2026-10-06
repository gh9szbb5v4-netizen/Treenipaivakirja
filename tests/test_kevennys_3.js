// Liikekohtainen pyydetty kevennys (0.4.30, kevennys-sarja 3/4): kytkin
// Painojen laskenta -ikkunassa, osittain tehty kerta, tallennus lajilla
// "pyydetty", seuraavan kerran viitekerta, vain pyydettyjä kevennyksiä
// ketjussa, jumikevennys ilman kytkintä, lämmittely kevennyksessä,
// työsarjatasoinen lämmittely, saman päivän uudelleentallennus,
// jälkikäteinen merkintä, automaattisen kevennyksen lukitus, kelpaamattomat
// liikkeet, päivän vaihto sekä korjaus ja varmuuskopio (kehotteen tapaukset
// 1–14). Tilan lukemiseksi sivulle tarjoillaan reitityksessä index.html,
// jonka sulkeuman loppuun on lisätty window.__t-viittaukset; tiedostoon
// itseensä ei kosketa.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const nb = s => s == null ? s : String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const ROW = 'Kulmasoutu tangolla';
const kb = n => n.trim().toLowerCase();

const EXPOSE = ['state'];
function instrumentedHtml(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const marker = '})();\n</script>';
  const i = html.lastIndexOf(marker);
  if(i === -1) throw new Error('index.html: sovelluksen sulkeuman loppua ei löytynyt');
  const hook = 'window.__t = {' + EXPOSE.map(n => JSON.stringify(n) + ': (typeof ' + n + ' !== "undefined" ? ' + n + ' : null)').join(', ') + '};\n';
  return html.slice(0, i) + hook + html.slice(i);
}
function pex(id, name, sets, reps, extra){ return Object.assign({ id, name, sets, reps, unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [
    pex('A', ROW, '2', '10'),
    pex('A2', ROW, '2', '10'),
    pex('M', 'Maastaveto tangolla', '1', '1', { notes: 'MAX', intensity: { isMax: true, percents: [] } }),
    pex('C', 'Takakyykky tangolla', '2', '6', { kind: 'cluster', autoCalc: false }),
    pex('N', 'Pystypunnerrus tangolla seisten', '2', '10'),
    pex('P', 'Penkkipunnerrus tangolla', '2', '10') ] } ] };
const S = (wt, r, rpe) => ({ weight: String(wt), reps: String(r), done: true, rpe: rpe === undefined ? null : rpe });
const sess = (date, sets, extra) => Object.assign({ sets, date }, extra || {});
const LAST_ROW = sess('2026-10-02', [S(100, 10, 8), S(100, 10, 8)], { prior: [sess('2026-09-29', [S(97.5, 10, 8), S(97.5, 10, 8)])] });
const LAST = {
  [kb(ROW)]: LAST_ROW,
  'penkkipunnerrus tangolla': sess('2026-09-30', [S(100, 8), S(100, 8)], { prior: [sess('2026-09-26', [S(100, 9), S(100, 9)]), sess('2026-09-22', [S(100, 10), S(100, 10)])] }),
  'maastaveto tangolla': sess('2026-09-30', [S(150, 1)], { prior: [] })
};
const MAX = { 'maastaveto tangolla': { weight: 150, date: '2026-09-30' } };
const E = (wt, r, rpe) => { const o = { weight: String(wt), reps: String(r), notes: '', done: true, kind: 'work' }; if(rpe !== undefined) o.rpe = rpe; return o; };
function entry(date, id, sets, extra){
  return { date, exercises: { [id]: Object.assign({ name: ROW, sets, loggedAt: date + 'T15:00:00.000Z', warmups: [], kind: 'plain' }, extra || {}) } };
}

async function seed(page, o){
  o = o || {};
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(o.program));
    if(o.last) localStorage.setItem('treenipk:last-set-log', JSON.stringify(o.last));
    if(o.max) localStorage.setItem('treenipk:manual-1rm', JSON.stringify(o.max));
    Object.keys(o.entries || {}).forEach(d => localStorage.setItem('treenipk:entries:' + d, JSON.stringify(o.entries[d])));
  }, { program: PROGRAM, last: o.last === undefined ? LAST : o.last, max: MAX, entries: o.entries || {} });
  await page.goto(URL);
  await page.waitForSelector('.bottom-nav'); await w(400);
  if(await page.$('[data-close-ex]')){ await page.click('[data-close-ex]'); await w(500); }
}
async function openEx(page, id){
  // Tallennus avaa päivän seuraavan liikkeen kirjausruutuun: suljetaan ensin.
  if(await page.$('[data-close-ex]')){ await closeKeypad(page); await page.click('[data-close-ex]'); await w(500); }
  if(!(await page.$('[data-toggle-ex][data-id="' + id + '"]'))){ await page.click('[data-toggle-day-summary][data-key="d1"]'); await w(400); }
  await page.click('[data-toggle-ex][data-id="' + id + '"]');
  await page.waitForSelector('.ledger [data-save-ex][data-id="' + id + '"]'); await w(450);
}
async function closeEx(page){ await closeKeypad(page); await page.click('[data-close-ex]'); await w(500); }
async function closeKeypad(page){
  if(await page.$('#keypad')){ await page.click('[data-keypad-close]'); await w(300); }
}
const weights = (page, id) => page.evaluate(id => {
  const rows = (window.__t.state.draftSets[id] || []);
  return rows.map((r, i) => r.kind === 'warmup' ? null : (document.querySelector('.ledger [data-set-field][data-id="' + id + '"][data-idx="' + i + '"][data-field="weight"]') || {}).value).filter(v => v !== null);
}, id);
const target = page => page.evaluate(() => (document.querySelector('main .exercise-target') || {}).textContent || '').then(nb);
async function openSheet(page, id){
  await closeKeypad(page);
  await page.click('[data-open-sheet="laskenta"][data-id="' + id + '"]'); await page.waitForSelector('.sheet'); await w(300);
}
const sheet = page => page.evaluate(() => {
  const s = document.querySelector('.sheet');
  if(!s) return null;
  const req = s.querySelector('[data-request-deload]');
  const flag = s.querySelector('[data-flag-deload]');
  return { text: s.textContent.replace(/[  ]/g, ' ').replace(/\s+/g, ' '), req: req ? { t: req.textContent.trim(), pressed: req.getAttribute('aria-pressed') } : null, flag: flag ? flag.textContent.trim() : null };
});
async function closeSheet(page){ if(await page.$('.sheet')){ await page.keyboard.press('Escape'); await w(350); } }
async function toggleDeload(page){ await page.click('.sheet [data-request-deload]'); await w(350); }
// ✓ avaa RPE-ikkunan: tuntuma valitaan tai ikkuna suljetaan Escapella.
async function done(page, id, idx, rpe){
  await closeKeypad(page);
  await page.click('.ledger [data-toggle-done][data-id="' + id + '"][data-idx="' + idx + '"]'); await page.waitForSelector('.sheet'); await w(300);
  if(rpe){ await page.click('.sheet [data-warmup-rpe][data-rpe="' + rpe + '"]'); } else { await page.keyboard.press('Escape'); }
  await w(400);
}
async function save(page, id){ await closeKeypad(page); await page.click('.ledger [data-save-ex][data-id="' + id + '"]'); await w(900); }
async function fill(page, id, idx, field, val){
  await page.evaluate(a => {
    const el = document.querySelector('.ledger [data-set-field][data-id="' + a.id + '"][data-idx="' + a.idx + '"][data-field="' + a.field + '"]');
    el.value = a.val; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, idx, field, val });
  await w(150);
}
const stored = (page, date, id) => page.evaluate(a => {
  const e = JSON.parse(localStorage.getItem('treenipk:entries:' + a.date) || 'null');
  return e && e.exercises ? e.exercises[a.id] || null : null;
}, { date, id });
const lastTop = page => page.evaluate(k => {
  const t = (JSON.parse(localStorage.getItem('treenipk:last-set-log') || '{}'))[k];
  return t ? { date: t.date, deload: t.deload, deloadKind: t.deloadKind, prior: (t.prior || []).map(p => p.date), sets: t.sets.map(s => s.weight) } : null;
}, kb(ROW));
async function openSettings(page, key){
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="' + key + '"]'); await w(450);
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  const body = instrumentedHtml();
  await page.route('**/index.html', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00'));
  let s, x, t;

  console.log('=== 1 kytkin');
  await seed(page);
  await openEx(page, 'A');
  ok(JSON.stringify(await weights(page, 'A')) === '["102,5","102,5"]' && (await target(page)) === '2 sarjaa · 10 toistoa · RPE 8 · ehdotus +2,5 kg', '1 ehdotus 102,5 ja 102,5, ehdotus +2,5 kg: ' + await target(page));
  await openSheet(page, 'A');
  s = await sheet(page);
  ok(s.req && s.req.t === 'Kevennä tämä kerta (−10 %)' && s.req.pressed === 'false' && !s.flag, '1 ikkunassa painike Kevennä tämä kerta (−10 %): ' + JSON.stringify(s.req));
  await toggleDeload(page);
  s = await sheet(page);
  ok(JSON.stringify(await weights(page, 'A')) === '["90","90"]' && (await target(page)) === '2 sarjaa · 10 toistoa · RPE 8 · kevennys −10 kg', '1 päälle: 90 ja 90, kevennys −10 kg: ' + JSON.stringify(await weights(page, 'A')) + ' ' + await target(page));
  ok(s && s.text.indexOf('Kevennys pyydetty — tekemättömät sarjat −10 %. Kerta ei vaikuta seuraavan kerran ehdotukseen eikä 1RM-arvioon.') !== -1 && s.req.t === 'Peru kevennys' && s.req.pressed === 'true', '1 ikkunassa Kevennys pyydetty ja Peru kevennys: ' + JSON.stringify(s && s.req));
  await toggleDeload(page);
  ok(JSON.stringify(await weights(page, 'A')) === '["102,5","102,5"]' && (await target(page)) === '2 sarjaa · 10 toistoa · RPE 8 · ehdotus +2,5 kg', '1 pois: 102,5 ja 102,5, ehdotus +2,5 kg');

  console.log('=== 2 osittain tehty');
  await toggleDeload(page); await closeSheet(page);
  await done(page, 'A', 0);
  await openSheet(page, 'A'); await toggleDeload(page);
  ok(JSON.stringify(await weights(page, 'A')) === '["90","102,5"]', '2 pois: tehty 90 ja 102,5: ' + JSON.stringify(await weights(page, 'A')));
  await toggleDeload(page);
  ok(JSON.stringify(await weights(page, 'A')) === '["90","90"]', '2 uudelleen päälle: 90 ja 90: ' + JSON.stringify(await weights(page, 'A')));
  await closeSheet(page);

  console.log('=== 3 tallennus');
  await seed(page);
  await openEx(page, 'A');
  await openSheet(page, 'A'); await toggleDeload(page); await closeSheet(page);
  await done(page, 'A', 0, 6); await done(page, 'A', 1, 6);
  await save(page, 'A');
  x = await stored(page, '2026-10-06', 'A');
  ok(x && x.deload === true && x.deloadKind === 'pyydetty' && x.plan && x.plan.suggestedWeight === 90 && JSON.stringify(x.sets.map(r => r.weight)) === '["90","90"]', '3 merkintä: deload, pyydetty, plan 90, painot 90 ja 90: ' + JSON.stringify(x && [x.deload, x.deloadKind, x.plan, x.sets.map(r => r.weight)]));
  t = await lastTop(page);
  ok(t && t.date === '2026-10-06' && t.deload === true && t.deloadKind === 'pyydetty' && JSON.stringify(t.prior) === '["2026-10-02","2026-09-29"]', '3 lastSet päällimmäinen 6.10. pyydetty kevennys, prior 2.10. ja 29.9.: ' + JSON.stringify(t));
  const st3 = await page.evaluate(() => ({ req: window.__t.state.deloadRequest, flag: window.__t.state.deloadFlag }));
  ok(JSON.stringify(st3) === '{"req":{},"flag":{}}', '3 pyyntö nollattu tallennuksessa: ' + JSON.stringify(st3));

  console.log('=== 9 saman päivän uudelleentallennus');
  await openEx(page, 'A');
  await openSheet(page, 'A');
  s = await sheet(page);
  ok(s && !s.req && s.flag === 'Poista kevennysmerkintä' && s.text.indexOf('Merkintä on kevennys.') !== -1, '9 ikkunassa ei kytkintä vaan Poista kevennysmerkintä: ' + JSON.stringify(s && [s.req, s.flag]));
  await closeSheet(page);
  await save(page, 'A');
  x = await stored(page, '2026-10-06', 'A');
  t = await lastTop(page);
  ok(x && x.deload === true && x.deloadKind === 'pyydetty' && t && t.deload === true && t.deloadKind === 'pyydetty' && JSON.stringify(t.prior) === '["2026-10-02","2026-09-29"]', '9 laji säilyy merkinnässä ja lastSet-ketjussa: ' + JSON.stringify([x && x.deloadKind, t]));

  console.log('=== 4 seuraava kerta (9.10.)');
  await page.clock.setFixedTime(new Date('2026-10-09T12:00:00'));
  await page.goto(URL.replace('index.html', 'manifest.json')); await page.goto(URL);
  await page.waitForSelector('.bottom-nav'); await w(400);
  if(await page.$('[data-close-ex]')){ await page.click('[data-close-ex]'); await w(500); }
  await openEx(page, 'A2');
  ok(JSON.stringify(await weights(page, 'A2')) === '["102,5","102,5"]' && (await target(page)) === '2 sarjaa · 10 toistoa · RPE 8 · ehdotus +2,5 kg', '4 A2: 102,5 ja 102,5, ehdotus +2,5 kg (ilman korjausta 95 ja 95): ' + JSON.stringify(await weights(page, 'A2')) + ' ' + await target(page));
  await openSheet(page, 'A2');
  s = await sheet(page);
  ok(s.text.indexOf('edellisestä merkinnästä (2.10.)') !== -1 && s.text.indexOf('Pyydetty kevennys 6.10. ohitettu viitekertana.') !== -1, '4 selite: viitekerta 2.10. ja ohitettu kevennys 6.10.');
  await closeSheet(page);

  console.log('=== 5 vain pyydettyjä kevennyksiä ketjussa');
  await seed(page, { last: { [kb(ROW)]: sess('2026-10-06', [S(90, 10, 6), S(90, 10, 6)], { deload: true, deloadKind: 'pyydetty', prior: [] }) } });
  await openEx(page, 'A2');
  ok(JSON.stringify(await weights(page, 'A2')) === '["95","95"]', '5 A2: 95 ja 95 kevennyskerrasta: ' + JSON.stringify(await weights(page, 'A2')));
  await openSheet(page, 'A2');
  s = await sheet(page);
  ok(s.text.indexOf('edellisestä merkinnästä (6.10.)') !== -1 && s.text.indexOf('ohitettu viitekertana') === -1, '5 selitteessä ei ohitusvirkettä');
  await closeSheet(page);
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00'));

  console.log('=== 6 jumikevennyksen kanssa ei kytkintä');
  await seed(page);
  await openEx(page, 'P');
  ok(JSON.stringify(await weights(page, 'P')) === '["90","90"]', '6 P: jumikevennys 90 ja 90');
  await openSheet(page, 'P');
  s = await sheet(page);
  ok(s && !s.req && !s.flag, '6 ei kevennyspainiketta');
  await closeSheet(page);

  console.log('=== 7 lämmittely kevennyksessä');
  await seed(page);
  await openEx(page, 'A');
  await page.click('.ledger [data-add-warmup][data-id="A"]'); await w(450);
  const l1plain = await page.evaluate(() => { const r = window.__t.state.draftSets.A[0]; return r.weight + '×' + r.reps; });
  await seed(page);
  await openEx(page, 'A');
  await openSheet(page, 'A'); await toggleDeload(page); await closeSheet(page);
  await page.click('.ledger [data-add-warmup][data-id="A"]'); await w(450);
  const l1deload = await page.evaluate(() => { const r = window.__t.state.draftSets.A[0]; return r.weight + '×' + r.reps; });
  ok(l1plain === '40×8' && l1deload === '35×8', '7 L1 35 × 8 kevennyksessä (ilman pyyntöä 40 × 8): ' + l1deload + ' / ' + l1plain);

  console.log('=== 8 työsarjatasoinen lämmittely');
  await seed(page);
  await openEx(page, 'A');
  await page.click('.ledger [data-add-warmup][data-id="A"]'); await w(450);
  await closeKeypad(page);
  await fill(page, 'A', 0, 'weight', '102,5'); await fill(page, 'A', 0, 'reps', '10');
  await done(page, 'A', 0, 6);
  ok(JSON.stringify(await weights(page, 'A')) === '["107,5","107,5"]', '8 Kevyt työsarjatasoinen lämmittely: 107,5 ja 107,5: ' + JSON.stringify(await weights(page, 'A')));
  await openSheet(page, 'A'); await toggleDeload(page);
  ok(JSON.stringify(await weights(page, 'A')) === '["90","90"]', '8 pyyntö päälle: 90 ja 90: ' + JSON.stringify(await weights(page, 'A')));
  await toggleDeload(page);
  ok(JSON.stringify(await weights(page, 'A')) === '["107,5","107,5"]', '8 pois: 107,5 ja 107,5: ' + JSON.stringify(await weights(page, 'A')));
  await closeSheet(page);

  console.log('=== 10 jälkikäteinen merkintä');
  const plan10 = { sets: 2, reps: 10, suggestedWeight: 102.5 };
  const seed10 = deloadExtra => ({ entries: { '2026-10-06': entry('2026-10-06', 'A', [E(102.5, 10, 8), E(102.5, 10, 8)], Object.assign({ plan: plan10 }, deloadExtra)) },
    last: { [kb(ROW)]: sess('2026-10-06', [S(102.5, 10, 8), S(102.5, 10, 8)], Object.assign({ prior: [sess('2026-10-02', [S(100, 10, 8), S(100, 10, 8)])] }, deloadExtra.deload ? { deload: true } : {})) } });
  await seed(page, seed10({ deload: false }));
  await openEx(page, 'A');
  await openSheet(page, 'A');
  s = await sheet(page);
  ok(s && !s.req && s.flag === 'Merkitse kevennykseksi' && s.text.indexOf('Merkintä ei ole kevennys.') !== -1 && s.text.indexOf('Muutos tallentuu') === -1, '10 painike Merkitse kevennykseksi: ' + JSON.stringify(s && s.flag));
  await page.click('.sheet [data-flag-deload]'); await w(350);
  s = await sheet(page);
  ok(s && s.flag === 'Poista kevennysmerkintä' && s.text.indexOf('Merkintä on kevennys.') !== -1 && s.text.indexOf('Muutos tallentuu Tallenna merkintä -painikkeesta.') !== -1, '10 napautuksen jälkeen lisärivi: ' + JSON.stringify(s && s.flag));
  await closeSheet(page);
  await save(page, 'A');
  x = await stored(page, '2026-10-06', 'A');
  t = await lastTop(page);
  ok(x && x.deload === true && x.deloadKind === 'pyydetty' && x.plan && x.plan.suggestedWeight === 102.5 && JSON.stringify(x.sets.map(r => r.weight)) === '["102.5","102.5"]', '10 merkintä pyydetty kevennys, plan ja painot ennallaan: ' + JSON.stringify(x && [x.deload, x.deloadKind, x.plan, x.sets.map(r => r.weight)]));
  ok(t && t.date === '2026-10-06' && t.deload === true && t.deloadKind === 'pyydetty', '10 lastSet päällimmäinen pyydetty kevennys: ' + JSON.stringify(t));

  console.log('=== 11 automaattista kevennystä ei voi muuttaa');
  await seed(page, seed10({ deload: true }));
  await openEx(page, 'A');
  await openSheet(page, 'A');
  s = await sheet(page);
  ok(s && !s.req && !s.flag, '11 ei kumpaakaan kevennyspainiketta');
  await closeSheet(page);

  console.log('=== 12 kelpaamattomat liikkeet');
  await seed(page);
  const noBtn = [];
  for(const id of ['M', 'C', 'N']){
    await openEx(page, id);
    await openSheet(page, id);
    s = await sheet(page);
    if(s && !s.req && !s.flag) noBtn.push(id);
    await closeSheet(page);
    await closeEx(page);
  }
  ok(noBtn.join() === 'M,C,N', '12 MAX, cluster ja historiaton ilman kevennyspainiketta: ' + noBtn.join());

  console.log('=== 13 päivän vaihto nollaa pyynnön');
  await seed(page);
  await openEx(page, 'A');
  await openSheet(page, 'A'); await toggleDeload(page); await closeSheet(page);
  ok(JSON.stringify(await weights(page, 'A')) === '["90","90"]', '13 pyyntö päällä: 90 ja 90');
  await closeEx(page);
  const setDate = d => page.evaluate(d => { const el = document.getElementById('log-date'); el.value = d; el.dispatchEvent(new Event('change', { bubbles: true })); }, d);
  await setDate('2026-10-05'); await w(500);
  const req13 = await page.evaluate(() => JSON.stringify(window.__t.state.deloadRequest));
  await setDate('2026-10-06'); await w(500);
  await openEx(page, 'A');
  ok(req13 === '{}' && JSON.stringify(await weights(page, 'A')) === '["102,5","102,5"]', '13 päivän vaihdon jälkeen 102,5 ja 102,5: ' + JSON.stringify(await weights(page, 'A')));
  await closeEx(page);

  console.log('=== 14 korjaus ja palautus kantavat lajin');
  await seed(page, { entries: { '2026-10-05': Object.assign(entry('2026-10-05', 'A2', [E(90, 10), E(90, 10)], { deload: true, deloadKind: 'pyydetty', plan: { sets: 2, reps: 10, suggestedWeight: 90 } }), {}) } });
  await openEx(page, 'A2');
  ok((await page.evaluate(() => window.__t.state.autoCalcInfo.A2.type)) === 'saved', '14 A2 avautuu 5.10. merkinnästä');
  await save(page, 'A2');
  t = await lastTop(page);
  x = await stored(page, '2026-10-05', 'A2');
  ok(x && x.editedAt && x.deload === true && x.deloadKind === 'pyydetty' && t && t.date === '2026-10-05' && t.deloadKind === 'pyydetty', '14 korjauksen jälkeen lastSet päällimmäinen 5.10. pyydetty: ' + JSON.stringify(t));
  await openSettings(page, 'varmuuskopio');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  const backup = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
  await seed(page, { last: null });
  await openSettings(page, 'varmuuskopio');
  await page.setInputFiles('#import-entries-input', { name: 'varmuuskopio.csv', mimeType: 'text/csv', buffer: Buffer.from(backup, 'utf8') });
  await w(700);
  await page.click('[data-restore-confirm]'); await w(1000);
  t = await lastTop(page);
  ok(t && t.date === '2026-10-05' && t.deload === true && t.deloadKind === 'pyydetty', '14 palautuksen jälkeen lastSet päällimmäinen 5.10. pyydetty: ' + JSON.stringify(t));

  console.log('=== 16 tekstit');
  await page.click('.tab[data-tab="ohjelma"]'); await w(500);
  await page.click('[data-tab="ohje"]'); await w(600);
  const ohje = await page.evaluate(() => document.querySelector('main').textContent.replace(/\s+/g, ' '));
  ok(ohje.indexOf('Pyydetty kevennys: jos haluat keventää yksittäisen liikkeen tämän kerran') !== -1 && ohje.indexOf('Pyydettyä kevennystä ei käytetä seuraavan kerran ehdotuksen pohjana') !== -1, '16 Ohjeen kappale pyydetystä kevennyksestä');
  await openSettings(page, 'muutokset');
  const muutokset = await page.evaluate(() => document.querySelector('main').textContent);
  ok(muutokset.indexOf('Liikkeelle voi nyt pyytää kevennyksen (versio 0.4.30)') !== -1, '16 Muutokset-merkintä 0.4.30');

  ok(errors.length === 0, 'ei sivuvirheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
