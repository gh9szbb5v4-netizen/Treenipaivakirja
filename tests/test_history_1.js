// Historia-kehote 1: kuukausiryhmittely ja tiiviimpi päiväkortti.
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const nb = s => s == null ? s : String(s).replace(/[  ]/g, ' ');
function pex(id, name){ return { id, name, sets: '3', reps: '10', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }; }
function program(weekLabels, noWeeks){
  const w = k => noWeeks ? null : k;
  return { id: 'prog-1', name: 'Testi', weeks: noWeeks ? [] : ['1','2','3'], weekLabels: weekLabels || {}, days: [
    { id: 'd1', label: 'Päivä 1', name: 'Viikko 3 · Päivä 1', week: w('3'), exercises: [pex('A1','Kyykky'), pex('A2','Penkki')] },
    { id: 'd2', label: 'Päivä 2', name: 'Viikko 3 · Päivä 2', week: w('3'), exercises: [pex('B1','Maastaveto'), pex('B2','Soutu'), pex('B3','Pystypunnerrus'), pex('B4','Leuanveto'), pex('B5','Dippi')] } ] };
}
const set = (w, r) => ({ weight: w, reps: r, done: true });
function entries(){
  return [
    // 5 liikettä, 6 420 kg: 100×10×3 + 60×10×3 + 40×10×3 + 0 + 14×10×3 → 3000+1800+1200+420 = 6420
    { date: '2026-09-14', exercises: { B1: { name: 'Maastaveto', sets: [set(100,10),set(100,10),set(100,10)], deload: true }, B2: { name: 'Soutu', sets: [set(60,10),set(60,10),set(60,10)] }, B3: { name: 'Pystypunnerrus', sets: [set(40,10),set(40,10),set(40,10)] }, B4: { name: 'Leuanveto', sets: [set('',10)] }, B5: { name: 'Dippi', sets: [set(14,10),set(14,10),set(14,10)] } } },
    { date: '2026-09-12', exercises: { A1: { name: 'Kyykky', sets: [set(80,5)], editedAt: '2026-09-13T10:00:00' }, A2: { name: 'Penkki', sets: [set(60,5)] } } },
    { date: '2026-09-08', exercises: { B1: { name: 'Maastaveto', sets: [set(90,10)] } } },
    { date: '2026-08-29', exercises: { A1: { name: 'Kyykky', sets: [set(75,5)] } } },
    { date: '2026-08-27', exercises: { 'old-1': { name: 'Kyykky', sets: [set(70,5)] }, 'old-2': { name: 'Penkki', sets: [set(50,5)] } } },
  ];
}
async function load(page, prog){
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ prog, ents }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(prog));
    ents.forEach(e => localStorage.setItem('treenipk:entries:' + e.date, JSON.stringify(e)));
  }, { prog, ents: entries() });
  await page.goto(URL); await page.waitForSelector('.bottom-nav');
  await page.click('.tab[data-tab="historia"]'); await page.waitForSelector('#history-list'); await page.waitForTimeout(400);
}
const snap = page => page.evaluate(() => ({
  seq: [...document.querySelectorAll('#history-list > *')].map(e => e.tagName === 'H3' ? 'H3:' + e.textContent + ':' + e.className : 'card'),
  cards: [...document.querySelectorAll('.history-date')].map(c => {
    const h = c.querySelector('.history-date-head');
    return { date: h.dataset.date, day: h.querySelector('.history-date-day').textContent, label: h.querySelector('.history-date-day').getAttribute('aria-label'),
      ctx: (h.querySelector('.history-date-ctx') || {}).textContent || null, badges: [...h.querySelectorAll('.history-badge')].map(b => b.textContent + '|' + b.className),
      sub: (h.querySelector('.history-date-sub') || {}).textContent || null, h: Math.round(h.getBoundingClientRect().height), styles: h.outerHTML.indexOf('style=') !== -1,
      chevOn: !!h.querySelector('.chevron.on'), expanded: h.getAttribute('aria-expanded') };
  }),
}));
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  await load(page, program());
  let s = await snap(page);
  console.log('1 järjestys');
  ok(s.seq.join(',') === 'H3:Syyskuu 2026:day-heading history-month,card,card,card,H3:Elokuu 2026:day-heading history-month,card,card', s.seq.join(','));
  console.log('2 kortti 14.9.');
  const c = s.cards[0];
  ok(c.day === 'Ma 14.9.' && c.label === 'Maanantai 14. syyskuuta' && c.ctx === 'Viikko 3 · Päivä 2', JSON.stringify([c.day, c.label, c.ctx]));
  ok(c.badges.length === 1 && c.badges[0] === 'kevennys|chip history-badge history-badge-deload' && nb(c.sub) === '5 liikettä · 6 420 kg', JSON.stringify([c.badges, nb(c.sub)]));
  console.log('3 kortti 12.9.');
  ok(s.cards[1].badges.length === 1 && s.cards[1].badges[0].indexOf('korjattu|chip history-badge') === 0 && s.cards[1].ctx === 'Viikko 3 · Päivä 1', JSON.stringify([s.cards[1].badges, s.cards[1].ctx]));
  console.log('4 kortti 27.8.');
  ok(s.cards[4].date === '2026-08-27' && s.cards[4].ctx === null && s.cards[4].day === 'To 27.8.' && nb(s.cards[4].sub) === '2 liikettä · 600 kg', JSON.stringify(s.cards[4]));
  console.log('9 kosketuskohde, 11 regressio');
  ok(s.cards.every(x => x.h >= 44) && s.cards.every(x => !x.styles), 'korkeudet ' + s.cards.map(x => x.h).join(',') + ', inline-tyylejä: ' + s.cards.some(x => x.styles));
  console.log('10 ruudunlukija');
  ok(s.seq.filter(x => x.startsWith('H3:')).length === 2 && s.cards[0].label.indexOf('Maanantai') === 0 && s.cards[0].label.indexOf('syyskuuta') !== -1, 'h3-otsikot, aria-label viikonpäivä ja kuukausi');
  console.log('8 avaus ja sulkeminen');
  await page.click('.history-date-head[data-date="2026-09-14"]'); await page.waitForTimeout(500);
  const open = await page.evaluate(() => { const c = document.querySelector('.history-date'); return { chev: !!c.querySelector('.chevron.on'), exp: c.querySelector('.history-date-head').getAttribute('aria-expanded'), sets: c.querySelectorAll('.history-set').length, del: !!c.querySelector('[data-delete-history]') }; });
  ok(open.chev && open.exp === 'true' && open.sets === 13 && open.del, 'avattu: ' + JSON.stringify(open));
  await page.click('.history-date-head[data-date="2026-09-14"]'); await page.waitForTimeout(500);
  const closed = await page.evaluate(() => { const c = document.querySelector('.history-date'); return { chev: !!c.querySelector('.chevron.on'), sets: c.querySelectorAll('.history-set').length }; });
  ok(!closed.chev && closed.sets === 0, 'suljettu');
  console.log('5 viikon nimi');
  await load(page, program({ '3': 'Kevennysviikko' }));
  s = await snap(page);
  ok(s.cards[0].ctx === 'Kevennysviikko · Päivä 2', s.cards[0].ctx);
  console.log('6 ilman viikkoja');
  await load(page, program({}, true));
  s = await snap(page);
  ok(s.cards[0].ctx === 'Päivä 2', s.cards[0].ctx);
  console.log('7 apurit (DOM:n kautta)');
  // formatMonthFI/formatDateCompactFI ovat sulkeuman sisällä: tarkistetaan otsikoista ja päivistä (La 13.9. ei aineistossa → 12.9. = La)
  ok(s.cards[1].day === 'La 12.9.' && s.seq[0] === 'H3:Syyskuu 2026:day-heading history-month', 'La 12.9. ja Syyskuu 2026');
  console.log('virheet');
  ok(errors.length === 0, 'ei JS-virheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? ('\nEPÄONNISTUI: ' + fails) : '\nKAIKKI OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
