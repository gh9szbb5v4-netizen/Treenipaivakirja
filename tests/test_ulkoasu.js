// Kiillotettu ulkoasu "Messinki ja muste" (0.4.32): otsikkorivi (logo vain
// Ohjelma-näkymässä), valinnan sääntö (neutraali pohja + messinkiviiva),
// ryhmitellyt päiväkortit ja renkaat, kirjausruudun jaettu otsikkorivi ja
// tavoite kolmena lukuna, näkyvä tallennusselite, näppäimistön otsake ja
// Seuraava-näppäin, RPE-ikkunan rivit, Historian ryhmittely ja toiminnot,
// Asetusten ryhmät ja Uutta-merkki, Kehityksen alleviivatut välilehdet,
// kesken oleva viikko, tasalukuasteikko ja pylväiden kontrasti, axe sekä
// 360 px:n leveys.
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://127.0.0.1:8765/index.html';
let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const w = ms => new Promise(r => setTimeout(r, ms));
const nb = s => String(s == null ? '' : s).replace(/ /g, ' ');
const BRASS = 'rgb(201, 162, 39)', S3 = 'rgb(49, 58, 71)', SURFACE = 'rgb(28, 34, 43)';

// Nelijakoinen ohjelma, neljä viikkoa (viikko 4 = Kevennysviikko) ja
// merkinnät 14.9.–6.10.: viikon 4 päivä 1 tehty, päivä 2 kesken (1 / 4).
const DAYS = [
  { label: 'Päivä 1', ex: [['Takakyykky tangolla, Suora tanko', 3, 5, 100], ['Penkkipunnerrus tangolla, Suora tanko', 3, 6, 72.5], ['Kulmasoutu tangolla, Suora tanko', 3, 8, 60], ['Hauiskääntö käsipainoilla', 3, 10, 14]] },
  { label: 'Päivä 2', ex: [['Maastaveto tangolla, Suora tanko', 3, 5, 130], ['Pystypunnerrus tangolla seisten, Suora tanko', 3, 6, 45], ['Ylätaljaveto V-kahvalla', 3, 10, 55], ['Ojentajapunnerrus taljassa köydellä', 3, 12, 22.5]] },
  { label: 'Päivä 3', ex: [['Takakyykky tangolla, Suora tanko', 3, 8, 85], ['Penkkipunnerrus tangolla, Suora tanko', 4, 8, 65], ['Romanialainen maastaveto', 3, 8, 90]] },
];
const WEEKS = ['1', '2', '3', '4'];
const DATES = [['2026-09-14', '2026-09-16', '2026-09-18'], ['2026-09-21', '2026-09-23', '2026-09-25'], ['2026-09-28', '2026-09-30', '2026-10-02'], ['2026-10-05', '2026-10-06', null]];
function build(){
  const program = { id: 'prog-demo', name: 'Voima 4 vk', weeks: WEEKS, weekLabels: { '4': 'Kevennysviikko' }, days: [] };
  const entries = {}, lastSet = {};
  WEEKS.forEach((wk, wi) => {
    DAYS.forEach((d, di) => {
      const exs = d.ex.map((e, ei) => ({ id: 'e' + wk + di + ei, name: e[0], sets: String(e[1]), reps: String(e[2]), unit: '', weight: '', notes: '', intensity: null, kind: 'plain', autoCalc: true }));
      program.days.push({ id: 'd' + wk + di, label: d.label, name: (wi === 3 ? 'Kevennysviikko' : 'Viikko ' + wk) + ' · ' + d.label, week: wk, exercises: exs });
      const date = DATES[wi][di];
      if(!date) return;
      exs.forEach((ex, ei) => {
        if(date === '2026-10-06' && ei > 0) return;
        const base = d.ex[ei][3];
        const weight = Math.round((base + wi * (base >= 40 ? 2.5 : 1) * (wi === 3 ? 0 : 1)) * 10) / 10;
        const sets = [];
        for(let s = 0; s < d.ex[ei][1]; s++){
          const reps = d.ex[ei][2] - (s === d.ex[ei][1] - 1 && wi === 2 ? 1 : 0);
          sets.push({ weight: String(weight), reps: String(reps), notes: '', done: true, rpe: Math.min(10, [7, 7, 8][s % 3] + (s === d.ex[ei][1] - 1 ? 1 : 0)) });
        }
        const warmups = base >= 60 ? [{ weight: String(Math.round(base * 0.5 / 2.5) * 2.5), reps: '8', rpe: 6 }, { weight: String(Math.round(base * 0.75 / 2.5) * 2.5), reps: '4', rpe: 7 }] : [];
        entries[date] = entries[date] || { date, exercises: {} };
        entries[date].exercises[ex.id] = { name: ex.name, sets, warmups, kind: 'plain', loggedAt: date + 'T17:' + (10 + ei * 9) + ':00.000Z', plan: { sets: d.ex[ei][1], reps: d.ex[ei][2], suggestedWeight: weight } };
        const norm = ex.name.trim().toLowerCase();
        const old = lastSet[norm];
        const ls = { sets: sets.map(s => ({ weight: s.weight, reps: s.reps, done: true, rpe: s.rpe })), date, prior: [] };
        if(warmups.length) ls.warmups = warmups;
        if(old) ls.prior = [{ sets: old.sets, date: old.date }].concat(old.prior || []).slice(0, 2);
        lastSet[norm] = ls;
      });
    });
  });
  return { program, entries, lastSet };
}
async function load(page, extra){
  const data = build();
  await page.goto(URL.replace('index.html', 'manifest.json'));
  await page.evaluate(({ data, extra }) => {
    localStorage.clear();
    const P = 'treenipk:';
    localStorage.setItem(P + 'koekaytto-hyvaksytty', '1');
    localStorage.setItem(P + 'first-log-hint-dismissed', '1');
    localStorage.setItem(P + 'homescreen-hint-dismissed', '1');
    localStorage.setItem(P + 'last-export-date', '2026-10-05');
    localStorage.setItem(P + 'rest-timer-enabled', '0');
    localStorage.setItem(P + 'workout-program', JSON.stringify(data.program));
    localStorage.setItem(P + 'last-set-log', JSON.stringify(data.lastSet));
    Object.keys(data.entries).forEach(d => localStorage.setItem(P + 'entries:' + d, JSON.stringify(data.entries[d])));
    Object.keys(extra || {}).forEach(k => localStorage.setItem(P + k, extra[k]));
  }, { data, extra });
  await page.goto(URL);
  await page.waitForSelector('.next-card');
  await w(400);
}
const header = page => page.evaluate(() => {
  const h = document.querySelector('header');
  const h1 = h.querySelector('h1');
  return { logo: !!h.querySelector('.app-logo'), h1: h1 ? h1.textContent : null, h1cls: h1 ? h1.className : null, h1s: document.querySelectorAll('h1').length,
    edit: !!h.querySelector('[data-edit-program]'), ohje: !!h.querySelector('[data-tab="ohje"]') };
});
const style = (page, sel, props) => page.evaluate(({ sel, props }) => {
  const el = document.querySelector(sel);
  if(!el) return null;
  const cs = getComputedStyle(el);
  const o = {}; props.forEach(p => { o[p] = cs[p]; }); return o;
}, { sel, props });
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
async function axeRun(page){
  await page.addScriptTag({ content: axeSrc });
  return page.evaluate(async () => {
    const r = await axe.run({ exclude: [['.bottom-nav']] }, { runOnly: ['wcag2a', 'wcag2aa'] });
    return r.violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(','));
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00'));
  await load(page);

  console.log('=== 1 Ohjelma: otsikkorivi, valinta, päiväkortit');
  let h = await header(page);
  ok(h.logo && h.edit && h.ohje && h.h1s === 1 && h.h1cls === 'app-title', '1 Ohjelma: logo h1:nä, kynä ja ohje: ' + JSON.stringify(h));
  let st = await style(page, 'header .icon-btn', ['backgroundColor', 'borderTopColor']);
  ok(st.backgroundColor === 'rgba(0, 0, 0, 0)', '1 otsikkorivin kuvakepainike kehyksetön: ' + JSON.stringify(st));
  st = await style(page, '.tab.active', ['backgroundColor', 'borderTopColor', 'color']);
  ok(st.backgroundColor === S3 && st.borderTopColor === BRASS && st.color === 'rgb(238, 234, 226)', '1 aktiivinen välilehti: neutraali pohja + messinkiviiva: ' + JSON.stringify(st));
  st = await style(page, '.segmented button.on', ['backgroundColor', 'borderTopColor', 'color']);
  ok(st.backgroundColor === S3 && st.borderTopColor === BRASS, '1 Viikko-valinta: neutraali pohja + messinkiviiva: ' + JSON.stringify(st));
  st = await style(page, '.bottom-nav', ['borderTopColor', 'boxShadow']);
  ok(st.borderTopColor !== BRASS && st.boxShadow.indexOf('rgba(0, 0, 0') !== -1, '1 alavalikko ilman messinkireunaa, pehmeä varjo: ' + JSON.stringify(st));
  const next = await page.evaluate(() => {
    const c = document.querySelector('.next-card');
    const bar = c.querySelector('.next-progress');
    return { seg: bar.classList.contains('segments'), n: bar.style.getPropertyValue('--n'), width: c.querySelector('.next-progress-fill').style.width,
      btn: c.querySelector('[data-start-day]').textContent, arrow: !!c.querySelector('[data-start-day] svg'), sub: c.querySelector('.next-card-sub').textContent,
      before: getComputedStyle(c.querySelector('.next-card-sub'), '::before').content };
  });
  ok(next.seg && next.n.trim() === '4' && next.width === '25%' && next.btn === 'Jatka' && next.arrow, '1 Seuraavaksi: lohkopalkki (4), 25 %, Jatka + nuoli: ' + JSON.stringify(next));
  ok(next.sub === 'Pystypunnerrus tangolla seisten' && next.before === '"Seuraavana "', '1 alarivi: nimi ennallaan, "Seuraavana" CSS:llä: ' + JSON.stringify([next.sub, next.before]));
  const days = await page.evaluate(() => [...document.querySelectorAll('.exercise.day-card')].map(c => {
    const cs = getComputedStyle(c);
    const arc = c.querySelector('.ring-arc');
    return { tl: cs.borderTopLeftRadius, bl: cs.borderBottomLeftRadius, mb: cs.marginBottom, done: !!c.querySelector('.day-ring.done svg'),
      arc: arc ? arc.getAttribute('stroke-dasharray') : null, track: !!c.querySelector('.ring-track'),
      status: c.querySelector('.day-card-status').textContent, open: c.querySelector('.status-open') ? getComputedStyle(c.querySelector('.status-open')).color : null };
  }));
  ok(days.length === 3 && days[0].tl === '16px' && days[0].bl === '0px' && days[1].tl === '0px' && days[1].bl === '0px' && days[2].tl === '0px' && days[2].bl === '16px' && days[2].mb === '12px',
    '1 päiväkortit yhtenä ryhmänä: ' + JSON.stringify(days.map(d => [d.tl, d.bl, d.mb])));
  ok(days[0].done && !days[0].arc && days[1].arc && days[1].arc.indexOf('21.99 ') === 0 && days[2].track && !days[2].arc, '1 renkaat: tehty ✓, kesken 1/4 kaari, aloittamaton ura: ' + JSON.stringify(days.map(d => d.arc)));
  ok(/^Tehty · ma 5\.10\. · [\d ]+ kg$/.test(nb(days[0].status)) && /^Kesken · 1 \/ 4 liikettä · [\d ]+ kg$/.test(nb(days[1].status)) && days[2].status === '3 liikettä' && days[1].open === BRASS,
    '1 tila lyhyellä päivämäärällä: ' + JSON.stringify(days.map(d => nb(d.status))));
  ok(await page.evaluate(() => document.querySelector('.week-head-count').textContent) === 'Viikko 4 / 4', '1 viikon laskuri "Viikko 4 / 4"');
  st = await page.evaluate(() => ({ body: getComputedStyle(document.body).fontFamily, btn: getComputedStyle(document.querySelector('.next-card button')).fontFamily, input: getComputedStyle(document.querySelector('input')).fontFamily }));
  ok(st.btn === st.body && st.input === st.body, '1 painikkeet ja kentät perivät järjestelmäfontin: ' + JSON.stringify(st));
  let ax = await axeRun(page);
  ok(ax.length === 0, '1 axe (myös kontrasti, alavalikko pois): ' + JSON.stringify(ax));

  console.log('=== 2 Kirjausruutu');
  await page.click('.next-card [data-start-day]'); await page.waitForSelector('#kirjaus-title'); await w(500);
  const k = await page.evaluate(() => {
    const sh = document.querySelector('main .screen-head');
    const save = document.querySelector('[data-save-ex]');
    const hint = document.querySelector('.ledger-save-hint');
    const tgt = document.querySelector('main .exercise-target');
    const spec = document.querySelector('.kirjaus-spec');
    return { split: sh.classList.contains('split'), back: !!sh.querySelector('[data-close-ex]'), info: !!sh.querySelector('.screen-head-right .info-btn'),
      title: document.getElementById('kirjaus-title').textContent, kicker: sh.querySelector('.screen-kicker').textContent,
      dots: [...sh.querySelectorAll('.kirjaus-dots i')].map(i => i.className), dotsHidden: sh.querySelector('.kirjaus-dots').getAttribute('aria-hidden'),
      labels: spec ? [...spec.querySelectorAll('.spec-label')].map(x => x.textContent) : [], values: spec ? [...spec.querySelectorAll('.spec-value')].map(x => x.textContent) : [],
      accent: spec ? getComputedStyle(spec.querySelector('.spec-value.accent')).color : null, specHidden: spec ? spec.getAttribute('aria-hidden') : null,
      target: tgt ? tgt.textContent : null, targetW: tgt ? tgt.getBoundingClientRect().width : null, targetAccent: tgt ? tgt.innerHTML.indexOf('<span class="accent">ehdotus') !== -1 : false,
      hint: hint ? hint.textContent : null, hintId: hint ? hint.id : null, desc: save.getAttribute('aria-describedby'), saveDisabled: save.disabled,
      planned: document.querySelector('[data-volume-planned]').textContent, unit: !!document.querySelector('[data-volume-planned] .unit'),
      nextRow: (() => { const r = document.querySelector('.ledger-row.next'); const cs = getComputedStyle(r); return { bg: cs.backgroundColor, shadow: cs.boxShadow }; })() };
  });
  ok(k.split && k.back && k.info && k.title === 'Pystypunnerrus tangolla seisten', '2 jaettu otsikkorivi: takaisin, ⓘ, otsikko: ' + JSON.stringify([k.split, k.title]));
  ok(k.kicker === 'Kevennysviikko · Päivä 2 · liike 2 / 4' && k.dots.join(',') === 'done,cur,,' && k.dotsHidden === 'true', '2 kicker ennallaan ruudunlukijalle, pisteet: ' + JSON.stringify([k.kicker, k.dots]));
  ok(k.labels.join('|') === 'Tavoite|Tuntuma|Ehdotus' && k.values.map(nb).join('|') === '3 × 6|RPE 8|+2,5 kg' && k.accent === BRASS && k.specHidden === 'true', '2 tavoite kolmena lukuna: ' + JSON.stringify([k.labels, k.values]));
  ok(nb(k.target) === '3 sarjaa · 6 toistoa · RPE 8 · ehdotus +2,5 kg' && k.targetW <= 1 && k.targetAccent, '2 sama tieto lauseena ruudunlukijalle (sr-only): ' + JSON.stringify([k.target, k.targetW]));
  ok(k.hint === 'Tallenna aukeaa, kun kaikki sarjat on merkitty.' && k.hintId === k.desc && k.saveDisabled, '2 näkyvä tallennusselite = aria-describedby: ' + JSON.stringify([k.hint, k.hintId, k.desc]));
  ok(nb(k.planned) === '915 kg' && k.unit, '2 volyymi yksikkö erillisenä, teksti ennallaan: ' + k.planned);
  ok(k.nextRow.bg !== 'rgba(201, 162, 39, 0.06)' && k.nextRow.shadow.indexOf(BRASS) !== -1, '2 vuorossa oleva rivi: neutraali pohja + messinkiviiva: ' + JSON.stringify(k.nextRow));
  ax = await axeRun(page);
  ok(ax.length === 0, '2 axe: ' + JSON.stringify(ax));

  console.log('=== 3 RPE-ikkuna riveinä');
  await page.click('[data-toggle-done][data-idx="0"]'); await page.waitForSelector('.sheet .rpe-pick'); await w(400);
  const r = await page.evaluate(() => {
    const s = document.querySelector('.sheet');
    const rows = [...s.querySelectorAll('.rpe-pick-btn')];
    const d = s.querySelector('details.rpe-more');
    return { rows: rows.map(b => b.dataset.rpe + ':' + b.querySelector('.rpe-pick-word').textContent + ':' + b.querySelector('.rpe-pick-desc').textContent),
      target: rows.filter(b => b.querySelector('.rpe-target')).map(b => b.dataset.rpe), label8: rows[2].getAttribute('aria-label'),
      prompt: s.querySelector('.rpe-sheet-prompt').textContent, promptColor: getComputedStyle(s.querySelector('.rpe-sheet-prompt')).color,
      q: s.querySelector('.rpe-sheet-q').textContent, details: !!d, open: d ? d.open : null, summary: d ? d.querySelector('summary').textContent : null,
      guide: !!s.querySelector('.rpe-guide'), remove: !!s.querySelector('[data-remove-set]'), radius: getComputedStyle(s).borderTopLeftRadius };
  });
  ok(r.rows.length === 5 && r.rows[0] === '6:Kevyt:4 tai enemmän toistoa varastossa' && r.rows[4] === '10:Äärirajoilla:Ei yhtään toistoa varastossa', '3 viisi riviä sanoin ja varastolla: ' + JSON.stringify(r.rows));
  ok(r.target.join() === '8' && r.label8.indexOf('(tavoite)') !== -1, '3 tavoite-merkki työsarjan RPE 8:ssa: ' + JSON.stringify([r.target, r.label8]));
  ok(r.prompt === 'Montako toistoa olisi vielä tullut?' && r.promptColor === 'rgb(238, 234, 226)' && nb(r.q) === 'Pystypunnerrus tangolla seisten · 52,5 kg × 6', '3 kysymys ja sarjan tiedot: ' + JSON.stringify([r.prompt, r.q]));
  ok(r.details && r.open === false && r.summary === 'Miten tuntuma vaikuttaa painoehdotuksiin?' && !r.guide && r.remove && r.radius === '20px', '3 selitys avattavana, ei erillistä asteikkoa, poisto: ' + JSON.stringify([r.open, r.summary, r.radius]));
  ax = await axeRun(page);
  ok(ax.length === 0, '3 axe: ' + JSON.stringify(ax));
  await page.click('.sheet [data-rpe="8"]'); await w(500);
  await page.click('[data-set-more][data-idx="0"]'); await page.waitForSelector('.sheet .rpe-pick'); await w(400);
  st = await style(page, '.sheet .rpe-pick-btn[aria-pressed="true"]', ['backgroundColor', 'borderTopColor']);
  const pressed = await page.evaluate(() => document.querySelector('.sheet .rpe-pick-btn[aria-pressed="true"]').dataset.rpe);
  ok(pressed === '8' && st.backgroundColor === S3 && st.borderTopColor === BRASS, '3 valittu rivi: neutraali pohja + messinkiviiva: ' + JSON.stringify([pressed, st]));
  await page.keyboard.press('Escape'); await w(400);
  await page.click('[data-add-warmup]'); await w(500);
  if(await page.$('#keypad')){ await page.click('[data-keypad-close]'); await w(300); }
  const warmIdx = await page.evaluate(() => { const b = [...document.querySelectorAll('.ledger [data-set-more]')][0]; return b.dataset.idx; });
  await page.click('[data-set-more][data-idx="' + warmIdx + '"]'); await page.waitForSelector('.sheet .rpe-pick'); await w(400);
  const warm = await page.evaluate(() => ({ title: document.querySelector('.sheet-title span').textContent, target: document.querySelectorAll('.sheet .rpe-target').length }));
  ok(warm.title === 'RPE · Lämmittely 1' && warm.target === 0, '3 lämmittelyllä ei tavoite-merkkiä: ' + JSON.stringify(warm));
  await page.click('.sheet [data-remove-set]'); await w(500);

  console.log('=== 4 Näppäimistö');
  await page.click('[data-set-field][data-idx="1"][data-field="weight"]'); await page.waitForSelector('#keypad'); await w(400);
  const kp = async () => page.evaluate(() => {
    const l = document.querySelector('.keypad-label').getBoundingClientRect(), v = document.getElementById('keypad-value').getBoundingClientRect();
    const n = document.querySelector('.key-next'), svg = n.querySelector('svg');
    return { label: document.querySelector('.keypad-label').textContent, above: l.bottom <= v.top + 1, size: getComputedStyle(document.getElementById('keypad-value')).fontSize,
      nextText: n.textContent, fits: n.scrollWidth <= n.clientWidth, svg: svg ? getComputedStyle(svg).display : null, nextBg: getComputedStyle(n).backgroundColor,
      keyBg: getComputedStyle(document.querySelector('.key[data-keypad-key="1"]')).backgroundColor, stepBg: getComputedStyle(document.querySelector('.key-step')).backgroundColor };
  });
  let kk = await kp();
  ok(kk.label === 'Sarja 2 · Paino' && kk.above && kk.size === '34px', '4 otsake lukeman yläpuolella, lukema 34 px: ' + JSON.stringify([kk.label, kk.above, kk.size]));
  ok(kk.nextText === 'Seuraava' && kk.fits && kk.svg !== 'none' && kk.nextBg === BRASS && kk.stepBg === S3 && kk.keyBg === 'rgb(38, 46, 57)', '4 Seuraava + nuoli mahtuu 390 px:ssä, näppäinten pinnat: ' + JSON.stringify(kk));
  ax = await axeRun(page);
  ok(ax.length === 0, '4 axe: ' + JSON.stringify(ax));
  await page.setViewportSize({ width: 360, height: 780 }); await w(400);
  kk = await kp();
  ok(kk.fits && kk.svg === 'none', '4 360 px: Seuraava mahtuu, nuoli piilossa: ' + JSON.stringify([kk.fits, kk.svg]));
  ok(await noHScroll(page), '4 360 px: kirjausruutu ei vieritä vaakasuunnassa');
  await page.click('[data-keypad-close]'); await w(300);
  await page.setViewportSize({ width: 390, height: 844 }); await w(300);
  await page.click('.screen-head [data-close-ex]'); await w(700);

  console.log('=== 5 Historia');
  await page.click('.tab[data-tab="historia"]'); await page.waitForSelector('#history-list'); await w(500);
  h = await header(page);
  ok(!h.logo && h.h1 === 'Historia' && h.h1cls === 'view-heading' && h.h1s === 1 && h.ohje && !h.edit, '5 otsikko logon paikalla: ' + JSON.stringify(h));
  ok(!!(await page.$('.search-field svg + #history-filter')), '5 hakukenttä kuvakkeella');
  await page.click('.history-date-head[data-date="2026-10-06"]'); await w(500);
  const hi = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.history-date')].slice(0, 3).map(c => { const cs = getComputedStyle(c); return cs.borderTopLeftRadius + '/' + cs.borderBottomLeftRadius; });
    const ex = document.querySelector('.history-date-head.open + .history-ex');
    const btns = [...ex.querySelectorAll('.history-actions button')];
    const rpe = ex.querySelector('.history-set:not(.warm) .history-rpe');
    return { cards, firstBorder: getComputedStyle(ex).borderTopWidth, name: ex.querySelector('.history-ex-name').textContent, variant: (ex.querySelector('.history-ex-variant') || {}).textContent,
      btns: btns.map(b => b.textContent + '|' + b.className), oneRow: btns.every(b => b.offsetTop === btns[0].offsetTop), rpeBg: getComputedStyle(rpe).backgroundColor, rpeText: rpe.textContent,
      val: ex.querySelector('.history-set:not(.warm) .history-set-val').textContent };
  });
  ok(hi.cards[0] === '16px/0px' && hi.cards[1] === '0px/0px' && hi.cards[2] === '0px/16px', '5 lokakuun päivät yhtenä korttina: ' + JSON.stringify(hi.cards));
  ok(hi.firstBorder === '0px' && hi.name === 'Maastaveto tangolla, Suora tanko' && hi.variant === ', Suora tanko', '5 ei kaksoisviivaa, variaatio harmaana (teksti ennallaan): ' + JSON.stringify([hi.firstBorder, hi.name]));
  ok(hi.btns.join(';') === 'Kehitys|btn-secondary btn-sm btn-auto;Korjaa|btn-secondary btn-sm btn-auto;Siirrä päivälle|btn-secondary btn-sm btn-auto' && hi.oneRow, '5 tonaaliset toiminnot yhdellä rivillä: ' + JSON.stringify(hi.btns));
  ok(hi.rpeBg === S3 && hi.rpeText === 'RPE 7' && nb(hi.val) === '130 kg × 5', '5 RPE-merkki neutraali, arvo ennallaan: ' + JSON.stringify([hi.rpeBg, hi.rpeText, hi.val]));
  ax = await axeRun(page);
  ok(ax.length === 0, '5 axe: ' + JSON.stringify(ax));
  await page.setViewportSize({ width: 360, height: 780 }); await w(300);
  ok(await noHScroll(page), '5 360 px: Historia ei vieritä vaakasuunnassa');
  await page.setViewportSize({ width: 390, height: 844 }); await w(300);

  console.log('=== 6 Kehitys');
  await page.click('.tab[data-tab="kehitys"]'); await page.waitForSelector('.kehitys-card'); await w(800);
  h = await header(page);
  ok(!h.logo && h.h1 === 'Kehitys' && h.h1s === 1, '6 otsikko Kehitys: ' + JSON.stringify(h));
  const kh = await page.evaluate(() => {
    const on = document.querySelector('.kehitys-tabs button.on'), cs = getComputedStyle(on);
    const card = document.querySelector('.kehitys-card');
    const stat = [...card.querySelectorAll('.stat')].find(s => s.querySelector('.stat-label').textContent === 'Kokonaispaino');
    const bars = [...document.querySelectorAll('svg.week-bars rect')].map(r => r.getAttribute('fill') + (r.getAttribute('stroke') ? '/' + r.getAttribute('stroke') : ''));
    const vol = [...document.querySelectorAll('.kehitys-card')].find(c => c.textContent.indexOf('Nostettu kokonaispaino') !== -1);
    const svg = vol.querySelector('.chart svg');
    const circles = [...svg.querySelectorAll('circle')];
    return { tab: on.textContent, tabBg: cs.backgroundColor, tabBorder: cs.borderBottomColor + ' ' + cs.borderBottomWidth,
      chip: (card.querySelector('.week-open-chip') || {}).textContent, sub: (card.querySelector('.kehitys-card-sub') || {}).textContent,
      value: stat.querySelector('.stat-value').textContent, delta: stat.querySelector('.stat-delta').textContent, bars,
      polygons: svg.querySelectorAll('polygon').length, dashed: svg.querySelectorAll('polyline[stroke-dasharray="4 4"]').length,
      lastFill: circles[circles.length - 1].getAttribute('fill'), ticks: [...svg.querySelectorAll('text')].filter(t => t.getAttribute('text-anchor') === 'end').map(t => t.textContent),
      wide: svg.querySelectorAll('line[x1="52"]').length, caption: vol.querySelector('.chart-caption').textContent, volSub: vol.querySelector('.kehitys-card-sub').textContent,
      volValue: vol.querySelector('.kehitys-card-value').textContent, aria: svg.getAttribute('aria-label') };
  });
  ok(kh.tab === 'Yhteenveto' && kh.tabBg === 'rgba(0, 0, 0, 0)' && kh.tabBorder === BRASS + ' 2px', '6 alleviivatut välilehdet: ' + JSON.stringify([kh.tabBg, kh.tabBorder]));
  ok(kh.chip === 'kesken' && kh.sub === 'Muutos verrattuna viikkoon 28.9.–4.10.', '6 viikko kesken ja vertailukohta: ' + JSON.stringify([kh.chip, kh.sub]));
  ok(/^[\d ]+ kg$/.test(nb(kh.value)) && /^−[\d ]+ kg · −[\d,]+ %$/.test(nb(kh.delta)) && /\d \d{3} kg ·/.test(nb(kh.delta)), '6 kokonaispaino ja muutos tuhaterottimin: ' + JSON.stringify([kh.value, kh.delta]));
  ok(kh.bars.length === 12 && kh.bars[11] === 'var(--brass)' && kh.bars.indexOf('var(--surface-2)') === -1 && kh.bars.indexOf('var(--line)') === -1 && kh.bars.filter(b => b === 'var(--line-strong)').length === 11,
    '6 pylväät: kuluva messinki, muut ja tyhjät --line-strong: ' + JSON.stringify(kh.bars));
  ok(kh.polygons === 0 && kh.dashed === 1 && kh.lastFill === 'var(--surface)', '6 käyrä ilman aluetta, kesken oleva jakso katkoviivana, avoin piste: ' + JSON.stringify([kh.polygons, kh.dashed, kh.lastFill]));
  ok(kh.ticks.map(nb).join('|') === '20 000|10 000|0' && kh.wide === 3, '6 apuviivat tasaluvuin ja leveämpi arvosarake: ' + JSON.stringify([kh.ticks, kh.wide]));
  ok(/ · viikko kesken$/.test(kh.caption) && kh.volSub === 'viikko 5.–11.10. · kesken' && kh.aria.indexOf('(viikko kesken)') !== -1, '6 selite ja alarivi kertovat keskeneräisyyden: ' + JSON.stringify([kh.caption, kh.volSub]));
  ax = await axeRun(page);
  ok(ax.length === 0, '6 axe: ' + JSON.stringify(ax));
  await page.click('[data-kehitys-front-tab="liikkeet"]'); await w(500);
  await page.click('.kehitys-row:has(.kehitys-row-name:text-is("Maastaveto tangolla"))'); await w(800);
  const det = await page.evaluate(() => {
    const t = document.querySelector('.kehitys-tabs.detail');
    const stat = l => { const s = [...document.querySelectorAll('.kehitys-card .stat')].find(x => x.querySelector('.stat-label').textContent === l); return s ? s.querySelector('.stat-value').textContent + '|' + (s.querySelector('.stat-delta') || {}).textContent : null; };
    return { fits: t.scrollWidth <= t.clientWidth, month: stat('Kuukausi'), record: stat('Ennätykseen'), hero: document.querySelector('.kehitys-hero-value').textContent,
      heroSize: getComputedStyle(document.querySelector('.kehitys-hero-value')).fontSize, area: document.querySelectorAll('.kehitys-card .chart polygon').length };
  });
  ok(det.fits && det.month === '–|ei vertailukohtaa' && /\|ennätys nyt$/.test(det.record) && det.heroSize === '40px' && det.area === 0, '6 liikenäkymä: välilehdet mahtuvat, tyhjä vertailu "–", näyttöluku 40 px: ' + JSON.stringify(det));
  await page.setViewportSize({ width: 360, height: 780 }); await w(300);
  ok(await page.evaluate(() => { const t = document.querySelector('.kehitys-tabs.detail'); return t.scrollWidth <= t.clientWidth; }) && await noHScroll(page), '6 360 px: liikenäkymän välilehdet mahtuvat');
  await page.setViewportSize({ width: 390, height: 844 }); await w(300);

  console.log('=== 7 Asetukset');
  await page.click('.tab[data-tab="asetukset"]'); await page.waitForSelector('.settings-list'); await w(400);
  h = await header(page);
  const se = await page.evaluate(() => ({ groups: [...document.querySelectorAll('main h2.day-heading')].map(x => x.textContent), lists: document.querySelectorAll('.settings-list').length,
    chip: (document.querySelector('[data-settings-section="muutokset"] .chip-new') || {}).textContent, sub: document.querySelector('[data-settings-section="muutokset"] .settings-row-sub').textContent,
    viewTitle: !!document.querySelector('main .view-title') }));
  ok(!h.logo && h.h1 === 'Asetukset' && h.h1s === 1 && !se.viewTitle, '7 otsikko Asetukset otsikkorivillä, ei toista otsikkoa: ' + JSON.stringify(h));
  ok(se.groups.join('|') === 'Harjoittelu|Tiedot ja sovellus' && se.lists === 2 && se.chip === 'Uutta' && /^Uusin (ma|ti|ke|to|pe|la|su) \d+\.\d+\.$/.test(se.sub), '7 kaksi ryhmää, Uutta-merkki, lyhyt päivä: ' + JSON.stringify(se));
  ax = await axeRun(page);
  ok(ax.length === 0, '7 axe: ' + JSON.stringify(ax));
  await page.click('[data-settings-section="muutokset"]'); await w(400);
  await page.click('[data-settings-back]'); await w(400);
  ok(!(await page.$('[data-settings-section="muutokset"] .chip-new')), '7 Uutta-merkki poistuu avauksen jälkeen');

  console.log('=== 8 Ohje ja muokkaustila');
  await page.click('header [data-tab="ohje"]'); await w(600);
  h = await header(page);
  st = await style(page, 'header .icon-btn.active', ['color', 'borderTopColor', 'backgroundColor']);
  ok(!h.logo && h.h1 === 'Ohje' && st && st.color === BRASS && st.backgroundColor === S3, '8 Ohje: otsikko ja aktiivinen kysymysmerkki valinnan säännöllä: ' + JSON.stringify([h.h1, st]));
  await page.click('.tab[data-tab="ohjelma"]'); await w(600);
  await page.click('[data-edit-program]'); await w(600);
  await page.click('[data-edit-back]'); await w(500);
  h = await header(page);
  st = await style(page, '.edit-bar', ['borderTopColor']);
  ok(!h.logo && h.h1 === 'Muokkaa ohjelmaa' && st.borderTopColor !== BRASS, '8 muokkaustilan juuri: otsikko ilman logoa, palkki ilman messinkireunaa: ' + JSON.stringify([h, st]));
  await page.click('.edit-bar button:has-text("Peruuta")'); await w(500);

  console.log('=== 9 360 px');
  await page.setViewportSize({ width: 360, height: 780 }); await w(400);
  ok(await noHScroll(page), '9 360 px: Ohjelma ei vieritä vaakasuunnassa');
  await page.click('.tab[data-tab="asetukset"]'); await w(500);
  ok(await noHScroll(page), '9 360 px: Asetukset ei vieritä vaakasuunnassa');
  await page.click('.tab[data-tab="kehitys"]'); await w(800);
  ok(await noHScroll(page), '9 360 px: Kehitys ei vieritä vaakasuunnassa');

  ok(errors.length === 0, 'ei sivuvirheitä: ' + errors.join('; '));
  await browser.close();
  console.log(fails ? ('FAILS: ' + fails) : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
