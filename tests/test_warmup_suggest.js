// Lämmittelyehdotuksen nouseva sarja (0.4.27): "+ Lämmittely" lisätään yksi
// kerrallaan, ja jokaisen lisäyksen jälkeen tarkistetaan rivien paino- ja
// toistokentät, rivin lähde (auto-lippu "last" | "ladder") sekä Lämmittely-
// otsikon selite (kehotteen tapaukset 1–10). Lisäksi apufunktiot
// (scaleLastWarmups, ladderSuggestion, warmupLowerBound) rajatapauksineen.
// Lähteen ja tilan lukemiseksi sivulle tarjoillaan reitityksessä index.html,
// jonka sulkeuman loppuun on lisätty window.__t-viittaukset; tiedostoon
// itseensä ei kosketa.
//
// Työsarjan base siemennetään kolmella tavalla: MAX-rivi 1RM-arvolla (rivin
// paino = 1RM, base-kenttää ei ole), tavallinen liike viime kerran sarjasta
// tuntumalla (100 × 5 Sujuva → 105, 100 × 5 Äärirajoilla → 100) ja ilman
// historiaa käsin kirjoitettu työpaino.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const BENCH = 'Penkkipunnerrus tangolla';
const SQUAT = 'Takakyykky tangolla';
const kb = n => n.trim().toLowerCase();
const LAST_DATE = '2026-09-29';
const TODAY = '2026-10-06';
const LADDER_NOTE = base => 'Lämmittelyt ehdotettu työpainosta ' + base + ' kg (40 / 60 / 80 / 90 %) — muokattavissa.';
const SCALED_NOTE = base => 'Lämmittelyt viime kerran mukaan, skaalattu työpainoon ' + base + ' kg — muokattavissa.';
const MIXED_NOTE = base => 'Lämmittelyt viime kerran mukaan ja portaittain työpainosta ' + base + ' kg — muokattavissa.';

const EXPOSE = ['state', 'scaleLastWarmups', 'warmupLowerBound', 'ladderSuggestion', 'suggestWarmup', 'warmupSuggestionContext',
  'buildAllOneRepMaxSeries', 'loadAllEntries', 'WARMUP_LAST_RATIO_MIN', 'WARMUP_LAST_RATIO_MAX'];
