// Rakentaja-kehote 1: runkokysely ja viikon monistus (0.4.19), sovitettu
// tasoittaiseen navigointiin (0.4.21).
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function pex(id, name, extra){ return Object.assign({ id, name, sets: '4', reps: '6', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1','2'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [pex('ex-1','Penkkipunnerrus', { needsReview: 'x' }), pex('ex-2','Kulmasoutu')] },
  { id: 'd2', label: 'Päivä 2', name: 'Viikko 1 · Päivä 2', week: '1', exercises: [pex('ex-3','Kyykky')] },
  { id: 'd3', label: 'Päivä 1', name: 'Viikko 2 · Päivä 1', week: '2', exercises: [pex('ex-4','Penkkipunnerrus')] } ] };
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
const w = ms => new Promise(r => setTimeout(r, ms));
async function openBuilderFromSettings(page){
  await page.click('.tab[data-tab="asetukset"]'); await w(400);
  await page.click('.settings-row[data-settings-section="ohjelma"]'); await w(400);
  await page.click('[data-builder-start]'); await w(400);
}
async function goRoot(page){
  for(let i=0;i<3;i++){ if(!(await page.$('[data-edit-back]'))) break; await page.click('[data-edit-back]'); await w(400); }
}
async function closeSheet(page){ if(await page.$('#liike-haku')){ await page.keyboard.press('Escape'); await w(300); } }
const setupInfo = page => page.evaluate(() => ({
  title: (document.querySelector('header .header') || {}).textContent || '',
  name: !!document.querySelector('.builder-card [data-editor-program-name]'),
  namePh: (document.querySelector('.builder-card [data-editor-program-name]') || {}).placeholder,
  days: [...document.querySelectorAll('[data-setup-days]')].map(b => b.dataset.setupDays + ':' + b.getAttribute('aria-pressed') + ':' + b.className),
  count: (document.querySelector('.builder-count') || {}).textContent,
  live: document.querySelector('.builder-count') ? document.querySelector('.builder-count').getAttribute('aria-live') : null,
  minus: document.querySelector('[data-setup-weeks="-1"]') ? { dis: document.querySelector('[data-setup-weeks="-1"]').disabled, label: document.querySelector('[data-setup-weeks="-1"]').getAttribute('aria-label') } : null,
  plus: document.querySelector('[data-setup-weeks="1"]') ? { dis: document.querySelector('[data-setup-weeks="1"]').disabled, label: document.querySelector('[data-setup-weeks="1"]').getAttribute('aria-label') } : null,
  weekless: !!document.querySelector('[data-setup-weekless]'),
  rowHidden: (document.querySelector('.builder-row') || {}).className,
  copy: document.querySelector('[data-setup-copy-current]') ? { tag: document.querySelector('[data-setup-copy-current]').tagName, text: document.querySelector('[data-setup-copy-current]').textContent.trim() } : null,
  bar: [...document.querySelectorAll('.edit-bar button')].map(b => b.textContent),
  summary: !!document.querySelector('[data-edit-add-week]'),
}));
const lvl = page => page.evaluate(() => {
  const head = document.querySelector('.screen-head');
  const rep = document.querySelector('.builder-replicate');
  return { kicker: head ? (head.querySelector('.screen-kicker') || {}).textContent : null,
    dayId: head && head.querySelector('[data-editor-day-name]') ? head.querySelector('[data-editor-day-name]').dataset.editorDayName : null,
    weekRows: [...document.querySelectorAll('[data-edit-open-week]')].map(e => e.dataset.editOpenWeek),
    weekSubs: [...document.querySelectorAll('[data-edit-open-week]')].map(e => (e.querySelector('.editor-row-sub') || {}).textContent),
    dayRows: [...document.querySelectorAll('[data-edit-open-day]')].map(e => e.dataset.editOpenDay),
    dayNames: [...document.querySelectorAll('[data-edit-open-day] .editor-row-name')].map(e => e.textContent),
    daySubs: [...document.querySelectorAll('[data-edit-open-day] .editor-row-sub')].map(e => e.textContent),
    exRows: [...document.querySelectorAll('[data-edit-exercise]')].filter(b => b.classList.contains('editor-row-main')).map(b => b.dataset.editExercise + ':' + b.querySelector('.editor-row-name').textContent.trim()),
    arrows: document.querySelectorAll('.editor-list [data-edit-move]').length,
    headings: [...document.querySelectorAll('.day-heading')].map(h => h.textContent),
    bar: [...document.querySelectorAll('.edit-bar button')].map(b => b.textContent),
    form: document.querySelector('.editor-form') ? { kicker: document.querySelector('.editor-form .editor-form-kicker').textContent, restart: !!document.querySelector('.editor-form [data-edit-restart]') } : null,
    sheet: !!document.querySelector('#liike-haku'),
    rep: rep ? { title: rep.querySelector('.builder-copy-title').textContent, hint: rep.querySelector('.builder-hint').textContent, btn: rep.querySelector('[data-edit-replicate]') && rep.querySelector('[data-edit-replicate]').textContent + '|' + rep.querySelector('[data-edit-replicate]').dataset.editReplicate } : null,
    menu: [...document.querySelectorAll('.editor-level-menu button')].map(b => b.textContent.trim()),
    restartProgram: !!document.querySelector('[data-edit-restart="program"]'),
    toast: (document.getElementById('toast') || {}).textContent || '' };
});
// Lisää liike avoimella päivätasolla: käyttää avointa lomaketta tai avaa sen.
async function addExercise(page, name, sets, reps){
  if(!(await page.$('.editor-form'))){ await page.click('[data-edit-add-exercise]'); await w(400); }
  if(!(await page.$('#liike-haku'))){ await page.click('[data-editor-name]'); await w(400); }
  await page.fill('#liike-haku', name); await w(200);
  await page.click('#liike-lista [data-pick-exercise="' + name + '"]'); await w(300);
  await page.fill('[data-editor-field="sets"]', sets); await page.fill('[data-editor-field="reps"]', reps);
  await page.click('[data-edit-form-save]'); await w(400);
}
const draftJson = page => page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:workout-program')));

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('=== 1 Rakenna itse → kysely');
  await seed(page, PROGRAM);
  await openBuilderFromSettings(page);
  let s = await setupInfo(page);
  ok(s.title.indexOf('Rakenna ohjelma') !== -1, '1 otsikko Rakenna ohjelma');
  ok(s.name && s.namePh === 'Oma ohjelma', '1 nimikenttä');
  ok(s.days.join(';') === '2:false:;3:true:on;4:false:;5:false:;6:false:', '1 päiväpainikkeet 2–6, 3 valittuna: ' + s.days.join(';'));
  ok(s.count === '4' && s.live === 'polite' && s.minus && !s.minus.dis && s.plus && !s.plus.dis, '1 viikkoaskeltin 4');
  ok(s.weekless && s.copy && s.copy.tag === 'BUTTON' && s.copy.text.indexOf('Kopioi nykyinen ohjelma pohjaksi') === 0 && s.copy.text.indexOf('Testi · 2 viikkoa · 2 päivää') !== -1, '1 viikoton ja Kopioi-kortti: ' + JSON.stringify(s.copy));
  ok(s.bar.join('|') === 'Peruuta|Jatka' && !s.summary, '1 edit-bar Peruuta / Jatka, ei viikkolistaa');
  ok(s.minus.label === 'Vähennä viikkoja' && s.plus.label === 'Lisää viikkoja', '16 askeltimen aria-labelit');

  console.log('=== 3 askeltimen rajat');
  for(let i=0;i<3;i++){ await page.click('[data-setup-weeks="-1"]'); await w(150); }
  s = await setupInfo(page);
  ok(s.count === '1' && s.minus.dis && !s.plus.dis, '3 arvo 1: − pois käytöstä');
  for(let i=0;i<12;i++){ if(!(await page.$('[data-setup-weeks="1"]:not([disabled])'))) break; await page.click('[data-setup-weeks="1"]'); await w(120); }
  s = await setupInfo(page);
  ok(s.count === '12' && s.plus.dis && !s.minus.dis, '3 arvo 12: + pois käytöstä');

  console.log('=== 4 viikoton');
  await page.click('[data-setup-weekless]'); await w(300);
  s = await setupInfo(page);
  ok(s.rowHidden.indexOf('hidden') !== -1, '4 viikkorivi piilossa');
  await page.click('[data-setup-continue]'); await w(500);
  let e = await lvl(page);
  ok(e.kicker === 'Päivä 1' && e.form && e.form.kicker === 'Liike 1' && e.sheet && e.bar.join('|') === 'Peruuta|Valmis', '4 päivän 1 taso, lomake ja valitsin auki: ' + JSON.stringify([e.kicker, e.form, e.sheet]));
  await closeSheet(page); await goRoot(page);
  e = await lvl(page);
  ok(e.weekRows.length === 0 && e.dayRows.length === 3 && e.headings.indexOf('Treenipäivät') !== -1 && e.dayNames.join(',') === 'Päivä 1,Päivä 2,Päivä 3', '4 3 päivää ilman viikkoa, Treenipäivät-otsikko: ' + JSON.stringify([e.dayNames, e.headings]));

  console.log('=== 5 Peruuta kyselyssä');
  await page.click('[data-edit-cancel]'); await w(400);
  ok(!(await page.$('.edit-bar')), '5a paluu (runkoa ei muutettu → ei vahvistusta)');
  await page.click('[data-builder-start]'); await w(400);
  await page.click('[data-setup-days="4"]'); await w(150);
  await page.click('[data-edit-cancel]'); await w(400);
  ok(!(await page.$('.edit-bar')), '5 Peruuta ilman nimeä: suora paluu');
  await page.click('[data-builder-start]'); await w(400);
  await page.fill('[data-editor-program-name]', 'Uusi'); await w(100);
  await page.click('[data-edit-cancel]'); await w(300);
  let barTxt = await page.evaluate(() => [...document.querySelectorAll('.edit-bar button')].map(b => b.textContent).join('|'));
  ok(barTxt === 'Hylkää muutokset?|Jatka', '5 nimen kanssa vahvistus: ' + barTxt);
  await page.click('[data-edit-cancel]'); await w(400);
  ok(!(await page.$('.edit-bar')), '5 toinen painallus poistuu');

  console.log('=== 2 4 päivää × 6 viikkoa');
  await page.click('[data-builder-start]'); await w(400);
  await page.click('[data-setup-days="4"]'); await w(150);
  for(let i=0;i<2;i++){ await page.click('[data-setup-weeks="1"]'); await w(120); }
  s = await setupInfo(page);
  ok(s.days[2] === '4:true:on' && s.count === '6', '2 valinnat 4 päivää, 6 viikkoa');
  await page.click('[data-setup-continue]'); await w(500);
  e = await lvl(page);
  ok(e.kicker === 'Viikko 1 › Päivä 1' && e.form && e.sheet, '2 viikon 1 päivä 1 auki (stage build): ' + e.kicker);
  await closeSheet(page);
  await page.click('[data-edit-back]'); await w(400);
  e = await lvl(page);
  ok(e.kicker === 'Ohjelma › Viikko 1' && e.dayNames.join(',') === 'Päivä 1,Päivä 2,Päivä 3,Päivä 4' && e.daySubs.every(x => x === 'ei liikkeitä'), '2 viikon 1 päivät 1–4 tyhjiä: ' + e.dayNames.join(','));
  await page.click('[data-edit-back]'); await w(400);
  e = await lvl(page);
  ok(e.weekRows.join(',') === '1,2,3,4,5,6' && e.weekSubs.every(x => x === '4 päivää · ei liikkeitä'), '2 viikot 1–6, 24 tyhjää päivää: ' + JSON.stringify(e.weekSubs));
  await page.click('[data-edit-cancel]'); await w(400);
  ok(!(await page.$('.edit-bar')), '2 editorHasChanges epätosi (Peruuta poistuu heti)');
  await page.click('[data-builder-start]'); await w(400);
  await page.click('[data-setup-days="4"]'); await w(150);
  for(let i=0;i<2;i++){ await page.click('[data-setup-weeks="1"]'); await w(120); }
  await page.click('[data-setup-continue]'); await w(500);

  console.log('=== 11 Valmis heti');
  await closeSheet(page);
  await page.click('[data-edit-done]'); await w(400);
  e = await lvl(page);
  ok(e.toast.indexOf('Lisää ohjelmaan vähintään yksi liike') !== -1 && !!(await page.$('.edit-bar')), '11 draftProblem: ' + e.toast);

  console.log('=== 7/14/13 viikko 1 päivä 1: liikkeet, nuolet, valikot');
  await addExercise(page, 'Penkkipunnerrus', '3', '8');
  e = await lvl(page);
  ok(e.exRows.length === 1 && e.arrows === 0, '14 yhdellä liikkeellä ei siirtonuolia');
  await addExercise(page, 'Kulmasoutu', '3', '10');
  e = await lvl(page);
  ok(e.exRows.length === 2 && e.arrows === 4, '14 kahdella liikkeellä nuolet (4): ' + e.arrows);
  await page.click('[data-edit-level-menu]'); await w(300);
  e = await lvl(page);
  ok(e.menu.join('|') === 'Kopioi päivä|Poista päivä', '13 päivän valikko ilman Aloita uudelleen: ' + e.menu.join('|'));
  await page.click('[data-edit-level-menu]'); await w(200);
  await page.click('[data-edit-exercise]'); await w(400);
  e = await lvl(page);
  ok(e.form && !e.form.restart, '13 liikelomake ilman Aloita uudelleen');
  await page.click('[data-edit-form-cancel]'); await w(300);
  await page.click('[data-edit-back]'); await w(400);
  await page.click('[data-edit-level-menu]'); await w(300);
  e = await lvl(page);
  ok(e.menu.join('|') === 'Kopioi viikko|Poista viikko', '13 viikon valikko ilman Aloita uudelleen: ' + e.menu.join('|'));
  await page.click('[data-edit-back]'); await w(400);
  e = await lvl(page);
  ok(!e.restartProgram, '13 ei ohjelmatason Aloita uudelleen');
  ok(!!e.rep && e.rep.title === 'Monista Viikko 1 viikoille 2–6' && e.rep.hint === 'Kopioi päivät ja liikkeet; painot ehdotetaan kirjauksessa' && e.rep.btn === 'Monista|1', '7 monistuskortti: ' + JSON.stringify(e.rep));

  console.log('=== 9 viikolla 3 jo liike');
  await page.click('[data-edit-open-week="3"]'); await w(400);
  e = await lvl(page);
  await page.click('[data-edit-open-day="' + e.dayRows[0] + '"]'); await w(400);
  await addExercise(page, 'Kyykky', '5', '5');
  await goRoot(page);
  e = await lvl(page);
  ok(!!e.rep && e.rep.title === 'Monista Viikko 1 viikoille 2–6', '9 otsikko viikoille 2–6: ' + (e.rep && e.rep.title));
  await page.click('[data-edit-replicate]'); await w(500);
  e = await lvl(page);
  ok(e.toast.indexOf('Monistettu viikoille 2, 4, 5, 6') !== -1, '9 ilmoitus: ' + e.toast);
  ok(!e.rep, '8 kortti katoaa');
  ok(e.weekSubs[1] === '4 päivää · 2 liikettä' && e.weekSubs[2] === '4 päivää · 1 liike' && e.weekSubs[5] === '4 päivää · 2 liikettä', '8 viikoilla 4 päivää ja kopioidut liikkeet, viikko 3 ennallaan: ' + JSON.stringify(e.weekSubs));
  await page.click('[data-edit-open-week="2"]'); await w(400);
  e = await lvl(page);
  ok(e.daySubs.join(',') === '2 liikettä,ei liikkeitä,ei liikkeitä,ei liikkeitä' && e.dayNames.join(',') === 'Päivä 1,Päivä 2,Päivä 3,Päivä 4', '8 viikon 2 päivä 1 sai 2 liikettä: ' + e.daySubs.join(','));
  await goRoot(page);

  console.log('=== 11b Valmis monistuksen jälkeen (ohjelma käytössä → pohjalevy)');
  await page.click('[data-edit-done]'); await w(500);
  ok(!!(await page.$('[data-new-program-activate]')), '11 uusi ohjelma tarjotaan käyttöön');
  await page.click('[data-new-program-activate]'); await w(600);
  let saved = await draftJson(page);
  const byWeek = {}; saved.days.forEach(d => { byWeek[d.week] = (byWeek[d.week] || 0) + 1; });
  const allEx = saved.days.reduce((a, d) => a + d.exercises.length, 0);
  const exIds = []; saved.days.forEach(d => d.exercises.forEach(x => exIds.push(x.id)));
  const dIds = saved.days.map(d => d.id);
  ok(saved.weeks.length === 6 && saved.days.length === 6 && byWeek['1'] === 1 && byWeek['3'] === 1 && byWeek['6'] === 1, '11 tallennus: 6 viikkoa, tyhjät päivät pudotettu: ' + JSON.stringify(byWeek));
  ok(allEx === 11 && new Set(exIds).size === 11 && new Set(dIds).size === 6, '8 kaikki liike- ja päivä-id:t uusia ja erillisiä: ' + allEx);
  ok(saved.days.map(d => d.week).join(',') === '1,2,3,4,5,6' && saved.days[1].label === 'Päivä 1' && saved.days[1].exercises.map(x => x.name).join(',') === 'Penkkipunnerrus,Kulmasoutu', '8 päivät viikkojärjestyksessä, samat labelit ja liikkeet');
  ok(saved.name === 'Oma ohjelma', '11 nimi oletukseksi Oma ohjelma: ' + saved.name);

  console.log('=== 12 viikko 1 rakennettu, ei monistusta, Valmis');
  await seed(page, null);
  await page.click('[data-builder-start]'); await w(400);
  s = await setupInfo(page);
  ok(!s.copy, '1 ilman ohjelmaa ei Kopioi-korttia');
  await page.fill('[data-editor-program-name]', 'Kolmen viikon'); await w(100);
  await page.click('[data-setup-weeks="-1"]'); await w(150);
  await page.click('[data-setup-continue]'); await w(500);
  await addExercise(page, 'Kyykky', '5', '5');
  await goRoot(page);
  e = await lvl(page);
  ok(!!e.rep && e.rep.title === 'Monista Viikko 1 viikoille 2–3', '7 kortti viikoille 2–3: ' + (e.rep && e.rep.title));
  await page.click('[data-edit-done]'); await w(600);
  saved = await draftJson(page);
  ok(saved && saved.weeks.join(',') === '1' && saved.days.length === 1 && saved.name === 'Kolmen viikon', '12 vain viikko 1 tallentui: ' + JSON.stringify(saved.weeks) + ' ' + saved.name);

  console.log('=== 10 yksi viikko: ei korttia');
  await openBuilderFromSettings(page);
  for(let i=0;i<3;i++){ await page.click('[data-setup-weeks="-1"]'); await w(150); }
  await page.click('[data-setup-continue]'); await w(500);
  await addExercise(page, 'Kyykky', '5', '5');
  await goRoot(page);
  e = await lvl(page);
  ok(!e.rep && e.weekRows.join() === '1', '10 yhdellä viikolla ei monistuskorttia');
  await page.click('[data-edit-cancel]'); await w(300); await page.click('[data-edit-cancel]'); await w(400);

  console.log('=== 6 Kopioi nykyinen ohjelma');
  await seed(page, PROGRAM);
  await openBuilderFromSettings(page);
  await page.click('[data-setup-copy-current]'); await w(500);
  e = await lvl(page);
  ok(e.bar.join('|') === 'Peruuta|Valmis' && e.weekRows.join() === '1,2' && !e.rep, '6 stage build juuressa, viikot 1–2, ei tyhjiä viikkoja: ' + JSON.stringify(e.weekRows));
  const nameVal = await page.evaluate(() => document.querySelector('[data-editor-program-name]').value);
  ok(nameVal === 'Testi (kopio)', '6 nimi (kopio): ' + nameVal);
  await page.click('[data-edit-open-week="1"]'); await w(400);
  e = await lvl(page);
  await page.click('[data-edit-open-day="' + e.dayRows[0] + '"]'); await w(400);
  const needs = await page.evaluate(() => document.querySelectorAll('.needs-review').length);
  ok(needs === 0, '6 needsReview poistettu');
  await page.click('[data-edit-cancel]'); await w(400);
  ok(!(await page.$('.edit-bar')), '6 baseline = kopio (Peruuta poistuu heti)');
  let orig = await draftJson(page);
  ok(orig.id === 'prog-1' && orig.days[0].exercises[0].id === 'ex-1', '6 alkuperäinen ohjelma ennallaan');
  await page.click('[data-builder-start]'); await w(400);
  await page.click('[data-setup-copy-current]'); await w(500);
  await page.click('[data-edit-done]'); await w(500);
  await page.click('[data-new-program-activate]'); await w(600);
  saved = await draftJson(page);
  const savedEx = []; saved.days.forEach(d => d.exercises.forEach(x => savedEx.push(x.id)));
  ok(saved.id !== 'prog-1' && saved.name === 'Testi (kopio)' && saved.days.every(d => ['d1','d2','d3'].indexOf(d.id) === -1) && savedEx.every(id => ['ex-1','ex-2','ex-3','ex-4'].indexOf(id) === -1) && new Set(savedEx).size === 4 && saved.days[0].exercises[0].needsReview === undefined, '6 uudet id:t, needsReview pois');
  const lib = await page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:programs') || '[]'));
  ok(lib.some(p => p.id === 'prog-1' && p.days[0].exercises[0].id === 'ex-1'), '6 alkuperäinen kirjastossa ennallaan');

  console.log('=== 15 edit-tila');
  await seed(page, { id: 'prog-2', name: 'Kaksi', weeks: ['1','2','3'], weekLabels: {}, days: [
    { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [pex('ex-1','Penkkipunnerrus')] },
    { id: 'd2', label: 'Päivä 1', name: 'Viikko 2 · Päivä 1', week: '2', exercises: [] } ] });
  await page.click('[data-edit-program]'); await w(500);
  e = await lvl(page);
  ok(e.kicker === 'Ohjelma › Viikko 1' && e.bar.join('|') === 'Peruuta|Valmis' && !(await page.$('.builder-days')), '15 edit: ei kyselyä, viikkotaso: ' + e.kicker);
  await page.click('[data-edit-level-menu]'); await w(300);
  e = await lvl(page);
  ok(e.menu.join('|') === 'Kopioi viikko|Aloita uudelleen|Poista viikko', '13 edit-tilassa Aloita uudelleen ennallaan: ' + e.menu.join('|'));
  await page.click('[data-edit-back]'); await w(400);
  e = await lvl(page);
  ok(!!e.rep && e.rep.title === 'Monista Viikko 1 viikoille 2–3' && e.restartProgram, '15 edit: monistuskortti ja ohjelmatason Aloita uudelleen: ' + JSON.stringify(e.rep));
  await page.click('[data-edit-replicate]'); await w(500);
  e = await lvl(page);
  ok(e.toast.indexOf('Monistettu viikoille 2, 3') !== -1 && !e.rep, '15 edit: monistus toimii: ' + e.toast);
  await page.click('[data-edit-done]'); await w(600);
  saved = await draftJson(page);
  ok(saved.days.length === 3 && saved.days.map(d => d.week).join() === '1,2,3' && saved.days[1].exercises[0].name === 'Penkkipunnerrus' && saved.days[1].exercises[0].id !== 'ex-1', '15 edit-tallennus: 3 päivää, uudet id:t');

  console.log('=== 16 a11y (axe)');
  await seed(page, PROGRAM);
  await openBuilderFromSettings(page);
  const axeSrc = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  await page.addScriptTag({ content: axeSrc });
  const axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
  ok(axe.filter(v => v.indexOf('color-contrast') !== 0).length === 0, '16 axe: ' + JSON.stringify(axe));
  const a11y = await page.evaluate(() => ({ pressed: [...document.querySelectorAll('[data-setup-days]')].every(b => b.hasAttribute('aria-pressed')), labels: [...document.querySelectorAll('[data-setup-weeks]')].every(b => b.getAttribute('aria-label')), copy: document.querySelector('[data-setup-copy-current]').tagName, group: document.querySelector('.builder-days').getAttribute('role') + '|' + document.querySelector('.builder-days').getAttribute('aria-label') }));
  ok(a11y.pressed && a11y.labels && a11y.copy === 'BUTTON' && a11y.group === 'group|Treenipäiviä viikossa', '16 aria: ' + JSON.stringify(a11y));
  await page.setViewportSize({ width: 360, height: 780 }); await w(300);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360), '360 px: ei vaakavieritystä');

  ok(errors.length === 0, 'ei sivuvirheitä: ' + errors.join('; '));
  await browser.close();
  console.log(fails ? ('FAILS: ' + fails) : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
