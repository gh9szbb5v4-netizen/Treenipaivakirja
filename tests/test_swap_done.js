// Liikkeen nimen vaihto ei koske tehtyjä liikkeitä (0.4.23).
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function pex(id, name){ return { id, name, sets: '3', reps: '8', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }; }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1','2','3'], weekLabels: {}, days: ['1','2','3'].map(w => (
  { id: 'd' + w, label: 'Päivä 1', name: 'Viikko ' + w + ' · Päivä 1', week: w, exercises: [pex('a' + w, 'Penkkipunnerrus'), pex('b' + w, 'Kulmasoutu')] })) };
const st = (w, r) => ({ weight: w, reps: r, done: true });
// Viikon 1 molemmat liikkeet on tehty.
const ENTRY = { date: '2026-09-22', exercises: {
  a1: { name: 'Penkkipunnerrus', sets: [st(60,8), st(60,8), st(60,8)], kind: 'plain', loggedAt: '2026-09-22T10:00:00.000Z' },
  b1: { name: 'Kulmasoutu', sets: [st(50,8), st(50,8), st(50,8)], kind: 'plain', loggedAt: '2026-09-22T10:20:00.000Z' } } };
const w = ms => new Promise(r => setTimeout(r, ms));
async function seed(page){
  await page.clock.setFixedTime(new Date('2026-09-24T12:00:00'));
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ prog, entry }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(prog));
    localStorage.setItem('treenipk:entries:' + entry.date, JSON.stringify(entry));
  }, { prog: PROGRAM, entry: ENTRY });
  await page.goto(URL); await page.waitForSelector('.bottom-nav'); await w(400);
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:workout-program')));
const names = prog => prog.days.map(d => d.week + ':' + d.exercises.map(e => e.id + '=' + e.name).join(',')).join(' | ');
const toast = page => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
async function gotoWeek(page, week){
  for(let i=0;i<6;i++){
    const cur = await page.evaluate(() => { const c = document.querySelector('.week-head-count'); return c ? c.textContent.trim().split(/\s*\/\s*/)[0].replace(/\D/g, '') : null; });
    if(cur === week) return;
    await page.click('[data-week-nav="' + (Number(cur) < Number(week) ? 'next' : 'prev') + '"]'); await w(350);
  }
}
async function openEx(page, week, id){
  await gotoWeek(page, week);
  if(!(await page.$('[data-toggle-ex][data-id="' + id + '"]'))){ await page.click('[data-toggle-day-summary][data-key="d' + week + '"]'); await w(400); }
  await page.click('[data-toggle-ex][data-id="' + id + '"]'); await page.waitForSelector('.ledger'); await w(500);
}
async function editorDay(page, week){
  await page.click('[data-edit-program]'); await w(500);
  while(await page.$('[data-edit-back]')){ await page.click('[data-edit-back]'); await w(350); }
  await page.click('[data-edit-open-week="' + week + '"]'); await w(350);
  await page.click('[data-edit-open-day="d' + week + '"]'); await w(350);
}
const formInfo = page => page.evaluate(() => {
  const f = document.querySelector('.editor-form'); if(!f) return null;
  const nb = f.querySelector('[data-editor-name]');
  const lab = [...f.querySelectorAll('label')].find(l => l.querySelector('#editor-swap-all'));
  return { nameDisabled: nb.disabled, opensSheet: nb.hasAttribute('data-open-sheet'), hint: (f.querySelector('#editor-name-locked') || {}).textContent || null,
    describedBy: nb.getAttribute('aria-describedby'), label: lab ? lab.textContent.trim() : null, checked: lab ? lab.querySelector('input').checked : null };
});
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('=== 1 muokkaustila: tekemättömän liikkeen vaihto kaikkiin viikkoihin');
  await seed(page);
  await editorDay(page, '2');
  await page.click('[data-edit-exercise="a2"]'); await w(400);
  let f = await formInfo(page);
  ok(f && !f.nameDisabled && f.opensSheet && f.label === 'Jos nimi muuttuu, vaihda kaikissa tekemättömissä kohdissa (2 kohtaa) — 1 tehty säilyy ennallaan' && f.checked === true, '1 valinnan selite kertoo tekemättömät ja tehdyt: ' + JSON.stringify(f));
  await page.click('[data-editor-name]'); await w(400);
  await page.fill('#liike-haku', 'Kyykky'); await w(200);
  await page.click('#liike-lista [data-pick-exercise="Kyykky"]'); await w(300);
  await page.click('[data-edit-form-save]'); await w(400);
  await page.click('[data-edit-done]'); await w(700);
  let p = await saved(page);
  const w1 = p.days.find(d => d.week === '1').exercises, w2 = p.days.find(d => d.week === '2').exercises, w3 = p.days.find(d => d.week === '3').exercises;
  ok(w1[0].id === 'a1' && w1[0].name === 'Penkkipunnerrus', '1 tehty viikon 1 liike ennallaan (id ja nimi): ' + names(p));
  ok(w2[0].name === 'Kyykky' && w2[0].id !== 'a2' && w3[0].name === 'Kyykky' && w3[0].id !== 'a3' && w2[0].id !== w3[0].id, '1 tekemättömät viikot 2 ja 3 vaihtuivat uusin id:in');
  const entry = await page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:entries:2026-09-22')));
  ok(Object.keys(entry.exercises).join() === 'a1,b1' && entry.exercises.a1.name === 'Penkkipunnerrus', '1 merkinnät koskemattomia');
  await gotoWeek(page, '1');
  if(!(await page.$('[data-toggle-ex][data-id="a1"]'))){ await page.click('[data-toggle-day-summary][data-key="d1"]'); await w(400); }
  const doneA1 = await page.evaluate(() => { const el = document.querySelector('[data-toggle-ex][data-id="a1"]'); const card = el && el.closest('.exercise'); return card ? { name: card.textContent.indexOf('Penkkipunnerrus') !== -1, saved: !!card.querySelector('.saved-badge') } : null; });
  ok(!!doneA1 && doneA1.name && doneA1.saved, '1 viikon 1 liike näkyy yhä tehtynä (✓ tallennettu): ' + JSON.stringify(doneA1));

  console.log('=== 2 muokkaustila: tehdyn liikkeen nimi on lukittu, muut kentät muokattavissa');
  await editorDay(page, '1');
  await page.click('[data-edit-exercise="a1"]'); await w(400);
  f = await formInfo(page);
  ok(f && f.nameDisabled && !f.opensSheet && f.hint === 'Liike on jo merkitty tehdyksi, joten sen nimeä ei voi vaihtaa.' && f.describedBy === 'editor-name-locked' && f.label === null, '2 nimi lukittu, selite, ei kaikkien viikkojen valintaa: ' + JSON.stringify(f));
  await page.fill('[data-editor-field="sets"]', '4'); await w(100);
  await page.click('[data-edit-form-save]'); await w(400);
  await page.click('[data-edit-done]'); await w(700);
  p = await saved(page);
  const a1 = p.days.find(d => d.week === '1').exercises[0];
  ok(a1.id === 'a1' && a1.name === 'Penkkipunnerrus' && a1.sets === '4', '2 sarjamuutos tallentui, id ja nimi ennallaan: ' + JSON.stringify(a1));

  console.log('=== 3 kirjausnäkymä: tehdyllä liikkeellä ei Vaihda-painiketta');
  await seed(page);
  await openEx(page, '1', 'b1');
  ok(!(await page.$('[data-swap-open]')), '3 tehdyllä liikkeellä ei Vaihda-painiketta');
  await page.click('[data-close-ex]'); await w(600);

  console.log('=== 4 kirjausnäkymä: vaihto kaikkiin tekemättömiin');
  await openEx(page, '2', 'b2');
  await page.click('[data-swap-open][data-id="b2"]'); await w(400);
  const lab = await page.evaluate(() => { const l = [...document.querySelectorAll('label')].find(x => x.querySelector('#swap-all-weeks')); return l ? l.textContent.trim() + '|' + l.querySelector('input').checked : null; });
  ok(lab === 'Vaihda kaikissa tekemättömissä kohdissa (2 kohtaa) — 1 tehty säilyy ennallaan|true', '4 valinnan selite: ' + lab);
  await page.selectOption('[data-variant-liike]', 'Alasoutu levypainokoneessa'); await w(400);
  await page.click('[data-swap-confirm]'); await w(700);
  const t4 = await toast(page);
  p = await saved(page);
  const b = p.days.map(d => d.exercises[1]);
  ok(b[0].id === 'b1' && b[0].name === 'Kulmasoutu', '4 tehty viikon 1 liike ennallaan: ' + names(p));
  ok(b[1].name.indexOf('Alasoutu levypainokoneessa') === 0 && b[2].name === b[1].name && b[1].id !== 'b2' && b[2].id !== 'b3', '4 viikot 2 ja 3 vaihtuivat');
  ok(t4.indexOf('Liike vaihdettu 2 kohdassa') !== -1, '4 ilmoitus laskee vain vaihdetut: ' + t4);

  console.log('=== 5 yksi kohta: valintaa ei näytetä, kun muut ovat tehtyjä');
  await seed(page);
  await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem('treenipk:entries:2026-09-22'));
    e.exercises.b2 = Object.assign({}, e.exercises.b1, { loggedAt: '2026-09-23T10:00:00.000Z' });
    localStorage.setItem('treenipk:entries:2026-09-22', JSON.stringify(e));
  });
  await page.goto(URL); await page.waitForSelector('.bottom-nav'); await w(400);
  await editorDay(page, '3');
  await page.click('[data-edit-exercise="b3"]'); await w(400);
  f = await formInfo(page);
  ok(f && !f.nameDisabled && f.label === null, '5 ainoa tekemätön: ei kaikkien viikkojen valintaa: ' + JSON.stringify(f));
  await page.click('[data-editor-name]'); await w(400);
  await page.fill('#liike-haku', 'Kyykky'); await w(200);
  await page.click('#liike-lista [data-pick-exercise="Kyykky"]'); await w(300);
  await page.click('[data-edit-form-save]'); await w(400);
  await page.click('[data-edit-done]'); await w(700);
  p = await saved(page);
  ok(p.days.map(d => d.exercises[1].id + '=' + d.exercises[1].name).slice(0, 2).join() === 'b1=Kulmasoutu,b2=Kulmasoutu' && p.days[2].exercises[1].name === 'Kyykky', '5 tehdyt viikot 1 ja 2 ennallaan: ' + names(p));

  console.log('=== 6 a11y');
  await editorDay(page, '1');
  await page.click('[data-edit-exercise="a1"]'); await w(400);
  const axeSrc = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  await page.addScriptTag({ content: axeSrc });
  const axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
  ok(axe.filter(v => v.indexOf('color-contrast') !== 0).length === 0, '6 axe: ' + JSON.stringify(axe));

  ok(errors.length === 0, 'ei sivuvirheitä: ' + errors.join('; '));
  await browser.close();
  console.log(fails ? ('FAILS: ' + fails) : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