function instrumentedHtml(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const marker = '})();\n</script>';
  const i = html.lastIndexOf(marker);
  if(i === -1) throw new Error('index.html: sovelluksen sulkeuman loppua ei löytynyt');
  const hook = 'window.__t = {' + EXPOSE.map(n => JSON.stringify(n) + ': (typeof ' + n + ' !== "undefined" ? ' + n + ' : null)').join(', ') + '};\n';
  return html.slice(0, i) + hook + html.slice(i);
}
// Ohjelman liikkeet: MAX-rivi (paino = 1RM) ja tavallinen liike.
function maxEx(id, name){
  return { id, name, sets: '1', reps: '1', unit: '', weight: '', notes: 'MAX', intensity: { isMax: true, percents: [] }, kind: 'plain', autoCalc: true };
}
function plainEx(id, name, sets, reps, extra){
  return Object.assign({ id, name, sets, reps, unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {});
}
function prog(exercises){
  return { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
    { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises } ] };
}
// Viitekerta (lastSet): työsarjat ja lämmittelyt.
const S = (wt, r, rpe) => ({ weight: String(wt), reps: String(r), done: true, rpe: rpe === undefined ? null : rpe });
const W = (wt, r, rpe) => ({ weight: String(wt), reps: String(r), rpe: rpe === undefined ? null : rpe });
const session = (sets, warmups) => ({ sets, warmups, date: LAST_DATE, prior: [] });
async function seed(page, o){
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(o.program));
    if(o.last) localStorage.setItem('treenipk:last-set-log', JSON.stringify(o.last));
    if(o.max) localStorage.setItem('treenipk:manual-1rm', JSON.stringify(o.max));
  }, o);
  await page.goto(URL);
  await page.waitForSelector('.bottom-nav'); await w(400);
}
async function openEx(page, id){
  if(!(await page.$('[data-toggle-ex][data-id="' + id + '"]'))){ await page.click('[data-toggle-day-summary][data-key="d1"]'); await w(400); }
  await page.click('[data-toggle-ex][data-id="' + id + '"]');
  await page.waitForSelector('.ledger [data-add-warmup][data-id="' + id + '"]'); await w(400);
}
async function closeKeypad(page){
  if(await page.$('#keypad')){ await page.click('[data-keypad-close]'); await w(300); }
}
// Kentän arvo kirjoitetaan samaa polkua kuin näppäimistöltä (input-tapahtuma).
async function fill(page, id, idx, field, val){
  await closeKeypad(page);
  await page.evaluate(a => {
    const el = document.querySelector('.ledger [data-set-field][data-id="' + a.id + '"][data-idx="' + a.idx + '"][data-field="' + a.field + '"]');
    el.value = a.val; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, idx, field, val });
  await w(200);
}
// Lämmittelyrivit muodossa "57,5×8 ladder | 87,5×5 ladder" (kentän arvo
// desimaalipilkulla, lähde auto-lipusta; tyhjä rivi "×"), selite ja
// ensimmäisen työsarjan painokenttä.
const snap = (page, id) => page.evaluate(id => {
  const rows = (window.__t.state.draftSets[id] || []).filter(r => r.kind === 'warmup');
  const val = (i, f) => { const el = document.querySelector('.ledger [data-set-field][data-id="' + id + '"][data-idx="' + i + '"][data-field="' + f + '"]'); return el ? el.value : '?'; };
  const note = document.querySelector('.ledger .warmup-auto-note');
  return {
    rows: rows.map((r, i) => val(i, 'weight') + '×' + val(i, 'reps') + (r.auto ? ' ' + r.auto : '')).join(' | '),
    note: note ? note.textContent : '',
    work: val(rows.length, 'weight')
  };
}, id);
async function addWarmup(page, id){
  await closeKeypad(page);
  await page.click('.ledger [data-add-warmup][data-id="' + id + '"]'); await w(450);
  return snap(page, id);
}
const ctxOf = (page, id) => page.evaluate(id => {
  const t = window.__t;
  const ex = t.state.program.days[0].exercises.find(e => e.id === id);
  const c = t.warmupSuggestionContext(ex, id);
  return c ? { base: c.base, ratio: c.ratio, lastScaled: c.lastScaled } : null;
}, id);
async function download(page){
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  return fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  const body = instrumentedHtml();
  await page.route('**/index.html', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  await page.clock.setFixedTime(new Date(TODAY + 'T12:00:00'));
  let s, c;

  console.log('=== 0 apufunktiot suoraan');
  await seed(page, { program: prog([plainEx('p0', SQUAT, '1', '5')]) });
  const u = await page.evaluate(() => {
    const t = window.__t;
    const sess = warmups => ({ sets: [{ weight: '100', reps: '5' }], warmups });
    const sc = (warmups, ratio, base) => JSON.stringify(t.scaleLastWarmups(warmups === undefined ? null : sess(warmups), ratio, base));
    const ld = (base, n, lb, reps) => JSON.stringify(t.ladderSuggestion({ reps: reps === undefined ? '5' : reps }, base, n, lb));
    t.state.draftSets.p0 = [
      { weight: '42,5', reps: '8', kind: 'warmup', done: true }, { weight: '', reps: '5', kind: 'warmup', done: false },
      { weight: 'x', reps: '3', kind: 'warmup', done: false }, { weight: '-5', reps: '3', kind: 'warmup', done: false },
      { weight: '200', reps: '5', kind: 'work', done: false }];
    const lb1 = t.warmupLowerBound('p0');
    t.state.draftSets.p0 = [{ weight: '', reps: '', kind: 'warmup', done: false }, { weight: '100', reps: '5', kind: 'work', done: false }];
    const lb0 = t.warmupLowerBound('p0');
    return {
      consts: [t.WARMUP_LAST_RATIO_MIN, t.WARMUP_LAST_RATIO_MAX],
      noSession: sc(undefined, 1, 100), empty: sc([], 1, 100),
      valid: sc([{ weight: '40', reps: '8' }, { weight: '60', reps: 5 }, { weight: '80', reps: '3' }], 1.05, 105),
      repeat: sc([{ weight: '20', reps: '10' }, { weight: '20', reps: '10' }, { weight: '60', reps: '5' }], 1, 100),
      lowRatio: sc([{ weight: '50', reps: '5' }], 0.84, 84), highRatio: sc([{ weight: '50', reps: '5' }], 1.16, 116),
      atMin: sc([{ weight: '50', reps: '5' }], 0.85, 85), atMax: sc([{ weight: '50', reps: '5' }], 1.15, 115),
      atBase: sc([{ weight: '50', reps: '5' }, { weight: '100', reps: '2' }], 1, 100), desc: sc([{ weight: '60', reps: '5' }, { weight: '50', reps: '5' }], 1, 100),
      tooLight: sc([{ weight: '2.5', reps: '10' }, { weight: '40', reps: '5' }], 1, 100), noReps: sc([{ weight: '40', reps: '' }], 1, 100),
      zeroReps: sc([{ weight: '40', reps: '0' }], 1, 100), noWeight: sc([{ weight: '', reps: '8' }], 1, 100), nullRow: sc([null], 1, 100),
      l1: ld(100, 1, 0), l1lb: ld(100, 1, 50), l2: ld(100, 2, 0), l5: ld(100, 5, 0), l5lb: ld(100, 5, 90), l3lb: ld(145, 3, 120),
      light1: ld(12, 1, 0, '10'), light1noReps: ld(12, 1, 0, ''), light2: ld(12, 2, 0, '10'), lightLb: ld(12, 1, 7.5, '10'), tiny: ld(6, 1, 0, '10'),
      lb1, lb0
    };
  });
  ok(JSON.stringify(u.consts) === '[0.85,1.15]', '0 vakiot WARMUP_LAST_RATIO_MIN/MAX 0,85 ja 1,15: ' + JSON.stringify(u.consts));
  ok(u.noSession === 'null' && u.empty === 'null', '0 scaleLastWarmups: ei viitekertaa tai lämmittelyjä → null');
  ok(u.valid === '[{"weight":42.5,"reps":"8"},{"weight":62.5,"reps":"5"},{"weight":85,"reps":"3"}]', '0 kelvollinen sarja skaalattuna (paino luku, toistot merkkijono): ' + u.valid);
  ok(u.repeat === '[{"weight":20,"reps":"10"},{"weight":20,"reps":"10"},{"weight":60,"reps":"5"}]', '0 sama paino peräkkäin kelpaa: ' + u.repeat);
  ok(u.lowRatio === 'null' && u.highRatio === 'null', '0 suhde 0,84 tai 1,16 → null');
  ok(u.atMin === '[{"weight":42.5,"reps":"5"}]' && u.atMax === '[{"weight":57.5,"reps":"5"}]', '0 rajat 0,85 ja 1,15 mukaan lukien: ' + u.atMin + ' ' + u.atMax);
  ok(u.atBase === 'null' && u.desc === 'null' && u.tooLight === 'null', '0 työpainon tasoinen, laskeva tai alle 5 kg:n lämmittely hylkää koko sarjan');
  ok(u.noReps === 'null' && u.zeroReps === 'null' && u.noWeight === 'null' && u.nullRow === 'null', '0 puuttuva paino tai toistot hylkäävät koko sarjan');
  ok(u.l1 === '{"weight":"40","reps":"8","source":"ladder"}' && u.l2 === '{"weight":"60","reps":"5","source":"ladder"}', '0 ladderSuggestion L1 40 × 8, L2 60 × 5');
  ok(u.l1lb === '{"weight":"60","reps":"5","source":"ladder"}', '0 alaraja 50: L1:n haku nousee portaaseen 60 %: ' + u.l1lb);
  ok(u.l5 === '{"weight":"90","reps":"1","source":"ladder"}' && u.l5lb === 'null', '0 L5 alkaa viimeisestä portaasta; alaraja 90 → null: ' + u.l5 + ' ' + u.l5lb);
  ok(u.l3lb === '{"weight":"130","reps":"1","source":"ladder"}', '0 base 145, L3, alaraja 120 → 130 × 1: ' + u.l3lb);
  ok(u.light1 === '{"weight":"7.5","reps":"10","source":"ladder"}' && u.light1noReps === '{"weight":"7.5","reps":"5","source":"ladder"}', '0 kevyt työpaino: L1 60 %, tavoitetoistot tai 5');
  ok(u.light2 === 'null' && u.lightLb === 'null' && u.tiny === 'null', '0 kevyt: L2 null, paino ≤ alaraja null, alle 5 kg null');
  ok(u.lb1 === 42.5 && u.lb0 === 0, '0 warmupLowerBound: raskain kelvollinen lämmittelypaino (työsarja ei kuulu), muuten 0: ' + u.lb1 + ' / ' + u.lb0);

  console.log('=== 1 ilmoitettu virhe: base 145 × 1, viime 72,5 × 8 RPE 6 ja lämmittely 60 × 5');
  await seed(page, { program: prog([maxEx('m1', BENCH)]), max: { [kb(BENCH)]: { weight: 145, date: LAST_DATE } },
    last: { [kb(BENCH)]: session([S(72.5, 8, 6)], [W(60, 5, 6)]) } });
  await openEx(page, 'm1');
  s = await snap(page, 'm1');
  c = await ctxOf(page, 'm1');
  ok(s.work === '145' && s.rows === '' && c.base === 145 && c.ratio === 2 && c.lastScaled === null, '1 työsarja 145 (MAX-rivi), suhde 2,0 → ei viime kerran lämmittelyjä: ' + JSON.stringify([s.work, c]));
  s = await addWarmup(page, 'm1');
  ok(s.rows === '57,5×8 ladder', '1 L1 57,5 × 8 portaista (ennen 120 × 5): ' + s.rows);
  s = await addWarmup(page, 'm1');
  ok(s.rows === '57,5×8 ladder | 87,5×5 ladder', '1 L2 87,5 × 5: ' + s.rows);
  s = await addWarmup(page, 'm1');
  ok(s.rows === '57,5×8 ladder | 87,5×5 ladder | 115×3 ladder', '1 L3 115 × 3: ' + s.rows);
  s = await addWarmup(page, 'm1');
  ok(s.rows === '57,5×8 ladder | 87,5×5 ladder | 115×3 ladder | 130×1 ladder', '1 L4 130 × 1: ' + s.rows);
  s = await addWarmup(page, 'm1');
  ok(s.rows === '57,5×8 ladder | 87,5×5 ladder | 115×3 ladder | 130×1 ladder | ×', '1 L5 tyhjä rivi (90 % = 130 ei ylitä alarajaa 130): ' + s.rows);
  ok(s.note === LADDER_NOTE('145'), '1 selite: ' + s.note);

  console.log('=== 2 viime kerran sarja ja jatko portaista (base 105, suhde 1,05)');
  const last2 = { [kb(SQUAT)]: session([S(100, 5, 7)], [W(40, 8, 6), W(60, 5, 6), W(80, 3, 7)]) };
  await seed(page, { program: prog([plainEx('s2', SQUAT, '1', '5')]), last: last2 });
  await openEx(page, 's2');
  s = await snap(page, 's2');
  ok(s.work === '105', '2 työsarjan ehdotus 100 × 5 Sujuvasta 105: ' + s.work);
  s = await addWarmup(page, 's2');
  ok(s.rows === '42,5×8 last' && s.note === SCALED_NOTE('105'), '2 L1 42,5 × 8 viime kerrasta: ' + JSON.stringify(s));
  s = await addWarmup(page, 's2');
  ok(s.rows === '42,5×8 last | 62,5×5 last', '2 L2 62,5 × 5: ' + s.rows);
  s = await addWarmup(page, 's2');
  ok(s.rows === '42,5×8 last | 62,5×5 last | 85×3 last', '2 L3 85 × 3: ' + s.rows);
  ok(s.note === SCALED_NOTE('105'), '2 selite L3:n jälkeen: ' + s.note);
  s = await addWarmup(page, 's2');
  ok(s.rows === '42,5×8 last | 62,5×5 last | 85×3 last | 95×1 ladder', '2 L4 95 × 1 portaista (90 %): ' + s.rows);
  ok(s.note === MIXED_NOTE('105'), '2 sekalähteen selite: ' + s.note);

  console.log('=== 3 suhteen rajat (viime 100 × 5, lämmittelyt 50 × 5 ja 75 × 3)');
  const cases3 = [
    ['a', 112.5, '57,5×5 last | 85×3 last', SCALED_NOTE('112,5')],
    ['b', 120, '47,5×8 ladder | 72,5×5 ladder', LADDER_NOTE('120')],
    ['c', 90, '45×5 last | 67,5×3 last', SCALED_NOTE('90')],
    ['d', 80, '32,5×8 ladder | 47,5×5 ladder', LADDER_NOTE('80')],
    ['raja 1,15', 115, '57,5×5 last | 87,5×3 last', SCALED_NOTE('115')],
    ['raja 0,85', 85, '42,5×5 last | 65×3 last', SCALED_NOTE('85')]
  ];
  for(const [label, base, rows, note] of cases3){
    await seed(page, { program: prog([maxEx('m3', BENCH)]), max: { [kb(BENCH)]: { weight: base, date: LAST_DATE } },
      last: { [kb(BENCH)]: session([S(100, 5)], [W(50, 5), W(75, 3)]) } });
    await openEx(page, 'm3');
    await addWarmup(page, 'm3');
    s = await addWarmup(page, 'm3');
    ok(s.work === String(base).replace('.', ',') && s.rows === rows && s.note === note, '3' + label + ' base ' + base + ': ' + s.rows + ' · ' + s.note);
  }

  console.log('=== 4 kelpaamaton viime kerran sarja → kokonaan portaat (base 100)');
  for(const [label, warmups] of [['työpainon tasoinen 100 × 2', [W(50, 5), W(100, 2)]], ['laskeva 60 → 50', [W(60, 5), W(50, 5)]]]){
    await seed(page, { program: prog([maxEx('m4', BENCH)]), max: { [kb(BENCH)]: { weight: 100, date: LAST_DATE } },
      last: { [kb(BENCH)]: session([S(100, 5)], warmups) } });
    await openEx(page, 'm4');
    c = await ctxOf(page, 'm4');
    await addWarmup(page, 'm4');
    s = await addWarmup(page, 'm4');
    ok(c.ratio === 1 && c.lastScaled === null && s.rows === '40×8 ladder | 60×5 ladder' && s.note === LADDER_NOTE('100'), '4 ' + label + ': L1 40 × 8, L2 60 × 5 (ei 50 × 5): ' + s.rows);
  }

  console.log('=== 5 sama paino peräkkäin viime kerran kaavassa (base 100)');
  await seed(page, { program: prog([plainEx('s5', SQUAT, '1', '5')]), last: { [kb(SQUAT)]: session([S(100, 5, 10)], [W(20, 10), W(20, 10), W(60, 5)]) } });
  await openEx(page, 's5');
  await addWarmup(page, 's5'); await addWarmup(page, 's5');
  s = await addWarmup(page, 's5');
  ok(s.work === '100' && s.rows === '20×10 last | 20×10 last | 60×5 last', '5 L1 20 × 10, L2 20 × 10, L3 60 × 5: ' + JSON.stringify(s));
  ok(s.note === 'Lämmittelyt viime kerran mukaan — muokattavissa.', '5 selite (suhde 1): ' + s.note);

  console.log('=== 6 käyttäjän muokkaus nostaa alarajaa (base 145, ei historiaa)');
  await seed(page, { program: prog([plainEx('s6', SQUAT, '1', '1')]) });
  await openEx(page, 's6');
  await fill(page, 's6', 0, 'weight', '145');
  s = await addWarmup(page, 's6');
  ok(s.rows === '57,5×8 ladder' && s.work === '145', '6 L1 57,5 × 8 kirjoitetusta työpainosta: ' + JSON.stringify(s));
  await fill(page, 's6', 0, 'weight', '120');
  s = await snap(page, 's6');
  ok(s.rows === '120×8' && s.note === '', '6 muokkaus poistaa auto-lipun ja selitteen: ' + JSON.stringify(s));
  s = await addWarmup(page, 's6');
  ok(s.rows === '120×8 | 130×1 ladder', '6 L2 130 × 1 (87,5 ja 115 ≤ 120): ' + s.rows);
  s = await addWarmup(page, 's6');
  ok(s.rows === '120×8 | 130×1 ladder | ×', '6 L3 tyhjä rivi: ' + s.rows);
  ok(s.note === LADDER_NOTE('145'), '6 porrasteksti: ' + s.note);

  console.log('=== 7 käyttäjän muokkaus viime kerran kaavassa (kuten 2, L1 → 70)');
  await seed(page, { program: prog([plainEx('s7', SQUAT, '1', '5')]), last: last2 });
  await openEx(page, 's7');
  s = await addWarmup(page, 's7');
  ok(s.rows === '42,5×8 last', '7 L1 42,5 × 8: ' + s.rows);
  await fill(page, 's7', 0, 'weight', '70');
  s = await addWarmup(page, 's7');
  ok(s.rows === '70×8 | 85×3 ladder', '7 L2 85 × 3 portaista (skaalattu 62,5 < 70, 60 % = 62,5 ≤ 70): ' + s.rows);
  s = await addWarmup(page, 's7');
  ok(s.rows === '70×8 | 85×3 ladder | 95×1 ladder', '7 L3 95 × 1 portaista (skaalattu 85 = alaraja ilman toistoa viime kerralla): ' + s.rows);
  ok(s.note === LADDER_NOTE('105'), '7 selite L3:n jälkeen: ' + s.note);

  console.log('=== 8 tyhjennetty edellinen rivi (base 100, ei historiaa)');
  await seed(page, { program: prog([plainEx('s8', SQUAT, '1', '5')]) });
  await openEx(page, 's8');
  await fill(page, 's8', 0, 'weight', '100');
  s = await addWarmup(page, 's8');
  ok(s.rows === '40×8 ladder', '8 L1 40 × 8: ' + s.rows);
  await fill(page, 's8', 0, 'weight', '');
  s = await addWarmup(page, 's8');
  ok(s.rows === '×8 | 60×5 ladder', '8 L2 60 × 5 (alaraja 0, haku alkaa 60 %:sta): ' + s.rows);

  console.log('=== 9 kevyt työpaino (base 12, tavoite 10, ei historiaa)');
  await seed(page, { program: prog([plainEx('s9', 'Hauiskääntö käsipainoilla', '2', '10')]) });
  await openEx(page, 's9');
  await fill(page, 's9', 0, 'weight', '12');
  s = await addWarmup(page, 's9');
  ok(s.rows === '7,5×10 ladder', '9 L1 7,5 × 10: ' + s.rows);
  s = await addWarmup(page, 's9');
  ok(s.rows === '7,5×10 ladder | ×', '9 L2 tyhjä rivi: ' + s.rows);
  ok(s.note === 'Lämmittelyt ehdotettu työpainosta 12 kg (60 %) — muokattavissa.', '9 selite (60 %): ' + s.note);

  console.log('=== 10 regressio');
  await seed(page, { program: prog([plainEx('c1', 'Kuntopiiri / Punnerrus', '1', '10'), plainEx('k1', SQUAT, '2', '6', { kind: 'cluster', autoCalc: false })]),
    last: { [kb('Kuntopiiri / Punnerrus')]: session([S(50, 10)], [W(20, 10)]) } });
  await openEx(page, 'c1');
  await fill(page, 'c1', 0, 'weight', '50');
  s = await addWarmup(page, 'c1');
  ok(s.rows === '×' && s.note === '', '10 yhdistelmäliike: tyhjä rivi: ' + JSON.stringify(s));
  await closeKeypad(page);
  await page.click('[data-close-ex]'); await w(600);
  await openEx(page, 'k1');
  await fill(page, 'k1', 0, 'weight', '60');
  s = await addWarmup(page, 'k1');
  ok(s.rows === '×' && s.note === '', '10 cluster: tyhjä rivi: ' + JSON.stringify(s));

  // Lämmittelysäätö, tuntuma, tallennus, Historia, Kehitys ja varmuuskopio
  // esitäytetyllä lämmittelyllä (sama tilanne kuin tapauksessa 2).
  await seed(page, { program: prog([plainEx('r1', SQUAT, '1', '5')]), last: last2 });
  await openEx(page, 'r1');
  s = await addWarmup(page, 'r1');
  ok(s.rows === '42,5×8 last' && s.work === '105', '10 L1 42,5 × 8 viime kerrasta: ' + JSON.stringify(s));
  await closeKeypad(page);
  await page.click('.ledger [data-toggle-done][data-id="r1"][data-idx="0"]'); await page.waitForSelector('.sheet [data-warmup-rpe]'); await w(400);
  await page.click('.sheet [data-warmup-rpe][data-rpe="8"]'); await w(500);
  const adj = await page.evaluate(() => {
    const t = window.__t; const rows = t.state.draftSets.r1; const info = t.state.autoCalcInfo.r1 || {};
    return { rpe: rows[0].rpe, done: rows[0].done, work: rows[1].weight, wa: info.warmupAdjust || null, btn: (document.querySelector('.ledger [data-set-more][data-idx="0"] .rpe-btn-val') || {}).textContent || '' };
  });
  ok(adj.rpe === 8 && adj.done === true && adj.btn === '8', '10 lämmittelyn tuntuma RPE-ikkunasta: ' + JSON.stringify([adj.rpe, adj.done, adj.btn]));
  ok(adj.wa && adj.wa.status === 'applied' && adj.wa.factor === 0.9 && adj.work === '92.5', '10 lämmittelysäätö ennallaan (40 × 8 Kevyt → 42,5 × 8 Työläs: −10 %, 105 → 92,5): ' + JSON.stringify([adj.wa && adj.wa.status, adj.wa && adj.wa.factor, adj.work]));
  s = await snap(page, 'r1');
  ok(s.note === '' && s.work === '92,5', '10 selite katoaa, kun esitäytetty rivi on valmis: ' + JSON.stringify(s));
  await page.click('.ledger [data-toggle-done][data-id="r1"][data-idx="1"]'); await page.waitForSelector('.sheet'); await w(400);
  await page.keyboard.press('Escape'); await w(400);
  await page.click('.ledger [data-save-ex][data-id="r1"]'); await w(800);
  const saved = await page.evaluate(d => ({ entry: localStorage.getItem('treenipk:entries:' + d), last: localStorage.getItem('treenipk:last-set-log') }), TODAY);
  const exData = saved.entry ? JSON.parse(saved.entry).exercises.r1 : null;
  const lastObj = saved.last ? JSON.parse(saved.last)[kb(SQUAT)] : null;
  ok(exData && JSON.stringify(exData.warmups) === '[{"weight":"42.5","reps":"8","rpe":8}]' && saved.entry.indexOf('"auto"') === -1, '10 merkinnän lämmittely ilman auto-lippua: ' + JSON.stringify(exData && exData.warmups));
  ok(exData && exData.sets.length === 1 && exData.sets[0].weight === '92.5' && exData.sets[0].reps === '5', '10 työsarja tallessa: ' + JSON.stringify(exData && exData.sets));
  ok(lastObj && lastObj.date === TODAY && JSON.stringify(lastObj.warmups) === '[{"weight":"42.5","reps":"8","rpe":8}]' && saved.last.indexOf('"auto"') === -1, '10 lastSet-lämmittely ilman auto-lippua: ' + JSON.stringify(lastObj && lastObj.warmups));
  const series = await page.evaluate(async () => {
    const t = window.__t; const all = t.buildAllOneRepMaxSeries(await t.loadAllEntries());
    return Object.keys(all).map(k => ({ k, points: all[k].points.map(p => ({ date: p.date, value: p.value, set: p.set })) }));
  });
  ok(series.length === 1 && series[0].points.length === 1 && JSON.stringify(series[0].points[0].set) === '{"weight":92.5,"reps":5}' && series[0].points[0].value === 107.5, '10 Kehityksen 1RM työsarjasta 92,5 × 5 (lämmittely ei kuulu): ' + JSON.stringify(series));
  await page.click('.tab[data-tab="historia"]'); await page.waitForSelector('#history-list'); await w(400);
  await page.click('.history-date-head[data-date="' + TODAY + '"]'); await w(500);
  const hist = await page.evaluate(() => [...document.querySelectorAll('.history-set')].map(e => e.getAttribute('aria-label')));
  ok(JSON.stringify(hist) === '["Lämmittely 1: 42,5 kg × 8, RPE 8","Sarja 1: 92,5 kg × 5"]', '10 Historia: L1 ennen työsarjaa: ' + JSON.stringify(hist));
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="varmuuskopio"]'); await w(600);
  const backup = await download(page);
  const lines = backup.split('\n').filter(l => l.indexOf('"' + TODAY + '"') === 0);
  // Sarakkeet Osasarjoihin asti; 0.4.29 alkaen viimeisenä Kevennys (tässä tyhjä).
  ok(lines.length === 2 && lines[0] === '"' + TODAY + '","' + SQUAT + '","1","92.5","5","","plain","r1","","",""' &&
    lines[1] === '"' + TODAY + '","' + SQUAT + '","L1","42.5","8","","plain","r1","Työläs","",""', '10 varmuuskopion L1-rivi: ' + JSON.stringify(lines));

  console.log('=== 11 tekstit: Ohje ja Muutokset');
  // Asetusten alinäkymässä ei ole logoriviä (?-painiketta), joten ensin Ohjelmaan.
  await page.click('.tab[data-tab="ohjelma"]'); await w(600);
  await page.click('[data-tab="ohje"]'); await w(600);
  const ohje = await page.evaluate(() => document.querySelector('main').textContent.replace(/\s+/g, ' '));
  ok(ohje.indexOf('Viime kerran lämmittelyitä käytetään vain kokonaisena sarjana: kun työpaino on enintään 15 % eri kuin viime kerralla') !== -1 &&
    ohje.indexOf('Ehdotukset nousevat aiempien lämmittelyrivien yläpuolelle ja jäävät työpainon alle') !== -1, '11 Ohjeen lämmittelykappale');
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="muutokset"]'); await w(500);
  const muutokset = await page.evaluate(() => document.querySelector('main').textContent);
  // Vain muutoskoosteen kohta: sovelluksen versionumero kasvaa myöhemmissä versioissa.
  ok(muutokset.indexOf('Lämmittelyehdotukset nousevat nyt aina kohti työpainoa (versio 0.4.27)') !== -1, '11 Muutokset-merkintä 0.4.27');

  ok(errors.length === 0, 'ei sivuvirheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
