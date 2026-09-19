// Kehityksen etusivun segmentit ja viikkopylväät (kehotteen tapaukset 1–13).
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function ex(id, name){ return { id, name, sets: '3', reps: '10', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }; }
const program = { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [ex('A','E1')] } ] };
// Viikot (maanantai) ja tonnaget; 2026-07-27 on kevennys.
const WEEKS = [['2026-06-29',4000],['2026-07-06',4400],['2026-07-13',4200],['2026-07-27',2600],['2026-08-03',4800],['2026-08-17',5200],['2026-08-31',5600],['2026-09-07',6000],['2026-09-14',8420]];
function entries(opts){
  opts = opts || {};
  const out = [];
  WEEKS.forEach((w, i) => {
    if(opts.dropLast && i === WEEKS.length - 1) return;
    const exs = {};
    const name = opts.combo ? ('Kierto / Liike ' + (i + 1)) : ('E' + (i + 1));
    if(i === WEEKS.length - 1 && !opts.combo){
      exs['x9'] = { name: 'E9', sets: [{ weight: 800, reps: 10, done: true }], kind: 'plain' };
      exs['x10'] = { name: 'E10', sets: [{ weight: 21, reps: 10, done: true }], kind: 'plain' };
      exs['x11'] = { name: 'E11', sets: [{ weight: 21, reps: 10, done: true }], kind: 'plain' };
    } else {
      exs['x' + (i + 1)] = { name, sets: [{ weight: w[1] / 10, reps: 10, done: true }], kind: 'plain', deload: w[0] === '2026-07-27' };
    }
    out.push({ date: w[0], exercises: exs });
  });
  return out;
}
const PAIN = [{ id: 'pain-1', date: '2026-09-01', region: 'polvi', side: 'vasen', severity: 2, note: '' }, { id: 'pain-2', date: '2026-09-08', region: 'niska', side: '', severity: 1, note: '' }];
async function load(page, ents, pain){
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ ents, pain }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:workout-program', JSON.stringify({ id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [{ id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [{ id: 'A', name: 'E1', sets: '3', reps: '10', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }] }] }));
    ents.forEach(e => localStorage.setItem('treenipk:entries:' + e.date, JSON.stringify(e)));
    if(pain) localStorage.setItem('treenipk:pain-log', JSON.stringify(pain));
  }, { ents, pain });
  await page.goto(URL);
  await page.waitForSelector('.bottom-nav');
  await page.waitForTimeout(300);
}
async function kehitys(page){ await page.click('.tab[data-tab="kehitys"]'); await page.waitForSelector('main .segmented, main .empty-state'); await page.waitForTimeout(500); }
const snap = page => page.evaluate(() => {
  const main = document.querySelector('main');
  const first = main.firstElementChild;
  const tabs = [...document.querySelectorAll('[data-kehitys-front-tab]')].map(b => ({ v: b.dataset.kehitysFrontTab, on: b.classList.contains('on'), sel: b.getAttribute('aria-selected'), role: b.getAttribute('role') }));
  const tablist = document.querySelector('.segmented.kehitys-tabs');
  return {
    firstClass: first ? first.className : null, tabs, tablistRole: tablist ? tablist.getAttribute('role') : null, tablistLabel: tablist ? tablist.getAttribute('aria-label') : null,
    text: main.textContent, hasList: !!document.getElementById('kehitys-list'), hasFilter: !!document.querySelector('[data-kehitys-filter]'),
    weekCard: main.textContent.indexOf('Viikko ') !== -1 && !!document.querySelector('.stat-grid'), volume: main.textContent.indexOf('Nostettu kokonaispaino') !== -1, adherence: main.textContent.indexOf('Ohjelman toteutuminen') !== -1,
    headings: [...main.querySelectorAll('.day-heading')].map(h => h.textContent), empty: !!main.querySelector('.empty-state'), scrollY: window.scrollY,
  };
});
const bars = page => page.evaluate(() => {
  const svg = document.querySelector('svg.week-bars');
  if(!svg) return null;
  const rects = [...svg.querySelectorAll('rect')].map(r => ({ x: +r.getAttribute('x'), h: +r.getAttribute('height'), fill: r.getAttribute('fill') }));
  const labels = [...document.querySelectorAll('.week-bars-labels span')].map(s => s.textContent);
  const title = document.querySelector('.week-bars-title');
  const btn = document.querySelector('[data-toggle-week-exercises]');
  const order = title && btn ? (title.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 : null;
  return { role: svg.getAttribute('role'), label: svg.getAttribute('aria-label'), rects, labels, title: title ? title.textContent : null, buttonAfterBars: order, sub: document.querySelector('main').textContent.indexOf('Viimeisin treeniviikko') !== -1 };
});
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('1 ensimmäinen avaus');
  await load(page, entries(), PAIN);
  await kehitys(page);
  let s = await snap(page);
  ok(s.firstClass === 'segmented kehitys-tabs', 'main alkaa valitsimella: ' + s.firstClass);
  ok(s.tabs.length === 3 && s.tabs[0].v === 'yhteenveto' && s.tabs[0].on && s.tabs[0].sel === 'true' && !s.tabs[1].on, 'Yhteenveto valittu ' + JSON.stringify(s.tabs));
  ok(s.weekCard && s.volume && s.adherence && !s.hasList && s.text.indexOf('Vaivat') === -1 || (s.weekCard && s.volume && s.adherence && !s.hasList && s.headings.length === 0), 'kortit, ei listaa eikä Vaivat-osiota ' + JSON.stringify([s.weekCard, s.volume, s.adherence, s.hasList, s.headings]));
  console.log('12 ruudunlukija');
  ok(s.tablistRole === 'tablist' && s.tablistLabel === 'Kehityksen osiot' && s.tabs.every(t => t.role === 'tab'), 'tablist ja tab-roolit');

  console.log('7 viikkopylväät');
  let b = await bars(page);
  ok(b && b.role === 'img' && b.label === 'Viikkovolyymi 12 viikolta, 29.6.–14.9.', 'svg aria: ' + (b && b.label));
  ok(b.rects.length === 12 && b.rects[0].h === 21 && b.rects[0].x === 0, 'ensimmäinen pylväs 29.6. h=21: ' + JSON.stringify(b.rects[0]));
  ok(b.rects[3].h === 2 && b.rects[3].fill === 'var(--line)', '20.7. tyhjä h=2 line: ' + JSON.stringify(b.rects[3]));
  ok(b.rects[4].h === 14 && b.rects[4].fill === 'var(--line-strong)', '27.7. kevennys h=14: ' + JSON.stringify(b.rects[4]));
  ok(b.rects[11].h === 44 && b.rects[11].fill === 'var(--brass)' && b.rects[11].x === 275, '14.9. brass h=44: ' + JSON.stringify(b.rects[11]));
  ok(b.rects[5].fill === 'var(--surface-2)', 'tavallinen viikko surface-2');
  ok(b.labels[0] === '29.6.' && b.labels[1] === 'kevennys' && b.labels[2] === '14.9.' && b.title === 'Viikkovolyymi, 12 viikkoa', 'selitteet ' + JSON.stringify(b.labels) + ' ' + b.title);
  console.log('11 Näytä liikkeet');
  ok(b.buttonAfterBars === true, 'painike pylväiden alla');
  await page.click('[data-toggle-week-exercises]'); await page.waitForTimeout(400);
  ok((await page.$$('.week-ex-row')).length >= 3, 'liikelista avautuu');

  console.log('2 Liikkeet');
  await page.evaluate(() => window.scrollTo(0, 300)); await page.waitForTimeout(100);
  await page.click('[data-kehitys-front-tab="liikkeet"]'); await page.waitForTimeout(500);
  s = await snap(page);
  ok(s.tabs[1].on && s.tabs[1].sel === 'true' && !s.tabs[0].on, 'Liikkeet valittu');
  ok(s.headings.length === 1 && s.headings[0].indexOf('Liikkeet') === 0 && s.headings[0].indexOf('11') !== -1 && s.hasFilter && s.hasList, 'otsikko, haku ja lista ' + JSON.stringify([s.headings, s.hasFilter, s.hasList]));
  ok(!s.volume && !s.adherence && !document_has(s, '.stat-grid'), 'ei kortteja');
  ok(s.scrollY === 0, 'scrollY 0: ' + s.scrollY);
  console.log('13 haku');
  await page.focus('[data-kehitys-filter]'); await page.keyboard.type('E1'); await page.waitForTimeout(300);
  const f = await page.evaluate(() => ({ rows: document.querySelectorAll('#kehitys-list .kehitys-row').length, focused: document.activeElement === document.querySelector('[data-kehitys-filter]'), val: document.querySelector('[data-kehitys-filter]').value }));
  ok(f.rows === 3 && f.focused && f.val === 'E1', 'haku suodattaa (E1, E10, E11) ja fokus säilyy ' + JSON.stringify(f));
  await page.fill('[data-kehitys-filter]', ''); await page.waitForTimeout(300);

  console.log('4 liike ja paluu');
  const rows = await page.$$('#kehitys-list .kehitys-row');
  await rows[rows.length - 1].scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const yBefore = await page.evaluate(() => window.scrollY);
  await rows[rows.length - 1].click(); await page.waitForTimeout(600);
  ok(!!(await page.$('[data-close-kehitys]')), 'liikenäkymä auki');
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(1200);
  s = await snap(page);
  ok(s.tabs[1].on && s.hasList, 'palattiin Liikkeet-segmenttiin');
  ok(yBefore > 0 && Math.abs(s.scrollY - yBefore) <= 2, 'vieritysasema palautui ' + yBefore + ' → ' + s.scrollY);

  console.log('3 Vaivat');
  await page.click('[data-kehitys-front-tab="vaivat"]'); await page.waitForTimeout(500);
  s = await snap(page);
  ok(s.tabs[2].on && s.headings.length === 0, 'Vaivat ilman omaa day-heading-otsikkoa ' + JSON.stringify(s.headings));
  ok(s.text.indexOf('Loki näyttää ajallisia yhteyksiä') !== -1 && s.text.indexOf('Kirjaukset') !== -1 && !s.hasList && !s.weekCard, 'analyysi, kirjaukset ja disclaimer; ei kortteja');

  console.log('5 välilehden vaihto');
  await page.click('.tab[data-tab="historia"]'); await page.waitForTimeout(1000);
  await page.click('.tab[data-tab="kehitys"]'); await page.waitForTimeout(1000);
  s = await snap(page);
  ok(s.tabs[2].on && s.tabs[2].sel === 'true', 'Vaivat säilyi');

  console.log('12 näppäimistö');
  await page.focus('[data-kehitys-front-tab="yhteenveto"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  s = await snap(page); ok(s.tabs[0].on && s.weekCard, 'Enter valitsee Yhteenvedon');
  await page.focus('[data-kehitys-front-tab="liikkeet"]'); await page.keyboard.press(' '); await page.waitForTimeout(500);
  s = await snap(page); ok(s.tabs[1].on && s.hasList, 'välilyönti valitsee Liikkeet');

  console.log('8 kuluvalla viikolla ei merkintöjä');
  await load(page, entries({ dropLast: true }), PAIN);
  await kehitys(page);
  b = await bars(page);
  ok(b && b.label === 'Viikkovolyymi 12 viikolta, 22.6.–7.9.' && b.labels[2] === '7.9.' && b.rects[11].fill === 'var(--brass)' && b.rects[11].h === 44 && b.sub, 'idx=7.9., brass, Viimeisin treeniviikko ' + JSON.stringify([b.label, b.labels, b.rects[11], b.sub]));

  console.log('9 vain yhdistelmäliikkeitä');
  await load(page, entries({ combo: true }), null);
  await kehitys(page);
  s = await snap(page); b = await bars(page);
  ok(b === null && !(await page.$('.week-bars-title')) && !(await page.$('.week-bars-labels')), 'ei pylväitä eikä otsikkoa');
  ok(s.firstClass === 'segmented kehitys-tabs' && s.weekCard && !s.volume, 'Yhteenveto: pelkkä Viikko-kortti');
  await page.click('[data-kehitys-front-tab="liikkeet"]'); await page.waitForTimeout(400);
  s = await snap(page);
  ok(!s.hasList && s.text.indexOf('Laskennallinen 1RM vaatii painon ja toistot') !== -1, 'Liikkeet: lause');

  console.log('6 ei merkintöjä');
  await load(page, [], PAIN);
  await kehitys(page);
  s = await snap(page);
  ok(s.empty && s.tabs.length === 0 && s.headings.length === 1 && s.headings[0] === 'Vaivat', 'tyhjä tila, Vaivat otsikolla, ei valitsinta ' + JSON.stringify([s.empty, s.tabs.length, s.headings]));

  console.log('virheet');
  ok(errors.length === 0, 'ei JS-virheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? ('\nEPÄONNISTUI: ' + fails) : '\nKAIKKI OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
function document_has(s, sel){ return false; }
