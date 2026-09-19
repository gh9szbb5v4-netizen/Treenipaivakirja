// Rakentaja-kehote 3: muokkaustilan tasoittainen navigointi (0.4.21).
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function pex(id, name, extra){ return Object.assign({ id, name, sets: '3', reps: '8', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }, extra || {}); }
function day(id, label, week, exs){ return { id, label, name: (week ? 'Viikko ' + week + ' · ' : '') + label, week, exercises: exs }; }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1','2'], weekLabels: {}, days: [
  day('d1','Päivä 1','1',[pex('ex-1','Penkkipunnerrus'), pex('ex-2','Kulmasoutu'), pex('ex-3','Kyykky')]),
  day('d2','Päivä 2','1',[pex('ex-4','Penkkipunnerrus'), pex('ex-5','Kulmasoutu'), pex('ex-6','Kyykky')]),
  day('d3','Päivä 3','1',[pex('ex-7','Penkkipunnerrus'), pex('ex-8','Kulmasoutu'), pex('ex-9','Kyykky')]),
  day('d4','Päivä 1','2',[]), day('d5','Päivä 2','2',[]), day('d6','Päivä 3','2',[]) ] };
const WEEKLESS = { id: 'prog-2', name: 'Viikoton', weeks: [], weekLabels: {}, days: [ day('w1','Päivä 1',null,[pex('a1','Kyykky')]), day('w2','Päivä 2',null,[pex('a2','Kulmasoutu')]) ] };
const w = ms => new Promise(r => setTimeout(r, ms));
async function seed(page, prog, extra){
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ prog, extra }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:rest-timer-enabled', '0');
    if(prog) localStorage.setItem('treenipk:workout-program', JSON.stringify(prog));
    Object.keys(extra || {}).forEach(k => localStorage.setItem('treenipk:' + k, extra[k]));
  }, { prog, extra });
  await page.goto(URL); await page.waitForTimeout(400);
}
const info = page => page.evaluate(() => {
  const q = s => document.querySelector(s);
  const head = q('.screen-head');
  return {
    header: (q('header') || {}).innerHTML || '',
    headerTitle: q('header .header') ? q('header .header').textContent.trim() : null,
    head: head ? { id: head.id, tabindex: head.getAttribute('tabindex'), aria: head.getAttribute('aria-label'), back: head.querySelector('[data-edit-back]') ? head.querySelector('[data-edit-back]').getAttribute('aria-label') : null,
      kicker: (head.querySelector('.screen-kicker') || {}).textContent, input: head.querySelector('input') ? { attr: head.querySelector('input').dataset.editorWeekName !== undefined ? 'week' : (head.querySelector('input').dataset.editorDayName !== undefined ? 'day' : 'other'), value: head.querySelector('input').value, ph: head.querySelector('input').placeholder } : null,
      menu: !!head.querySelector('[data-edit-level-menu]') } : null,
    rootCard: q('.editor-root-card') ? { id: q('.editor-root-card').id, kicker: q('.editor-root-card .editor-form-kicker').textContent, counts: q('.editor-root-card .exercise-target').textContent, restart: !!q('.editor-root-card [data-edit-restart="program"]') } : null,
    headings: [...document.querySelectorAll('.day-heading')].map(h => h.textContent),
    rows: [...document.querySelectorAll('.editor-row')].map(r => ({ main: r.querySelector('.editor-row-main').tagName, open: r.querySelector('[data-edit-open-week]') ? 'week:' + r.querySelector('[data-edit-open-week]').dataset.editOpenWeek : (r.querySelector('[data-edit-open-day]') ? 'day:' + r.querySelector('[data-edit-open-day]').dataset.editOpenDay : (r.querySelector('[data-edit-exercise]') ? 'ex:' + r.querySelector('[data-edit-exercise]').dataset.editExercise : '?')),
      ring: r.querySelector('.editor-row-ring') ? r.querySelector('.editor-row-ring').firstChild.textContent + '|' + (r.querySelector('.editor-row-ring').classList.contains('filled') ? 'filled' : 'ring') : null,
      name: r.querySelector('.editor-row-name').textContent.trim(), sub: (r.querySelector('.editor-row-sub') || {}).textContent, review: !!r.querySelector('.editor-row-sub .review'), needs: r.classList.contains('needs-review'),
      arrows: [...r.querySelectorAll('[data-edit-move]')].map(b => b.getAttribute('aria-label')), width: Math.round(r.getBoundingClientRect().width) })),
    actions: [...document.querySelectorAll('.editor-level-actions button, .builder-replicate button')].map(b => b.textContent.trim() + '|' + Math.round(b.getBoundingClientRect().height)),
    replicate: !!q('.builder-replicate'),
    menuItems: [...document.querySelectorAll('.editor-level-menu button')].map(b => b.textContent.trim()),
    bar: [...document.querySelectorAll('.edit-bar button')].map(b => b.textContent),
    form: q('.editor-form') ? { kicker: q('.editor-form .editor-form-kicker').textContent, buttons: [...q('.editor-form').querySelectorAll('.editor-form-actions button')].map(b => b.textContent.trim()), del: !!q('.editor-form [data-edit-delete]') } : null,
    sheet: !!q('#liike-haku'), keypad: !!q('#keypad'),
    focusId: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null,
    scrollY: window.scrollY, docW: document.documentElement.scrollWidth, vw: window.innerWidth,
  };
});
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('treenipk:workout-program')));
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('=== 1 Muokkaa ohjelmaa → viikkotaso');
  await seed(page, PROGRAM);
  await page.click('[data-edit-program]'); await w(600);
  let i = await info(page);
  ok(i.header === '' && i.head && i.head.back === 'Takaisin ohjelmaan' && i.head.kicker === 'Ohjelma › Viikko 1' && i.head.input && i.head.input.attr === 'week' && i.head.input.ph === 'Viikko 1' && i.head.menu, '1 header tyhjä, otsikkorivi: ' + JSON.stringify(i.head));
  ok(i.rows.length === 3 && i.rows.every(r => r.main === 'BUTTON' && r.open.indexOf('day:') === 0 && r.ring.indexOf('filled') !== -1) && i.rows.map(r => r.name).join(',') === 'Päivä 1,Päivä 2,Päivä 3' && i.rows[0].sub === '3 liikettä' && i.rows[0].width >= 340, '1 kolme päiväriviä koko leveydellä, renkaat vihreät: ' + JSON.stringify(i.rows.map(r => [r.ring, r.sub, r.width])));
  ok(i.actions.join(';') === 'Päivä|40' && i.bar.join('|') === 'Peruuta|Valmis', '1 + Päivä ja edit-bar: ' + i.actions.join(';'));
  ok(i.head.id === 'editor-title' && i.head.tabindex === '-1' && i.focusId === 'editor-title', '16/3 otsikkorivi fokusoitu: ' + i.focusId);
  ok(i.rows[0].arrows.join(',') === 'Siirrä ylös,Siirrä alas', '16 nuolilla aria-label');

  console.log('=== 2 Takaisin → juuri');
  await page.click('[data-edit-back]'); await w(500);
  i = await info(page);
  ok(i.headerTitle && i.headerTitle.indexOf('Muokkaa ohjelmaa') !== -1 && !i.head && i.rootCard && i.rootCard.id === 'editor-title' && i.rootCard.kicker === 'Muokkaa ohjelmaa' && i.rootCard.counts === '2 viikkoa · 3 treenipäivää viikossa · 9 liikettä' && i.rootCard.restart, '2 juuri: logorivi, ohjelman kortti: ' + JSON.stringify(i.rootCard));
  ok(i.rows.length === 2 && i.rows[0].open === 'week:1' && i.rows[0].name === 'Viikko 1' && i.rows[0].sub === '3 päivää · 9 liikettä' && i.rows[0].ring === '1|filled' && i.rows[1].sub === '3 päivää · ei liikkeitä' && i.rows[1].ring === '2|ring', '2 viikkorivit: ' + JSON.stringify(i.rows.map(r => [r.name, r.sub, r.ring])));
  ok(i.replicate && i.actions.map(a => a.split('|')[0]).join(';') === 'Monista;Tyhjä viikko;Kopioi viimeinen viikko' && i.headings.join() === 'Viikot' && i.focusId === 'editor-title', '2 monistuskortti ja painikkeet: ' + i.actions.join(';'));

  console.log('=== 3 Viikko 1 › Päivä 2');
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.click('[data-edit-open-week="1"]'); await w(500);
  await page.click('[data-edit-open-day="d2"]'); await w(500);
  i = await info(page);
  ok(i.header === '' && i.head.kicker === 'Viikko 1 › Päivä 2' && i.head.input.attr === 'day' && i.head.input.value === 'Päivä 2' && i.head.back === 'Takaisin viikkoon' && i.head.aria === 'Viikko 1 · Päivä 2', '3 päivätaso: ' + JSON.stringify(i.head));
  ok(i.rows.length === 3 && i.rows[0].open === 'ex:ex-4' && i.rows[0].name.indexOf('Penkkipunnerrus') === 0 && i.rows[0].sub.indexOf('3 × 8') === 0 && i.rows[0].arrows.length === 2 && i.rows[0].ring === null, '3 liikerivit: ' + JSON.stringify(i.rows.map(r => [r.name, r.sub])));
  ok(i.actions.join(';') === 'Lisää liike|40' && i.focusId === 'editor-title' && i.scrollY === 0, '3 + Lisää liike, fokus, scrollY 0: ' + i.scrollY);

  console.log('=== 4 liikerivin napautus → lomake');
  await page.click('[data-edit-exercise="ex-5"]'); await w(400);
  i = await info(page);
  ok(i.form && i.form.kicker === 'Muokkaa liikettä' && i.form.buttons.join('|') === 'Peruuta|Poista|Tallenna' && i.form.del, '4 lomake rivin alla: ' + JSON.stringify(i.form));
  const formAfterRow = await page.evaluate(() => { const r = document.querySelector('[data-edit-exercise="ex-5"]').closest('.editor-row'); const f = document.querySelector('.editor-form'); return !!(r.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(f.compareDocumentPosition(document.querySelector('[data-edit-exercise="ex-6"]')) & Node.DOCUMENT_POSITION_FOLLOWING); });
  ok(formAfterRow, '4 lomake rivin ex-5 ja ex-6 välissä');
  await page.click('.editor-form [data-edit-delete]'); await w(300);
  let delTxt = await page.evaluate(() => document.querySelector('.editor-form [data-edit-delete]').textContent.trim());
  ok(delTxt === 'Vahvista', '4 kaksivaiheinen vahvistus: ' + delTxt);
  await page.click('.editor-form [data-edit-delete]'); await w(400);
  i = await info(page);
  ok(!i.form && i.rows.length === 2 && i.rows.map(r => r.open).join() === 'ex:ex-4,ex:ex-6', '4 liike poistettu: ' + i.rows.map(r => r.open).join());

  console.log('=== 12 näppäimistö auki, takaisin');
  await page.click('[data-edit-exercise="ex-4"]'); await w(400);
  await page.click('[data-editor-field="sets"]'); await w(400);
  i = await info(page);
  ok(i.keypad && i.form, '12 näppäimistö ja lomake auki');
  await page.click('[data-edit-back]'); await w(500);
  i = await info(page);
  ok(!i.keypad && !i.form && i.head.kicker === 'Ohjelma › Viikko 1', '12 takaisin sulkee näppäimistön ja lomakkeen');

  console.log('=== 11 nimikenttä otsikkorivissä');
  await page.fill('.screen-head [data-editor-week-name]', 'Kevennys'); await w(200);
  const stillWeek = await page.evaluate(() => document.querySelector('.screen-head [data-editor-week-name]').value);
  ok(stillWeek === 'Kevennys', '11 kenttä ei piirry uudelleen (arvo säilyy)');
  await page.click('[data-edit-open-day="d2"]'); await w(400);
  await page.fill('.screen-head [data-editor-day-name]', 'Ylävartalo'); await w(200);
  await page.click('[data-edit-back]'); await w(400);
  i = await info(page);
  ok(i.head.input.value === 'Kevennys' && i.rows[1].name === 'Ylävartalo', '11 viikon ja päivän nimet luonnoksessa: ' + i.head.input.value + ' / ' + i.rows[1].name);

  console.log('=== 5 päivätason ⋮ → Poista päivä');
  await page.click('[data-edit-open-day="d3"]'); await w(400);
  await page.click('[data-edit-level-menu]'); await w(300);
  i = await info(page);
  ok(i.menuItems.join('|') === 'Kopioi päivä|Aloita uudelleen|Poista päivä', '5 päivän valikko: ' + i.menuItems.join('|'));
  await page.click('.editor-level-menu [data-edit-delete]'); await w(300);
  await page.click('.editor-level-menu [data-edit-delete]'); await w(500);
  i = await info(page);
  ok(i.head.kicker === 'Ohjelma › Viikko 1' && i.rows.length === 2 && i.rows.map(r => r.open).join() === 'day:d1,day:d2', '5 paluu viikolle, 2 päivää: ' + JSON.stringify([i.head.kicker, i.rows.map(r => r.open)]));

  console.log('=== 6 viikkotason ⋮ → Kopioi viikko');
  await page.click('[data-edit-level-menu]'); await w(300);
  i = await info(page);
  ok(i.menuItems.join('|') === 'Kopioi viikko|Aloita uudelleen|Poista viikko', '6 viikon valikko (edit): ' + i.menuItems.join('|'));
  await page.click('.editor-level-menu [data-edit-copy]'); await w(500);
  i = await info(page);
  ok(i.head.kicker === 'Ohjelma › Viikko 3' && i.rows.length === 2 && i.head.input.value === '' && i.head.input.ph === 'Viikko 3', '6 kopio avautuu viikkona 3: ' + JSON.stringify(i.head));
  await page.click('[data-edit-back]'); await w(400);
  i = await info(page);
  ok(i.rows.length === 3 && i.rows.map(r => r.name).join(',') === 'Kevennys,Viikko 3,Viikko 2', '6 juuressa 3 viikkoriviä (kopio heti lähteen jälkeen): ' + i.rows.map(r => r.name).join(','));

  console.log('=== 7 + Päivä viikolla 2');
  await page.click('[data-edit-open-week="2"]'); await w(400);
  await page.click('[data-edit-add-day="2"]'); await w(500);
  i = await info(page);
  ok(i.head.kicker === 'Viikko 2 › Päivä 4' && i.head.input.attr === 'day' && i.head.input.value === 'Päivä 4' && i.rows.length === 0 && i.actions.join(';') === 'Lisää liike|40', '7 uusi päivä avautuu: ' + JSON.stringify(i.head));

  console.log('=== 13/14 Valmis päivätasolta ja Peruuta muutoksin');
  await page.click('[data-edit-cancel]'); await w(300);
  let bar = await page.evaluate(() => [...document.querySelectorAll('.edit-bar button')].map(b => b.textContent).join('|'));
  ok(bar === 'Hylkää muutokset?|Valmis', '14 Peruuta vaatii vahvistuksen: ' + bar);
  await page.click('[data-edit-done]'); await w(600);
  const s1 = await saved(page);
  ok(!(await page.$('.edit-bar')) && s1.weeks.join() === '1,3,2' && s1.weekLabels['1'] === 'Kevennys' && s1.days.filter(d => d.week === '1').length === 2 && s1.days.filter(d => d.week === '2').length === 4 && s1.days.filter(d => d.week === '1')[1].label === 'Ylävartalo', '13 Valmis päivätasolta tallentaa: ' + JSON.stringify([s1.weeks, s1.weekLabels, s1.days.map(d => d.week + '/' + d.label)]));

  console.log('=== 14b Peruuta → paluu returnView-näkymään');
  await page.click('.tab[data-tab="asetukset"]'); await w(300);
  await page.click('.settings-row[data-settings-section="ohjelma"]'); await w(300);
  await page.click('[data-builder-start]'); await w(400);
  await page.fill('[data-editor-program-name]', 'X'); await w(100);
  await page.click('[data-edit-cancel]'); await w(300); await page.click('[data-edit-cancel]'); await w(500);
  const tabNow = await page.evaluate(() => document.querySelector('.tab.active').textContent);
  ok(tabNow === 'Asetukset' && !(await page.$('.edit-bar')), '14 paluu Asetuksiin: ' + tabNow);

  console.log('=== 8 viikoton ohjelma');
  await seed(page, WEEKLESS);
  await page.click('[data-edit-program]'); await w(600);
  i = await info(page);
  ok(!i.head && i.rootCard && i.headings.join() === 'Treenipäivät' && i.rows.length === 2 && i.rows[0].open === 'day:w1' && i.actions.join(';') === 'Päivä|40' && i.rootCard.counts === '2 treenipäivää · 2 liikettä', '8 juuri näyttää Treenipäivät: ' + JSON.stringify([i.headings, i.rows.map(r => r.open), i.actions]));
  await page.click('[data-edit-open-day="w2"]'); await w(500);
  i = await info(page);
  ok(i.head.kicker === 'Päivä 2' && i.head.back === 'Takaisin ohjelmaan' && i.head.aria === 'Päivä 2', '8 päivätason kicker Päivä 2: ' + JSON.stringify(i.head));
  await page.click('[data-edit-back]'); await w(400);
  i = await info(page);
  ok(!i.head && i.rootCard, '8 takaisin → juuri');
  await page.click('[data-edit-cancel]'); await w(400);

  console.log('=== 9 tuontitila');
  await seed(page, null);
  await page.evaluate(() => { localStorage.setItem('treenipk:workout-program', JSON.stringify({ id: 'p', name: 'X', weeks: ['1','2'], weekLabels: {}, days: [
    { id: 'i1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [{ id: 'e1', name: 'Penkkipunnerrus', sets: '', reps: '', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true, needsReview: 'sarjat puuttuvat', rawTarget: '3x?' }, { id: 'e2', name: 'Kyykky', sets: '3', reps: '5', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true, needsReview: 'toistot puuttuvat' }] },
    { id: 'i2', label: 'Päivä 1', name: 'Viikko 2 · Päivä 1', week: '2', exercises: [{ id: 'e3', name: 'Kyykky', sets: '3', reps: '5', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }] } ] })); });
  await page.goto(URL); await w(400);
  // Tuontitila ei ole käynnistettävissä ilman PDF:ää; simuloidaan startProgramImport-polku
  // valitsemalla PDF-tiedosto ei onnistu offline → testataan import-riveihin liittyvä
  // esitys edit-tilassa: reviewSub näkyy vain import-tilassa, joten tarkistetaan että
  // edit-tilassa sitä EI näy ja needsReview-rivi korostuu päivätasolla.
  await page.click('[data-edit-program]'); await w(600);
  await page.click('[data-edit-back]'); await w(400);
  i = await info(page);
  ok(i.rows.length === 2 && !i.rows[0].review, '9 edit-tilassa ei tarkistettavana-tekstiä (vain import): ' + i.rows[0].sub);
  await page.click('[data-edit-open-week="1"]'); await w(400);
  await page.click('[data-edit-open-day="i1"]'); await w(400);
  i = await info(page);
  ok(i.rows.length === 2 && i.rows[0].needs && i.rows[0].review && i.rows[0].sub.indexOf('Tarkista: sarjat puuttuvat') === 0, '9 päivätasolla needsReview-rivi korostettu: ' + JSON.stringify(i.rows[0]));
  // Aloita uudelleen edit-tilassa
  await page.click('[data-edit-level-menu]'); await w(300);
  i = await info(page);
  ok(i.menuItems.indexOf('Aloita uudelleen') !== -1, '9 edit: Aloita uudelleen valikossa');
  await page.click('[data-edit-cancel]'); await w(400);

  console.log('=== 10 rakentaja: kysely → Jatka');
  await page.click('.tab[data-tab="asetukset"]'); await w(300);
  await page.click('.settings-row[data-settings-section="ohjelma"]'); await w(300);
  await page.click('[data-builder-start]'); await w(400);
  await page.click('[data-setup-continue]'); await w(600);
  i = await info(page);
  ok(i.head && i.head.kicker === 'Viikko 1 › Päivä 1' && i.form && i.form.kicker === 'Liike 1' && i.sheet, '10 suoraan viikon 1 päivään 1, lomake ja valitsin auki: ' + JSON.stringify([i.head && i.head.kicker, i.form, i.sheet]));
  await page.keyboard.press('Escape'); await w(300);
  await page.click('[data-edit-back]'); await w(400);
  await page.click('[data-edit-level-menu]'); await w(300);
  i = await info(page);
  ok(i.menuItems.join('|') === 'Kopioi viikko|Poista viikko', '13 new: ei Aloita uudelleen: ' + i.menuItems.join('|'));
  await page.click('[data-edit-back]'); await w(400);
  i = await info(page);
  ok(i.rootCard && i.rootCard.kicker === 'Rakenna ohjelma' && i.rootCard.counts === '4 viikkoa · 3 treenipäivää viikossa · 0 liikettä' && !i.rootCard.restart && i.rows.length === 4, '10 juuri rakentajassa: ' + JSON.stringify(i.rootCard));
  await page.click('[data-edit-cancel]'); await w(400);

  console.log('=== 15 regressio: grep');
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const hits = html.split('\n').filter(l => /openWeeks|openDays|menuFor|editor-children|data-edit-menu/.test(l));
  ok(hits.length === 0, '15 grep → 0 osumaa: ' + hits.length);

  console.log('=== 16 a11y');
  await seed(page, PROGRAM);
  await page.click('[data-edit-program]'); await w(600);
  const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  await page.addScriptTag({ content: axeSrc });
  let axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
  ok(axe.filter(v => v.indexOf('color-contrast') !== 0).length === 0, '16 axe viikkotaso: ' + JSON.stringify(axe));
  await page.click('[data-edit-open-day="d1"]'); await w(400);
  await page.addScriptTag({ content: axeSrc });
  axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa'] }); return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')); });
  ok(axe.filter(v => v.indexOf('color-contrast') !== 0).length === 0, '16 axe päivätaso: ' + JSON.stringify(axe));
  const sr = await page.evaluate(() => [...document.querySelectorAll('.editor-row-ring.filled .sr-only')].map(s => s.textContent));
  await page.click('[data-edit-back]'); await w(400);
  const sr2 = await page.evaluate(() => [...document.querySelectorAll('.editor-row-ring.filled .sr-only')].map(s => s.textContent));
  ok(sr2.length === 3 && sr2[0] === ' liikkeitä lisätty', '16 renkaan sr-only-teksti: ' + JSON.stringify(sr2));
  await page.setViewportSize({ width: 360, height: 780 }); await w(300);
  i = await info(page);
  ok(i.docW <= 360, '360 px: ei vaakavieritystä');
  await page.screenshot({ path: require('path').join(__dirname, 'rak3_week.png'), fullPage: true });
  await page.click('[data-edit-back]'); await w(400); await page.screenshot({ path: require('path').join(__dirname, 'rak3_root.png'), fullPage: true });
  await page.click('[data-edit-open-week="1"]'); await w(400); await page.click('[data-edit-open-day="d1"]'); await w(400); await page.screenshot({ path: require('path').join(__dirname, 'rak3_day.png'), fullPage: true });

  ok(errors.length === 0, 'ei sivuvirheitä: ' + errors.join('; '));
  await browser.close();
  console.log(fails ? ('FAILS: ' + fails) : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
