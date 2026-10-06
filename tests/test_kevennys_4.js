// Pyydetty kevennys Kehityksessä (0.4.31, kevennys-sarja 4/4): pyydetty
// kevennys (deloadKind "pyydetty") näkyy 1RM-käyrässä kevennysmerkillä,
// mutta sitä ei käytetä kortin luvussa, muutoksessa, vertailuissa,
// ennätyksissä, Pysähtynyt-tunnisteessa eikä progressiotavoitteessa;
// volyymiin se lasketaan, eikä se tee viikosta kevennysviikkoa.
// Automaattinen kevennys (deload ilman lajia) ennallaan. Kehotteen
// tapaukset 1–8 sekä 1RM-sarjan saman päivän yhdistämissääntö ja
// apufunktiot suoraan kutsuen. Funktioiden lukemiseksi sivulle tarjoillaan
// reitityksessä index.html, jonka sulkeuman loppuun on lisätty
// window.__t-viittaukset; tiedostoon itseensä ei kosketa.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
// Sitovat välilyönnit (tuhaterotin, yksikkö) tavallisiksi vertailua varten.
const nb = s => s == null ? s : String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

const EXPOSE = ['buildAllOneRepMaxSeries', 'oneRepMaxPerformancePoints', 'oneRepMaxValuePoints', 'computeProgress', 'fourWeekDelta',
  'buildRecordsByName', 'buildWeeklySummary', 'buildAdherenceByName', 'isRequestedDeloadSession', 'APP_VERSION'];
function instrumentedHtml(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const marker = '})();\n</script>';
  const i = html.lastIndexOf(marker);
  if(i === -1) throw new Error('index.html: sovelluksen sulkeuman loppua ei löytynyt');
  const hook = 'window.__t = {' + EXPOSE.map(n => JSON.stringify(n) + ': (typeof ' + n + ' !== "undefined" ? ' + n + ' : null)').join(', ') + '};\n';
  return html.slice(0, i) + hook + html.slice(i);
}

const ROW = 'Kulmasoutu tangolla';
const BENCH = 'Penkkipunnerrus tangolla';
function pex(id, name, sets, reps, extra){ return Object.assign({ id, name, sets, reps, unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
// Ohjelman ainoa liike ei koske merkintöjä; se pitää Seuraavaksi-kortin piirrettynä.
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [pex('Z', 'Hauiskääntö tangolla', '2', '10')] } ] };
// Tapaus 8: sama ohjelma ja teholiike (MAX) samalla nimellä kuin merkinnät.
const PROGRAM_MAX = JSON.parse(JSON.stringify(PROGRAM));
PROGRAM_MAX.days[0].exercises.push(pex('M', ROW, '1', '1', { notes: 'MAX', intensity: { isMax: true, percents: [] } }));

const TYOLAS = 8, KEVYT = 6;
const PK = { deload: true, deloadKind: 'pyydetty' };
const AK = { deload: true };
// Merkintä: kaksi samaa sarjaa, loggedAt päivä + T15:00, kind plain.
function ent(date, name, weight, reps, rpe, extra, id){
  const set = () => ({ weight: String(weight), reps: String(reps), notes: '', done: true, kind: 'work', rpe });
  return { date, exercises: { [id || 'K']: Object.assign({ name, sets: [set(), set()], loggedAt: date + 'T15:00:00.000Z', warmups: [], kind: 'plain' }, extra || {}) } };
}
const byDate = list => { const o = {}; list.forEach(e => { o[e.date] = e; }); return o; };
const CASE1 = [ent('2026-08-20', ROW, 100, 10, TYOLAS), ent('2026-10-06', ROW, 90, 10, KEVYT, PK)];
const CASE2 = [ent('2026-09-01', BENCH, 95, 8, TYOLAS), ent('2026-09-08', BENCH, 100, 8, TYOLAS), ent('2026-09-15', BENCH, 100, 8, TYOLAS),
  ent('2026-09-22', BENCH, 100, 8, TYOLAS), ent('2026-09-29', BENCH, 90, 8, KEVYT, PK)];
