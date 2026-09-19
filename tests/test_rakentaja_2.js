// Rakentaja-kehote 2: liikkeen lisäyssilmukka ja lomakkeen tiivistys (0.4.20).
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function pex(id, name, extra){ return Object.assign({ id, name, sets: '4', reps: '6', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [pex('ex-1','Penkkipunnerrus', { intensity: { isMax: true, percents: [] }, notes: 'MAX' }), pex('ex-2','Kulmasoutu'), pex('ex-3','Lankku', { unit: 'sekuntia', reps: '60' })] },
  { id: 'd2', label: 'Päivä 2', name: 'Viikko 1 · Päivä 2', week: '1', exercises: [] } ] };
const w = ms => new Promise(r => setTimeout(r, ms));
async function seed(page, prog){
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ prog }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    if(prog) localStorage.setItem('treenipk:workout-program', JSON.stringify(prog));
  }, { prog });
  await page.goto(URL); await page.waitForTimeout(400);
}
// Avaa muokkaustilan ja päivän (tasoittainen navigointi tai haitari).
async function openDay(page, dayId){
  await page.click('[data-edit-program]'); await w(500);
  // Tasoittainen navigointi (0.4.21): muokkaus avautuu aktiivisen viikon
  // tasolle, jossa päivärivi avaa päivän tason.
  if(await page.$('[data-edit-open-day="' + dayId + '"]')){ await page.click('[data-edit-open-day="' + dayId + '"]'); await w(400); }
}
const formInfo = page => page.evaluate(() => {
  const f = document.querySelector('.editor-form'); if(!f) return null;
  const g = sel => f.querySelector(sel);
  return { kicker: g('.editor-form-kicker').textContent, name: g('[data-editor-name] .pick-field-text').textContent,
    sets: g('[data-editor-field="sets"]').value, reps: g('[data-editor-field="reps"]').value,
    unit: g('[data-editor-field="unit"]') ? g('[data-editor-field="unit"]').value : null,
    teho: g('[data-editor-field="teho"]') ? g('[data-editor-field="teho"]').value : null,
    hint: g('.editor-form-hint') ? g('.editor-form-hint').textContent : null,
    more: g('[data-edit-form-more]').textContent + '|' + g('[data-edit-form-more]').getAttribute('aria-expanded'),
    buttons: [...f.querySelectorAll('.editor-form-actions button, .editor-form-secondary button')].map(b => b.textContent + '|' + Math.round(b.getBoundingClientRect().height) + '|' + b.className),
    sheet: !!document.querySelector('#liike-haku'),
    kickerBeforeName: f.querySelector('.editor-form-kicker').compareDocumentPosition(f.querySelector('[data-editor-name]')) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false };
});
const dayEx = (page, dayId) => page.evaluate((dayId) => {
  // luetaan tallennetun luonnoksen tilalta: klikataan Valmis myöhemmin; tässä DOM-rivit
  return [...document.querySelectorAll('[data-edit-exercise]')].filter(b => b.classList.contains('editor-title') || b.classList.contains('editor-row-main')).map(b => b.textContent.trim());
}, dayId);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('=== 1 tyhjä päivä, Lisää liike');
  await seed(page, PROGRAM);
  await openDay(page, 'd2');
  await page.click('[data-edit-add-exercise="d2"]'); await w(500);
  let f = await formInfo(page);
  ok(f && f.sheet && f.kicker === 'Liike 1' && f.sets === '' && f.reps === '' && f.unit === null && f.teho === null && f.hint === null && f.more === 'Lisää asetuksia (yksikkö, teho) ▾|false', '1 valitsin auki, Liike 1, kentät tyhjät, ei lisäkenttiä: ' + JSON.stringify(f));
  ok(f.kickerBeforeName, '12 kicker ennen nimipainiketta');
  console.log('=== 2 Tallenna ja lisää seuraava');
  await page.fill('#liike-haku', 'Penkkipunnerrus'); await w(200);
  await page.click('#liike-lista [data-pick-exercise]'); await w(300);
  await page.fill('[data-editor-field="sets"]', '3'); await page.fill('[data-editor-field="reps"]', '8');
  f = await formInfo(page);
  ok(f.buttons.map(b => b.split('|')[0]).join(';') === 'Peruuta;Tallenna ja lisää seuraava;Tallenna ja lopeta' && f.buttons.every(b => b.split('|')[1] === '40') && f.buttons.filter(b => b.indexOf('btn-primary') !== -1).length === 1 && f.buttons[1].indexOf('btn-primary') !== -1, '11 painikkeet 40 px, yksi täytetty: ' + JSON.stringify(f.buttons));
  await page.click('[data-edit-form-save-next]'); await w(500);
  f = await formInfo(page);
  const toast = await page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  ok(f && f.sheet && f.kicker === 'Liike 2' && f.sets === '3' && f.reps === '8' && f.name === 'Valitse liike' && f.hint === 'Esitäytetty edellisestä liikkeestä', '2 valitsin auki, Liike 2 esitäytetty: ' + JSON.stringify(f));
  ok(toast.indexOf('Lisätty: Penkkipunnerrus') !== -1, '2 ilmoitus: ' + toast);
  await page.setViewportSize({ width: 360, height: 780 }); await w(300);
  const narrow = await page.evaluate(() => { const b = document.querySelector('[data-edit-form-save-next]'); return { h: Math.round(b.getBoundingClientRect().height), over: b.scrollWidth > b.clientWidth, docOver: document.documentElement.scrollWidth > 360 }; });
  ok(narrow.h === 40 && !narrow.over && !narrow.docOver, '11 360 px: painike 40 px, teksti mahtuu: ' + JSON.stringify(narrow));
  await page.setViewportSize({ width: 390, height: 900 }); await w(300);
  const toastLive = await page.evaluate(() => { const t = document.getElementById('toast'); return t ? (t.getAttribute('aria-live') || t.getAttribute('role')) : null; });
  ok(!!toastLive, '12 ilmoitus aria-live/role: ' + toastLive);
  console.log('=== 4 valitsin suljetaan ilman valintaa');
  await page.keyboard.press('Escape'); await w(400);
  f = await formInfo(page);
  ok(f && !f.sheet && f.name === 'Valitse liike', '4 lomake jää auki tyhjällä nimellä');
  await page.click('[data-edit-form-save-next]'); await w(300);
  const t4 = await page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  ok(t4.indexOf('Kirjoita liikkeen nimi') !== -1, '4 ilmoitus Kirjoita liikkeen nimi');
  console.log('=== 3 Kulmasoutu 3×10, Tallenna ja lopeta');
  await page.click('[data-editor-name]'); await w(400);
  await page.fill('#liike-haku', 'Kulmasoutu'); await w(200);
  await page.click('#liike-lista [data-pick-exercise]'); await w(300);
  await page.fill('[data-editor-field="reps"]', '10');
  await page.click('[data-edit-form-save]'); await w(400);
  f = await formInfo(page);
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-edit-exercise]')].filter(b => !b.classList.contains('btn-secondary')).map(b => b.textContent.trim().replace(/\s+/g,' ')));
  ok(!f && rows.length === 2 && rows[0].indexOf('Penkkipunnerrus') === 0 && rows[0].indexOf('3 × 8') !== -1 && rows[1].indexOf('Kulmasoutu') === 0 && rows[1].indexOf('3 × 10') !== -1, '3 lomake kiinni, päivällä 2 liikettä: ' + JSON.stringify(rows));
  console.log('=== 5 Peruuta silmukan keskellä');
  await page.click('[data-edit-add-exercise="d2"]'); await w(400);
  await page.fill('#liike-haku', 'Kyykky'); await w(200);
  await page.click('#liike-lista [data-pick-exercise="Kyykky"]'); await w(300);
  await page.click('[data-edit-form-save-next]'); await w(400);
  await page.fill('#liike-haku', 'Maastaveto'); await w(200);
  await page.click('#liike-lista [data-pick-exercise]'); await w(300);
  await page.click('[data-edit-form-cancel]'); await w(400);
  const rows5 = await page.evaluate(() => [...document.querySelectorAll('[data-edit-exercise]')].filter(b => !b.classList.contains('btn-secondary')).map(b => b.querySelector('.exercise-name, .editor-row-name').textContent.trim()));
  ok(!(await formInfo(page)) && rows5.join(',') === 'Penkkipunnerrus,Kulmasoutu,Kyykky', '5 tallennetut säilyvät, keskeneräinen hylätään: ' + rows5.join(','));
  // Valmis → tallennus, tarkista muoto
  await page.click('[data-edit-done]'); await w(600);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:workout-program')));
  const d2 = saved.days.filter(d => d.id === 'd2')[0];
  ok(d2.exercises.length === 3 && JSON.stringify(Object.keys(d2.exercises[0])) === JSON.stringify(['id','name','sets','reps','unit','weight','notes','intensity','kind','autoCalc']) && d2.exercises[0].sets === '3' && d2.exercises[0].reps === '8' && d2.exercises[0].unit === 'toistoa' && d2.exercises[1].reps === '10' && d2.exercises[2].sets === '3' && d2.exercises[2].reps === '10' && d2.exercises[2].unit === 'toistoa', '2/3 tallennusmuoto ennallaan: ' + JSON.stringify(d2.exercises[0]) + ' ' + JSON.stringify(d2.exercises[2]));

  console.log('=== 6 edellinen liike sekuntia');
  await seed(page, PROGRAM);
  await openDay(page, 'd1');
  await page.click('[data-edit-add-exercise="d1"]'); await w(500);
  f = await formInfo(page);
  ok(f && f.unit === 'sekuntia' && f.more.indexOf('|true') !== -1 && f.sets === '4' && f.reps === '60' && f.hint === 'Esitäytetty edellisestä liikkeestä' && f.kicker === 'Liike 4', '6 unit sekuntia, formMore true: ' + JSON.stringify(f));
  await page.keyboard.press('Escape'); await w(300);
  await page.click('[data-edit-form-cancel]'); await w(300);
  console.log('=== 7 muokataan MAX-liikettä');
  await page.click('[data-edit-exercise="ex-1"]'); await w(400);
  f = await formInfo(page);
  ok(f && f.kicker === 'Muokkaa liikettä' && f.more.indexOf('|true') !== -1 && f.teho === 'MAX' && f.buttons.map(b => b.split('|')[0]).join(';') === 'Peruuta;Poista;Tallenna' && f.hint === null, '7 formMore true, teho MAX, Peruuta/Poista/Tallenna (poisto lomakkeessa 0.4.21): ' + JSON.stringify(f));
  await page.click('[data-edit-form-cancel]'); await w(300);
  console.log('=== 8 muokataan liikettä ilman yksikköä ja tehoa');
  await page.click('[data-edit-exercise="ex-2"]'); await w(400);
  f = await formInfo(page);
  ok(f && f.more === 'Lisää asetuksia (yksikkö, teho) ▾|false' && f.unit === null, '8 formMore false');
  await page.click('[data-edit-form-more]'); await w(400);
  f = await formInfo(page);
  const focus1 = await page.evaluate(() => document.activeElement && document.activeElement.id);
  ok(f.more === 'Vähemmän asetuksia ▴|true' && f.unit === '' && f.teho === '' && focus1 === 'editor-form-more', '8 avaus näyttää kentät, fokus painikkeessa: ' + f.more + ' ' + focus1);
  await page.click('[data-edit-form-more]'); await w(400);
  f = await formInfo(page);
  const focus2 = await page.evaluate(() => document.activeElement && document.activeElement.id);
  ok(f.more.indexOf('|false') !== -1 && f.unit === null && focus2 === 'editor-form-more', '8 sulku, fokus painikkeessa');
  console.log('=== 9 näppäimistö');
  await page.click('[data-editor-field="sets"]'); await w(400);
  let kp = await page.evaluate(() => ({ open: !!document.getElementById('keypad'), label: (document.querySelector('#keypad .keypad-label, #keypad [class*=label]') || {}).textContent, target: (document.querySelector('.keypad-target') || {}).dataset ? document.querySelector('.keypad-target').dataset.editorField : null }));
  ok(kp.open && kp.target === 'sets', '9 näppäimistö sarjoille: ' + JSON.stringify(kp));
  await page.click('[data-keypad-key="next"]'); await w(300);
  kp = await page.evaluate(() => ({ open: !!document.getElementById('keypad'), target: document.querySelector('.keypad-target') ? document.querySelector('.keypad-target').dataset.editorField : null }));
  ok(kp.open && kp.target === 'reps', '9 Seuraava siirtyy toistoihin: ' + JSON.stringify(kp));
  console.log('=== 13 nimen vaihto muokkauksessa (swapAll)');
  await page.click('[data-editor-name]'); await w(400);
  await page.fill('#liike-haku', 'Kyykky'); await w(200);
  await page.click('#liike-lista [data-pick-exercise="Kyykky"]'); await w(300);
  await page.click('[data-edit-form-save]'); await w(400);
  const rows13 = await page.evaluate(() => [...document.querySelectorAll('[data-edit-exercise]')].filter(b => !b.classList.contains('btn-secondary')).map(b => b.dataset.editExercise + ':' + b.querySelector('.exercise-name, .editor-row-name').textContent.trim()));
  ok(rows13.length === 3 && rows13[1].indexOf('ex-2') === -1 && rows13[1].indexOf(':Kyykky') !== -1, '13 nimen vaihto antaa uuden id:n: ' + rows13.join(','));

  console.log('=== 10 tuontitila needsReview');
  await seed(page, null);
  // simuloi tuontitilaa: käynnistetään tarkistus ohjelmalla, jolla needsReview
  await page.evaluate(() => { localStorage.setItem('treenipk:workout-program', JSON.stringify({ id: 'p', name: 'X', weeks: ['1'], weekLabels: {}, days: [{ id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [{ id: 'e1', name: 'Penkkipunnerrus', sets: '', reps: '', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true, needsReview: 'sarjat puuttuvat', rawTarget: '3x?' }] }] })); });
  await page.goto(URL); await w(400);
  await openDay(page, 'd1');
  ok(!!(await page.$('.needs-review')), '10 needsReview-rivi korostettu');
  await page.click('[data-edit-exercise="e1"]'); await w(400);
  f = await formInfo(page);
  ok(f && f.kicker === 'Muokkaa liikettä', '10 muokkauslomake');
  await page.fill('[data-editor-field="sets"]', '3'); await page.fill('[data-editor-field="reps"]', '8');
  await page.click('[data-edit-form-save]'); await w(400);
  ok(!(await page.$('.needs-review')), '10 tallennus poistaa needsReview');

  ok(errors.length === 0, 'ei sivuvirheitä: ' + errors.join('; '));
  await browser.close();
  console.log(fails ? ('FAILS: ' + fails) : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
