// Korvaavan liikkeen haku liikelistasta (0.5.2): Vaihda avaa saman haettavan
// pohjalevyn kuin rakentaja, ehdotusryhmät (vastaavat liikkeet ja sama
// lihasryhmä), valinta ja paneelin tarkenne, sulkeminen ilman valintaa,
// uusi liike, teholiike, kirjaston ulkopuolinen korvattava, paluuele, Enter,
// funktiotason tarkistukset, 360 px, leveä asettelu, rakentaja ennallaan ja
// axe. Kehotteen tapaukset 1–17; tapaus 18 (koko testisarja) ajetaan
// run.sh-skriptillä.
// Sisäiset funktiot ovat sovelluksen sulkeuman sisällä, joten sivulle
// tarjoillaan reitityksessä index.html, jonka loppuun on lisätty
// window.__t-viittaukset; tiedostoon itseensä ei kosketa.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://127.0.0.1:8765/';
const URL = BASE + 'index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));

const EXPOSE = ['renderExercisePickList', 'exercisePickEntries', 'liikeById', 'swapTier', 'swapPickDetail', 'findExerciseById', 'state',
  'exerciseOptionsByGroup', 'renderVariantPicker', 'swapProgramExercise', 'variaatioOptionsFor', 'lisavariaatioOptionsFor', 'variantSelectOptions', 'VARIANT_ADD_NEW', 'VARIANT_PLAIN'];
