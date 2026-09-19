// Kirjauskortin volyymirivi ja painikkeiden tiivistys (kehotteen tapaukset 1–16).
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const NB = ' ';
const norm = s => s === null || s === undefined ? s : String(s).replace(/[\u00a0\u202f]/g, ' ');
function pex(id, name, sets, reps, extra){ return Object.assign({ id, name, sets, reps, unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [
    pex('A', 'Kulmasoutu tangolla', '2', '10'),
    pex('B', 'Kyykky tangolla', '2', '6', { kind: 'cluster', autoCalc: false }),
    pex('C', 'Cardiolaite / Punnerrus, 12 min', '1', '12', { unit: 'min' }),
    pex('D', 'Penkkipunnerrus tangolla', '2', '8') ] } ] };
const LAST = { 'kulmasoutu tangolla': { sets: [{ weight: 50, reps: 10, done: true }, { weight: 50, reps: 10, done: true }], date: '2026-09-10', prior: [] } };
async function load(page, opts){
  opts = opts || {};
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ PROGRAM, LAST, opts }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(PROGRAM));
    if(opts.last !== false) localStorage.setItem('treenipk:last-set-log', JSON.stringify(opts.last || LAST));
    (opts.entries || []).forEach(e => localStorage.setItem('treenipk:entries:' + e.date, JSON.stringify(e)));
  }, { PROGRAM, LAST, opts });
  await page.goto(URL);
  await page.waitForSelector('.next-card');
  await page.waitForTimeout(300);
}
async function open(page, id){
  await page.click('[data-toggle-day-summary][data-key="d1"]'); await page.waitForTimeout(400);
  await page.click('[data-toggle-ex][data-id="' + id + '"]'); await page.waitForSelector('.ledger'); await page.waitForTimeout(400);
}
async function fill(page, id, idx, field, val){
  await page.evaluate(({ id, idx, field, val }) => {
    const el = document.querySelector('[data-set-field][data-id="' + id + '"][data-idx="' + idx + '"][data-field="' + field + '"]');
    el.value = val; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, idx, field, val });
  await page.waitForTimeout(100);
}
async function done(page, id, idx){
  await page.click('[data-toggle-done][data-id="' + id + '"][data-idx="' + idx + '"]'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
const vol = page => page.evaluate(() => {
  const l = document.querySelector('.ledger');
  const row = l.querySelector('[data-volume-row]');
  const bar = row ? row.querySelector('.volume-bar') : null;
  const save = l.querySelector('[data-save-ex]');
  const q = sel => l.querySelector(sel);
  const rect = el => el ? el.getBoundingClientRect() : null;
  const acts = [...l.querySelectorAll('.ledger-actions button')];
  const foot = [...l.querySelectorAll('.ledger-footer button')];
  return {
    row: !!row, planned: row ? q('[data-volume-planned]').textContent.replace(/[\u00a0\u202f]/g, ' ') : null, last: row ? q('[data-volume-last]').textContent.replace(/[\u00a0\u202f]/g, ' ') : null, doneTxt: row ? q('[data-volume-done]').textContent.replace(/[\u00a0\u202f]/g, ' ') : null,
    doneCls: row ? q('[data-volume-done]').className : null, width: bar ? bar.querySelector('.volume-fill').style.width : null, fillCls: bar ? bar.querySelector('.volume-fill').className : null,
    max: bar ? bar.getAttribute('aria-valuemax') : null, now: bar ? bar.getAttribute('aria-valuenow') : null, role: bar ? bar.getAttribute('role') : null, barLabel: bar ? bar.getAttribute('aria-label') : null,
    saveDisabled: save.disabled, saveDesc: save.getAttribute('aria-describedby'), saveCls: save.className, saveH: Math.round(rect(save).height), saveW: Math.round(rect(save).width), footW: Math.round(rect(l.querySelector('.ledger-footer')).width),
    acts: acts.map(b => ({ t: b.textContent.trim(), h: Math.round(rect(b).height), y: Math.round(rect(b).top), color: getComputedStyle(b).color })),
    foot: foot.map(b => ({ t: b.textContent.trim(), h: Math.round(rect(b).height), y: Math.round(rect(b).top), aria: b.getAttribute('aria-label') })),
    belowH: (() => { const rows = l.querySelectorAll('.ledger-row'); const lastRow = rows[rows.length - 1]; const f = l.querySelector('.ledger-footer'); return Math.round(rect(f).bottom - rect(lastRow).bottom); })(),
    oldText: l.textContent.indexOf('Nostettu yhteensä') !== -1 || l.textContent.indexOf('Lisää lämmittelysarja') !== -1 || l.textContent.indexOf('Vaihda liike toiseksi') !== -1,
    swapOpen: !!l.querySelector('[data-swap-confirm]'), marker: document.querySelector('main').getAttribute('data-marker'),
  };
});
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('1 avaus');
  await load(page, {});
  await open(page, 'A');
  let v = await vol(page);
  ok(v.row && v.last === '1' + NB + '000' + NB + 'kg' && v.doneTxt === '0' + NB + 'kg' && v.width === '0%' && v.now === '0', 'rivi: ' + JSON.stringify([v.planned, v.last, v.doneTxt, v.width, v.now]));
  await fill(page, 'A', 0, 'weight', '52,5'); await fill(page, 'A', 1, 'weight', '52,5');
  v = await vol(page);
  ok(v.planned === '1' + NB + '050' + NB + 'kg' && v.max === '1050' && v.now === '0' && v.saveDisabled, '1 suunniteltu 1 050 kg, max 1050: ' + JSON.stringify([v.planned, v.max, v.saveDisabled]));
  ok(!v.oldText, '14 ei vanhoja tekstejä');
  console.log('15 ruudunlukija');
  ok(v.role === 'progressbar' && v.barLabel === 'Toteutunut volyymi suunnitellusta' && v.saveDesc === 'save-hint-A', 'progressbar, aria-describedby ' + JSON.stringify([v.role, v.barLabel, v.saveDesc]));
  console.log('11 toimintorivi');
  ok(v.acts.length === 2 && v.acts[0].t === '+ Sarja' && v.acts[1].t === '+ Lämmittely' && v.acts[0].y === v.acts[1].y && v.acts[0].h === 40 && v.acts[1].h === 40, JSON.stringify(v.acts));
  ok(v.acts[1].color === 'rgb(152, 161, 176)', '+ Lämmittely mist: ' + v.acts[1].color);
  console.log('12 alarivi');
  ok(v.foot.length === 2 && v.foot[0].t === 'Vaihda' && v.foot[0].aria === 'Vaihda liike toiseksi' && v.foot[1].t === 'Tallenna merkintä' && v.foot[0].y === v.foot[1].y && v.foot[0].h === 40 && v.foot[1].h === 40, JSON.stringify(v.foot));
  ok(v.saveCls.indexOf('ledger-save-btn') !== -1 && v.saveW > v.footW * 0.5, 'Tallenna täyttää loput: ' + v.saveW + ' / ' + v.footW);
  console.log('14 korkeus');
  ok(v.belowH <= 180, 'sarjojen alapuolinen osa ' + v.belowH + ' px');

  console.log('2 sarja 1 ✓');
  await done(page, 'A', 0);
  v = await vol(page);
  ok(v.doneTxt === '525' + NB + 'kg' && v.width === '50%' && v.planned === '1' + NB + '050' + NB + 'kg' && v.last === '1' + NB + '000' + NB + 'kg' && v.saveDisabled && v.doneCls.indexOf('done') === -1, JSON.stringify([v.doneTxt, v.width, v.saveDisabled]));
  console.log('3 sarja 2 ✓');
  await done(page, 'A', 1);
  v = await vol(page);
  ok(v.doneTxt === '1' + NB + '050' + NB + 'kg' && v.doneCls === 'volume-value accent done' && v.width === '100%' && v.fillCls === 'volume-fill done' && !v.saveDisabled && v.saveDesc === null, JSON.stringify([v.doneTxt, v.doneCls, v.width, v.fillCls, v.saveDisabled]));
  console.log('5 +2,5 ✓-sarjalle');
  await page.click('[data-set-field][data-id="A"][data-idx="0"][data-field="weight"]'); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('main').setAttribute('data-marker', 'x'));
  await page.click('[data-weight-step][data-step="2.5"]'); await page.waitForTimeout(200);
  v = await vol(page);
  ok(v.planned === '1' + NB + '075' + NB + 'kg' && v.doneTxt === '1' + NB + '075' + NB + 'kg' && v.marker === 'x', '+25 kg molempiin ilman render(): ' + JSON.stringify([v.planned, v.doneTxt, v.marker]));
  await page.click('[data-weight-step][data-step="-2.5"]'); await page.waitForTimeout(200);
  console.log('4 kirjoitus näppäimistöltä (sarja ei ✓)');
  // pura sarja 2 ✓ ja kirjoita 55
  await page.click('[data-keypad-close]'); await page.waitForTimeout(200);
  await done(page, 'A', 1);
  await page.click('[data-set-field][data-id="A"][data-idx="1"][data-field="weight"]'); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('main').setAttribute('data-marker', 'y'));
  await page.click('[data-keypad-key="5"]'); await page.click('[data-keypad-key="5"]'); await page.waitForTimeout(200);
  v = await vol(page);
  const kp = await page.evaluate(() => ({ keypad: !!document.getElementById('keypad'), target: !!document.querySelector('.keypad-target') }));
  ok(v.planned === '1' + NB + '075' + NB + 'kg' && v.doneTxt === '525' + NB + 'kg' && v.marker === 'y' && kp.keypad && kp.target, 'suunniteltu 1 075, toteutunut 525, ei render(): ' + JSON.stringify([v.planned, v.doneTxt, v.marker, kp]));
  await page.click('[data-keypad-close]'); await page.waitForTimeout(200);

  console.log('13 Vaihda');
  await page.click('.ledger-footer [data-swap-open]'); await page.waitForTimeout(500);
  v = await vol(page);
  const swapPos = await page.evaluate(() => { const f = document.querySelector('.ledger-footer'); const c = document.querySelector('[data-swap-confirm]'); return (f.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0; });
  ok(v.swapOpen && swapPos && v.foot.length === 2, 'paneeli alarivin alla');
  await page.click('[data-swap-cancel]'); await page.waitForTimeout(400);
  ok(!(await vol(page)).swapOpen, 'Peruuta sulkee');

  console.log('9 lämmittelyt eivät vaikuta');
  await page.click('[data-add-warmup][data-id="A"]'); await page.waitForTimeout(400);
  await page.click('[data-keypad-close]').catch(() => {}); await page.waitForTimeout(200);
  const wIdx = await page.evaluate(() => [...document.querySelectorAll('.ledger [data-toggle-done]')].length);
  await fill(page, 'A', 0, 'weight', '20'); await fill(page, 'A', 0, 'reps', '10'); await done(page, 'A', 0);
  v = await vol(page);
  ok(wIdx === 3 && v.planned === '1' + NB + '075' + NB + 'kg' && v.doneTxt === '525' + NB + 'kg', 'L1 ✓ ei muuta lukuja: ' + JSON.stringify([wIdx, v.planned, v.doneTxt]));

  console.log('6 ei viime kertaa');
  await load(page, { last: false });
  await open(page, 'A');
  v = await vol(page);
  ok(!v.row, 'ilman lukuja riviä ei ole (sääntö 4.3)');
  await fill(page, 'A', 0, 'weight', '50');
  // Rivi syntyy piirrossa: ✓ ja Escape piirtävät näkymän.
  await done(page, 'A', 0); await done(page, 'A', 0);
  v = await vol(page);
  ok(v.row && v.last === '–' && v.planned === '500 kg', 'Viime kerta –: ' + JSON.stringify([v.last, v.planned]));

  console.log('7 korjaustila');
  const today = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); });
  const lastCorr = { 'kulmasoutu tangolla': { sets: [{ weight: 55, reps: 10, done: true }, { weight: 55, reps: 10, done: true }], date: today, prior: [{ sets: [{ weight: 50, reps: 10, done: true }, { weight: 50, reps: 10, done: true }], date: '2026-09-10' }] } };
  await load(page, { last: lastCorr, entries: [{ date: today, exercises: { A: { name: 'Kulmasoutu tangolla', sets: [{ weight: 55, reps: 10, done: true }, { weight: 55, reps: 10, done: true }], kind: 'plain' } } }] });
  await open(page, 'A');
  v = await vol(page);
  ok(v.last === '1' + NB + '000' + NB + 'kg' && v.planned === '1' + NB + '100' + NB + 'kg' && v.doneTxt === '1' + NB + '100' + NB + 'kg' && v.doneCls.indexOf('done') !== -1, 'prior[0]: ' + JSON.stringify([v.last, v.planned, v.doneTxt]));

  console.log('8 cluster');
  await load(page, {});
  await open(page, 'B');
  await fill(page, 'B', 0, 'weight', '60'); await fill(page, 'B', 0, 'reps', '6');
  for(let i=0;i<4;i++){ await page.click('[data-cluster-step="1"][data-id="B"][data-idx="0"]'); await page.waitForTimeout(150); }
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await done(page, 'B', 0);
  v = await vol(page);
  ok(v.doneTxt === '1' + NB + '440' + NB + 'kg', 'toteutunut 60 × 6 × 4: ' + v.doneTxt);

  console.log('10 yhdistelmäliike');
  await load(page, {});
  await open(page, 'C');
  v = await vol(page);
  ok(!v.row && v.acts.length === 2 && v.foot.length === 2, 'ei volyymiriviä, painikerivit näkyvät ' + JSON.stringify([v.row, v.acts.length, v.foot.length]));

  console.log('16 leveä asettelu');
  const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  wide.on('pageerror', e => errors.push('wide: ' + e));
  await load(wide, {});
  await wide.click('[data-toggle-day-summary][data-key="d1"]'); await wide.waitForTimeout(400);
  await wide.click('[data-toggle-ex][data-id="A"]'); await wide.waitForSelector('.ohjelma-pane .ledger'); await wide.waitForTimeout(400);
  await fill(wide, 'A', 0, 'weight', '52,5'); await fill(wide, 'A', 1, 'weight', '52,5');
  const wv = await wide.evaluate(() => { const l = document.querySelector('.ohjelma-pane .ledger'); return { planned: l.querySelector('[data-volume-planned]').textContent.replace(/[\u00a0\u202f]/g, ' '), last: l.querySelector('[data-volume-last]').textContent.replace(/[\u00a0\u202f]/g, ' '), acts: l.querySelectorAll('.ledger-actions button').length, foot: l.querySelectorAll('.ledger-footer button').length, css: !!document.getElementById('app').className.indexOf('wide') }; });
  await wide.click('[data-set-field][data-id="A"][data-idx="0"][data-field="weight"]'); await wide.waitForTimeout(300);
  const paneRule = await wide.evaluate(() => { const app = document.getElementById('app'); return app.className.indexOf('keypad-open') !== -1 && getComputedStyle(document.querySelector('.ohjelma-pane')).maxHeight; });
  ok(wv.planned === '1' + NB + '050' + NB + 'kg' && wv.last === '1' + NB + '000' + NB + 'kg' && wv.acts === 2 && wv.foot === 2, 'paneeli sama kortti ' + JSON.stringify(wv));
  ok(paneRule && paneRule !== 'none', '#app.wide.keypad-open .ohjelma-pane max-height: ' + paneRule);
  await wide.close();

  console.log('virheet');
  ok(errors.length === 0, 'ei JS-virheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? ('\nEPÄONNISTUI: ' + fails) : '\nKAIKKI OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
