// Kehitys-kehotteet 2–5: liikelistan rivi ja sparkline, käyrä, 1RM-kortti, tabletti.
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function pex(id, name){ return { id, name, sets: '3', reps: '5', unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }; }
const PROGRAM = { id: 'prog-1', name: 'Testi', weeks: ['1'], weekLabels: {}, days: [
  { id: 'd1', label: 'Päivä 1', name: 'Viikko 1 · Päivä 1', week: '1', exercises: [pex('A','Penkkipunnerrus'), pex('B','Kyykky'), pex('C','Maastaveto'), pex('D','Alaviistopenkkipunnerrus tangolla')] } ] };
// Yhden toiston sarja = mittaus: pisteen arvo on paino sellaisenaan.
function one(name, weight, extra){ return Object.assign({ name, sets: [{ weight, reps: 1, done: true }], kind: 'plain' }, extra || {}); }
function series(id, name, pts){ // pts: [[date, value, extra]]
  return pts.map(p => ({ date: p[0], exercises: { [id]: one(name, p[1], p[2]) } }));
}
function merge(lists){ // yhdistä saman päivän merkinnät
  const byDate = {};
  lists.flat().forEach(e => { if(!byDate[e.date]) byDate[e.date] = { date: e.date, exercises: {} }; Object.assign(byDate[e.date].exercises, e.exercises); });
  return Object.values(byDate);
}
// Fixtureiden päivämäärät ovat kiinteitä ja Kehityksen vertailut (kuukausi,
// pysähtyminen, 28 päivän ikkuna) lasketaan nykyhetkestä, joten kello
// kiinnitetään testin kirjoituspäivään.
const FIXED_NOW = new Date('2026-09-15T12:00:00');
async function load(page, ents){
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ ents, PROGRAM }) => {
    localStorage.clear();
    localStorage.setItem('treenipk:koekaytto-hyvaksytty', '1');
    localStorage.setItem('treenipk:first-log-hint-dismissed', '1');
    localStorage.setItem('treenipk:workout-program', JSON.stringify(PROGRAM));
    ents.forEach(e => localStorage.setItem('treenipk:entries:' + e.date, JSON.stringify(e)));
  }, { ents, PROGRAM });
  await page.goto(URL);
  await page.waitForSelector('.bottom-nav');
  await page.waitForTimeout(300);
}
async function kehitys(page){ await page.click('.tab[data-tab="kehitys"]'); await page.waitForSelector('main .segmented, main .empty-state'); await page.waitForTimeout(500); }
async function liikkeet(page){ await page.click('[data-kehitys-front-tab="liikkeet"]'); await page.waitForTimeout(400); }
const rowInfo = (page, name) => page.evaluate((name) => {
  const row = [...document.querySelectorAll('.kehitys-row')].find(r => r.querySelector('.kehitys-row-name').textContent === name);
  if(!row) return null;
  const d = row.querySelector('.kehitys-row-delta span');
  const svg = row.querySelector('svg.kehitys-spark');
  const pl = svg ? svg.querySelector('polyline') : null;
  return { value: row.querySelector('.kehitys-row-value').textContent, delta: d ? d.textContent : null, color: d ? d.style.color : null,
    spark: !!svg, points: pl ? pl.getAttribute('points') : null, stroke: pl ? pl.getAttribute('stroke') : null, stalled: !!row.querySelector('.chip-danger'),
    sparkDisplay: svg ? getComputedStyle(svg).display : null, order: [...row.children].map(c => c.getAttribute('class') || c.tagName) };
}, name);
const NB = ' ';
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('=== Kehote 2: liikelista');
  const c1 = series('A', 'Penkkipunnerrus', [['2026-07-20',96],['2026-08-03',98],['2026-08-10',100],['2026-08-24',101],['2026-08-31',103.5],['2026-09-07',100],['2026-09-12',103.5]]);
  const c2 = series('B', 'Kyykky', [['2026-07-20',96],['2026-08-03',98],['2026-08-10',100],['2026-08-24',101],['2026-08-31',103.5],['2026-09-07',100],['2026-09-12',98]]);
  const c3 = series('C', 'Maastaveto', [['2026-09-01',100],['2026-09-10',102]]);
  const c4 = series('x4', 'Soutu', [['2026-06-01',90],['2026-09-01',100],['2026-09-10',102]]);
  const c5 = series('x5', 'Dippi', [['2026-07-20',101],['2026-08-01',99],['2026-08-24',101],['2026-09-12',99]]);
  const ten = []; for(let i=0;i<10;i++){ ten.push(['2026-0' + (i<5?'8':'9') + '-' + String((i%5)*5+1).padStart(2,'0'), 80 + i*2]); }
  const c6 = series('x6', 'Leuanveto', ten);
  const c7 = series('x7', 'Pystypunnerrus', [['2026-09-10',60]]);
  const same = []; for(let i=1;i<=8;i++) same.push(['2026-09-' + String(i).padStart(2,'0'), 100]);
  const c8 = series('x8', 'Hauiskääntö', same);
  const c9 = series('D', 'Alaviistopenkkipunnerrus tangolla', [['2026-07-01',110],['2026-07-15',108],['2026-08-01',106],['2026-08-20',104],['2026-09-10',102]]);
  await load(page, merge([c1,c2,c3,c4,c5,c6,c7,c8,c9]));
  await kehitys(page); await liikkeet(page);
  let r = await rowInfo(page, 'Penkkipunnerrus');
  ok(r.value === '103,5' + NB + 'kg' && r.delta === '+3,5 kg (+3,5 %)' && r.color === 'var(--brass)', '1: ' + JSON.stringify([r.value, r.delta, r.color]));
  ok(r.order.join(',') === 'kehitys-row-body,kehitys-spark,kehitys-row-right,choice-chevron', 'rakenne: ' + r.order.join(','));
  r = await rowInfo(page, 'Kyykky');
  ok(r.value === '103,5' + NB + 'kg' && r.delta === '+3,5 kg (+3,5 %)' && r.color === 'var(--brass)', '2 kevyt päivä: ' + JSON.stringify([r.value, r.delta]));
  r = await rowInfo(page, 'Maastaveto');
  ok(r.value === '102' + NB + 'kg' && r.delta === null, '3 ei vertailua: ' + JSON.stringify([r.value, r.delta]));
  r = await rowInfo(page, 'Soutu');
  ok(r.delta === '+12 kg (+13,3 %)', '4 varapolku: ' + r.delta);
  r = await rowInfo(page, 'Dippi');
  ok(r.delta === '0 kg (0 %)' && r.color === 'var(--mist)', '5 nolla: ' + JSON.stringify([r.delta, r.color]));
  r = await rowInfo(page, 'Leuanveto');
  const pts6 = r.points.split(' ').map(p => p.split(',').map(Number));
  ok(pts6.length === 8 && pts6[0][0] === 2 && pts6[7][0] === 62 && pts6[7][1] === 2 && pts6[0][1] === 22, '6 sparkline 8 pistettä: ' + r.points);
  r = await rowInfo(page, 'Pystypunnerrus');
  ok(!r.spark && r.delta === null, '7 yksi piste: ei svg:tä eikä muutosta');
  r = await rowInfo(page, 'Hauiskääntö');
  ok(r.points.split(' ').every(p => p.split(',')[1] === '12'), '8 vaakaviiva y=12: ' + r.points);
  r = await rowInfo(page, 'Alaviistopenkkipunnerrus tangolla');
  ok(r.stalled && r.stroke === 'var(--mist)', '9 pysähtynyt: mist ' + JSON.stringify([r.stalled, r.stroke]));
  await page.setViewportSize({ width: 360, height: 800 }); await page.waitForTimeout(300);
  r = await rowInfo(page, 'Penkkipunnerrus');
  ok(r.sparkDisplay === 'none' && r.value === '103,5' + NB + 'kg' && r.delta === '+3,5 kg (+3,5 %)', '10 360 px: spark piilossa');
  await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(300);
  await page.focus('[data-kehitys-filter]'); await page.keyboard.type('Kyy'); await page.waitForTimeout(300);
  const f = await page.evaluate(() => ({ rows: document.querySelectorAll('#kehitys-list .kehitys-row').length, spark: document.querySelectorAll('#kehitys-list svg.kehitys-spark').length, focused: document.activeElement === document.querySelector('[data-kehitys-filter]') }));
  ok(f.rows === 1 && f.spark === 1 && f.focused, '11 haku: ' + JSON.stringify(f));
  await page.fill('[data-kehitys-filter]', ''); await page.waitForTimeout(200);

  console.log('=== Kehote 3: käyrä');
  const k3 = series('A', 'Penkkipunnerrus', [['2026-06-15',96],['2026-07-06',98],['2026-07-27',100,{deload:true}],['2026-08-17',101],['2026-08-31',103.5],['2026-09-12',106]]);
  const k4 = series('B', 'Kyykky', [['2026-05-01',90],['2026-05-20',92]]);
  const k11 = series('C', 'Maastaveto', [['2026-09-10',140]]);
  const twenty = []; for(let i=0;i<20;i++){ const d = new Date('2026-08-01T00:00:00'); d.setDate(d.getDate()+i*2); twenty.push([d.toISOString().slice(0,10), 60 + i]); }
  const k12 = series('x12', 'Soutu', twenty);
  await load(page, merge([k3,k4,k11,k12]));
  await kehitys(page); await liikkeet(page);
  const openRow = async (name) => { await page.click('.kehitys-row:has(.kehitys-row-name:text-is("' + name + '"))'); await page.waitForTimeout(600); };
  await openRow('Penkkipunnerrus');
  const chart = () => page.evaluate(() => {
    const c = document.querySelector('.kehitys-card .chart'); if(!c) return { empty: !!document.querySelector('.chart-empty'), emptyText: (document.querySelector('.chart-empty')||{}).textContent };
    const svg = c.querySelector('svg');
    return { hits: c.querySelectorAll('rect.chart-hit').length, x: [...c.querySelectorAll('.chart-x span')].map(s => s.textContent), single: !!c.querySelector('.chart-x.single'),
      gridVals: [...svg.querySelectorAll('text')].filter(t => t.getAttribute('x') === '34').map(t => t.textContent), lines: svg.querySelectorAll('line[x1="40"]').length,
      caption: c.querySelector('.chart-caption').textContent, capRole: c.querySelector('.chart-caption').getAttribute('role'), capLive: c.querySelector('.chart-caption').getAttribute('aria-live'),
      markers: [...svg.querySelectorAll('line[y1="8"]')].map(l => l.getAttribute('x1')), markerText: [...svg.querySelectorAll('text[y="6"]')].map(t => t.textContent),
      circles: svg.querySelectorAll('circle:not(.chart-dot-on)').length, dotOn: svg.querySelectorAll('.chart-dot-on').length, role: svg.getAttribute('role'), label: svg.getAttribute('aria-label'),
      hitsHidden: [...c.querySelectorAll('rect.chart-hit')].every(r => r.getAttribute('aria-hidden') === 'true'), legend: !!c.parentElement.querySelector('.chart-legend'),
      hit0: c.querySelector('rect.chart-hit') ? { x: c.querySelector('rect.chart-hit').getAttribute('x'), w: c.querySelector('rect.chart-hit').getAttribute('width') } : null,
      range: [...document.querySelectorAll('.kehitys-card [data-kehitys-range]')].map(b => b.dataset.kehitysRange + ':' + b.classList.contains('on')) };
  });
  let ch = await chart();
  ok(ch.hits === 6 && ch.x.join('|') === '15.6.|29.7.|12.9.', '1 kaikki: ' + JSON.stringify([ch.hits, ch.x]));
  ok(ch.gridVals.join(',') === '106,101,96' && ch.lines === 3, '1 apuviivat: ' + JSON.stringify([ch.gridVals, ch.lines]));
  ok(ch.markers.length === 1 && ch.markerText.join() === 'kevennys', '5 kevennysmerkki: ' + JSON.stringify([ch.markers, ch.markerText]));
  ok(ch.caption === '12.9. · 106 kg mitattu (106' + NB + 'kg × 1) · paras 4 vk 106 kg', '6 oletusselite: ' + ch.caption);
  ok(ch.role === 'img' && ch.label.indexOf('15.6.–12.9.') !== -1 && ch.capRole === 'status' && ch.capLive === 'polite' && ch.hitsHidden && ch.legend, '13 ruudunlukija ja legenda');
  // 7–8 napautus ilman render()-kutsua
  await page.evaluate(() => document.querySelector('main').setAttribute('data-marker', 'x'));
  await page.click('.kehitys-card rect.chart-hit >> nth=4'); await page.waitForTimeout(200);
  ch = await chart();
  const marker = await page.evaluate(() => document.querySelector('main').getAttribute('data-marker'));
  ok(ch.caption === '31.8. · 103,5 kg mitattu (103,5' + NB + 'kg × 1) · paras 4 vk 103,5 kg' && ch.dotOn === 1 && marker === 'x', '7 napautus: ' + ch.caption + ' dotOn=' + ch.dotOn + ' render=' + (marker !== 'x'));
  await page.click('.kehitys-card rect.chart-hit >> nth=1'); await page.waitForTimeout(200);
  ch = await chart();
  ok(ch.caption.indexOf('6.7. · 98 kg') === 0 && ch.dotOn === 1, '8 toinen piste: ' + ch.caption + ' dotOn=' + ch.dotOn);
  // 2 4vk
  await page.click('.kehitys-card [data-kehitys-range="4vk"]'); await page.waitForTimeout(400);
  ch = await chart();
  ok(ch.hits === 2 && ch.x.join('|') === '31.8.|6.9.|12.9.' && ch.markers.length === 0, '2 4vk: ' + JSON.stringify([ch.hits, ch.x, ch.markers]));
  await page.click('.kehitys-card [data-kehitys-range="3kk"]'); await page.waitForTimeout(400);
  ch = await chart();
  ok(ch.hits === 5 && ch.x[0] === '6.7.', '3 3kk: ' + JSON.stringify([ch.hits, ch.x]));
  // 9 yhteinen tila etusivulla
  await page.click('.kehitys-card [data-kehitys-range="4vk"]'); await page.waitForTimeout(300);
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(800);
  await page.click('[data-kehitys-front-tab="yhteenveto"]'); await page.waitForTimeout(400);
  const vol = await page.evaluate(() => ({ on: [...document.querySelectorAll('[data-kehitys-range]')].filter(b => b.classList.contains('on')).map(b => b.dataset.kehitysRange), caption: (document.querySelector('.chart-caption')||{}).textContent, legend: !!document.querySelector('.chart-legend'), scale: !!document.querySelector('[data-volume-scale]') }));
  ok(vol.on.join() === '4vk' && vol.scale, '9 etusivun käyrä samalla aikavälillä: ' + JSON.stringify(vol));
  ok(/^\d+\.\d+\. · \d+ kg$/.test(vol.caption) && !vol.legend, '10 volyymiselite ilman legendaa: ' + vol.caption);
  await page.click('[data-volume-scale="paiva"]'); await page.waitForTimeout(300);
  ok((await page.evaluate(() => document.querySelectorAll('.chart rect.chart-hit').length)) > 0, '9 Viikko|Päivä toimii aikavälin sisällä');
  await page.click('[data-kehitys-range="1v"]'); await page.waitForTimeout(300);
  // 4 vanha liike
  await liikkeet(page); await openRow('Kyykky');
  ch = await chart();
  ok(ch.hits === 2 && ch.range.join() === '4vk:false,3kk:false,1v:true,kaikki:false', '4 1v: käyrä ' + JSON.stringify([ch.hits, ch.range]));
  await page.click('.kehitys-card [data-kehitys-range="4vk"]'); await page.waitForTimeout(400);
  ch = await chart();
  ok(ch.empty && ch.emptyText === 'Ei merkintöjä valitulla aikavälillä.' && (await page.$('.kehitys-card [data-kehitys-range]')), '4 4vk: tyhjä, valitsin näkyy');
  await page.click('.kehitys-card [data-kehitys-range="kaikki"]'); await page.waitForTimeout(300);
  // 11 yksi piste
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(800); await openRow('Maastaveto');
  ch = await chart();
  ok(ch.single && ch.x.length === 1 && ch.lines === 1 && ch.hits === 1 && ch.hit0.x === '40' && ch.hit0.w === '270', '11 yksi piste: ' + JSON.stringify([ch.single, ch.x, ch.lines, ch.hit0]));
  // 12 20 pistettä
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(800); await openRow('Soutu');
  ch = await chart();
  ok(ch.circles === 2 && ch.hits === 20, '12 20 pistettä: ympyrät ' + ch.circles + ', alueet ' + ch.hits);
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(800);

  console.log('=== Kehote 4: 1RM-kortti');
  const p4 = series('D', 'Alaviistopenkkipunnerrus tangolla', [['2026-06-15',96],['2026-07-06',98],['2026-07-27',100],['2026-08-17',101],['2026-08-31',103.5],['2026-09-12',106]])
    .concat([{ date: '2026-09-14', exercises: { D: one('Alaviistopenkkipunnerrus tangolla, Suora tanko', 103) } }]);
  const p7 = series('C', 'Maastaveto', [['2026-09-10',140]]);
  const p8 = series('B', 'Kyykky', [['2026-07-20',108],['2026-08-20',106],['2026-09-10',104]]);
  const p4b = series('A', 'Penkkipunnerrus', [['2026-07-20',108],['2026-08-20',106],['2026-09-10',110]]);
  await load(page, merge([p4, p7, p8, p4b]));
  await kehitys(page); await liikkeet(page); await openRow('Alaviistopenkkipunnerrus tangolla');
  const card = () => page.evaluate(() => {
    const c = document.querySelector('.kehitys-card');
    const stats = [...c.querySelectorAll('.stat')].map(s => ({ label: s.querySelector('.stat-label').textContent, value: s.querySelector('.stat-value').textContent, cls: (s.querySelector('.stat-value span')||{}).className, sub: (s.querySelector('.stat-delta')||{}).textContent || '' }));
    return { title: c.textContent.indexOf('Alaviistopenkkipunnerrus') !== -1 && !!c.querySelector('.kehitys-card-title'), hero: c.querySelector('.kehitys-hero-value').textContent, unit: c.querySelector('.kehitys-hero-unit').textContent,
      chip: c.querySelector('.kehitys-delta-chip').textContent, chipCls: c.querySelector('.kehitys-delta-chip').className, stats, notes: [...c.querySelectorAll('.kehitys-note')].map(n => n.textContent),
      variants: [...c.querySelectorAll('.kehitys-variants .chip')].map(v => v.textContent + '|' + v.getAttribute('role')), hasVariants: !!c.querySelector('.kehitys-variants'), chart: !!c.querySelector('.chart'), range: !!c.querySelector('.chart-range') };
  });
  let k = await card();
  ok(!k.title && k.hero === '106kg' && k.unit === 'kg', '1 hero ilman nimeä: ' + k.hero);
  ok(k.chip === '+5 kg · 4 vk' && k.chipCls === 'kehitys-delta-chip up', '1 chip: ' + k.chip + ' ' + k.chipCls);
  ok(k.stats.length === 4 && k.stats[0].label === 'Kuukausi' && k.stats[0].value === '+6 kg' && k.stats[0].cls === 'up' && k.stats[0].sub === '+6 %', '2 Kuukausi: ' + JSON.stringify(k.stats[0]));
  ok(k.stats[1].value === 'Ei dataa' && k.stats[2].value === 'Ei dataa', '2 Puoli vuotta/Vuosi Ei dataa: ' + JSON.stringify([k.stats[1], k.stats[2]]));
  ok(k.stats[3].label === 'Ennätykseen' && k.stats[3].value === '0 kg' && k.stats[3].cls === '' && k.stats[3].sub === 'ennätys nyt', '2 Ennätykseen: ' + JSON.stringify(k.stats[3]));
  ok(k.notes[0] === 'Mitattu 106' + NB + 'kg × 1, Lauantai 12. syyskuuta' && k.notes[1] === 'Viimeisin treeni 103' + NB + 'kg (103' + NB + 'kg × 1), Maanantai 14. syyskuuta', '3/5 selitteet: ' + JSON.stringify(k.notes));
  ok(k.variants.join(';') === 'ilman variaatiota|null;Suora tanko|null', '6/12 variaatiot: ' + k.variants.join(';'));
  ok(k.chart && k.range, 'käyrä ja aikavälivalitsin kortissa');
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(800); await openRow('Kyykky');
  k = await card();
  ok(k.chip === '−2 kg · 4 vk' && k.chipCls === 'kehitys-delta-chip down' && !k.hasVariants && k.notes.length === 2, '8 down, 6 ei variaatioita: ' + JSON.stringify([k.chip, k.notes]));
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(800); await openRow('Penkkipunnerrus');
  k = await card();
  ok(k.chip === '+2 kg · 4 vk' && k.notes.length === 1 && k.notes[0].indexOf('Mitattu 110') === 0, '4 latestDate === currentDate: yksi selite ' + JSON.stringify(k.notes));
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(800); await openRow('Maastaveto');
  k = await card();
  const note9 = await page.evaluate(() => !!document.querySelector('.kehitys-card .kehitys-note') && !document.querySelector('.kehitys-card .stat-grid'));
  ok(k.chip === 'ei vertailua' && k.chipCls === 'kehitys-delta-chip flat' && note9 && k.chart && k.hero === '140kg', '7/9 yksi piste: ' + JSON.stringify([k.chip, k.notes]));
  const pct = await page.evaluate(() => null); // fmtPctPlain on sulkeuman sisällä; tarkistetaan ruudukon kautta (yllä +6 %)
  ok(true, '10 fmtPctPlain-muoto tarkistettu ruudukon subista (+6 %)');
  await page.click('[data-close-kehitys]'); await page.waitForTimeout(800);
  await page.click('[data-kehitys-front-tab="yhteenveto"]'); await page.waitForTimeout(400);
  const inl = await page.evaluate(() => { const m = document.querySelector('main').innerHTML; return { a: (m.match(/padding:16px; margin-bottom:10px/g)||[]).length, b: (m.match(/font-weight:600; font-size:15px/g)||[]).length, c: (m.match(/color:var\(--brass\); font-weight:800; font-size:16px/g)||[]).length, cards: document.querySelectorAll('.kehitys-card').length }; });
  ok(inl.a === 0 && inl.b === 0 && inl.c === 0 && inl.cards >= 2, '11 etusivu ilman inline-tyylejä: ' + JSON.stringify(inl));

  console.log('=== Kehote 5: tabletti');
  const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  wide.on('pageerror', e => errors.push('wide: ' + e));
  const w1 = series('A', 'Penkkipunnerrus', [['2026-08-01',100],['2026-08-15',102],['2026-09-01',104],['2026-09-12',106]]);
  const w2 = series('B', 'Kyykky', [['2026-08-01',140],['2026-09-05',142]]);
  const w3 = series('C', 'Maastaveto', [['2026-07-01',180],['2026-07-15',178],['2026-08-01',176],['2026-08-20',174],['2026-09-10',172]]);
  await load(wide, merge([w1, w2, w3]));
  const hs = pg => pg.evaluate(() => { const s = history.state; return s ? [s.view, s.detail, s.depth].join('|') : null; });
  const wsnap = pg => pg.evaluate(() => ({ wide: document.getElementById('app').className.indexOf('wide') !== -1, cols: !!document.querySelector('main .kehitys-cols'), paneText: (document.querySelector('.kehitys-pane')||{}).textContent || null,
    // h2:n tekstisolmut ilman Pysähtynyt-chippiä (titleExtra, 0.4.12).
    paneH2: (function(){ const h2 = document.querySelector('.kehitys-pane h2'); return h2 ? [...h2.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : null; })(), back: !!document.querySelector('[data-close-kehitys]'), on: [...document.querySelectorAll('.kehitys-row.on')].map(r => r.querySelector('.kehitys-row-name').textContent + '|' + r.getAttribute('aria-current')),
    aside: (document.querySelector('aside.kehitys-pane')||{}).getAttribute ? document.querySelector('aside.kehitys-pane').getAttribute('aria-label') : null, len: history.length, segOn: (document.querySelector('[data-kehitys-front-tab].on')||{}).dataset ? document.querySelector('[data-kehitys-front-tab].on').dataset.kehitysFrontTab : null,
    detailFull: !!document.querySelector('main > .screen-head [data-close-kehitys], main > .kehitys-detail-head'), leftRange: [...document.querySelectorAll('.kehitys-list [data-kehitys-range].on')].map(b => b.dataset.kehitysRange).join() }));
  await kehitys(wide);
  let w = await wsnap(wide);
  ok(w.wide && w.cols && w.paneText.indexOf('Valitse liike') !== -1 && w.aside === 'Valittu liike' && (await hs(wide)) === 'kehitys||1', '1 kaksi palstaa, tyhjä paneeli, pino ' + (await hs(wide)));
  await liikkeet(wide);
  const len0 = (await wsnap(wide)).len;
  await wide.click('.kehitys-row:has(.kehitys-row-name:text-is("Kyykky"))'); await wide.waitForTimeout(500);
  w = await wsnap(wide);
  ok(w.paneH2 === 'Kyykky' && !w.back && w.on.join() === 'Kyykky|true' && (await hs(wide)) === 'kehitys||1' && w.len === len0, '2 paneelissa Kyykky, rivi on, pino ennallaan ' + JSON.stringify([w.paneH2, w.back, w.on, w.len, len0]));
  ok(!!(await wide.$('.kehitys-pane [data-kehitys-tab]')), '2 välilehdet paneelissa');
  await wide.click('.kehitys-row:has(.kehitys-row-name:text-is("Maastaveto"))'); await wide.waitForTimeout(500);
  w = await wsnap(wide);
  ok(w.paneH2 === 'Maastaveto' && (await hs(wide)) === 'kehitys||1', '3 paneeli vaihtuu');
  await wide.click('.kehitys-row:has(.kehitys-row-name:text-is("Kyykky"))'); await wide.waitForTimeout(400);
  await wide.click('.tab[data-tab="historia"]'); await wide.waitForTimeout(900);
  await wide.click('.tab[data-tab="kehitys"]'); await wide.waitForTimeout(900);
  w = await wsnap(wide);
  ok(w.paneH2 === 'Kyykky' && w.segOn === 'liikkeet', '4 Historia ja takaisin: paneeli ja segmentti säilyvät ' + JSON.stringify([w.paneH2, w.segOn]));
  // 11 aikaväli paneelissa → vasen käyrä
  await wide.click('[data-kehitys-front-tab="yhteenveto"]'); await wide.waitForTimeout(400);
  await wide.click('.kehitys-pane [data-kehitys-range="4vk"]'); await wide.waitForTimeout(400);
  w = await wsnap(wide);
  ok(w.leftRange === '4vk', '11 yhteinen aikaväli: vasen ' + w.leftRange);
  await wide.click('.kehitys-pane [data-kehitys-range="kaikki"]'); await wide.waitForTimeout(300);
  // 10 pysähtynyt-chip
  const stalledChip = await wide.$('.kehitys-list [data-open-kehitys].chip-danger');
  ok(!!stalledChip, '10 Pysähtynyt-chip Toteutuminen-kortissa (Maastaveto)');
  if(stalledChip){ await stalledChip.click(); await wide.waitForTimeout(500); w = await wsnap(wide); ok(w.paneH2 === 'Maastaveto' && (await hs(wide)) === 'kehitys||1', '10 chip avaa paneeliin: ' + w.paneH2); }
  await liikkeet(wide); await wide.click('.kehitys-row:has(.kehitys-row-name:text-is("Kyykky"))'); await wide.waitForTimeout(400);
  // 5 Ohjelmaan ja takaisin
  await wide.click('.tab[data-tab="ohjelma"]'); await wide.waitForTimeout(900);
  await wide.click('.tab[data-tab="kehitys"]'); await wide.waitForTimeout(900);
  w = await wsnap(wide);
  ok(w.paneText.indexOf('Valitse liike') !== -1, '5 Ohjelman kautta paneeli tyhjä');
  // 6 taaksepäin-ele juureen
  await liikkeet(wide); await wide.click('.kehitys-row:has(.kehitys-row-name:text-is("Kyykky"))'); await wide.waitForTimeout(400);
  await wide.goBack(); await wide.waitForTimeout(600);
  ok((await hs(wide)) === 'ohjelma||0' && !!(await wide.$('.next-card')), '6 ele poistuu Ohjelmaan: ' + (await hs(wide)));
  // 7 leveä → kapea
  await wide.click('.tab[data-tab="kehitys"]'); await wide.waitForTimeout(900);
  await liikkeet(wide); await wide.click('.kehitys-row:has(.kehitys-row-name:text-is("Kyykky"))'); await wide.waitForTimeout(400);
  await wide.setViewportSize({ width: 390, height: 844 }); await wide.waitForTimeout(600);
  w = await wsnap(wide);
  ok(w.detailFull && w.back && (await hs(wide)) === 'kehitys|kyykky|2', '7 kapeaksi: liikenäkymä ruutuna, pino ' + (await hs(wide)));
  await wide.goBack(); await wide.waitForTimeout(600);
  w = await wsnap(wide);
  ok(!w.detailFull && (await hs(wide)) === 'kehitys||1' && !!(await wide.$('#kehitys-list')), '7 ele palaa listaan');
  // 8 kapea → leveä
  await wide.click('.kehitys-row:has(.kehitys-row-name:text-is("Kyykky"))'); await wide.waitForTimeout(600);
  ok((await hs(wide)) === 'kehitys|kyykky|2' && (await wsnap(wide)).back, '12 kapea: navigate syvyys 2, ‹ Kehitys näkyy');
  await wide.setViewportSize({ width: 1280, height: 900 }); await wide.waitForTimeout(600);
  w = await wsnap(wide);
  ok(w.cols && w.paneH2 === 'Kyykky' && (await hs(wide)) === 'kehitys||1', '8 leveäksi: paneeli Kyykky, pino ' + (await hs(wide)));
  // 13 paneelin otsikko h2 (tarkistettu paneH2), 14 Ohjelman leveä asettelu
  await wide.click('.tab[data-tab="ohjelma"]'); await wide.waitForTimeout(900);
  const oh = await wide.evaluate(() => ({ cols: !!document.querySelector('.ohjelma-cols'), pane: !!document.querySelector('.ohjelma-pane'), wide: document.getElementById('app').className.indexOf('wide') !== -1 }));
  ok(oh.cols && oh.pane && oh.wide, '14 Ohjelman leveä asettelu ennallaan');
  // 9 poistunut liike leveänä: Kyykyn merkinnät pois tallennuksesta ja
  // uudelleenlataus pinolla {kehitys, kyykky, 2} → applyScreen siirtää
  // valinnan paneeliin, loadKehitys-loppu nollaa sen.
  await wide.click('.tab[data-tab="kehitys"]'); await wide.waitForTimeout(900);
  await wide.evaluate(() => { localStorage.removeItem('treenipk:entries:2026-08-01'); localStorage.removeItem('treenipk:entries:2026-09-05'); history.replaceState({ view: 'kehitys', detail: 'kyykky', depth: 2 }, '', location.href); });
  await wide.reload(); await wide.waitForSelector('main .kehitys-cols'); await wide.waitForTimeout(800);
  w = await wsnap(wide);
  ok(w.cols && w.paneText.indexOf('Valitse liike') !== -1 && (await hs(wide)) === 'kehitys||1' && !(await wide.$('.kehitys-row.on')), '9 poistunut liike: paneeli tyhjä, pino ' + (await hs(wide)));
  // Vastakohta: olemassa oleva liike pinossa syvyydellä 2 → paneeliin.
  await wide.evaluate(() => history.replaceState({ view: 'kehitys', detail: 'penkkipunnerrus', depth: 2 }, '', location.href));
  await wide.reload(); await wide.waitForSelector('main .kehitys-cols'); await wide.waitForTimeout(800);
  w = await wsnap(wide);
  ok(w.paneH2 === 'Penkkipunnerrus' && (await hs(wide)) === 'kehitys||1', '9b uudelleenlataus syvyydellä 2 leveänä: paneeli ja pino ' + (await hs(wide)));
  await wide.close();

  console.log('virheet');
  ok(errors.length === 0, 'ei JS-virheitä: ' + JSON.stringify(errors));
  await browser.close();
  console.log(fails ? ('\nEPÄONNISTUI: ' + fails) : '\nKAIKKI OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