const CASE3 = [ent('2026-08-20', ROW, 100, 10, TYOLAS), ent('2026-10-06', ROW, 90, 10, KEVYT, PK), ent('2026-10-08', ROW, 100, 10, TYOLAS)];
const CASE4 = [ent('2026-08-20', ROW, 100, 10, TYOLAS), ent('2026-10-06', ROW, 90, 10, KEVYT, AK)];
const CASE5 = [ent('2026-10-06', ROW, 90, 10, KEVYT, PK)];
const OCT9 = new Date('2026-10-09T12:00:00');
const OCT1 = new Date('2026-10-01T12:00:00');

async function load(page, ents, now, program){
  await page.clock.setFixedTime(now);
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(o.program));
    Object.keys(o.entries).forEach(d => localStorage.setItem('treenipk:entries:' + d, JSON.stringify(o.entries[d])));
  }, { program: program || PROGRAM, entries: byDate(ents) });
  await page.goto(URL);
  await page.waitForSelector('.bottom-nav'); await w(400);
  if(await page.$('[data-close-ex]')){ await page.click('[data-close-ex]'); await w(500); }
}
async function kehitys(page){ await page.click('.tab[data-tab="kehitys"]'); await page.waitForSelector('main .segmented, main .empty-state'); await w(500); }
async function front(page, tab){ await page.click('[data-kehitys-front-tab="' + tab + '"]'); await w(400); }
async function openRow(page, name){ await page.click('.kehitys-row:has(.kehitys-row-name:text-is("' + name + '"))'); await w(600); }
async function detailTab(page, tab){ await page.click('[data-kehitys-tab="' + tab + '"]'); await w(400); }
async function backToList(page){ await page.click('[data-close-kehitys]'); await w(500); }
const rowInfo = (page, name) => page.evaluate(name => {
  const row = [...document.querySelectorAll('.kehitys-row')].find(r => r.querySelector('.kehitys-row-name').textContent === name);
  if(!row) return null;
  const d = row.querySelector('.kehitys-row-delta');
  const pl = row.querySelector('svg.kehitys-spark polyline');
  return { date: row.querySelector('.kehitys-row-sub span').textContent, value: row.querySelector('.kehitys-row-value').textContent,
    delta: d ? d.textContent : null, stalled: !!row.querySelector('.chip-danger'), spark: pl ? pl.getAttribute('points') : null };
}, name);
const card = page => page.evaluate(() => {
  const c = document.querySelector('.kehitys-card');
  const stat = label => { const s = [...c.querySelectorAll('.stat')].find(x => x.querySelector('.stat-label').textContent === label); return s ? { value: s.querySelector('.stat-value').textContent, sub: (s.querySelector('.stat-delta') || {}).textContent || '' } : null; };
  const svg = c.querySelector('.chart svg');
  return { hero: c.querySelector('.kehitys-hero-value') ? c.querySelector('.kehitys-hero-value').textContent : null,
    chip: (c.querySelector('.kehitys-delta-chip') || {}).textContent || null,
    month: stat('Kuukausi'), record: stat('Ennätykseen'),
    notes: [...c.querySelectorAll(':scope > .kehitys-note')].map(n => n.textContent),
    captions: [...c.querySelectorAll('rect.chart-hit')].map(r => r.getAttribute('data-caption')),
    caption: (c.querySelector('.chart-caption') || {}).textContent || null,
    markers: svg ? svg.querySelectorAll('line[y1="8"]').length : 0,
    markerText: svg ? [...svg.querySelectorAll('text[y="6"]')].map(t => t.textContent) : [],
    tabs: [...document.querySelectorAll('[data-kehitys-tab]')].map(b => b.dataset.kehitysTab + (b.classList.contains('dim') ? ':dim' : '')) };
});
const metric = (page, label) => page.evaluate(label => {
  const m = [...document.querySelectorAll('.metric-row')].find(r => r.querySelector('.metric-label').textContent === label);
  return m ? m.querySelector('.metric-value').firstChild.textContent.trim() : null;
}, label);
const weekLabels = page => page.evaluate(() => {
  const l = document.querySelector('.week-bars-labels');
  return l ? [...l.children].map(s => s.textContent) : null;
});
const stalledChips = page => page.evaluate(() => [...document.querySelectorAll('.chip-danger.chip-btn[data-open-kehitys]')].map(b => b.textContent));
const maxRow = (page, key) => page.evaluate(k => {
  const rows = [...document.querySelectorAll('.ledger-row')];
  const row = rows.find(r => (r.firstElementChild && r.firstElementChild.firstElementChild || {}).textContent && r.firstElementChild.firstElementChild.textContent.trim().toLowerCase() === k);
  if(!row) return null;
  const est = row.querySelector('.max-estimate');
  const btn = row.querySelector('[data-adopt-max]');
  return { est: est ? est.querySelector('span').textContent.trim() : null, btn: btn ? btn.textContent.trim() : null };
}, key);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/index.html', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: instrumentedHtml() }));

  console.log('=== 0 1RM-sarjan excluded-kenttä, saman päivän yhdistäminen ja apufunktiot');
  await load(page, [], OCT9);
  const fn = await page.evaluate(() => {
    const t = window.__t;
    if(!t.oneRepMaxPerformancePoints || !t.oneRepMaxValuePoints) return { missing: true };
    const S = (wt, r, rpe) => ({ weight: String(wt), reps: String(r), done: true, rpe });
    const ex = (name, sets, extra) => Object.assign({ name, sets, kind: 'plain' }, extra || {});
    const PKk = { deload: true, deloadKind: 'pyydetty' };
    const run = list => {
      const pts = t.buildAllOneRepMaxSeries(list)['kulmasoutu tangolla'];
      return pts ? pts.points.map(p => ({ date: p.date, value: p.value, excluded: p.excluded, deload: p.deload, set: p.set ? p.set.weight + 'x' + p.set.reps : null })) : null;
    };
    const day = (date, exs) => ({ date, entry: { exercises: exs } });
    const out = {};
    // Uusi päivä: PK → excluded true, AK ja tavallinen false.
    out.newDay = run([day('2026-10-01', { K: ex('Kulmasoutu tangolla', [S(90, 10, 6)], PKk) }), day('2026-10-02', { K: ex('Kulmasoutu tangolla', [S(90, 10, 6)], { deload: true }) }),
      day('2026-10-03', { K: ex('Kulmasoutu tangolla', [S(90, 10, 6)]) })]);
    // Sama päivä: PK ensin (suurempi arvo), sitten tavallinen → tavallisen arvo, excluded false, deload säilyy.
    out.pkThenPlain = run([day('2026-10-01', { K1: ex('Kulmasoutu tangolla', [S(120, 10, 6)], PKk), K2: ex('Kulmasoutu tangolla', [S(90, 10, 8)]) })]);
    // Sama päivä: tavallinen ensin, sitten raskaampi PK → arvo ei muutu.
    out.plainThenPk = run([day('2026-10-01', { K1: ex('Kulmasoutu tangolla', [S(90, 10, 8)]), K2: ex('Kulmasoutu tangolla', [S(120, 10, 6)], PKk) })]);
    // Molemmat PK → parempi voittaa, excluded true.
    out.bothPk = run([day('2026-10-01', { K1: ex('Kulmasoutu tangolla', [S(90, 10, 6)], PKk), K2: ex('Kulmasoutu tangolla', [S(95, 10, 6)], PKk) })]);
    // Molemmat tavallisia → parempi voittaa.
    out.bothPlain = run([day('2026-10-01', { K1: ex('Kulmasoutu tangolla', [S(95, 10, 8)]), K2: ex('Kulmasoutu tangolla', [S(90, 10, 8)]) })]);
    // Apufunktiot.
    const pts = [{ date: 'a', value: 1, excluded: false }, { date: 'b', value: 2, excluded: true }, { date: 'c', value: 3 }];
    const onlyExcl = [{ date: 'a', value: 1, excluded: true }];
    out.perf = t.oneRepMaxPerformancePoints(pts).map(p => p.date).join(',');
    out.value = t.oneRepMaxValuePoints(pts).map(p => p.date).join(',');
    out.valueOnlyExclSame = t.oneRepMaxValuePoints(onlyExcl) === onlyExcl;
    out.perfOnlyExcl = t.oneRepMaxPerformancePoints(onlyExcl).length;
    out.nulls = [t.oneRepMaxPerformancePoints(null).length, t.oneRepMaxValuePoints(undefined).length];
    out.isReq = [t.isRequestedDeloadSession(PKk), t.isRequestedDeloadSession({ deload: true }), t.isRequestedDeloadSession({ deloadKind: 'pyydetty' })];
    return out;
  });
  if(fn.missing){ ok(false, '0 oneRepMaxPerformancePoints ja oneRepMaxValuePoints puuttuvat'); }
  else {
    ok(JSON.stringify(fn.newDay.map(p => [p.value, p.excluded, p.deload])) === JSON.stringify([[132.5, true, true], [132.5, false, true], [132.5, false, false]]),
      '0 uusi päivä: PK excluded, AK ja tavallinen eivät: ' + JSON.stringify(fn.newDay));
    ok(fn.pkThenPlain.length === 1 && fn.pkThenPlain[0].value === 125 && fn.pkThenPlain[0].excluded === false && fn.pkThenPlain[0].set === '90x10' && fn.pkThenPlain[0].deload === true,
      '0 sama päivä PK → tavallinen: tavallisen arvo 125, excluded false, kevennysmerkki säilyy: ' + JSON.stringify(fn.pkThenPlain));
    ok(fn.plainThenPk.length === 1 && fn.plainThenPk[0].value === 125 && fn.plainThenPk[0].excluded === false && fn.plainThenPk[0].set === '90x10' && fn.plainThenPk[0].deload === true,
      '0 sama päivä tavallinen → raskaampi PK: arvo ei muutu: ' + JSON.stringify(fn.plainThenPk));
    ok(fn.bothPk.length === 1 && fn.bothPk[0].value === 140 && fn.bothPk[0].excluded === true && fn.bothPk[0].set === '95x10',
      '0 molemmat PK: parempi voittaa (95 × 10 Kevyt → 140), excluded true: ' + JSON.stringify(fn.bothPk));
    ok(fn.bothPlain.length === 1 && fn.bothPlain[0].value === 132.5 && fn.bothPlain[0].excluded === false && fn.bothPlain[0].set === '95x10',
      '0 molemmat tavallisia: parempi voittaa: ' + JSON.stringify(fn.bothPlain));
    ok(fn.perf === 'a,c' && fn.value === 'a,c' && fn.valueOnlyExclSame && fn.perfOnlyExcl === 0 && fn.nulls.join() === '0,0',
      '0 apufunktiot: suorituskyky- ja arvopisteet, vain poissuljetut → kaikki pisteet: ' + JSON.stringify([fn.perf, fn.value, fn.valueOnlyExclSame, fn.perfOnlyExcl, fn.nulls]));
    ok(fn.isReq.join() === 'true,false,false', '0 isRequestedDeloadSession merkinnälle: ' + fn.isReq.join());
  }

  console.log('=== 1 Tauon jälkeen (20.8. 100 × 10 Työläs, 6.10. 90 × 10 Kevyt pyydetty kevennys, kello 9.10.)');
  await load(page, CASE1, OCT9);
  await kehitys(page);
  let labels = await weekLabels(page);
  ok(labels && labels.length === 3 && labels[1] === '', '1 viikkopylväiden selitteessä ei "kevennys": ' + JSON.stringify(labels));
  await front(page, 'liikkeet');
  let r = await rowInfo(page, ROW);
  ok(r && r.date === '6.10.' && nb(r.value) === '140 kg' && r.delta === null, '1 liikelistan rivi: päivä 6.10., 140 kg, ei muutosta: ' + JSON.stringify(r));
  ok(r && r.spark === null, '1 sparkline arvopisteistä: yksi piste → ei käyrää: ' + (r && r.spark));
  await openRow(page, ROW);
  let c = await card(page);
  ok(nb(c.hero) === '140kg' && c.chip === 'ei vertailua', '1 kortin luku 140 kg ja "ei vertailua": ' + JSON.stringify([c.hero, c.chip]));
  ok(c.month && nb(c.month.value) === '0 kg' && c.record && nb(c.record.value) === '0 kg' && c.record.sub === 'ennätys nyt',
    '1 ruudukko: Kuukausi 0 kg, Ennätykseen "ennätys nyt": ' + JSON.stringify([c.month, c.record]));
  ok(c.notes.length === 1 && nb(c.notes[0]) === 'Laskennallinen 100 kg × 10, Työläs, Torstai 20. elokuuta',
    '1 viimeisimmän treenin selite kevennystä edeltävästä kerrasta: ' + JSON.stringify(c.notes));
  ok(c.captions.length === 2 && nb(c.captions[0]) === '20.8. · 140 kg laskennallinen (100 kg × 10, Työläs) · paras 4 vk 140 kg'
    && nb(c.captions[1]) === '6.10. · 132,5 kg laskennallinen (90 kg × 10, Kevyt) · paras 4 vk 140 kg · pyydetty kevennys, ei 1RM-arvioon',
    '1 käyrän selitteet: ' + JSON.stringify(c.captions));
  ok(nb(c.caption) === nb(c.captions[1]), '1 oletusselite on viimeisen pisteen: ' + c.caption);
  ok(c.markers === 1 && c.markerText.join() === 'kevennys', '1 käyrän kevennysmerkki 6.10. säilyy: ' + JSON.stringify([c.markers, c.markerText]));
  ok(c.tabs.join() === '1rm,ennatykset,volyymi,toteutuminen:dim', '1 Toteutuminen himmenee (ei plan-kenttää eikä ohjelman liikettä): ' + c.tabs.join());
  console.log('=== 6 Ennätykset (tapauksen 1 tiedot)');
  await detailTab(page, 'ennatykset');
  const rec1 = await page.evaluate(() => {
    const c = document.querySelector('.kehitys-card');
    const heavy = [...c.querySelectorAll('.stat')].find(s => s.querySelector('.stat-label').textContent === 'Raskain paino');
    const row = [...c.querySelectorAll('.kehitys-table tbody tr')].find(tr => tr.firstElementChild.textContent === '7–10');
    return { heavy: heavy ? heavy.querySelector('.stat-value').textContent : null, heavyDate: heavy ? heavy.querySelector('.stat-delta').textContent : null,
      bin: row ? [...row.children].map(td => td.textContent) : null };
  });
  ok(nb(rec1.heavy) === '100 kg × 10' && rec1.heavyDate === 'Torstai 20. elokuuta' && rec1.bin && nb(rec1.bin[1]) === '100 kg' && rec1.bin[3] === '20.8.',
    '6 raskain paino 100 kg × 10 (20.8.), toistoalue 7–10 100 kg: ' + JSON.stringify(rec1));
  await backToList(page);
  console.log('=== 7 Volyymi (tapauksen 1 tiedot)');
  await front(page, 'yhteenveto');
  const vol = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.kehitys-card .stat')].find(x => x.querySelector('.stat-label').textContent === 'Kokonaispaino');
    return s ? s.querySelector('.stat-value').textContent : null;
  });
  ok(nb(vol) === '1 800 kg', '7 viikkokortin Kokonaispaino 1 800 kg (kevennys 2 × 90 × 10): ' + vol);

  console.log('=== 2 Pysähtynyt (penkki 1.9.–22.9. Työläs, 29.9. 90 × 8 Kevyt pyydetty kevennys, kello 1.10.)');
  await load(page, CASE2, OCT1);
  await kehitys(page);
  let chips = await stalledChips(page);
  ok(chips.length === 0, '2 yhteenvedossa ei Pysähtynyt-tunnistetta: ' + JSON.stringify(chips));
  let prog = await metric(page, 'Progressiotavoite');
  ok(prog === '1 / 3', '2 yhteenvedon progressiotavoite 1 / 3: ' + prog);
  await front(page, 'liikkeet');
  r = await rowInfo(page, BENCH);
  ok(r && !r.stalled && nb(r.value) === '132,5 kg' && r.delta === null && r.date === '29.9.', '2 listarivi: 132,5 kg, ei muutosta eikä Pysähtynyt: ' + JSON.stringify(r));
  ok(r && r.spark && r.spark.split(' ').length === 4, '2 sparkline neljästä arvopisteestä (kevennys pois): ' + (r && r.spark));
  await openRow(page, BENCH);
  const head2 = await page.evaluate(() => !!document.querySelector('.screen-head .chip-danger'));
  ok(!head2, '2 liikenäkymän otsikossa ei Pysähtynyt-tunnistetta');
  await detailTab(page, 'toteutuminen');
  prog = await metric(page, 'Progressiotavoite');
  const t2 = await page.evaluate(() => [...document.querySelectorAll('.kehitys-card .kehitys-table tbody tr')].map(tr => [tr.firstElementChild.textContent, tr.lastElementChild.getAttribute('aria-label')]));
  ok(prog === '1 / 3', '2 liikkeen progressiotavoite 1 / 3: ' + prog);
  ok(t2.length && t2[0][0] === '29.9.' && t2[0][1] === 'Ei laskettavissa', '2 kevennyskerta on kerroissa, progressio ei laskettavissa: ' + JSON.stringify(t2[0]));

  console.log('=== 3 Progressio kevennyksen jälkeen (20.8., 6.10. pyydetty kevennys, 8.10.; kello 9.10.)');
  await load(page, CASE3, OCT9);
  await kehitys(page);
  prog = await metric(page, 'Progressiotavoite');
  ok(prog === '0 / 1', '3 yhteenvedon progressiotavoite 0 / 1: ' + prog);
  await front(page, 'liikkeet');
  await openRow(page, ROW);
  await detailTab(page, 'toteutuminen');
  prog = await metric(page, 'Progressiotavoite');
  const sugg3 = await metric(page, 'Ehdotettu paino');
  ok(prog === '0 / 1', '3 8.10. verrataan kevennystä edeltäneeseen (140 < 140 × 1,0125): ' + prog);
  ok(sugg3 === '0 / 1', '3 ehdotettu paino päätellään kevennystä edeltäneestä kerrasta (8.10. 100 < ehdotus): ' + sugg3);

  console.log('=== 4 Automaattinen kevennys ennallaan (kuten 1, mutta 6.10. automaattinen)');
  await load(page, CASE4, OCT9);
  await kehitys(page);
  labels = await weekLabels(page);
  ok(labels && labels[1] === 'kevennys', '4 viikkopylväiden selitteessä "kevennys": ' + JSON.stringify(labels));
  prog = await metric(page, 'Progressiotavoite');
  ok(prog === '0 / 1', '4 yhteenvedon progressiotavoite 0 / 1: ' + prog);
  await front(page, 'liikkeet');
  r = await rowInfo(page, ROW);
  ok(r && nb(r.value) === '132,5 kg' && nb(r.delta) === '−7,5 kg (−5,4 %)', '4 listarivi 132,5 kg −7,5 kg (−5,4 %): ' + JSON.stringify(r));
  await openRow(page, ROW);
  c = await card(page);
  ok(nb(c.hero) === '132,5kg' && nb(c.chip) === '−7,5 kg · 4 vk' && c.markers === 1, '4 kortti ennallaan: ' + JSON.stringify([c.hero, c.chip, c.markers]));
  ok(c.captions.length === 2 && nb(c.captions[1]) === '6.10. · 132,5 kg laskennallinen (90 kg × 10, Kevyt) · paras 4 vk 132,5 kg', '4 selite ilman kevennystekstiä: ' + JSON.stringify(c.captions));
  await detailTab(page, 'toteutuminen');
  prog = await metric(page, 'Progressiotavoite');
  ok(prog === '0 / 1', '4 liikkeen progressiotavoite 0 / 1: ' + prog);

  console.log('=== 5 Vain pyydetty kevennys (6.10. 90 × 10 Kevyt; kello 9.10.)');
  await load(page, CASE5, OCT9);
  await kehitys(page);
  await front(page, 'liikkeet');
  r = await rowInfo(page, ROW);
  ok(r && nb(r.value) === '132,5 kg' && r.delta === null, '5 liike näkyy listalla arvolla 132,5 kg: ' + JSON.stringify(r));
  await openRow(page, ROW);
  c = await card(page);
  ok(nb(c.hero) === '132,5kg' && c.chip === 'ei vertailua', '5 kortti 132,5 kg, "ei vertailua": ' + JSON.stringify([c.hero, c.chip]));
  ok(c.captions.length === 1 && nb(c.captions[0]) === '6.10. · 132,5 kg laskennallinen (90 kg × 10, Kevyt) · paras 4 vk 132,5 kg · pyydetty kevennys',
    '5 käyrän ainoa selite ilman ", ei 1RM-arvioon": ' + JSON.stringify(c.captions));
  console.log('=== 6 Ennätykset (tapauksen 5 tiedot)');
  ok(c.tabs.indexOf('ennatykset:dim') !== -1, '6 Ennätykset-välilehti himmennetty: ' + c.tabs.join());
  await detailTab(page, 'ennatykset');
  const rec5 = await page.evaluate(() => (document.querySelector('.kehitys-card .kehitys-note') || {}).textContent || null);
  ok(rec5 === 'Ennätykset lasketaan sarjoista, joissa on paino ja toistot.', '6 sisältö: ' + rec5);

  console.log('=== 8 Asetusten 1RM-luettelo (teholiike MAX ilman 1RM:ää, tapauksen 1 tiedot)');
  await load(page, CASE1, OCT9, PROGRAM_MAX);
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="1rm"]'); await w(700);
  const mr = await maxRow(page, ROW.toLowerCase());
  ok(mr && nb(mr.est) === 'Kehityksen arvio 140 kg (20.8.)' && nb(mr.btn) === 'Käytä 140 kg', '8 arvio 140 kg (20.8.) ja Käytä 140 kg: ' + JSON.stringify(mr));

  console.log('=== Ohje ja Muutokset');
  await page.click('[data-tab="ohjelma"]'); await w(450);
  await page.click('[data-tab="ohje"]'); await w(500);
  const ohje = await page.evaluate(() => document.querySelector('main').textContent.replace(/\s+/g, ' '));
  ok(ohje.indexOf('Pyydetty kevennys (Kevennä tämä kerta) ei vaikuta arvioon eikä vertailuihin') !== -1, '9 Ohjeen 1RM-kohta kertoo pyydetystä kevennyksestä');
  await page.click('[data-tab="asetukset"]'); await w(450);
  await page.click('[data-settings-section="muutokset"]'); await w(450);
  const muut = await page.evaluate(() => document.querySelector('main').textContent.replace(/\s+/g, ' '));
  const ver = await page.evaluate(() => window.__t.APP_VERSION);
  ok(muut.indexOf('Pyydetty kevennys ei enää vaikuta Kehityksen 1RM-arvioon (versio ' + ver + ')') !== -1, '9 Muutokset kertoo muutoksesta (versio ' + ver + ')');

  ok(errors.length === 0, 'ei sivuvirheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