function instrumentedHtml(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const marker = '})();\n</script>';
  const i = html.lastIndexOf(marker);
  if(i === -1) throw new Error('index.html: sovelluksen sulkeuman loppua ei löytynyt');
  const hook = 'window.__t = {' + EXPOSE.map(n => JSON.stringify(n) + ': (typeof ' + n + ' !== "undefined" ? ' + n + ' : null)').join(', ') + '};\n';
  return html.slice(0, i) + hook + html.slice(i);
}
async function newPage(browser, viewport){
  const page = await browser.newPage({ viewport: viewport || { width: 390, height: 900 } });
  page.on('pageerror', e => { fails++; console.log('  FAIL pageerror: ' + e.message); });
  const body = instrumentedHtml();
  await page.route('**/index.html', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00'));
  return page;
}

// ---------- tila ----------
const YLA = 'Ylätalja leveällä otteella, Lat-tanko', YLA_ID = 'ylatalja-levealla-otteella-lat-tanko';
const PENKKI = 'Penkkipunnerrus tangolla', PENKKI_ID = 'penkkipunnerrus-tangolla';
const KULMA = 'Kulmasoutu tangolla, Suora tanko', KULMA_ID = 'kulmasoutu-tangolla-suora-tanko';
const OMA = 'Oma kiertoliike';
function ex(id, name, liikeId, sets, reps, extra){
  const o = { id, name, sets: String(sets), reps: String(reps), unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true };
  if(liikeId) o.liikeId = liikeId;
  return Object.assign(o, extra || {});
}
function program(){
  return { id: 'prog-v', name: 'Vaihto', weeks: ['1', '2', '3'], weekLabels: {}, days: [1, 2, 3].map(n => ({
    id: 'day-v' + n, label: 'Päivä 1', name: 'Viikko ' + n + ' · Päivä 1', week: String(n), exercises: [
      ex('y' + n, YLA, YLA_ID, 3, 10),
      ex('p' + n, PENKKI, PENKKI_ID, 4, 6, { intensity: { isMax: false, percents: [72.5] }, notes: '72,5 %' }),
      ex('k' + n, KULMA, KULMA_ID, 3, 8),
      ex('o' + n, OMA, null, 3, 12) ] })) };
}
const S = (wt, r) => ({ weight: String(wt), reps: String(r), notes: '', done: true, kind: 'work' });
const entry = (name, liikeId, sets, reps, wt, t) => ({ name, liikeId, kind: 'plain', loggedAt: '2026-10-13T' + t + ':00:00.000Z', deload: false, warmups: [],
  plan: { sets, reps, suggestedWeight: null }, sets: Array.from({ length: sets }, () => S(wt, reps)) });
const LS = (wt, r, n, date) => ({ sets: Array.from({ length: n }, () => ({ weight: String(wt), reps: String(r), done: true, rpe: null })), date, prior: [], warmups: [] });
function store(){
  return {
    'treenipk:koekaytto-hyvaksytty': '1', 'treenipk:first-log-hint-dismissed': '1', 'treenipk:rest-timer-enabled': '0',
    'treenipk:liike-siirto': JSON.stringify({ versio: '2026-10-19', taulukko: 'ohitetaan', tila: 'palautettu', aika: '2026-10-19T08:00:00.000Z', raportti: null, varmuuskopioLuotu: null }),
    'treenipk:workout-program': JSON.stringify(program()),
    'treenipk:entries:2026-10-13': JSON.stringify({ date: '2026-10-13', exercises: { y1: entry(YLA, YLA_ID, 3, 10, 60, '10'), p1: entry(PENKKI, PENKKI_ID, 4, 6, 72.5, '11') } }),
    'treenipk:last-set-log': JSON.stringify({ [YLA_ID]: LS(60, 10, 3, '2026-10-13'), [PENKKI_ID]: LS(72.5, 6, 4, '2026-10-13'), 'leuanveto': LS(0, 8, 3, '2026-10-06'), 'oma soutulaite': LS(40, 12, 3, '2026-10-06') }),
    'treenipk:manual-1rm': JSON.stringify({ [PENKKI_ID]: { weight: 100, date: '2026-10-01' } }),
    'treenipk:user-exercises': JSON.stringify([{ liike: 'Oma soutu', variaatio: null, lisavariaatio: null, lihasryhma: 'Selkä' }])
  };
}
async function seed(page){
  await page.goto(BASE + 'manifest.json');
  await page.evaluate(st => { localStorage.clear(); Object.keys(st).forEach(k => localStorage.setItem(k, st[k])); }, store());
  await page.goto(URL);
  await page.waitForSelector('.bottom-nav', { state: 'attached' }); await w(600);
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:workout-program')));
const userEx = page => page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:user-exercises') || '[]'));
const toast = page => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const swapState = page => page.evaluate(() => ({ swap: window.__t.state.swapExercise, picker: window.__t.state.variantPicker, open: window.__t.state.openExercise, sheet: window.__t.state.sheet }));
async function gotoWeek(page, week){
  for(let i = 0; i < 6; i++){
    const cur = await page.evaluate(() => { const c = document.querySelector('.week-head-count'); return c ? c.textContent.trim().split(/\s*\/\s*/)[0].replace(/\D/g, '') : null; });
    if(cur === week) return;
    await page.click('[data-week-nav="' + (Number(cur) < Number(week) ? 'next' : 'prev') + '"]'); await w(350);
  }
}
// Kirjausruutu avataan kuten test_kirjaus.js:ssä: päivän kortti, sitten liike.
async function openEx(page, id){
  if(await page.$('[data-close-ex]')){ await page.click('[data-close-ex]'); await w(500); }
  const week = id.replace(/\D/g, '');
  await gotoWeek(page, week);
  if(!(await page.$('[data-toggle-ex][data-id="' + id + '"]'))){ await page.click('[data-toggle-day-summary][data-key="day-v' + week + '"]'); await w(450); }
  await page.click('[data-toggle-ex][data-id="' + id + '"]'); await page.waitForSelector('.ledger'); await w(500);
}
async function swapOpen(page, id){ await page.click('[data-swap-open][data-id="' + id + '"]'); await w(500); }
async function pick(page, name){ await page.click('#liike-lista [data-pick-exercise="' + name + '"]:not([data-pick-free])'); await w(500); }
async function search(page, q){ await page.fill('#liike-haku', q); await w(250); }
// Listan ryhmät ja rivit DOM-järjestyksessä sekä vapaa rivi (teksti ja ryhmä).
const PARSE_GROUPS = `(function(list){
  if(!list) return null;
  const out = { groups: [], free: null, freeGroup: null };
  let cur = null;
  [...list.children].forEach(el => {
    if(el.classList.contains('pick-group')){ cur = { title: el.textContent.trim(), items: [] }; out.groups.push(cur); }
    else if(el.matches('[data-pick-exercise]')){
      if(el.hasAttribute('data-pick-free')){ out.free = el.textContent.trim(); out.freeGroup = cur ? cur.title : null; }
      else if(cur) cur.items.push(el.getAttribute('data-pick-exercise'));
      else out.groups.push({ title: null, items: [el.getAttribute('data-pick-exercise')] });
    }
  });
  return out;
})`;
const groups = page => page.evaluate('(' + PARSE_GROUPS + ')(document.getElementById("liike-lista"))');
const groupsOf = (page, html) => page.evaluate(([parse, h]) => { const d = document.createElement('div'); d.innerHTML = h; return eval(parse)(d); }, [PARSE_GROUPS, html]);
const sheet = page => page.evaluate(() => {
  const s = document.querySelector('.sheet');
  const a = document.activeElement;
  return { open: !!s, title: s ? s.getAttribute('aria-label') : null,
    current: (document.querySelector('.sheet .pick-current') || {}).textContent || null,
    editCurrent: !!document.querySelector('[data-pick-edit-current]'),
    query: (document.getElementById('liike-haku') || {}).value,
    focusClose: !!(a && s && a.matches('.sheet [data-close-sheet]')),
    focusHaku: !!(a && a.id === 'liike-haku') };
});
const panel = page => page.evaluate(() => {
  const confirm = document.querySelector('[data-swap-confirm]');
  const pickBtn = document.querySelector('[data-swap-pick]');
  const lab = [...document.querySelectorAll('label')].find(x => x.querySelector('#swap-all-weeks'));
  const a = document.activeElement;
  return { panel: !!confirm, sheet: !!document.querySelector('.sheet'),
    pickText: pickBtn ? pickBtn.querySelector('.pick-field-text').textContent.trim() : null,
    pickEmpty: pickBtn ? pickBtn.classList.contains('empty') : null,
    pickAria: pickBtn ? pickBtn.getAttribute('aria-label') : null,
    detail: (document.querySelector('[data-swap-detail]') || {}).textContent || null,
    label: lab ? lab.textContent.trim() : null, checked: lab ? lab.querySelector('input').checked : null,
    confirmDisabled: confirm ? confirm.disabled : null,
    old: !!document.querySelector('[data-variant-liike], [data-variant-variaatio], [data-variant-lisavariaatio], #swap-name-input'),
    focusConfirm: !!(a && confirm && a === confirm),
    focusOpen: a ? (a.hasAttribute('data-swap-open') ? a.getAttribute('data-id') : null) : null,
    newLiike: (document.querySelector('[data-variant-new-liike]') || {}).value,
    newGroup: (document.querySelector('[data-variant-new-lihasryhma]') || {}).value,
    title: (document.getElementById('kirjaus-title') || {}).textContent || null,
    head: (document.querySelector('.ledger-head') || {}).textContent || null };
});
const names = p => p.days.map(d => d.exercises.map(e => e.name).join(', ')).join(' | ');

(async () => {
  const browser = await chromium.launch();
  const page = await newPage(browser);

  console.log('=== 1 avaus ja ehdotukset');
  await seed(page);
  await openEx(page, 'y2');
  await swapOpen(page, 'y2');
  let sh = await sheet(page);
  ok(sh.open && sh.title === 'Vaihda liike', '1 otsikko Vaihda liike: ' + JSON.stringify(sh));
  ok(sh.current === 'Korvattava: ' + YLA && !sh.editCurrent, '1 korvattava rivillä ilman Muokkaa nimeä -painiketta: ' + sh.current);
  ok(sh.query === '' && sh.focusClose, '1 haku tyhjä ja fokus sulkupainikkeessa');
  let g = await groups(page);
  const titles = g.groups.map(x => x.title + ' (' + x.items.length + ')');
  ok(titles[0] === 'Vastaavat liikkeet (25)' && titles[1] === 'Samaa lihasryhmää · Selkä (29)' && titles[2] === 'Ohjelmassa ja historiassa (3)' && titles[3] === 'Alaselkä (4)', '1 ryhmät ja määrät: ' + titles.slice(0, 5).join(' · '));
  const sim = g.groups[0].items;
  ok(sim[0] === 'Alaspainallus taljassa suorin käsin, Köysi' && sim[12] === 'Leuanveto' && sim[sim.length - 1] === 'Ylätalja, V-kahva', '1 vastaavien ensimmäinen, 13. ja viimeinen: ' + [sim[0], sim[12], sim[sim.length - 1]].join(' / '));
  ok(g.groups[1].items.indexOf(KULMA) !== -1 && g.groups[1].items.indexOf('Oma soutu') !== -1, '1 saman lihasryhmän ryhmässä kulmasoutu ja oma liike');
  ok(JSON.stringify(g.groups[2].items) === JSON.stringify([OMA, 'Oma soutulaite', PENKKI]), '1 ohjelmassa ja historiassa: ' + g.groups[2].items.join(', '));
  ok(!g.groups.some(x => x.title === 'Selkä') && !g.groups.some(x => x.items.indexOf(YLA) !== -1) && !g.free, '1 ei ryhmää Selkä, korvattava ei listalla, ei vapaata riviä');
  let pn = await panel(page);
  ok(pn.panel && pn.pickEmpty === true && pn.pickText === 'Valitse korvaava liike' && pn.pickAria === 'Valitse korvaava liike liikelistasta' && pn.confirmDisabled === true && !pn.old, '1 paneeli levyn alla: tyhjä valinta, Vaihda disabled, ei vanhoja valikoita: ' + JSON.stringify([pn.pickText, pn.pickAria, pn.confirmDisabled, pn.old]));

  console.log('=== 2 haku');
  await search(page, 'leuan');
  g = await groups(page);
  // Vapaan rivin ryhmäotsikko on listan kolmas ryhmä (ilman omia rivejä).
  ok(g.groups.length === 3 && g.groups[0].title === 'Ohjelmassa ja historiassa' && JSON.stringify(g.groups[0].items) === '["Leuanveto"]' && g.groups[1].title === 'Selkä' && g.groups[1].items.length === 6 && g.groups[2].title === 'Listalta puuttuva liike' && g.groups[2].items.length === 0, '2 "leuan": historia (1), Selkä (6) ja vapaan rivin ryhmä: ' + JSON.stringify(g.groups.map(x => x.title + ' ' + x.items.length)));
  ok(g.free === 'Lisää uusi liike ”leuan”' && g.freeGroup === 'Listalta puuttuva liike', '2 vapaa rivi: ' + g.free + ' / ' + g.freeGroup);
  await search(page, YLA);
  g = await groups(page);
  ok(g.groups.length === 1 && g.groups[0].title === 'Selkä' && JSON.stringify(g.groups[0].items) === '["Legless-ylätalja leveällä otteella, Lat-tanko"]' && !g.free, '2 korvattavan koko nimi: vain Legless, ei vapaata riviä: ' + JSON.stringify(g));

  console.log('=== 3 valinta');
  await search(page, '');
  await pick(page, 'Leuanveto');
  pn = await panel(page);
  ok(!pn.sheet && pn.panel, '3 levy suljettu, paneeli näkyy');
  ok(pn.pickText === 'Leuanveto' && pn.pickAria === 'Korvaava liike: Leuanveto. Vaihda valintaa liikelistasta' && pn.pickEmpty === false, '3 painike ja aria-label: ' + pn.pickAria);
  ok(pn.detail === 'Kehonpaino · Selkä · Kirjaustapa: lisäpaino ja toistot', '3 tarkenne: ' + pn.detail);
  ok(pn.label === 'Vaihda kaikissa tekemättömissä kohdissa (2 kohtaa) — 1 tehty säilyy ennallaan' && pn.checked === true, '3 kaikkien viikkojen valinta: ' + pn.label + ' | ' + pn.checked);
  ok(pn.confirmDisabled === false && pn.focusConfirm, '3 Vaihda käytössä ja fokuksessa');

  console.log('=== 4 uudelleenavaus');
  await page.click('[data-swap-pick]'); await w(500);
  sh = await sheet(page); g = await groups(page);
  ok(sh.open && sh.query === '' && sh.focusClose && g.groups[0].title === 'Vastaavat liikkeet', '4 valintapainike avaa levyn tyhjällä haulla, fokus sulkupainikkeessa: ' + JSON.stringify([sh.query, sh.focusClose]));
  await page.keyboard.press('Escape'); await w(500);
  pn = await panel(page);
  ok(!pn.sheet && pn.pickText === 'Leuanveto' && pn.focusConfirm, '4 Escape säilyttää valinnan, fokus Vaihda: ' + JSON.stringify([pn.pickText, pn.focusConfirm]));
  await page.click('[data-swap-pick]'); await w(500);
  await pick(page, 'Ylätalja, V-kahva');
  pn = await panel(page);
  ok(pn.pickText === 'Ylätalja, V-kahva' && pn.detail === 'Talja · Selkä', '4 V-kahva: tarkenne ilman kirjaustapaa: ' + pn.detail);
  await swapOpen(page, 'y2');
  sh = await sheet(page);
  ok(sh.open && sh.title === 'Vaihda liike', '4 alarivin Vaihda avaa levyn uudelleen');
  await page.keyboard.press('Escape'); await w(500);
  pn = await panel(page);
  ok(!pn.sheet && pn.pickText === 'Ylätalja, V-kahva' && pn.detail === 'Talja · Selkä', '4 valinta säilyy alarivin Vaihdan ja Escapen jälkeen');

  console.log('=== 5 vahvistus');
  await page.click('[data-swap-pick]'); await w(500);
  await pick(page, 'Leuanveto');
  await page.click('[data-swap-confirm]'); await w(800);
  let p = await saved(page);
  const y = p.days.map(d => d.exercises[0]);
  ok(y[0].id === 'y1' && y[0].name === YLA && y[0].liikeId === YLA_ID, '5 y1 ennallaan');
  ok(y[1].name === 'Leuanveto' && y[1].liikeId === 'leuanveto' && y[2].name === 'Leuanveto' && y[2].liikeId === 'leuanveto' && y[1].id !== 'y2' && y[2].id !== 'y3' && y[1].id !== y[2].id, '5 y2 ja y3 Leuanveto uusilla id:illä: ' + names(p));
  ok((await toast(page)).indexOf('Liike vaihdettu 2 kohdassa') !== -1, '5 ilmoitus: ' + await toast(page));
  pn = await panel(page);
  ok(pn.title && pn.title.indexOf('Leuanveto') === 0 && pn.head && pn.head.indexOf('Lisä kg') !== -1, '5 kirjausruutu Leuanveto, otsikossa Lisä kg: ' + JSON.stringify([pn.title, pn.head]));
  let st = await swapState(page);
  ok(st.swap === null && st.picker === null && !pn.panel, '5 tila nollattu: ' + JSON.stringify(st));

  console.log('=== 6 sulku ilman valintaa');
  await seed(page);
  await openEx(page, 'y2');
  await swapOpen(page, 'y2');
  await page.keyboard.press('Escape'); await w(500);
  pn = await panel(page); st = await swapState(page);
  ok(!pn.sheet && !pn.panel && st.swap === null && st.picker === null && pn.focusOpen === 'y2', '6 Escape perii vaihdon, fokus Vaihda-painikkeessa: ' + JSON.stringify([pn.sheet, pn.panel, st.swap, pn.focusOpen]));
  await swapOpen(page, 'y2');
  await page.click('.sheet-backdrop', { position: { x: 10, y: 10 } }); await w(500);
  pn = await panel(page); st = await swapState(page);
  ok(!pn.sheet && !pn.panel && st.swap === null && st.picker === null && pn.focusOpen === 'y2', '6 taustan napautus toimii samoin: ' + JSON.stringify([pn.sheet, pn.panel, st.swap, st.picker, pn.focusOpen]));

  console.log('=== 7 uusi liike');
  await swapOpen(page, 'y2');
  await search(page, 'Kaapelisoutu polvillaan');
  g = await groups(page);
  ok(g.groups.length === 0 && g.free === 'Lisää uusi liike ”Kaapelisoutu polvillaan”' && g.freeGroup === null, '7 vain vapaa rivi ilman ryhmäotsikkoa: ' + JSON.stringify(g));
  await page.click('#liike-lista [data-pick-free]'); await w(500);
  pn = await panel(page);
  ok(!pn.sheet && pn.newLiike === 'Kaapelisoutu polvillaan' && pn.newGroup === 'Selkä' && pn.confirmDisabled === false && pn.focusConfirm, '7 lomake: nimi, lihasryhmä Selkä, Vaihda käytössä ja fokuksessa: ' + JSON.stringify([pn.newLiike, pn.newGroup, pn.confirmDisabled, pn.focusConfirm]));
  await page.uncheck('#swap-all-weeks'); await w(200);
  await page.click('[data-swap-confirm]'); await w(800);
  p = await saved(page);
  const y7 = p.days.map(d => d.exercises[0]);
  ok(y7[1].name === 'Kaapelisoutu polvillaan' && !('liikeId' in y7[1]) && y7[1].id !== 'y2' && y7[2].id === 'y3' && y7[2].name === YLA && y7[2].liikeId === YLA_ID, '7 vain y2 nimettiin ilman liikeId:tä, y3 ennallaan: ' + names(p));
  const ue = await userEx(page);
  ok(ue.length === 2 && JSON.stringify(ue[1]) === JSON.stringify({ liike: 'Kaapelisoutu polvillaan', variaatio: null, lisavariaatio: null, lihasryhma: 'Selkä' }), '7 oma liike tallennettu: ' + JSON.stringify(ue[1]));
  ok((await toast(page)) === 'Liike vaihdettu', '7 ilmoitus: ' + await toast(page));

  console.log('=== 8 takaisin listaan');
  await seed(page);
  await openEx(page, 'y2');
  await swapOpen(page, 'y2');
  await search(page, 'Kaapelisoutu polvillaan');
  await page.click('#liike-lista [data-pick-free]'); await w(500);
  ok(!!(await page.$('[data-variant-cancel-new]')), '8 lomake auki');
  await page.click('[data-variant-cancel-new]'); await w(500);
  sh = await sheet(page); g = await groups(page);
  ok(sh.open && sh.query === '' && sh.focusClose && g.groups[0].title === 'Vastaavat liikkeet' && g.groups[0].items.length === 25, '8 levy avautuu tyhjällä haulla, fokus sulkupainikkeessa, vastaavat (25)');
  await page.keyboard.press('Escape'); await w(500);
  pn = await panel(page); st = await swapState(page);
  ok(!pn.sheet && !pn.panel && st.swap === null, '8 Escape perii vaihdon');

  console.log('=== 9 teholiike');
  await openEx(page, 'p2');
  await swapOpen(page, 'p2');
  g = await groups(page);
  const t9 = g.groups.map(x => x.title + ' (' + x.items.length + ')');
  ok(t9[0] === 'Vastaavat liikkeet (33)' && t9[1] === 'Samaa lihasryhmää · Rinta (8)' && t9[2] === 'Ohjelmassa ja historiassa (5)', '9 ryhmät: ' + t9.slice(0, 3).join(' · '));
  pn = await panel(page);
  ok(!(await page.$('#swap-name-input')) && pn.pickEmpty === true && pn.confirmDisabled === true, '9 ei tekstikenttää, Vaihda disabled ennen valintaa myös teholiikkeellä: ' + JSON.stringify([pn.pickEmpty, pn.confirmDisabled]));
  await pick(page, 'Penkkipunnerrus käsipainoilla');
  pn = await panel(page);
  ok(pn.detail === 'Käsipainot · Rinta' && pn.confirmDisabled === false, '9 tarkenne: ' + pn.detail);
  await page.click('[data-swap-confirm]'); await w(800);
  p = await saved(page);
  const pp = p.days.map(d => d.exercises[1]);
  ok(pp[1].name === 'Penkkipunnerrus käsipainoilla' && pp[1].liikeId === 'penkkipunnerrus-kasipainoilla' && pp[2].name === pp[1].name && pp[2].liikeId === pp[1].liikeId, '9 p2 ja p3 vaihdettu: ' + names(p));
  ok(JSON.stringify(pp[1].intensity) === '{"isMax":false,"percents":[72.5]}' && JSON.stringify(pp[2].intensity) === '{"isMax":false,"percents":[72.5]}', '9 teho säilyy: ' + JSON.stringify(pp[1].intensity));
  ok(pp[0].id === 'p1' && pp[0].name === PENKKI && pp[0].liikeId === PENKKI_ID, '9 p1 ennallaan');

  console.log('=== 10 kirjaston ulkopuolinen korvattava');
  await seed(page);
  await openEx(page, 'o2');
  await swapOpen(page, 'o2');
  g = await groups(page);
  const t10 = g.groups.map(x => x.title + ' (' + x.items.length + ')');
  ok(t10[0] === 'Ohjelmassa ja historiassa (5)' && t10[1] === 'Alaselkä (4)' && !g.groups.some(x => x.title === 'Vastaavat liikkeet' || x.title.indexOf('Samaa lihasryhmää') === 0), '10 ei ehdotusryhmiä: ' + t10.slice(0, 2).join(' · '));
  ok(!g.groups.some(x => x.items.indexOf(OMA) !== -1), '10 Oma kiertoliike ei listalla');
  pn = await panel(page);
  ok(pn.label === 'Vaihda kaikissa tekemättömissä kohdissa (3 kohtaa)', '10 valinnan teksti: ' + pn.label);

  console.log('=== 11 paluuele');
  await seed(page);
  await openEx(page, 'y2');
  await swapOpen(page, 'y2');
  await page.goBack(); await w(700);
  st = await swapState(page); pn = await panel(page);
  ok(!pn.sheet && st.swap === null && st.picker === null && st.open === null, '11 paluuele sulkee levyn ja peruu vaihdon: ' + JSON.stringify(st));
  await openEx(page, 'y2');
  pn = await panel(page);
  ok(!pn.panel && !pn.sheet, '11 y2 uudelleen: ei paneelia');

  console.log('=== 12 Enter');
  await swapOpen(page, 'y2');
  await search(page, 'leuanveto');
  g = await groups(page);
  ok(g.groups[0].title === 'Ohjelmassa ja historiassa' && g.groups[0].items[0] === 'Leuanveto', '12 ensimmäinen ryhmä ja rivi: ' + JSON.stringify(g.groups[0]));
  await page.keyboard.press('Enter'); await w(500);
  pn = await panel(page);
  ok(!pn.sheet && pn.pickText === 'Leuanveto' && pn.focusConfirm, '12 Enter valitsee, fokus Vaihda: ' + JSON.stringify([pn.sheet, pn.pickText, pn.focusConfirm]));
  await page.click('[data-swap-cancel]'); await w(400);

  console.log('=== 13 funktiot');
  const f13 = await page.evaluate(() => {
    const t = window.__t;
    return {
      kunto: t.renderExercisePickList('', { name: 'Kuntopyörä', row: t.liikeById('kuntopyora') }),
      oma: t.renderExercisePickList('', { name: 'Oma soutu', row: t.state.userExercises[0] }),
      plain: t.renderExercisePickList(''), plainNull: t.renderExercisePickList('', null),
      leuanRow: (t.exercisePickEntries().find(e => e.name === 'Leuanveto') || {}).row,
      removed: ['exerciseOptionsByGroup', 'renderVariantPicker', 'swapProgramExercise', 'variaatioOptionsFor', 'lisavariaatioOptionsFor', 'variantSelectOptions', 'VARIANT_ADD_NEW', 'VARIANT_PLAIN'].filter(n => t[n] !== null)
    };
  });
  const gk = await groupsOf(page, f13.kunto);
  ok(gk.groups[0].title === 'Vastaavat liikkeet' && JSON.stringify(gk.groups[0].items) === JSON.stringify(['Airbike', 'Crosstrainer', 'Juoksu juoksumatolla', 'Kävely juoksumatolla', 'Mäkiveto', 'Porraskone', 'SkiErg', 'Soutulaite', 'Sprintti', 'Sukkulajuoksu']), '13 kuntopyörän vastaavat (10): ' + gk.groups[0].items.join(', '));
  ok(gk.groups[1].title === 'Samaa lihasryhmää · Alavartalo' && JSON.stringify(gk.groups[1].items) === JSON.stringify(['Boksihyppy', 'Kelkan työntö', 'Kelkan veto', 'Kyykkyhyppy', 'Luisteluhyppy', 'Polvennostohyppy', 'Pudotushyppy', 'Tasaloikka', 'Vauhditon pituushyppy', 'Vuoroloikka']), '13 kuntopyörän sama lihasryhmä (10): ' + gk.groups[1].items.join(', '));
  ok(gk.groups[2].title === 'Ohjelmassa ja historiassa' && gk.groups[2].items.length === 6, '13 kuntopyörä: historia (6): ' + gk.groups[2].items.length);
  const go = await groupsOf(page, f13.oma);
  ok(go.groups[0].title === 'Samaa lihasryhmää · Selkä' && go.groups[0].items.length === 54 && go.groups[1].title === 'Ohjelmassa ja historiassa' && go.groups[1].items.length === 3, '13 oma liike korvattavana: ' + go.groups.slice(0, 2).map(x => x.title + ' ' + x.items.length).join(' · '));
  const gp = await groupsOf(page, f13.plain);
  ok(f13.plain === f13.plainNull && gp.groups[0].title === 'Ohjelmassa ja historiassa' && gp.groups[0].items.length === 6 && gp.groups[1].title === 'Alaselkä' && gp.groups[1].items.length === 4, '13 ilman kontekstia sama kuin null: ' + gp.groups.slice(0, 2).map(x => x.title + ' ' + x.items.length).join(' · '));
  ok(f13.leuanRow && f13.leuanRow.id === 'leuanveto', '13 exercisePickEntries: Leuanveto row.id');
  ok(f13.removed.length === 0, '13 poistetut funktiot puuttuvat: ' + JSON.stringify(f13.removed));

  console.log('=== 14 360 px');
  const p360 = await newPage(browser, { width: 360, height: 800 });
  await seed(p360);
  await openEx(p360, 'y2');
  await swapOpen(p360, 'y2');
  await pick(p360, 'Avustettu leuanveto laitteessa vastaotteella');
  const m14 = await p360.evaluate(() => {
    const b = document.querySelector('[data-swap-pick]'); const t = b.querySelector('.pick-field-text');
    const cs = getComputedStyle(t); const lh = cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight);
    // Nimi näkyy kokonaan: span ei vuoda vaakasuunnassa eikä katkea, ja se on vähintään kahdella rivillä.
    return { ws: cs.whiteSpace, fits: b.scrollWidth <= b.clientWidth && t.scrollWidth <= t.clientWidth, lines: Math.round(t.getBoundingClientRect().height / lh), docW: document.documentElement.scrollWidth, text: t.textContent.trim(),
      detail: (document.querySelector('[data-swap-detail]') || {}).textContent || null };
  });
  ok(m14.ws === 'normal' && m14.fits && m14.lines >= 2 && m14.text === 'Avustettu leuanveto laitteessa vastaotteella', '14 nimi rivittyy painikkeessa kahdelle riville: ' + JSON.stringify(m14));
  ok(m14.docW <= 360, '14 sivun leveys enintään 360: ' + m14.docW);
  ok(m14.detail === 'Laite · Selkä · Kirjaustapa: avustus ja toistot', '14 tarkenne: ' + m14.detail);
  await p360.close();

  console.log('=== 15 leveä asettelu');
  const pw = await newPage(browser, { width: 1024, height: 800 });
  await seed(pw);
  await gotoWeek(pw, '2');
  if(!(await pw.$('[data-toggle-ex][data-id="y2"]'))){ await pw.click('[data-toggle-day-summary][data-key="day-v2"]'); await w(450); }
  await pw.click('[data-toggle-ex][data-id="y2"]'); await w(600);
  ok(!!(await pw.$('.ohjelma-pane .exercise.open')), '15 y2 avautuu paneeliin');
  await pw.click('.ohjelma-pane [data-swap-open]'); await w(500);
  sh = await sheet(pw); g = await groups(pw);
  ok(sh.open && g.groups[0].title === 'Vastaavat liikkeet' && g.groups[0].items.length === 25 && sh.focusClose, '15 levy auki, vastaavat (25), fokus sulkupainikkeessa');
  await pick(pw, 'Leuanveto');
  pn = await panel(pw);
  ok(pn.focusConfirm && pn.label === 'Vaihda kaikissa tekemättömissä kohdissa (2 kohtaa) — 1 tehty säilyy ennallaan', '15 fokus Vaihda, valinnan teksti: ' + pn.label);
  await pw.click('[data-swap-confirm]'); await w(800);
  p = await saved(pw);
  ok(p.days[1].exercises[0].name === 'Leuanveto' && p.days[2].exercises[0].name === 'Leuanveto', '15 y2 ja y3 Leuanveto');
  ok((await toast(pw)).indexOf('Liike vaihdettu 2 kohdassa') !== -1, '15 ilmoitus');
  const paneName = await pw.evaluate(() => (document.querySelector('.ohjelma-pane .exercise.open .exercise-name-btn') || document.querySelector('.ohjelma-pane .exercise.open') || {}).textContent || '');
  ok(paneName.indexOf('Leuanveto') !== -1, '15 paneelissa Leuanveto');
  await pw.close();

  console.log('=== 16 rakentaja ennallaan');
  await seed(page);
  await page.click('[data-edit-program]'); await w(500);
  while(await page.$('[data-edit-back]')){ await page.click('[data-edit-back]'); await w(350); }
  await page.click('[data-edit-open-week="2"]'); await w(350);
  await page.click('[data-edit-open-day="day-v2"]'); await w(350);
  await page.click('[data-edit-add-exercise="day-v2"]'); await w(500);
  sh = await sheet(page); g = await groups(page);
  ok(sh.open && sh.title === 'Valitse liike' && sh.focusHaku, '16 otsikko Valitse liike, fokus hakukentässä: ' + JSON.stringify([sh.title, sh.focusHaku]));
  ok(g.groups[0].title === 'Ohjelmassa ja historiassa' && g.groups[0].items.length === 6 && !g.groups.some(x => x.title === 'Vastaavat liikkeet'), '16 ensimmäinen ryhmä historia (6), ei vastaavia: ' + g.groups[0].title + ' ' + g.groups[0].items.length);
  await search(page, 'Kaapelisoutu polvillaan');
  g = await groups(page);
  ok(g.free === 'Käytä nimeä ”Kaapelisoutu polvillaan”', '16 rakentajan vapaa rivi on yhä Käytä nimeä: ' + g.free);
  await search(page, '');
  await page.keyboard.press('Escape'); await w(300);
  await page.click('[data-edit-cancel]').catch(() => null); await w(300);

  console.log('=== 17 axe');
  const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  async function axe(pg, label){
    await pg.addScriptTag({ content: axeSrc });
    const ax = await pg.evaluate(async () => { const r = await axe.run(document.querySelector('#app'), { runOnly: ['wcag2a', 'wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
    ok(ax.length === 0, '17 axe ' + label + ': ' + JSON.stringify(ax));
  }
  await seed(page);
  await openEx(page, 'y2');
  await swapOpen(page, 'y2');
  await axe(page, 'avoin vaihtolevy');
  await pick(page, 'Leuanveto');
  await axe(page, 'paneeli valinnalla');

  await browser.close();
  console.log(fails ? 'FAILS: ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
