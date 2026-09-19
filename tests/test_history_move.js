// Historia: liikkeen siirto toiselle päivälle (0.4.22).
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function pex(id, name, extra){ return Object.assign({ id, name, sets: '3', reps: '8', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [pex('ex-1','Penkkipunnerrus', { intensity: { isMax: true, percents: [] } }), pex('ex-2','Kulmasoutu')] } ] };
const st = (w, r, extra) => Object.assign({ weight: w, reps: r, done: true }, extra || {});
const E = [
  { date: '2026-09-14', exercises: {
    'ex-1': { name: 'Penkkipunnerrus', sets: [st(80,1), st(60,8)], warmups: [], kind: 'plain', loggedAt: '2026-09-14T10:15:00.000Z' },
    'ex-2': { name: 'Kulmasoutu', sets: [st(70,8), st(70,8)], warmups: [{ weight: 40, reps: 8, rpe: 6 }], kind: 'plain', loggedAt: '2026-09-14T10:40:00.000Z' } } },
  { date: '2026-09-10', exercises: { 'ex-2': { name: 'Kulmasoutu', sets: [st(65,8)], kind: 'plain', loggedAt: '2026-09-10T10:00:00.000Z' } } },
];
const w = ms => new Promise(r => setTimeout(r, ms));
async function seed(page, prog, ents){
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ prog, ents }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(prog));
    ents.forEach(e => localStorage.setItem('treenipk:entries:' + e.date, JSON.stringify(e)));
  }, { prog, ents });
  await page.goto(URL); await page.waitForSelector('.bottom-nav'); await w(300);
}
async function historia(page){ await page.click('.tab[data-tab="historia"]'); await page.waitForSelector('#history-list'); await w(400); }
async function openDay(page, date){
  const open = await page.evaluate((d) => !!document.querySelector('.history-date-head[data-date="' + d + '"].open'), date);
  if(!open){ await page.click('.history-date-head[data-date="' + date + '"]'); await w(400); }
}
const days = page => page.evaluate(() => [...document.querySelectorAll('.history-date-head[data-date]')].map(h => h.dataset.date + ':' + [...h.querySelectorAll('.history-badge')].map(b => b.textContent).join('/')));
const dayEx = (page) => page.evaluate(() => [...document.querySelectorAll('.history-date-head.open')].map(h => h.dataset.date + '=' + [...h.parentElement.querySelectorAll('.history-ex')].map(x => x.querySelector('.history-ex-name').textContent + '[' + [...x.querySelectorAll('.history-actions button')].map(b => b.textContent.trim()).join(',') + ']').join(';')));
const entry = (page, d) => page.evaluate((d) => JSON.parse(localStorage.getItem('treenipk:entries:' + d) || 'null'), d);
const toast = page => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('=== 1 painike ja pohjalevy');
  await seed(page, PROGRAM, E); await historia(page);
  await openDay(page, '2026-09-14');
  let ex = await dayEx(page);
  ok(ex[0] === '2026-09-14=Penkkipunnerrus[Kehityksessä ›,Korjaa,Siirrä päivälle];Kulmasoutu[Kehityksessä ›,Korjaa,Siirrä päivälle]', '1 Siirrä päivälle molemmilla liikkeillä: ' + ex[0]);
  await page.click('[data-open-sheet="siirto"][data-id="ex-2"]'); await w(400);
  const sheet = await page.evaluate(() => { const s = document.querySelector('.sheet'); const i = document.getElementById('move-date'); return s ? { title: s.getAttribute('aria-label'), q: s.querySelector('.rpe-sheet-q').textContent, val: i.value, max: i.max, buttons: [...s.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean), focus: document.activeElement && document.activeElement.getAttribute('aria-label') } : null; });
  ok(sheet && sheet.title === 'Siirrä toiselle päivälle' && sheet.q.indexOf('Kulmasoutu') === 0 && sheet.q.indexOf('14. syyskuuta') !== -1 && sheet.val === '2026-09-14' && sheet.buttons.join('|') === 'Peruuta|Siirrä', '1 pohjalevy: ' + JSON.stringify(sheet));

  console.log('=== 2 sama päivä estetään');
  await page.click('[data-move-exercise-confirm]'); await w(300);
  ok((await toast(page)).indexOf('Liike on jo tällä päivällä') !== -1 && !!(await page.$('.sheet')), '2 sama päivä: ilmoitus, levy auki');

  console.log('=== 3 sama liike jo kohdepäivällä');
  await page.fill('#move-date', '2026-09-10'); await page.click('[data-move-exercise-confirm]'); await w(300);
  ok((await toast(page)).indexOf('Sama liike on jo kirjattu päivälle torstai 10. syyskuuta') !== -1 && !!(await page.$('.sheet')), '3 estetty: ' + await toast(page));

  console.log('=== 4 siirto uudelle päivälle 12.9.');
  await page.fill('#move-date', '2026-09-12'); await page.click('[data-move-exercise-confirm]'); await w(600);
  ok(!(await page.$('.sheet')) && (await toast(page)).indexOf('Siirretty päivälle lauantai 12. syyskuuta') !== -1, '4 levy kiinni, ilmoitus: ' + await toast(page));
  let d = await days(page);
  ok(d.join(';') === '2026-09-14:;2026-09-12:korjattu;2026-09-10:', '4 päivälista: 12.9. lisätty korjattu-merkillä: ' + d.join(';'));
  ex = await dayEx(page);
  ok(ex.join('|') === '2026-09-12=Kulmasoutu[Kehityssä ›,Korjaa,Siirrä päivälle]'.replace('Kehityssä','Kehityksessä'), '4 kohdepäivä avattu, Korjaa siirtyi mukana (exerciseLogIndex): ' + ex.join('|'));
  const e12 = await entry(page, '2026-09-12'), e14 = await entry(page, '2026-09-14');
  ok(e12 && e12.date === '2026-09-12' && Object.keys(e12.exercises).join() === 'ex-2' && e12.exercises['ex-2'].loggedAt === '2026-09-12T10:40:00.000Z' && !!e12.exercises['ex-2'].editedAt && e12.exercises['ex-2'].warmups.length === 1 && e12.exercises['ex-2'].sets.length === 2, '4 kohdemerkintä: loggedAt uusi päivä, kellonaika säilyy, editedAt, sarjat ja lämmittelyt mukana: ' + JSON.stringify(e12));
  ok(e14 && Object.keys(e14.exercises).join() === 'ex-1', '4 lähdepäivällä vain ex-1');
  const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:last-set-log') || '{}'));
  ok(ls['kulmasoutu'] && ls['kulmasoutu'].date === '2026-09-12' && ls['kulmasoutu'].prior[0].date === '2026-09-10', '4 lastSet rakennettu uudelleen: ' + JSON.stringify(ls['kulmasoutu'] && [ls['kulmasoutu'].date, ls['kulmasoutu'].prior.map(p => p.date)]));
  await openDay(page, '2026-09-14');
  ex = await dayEx(page);
  ok(ex.join('|').indexOf('2026-09-14=Penkkipunnerrus[') !== -1, '4 lähdepäivä näyttää ex-1');

  console.log('=== 5 viimeisen liikkeen siirto poistaa tyhjän päivän');
  await page.click('[data-open-sheet="siirto"][data-id="ex-1"]'); await w(400);
  await page.fill('#move-date', '2026-09-13'); await page.click('[data-move-exercise-confirm]'); await w(600);
  d = await days(page);
  ok(d.join(';') === '2026-09-13:korjattu;2026-09-12:korjattu;2026-09-10:', '5 14.9. poistui, 13.9. lisätty: ' + d.join(';'));
  ok((await entry(page, '2026-09-14')) === null, '5 tyhjä merkintä poistettu tallennustilasta');
  const mm = await page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:manual-max') || localStorage.getItem('treenipk:manual-1rm') || '{}'));
  const mmKey = Object.keys(mm).find(k => k.indexOf('penkki') === 0);
  ok(!mmKey || mm[mmKey].date === '2026-09-13', '5 1RM-päivä seuraa siirtoa: ' + JSON.stringify(mm));

  console.log('=== 6 Escape ja Peruuta sulkevat, fokus palaa');
  await openDay(page, '2026-09-13');
  await page.click('[data-open-sheet="siirto"][data-id="ex-1"]'); await w(400);
  await page.keyboard.press('Escape'); await w(400);
  const f6 = await page.evaluate(() => ({ sheet: !!document.querySelector('.sheet'), focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.id : null }));
  ok(!f6.sheet && f6.focus === 'ex-1', '6 Escape sulkee, fokus siirtopainikkeessa: ' + JSON.stringify(f6));
  await page.click('[data-open-sheet="siirto"][data-id="ex-1"]'); await w(400);
  await page.click('.sheet [data-close-sheet]'); await w(400);
  ok(!(await page.$('.sheet')), '6 Peruuta sulkee');
  const e13 = await entry(page, '2026-09-13');
  ok(e13 && Object.keys(e13.exercises).join() === 'ex-1', '6 peruutus ei muuta merkintöjä');

  console.log('=== 7 Kehitys lasketaan uudelleen');
  await page.click('.tab[data-tab="kehitys"]'); await w(600);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.kehitys-row')].length + (document.querySelector('.kehitys-tabs') ? 1 : 0));
  ok(rows >= 1, '7 Kehitys avautuu virheittä');

  console.log('=== 8 suodatintila');
  await seed(page, PROGRAM, E.concat([1,2,3,4].map(i => ({ date: '2026-09-0' + i, exercises: { 'ex-1': { name: 'Penkkipunnerrus', sets: [st(50,8)], kind: 'plain', loggedAt: '2026-09-0' + i + 'T09:00:00.000Z' } } })))); await historia(page);
  await page.fill('#history-filter', 'kulma'); await w(400);
  const fbtns = await page.evaluate(() => [...document.querySelectorAll('#history-list [data-open-sheet="siirto"]')].map(b => b.dataset.date + '/' + b.dataset.id));
  ok(fbtns.join(';') === '2026-09-14/ex-2;2026-09-10/ex-2', '8 suodatetussa listassa siirtopainikkeet: ' + fbtns.join(';'));
  await page.click('[data-open-sheet="siirto"][data-date="2026-09-10"]'); await w(400);
  await page.fill('#move-date', '2026-09-11'); await page.click('[data-move-exercise-confirm]'); await w(600);
  const f8 = await page.evaluate(() => [...document.querySelectorAll('#history-list [data-open-sheet="siirto"]')].map(b => b.dataset.date + '/' + b.dataset.id));
  ok(f8.join(';') === '2026-09-14/ex-2;2026-09-11/ex-2', '8 suodatin säilyy ja päivä vaihtui: ' + f8.join(';'));

  console.log('=== 9 a11y');
  await page.click('[data-open-sheet="siirto"][data-date="2026-09-11"]'); await w(400);
  const axeSrc = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  await page.addScriptTag({ content: axeSrc });
  const axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
  ok(axe.filter(v => v.indexOf('color-contrast') !== 0).length === 0, '9 axe: ' + JSON.stringify(axe));
  await page.setViewportSize({ width: 360, height: 780 }); await w(300);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360), '9 360 px ei vaakavieritystä');
  await page.screenshot({ path: require('path').join(__dirname, 'history_move.png') });

  ok(errors.length === 0, 'ei sivuvirheitä: ' + errors.join('; '));
  await browser.close();
  console.log(fails ? ('FAILS: ' + fails) : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
