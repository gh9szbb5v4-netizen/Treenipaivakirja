// Historia-kehotteet 2–3: sarjarivit, liikekohtaiset reitit, liikesuodatin.
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const nb = s => s == null ? s : String(s).replace(/[  ]/g, ' ');
function pex(id, name, extra){ return Object.assign({ id, name, sets: '4', reps: '6', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1','2'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [pex('ex-1','Penkkipunnerrus'), pex('ex-2','Kulmasoutu', { kind: 'cluster', autoCalc: false }), pex('ex-3','Cardiolaite / Punnerrus, 12 min', { unit: 'min' })] },
  { id: 'd2', label: 'Päivä 1', name: 'Viikko 2 · Päivä 1', week: '2', exercises: [pex('ex-4','Alaviistopenkkipunnerrus tangolla'), pex('ex-5','Kulmasoutu tangolla')] } ] };
const st = (w, r, extra) => Object.assign({ weight: w, reps: r, done: true }, extra || {});
const E2 = [
  { date: '2026-09-14', exercises: {
    'ex-1': { name: 'Penkkipunnerrus', warmups: [{ weight: 40, reps: 8, rpe: 6 }, { weight: 60, reps: 5, rpe: 7 }], sets: [st(82.5,6,{rpe:8}), st(82.5,6,{rpe:8}), st(82.5,6,{rpe:9}), st(82.5,5,{rpe:10})], kind: 'plain' },
    'ex-2': { name: 'Kulmasoutu', kind: 'cluster', sets: [st(70,6,{subsets:4,rpe:8}), st(70,6,{subsets:3,rpe:null,notes:'kahva vaihdettu'})] },
    'ex-3': { name: 'Cardiolaite / Punnerrus, 12 min', sets: [st('',12)] } } },
  { date: '2026-09-16', exercises: { 'ex-2': { name: 'Kulmasoutu', kind: 'cluster', sets: [st(72.5,6,{subsets:4})] } } },
  { date: '2026-09-10', exercises: { 'old-9': { name: 'Soutu', sets: [st('',10)] } } },
];
async function seed(page, prog, ents, extra){
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ prog, ents, extra }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(prog));
    ents.forEach(e => localStorage.setItem('treenipk:entries:' + e.date, JSON.stringify(e)));
    Object.keys(extra || {}).forEach(k => localStorage.setItem('treenipk:' + k, extra[k]));
  }, { prog, ents, extra });
  await page.goto(URL); await page.waitForSelector('.bottom-nav'); await page.waitForTimeout(300);
}
async function ensureOpen(page, date){
  const open = await page.evaluate((d) => !!document.querySelector('.history-date-head[data-date="' + d + '"].open'), date);
  if(!open){ await page.click('.history-date-head[data-date="' + date + '"]'); await page.waitForTimeout(400); }
}
async function historia(page){ await page.click('.tab[data-tab="historia"]'); await page.waitForSelector('#history-list'); await page.waitForTimeout(400); }
const hs = page => page.evaluate(() => { const s = history.state; return s ? [s.view, s.detail, s.depth].join('|') : null; });
const exInfo = (page, name) => page.evaluate((name) => {
  const ex = [...document.querySelectorAll('.history-ex')].find(e => e.querySelector('.history-ex-name').textContent.indexOf(name) === 0);
  if(!ex) return null;
  const rows = [...ex.querySelectorAll('.history-set')].map(r => ({ warm: r.classList.contains('warm'), num: r.querySelector('.history-set-num').textContent, val: r.querySelector('.history-set-val').textContent, rpe: r.querySelector('.history-rpe').textContent, rpeCls: r.querySelector('.history-rpe').className, rpeHidden: r.querySelector('.history-rpe').getAttribute('aria-hidden'), aria: r.getAttribute('aria-label') }));
  return { kind: (ex.querySelector('.history-ex-kind') || {}).textContent || null, rows, notes: [...ex.querySelectorAll('.history-set-note')].map(n => n.textContent),
    actions: [...ex.querySelectorAll('.history-actions button')].filter(b => !b.hasAttribute('data-open-sheet')).map(b => b.textContent + '|' + (b.hasAttribute('data-history-fix') ? 'fix' : 'keh')) };
}, name);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('=== Kehote 2');
  await seed(page, PROGRAM, E2); await historia(page);
  await page.click('.history-date-head[data-date="2026-09-14"]'); await page.waitForTimeout(500);
  let p = await exInfo(page, 'Penkkipunnerrus');
  ok(p.rows.length === 6 && p.rows[0].warm && p.rows[0].num === 'L1' && nb(p.rows[0].val) === '40 kg × 8' && p.rows[0].rpe === 'RPE 6' && p.rows[1].num === 'L2' && nb(p.rows[1].val) === '60 kg × 5' && p.rows[1].rpe === 'RPE 7', '1 lämmittelyt: ' + JSON.stringify(p.rows.slice(0,2)));
  ok(!p.rows[2].warm && p.rows[2].num === '1' && nb(p.rows[2].val) === '82,5 kg × 6' && p.rows[5].rpe === 'RPE 10' && p.rows[5].rpeCls === 'history-rpe max', '1 työsarjat, rivi 4 RPE 10 max: ' + JSON.stringify([p.rows[2], p.rows[5]]));
  ok(p.rows[2].aria === 'Sarja 1: 82,5 kg × 6, RPE 8' && p.rows[0].aria === 'Lämmittely 1: 40 kg × 8, RPE 6', '12 aria-label: ' + JSON.stringify([p.rows[2].aria, p.rows[0].aria]));
  let k = await exInfo(page, 'Kulmasoutu');
  ok(k.kind === 'cluster' && nb(k.rows[0].val) === '70 kg × 6 × 4 osasarjaa' && k.rows[0].rpe === 'RPE 8' && nb(k.rows[1].val) === '70 kg × 6 × 3 osasarjaa' && k.rows[1].rpeCls === 'history-rpe none' && k.rows[1].rpe === '–' && k.rows[1].rpeHidden === 'true', '2 cluster-rivit: ' + JSON.stringify(k.rows));
  ok(k.notes.length === 1 && k.notes[0] === 'Huomio: kahva vaihdettu' && k.rows[1].aria === 'Sarja 2: 70 kg × 6 × 3 osasarjaa', '2/11 huomiorivi ja aria ilman RPE:tä: ' + JSON.stringify([k.notes, k.rows[1].aria]));
  const c = await exInfo(page, 'Cardiolaite');
  ok(p.actions.join(';') === 'Kehityksessä ›|keh;Korjaa|fix' && k.actions.join(';') === 'Kehityksessä ›|keh' && c.actions.join(';') === 'Korjaa|fix', '3 toiminnot (combo: ei Kehityksessä; Korjaa, koska canFix on tosi): ' + JSON.stringify([p.actions, k.actions, c.actions]));
  ok(!!(await page.$('.history-delete [data-delete-history]')) && !!(await page.$('.history-date-head.open')), '13 poistolohko ja avattu otsikkorivi');
  // 10 vanha merkintä ilman warmups
  await page.click('.history-date-head[data-date="2026-09-14"]'); await page.waitForTimeout(300);
  await page.click('.history-date-head[data-date="2026-09-16"]'); await page.waitForTimeout(400);
  k = await exInfo(page, 'Kulmasoutu');
  ok(k.rows.length === 1 && !k.rows[0].warm && k.actions.join(';') === 'Kehityksessä ›|keh;Korjaa|fix', '10 ilman lämmittelyjä; 16.9. viimeisin → Korjaa: ' + JSON.stringify(k.actions));
  await page.click('.history-date-head[data-date="2026-09-16"]'); await page.waitForTimeout(300);
  // 5 Kehitys laskettu, liikettä ei ole (Soutu vain ilman painoa)
  await page.click('.tab[data-tab="kehitys"]'); await page.waitForSelector('main .segmented'); await page.waitForTimeout(400);
  await historia(page);
  await page.click('.history-date-head[data-date="2026-09-10"]'); await page.waitForTimeout(400);
  await page.click('[data-history-kehitys="soutu"]'); await page.waitForTimeout(500);
  const t5 = await page.evaluate(() => ({ toast: (document.getElementById('toast') || document.querySelector('[role="status"]') || {}).textContent || '', tab: document.querySelector('.tab.active').textContent }));
  ok(t5.toast.indexOf('Liikkeelle ei ole vielä kehitystä') !== -1 && t5.tab === 'Historia', '5 ilmoitus, ei siirtymää: ' + JSON.stringify(t5));
  // 4 Kehityksessä Penkkipunnerrus
  await ensureOpen(page, '2026-09-14');
  await page.click('[data-history-kehitys="penkkipunnerrus"]'); await page.waitForTimeout(800);
  const t4 = await page.evaluate(() => ({ head: !!document.querySelector('.screen-head [data-close-kehitys]'), title: (document.querySelector('.screen-title') || {}).textContent, tab: (document.querySelector('[data-kehitys-tab].on') || {}).dataset ? document.querySelector('[data-kehitys-tab].on').dataset.kehitysTab : null }));
  ok(t4.head && t4.title === 'Penkkipunnerrus' && t4.tab === '1rm' && (await hs(page)) === 'kehitys|penkkipunnerrus|2', '4 liikenäkymä: ' + JSON.stringify([t4, await hs(page)]));
  await page.goBack(); await page.waitForTimeout(700);
  ok((await hs(page)) === 'historia||1' && !!(await page.$('#history-list')), '4 taaksepäin-ele palaa Historiaan: ' + (await hs(page)));
  await ensureOpen(page, '2026-09-14');
  await page.click('[data-history-kehitys="penkkipunnerrus"]'); await page.waitForTimeout(800);
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(1200);
  ok((await hs(page)) === 'kehitys||1' && !!(await page.$('[data-kehitys-front-tab]')), '4 ‹ Kehitys vie listaan: ' + (await hs(page)));
  // 6 Kehitys ei laskettu → suora navigointi
  await seed(page, PROGRAM, E2); await historia(page);
  await page.click('.history-date-head[data-date="2026-09-14"]'); await page.waitForTimeout(400);
  await page.click('[data-history-kehitys="penkkipunnerrus"]'); await page.waitForTimeout(1200);
  ok(!!(await page.$('.screen-head [data-close-kehitys]')) && (await hs(page)) === 'kehitys|penkkipunnerrus|2', '6 laskematta: navigoidaan ja lasketaan');
  await seed(page, PROGRAM, E2); await historia(page);
  await page.click('.history-date-head[data-date="2026-09-10"]'); await page.waitForTimeout(400);
  await page.click('[data-history-kehitys="soutu"]'); await page.waitForTimeout(1500);
  ok((await hs(page)) === 'kehitys||1' && !!(await page.$('[data-kehitys-front-tab]')), '6 laskematta, liike puuttuu → lista: ' + (await hs(page)));
  // 7–8 Korjaa
  await seed(page, PROGRAM, E2); await historia(page);
  await page.click('.history-date-head[data-date="2026-09-14"]'); await page.waitForTimeout(400);
  await page.click('[data-history-fix][data-id="ex-1"]'); await page.waitForTimeout(1500);
  const t7 = await page.evaluate(() => ({ title: (document.getElementById('kirjaus-title') || {}).textContent, rows: [...document.querySelectorAll('.ledger [data-field="weight"]')].map(i => i.value), reps: [...document.querySelectorAll('.ledger [data-field="reps"]')].map(i => i.value), done: [...document.querySelectorAll('.ledger [data-toggle-done]')].map(b => b.getAttribute('aria-pressed')), saveEnabled: !document.querySelector('[data-save-ex]').disabled, badge: !!document.querySelector('.screen-title .saved-badge') }));
  ok(t7.title && t7.title.indexOf('Penkkipunnerrus') === 0 && (await hs(page)) === 'ohjelma|ex-1|2' && t7.badge, '7 kirjausruutu ex-1 syvyydellä 2, tallennettu-merkki: ' + JSON.stringify([t7.title, await hs(page)]));
  ok(t7.rows.slice(2).join(',') === '82,5,82,5,82,5,82,5' && t7.reps.slice(2).join(',') === '6,6,6,5' && t7.done.every(d => d === 'true') && t7.saveEnabled, '7 arvot ja valmis-merkinnät: ' + JSON.stringify([t7.rows, t7.reps, t7.done]));
  await page.evaluate(() => { const el = document.querySelector('.ledger [data-set-field][data-idx="5"][data-field="reps"]'); el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('[data-save-ex]'); await page.waitForTimeout(900);
  const t8 = await page.evaluate(() => ({ toast: (document.getElementById('toast') || document.querySelector('[role="status"]') || {}).textContent || '' }));
  await historia(page);
  await page.evaluate(() => {});
  const b8 = await page.evaluate(() => [...document.querySelectorAll('.history-date-head[data-date="2026-09-14"] .history-badge')].map(b => b.textContent));
  ok(t8.toast.indexOf('korjattu') !== -1 && b8.indexOf('korjattu') !== -1, '8 korjaus samalle päivälle, merkki korjattu: ' + JSON.stringify([t8.toast, b8]));
  await ensureOpen(page, '2026-09-14');
  p = await exInfo(page, 'Penkkipunnerrus');
  ok(nb(p.rows[5].val) === '82,5 kg × 6', '8 sarja 4 nyt 6 toistoa');
  // 9 liike poistettu ohjelmasta ennen napautusta
  await page.evaluate(() => { const prog = JSON.parse(localStorage.getItem('treenipk:workout-program')); prog.days[0].exercises = prog.days[0].exercises.filter(e => e.id !== 'ex-1'); localStorage.setItem('treenipk:workout-program', JSON.stringify(prog)); });
  // ohjelma on muistissa: poisto tehdään sovelluksen tilaan uudelleenlatauksella, mutta Korjaa-painike on jo piirretty → simuloidaan: piirretty painike + poistettu liike
  await page.reload(); await page.waitForSelector('.bottom-nav'); await historia(page);
  await ensureOpen(page, '2026-09-14');
  ok(!(await page.$('[data-history-fix][data-id="ex-1"]')), '9 poistettu liike: ei Korjaa-painiketta (canFix epätosi)');
  // 14 regressio: Ohjelma ilman lippua ei avaa liikettä
  await page.click('.tab[data-tab="ohjelma"]'); await page.waitForTimeout(900);
  ok(!(await page.$('#kirjaus-title')) && !!(await page.$('.next-card')), '14 Ohjelma ilman lippua: lista');

  console.log('=== Kehote 3');
  // 12 päivää: Alaviisto 9 (ex-4), Alaviisto Scott 2, Kulmasoutu tangolla 6 (ex-5); yksi päivä molemmilla
  const E3 = [];
  const days = ['2026-08-03','2026-08-05','2026-08-07','2026-08-10','2026-08-12','2026-08-14','2026-08-17','2026-08-19','2026-08-21','2026-08-24','2026-08-26','2026-08-28'];
  days.forEach((d, i) => {
    const exs = {};
    if(i < 9) exs['ex-4'] = { name: i < 7 ? 'Alaviistopenkkipunnerrus tangolla' : 'Alaviistopenkkipunnerrus tangolla, Scott-tanko', sets: [st(80, 6)], kind: 'plain' };
    if(i >= 6) exs['ex-5'] = { name: 'Kulmasoutu tangolla', sets: [st(60, 8)], kind: 'plain' };
    E3.push({ date: d, exercises: exs });
  });
  await seed(page, PROGRAM, E3); await historia(page);
  const f1 = await page.evaluate(() => ({ field: !!document.querySelector('#history-filter[data-history-filter]'), type: (document.getElementById('history-filter')||{}).type, label: (document.getElementById('history-filter')||{}).getAttribute('aria-label'), cards: document.querySelectorAll('.history-date').length, summary: !!document.querySelector('.history-filter-summary'), heads: document.querySelectorAll('h3.history-month').length }));
  ok(f1.field && f1.type === 'search' && f1.label === 'Hae liikettä historiasta' && f1.cards === 12 && !f1.summary && f1.heads === 1, '1/12 kenttä ja tavallinen lista: ' + JSON.stringify(f1));
  // 3 kirjoitetaan penkki
  await page.evaluate(() => document.querySelector('main').setAttribute('data-marker', 'm'));
  await page.focus('#history-filter'); await page.keyboard.type('penkki'); await page.waitForTimeout(300);
  const f3 = await page.evaluate(() => ({ marker: document.querySelector('main').getAttribute('data-marker'), focused: document.activeElement === document.getElementById('history-filter'), cursor: document.getElementById('history-filter').selectionStart,
    count: (document.querySelector('.history-filter-summary span') || {}).textContent, cards: document.querySelectorAll('.history-date').length, exs: document.querySelectorAll('.history-ex').length,
    names: [...new Set([...document.querySelectorAll('.history-ex-name')].map(n => n.textContent))], chevrons: document.querySelectorAll('.history-date .chevron').length, dels: document.querySelectorAll('[data-delete-history]').length,
    btnHeads: document.querySelectorAll('.history-date-head[data-history-date]').length, expanded: document.querySelectorAll('.history-date-head[aria-expanded]').length, keh: (document.querySelector('.history-filter-summary [data-history-kehitys]') || {}).dataset ? document.querySelector('.history-filter-summary [data-history-kehitys]').dataset.historyKehitys : null, heads: document.querySelectorAll('h3.history-month').length, subs: document.querySelectorAll('.history-date-sub').length }));
  ok(f3.marker === 'm' && f3.focused && f3.cursor === 6, '3 ei render(), fokus ja kursori: ' + JSON.stringify([f3.marker, f3.focused, f3.cursor]));
  ok(f3.count === '9 päivää' && f3.cards === 9 && f3.exs === 9 && f3.names.length === 2 && f3.names.every(n => n.indexOf('Alaviisto') === 0) && f3.chevrons === 0 && f3.dels === 0 && f3.btnHeads === 0 && f3.expanded === 0 && f3.subs === 9, '3/10/12 suodatettu lista: ' + JSON.stringify(f3));
  ok(f3.keh === 'alaviistopenkkipunnerrus tangolla', '5 yksi normi → Kehityksessä: ' + f3.keh);
  // 4 iso alkukirjain
  await page.fill('#history-filter', 'Penkki'); await page.waitForTimeout(300);
  ok((await page.evaluate(() => document.querySelectorAll('.history-date').length)) === 9, '4 kirjainkoko ei vaikuta');
  // 6 "u"
  await page.fill('#history-filter', 'u'); await page.waitForTimeout(300);
  const f6 = await page.evaluate(() => ({ count: document.querySelector('.history-filter-summary span').textContent, keh: !!document.querySelector('.history-filter-summary [data-history-kehitys]'), both: [...document.querySelectorAll('.history-date')].filter(c => c.querySelectorAll('.history-ex').length === 2).length, cards: document.querySelectorAll('.history-date').length }));
  ok(f6.count === '12 päivää' && !f6.keh && f6.both === 3 && f6.cards === 12, '6 kaksi normia: ' + JSON.stringify(f6));
  // 7 xyz
  await page.fill('#history-filter', 'xyz'); await page.waitForTimeout(300);
  const f7 = await page.evaluate(() => ({ empty: (document.querySelector('.history-empty') || {}).textContent, count: document.querySelector('.history-filter-summary span').textContent, focused: document.activeElement === document.getElementById('history-filter') }));
  ok(f7.empty === 'Ei päiviä, joissa liike ”xyz” olisi kirjattu.' && f7.count === '0 päivää' && f7.focused, '7 tyhjä: ' + JSON.stringify(f7));
  // 8 Escape tyhjentää; avattu päivä yhä auki
  await page.fill('#history-filter', ''); await page.waitForTimeout(200);
  await page.click('.history-date-head[data-date="2026-08-28"]'); await page.waitForTimeout(400);
  await page.focus('#history-filter'); await page.keyboard.type('penkki'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const f8 = await page.evaluate(() => ({ val: document.getElementById('history-filter').value, cards: document.querySelectorAll('.history-date').length, open: !!document.querySelector('.history-date-head[data-date="2026-08-28"].open'), summary: !!document.querySelector('.history-filter-summary') }));
  ok(f8.val === '' && f8.cards === 12 && f8.open && !f8.summary, '8 Escape: ' + JSON.stringify(f8));
  // 5 Kehityksessä-linkki avaa liikenäkymän
  await page.fill('#history-filter', 'penkki'); await page.waitForTimeout(300);
  await page.click('.history-filter-summary [data-history-kehitys]'); await page.waitForTimeout(1500);
  ok(!!(await page.$('.screen-head [data-close-kehitys]')) && (await page.evaluate(() => document.querySelector('.screen-title').textContent)).indexOf('Alaviistopenkkipunnerrus tangolla') === 0, '5 Kehityksessä avaa liikenäkymän');
  // 9/11 tila säilyy ja fokus palautuu
  await page.click('.tab[data-tab="historia"]'); await page.waitForTimeout(1200);
  const f9 = await page.evaluate(() => ({ val: document.getElementById('history-filter').value, cards: document.querySelectorAll('.history-date').length, summary: !!document.querySelector('.history-filter-summary') }));
  ok(f9.val === 'penkki' && f9.cards === 9 && f9.summary, '9 tila säilyy välilehdeltä palattaessa: ' + JSON.stringify(f9));
  await page.focus('#history-filter');
  await page.click('.tab[data-tab="kehitys"]'); await page.waitForTimeout(800);
  await page.click('.tab[data-tab="historia"]'); await page.waitForTimeout(1200);
  const f11 = await page.evaluate(() => ({ val: document.getElementById('history-filter').value, id: document.getElementById('history-filter').id }));
  ok(f11.val === 'penkki' && f11.id === 'history-filter', '11 kenttä piirtyy arvolla, id restoreFocus-tunnistukseen');
  // 2 neljä päivää: ei kenttää
  await seed(page, PROGRAM, E3.slice(0, 4), { 'history-filter-x': '1' }); await historia(page);
  ok(!(await page.$('#history-filter')) && (await page.evaluate(() => document.querySelectorAll('.history-date').length)) === 4, '2 neljä päivää: ei hakukenttää');
  // 13 Kehityksen suodatin erillinen
  await seed(page, PROGRAM, E3); await historia(page);
  await page.fill('#history-filter', 'penkki'); await page.waitForTimeout(200);
  await page.click('.tab[data-tab="kehitys"]'); await page.waitForSelector('main .segmented'); await page.waitForTimeout(400);
  await page.click('[data-kehitys-front-tab="liikkeet"]'); await page.waitForTimeout(300);
  const kf = await page.evaluate(() => ({ field: !!document.querySelector('[data-kehitys-filter]'), val: (document.querySelector('[data-kehitys-filter]') || {}).value }));
  ok(kf.field === false || kf.val === '', '13 Kehityksen suodatin erillinen (' + JSON.stringify(kf) + ')');

  console.log('virheet');
  ok(errors.length === 0, 'ei JS-virheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? ('\nEPÄONNISTUI: ' + fails) : '\nKAIKKI OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
