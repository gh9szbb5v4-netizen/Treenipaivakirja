# Treenipäiväkirja — muistiinpanot Claudelle

Yhden tiedoston (`index.html`) selainsovellus. Ei build-vaihetta, ei palvelinta.
Koodityyli: `var`-määrittelyt, `function`-lausekkeet, ei arrow-funktioita, ei
`let`/`const`. Säilytä tämä tyyli kaikissa muutoksissa.

Ainoa poikkeus "ei riippuvuuksia" -sääntöön: PDF-tuonnin tarvitsema pdf.js
(`pdf.min.js`, `pdf.worker.min.js`) on `index.html`:n rinnalla omina
tiedostoinaan. Ne ladataan `loadPdfJs()`-funktiolla vasta kun käyttäjä valitsee
PDF-tuonnin, joten CSV-käyttö ei kosketa niitä. Kirjastoa ei upoteta
`index.html`:ään (kolminkertaistaisi tiedoston koon) eikä haeta CDN:stä
(tuotavan ohjelman käsittely ei saa vaatia ulkopuolista palvelua). Jos
julkaisukansiota muutetaan, molemmat tiedostot on kopioitava mukana.

## PDF-ohjelmatuonti (toteutettu)

`parseProgramPDF()` ja sen apurit ovat `parseProgramCSV()`:n jäljessä
sellaisenaan. `extractPdfPages()` muodostaa rivit tekstipalojen
y-koordinaatista (`transform[5]`), ei pdf.js:n palauttamasta järjestyksestä.
`parseProgramPDFFiles()` yhdistää monta tiedostoa ja antaa viikkonumerottomille
tiedostoille viikoksi valintajärjestyksen.

Tuonti **ei tallenna suoraan**: `handlePdfFiles()` kutsuu
`startProgramImport(program, fileNames)`:ia, joka avaa jäsennetyn ohjelman
muokkaustilaan tilassa `"import"` (ks. Ohjelman muokkaustila). Kaikki viikot
ja päivät avataan, `needsReview`-rivit korostetaan `.needs-review`-luokalla
ja yhteenvetokortti kertoo tiedostot sekä tarkistettavien rivien määrän;
`methodNote` näytetään rivillä ja `program.notes` näkymän lopussa. "Valmis"
kutsuu `finishProgramEdit()`:n kautta `applyImportedProgram()`:ia — samaa
polkua kuin CSV-tuonti, ei omaa tallennuslogiikkaa. `needsReview` ja
`rawTarget` poistetaan tallennuksessa ja heti, kun rivi on muokattu
lomakkeessa. Erillinen tarkistusnäkymä (`state.pdfImport`, `state.view ===
"tuonti"`, `renderProgramReview()`) poistettiin UX-vaiheessa 5.

Liikeoliossa on PDF:n takia neljä valinnaista kenttää: `kind` (oletus
`"plain"`), `method`, `perSet`, `methodNote` ja `autoCalc`, sekä cluster-
liikkeellä `clusterRefReps` (ks. Cluster-sarjat). Kaikki ovat
valinnaisia, jotta vanhat tallennetut ohjelmat toimivat ennallaan:
`buildDraftRows()` ohittaa painoehdotuksen vain nimenomaisella
`autoCalc === false`:lla, ei puuttuvalla kentällä.

## Cluster-sarjat (toteutettu)

Liiketyyppi `kind: "cluster"` ja valinnainen `clusterRefReps` (viitetoistot,
oletus `CLUSTER_DEFAULT_REF_REPS` = 10, `clusterRefRepsFor(ex)`). Syntyy
PDF-tuonnista (`parseTarget` "2xCluster"; `attachDefinitions` poimii
selitteestä viitetoistot `clusterRefRepsFromText`-apurilla: "N toiston
maksimi" tai "NRM"), CSV-tuonnista (`ALIASES.kind` = Tyyppi/Kind/Menetelmä,
arvo `cluster`; sarakkeen puuttuessa sana cluster huomautuksessa, viitetoistot
huomautuksesta samalla apurilla) ja varmuuskopiosta (`Tyyppi`-sarake ja uusi
viimeinen `Viitetoistot`-sarake ohjelmarivillä; luetaan vain täytettynä).
`ensureProgramShape` ei lisää `kind`-kenttää: puuttuva = tavallinen liike.

Sarjariville tuli valinnainen `subsets` (osasarjojen lukumäärä), jota
käytetään vain cluster-liikkeellä; `setSubsets(set)` palauttaa 1, kun kenttä
puuttuu tai on 0, ja `setVolume(set)` = paino × toistot × osasarjat on ainoa
paikka, jossa volyymikaava on kirjoitettu (`ledgerTotal`, `renderDayCard`,
`historyDaySummary`, `buildTotalWeightSeries`, `buildVolumeByName`,
`buildWeeklySummary`, `buildPainAnalysis`; volyymissä ja viikkoyhteenvedossa
myös toistot kertaantuvat osasarjoilla). Merkintään tallentuu nyt
`kind: ex.kind || "plain"` (`saveExerciseLog`; vienti ja tuonti nojaavat
siihen), ja `lastSet`-sarjaan `subsets`, kun liike on cluster.

Esitäyttö on `buildDraftRows`-funktion ensimmäinen haara (ennen
`autoCalc === false` -tarkistusta, koska PDF antaa clusterille autoCalc
false): rivejä `ex.sets` (oletus 2), `reps` = `ex.reps`, `subsets` 0, paino
viitekuorma `state.clusterRef[nimi]`-välimuistista. Välimuistin täyttää async
`findClusterRefWeight(name, refReps)` (viimeisin muu kuin cluster-merkintä,
jossa jonkin sarjan toistot === refReps; kuorma näiden sarjojen suurin paino;
weight null = ei löytynyt), jota `prepareClusterRef(ex)` kutsuu
`toggleExercise`-, `[data-recalc]`- ja `performExerciseSwap`-poluilla ennen
`buildDraftRows`-kutsua. Välimuisti tyhjennetään kaikissa kohdissa, joissa
`state.kehitys = undefined` (haku ja korvaus yhdellä rivillä).
`state.autoCalcInfo[id] = { type: "cluster", refWeight, refReps, date,
lastSubsets }`; `lastSubsets` on viimeisimmän `lastSet`-kerran (tai sen
prior-kerran) osasarjat, jos sarjoilla on `subsets`, muuten null.
`autoCalcHint` kirjoittaa "Kuorma on viimeisin 10 toiston merkintä (60 kg,
1.9.). Viimeksi 5 + 4 osasarjaa — tavoitteena ylittää." tai "Clusterin
kuormaksi ei löytynyt aiempaa 10 toiston merkintää — syötä paino käsin."
Tavallisen liikkeen progressio käyttää `nonClusterSession(lastSet)`-apuria:
saman nimen cluster-kerrat (sarjoilla `subsets`) eivät kelpaa viitekerraksi
eivätkä jumitunnistuksen kertoihin.

Kirjaus: `renderLedger` piirtää cluster-rivin alle aina näkyvän
`.set-extra.cluster-row`-rivin: `[data-cluster-step="-1"]`, lukumäärä
`[data-cluster-num]` (`.cluster-num`, `aria-live`, `.done` vihreä) ja
`[data-cluster-step="1"]` (`.cluster-plus`, messinkitäyttö). Molemmat
painikkeet ovat 44 × 44 px kuten rivin ✓ ja lukumäärä 22 px: kehotteen
"plus on rivin suurin kosketuskohde" (56 px, flex:1) toteutettiin ensin,
mutta käyttäjä pyysi pienentämään ne huomattavasti muiden painikkeiden
kokoon (käyttäjän päätös). Tuntuma ja poisto ovat RPE-ikkunassa kuten muilla
sarjoilla (kehotteen "huomiokenttä laskurin alle" jäi toteuttamatta, koska
sarjan huomiokenttä poistettiin käyttäjän päätöksellä). Käsittelijä
`[data-cluster-step]`: plus kasvattaa `subsets`-arvoa, asettaa `dirtySets` ja
käynnistää `startRestTimer(CLUSTER_REST_SECONDS)` (15 s; noudattaa
`restTimerEnabled`-asetusta, käynnissä oleva ajastin alkaa alusta, sama
äänimerkki `finishRestTimer`-funktiosta); miinus ei vie nollan alle eikä
käynnistä ajastinta; nollaan laskeminen purkaa valmiiksi-merkinnän.
`isRowDoneEligible`: paino ja `subsets >= 1`; `toggleSetDone` antaa toastin
"Tee vähintään yksi osasarja ennen kuin merkitset clusterin valmiiksi".
`saveExerciseLog`-suodatin hyväksyy rivin myös `subsets > 0`:lla. "+ Sarja"
cluster-liikkeellä kopioi edellisen rivin painon, ohjelman toistot ja 0
osasarjaa. `renderLastCell` näyttää "60×6×5", kun viime kerran sarjalla on
osasarjoja > 1.

Historia: rivi "60 kg × 6 × 5" (subsets > 1) ja tunniste "cluster" nimen
perässä. Ohjelma-näkymä: tallennettu cluster näyttää suljettuna rivin
"Kirjattu: 60 kg · 5 + 4 osasarjaa" (`clusterSummaryText`); päiväkortti
laskee kilot `setVolume`-apurilla. Kehitys: `buildAllOneRepMaxSeries` ja
`buildRecordsByName` ohittavat `kind === "cluster"` -merkinnät (6 toiston
osasarja 10RM-kuormalla antaisi Epleyllä 1,2 × paino, viitemerkintä 1,33 ×
paino → keinotekoinen notkahdus); `rebuildManualMaxForName` ohittaa ne ja
`saveExerciseLog` ei päivitä 1RM:ää cluster-liikkeelle.
`buildAdherenceByName` kerää `clusterSessions` (`date`, `subsets`-summa,
`weight`, rivien osasarjat) ja `renderAdherenceTab` näyttää taulukon
"Cluster-kerrat" (Pvm, Kuorma, Osasarjat). Cluster-only-liike ei näy
Kehityksen listassa, koska lista rakentuu 1RM-sarjoista (viikon 1
maksimitesti tuo sen).

Vienti: `#MERKINNÄT`-osion viimeinen sarake on nyt `Osasarjat` (Tuntuman
jälkeen); tuonti `findCol(["osasarjat","subsets"])`, tyyppilista
`["max","percent","plain","cluster"]`, `subsets` vain cluster-riville
positiivisena kokonaislukuna; duplikaattitunniste on
`paino x toistot x osasarjat` (puuttuva = 1) molemmin puolin. Simulointi
antaa cluster-liikkeelle vakiokuorman ja osasarjat 3 → 6 sekä merkintään
`kind`. Muokkaustilan `noAutoCalcReason` kertoo clusterin kuormasäännön.
Testi: `test_cluster.js` (fixture `prog_cluster.csv`; kehotteen tapaukset
1–12, ajastintesti odottaa 16 s äänimerkkiä). `test_rir.js` odottaa
otsikkorivillä Tuntuman jälkeen Osasarjat-saraketta.

## Ohjelman rakentaminen sovelluksessa (toteutettu)

Kolmas tapa saada ohjelma sovellukseen CSV- ja PDF-tuonnin rinnalle.
Sisääntulo on sekä alkunäytöllä (`renderUpload`) että Asetusten Ohjelma-osiossa
(`[data-builder-start]`). Rakentajalla ei ole omaa näkymää eikä omaa tilaa:
`startProgramBuilder()` avaa muokkaustilan tilassa `"new"` runkokyselyllä
(ks. alakohta Runkokysely ja viikon monistus; aiemmin luonnos oli
`{ days: [Päivä 1], weeks: ["1"], weekLabels: {} }`), ja kaikki rivit,
lomakkeet, kopiointi ja poisto ovat muokkaustilan omia (seuraava osio).
Aiempi erillinen rakentaja (`state.builder`, `renderProgramBuilder()`,
`builderProgramFromDraft()`, `data-builder-*`) poistettiin UX-vaiheessa 5,
koska se oli sama käyttöliittymä toiseen kertaan.

"Valmis" tallentaa uudessa ja tuontitilassa `finishProgramEdit()`:n kautta
`applyImportedProgram()`:lla — ei omaa tallennuslogiikkaa. Tämä on oleellista:
Historia- ja Kehitys-yhteys toimii liikkeen nimen perusteella, joten
rakentajan on tuotettava täsmälleen samanmuotoisia liikeolioita kuin tuonti
(`editorSaveForm()` luo liikkeen `parseProgramCSV()`:n muodossa). Ennen
tallennusta `draftProblem(draft, mode)` estää tyhjän ohjelman, kaksi
samannimistä viikkoa (`weekDisplayNameIn`; viikkovalitsin näyttää nimen) ja
saman viikon kaksi samannimistä päivää; liikkeetön päivä ja päivätön viikko
jätetään pois ja `weekLabels` siivotaan poistuneista viikoista.

Liike valitaan pohjalevystä `state.sheet === "liike"`
(`renderExercisePickList(query)`, `exercisePickEntries()`):
`knownExerciseNames()`-nimet ryhmässä `PICK_GROUP_KNOWN` ("Ohjelmassa ja
historiassa") lisätään **ensin**, jotta myös katalogin nimi, jolla on
merkintöjä, näkyy tässä ryhmässä (välineen hakusana haetaan katalogista),
ja ryhmä on listan ensimmäinen; sen jälkeen koko `allExerciseVariants()`-
katalogi koostettuina niminä lihasryhmittäin aakkosissa. Haku
suodattaa nimen ja lihasryhmän mukaan, ja jokaisen sanan on osuttava;
hakulista päivitetään `#liike-lista`-elementtiin suoraan DOM:iin ilman
`render()`-kutsua, jottei fokus katoa. Kirjoitetun nimen voi aina ottaa
käyttöön (`[data-pick-free]`; rivi on listan lopussa, kun osumia on, ja ainoa
rivi, kun osumia ei ole), jolloin `findSimilarName()` huomauttaa katalogin
samankaltaisesta nimestä. Enter valitsee ensimmäisen katalogiosuman tai
kirjoitetun nimen, jos osumia ei ole.
"Lisää liike" avaa lomakkeen ja pohjalevyn yhtä aikaa. Lomakkeen nimikenttä
on painike `.pick-field[data-editor-name][data-open-sheet="liike"]`
(näyttää nimen tai "Valitse liike"; ei `<input>`-kenttää eikä datalist-
ehdotuksia, koska iOS Safari ei näytä niitä ja käyttäjä ei löytänyt
listaa), joka avaa pohjalevyn aina tyhjällä haulla (`pickerQuery = ""`)
ja fokusoi hakukentän; `closeSheet()` palauttaa fokuksen painikkeeseen.
Olemassa olevaa liikettä muokattaessa pohjalevyn yläreunassa on rivi
`.pick-current` ("Nykyinen: nimi") ja `[data-pick-edit-current]`, joka
kirjoittaa nimen hakukenttään suoraan DOM:iin (kirjoitusvirheen korjaus
tai vapaa nimi). Nimi kirjoitetaan `state.editor.form.name`-kenttään vain
`[data-pick-exercise]`-valinnasta. Testit: `test_picker.js`. Liikelistaa ei koodattu erillisenä `EXERCISE_LIBRARY`-
vakiona: `EXERCISE_VARIANTS` sisältää jo `lihasryhma`-kentän, joten toinen
lista olisi ollut sama tieto kahdesti. `exerciseOptionsByGroup()` on yhä
liikkeen vaihdon käytössä.

**Ratkaistu kysymys:** rakentaja luo aina uuden ohjelman tyhjästä. Olemassa
olevan ohjelman muokkaus on sama muokkaustila tilassa `"edit"`, ei erillinen
toteutus. Yksittäisen liikkeen vaihto on lisäksi Ohjelma-näkymässä.

### Runkokysely ja viikon monistus (toteutettu, 0.4.19, Rakentaja-sarja 1/3)

`blankEditor()` sai kentät `stage` (`"setup"` | `"build"`, oletus build,
joten muokkaus- ja tuontitila alkavat suoraan build-vaiheesta) ja `setup =
{ daysPerWeek: 3, weeks: 4, weekless: false }`. `startProgramBuilder()`
avaa tyhjän luonnoksen `{ days: [], weeks: [], weekLabels: {}, id, name: "" }`
tilassa `"new"` ja `stage = "setup"`; `renderEditor()` palauttaa silloin
`renderBuilderSetup()`:n (nimikenttä samalla `[data-editor-program-name]`-
input-käsittelijällä, `.segmented.builder-days` `[data-setup-days]` 2–6
`aria-pressed`, askeltin `[data-setup-weeks="-1"|"1"]` `aria-label`
"Vähennä/Lisää viikkoja" disabled arvoilla 1 ja 12, `.builder-count`
`aria-live`, `[data-setup-weekless]` `change`-käsittelijässä piilottaa
`.builder-row`-rivin luokalla `hidden`, ja `state.program`-ohjelman kanssa
`<button class="exercise builder-card builder-copy" data-setup-copy-current>`
vihjeellä "nimi · N viikkoa · k päivää", jossa k on ensimmäisen viikon
päivien määrä, viikottomalla kaikki päivät). `renderEditBar()` näyttää
setup-vaiheessa Peruuta ja `[data-setup-continue]` "Jatka" →
`builderApplySetup()`: viikot "1"…N ja jokaiselle `daysPerWeek` päivää
`{ id: newDayId(), label: "Päivä i", name: "", week, exercises: [] }`
(viikoton: `week: null`, `weeks []`), viikko 1 ja ensimmäinen päivä auki,
`baseline` = luodun rungon JSON (kysely ei ole muutos → Peruuta poistuu
ilman vahvistusta; kirjoitettu nimi tekee luonnoksesta muuttuneen jo
kyselyssä, koska baseline on tyhjä luonnos). `builderFromCurrentProgram()`
syväkopioi `state.program`-ohjelman uusilla ohjelma-, päivä- ja liike-
id:illä (`state.programDraft = src` asetetaan ennen `cloneExercises`-
kutsua), nimi "<nimi> (kopio)", `needsReview`/`rawTarget` poistetaan,
baseline = kopio, ensimmäinen viikko auki. `finishProgramEdit` on
ennallaan: tyhjät päivät ja viikot pudotetaan uudessa tilassa, nimetön
ohjelma saa nimen "Oma ohjelma".

Monistus: `emptyDraftWeeks(exceptKey)` = viikot ilman yhtään liikettä
(myös päivättömät; `every` tyhjällä listalla). `editorReplicateWeek(srcKey)`
korvaa jokaisen tyhjän viikon päivät lähdeviikon päivien kopioilla
(`newDayId`, `cloneExercises`; `weekLabels` ei kopioidu), sijoittaa ne
edeltävän päivällisen viikon perään `insertDaysAfterWeek`-kutsulla
(ilman edeltävää listan alkuun) ja ilmoittaa "Monistettu viikoille 2, 4,
5, 6" (yksi kohde: "viikolle 2"). `renderReplicateCard()` viikkolistan
jälkeen ennen "Lisää tyhjä viikko" kaikissa tiloissa, kun viikkoja > 1,
ensimmäisellä viikolla on liikkeitä ja jokin muu viikko on tyhjä:
otsikko "Monista Viikko 1 viikoille 2–6" (tyhjien ensimmäinen–viimeinen,
vaikka välissä olisi täytetty viikko; ilmoitus luettelee vain täytetyt),
vihje "Kopioi päivät ja liikkeet; painot ehdotetaan kirjauksessa" ja
`[data-edit-replicate="1"]` "Monista" `btn-primary`. Kohinan poisto:
`editorMoveButtons` palauttaa tyhjän, kun `count < 2`, ja
`editorRestartButton` tilassa `"new"` (ohjelmatason painike oli jo vain
edit-tilassa). CSS `.builder-*` kehotteen arvoilla `.editor-title`-
sääntöjen perässä; lisäksi `.builder-days{display:flex}`, jotta
segmentti täyttää kortin leveyden (`.segmented` on inline-flex). Huomio:
`.builder-hint`-väri `--line-strong` on kehotteen arvo ja axe ilmoittaa
sen kontrastista. Testi: `test_rakentaja_1.js` (kehotteen tapaukset
1–16; ei repossa).

### Liikkeen lisäyssilmukka ja lomakkeen tiivistys (toteutettu, 0.4.20, Rakentaja-sarja 2/3)

`blankEditor()` sai `formMore` (yksikkö- ja tehokentät näkyvissä) ja
`formPrefilled` (vihje). `editorOpenForm(dayId, exId)` esitäyttää uuden
liikkeen sarjat, toistot ja yksikön päivän viimeisestä liikkeestä
(`unit` puuttuessa "toistoa") ja asettaa `formMore` todeksi vain, kun
yksikkö on muu kuin "" tai "toistoa" tai teho on epätyhjä (sama sääntö
muokkauksessa). `editorSaveForm(addNext)`: lisäyshaarassa `addNext`
avaa `editorOpenForm(sama päivä, null)` uudelleen (esitäyttö juuri
lisätystä, valitsin auki) ja ilmoittaa "Lisätty: nimi"; muokkaushaara
sulkee aina. `renderExerciseForm` (`.exercise.editor-form`): kicker
`.editor-form-kicker` "Liike n" (päivän liikkeet + 1) tai "Muokkaa
liikettä", nimipainike ja tunnistusrivi ennallaan, `.editor-form-fields`
Sarjat ja Toistot (näppäimistö ennallaan), `.editor-form-hint`
"Esitäytetty edellisestä liikkeestä" vain lisäyksessä `formPrefilled`-
tilassa, avaus `#editor-form-more[data-edit-form-more]` `aria-expanded`
("Lisää asetuksia (yksikkö, teho) ▾" / "Vähemmän asetuksia ▴") ja
`.editor-form-extra` (yksikkö, teho, `noAutoCalcReason`) vain avattuna,
`editor-swap-all` ennallaan, painikerivi `.editor-form-actions`:
lisäyksessä Peruuta (flex 1) + `[data-edit-form-save-next]` "Tallenna
ja lisää seuraava" (`btn-primary`, flex 2) ja alla `.editor-form-
secondary` `[data-edit-form-save]` "Tallenna ja lopeta"
(`btn-tertiary`); muokkauksessa Peruuta / Tallenna. Kaikki 40 px:
`.editor-form-actions .btn-sm` sai kehotteen `min-height` lisäksi
`padding 10px` ja `white-space:nowrap`, koska "Tallenna ja lisää
seuraava" rivittyi 390 px:ssä kahdelle riville (49 px). `focusDescriptor`
hyväksyy nyt myös `BUTTON`-elementin, jolla on id, jotta avauksen piirto
palauttaa fokuksen `#editor-form-more`-painikkeeseen. Lomakkeen inline-
tyylit (`flex:0.7` ym.) korvattiin luokilla. Tallennusmuoto ei
muuttunut. Testi: `test_rakentaja_2.js` (kehotteen tapaukset 1–13).

### Tasoittainen navigointi (toteutettu, 0.4.21, Rakentaja-sarja 3/3)

Muokkaustila ei enää piirrä viikkoja, päiviä ja liikkeitä sisäkkäisinä
haitareina vaan tasoina. `blankEditor()`: `openWeeks`, `openDays` ja
`menuFor` poistettiin; tilalla `level = { kind: "root" | "week" | "day",
key }` ja `levelMenu` (tason ⋮-valikko auki). `editorGoTo(kind, key)`
nollaa näppäimistön, lomakkeen, valikon ja `confirmDelete`-tilan,
vaihtaa tason, vierittää ylös ja fokusoi `#editor-title`-elementin
(`afterRender`); `editorGoUp()` palaa päivästä viikkoon (viikoton →
juuri) ja viikosta juureen. Aloitustasot: `startProgramEdit` →
`editorGoTo("week", activeWeek)`, kun viikko on ohjelmassa, muuten juuri;
`startProgramImport` ja `builderFromCurrentProgram` → juuri;
`builderApplySetup` asettaa tason suoraan ensimmäiseen päivään ja kutsuu
`editorOpenForm(päivä, null)` (lisäyslomake ja valitsin auki; ei
`editorGoTo`-kutsua, jotta fokus päätyy hakukenttään eikä otsikkoriviin).
Mutaatiofunktiot eivät enää koske avaustilaan; `editorCopyWeek`,
`editorAddWeek`, `editorAddDay` ja `editorCopyDay` palauttavat uuden
avaimen/olion, ja click-käsittelijä navigoi sille (`editorGoTo`).
Poiston jälkeen käsittelijä navigoi ylemmälle tasolle (viikko → juuri,
päivä → viikko tai juuri); liikkeen poisto jää päivätasolle.
`renderEditor()` valitsee tason (`renderEditorRoot`,
`renderEditorWeekScreen`, `renderEditorDayScreen`) ja palauttaa juureen,
jos kohde on kadonnut; kysely (`stage "setup"`) on ennallaan.

`renderScreenHead` sai valinnat `titleHtml` (h1:n tilalle; nimi on
`<input>`, joka ei saa olla otsikon sisällä), `headId` (otsikkorivi saa
`id`, `tabindex="-1"`, `role="group"`) ja `ariaLabel` (ruudun nimi).
Viikko- ja päivätasolla `renderHeader` palauttaa tyhjän (logorivi vain
juuressa), ja juuren ohjelmakortti `.editor-root-card` on `#editor-title`
(kicker `editorTitle()`, luvut "6 viikkoa · 4 treenipäivää viikossa ·
14 liikettä" — "viikossa" vain, kun jokaisella viikolla on yhtä monta
päivää, muuten päivien kokonaismäärä; viikoton "3 treenipäivää · …").
Rivit `editorRowHtml`: `.editor-row` (div) → `button.editor-row-main`
(`data-edit-open-week` / `data-edit-open-day` / `data-edit-exercise`,
rengas `editorRing` `.editor-row-ring[.filled]` + `sr-only` "liikkeitä
lisätty", `.editor-row-name`, `.editor-row-sub`) + `.editor-row-tools`
(siirtonuolet, vain `count ≥ 2`) + `.chevron`. Alarivit: viikko "4 päivää
· 14 liikettä" / "… · ei liikkeitä", päivä "3 liikettä" / "ei liikkeitä",
tuontitilassa lisäksi `.review` "2 riviä tarkistettavana"
(`reviewSub`); liike "3 × 8 · tanko" (väline `catalogPartsFor(...).valine`)
tai `.review` "Tarkista: …", tunnistamattomalla `.recognition-note` ja
`methodNote` samassa alarivissä, `needs-review`-luokka rivillä. Tason
⋮ (`editorLevelMenuButton`, `[data-edit-level-menu]`) avaa
`.editor-strip.editor-level-menu`-rivin: Kopioi viikko/päivä
(`data-edit-copy`), Aloita uudelleen (ei `new`, `editorRestartButton`) ja
kaksivaiheinen Poista (`editorDeleteButton`). Liikkeen poisto on
muokkauslomakkeen painikerivillä Peruuta-painikkeen vieressä
(`editorDeleteButton("ex:…", "Poista")`, tertiary → Vahvista).
Päivätasolla lomake avautuu rivin alle (`.editor-list` katkaistaan);
listan alla lisäyslomake tai `+ Lisää liike`; viikkotasolla `+ Päivä`;
juuressa monistuskortti ja `+ Tyhjä viikko`, `Kopioi viimeinen viikko`
(`.editor-level-actions`, 40 px). Kickerit "Ohjelma › Viikko 1",
"Viikko 1 › Päivä 2" (päivän järjestysnumero viikon sisällä, ei label),
viikoton "Päivä 2"; takaisin `aria-label` "Takaisin ohjelmaan" /
"Takaisin viikkoon". `keydown`-lista sai `data-edit-open-week`,
`data-edit-open-day` ja `data-edit-back`, mutta aidolle `<button>`-
kohteelle käsittelijä ei tee synteettistä clickiä (tuplaisi toiminnon).
CSS: `.editor-head`, `.editor-title`, `.editor-children` ja `.editor-add`
poistettu; `.editor-list`, `.editor-row*`, `.editor-level-actions`
kehotteen arvoilla (+ `.editor-row-text` sarakkeeksi ja
`-webkit-tap-highlight-color`); `.editor-strip`, `.editor-icon`,
`.editor-note`, `.editor-row.needs-review` (vain tausta) säilyvät.
Huomio: `.editor-row-ring` ei ole `.day-ring`, vaikka tyyli on sama,
jotta Ohjelma-näkymän rengasta voi muuttaa erikseen. Testi:
`test_rakentaja_3.js` (kehotteen tapaukset 1–16; tuontitilaa ei voi
käynnistää testissä ilman PDF:ää, joten tapaus 9 tarkistaa
`needsReview`-rivin päivätasolla edit-tilassa ja sen, ettei
"tarkistettavana"-teksti näy edit-tilassa; import-haara on sama koodi
`state.editor.mode`-ehdolla). `test_rakentaja_1.js` ja
`test_rakentaja_2.js` sovitettiin tasoihin (päivä avataan viikkotasolta,
liikkeen poisto lomakkeessa).

## Liikepankki (toteutettu, versio 4.9.2026)

`EXERCISE_VARIANTS` on generoitu tiedostosta
`Kuntosaliliikkeet_ja_lihasryhmat_v4_9_2026.xlsx` (taulukko
"Kuntosaliliikkeet", sarakkeet Liikkeen nimi, Väline, Variaatio, Lihasryhmä;
ei Lisävariaatio-saraketta): 905 riviä / 354 liikettä lähteen järjestyksessä,
rivin muoto `{ liike, valine, variaatio, lisavariaatio:null, lihasryhma }`.
Lähdetaulukko ja generointiskripti eivät ole repossa; katalogin
otsikkokommentti kertoo tuonnissa tehdyt tarkistukset (ei kaksoisrivejä,
yksi väline ja yksi lihasryhmä per liike) sekä variaatiosäännön: vain talja-
(9 kahvaa) ja tankoliikkeillä (6 tankoa) on variaatiot, aina koko sarja, ja
27 talja-/tankoliikettä on tarkoituksella ilman. `lisavariaatio` säilyy
kentässä, koska CSV-tuonti ja `state.userExercises` käyttävät sitä.

`valine` on käytössä kolmessa paikassa: `exercisePickEntries()` lisää sen
hakusanoihin (`renderExercisePickList` osuu nimeen, lihasryhmään ja
välineeseen), `catalogPartsFor()` liittää sen Ohjelma-näkymän
tarkenneriville (`equipmentForLiike()` samalla ensimmäisen rivin säännöllä
kuin `muscleGroupForLiike()`) ja `renderVariantPicker()` liittää sen
esikatseluun. Käyttäjän omilla liikkeillä ei ole välinettä (lomake ja
varmuuskopion `#OMAT LIIKKEET` ennallaan), jolloin sitä ei näytetä.

`catalogPartsFor(name)` jakaa liikkeen nimen katalogin mukaan: pisin
pilkuilla rajattu alkuosa, joka osuu `resolveCatalogMatch()`-funktioon
(koostettu rivi tai pelkkä liikenimi), on `liike`; loput ovat
`variantText` (variaatio, lisävariaatio ja muu häntä) ja `details` on
`[valine, variantText, lihasryhma]` ilman tyhjiä. Katalogin ulkopuolinen
nimi palauttaa null. Tulos muistetaan `catalogPartsCache`-oliossa avaimella
`nimi|omien liikkeiden määrä`, joten omien liikkeiden lisäys ei vaadi
tyhjennystä. `baseExerciseName(name)` palauttaa `liike`-osan tai koko
nimen. Käyttöpaikat: `renderExercise()` (otsikkona `liike`, alla
`.exercise-detail`-rivi `details.join(" · ")`; aiempi "Tunnetut
variaatiot" -rivi (`renderVariantInfo`) on poistettu käyttäjän pyynnöstä),
`buildAllOneRepMaxSeries()` ja
`buildPainAnalysis()` (sarjan avain on `baseExerciseName`, joten eri tangolla
tai kahvalla kirjatut merkinnät ovat yksi liike; 1RM-sarja kerää
`variants`-joukon ja kortti näyttää rivin "Variaatiot: …", kun niitä on
useampi). Historia, painoehdotus (`state.lastSet`) ja 1RM-arvot
(`state.manualMax`) käyttävät edelleen koko nimeä, koska eri tanko voi
vaatia eri painon. Testi: `test_variant_merge.js` (fixture
`prog_variants.csv`).

Edellinen katalogi (97 liikettä, 10 lihasryhmää, mm. "Jalat", "Ojentajat",
"Olkapäät") korvattiin kokonaan; vain 14 nimeä säilyi. Ohjelmien ja
merkintöjen nimiin ei koskettu, koska katalogi on vain valitsimien
viitetaulukko; vanhalla nimellä oleva liike näkyy liikevalitsimessa ryhmässä
"Ohjelmassa ja historiassa" (`knownExerciseNames()`, luetaan tallennetusta
ohjelmasta, ei muokkaustilan luonnoksesta). Testien fixture `prog_swap.csv`
käyttää katalogin nimiä; testit `test_catalog.js`, `test_swap_regression.js`.
Huomio: kiinteä alavalikko on läpikuultava, joten axe voi ilmoittaa
välilehden tekstin kontrastista, kun messinkinen painike osuu sen alle —
riippuu vierityskohdasta eikä katalogista.

## Ohjelman muokkaustila (toteutettu)

Tietomalli sai kolme kenttää, kaikki valinnaisia vanhojen tallennusten takia:
`program.weekLabels` (`{ "4": "Kevennysviikko" }`, puuttuva avain = "Viikko N"),
`day.id` (`day-<aikaleima>-<laskuri>`, `newDayId()`) ja `day.label` (päivän nimi
ilman viikko-osaa). `day.name` säilyy koostettuna näyttönimenä
(`dayDisplayNameIn(program, day)` = viikon nimi + " · " + label), koska muut
lukupaikat käyttävät sitä. `ensureProgramShape(program)` täydentää puuttuvat
kentät ja palauttaa true, jos jotain lisättiin; sitä kutsutaan initissä (vanha
tallennus kirjoitetaan täydennettynä takaisin), PDF-tuonnissa, varmuuskopion
luvussa ja `startProgramEdit()`:ssä. CSV-jäsennin ja rakentaja tuottavat kentät
suoraan. `dayKey(day)` palauttaa `day.id`:n, kun se on, ja vasta muuten
`week|name`-avaimen. `dayCardTitle(day)` valitsee korttiin `day.label`:n
viikkonäkymässä ja `dayDisplayName(day)`:n koko ohjelman näkymässä.

Muokkaus kohdistuu vain `state.programDraft`-syväkopioon. `state.editMode`
vaihtaa `renderBody()`:n `renderEditor()`:iin, `renderHeader()` pudottaa
navigaation ja näyttää tilan otsikon (`EDITOR_TITLES`), ja `render()` lisää
kiinteän `.edit-bar`-alapalkin (`<footer>`, jotta se on maamerkki; painikkeet
Peruuta ja Valmis). `enterEditor(draft, mode)` alustaa tilan; `mode` on
`"edit"` (nykyinen ohjelma), `"new"` (rakentaja) tai `"import"`
(PDF-tarkistus). Muokkaustilan oma tila on `state.editor = blankEditor()`:
`mode`, `level` ja `levelMenu` (tasoittainen navigointi, ks. Rakentaja-
sarja 3/3; aiemmat `openWeeks`, `openDays` ja `menuFor` on poistettu),
`editingExercise`, `addingExerciseTo`, `confirmDelete` (`"delete:<kohde>"`
tai `"restart:<kohde>"`, kohde `week:<avain>`, `day:<id>`, `ex:<id>` tai
`program`), `confirmCancel`, `swapAll`, `form`, `baseline`
(luonnoksen JSON alussa; muutosvertailu), `returnView` (näkymä, johon
Peruuta palaa uudessa ja tuontitilassa), `importInfo` (tiedostot ja
tarkistettavien rivien määrä) ja `pickerQuery`. Nimikentät
kirjoittavat luonnokseen input-tapahtumassa ilman `render()`-kutsua, jottei
fokus katoa; tyhjä päivän nimi hylätään change-tapahtumassa. Klikkikäsittelijän
alussa avoin vahvistus nollataan, jos painallus osuu muualle.

`finishProgramEdit()` järjestää päivät vakaasti `weeks`-järjestykseen (koko
ohjelman näkymä iteroi `days`-listaa sellaisenaan), kirjoittaa `day.name`-kentät
`dayDisplayNameIn(draft, day)`:llä, korvaa `state.programin`, tallentaa
`saveProgram()`:lla ja siivoaa poistuneiden id:iden `draftSets`, `dirtySets` ja
`autoCalcInfo`. Uudessa ja tuontitilassa se sen sijaan pudottaa liikkeettömät
päivät ja päivättömät viikot ja kutsuu `applyImportedProgram()`:ia. Kaikissa
tiloissa `draftProblem()` tarkistetaan ensin. Muokkaustilassa ilman muutoksia
Valmis ja Peruuta sulkevat heti; muutosten kanssa (luonnos poikkeaa
`baseline`-tilasta) Peruuta vaatii toisen painalluksen.

Id-säännöt ovat samat kuin tuonnissa ja liikkeen vaihdossa: sarjojen, toistojen
tai tehon muutos säilyttää id:n (tehty-tila jää), nimen muutos kulkee
`applyExerciseSwap(program, id, newName, allOccurrences)`-ytimen kautta (uusi
id; vanha merkintä jää historiaan vanhalla nimellä), ja "Aloita uudelleen"
(`editorRestart(target)`) antaa uudet id:t `newExerciseId(program)`:lla. Kopiot
(`editorCopyWeek`, `editorCopyDay`) saavat uudet päivä- ja liike-id:t; viikon
nimeä ei kopioida. Uusi liike luodaan täsmälleen `parseProgramCSV()`:n muodossa
(`kind:"plain"`, `autoCalc:true`, `weight:""`, `notes` = tehoteksti).
`applyExerciseSwap` on puhdas (ei tallenna, ei piirrä); kirjausnäkymän vaihto
käyttää sitä `performExerciseSwap()`:n kautta.

Liikkeen tunnistus: `exerciseRecognition(name)` palauttaa `history`
(`state.lastSet`/`state.manualMax` samalla trim+toLowerCase-avaimella kuin
painoehdotus), `catalog` (`catalogPartsFor`, myös omat liikkeet) tai
`unknown`. `renderEditorExercise` antaa nimelle luokan `.name-known`
(vihreä, `--success`) tai `.name-unknown` (messinki) ja `data-recognition`-
attribuutin, ruudunlukijalle `.sr-only`-tekstin "(tunnistettu
liikepankissa/historiassa)" ja tunnistamattomalle rivin
`.editor-note.recognition-note` (`RECOGNITION_NOTE`). Lomakkeessa sama tila
on nimipainikkeen alla (`[data-form-recognition]`: `.recognition-ok`
"Tunnistettu: …" tai huomioteksti). Ohjelman omat nimet eivät sellaisenaan
tee liikettä tunnistetuksi — vain liikepankki ja historia — jotta
tuonnin roskanimi ei näytä vihreältä. Testi: `test_recognition.js`
(fixture `prog_recog.csv`).

Sisääntulot: kynäkuvake `[data-edit-program]` Ohjelma-näkymän otsikossa ja
"Muokkaa nykyistä ohjelmaa" Asetusten Ohjelma-osiossa. Välilehden vaihto
muokkaustilassa estetään toastilla, vaikka navigaatio ei muokkaustilassa näy.
Testit: `test_editor.js` (kehotteen kohdan 7 tapaukset ja vanhan ohjelman
migraatio), `test_builder.js`, `test_builder_edge.js`,
`test_builder_history.js` (rakentaja tilassa `"new"`) ja
`test_pdf_regression.js` (tuonti tilassa `"import"`).

## Varmuuskopio (toteutettu)

Yksi CSV-tiedosto, joka jakautuu `#`-alkuisiin osioriveihin: `#MERKINNÄT`,
`#OHJELMA`, `#OHJELMAN MUISTIINPANOT`, `#OMAT LIIKKEET` ja `#1RM`. Merkinnät ovat
ensimmäisenä samana taulukkona kuin ennen tätä, ja `splitBackupSections()` lukee
ennen ensimmäistä merkkiriviä olevan tekstin merkinnöiksi — näin vanhat, pelkät
merkinnät sisältävät vientitiedostot tuodaan yhä muuttumattomina.

Merkintärivin `Tunniste`-sarake on liikkeen ohjelma-id. Palautuksessa merkintä
kirjoitetaan takaisin täsmälleen samalle avaimelle, joten sidonta ohjelmaan on
eksakti eikä `matchImportedDatesToProgramDays()`-heuristiikkaa tarvita —
heuristiikka jää voimaan vain tunnisteettomille (vanhoille) tiedostoille.

Merkintäosiossa liikkeen lämmittelyt (`data.warmups`) viedään työsarjojen
jälkeen riveinä, joiden `Sarja` on `L1`, `L2`, … (paino, toistot, `Tuntuma`
sanana; Huomiot ja Osasarjat tyhjiä), jotta RPE-tiedot ovat varmuuskopiossa
kokonaan (käyttäjän pyyntö 10.9.2026). `parseEntriesCSV()` tunnistaa
`/^L\d+$/`-rivin, liittää sen edeltävään lohkoon (`block.warmups`, ei
aloita uutta lohkoa eikä vaikuta duplikaattitunnisteeseen) ja
`importEntriesData()` kirjoittaa ne merkintään `warmups`-kenttään, josta
`rebuildTrackersForName()` rakentaa `lastSet`-lämmittelyt. Vanha tiedosto
ilman L-rivejä tuodaan ennallaan.

`intensityToText()` kirjoittaa tehon takaisin samaan muotoon, josta
`parseIntensity()` sen lukee, jotta `intensity`-olio syntyy uudelleen samana.
`parseBackupProgram()` asettaa valinnaiset PDF-kentät (`method`, `perSet`,
`methodNote`) vain jos ne olivat täytettyjä; puuttuminen ja tyhjä arvo ovat
sovelluksessa sama asia, koska kaikki lukupaikat testaavat totuusarvon.
Ohjelmarivillä ovat lisäksi sarakkeet `Viikon nimi`, `Päivän tunniste` ja
`Päivän nimi` (muokkaustilan kentät). `parseBackupProgram()` asettaa `day.id`:n
ja `day.label`:n vain täytetystä sarakkeesta ja kutsuu lopuksi
`ensureProgramShape()`:a, joten vanhat varmuuskopiot saavat uudet
päivätunnisteet; se ei vaikuta palautukseen, koska merkinnät sidotaan
liike-id:eihin, eivät päivä-id:eihin. Päiväolion avainjärjestys on sama kuin
`parseProgramCSV()`:ssä, jotta palautettu ohjelma on JSON-muodossaankin
täsmälleen viedyn kaltainen (testi vertaa merkkijonoja).

`program.definitions` jätetään tietoisesti pois: `attachDefinitions()` on jo
kirjoittanut sen sisällön liikkeiden `methodNote`-kenttiin, eikä taulukkoa lueta
enää tuonnin jälkeen missään.

`unwrapExcelBackupText(text)` ajetaan `readBackupFile()`:ssä ennen
`splitBackupSections()`-kutsua: suomalainen Excel lukee pilkuilla erotellun
tiedoston jokaisen rivin yhdeksi soluksi ja tallentaa rivin muodossa
`"2026-09-04,""Liike, Variaatio"",""1"",…"`. Rivi, joka jäsentyy yhdeksi
kentäksi ja sisältää `,"`, puretaan (`parseCSVLine` kahdesti) ja kirjoitetaan
takaisin `csvRows()`-muotoon; jos kenttiä on osion otsikkoa enemmän, koska
Excel poisti ensimmäisen kentän lainausmerkit ja nimessä oli pilkku,
ylimääräiset alkukentät liitetään yhteen `", "`-erottimella. Tavallinen
vientitiedosto ei muutu (rivit jakautuvat useaan kenttään). Osion otsikon
kenttämäärä nollataan `#`-merkkirivillä. Desimaalipilkun lukee `toNumber()`.
Testi: `test_backup_excel.js` (fixturet `backup_excel1.csv`, `backup_excel2.csv`
koekäyttäjän tiedostoista).

`applyBackupRestore()` palauttaa järjestyksessä omat liikkeet → 1RM → ohjelma →
merkinnät. Järjestys on pakollinen: merkinnät sidotaan ohjelman liike-id:eihin,
joten ohjelman on oltava paikallaan ensin. Ohjelmaosio sisältää kaikki
kirjaston ohjelmat (sarakkeet `Ohjelman tunniste`, `Ohjelman nimi`,
`Käytössä`; muistiinpanoilla `Ohjelman tunniste`), ja `parseBackupProgram()`
palauttaa `{ programs, activeId }`. Palautus lisää puuttuvat ohjelmat
kirjastoon (sama tunniste laitteella = ohitetaan), ottaa varmuuskopiossa
käytössä olleen käyttöön ja siirtää laitteen nykyisen kirjastoon, joten se
vahvistetaan erikseen (`state.pendingRestore` + `renderRestoreConfirm()`);
ilman ohjelmaosiota oleva tiedosto tuodaan suoraan. Vanha tiedosto ilman
ohjelmasarakkeita luetaan yhdeksi ohjelmaksi.

`state.manualMax` on avaimenaan liikkeen nimi muodossa `nimi.trim().toLowerCase()`
— sama sääntö kaikissa lukupaikoissa. Vienti kirjoittaa nimen ohjelman
kirjoitusasussa (`maxExerciseNames()`), tuonti lukee sen takaisin samalla
trim+toLowerCase-säännöllä, joten kierros on tarkka kirjoitusasusta riippumatta.
`mergeManualMax()` ohittaa liikkeen, jolla on jo arvo laitteella: vanhemman
varmuuskopion palautus ei saa laskea tuoreempaa 1RM:ää huomaamatta. Sama
"jo olemassa oleva voittaa" -sääntö on merkinnöillä ja omilla liikkeillä.
`importEntriesData()` kutsuu vain `rebuildTrackersForName()`, ei
`rebuildManualMaxForName()`:ia, joten merkintöjen tuonti ei ylikirjoita juuri
palautettuja 1RM-arvoja.

## Käyttöliittymän komponentit (toteutettu, vaiheet 1–2)

Yhteinen komponentti- ja tokenjärjestelmä, jonka päälle näkymät rakennetaan.
Uusi koodi käyttää näitä; vanhoja inline-tyylejä siirretään niihin sitä mukaa
kun näkymiä käsitellään.

Painikkeet: `.btn-primary` (täytetty messinki, ruudun päätoiminto),
`.btn-secondary` (ääriviiva), `.btn-tertiary` (pelkkä teksti),
`.btn-danger` (tuhoava); koot `.btn-sm`, leveys `.btn-auto`. Vanha
`.save-btn`-alias on poistettu; kaikki kutsupaikat käyttävät `.btn-primary`-
luokkaa. Merkit `.chip` + `.chip-brass/-muted/-success`. Banneri
`renderBanner(kind, iconName, title, bodyHtml, actionsHtml)`, kind `""`,
`"info"` tai `"danger"`; kaikki aiemmat ad hoc -laatikot käyttävät sitä.

Kuvakkeet: `ICONS`-olio (24 px, viiva 1,7) ja `icon(name, size)`. Ei
kuvakefonttia (vanha `gearIcon()`-alias on poistettu). Kuvake on aina
`aria-hidden`; merkitys annetaan tekstillä tai aria-labelilla.

Natiivit kontrollit: `renderFilePicker()` ja `renderDateChip()` pitävät
natiivin `<input>`:in DOM:issa läpinäkyvänä sovelluksen näköisen painikkeen
päällä, joten id:t ja `change`-käsittelijät toimivat ennallaan ja näppäimistö-
fokus näkyy `:focus-within`-renkaana. CSV ja PDF on yhdistetty yhdeksi
syötteeksi (`#program-file-initial`, `#program-file-settings`);
`handleProgramFiles()` tunnistaa muodon päätteestä.

Ensikäynnistys: `renderConsentGate()` on tervetuloruutu, jossa koekäyttöehdot
ovat mukana — hyväksynnän semantiikka (`consentGiven`, `STORAGE_CONSENT_KEY`,
`#consent-accept-btn`) on ennallaan. `renderUpload()` on aloitusruutu kolmella
valintakortilla; varmuuskopion palautus on siinä mukana, koska se on tyhjän
laitteen tärkein reitti (aiemmin mahdoton ilman ohjelmaa). CSV-esimerkki on
pohjalevyssä (`state.sheet`, `renderSheet()`, sulkeutuu taustasta,
sulkupainikkeesta ja Escapesta). Valmiista pohjista ei vielä mainita mitään —
asettelu on suunniteltu neljälle kortille.

Vihjeet: yksi kerrallaan. `shouldShowFirstLogHint()` näyttää lyhyen
kirjausohjeen (`renderFirstLogHint()`, yksi `renderBanner("info")`-banneri
Selvä-painikkeella, teksti mahtuu 390 px:ssä kahdelle riville) kunnes
ensimmäinen merkintä on tallennettu tai banneri suljetaan
(`STORAGE_FIRST_LOG_HINT_KEY`); aloitusnäyttövinkki näytetään vasta sen
jälkeen ja on tiivis banneri, jonka ohjeen saa auki erikseen.
Aloitusnäyttövinkkiä ei näytetä, kun liike on auki (`state.openExercise`),
jottei se nouse kirjauksen päälle; kirjausohje sen sijaan näkyy avoimen
liikkeen aikanakin, koska sen loppuosa (✓ ja tallennus) koskee juuri sitä.

Ilmoitusruutu nousee alhaalta navigaation yläpuolelle, ei enää yläpalkin päälle.

## Ohjelma-näkymä ja kirjaus (toteutettu, UX-vaihe 3)

Päiväkortti `renderDayCard(day, expanded, isNext)`: otsikkona päivän nimi,
alarivillä tila. `dayCardTitle(day)` palauttaa **HTML:ää**, ei pelkkää
tekstiä: viikkonäkymässä `escapeHtml(day.label)`, koko ohjelman näkymässä
viikon nimi `.sr-only`-elementissä ja näkyvänä vain päivän nimi, koska
viikko on jo väliotsikossa (Kaikki-tilassa jokaisen viikon päivät ovat oman
`h3.day-heading`-otsikon alla, kun viikkoja on useampi; Koko ohjelma on
h2). Viikoton päivä (`day.week` null, esim. vanhan ohjelman migraatio tai
CSV-rivi ilman viikkoa) saa otsikon "Ilman viikkoa" ja kortin nimen ilman
viikko-osaa — `weekDisplayName(null)` antaisi "Viikko null". Nimiosa on avaava
painike ja seuraavaksi vuorossa olevan päivän "Aloita/Jatka"-painike
(`[data-start-day]`) on sen sisar, ei sisällä — sisäkkäiset painikkeet
olisivat saavutettavuusrike. Avattuna kortti saa luokan `day-open` ja
liikkeet ovat `.day-exercises`-lohkossa sen alla (vasen viiva ryhmittää ne
päivän alle); erillistä "Piilota liikkeet" -linkkiä ei ole. Kerrallaan on
auki vain yksi päivä (käyttäjän päätös): otsikon tai Aloita-painikkeen avaus
korvaa `state.expandedDaySummaries`-kartan pelkällä avatulla avaimella, ja
otsikon uusi napautus sulkee päivän. Toisen päivän avaaminen ei sulje
`state.openExercise`-liikettä, vaan se jää piiloon suljetun päivän alle
kuten otsikosta suljettaessa (Aloita/Jatka tuo sen taas näkyviin). Tehty-tilan
värit ovat luokissa, ei inline-tyyleissä.

Viikon otsikko on `renderWeekStepper()` (`.week-head`): nuolet
`[data-week-nav]` ovat `.icon-btn`-painikkeita aria-labelein, viikon nimi on
`h2.view-title` (rivittyy, ei katkea) ja laskuri `.week-head-count`
("1 / 4"; omalla viikon nimellä "viikko 1 / 4", jottei se lukisi kuin
päiväkortin tehtyjen liikkeiden osuus). Kaikki-tilassa
otsikko on "Koko ohjelma" ja laskurin tilalla viikkojen ja treenipäivien
määrä ilman nuolia. Viikko/kaikki-valinta on `renderWeekModeSwitch()`
(`[data-week-mode]`), samalla rivillä päivämääräsirpaleen kanssa (vanha
`[data-toggle-week-view]`-käsittelijä on poistettu). Näkyvä "Kirjataan
päivälle" -teksti on ruudunlukijalle `.sr-only`-elementtinä. "Kirjaa vaiva"
on `.pain-row`-tekstipainike (`[data-pain-open]`) treenipäivien jälkeen
ennen ohjelman muistiinpanoja, ei otsikkorivin alla.

Avattu liike vieritetään näkyviin: `openExerciseForLogging()`,
`completeAndAdvance()` ja `[data-start-day]` (kun liike on jo auki) kutsuvat
`afterRender(revealOpenExercise)`, joka kapealla näytöllä (0.4.5 alkaen
kirjausruudulla: vieritys ylös ja fokus `#kirjaus-title`-otsikkoon; alla
kuvattu kortin vieritys koskee vain vanhaa kortin sisäistä avausta) vierittää
`.exercise.open`-kortin **aina** näytön yläreunaan (`scroll-margin-top` on
kortilla ja `html`-elementin `scroll-padding-top` 16 px; `scrollIntoView`
kortille, sujuvasti ellei `prefers-reduced-motion`) ja siirtää fokuksen
otsikkoon `[data-toggle-ex]` `preventScroll`-optiolla. Aiempi ehto "vain
näytön ulkopuolelta tai alimmasta 40 %:sta" poistettiin, koska edellisen
liikkeen sulkeutuminen siirtää kortin ennalta arvaamattomaan kohtaan.
Leveässä asettelussa ei vieritetä (paneeli on kiinnitetty).

Sarjarivi: numero, Viime, paino, toistot, ✓ ja RPE-painike yhdellä rivillä
(`grid-template-columns:40px 52px minmax(0,1fr) minmax(0,0.8fr) 44px 40px`;
`minmax(0, …)`, jotta otsikkorivin "TOISTOT" ei venytä omaa saraketta ja
otsikot osuvat kenttien kohdalle; alle 375 px:n näytöllä Viime-sarake
`.set-last` otetaan pois ruudukosta `.sr-only`-tyyliin (pysyy
ruudunlukijalla) ja ruudukko on `40px minmax(0,1fr) minmax(0,0.8fr) 44px
40px`; rivin kosketuskohteet vähintään 44 px korkeita —
`.ledger-input`-kentän 44 px:n korkeus on rajattu `.ledger`-lohkoon ja
vaivalomakkeeseen, koska muokkaustilan ja kirjaston nimikentät ovat 36 px:n
kuvakepainikkeiden rinnalla). Viime-solu (`renderLastCell`) näyttää edellisen
kerran saman järjestysluvun sarjan `state.lastSet[nimi].sets[i]` muodossa
"60×10" (lämmittelyillä `warmups[i]`), tai viivan; jo tallennettua
merkintää korjattaessa `lastSet` on tämä sama kerta, joten näytetään
`prior[0]`. Solu on kaksirivinen (`.set-last-main`, `.set-last-rpe`):
alarivi "RPE 8" näytetään vain, kun viitesarjalla on `rpe`-luku
(käyttäjän päätös 10.9.2026), ja aria-label saa lisän ", RPE 8 (työläs)";
kaksi 12 px:n riviä mahtuu 44 px:n kenttien rinnalle, joten rivin korkeus
ei muutu. Simuloinnin `pushLastSet` ei kirjoita `rpe`-kenttää, joten
simuloidut kerrat näkyvät ilman RPE-riviä. Testi: `test_viime_rpe.js`. Työsarjat numeroidaan ykkösestä lämmittelyistä riippumatta
(`setNo` = järjestysluku työsarjojen joukossa; `idx` on paikka koko
`draftSets`-taulukossa, jossa lämmittelyt ovat alussa) — sama numero on
`.set-num`-merkissä, kenttien aria-labeleissa, Viime-solussa ja
näppäimistön otsikossa (`keypadLabel`); käyttäjän päätös. Sarjanumero pysyy
numerona myös tehdyssä sarjassa
(`.set-num.done` vaihtaa vain värin) ja tehty-tila näkyy ✓-merkin
väristä (`aria-pressed="true"`: messinki → `--success`; painike
`.set-done-btn` on reunaton ja täytötön käyttäjän päätöksellä, kuten
hymiöpainikkeet, joten merkki itse on painike); `state.justDone` antaa
`.pop`-luokan molemmille. Paino- ja toistokentät ovat keskitettyjä arvolaatikoita, joissa
on `inputmode="none"`: laitteen näppäimistö ei avaudu, vaan kentän fokus tai
napautus avaa kirjausnäppäimistön (seuraava kappale). Tyhjässä kentässä
ensimmäinen ± tuo viime kerran suurimman painon (`state.lastSet`), ei 2,5 kg
nollasta. `state.activeSet` ja `activeSetIndex()` on poistettu (±-rivit
sarjan alla on poistettu, eikä mikään lukenut tilaa). Tuntuma ja poisto
ovat RPE-ikkunassa (ks. oma osio), jonka rivin RPE-painike
(`renderRpeRowButton`, `.set-more`, entinen ⋮; `.rpe-btn-label` "RPE" ja
valittu luku `.rpe-btn-val`; myös lämmittelyrivin viimeinen sarake) avaa
uudelleen; sarjarivien alla ei ole lisäriviä (`state.setExtra` poistettu).
Sarjan huomiokenttä poistettiin käyttäjän päätöksellä
(ei käyttöä): rivin ja merkinnän `notes`-kenttä säilyy tyhjänä, Historia
näyttää vanhat huomiot ja varmuuskopion Huomiot-sarake on ennallaan.
"Nostettu yhteensä" päivitetään ilman render()-kutsua (`syncSubtotalDom`,
kutsutaan input-käsittelijästä ja ±-käsittelijästä; `ledgerTotal` on sama
laskusääntö kuin renderLedgerissä).

Kirjausnäppäimistö (0.4.3): `state.keypad = { id, idx, field, replace }`
(null = kiinni) tai muokkaustilan lomakkeelle `{ kind: "editor", field:
"sets" | "reps", replace }` (`isEditorKeypad()`): `keypadTargetRow()`
palauttaa silloin `state.editor.form`-olion (arvo `form[field]`),
`keypadInput()` kentän `[data-editor-field]`, `keypadLabel()` "Liike ·
Sarjat/Toistot", asettelu on aina toistoasettelu (ei pilkkua, ei ±),
`openEditorKeypad(field)` avautuu Sarjat/Toistot-kentän fokuksesta tai
napautuksesta (`inputmode="none"`, korostus `editorKeypadClass`) ja muu
lomakkeen kenttä sulkee sen, `keypadNext` siirtyy Sarjat → Toistot ja
sulkee Toistoista, `[data-editor-field]`-input-käsittelijä päivittää
lukeman, pohjalevyn avaus ja `editorOpenForm` nollaavat `state.keypad`-
tilan ja `#app.keypad-open .edit-bar` on piilossa kuten alanavigaatio.
Testi: `test_keypad_editor.js`. `renderKeypad()` piirtää `#keypad`-levyn (`position:fixed`,
`role="region"`, `#app`-elementin loppuun render()-kutsussa, `#app` saa
luokan `keypad-open`, joka lisää alatäytettä) vain, kun kohde on avoimen
liikkeen sarja Ohjelma-näkymässä (`keypadTargetRow`); muuten se nollaa
tilan, joten liikkeen sulkeminen tai vaihtuminen sulkee näppäimistön
itsestään. Avaus (`openKeypad`, `focusin`- ja click-käsittelijöistä; click
tarvitaan, koska jo fokusoidun kentän napautus ei laukaise focusin-
tapahtumaa) ja sulku (`closeKeypad`, nuoli `[data-keypad-close]`, Esc)
päivittävät DOM:in suoraan (`syncKeypad`) ilman render()-kutsua, jottei
fokus katoa; `mousedown` näppäimistössä on `preventDefault`, jotta kenttä
pysyy fokusoituna. Sulku palauttaa fokuksen kenttään ilman uutta avausta
(`keypadSilentFocus`-lippu ohittaa focusin-kuuntelijan). **Kosketuslaitteella**
(`isTouchDevice()`: `(hover: none) and (pointer: coarse)`) kenttää ei pidetä
fokusoituna näppäimistön aikana: `openKeypad` ja `keypadNext` poistavat
fokuksen (`blurKeypadInputOnTouch`), sulku ja lepoajastimen paluu
(`releaseRestTimerOverlay`) eivät fokusoi sarjakenttää. Syy: iOS Safari
siirtää `position:fixed`-elementit (alanavigaatio, ilmoitus, lepoajastimen
palkki) fokusoidun kentän mukana, jolloin ne tarttuvat sisältöön
vieritettäessä. Kohdekenttä näytetään luokalla `.keypad-target`
(`keypadTargetClass` renderLedgerissä, `markKeypadTarget` DOM-päivityksissä),
ei fokusrenkaalla. Lisäksi `visualViewport`-`resize` vierittää samaan
kohtaan (`window.scrollTo(scrollX, scrollY)`), kun mikään kenttä ei ole
fokusoituna, jotta iOS palauttaa kiinteät elementit laitteen näppäimistön
sulkeuduttua (esim. vaivalomakkeen huomiokentän jälkeen). Muun kuin paino-
tai toistokentän fokus sulkee näppäimistön (`openKeypad`), ja
Enter-oikotie koskee vain paino- ja toistokenttiä. Sarjan poisto
(`[data-remove-set]`) siirtää `state.keypad.idx`-indeksiä tai sulkee
näppäimistön, jos kohderivi poistettiin. Näppäimet `[data-keypad-key]` (1–9, 0, "," vain painoille
— toistoilla `disabled` —, "back", "next"); ±2,5 kg ovat samat
`[data-weight-step]`-painikkeet kuin ennen, ja niiden käsittelijä päivittää
kentän ja lukeman suoraan DOM:iin, kun kenttä on näkyvissä. Attribuutti on
`data-keypad-key`, koska `data-key` on jo päiväkorttien avain. Arvo
kirjoitetaan kenttään `keypadSetValue`-funktiolla, joka lähettää
input-tapahtuman, joten luonnos, valmis-tila ja lukema päivittyvät samaa
polkua kuin kirjoitettaessa (input-käsittelijä kutsuu `updateKeypadValue`).
`replace` = seuraava numero korvaa valmiin arvon (kuten valitun tekstin
päälle kirjoittaminen); askelpalautin, ± ja kirjoitus nollaavat sen.
Seuraava (`keypadNext`, myös Enter kentässä) siirtyy seuraavan rivin samaan
kenttään (lämmittelyrivit mukaan lukien) ja viimeisestä rivistä sulkee
näppäimistön; `revealKeypadTarget` vierittää kohdekentän näppäimistön
yläpuolelle — leveässä asettelussa paneelia (`.ohjelma-pane`, jonka
`max-height` on `#app.wide.keypad-open`-tilassa `calc(100vh - 460px)`:
näppäimistö noin 340 px + paneelin yläreuna 86 px otsikkorivin alla, jotta
paneelin alaosa ja Tallenna eivät jää levyn taakse), muuten ikkunaa. Kerrosjärjestys: näppäimistö z 85 peittää
alanavigaation (70; piilotetaan `visibility:hidden`, jottei näkymätön
välilehti ole fokusoitavissa), lepoajastimen modaali on 86 ja ilmoitus 87;
`body.keypad-open` nostaa ilmoituksen ja pienennetyn lepoajastimen
(`#rest-timer-mini`, jonka `bottom` on nyt CSS-säännössä, ei inline-
tyylissä) näppäimistön yläpuolelle. Näkyvä lukema `#keypad-value` on
`aria-hidden`; erillinen `.sr-only`-live-alue `#keypad-live` päivitetään
vain näppäimistön omista muutoksista (näppäin, ±), ei kirjoitettaessa,
jottei ruudunlukija toista kentän kaikua. Ruudukko on 8 puoliriviä `grid-template-areas`-nimillä, jotta
+2,5 ja −2,5 kattavat 1,5 riviä ja Seuraava on aina oikeassa alakulmassa;
toistoilla oikean sarakkeen yläosa on tyhjä, koska toistoille ei ole
säätimiä (ei painikkeita toiminnoille, joita ei ole). **Käyttäjän päätös:**
toistomäärä on aina yksi kokonaisluku, ei tavoitealue kuten "6–8"; siksi
toistonäppäimistössä ei ole viivanäppäintä eikä pilkkua, ja ohjelman
toistotavoite on yksi luku. Ledgerin lopussa
"+ Sarja" on koko rivin levyinen ja "Lisää lämmittelysarja" tekstipainike
`.ledger-links`-rivillä. Testi: `test_keypad.js`.

Painojen laskennan selitteet eivät ole kirjauslohkossa vaan pohjalevyssä
`state.sheet === "laskenta"` (käyttäjän päätös 10.9.2026: kirjausnäkymä
lyhyemmäksi). Avoimen liikkeen nimen perässä on tietopainike `.info-btn`
(`[data-open-sheet="laskenta"][data-id]`, kuvake `tieto`, ei kehystä eikä
täyttöä, 36 px negatiivisella pystymarginaalilla, jotta nimirivi ei kasva);
se piirretään vain, kun liike on auki ja sarjat kirjataan siinä
(`open && !noLedger`, leveässä asettelussa siis vain paneelissa). Yleinen
`[data-open-sheet]`-käsittelijä asettaa `state.infoExercise = data-id`.
`renderSheet` piirtää otsikon "Painojen laskenta", liikkeen nimen
tarkenteineen (`catalogPartsFor`) ja `renderCalcInfo(ex)`-lohkon:
`renderMethodNote`, teholiikkeellä ilman ehdotusta `renderNoMaxHint` (joka
maksimitestillä kertoo sarjan 1 tallentuvan 1RM:ksi — `saveExerciseLog`
lukee 1RM:n sarjasta 1 — ja prosenttiliikkeellä selittää puuttuvan 1RM:n
vain, kun `state.manualMax` ei sisällä liikettä, ei `autoCalc === false`
-menetelmäliikkeelle) ja `autoCalcHint` (maksimitestin uusinta kertoo, että
tulos korvaa nykyisen 1RM:n; lämmittelysäädön tila ja "Poista merkintä ja
laske uudelleen" `[data-recalc]` ovat siinä, joten `[data-recalc]` on
sulkutarkistuksen poikkeuslistassa `[data-close-sheet]`-käsittelijässä ja
ikkuna päivittyy poiston jälkeen uuteen ehdotukseen). Kun mitään selitettä
ei ole, `renderCalcInfo` kertoo syyn (yhdistelmäliike, `noAutoCalcReason`,
teholiike tai ei aiempaa merkintää). Jos kohdeliike ei ole enää auki,
`renderSheet` nollaa `state.sheet`- ja `state.infoExercise`-tilan.
Otsikkorivin rakenne muuttui samalla: ruudunlukijan ja näppäimistön painike
on nimiosa `.exercise-name-btn` (`role="button"`, `tabindex`,
`aria-expanded`), ei koko `.exercise-head-main`-lohko, jotta tietopainike ei
ole painikkeen sisällä (nested-interactive); lohkolla on yhä
`data-toggle-ex`, joten koko otsikko toimii napautuskohteena.
`revealOpenExercise` fokusoi `[data-toggle-ex][tabindex]`-elementin, ja
`#app`-keydown-käsittelijä ohittaa Enterin, kun kohde on aito painike
`data-toggle-ex`-lohkon sisällä (muuten Enter tietopainikkeessa avaisi ja
sulkisi liikkeen).

Kirjauslohkon (`renderLedger`) järjestys (0.4.11): lämmittelyt,
sarakeotsikot, työsarjat, `.ledger-actions` (`+ Sarja` `[data-add-set]` ja
`+ Lämmittely` `[data-add-warmup]` rinnakkain 40 px:n
`btn-secondary btn-sm btn-auto` -pillereinä; lämmittely `.ledger-warm-btn`
mist-värillä `.ledger-actions .ledger-warm-btn` -säännöllä, koska pelkkä
luokka häviäisi myöhemmälle `.btn-secondary`-säännölle; lämmittelyn lisäys
fokusoi uuden rivin painokentän, mikä avaa myös näppäimistön),
`renderVolumeRow(ex, id)` (`.volume-row[data-volume-row]`: Suunniteltu =
kaikki työsarjat nykyisillä arvoilla, Viime kerta = `ledgerLastSession(ex)`-
kerran työsarjat, Toteutunut = vain ✓-merkityt työsarjat `.accent`, kaikki
tehty → `.done` vihreä; palkki `.volume-bar[role=progressbar]`
`aria-valuemax` = suunniteltu, `aria-valuenow` = toteutunut; kaikki
`setVolume`-kaavalla `ledgerVolumes`-apurissa, lämmittelyt eivät kuulu
mihinkään; tyhjä merkkijono, kun suunniteltu ja toteutunut ovat 0 eikä
viime kertaa ole — siis myös tavallinen liike ilman ehdotusta ennen
ensimmäistä painoa), `.ledger-footer` (`Vaihda` `[data-swap-open]` kynä +
sana, `aria-label="Vaihda liike toiseksi"`, vain `isProgramExercise`;
`Tallenna merkintä` `.btn-primary.btn-sm.ledger-save-btn` `flex:1`, 40 px —
sovelluksen ainoa alle 48 px:n ensisijainen painike, käyttäjän päätös
14.9.2026) ja avattu vaihtopaneeli (`renderSwapExercise` palauttaa
suljettuna tyhjän). `ledgerLastSession(ex)` on Viime-sarakkeen ja
volyymirivin yhteinen viitekerta (`lastSet`, korjattaessa `prior[0]`).
`syncVolumeDom(ledger, ex, id)` korvaa entisen `syncSubtotalDom`-funktion
`[data-set-field]`-input- ja `[data-weight-step]`-poluilla: päivittää
suunnitellun, toteutuneen, palkin leveyden ja aria-arvot suoraan DOM:iin
ilman `render()`-kutsua (viime kerta ei muutu). `ledgerTotal`,
`.add-set-btn`, `.ledger-tools`, `.ledger-links`, `.subtotal` ja
`.ledger-save` on poistettu. Sarjojen alapuolinen osa on kehotteen CSS-
arvoilla noin 170 px (kehotteen "noin 150 px" ei toteudu sen omilla
arvoilla; arvot pidettiin). Tallenna on `disabled` kunnes kaikki
sarjat on merkitty; sen selite on `.sr-only`-elementti, johon painike
viittaa `aria-describedby`-attribuutilla, ja `.btn-primary:disabled` on
haamutyylinen (läpinäkyvä, yhtenäinen line-strong-reunus). Testi:
`test_volume_row.js` (kehotteen tapaukset 1–16 paitsi käsin lisätty liike,
jolle ei ole syöttöpolkua; lepoajastin kytketään testissä pois
`rest-timer-enabled`-avaimella, koska clusterin + avaa modaalin). Tallennuksen ilmoitus kertoo uuden
1RM:n, kun tallennus nosti sitä eikä kyse ole korjauksesta. Tavoiterivi
(`.exercise-target`) taivuttaa yksiköt (`plural`: "1 sarja · 1 toisto") ja
ohittaa `notes`-tekstin, joka on sama kuin tehon teksti.

Tallennuslohko ei ole kiinnitetty (position:sticky kokeiltiin ja hylättiin:
se peitti sarjarivit heti kortin avautuessa, koska kortti on näyttöä
korkeampi).

Testit: `test_ux.js` (0.4.2:n hyväksymiskriteerit: banneri, viikon otsikko,
Kaikki-tilan otsikot, vieritys ja fokus avattaessa, kosketuskohteet,
selitteet, 360 px:n leveys, leveä asettelu, viikoton päivä `prog_nullweek.csv`,
oma viikon nimi, Jatka jo avatulla liikkeellä). Testissä on odotettava yli
250 ms edellisen piirron jälkeen ennen klikkausta: piirron view transition
on kesken, ja Playwright siirtyy sen aikana uusintayrityksiin, jotka
vierittävät sivua itse.

## Seuraavaksi-kortti (toteutettu, 0.4.4)

Ohjelma-näkymän ensimmäinen elementti bannerien jälkeen ja Viikko|Kaikki-
valitsimen yläpuolella on `renderNextCard(info, opts)` (`.next-card`,
`<section aria-labelledby="next-card-title">`, otsikko `h2`), jonka tiedot
laskee `nextDayInfo(groups)` samasta `groupsToShow`-listasta kuin
päiväkortit. Sääntö on entinen `nextKey`-sääntö: kohde on ensimmäinen
näytettävä päivä, joka ei ole `isDayFullyDone`. Ei uutta tilaa eikä
vakioita: kaikki luetaan `state.exerciseLogIndex`-, `state.draftSets`- ja
`state.openExercise`-tiloista. Kohdeliike on avoin tallentamaton liike,
jos se kuuluu päivään, muuten päivän ensimmäinen tallentamaton; otsikko
on `weekDisplayName(day.week) + " · " + label` (viikoton päivä pelkkä
label) ja liikkeen nimi sama johdos kuin `renderExercise`
(`catalogPartsFor` → `liike`). Palkki (`role="progressbar"`, `aria-label`
"Tallennetut liikkeet") näyttää tallennettujen liikkeiden osuuden yhden
desimaalin prosenttina, selitteet "1 / 3 liikettä tallennettu" ja
"viimeksi 11.9." (`formatDateShortFI`). `mode` on `"jatka"`, kun päivällä
on tallennettuja liikkeitä tai luonnoksessa valmiita työsarjoja, muuten
`"aloita"`; sarjateksti " · sarja N / M" näytetään vain, kun liikkeellä on
luonnosrivit (`info.hasDraft`; kehotteen pseudokoodi ja testitaulukko
olivat tässä ristiriidassa, taulukko ratkaisi) — lämmittelyrivit
(`isWarmupRow`) eivät laske. Painike on sama `[data-start-day]` kuin
ennen päiväkortissa; käsittelijää ei muutettu. Tehty-tilassa
(`.next-card-done`) kicker on "Tämä viikko" (viikkotila) tai "Ohjelma",
otsikko "Kaikki tehty", alarivi "2 treenipäivää · viimeksi 13.9.", palkki
vihreä (`.next-progress-fill.done`, `aria-label` "Tehdyt treenipäivät") ja
viikkotilassa painike `btn-secondary` `[data-week-nav="next"]`, kun
seuraava viikko on (sama indeksisääntö kuin `renderWeekStepper`). Tyhjä
päivälista → tyhjä merkkijono. `renderDayCard(day, expanded)` ei enää ota
`isNext`-parametria: oikealla on aina nuoli, ja Aloita/Jatka poistui
päiväkortista (ruudulla yksi ensisijainen toiminto). Ensikirjausbanneri
alkaa "Paina ylimmän kortin Aloita.". Leveässä asettelussa kortti on
`.ohjelma-list`-palstan alussa, ei paneelissa. Testi kehotteen
tapauksille 1–21 ajettiin Playwrightilla (`test_next_card.js`, ei
repossa kuten muutkaan testit).

## Kirjausruutu kapeassa asettelussa (toteutettu, 0.4.5)

Kapealla näytöllä (`!isWideLayout()`) avattu liike ei laajene päiväkortin
sisällä vaan on oma päällysruutunsa `renderKirjaus(ex)` (0.4.12 alkaen
`renderScreenHead`-otsikkorivi: takaisin `[data-close-ex]`
`aria-label="Takaisin ohjelmaan"`, kicker "Viikko 1 · Päivä 1 · liike
2 / 3", `h1#kirjaus-title` `tabindex="-1"` + tallennettu-merkki, ⓘ
oikealla; ks. Kirjaus-sarja 2–5), tarkenteet,
tavoiterivi ja `.exercise.open.kirjaus-card`, jossa pelkkä
`renderLedger(ex)`). `renderOhjelma` palauttaa sen ensimmäisenä, kun
`kirjausScreenOpen()` (ohjelma, ei lataus, ei muokkaustila, `state.view ===
"ohjelma"`, `state.openExercise`, kapea) on tosi; ei uutta tilamuuttujaa.
Otsikon osat on irrotettu `exerciseHeadParts(ex, open, noLedger)`-funktioon
(`{ title, badgeHtml, detailHtml, target, clusterLogged, infoBtn }`), jota
`renderExercise` käyttää; kortin HTML ei muuttunut (testi vertasi leveän
asettelun listan ja paneelin HTML:ää vanhaan versioon merkilleen).

Historiapino: ruutu on merkintä `{ view: "ohjelma", detail: <liike-id>,
depth: 2 }` (`normalizeScreen` säilyttää detailin myös ohjelmalle,
`screenDepth` antaa 2). `toggleExercise` jakautui: `openExerciseForLogging(id)`
on entinen avaushaara ilman pinoa, ja `toggleExercise` tekee kapeassa
asettelussa ensin `pushScreen` (tai `replaceScreen`, kun ruutu on jo auki:
`navDepth === 2` ja `currentHistoryScreen().view === "ohjelma"`, esim.
`completeAndAdvance` seuraavaan liikkeeseen). `applyScreen` asettaa
`state.kehitysDetail`-arvon vain Kehitys-näkymälle ja kapeassa
Ohjelma-näkymässä avaa `openExerciseForLogging(detail)`:n tai nollaa
`state.openExercise`-tilan (luonnos säilyy); detail ilman liikettä
(uudelleenlataus poistetulla id:llä) korjaa pinon juureksi
`replaceScreen`-kutsulla. Vieritysehto on `prevDetail !== screen.detail`.
Sulkeminen: `[data-close-ex]` kapeassa asettelussa `navigate({ view:
"ohjelma", detail: null })` (historyBack → popstate → applyScreen), leveässä
suoraan; `completeAndAdvance` purkaa merkinnän samalla `navigate`-kutsulla,
kun päivän viimeinen liike tallennettiin (`nextEx` null);
`performExerciseSwap` tekee `replaceScreen` uudelle id:lle; välilehden
vaihto sulkee ruudun `navigate`-funktion kaksivaiheisella siirtymällä
(tarkoitettu muutos). `onWideChange` siirtää avoimen liikkeen asettelun
mukana: kapeaksi → `pushScreen`, leveäksi → `replaceScreen` juureen.
`currentHistoryScreen()` johtaa ilman History APIa ruudun sovelluksen
tilasta (`state.view`, `kehitysDetail` tai kirjausruudun liike), koska
muuten `navigate` pitäisi sulkemista saman ruudun napautuksena.
`revealOpenExercise` vierittää ruudulla ylös ja fokusoi `#kirjaus-title`-
otsikon. `renderHeader` pudottaa kynäkuvakkeen, vientimuistutuksen ja
aloitusnäyttövihjeen ruudun ajaksi; tallennusvaroitukset näkyvät.
Ohjelmanäkymän `pushScreen`/`replaceScreen`-kutsut ovat vain funktioissa
`toggleExercise`, `completeAndAdvance`, `performExerciseSwap`,
`onWideChange` ja `applyScreen`. Testi kehotteen tapauksille 1–23 ajettiin
Playwrightilla (`test_kirjaus.js`; lepoajastin palautuu tallennuksesta,
joten testin siemennys tyhjentää tallennustilan sivulla, jossa sovellus ei
ole käynnissä). `test_next_card.js` sovitettiin: kortti luetaan
‹ Ohjelma -paluun jälkeen.

## Kirjaus-sarja 2–5: otsikkorivi, tavoiterivi, desimaalipilkku, seuraava sarja (toteutettu, 0.4.12–0.4.15)

**Päällysruutujen otsikkorivi (0.4.12).** `ownHeadScreen()` on tosi
kirjausruudulla, Kehityksen liikenäkymässä kapeana ja Asetusten
alinäkymässä; silloin `renderHeader` jättää logorivin (logo, kynä, ?)
pois ja palauttaa vain tallennusvaroitukset ja navigaation.
`renderScreenHead(opts)` (`.screen-head`: `icon-btn` takaisin `opts.backAttr`
+ `aria-label`, `.screen-kicker`, otsikko `h1.screen-title` — `opts.heading`
"h2" paneelissa, koska logon h1 on silloin ruudulla — `titleId` antaa
`tabindex="-1"`, `titleExtra` otsikon perään, `.screen-head-right`
ruudun omalle toiminnolle; tyhjä `backAttr` → ei painiketta) on kolmen
ruudun yhteinen: `renderKirjaus` (kicker "Viikko 1 · Päivä 1 · liike
1 / 6", `#kirjaus-title`, oikealla ⓘ 44 × 44 `.screen-head-right .info-btn`
ilman negatiivisia marginaaleja), `renderKehitysDetail` (kicker "Kehitys",
Pysähtynyt-chip `titleExtra`; paneelissa ilman painiketta ja kickeriä) ja
`renderSubviewHeader` (kicker "Asetukset"). `.kirjaus-head`, `.kirjaus-
kicker`, `.kirjaus-title`, `.kehitys-detail-head`, `.kehitys-back`,
`.kehitys-detail-title` ja `.subview-head` on poistettu. Ensimmäinen
sarjarivi nousi kirjausruudulla 114 px (mitattu edelliseen versioon).

**Tavoiterivi (0.4.13).** `targetRpeText(ex)` = "RPE " + (10 − `TARGET_RIR`)
painoperusteisille liikkeille (ei cluster, ei yhdistelmä/kesto) ja
`suggestionDeltaText(ex, id)` (vain `autoCalcInfo.type === "formula"`:
`info.weight` − perSet-rivien suurin `prevWeight`; "ehdotus +2,5 kg",
"ehdotus sama paino", plateau → "kevennys −5 kg"; puhtaat, eivät muuta
`autoCalcInfo`-oliota). `exerciseHeadParts` lisää ne `parts`-taulukon
loppuun vain, kun `open && !noLedger` (sama ehto kuin tietopainikkeella:
kirjausruutu ja tabletin paneeli; listan kortit, myös tabletin listan
avoin, ennallaan — kehotteen "vain open === true" olisi näyttänyt lisäyksen
tabletin listassa). `target` korvattiin `targetHtml`-kentällä (escapattu
perusosa + `<span class="accent">`-ehdotus), ja kutsujat eivät enää
escapaa sitä.

**Desimaalipilkku (0.4.14).** `fmtFieldValue(v)` (`.` → `,`) ledgerin
paino­kenttien `value`-attribuutissa (työsarjat ja lämmittelyt) ja
`[data-weight-step]`-käsittelijän DOM-päivityksessä; luonnokseen tallentuu
edelleen `String(next)`. Muunnos on pelkkä esitys: fyysisellä
näppäimistöllä kirjoitettu "52.5" säilyy kentässä seuraavaan piirtoon.

**Seuraava sarja (0.4.15).** `renderLedger` laskee `nextIdx` (ensimmäinen
rivi ilman `done`, lämmittelyt ennen työsarjoja) ja antaa riville luokan
`next` ja `aria-current="step"`; CSS `.ledger-row.next` (tausta
`rgba(201,162,39,.06)` kortin reunasta reunaan negatiivisilla 16 px:n
marginaaleilla = `.ledger`-täyte, numero messinkinen). Ei uutta tilaa.
Testi: `test_kirjaus_2_5.js` (kehotteiden 2–5 tapaukset; viime kerta 50 kg,
jotta ehdotus on 52,5; `TARGET_RIR`-koeajoa ja tallennusvaroitusta ei
testattu, koska vakio on sulkeuman sisällä eikä varatallennustilaa voi
pakottaa). Valinnaista kehotetta 6 (✓ harmaaksi) ei ajettu: sen teksti
edellyttää erillistä vahvistusta 7.9.2026 tehdyn päätöksen muuttamiselle.

## RPE-ikkuna (toteutettu, 10.9.2026)

Sarjan tuntuma valitaan pohjalevyssä `state.sheet === "rpe"`, jonka kohde
on `state.rpeSheet = { id, idx, pendingRest }` (käyttäjän päätös: aiempi
rivin alle avautuva RPE-rivi vaati liikaa painalluksia ✓ → modaali →
pienennä → RPE → valinta → sulje). Avaus: `toggleSetDone` kutsuu valmiiksi
merkittäessä `openRpeSheet(id, idx, pendingRest)`-funktiota (`pendingRest`
= työsarja, joka ei ole liikkeen viimeinen; lämmittelyllä aina false) ja
piirtää `afterRender(focusSheetClose)`-kutsulla; rivin RPE-painike
`[data-set-more]` avaa saman ikkunan ilman ajastinta. `openRpeSheet` nollaa
`state.keypad`-tilan (ikkuna nousee näppäimistön päälle). Sisältö
(`renderSheet`): otsikko "RPE · Sarja 2" / "RPE · Lämmittely 1"
(`rpeRowLabel`), kysymysrivi liikkeen nimellä ja rivin arvoilla
(`.rpe-sheet-q`), viisi `.rpe-pick-btn`-painiketta (`[data-warmup-rpe]`
kuten ennen, `aria-pressed`, luku `.rpe-pick-num` ja sana `.rpe-pick-word`;
"Ääri&shy;rajoilla" rivittyy kapealla), asteikon ohje `.rpe-guide` yhdellä
rivillä per pykälä, käyttövihje (mainitsee lepoajastimen vain, kun
`pendingRest` ja ajastin käytössä) ja `.rpe-sheet-actions`: `[data-rpe-clear]`
"Poista tuntuma" (vain kun `rpe` on) sekä `[data-remove-set]` "Poista
sarja" / "Poista lämmittely". Ilman kohderiviä (yleinen
`[data-open-sheet="rpe"]`) näytetään pelkkä ohje.

Sulkeminen: `[data-warmup-rpe]` kirjoittaa pykälän riville (ei enää
"uusi napautus nollaa"), kutsuu `applyWarmupAdjustment` ja `closeSheet()`;
`[data-rpe-clear]` nollaa ja sulkee; sulkupainike, tausta ja Escape
kutsuvat `closeSheet()`; `[data-remove-set]` sulkee ikkunan ilman
ajastinta. `closeSheet()` käynnistää `pendingRest`-tilassa
`startRestTimer(state.restDurationSeconds, true)`: uusi `minimized`-
parametri näyttää heti pienen palkin (`#rest-timer-mini`) ilman modaalia,
`#app`-inert-tilaa ja fokuksen siirtoa; ajastimen päättyminen näyttää
modaalin kuten ennen. Fokus palaa rivin RPE-painikkeeseen
(`[data-set-more][data-id][data-idx]`, `preventScroll`). Clusterin
osasarjan + käynnistää 15 s:n ajastimen edelleen modaalina.

Testit: `test_rpe_sheet.js` (avaus ✓:stä, valinta sulkee ja käynnistää
pienen ajastimen, uudelleenavaus ja poisto, viimeinen sarja ilman
ajastinta, lämmittely, näppäimistön ✓, 360 px, axe, varmuuskopion
L-rivit); vanhat testit avaavat ikkunan ✓:stä ja sulkevat sen Escapella
(`done`-apurit), koska ✓ avaa ikkunan aina.

## Näppäimistö ja fokus mobiilissa (toteutettu)

Kehote "näppäimistön ja fokuksen käytettävyys mobiilissa + kiinnitetty
lisärivi" oli kirjoitettu ennen kirjausnäppäimistöä (0.4.3): sen osa C
(kiinnitetty ±/✓-lisärivi laitteen näppäimistön päällä, `.weight-step-row`-
rivien poisto, ✓ riville) oli jo toteutettu kirjausnäppäimistönä ja
sarjarivillä, joten lisäriviä ei tehty erikseen. Toteutetut osat:

- **Viewport** `interactive-widget=resizes-content`: Android Chrome kutistaa
  asettelunäkymän laitteen näppäimistön korkeudella (koskee vain laitteen
  näppäimistöä käyttäviä kenttiä: huomio, 1RM, lepoaika, muokkaustilan
  yksikkö ja teho, hakukentät); iOS ohittaa määreen.
- **scroll-padding** on `html`-elementillä (näkymän scroll-padding luetaan
  juurielementistä, ei bodystä): ylä 16 px, ala 130 px (alanavigaatio),
  `html.keypad-open` 372 px (kirjausnäppäimistö) ja
  `html.set-field-focused:not(.keypad-open)` 24 px. `setRootClass(name, on)`
  asettaa luokat sekä `html`- että `body`-elementille; `body.keypad-open`
  on yhä ilmoituksen ja lepoajastimen palkin käytössä.
- **Sarjakentän fokustila** `set-field-focused` (`updateSetFieldFocusState`,
  `#app`:n `focusin` ja `focusout` + `setTimeout 0`): päällä täsmälleen
  kun `document.activeElement` on `[data-set-field]` — semanttinen tila,
  ei korkeusheuristiikka, koska `innerHeight` itse kutistuu Androidilla.
  Kosketuslaitteella paino- ja toistokentät eivät ole fokusoituina
  (`blurKeypadInputOnTouch`), ja sarjan huomiokenttä on sittemmin poistettu,
  joten sarjariveillä tila ei kosketuslaitteella käytännössä ole päällä.
  CSS: `.bottom-nav` `display:none` ja `#rest-timer-mini` piiloon vain, kun
  kirjausnäppäimistö ei ole auki (sen kanssa palkki nostetaan näppäimistön
  yläpuolelle, käyttäjän aiempi päätös).
- **Kentän tuonti näkyviin** (`revealFocusedField(el, force)`,
  `isSystemKeyboardField`): `.ledger-input`-kentät ilman
  `inputmode="none"` ja pohjalevyn ulkopuolella keskitetään visuaaliseen
  näkymään (`visualViewport`-mitat, `window.scrollBy`; `.ohjelma-pane`-
  paneelissa `scrollIntoView center`). `focusin` keskittää
  kosketuslaitteella aina, muuten vain kun kenttä on alapalkkien takana tai
  näytön ulkopuolella; `visualViewport`-`resize` (debounce 80 ms) keskittää
  uudelleen, kun kenttä on yhä fokusoituna (näppäimistön animaatio, kääntö).
  Paino- ja toistokentät hoitaa edelleen `revealKeypadTarget`.
- **Fokuksen säilyminen `render()`-kutsun yli** (`captureFocus`,
  `restoreFocus`, `focusDescriptor`) on toteutettu `render()`-funktion
  sisällä `apply`-sulkeumassa, ei navigointifunktioissa: `applyScreen`-
  vieritykset tapahtuvat `afterRender`-kutsulla piirron jälkeen ja
  voittavat palautuksen. Talteen otetaan kentän tunniste (`[data-set-field]`-
  kolmikko, `[data-editor-field]` tai `#id`; vain input/textarea/select
  `#app`:n sisällä), valinta, `scrollY` ja `.ohjelma-pane`-paneelin
  `scrollTop`. Palautus ohitetaan, kun `#app` on `inert` (lepoajastimen
  modaali) tai kosketuslaitteella kentällä on `inputmode="none"`; palautus
  asettaa `keypadSilentFocus`- ja `focusRestoring`-liput, jottei `focusin`
  avaa suljettua näppäimistöä uudelleen eikä vieritä. Lopuksi
  `updateSetFieldFocusState()`.
- **`toggleSetDone(id, idx)`** on rivin ✓:n ja kirjausnäppäimistön ✓:n
  (`[data-keypad-key="done"]`, alue `ok` ±-näppäinten alla; ei
  muokkaustilan näppäimistössä) yhteinen funktio; piirtää näkymän.
  Valmiiksi merkitseminen avaa RPE-ikkunan, joka sulkee näppäimistön
  (`openRpeSheet` nollaa `state.keypad`-tilan); seuraavan sarjan kenttä
  avaa sen uudelleen.
  Ruudukko on nyt 4 riviä × 60 px (`grid-template-areas` "up dn ok nx").
- Rivin ✓ ja "+ Sarja" estävät `pointerdown`-oletuksen, kun fokus on
  sarjakentässä, jottei fokus siirry painikkeeseen (iOS: `mousedown` ei
  riitä). `restTimerPrevFocusKey` (`focusDescriptor`) palauttaa fokuksen
  piirron jälkeen syntyneeseen kenttään, koska ✓ piirtää näkymän ajastimen
  käynnistyksen jälkeen ja talletettu DOM-solmu ei enää ole dokumentissa.
- Sarjan huomiokenttä (`enterkeyhint="done"`, Enter sulki laitteen
  näppäimistön) on sittemmin poistettu käyttäjän päätöksellä; paino- ja
  toistokentissä Enter on edelleen `keypadNext`. Toistoille ei lisätty ±1-painikkeita (käyttäjän päätös:
  toistoille ei säätimiä), eikä Chromium-kohtaista VirtualKeyboard-
  rajapintaa käytetä.

Testi: `test_focus.js` (Pixel 5 -emulaatio kosketuksella ja 1280 px:n
työpöytä; kehotteen kohdat 1–8, 10 ja 13).

## Asetukset, Historia ja Kehitys (toteutettu, UX-vaihe 4)

Asetukset on riviluettelo (`SETTINGS_SECTIONS`, `renderSettingsList()`), jonka
rivi avaa alinäkymän `state.settingsSection`-tilaan; alinäkymän otsikossa on
takaisin-painike (`renderSubviewHeader()`). Välilehden vaihto nollaa
`settingsSection`-tilan, joten Asetukset avautuu aina luetteloon. Osioiden
sisällöt ovat omissa funktioissaan (`renderSettingsOhjelma`, `…1rm`, `…Lepo`,
`…Varmuuskopio`, `…Lisaa`); kaikki id:t ja data-attribuutit ovat ennallaan,
mutta testien on avattava oikea osio ennen niihin koskemista (testien
`openSection(page, key)`-apuri).

Historia esilataa kaikki merkinnät `historyCache`-välimuistiin
`loadHistory()`:ssa, jotta suljettu päiväkortti voi näyttää yhteenvetorivin
(`historyDaySummary()`). Historia-sarjan kehote 1 (0.4.16): `renderHistoria`
ryhmittelee päivät kuukausittain `h3.day-heading.history-month`-otsikoin
(`formatMonthFI`, deterministinen `MONTHS_FI`-taulukko) `#history-list`-
kääreessä (varattu suodattimelle), ja `renderHistoryDate`-otsikkorivi on
`.history-date-head` (44 px, ei inline-tyylejä): `.history-date-day`
`formatDateCompactFI` ("Ma 14.9.", `WEEKDAYS_SHORT_FI`; koko päivämäärä
`aria-label`-attribuutissa `capitalize(formatDateFI)`), `.history-date-ctx`
`historyDayContext(entry)` (ensimmäisen ohjelmasta löytyvän liike-id:n
päivä `findGroupForExerciseId`-apurilla: "Viikko 3 · Päivä 2", viikoton
pelkkä label, ei ohjelmassa → ei elementtiä), `historyDayBadges(entry)`
(`.chip.history-badge`: "kevennys" `.history-badge-deload`, kun jokin
merkintä on `deload`; "korjattu", kun jokin on `editedAt`) ja
`.history-date-sub` yhteenveto; nuoli `.chevron.on` avattuna. Testi:
`test_history_1.js`.

Historia-kehote 2 (0.4.17): avattu päivä piirretään
`renderHistoryExercise(date, id, data)`-lohkoina (`.history-ex`, nimi +
`.history-ex-kind` cluster) ja `renderHistorySetRow(label, valueHtml, rpe,
muted, ariaText)`-riveinä `.history-sets`-ruudukossa (`display:contents`-
rivit: `.history-set-num`, `.history-set-val`, `.history-rpe` — RPE 10
`.max` punaisena, puuttuva `.none` "–" `aria-hidden`; lämmittelyt `.warm`
L1, L2 … ennen työsarjoja, cluster "× 4 osasarjaa", huomio
`.history-set-note`; rivin `aria-label` "Sarja 1: 82,5 kg × 6, RPE 8" /
"Lämmittely 1: …"). Toiminnot `.history-actions`: `[data-history-kehitys]`
(ei yhdistelmäliikkeelle; Kehitys laskettu ja liike puuttuu → toast
"Liikkeelle ei ole vielä kehitystä"; leveänä valinta paneeliin ja
`navigate({kehitys, null})`, kapeana `navigate({kehitys, norm})`;
laskematta ollessaan `loadKehitys`-loppu pudottaa listaan) ja
`[data-history-fix]` vain kun `canFix` = liike käytössä olevassa
ohjelmassa **ja** `exerciseLogIndex[id].date === date` (myös
yhdistelmäliikkeelle, kehotteen sääntö 5.2; taulukon "ei kumpaakaan" oli
ehdollistettu samaan sääntöön): asettaa `activeWeek`,
`expandedDaySummaries` ja `state.openAfterNavigate = id` ja kutsuu
`navigate({ohjelma})`; lippu kulutetaan `applyScreen`-funktion lopussa
(`toggleExercise(id)`, koska `navigate` palaa ennen popstate-tapahtumaa;
kapeana kirjausruutu syvyydellä 2). Poisto `.history-delete`-lohkossa
ilman inline-tyylejä; `.history-date-head.open` saa alaviivan. `.hist-*`-
luokat poistettu.

Historia-kehote 3 (0.4.18): `state.historyFilter` (vain istunnon ajan; ei
nollata `applyScreen`-funktiossa) ja `HISTORY_FILTER_MIN_DAYS = 5`:
`renderHistoria` piirtää `#history-filter[data-history-filter]`-hakukentän
(`type="search"`, id `restoreFocus`-tunnistukseen), kun päiviä on yli
viisi, ja `#history-list`-kääreen sisällön `renderHistoryList(filter)`
(`historyMatches(entry, q)` = osajono nimessä kirjainkoosta riippumatta;
osuvat päivät `renderHistoryDate(date, onlyIds)`-kutsulla aina avattuina
vain osuvine liikkeineen, ilman `data-history-date`/`role`/nuolta/poistoa,
yhteenveto koko päivästä; laskuri `.history-filter-summary` "9 päivää" ja
`[data-history-kehitys]`-linkki, kun osumien `kehitysKeyFor`-normeja on
yksi eikä se ole yhdistelmä; ei osumia → `.history-empty`). `input`-
käsittelijä päivittää `#history-list`-elementin ilman `render()`-kutsua
(kuten `data-kehitys-filter`); Escape kentässä tyhjentää arvon
dokumentin `keydown`-käsittelijässä. Testi: `test_history_2_3.js`. Avatun päivän sarjat (`renderHistoryDate`) ovat
`.hist-sets`-lohkossa inline-lohkoina `.hist-set` (" · "-erottimet
tekstisolmuina välissä, jotta teksti "1: 60 kg × 10 · 2: …" säilyy
testeille ja ruudunlukijalle), ja sarjan alla on `.hist-set-rpe` "RPE 8"
vain, kun merkinnän sarjalla on `rpe`-luku (käyttäjän päätös 10.9.2026;
sama esitys kuin Viime-solussa; ruudunlukijalle `.sr-only`-pilkku ennen
sitä). Lämmittelyjä Historia ei näytä. Testi: `test_viime_rpe.js` osio 6. Poisto on kortin alareunan tekstipainike, joka
vahvistettaessa muuttuu tuhoavaksi painikkeeksi; `data-delete-history` ja
`confirmingDeleteDate` ennallaan.

Historia: liikkeen siirto toiselle päivälle (0.4.22, käyttäjän pyyntö
19.9.2026: eri päivien treenit oli kirjattu samalle päivälle).
`renderHistoryExercise` piirtää toimintoriville aina kolmannen painikkeen
`[data-open-sheet="siirto"][data-date][data-id]` "Siirrä päivälle"
(`.history-actions` rivittyy); yleinen `[data-open-sheet]`-käsittelijä
asettaa `state.moveExercise = { date, id }`, ja `renderSheet` piirtää
pohjalevyn "Siirrä toiselle päivälle": liikkeen nimi ja kirjauspäivä
(`formatDateFI`), `<input type="date" id="move-date">` (oletus lähdepäivä,
`max` tänään), selite, Peruuta (`data-close-sheet`) ja
`[data-move-exercise-confirm]` "Siirrä" — painike on
`[data-close-sheet]`-sulkutarkistuksen poikkeuslistassa kuten RPE-ikkunan
painikkeet. `moveHistoryExercise(fromDate, id, toDate)` (heti
`deleteHistoryEntry`-funktion perässä): estää saman päivän ja tilanteen,
jossa kohdepäivällä on jo sama liike-id (yhdistäminen hävittäisi toisen
merkinnän), siirtää liikeolion samalla avaimella kohdepäivän merkintään,
kirjoittaa `loggedAt`-kenttään uuden päivän vanhalla kellonajalla (viite-
kerrat ja 1RM järjestyvät `loggedAt`-arvon mukaan) ja `editedAt`-leiman
(merkki "korjattu"), tallentaa kohteen, tallentaa tai poistaa tyhjentyneen
lähteen (`historyDates` ja `historyCache` mukana), lataa `todayEntry`-
olion uudelleen, jos kumpikin päivä on kirjauspäivä, tyhjentää liikkeen
luonnoksen, kutsuu `rebuildTrackersForName`, `rebuildManualMaxForName` +
`saveManualMax`, nollaa `kehitys`, `clusterRef` ja `painAnalysis`,
rakentaa `exerciseLogIndex`-indeksin ja avaa kohdepäivän
(`expandedHistoryDate`). Ilmoitus "Siirretty päivälle <formatDateFI>".
`closeSheet` palauttaa fokuksen juuri siihen siirtopainikkeeseen
(`moveTarget`). Samalla `renderHistorySetRow` sai `role="group"`, koska
axe 4.10 kieltää `aria-label`-attribuutin pelkällä div-elementillä.
Testi: `test_history_move.js` (painike ja levy, saman päivän ja saman
liikkeen esto, siirto uudelle päivälle, lastSet, tyhjän päivän poisto,
1RM-päivä, Escape/Peruuta ja fokus, suodatintila, axe, 360 px);
`test_history_2_3.js` suodattaa siirtopainikkeen toimintolistastaan.

Kehitys näyttää vertailurivin vain, kun vertailukohta on olemassa, ja yhdellä
merkinnällä yhden lauseen "Ei dataa" -rivien sijaan.

## Viimeistely (toteutettu, UX-vaihe 6)

Tyhjät tilat ovat yksi komponentti `renderEmptyState(iconName, title, body,
actionsHtml, compact)` (`.empty-state`): Historia ja Kehitys ilman merkintöjä
(`goToProgramButton()`, `data-tab="ohjelma"`), tyhjä viikko Ohjelma-näkymässä
(toiminto `[data-edit-program]`), 1RM-lista ilman MAX-liikkeitä ja tabletin
liikepaneeli ilman avattua liikettä. `.empty` jää lataustilojen tekstille.

Painallustila on CSS:ssä: kaikilla kosketuskohteilla on lyhyt siirtymä ja
`:active{transform:scale(.94)}` (otsikkoriveillä pelkkä himmennys), hover
vain `@media (hover:hover)`. Valmis-merkin animaatio (`@keyframes pop`,
luokka `.pop`) asetetaan vain juuri muuttuneelle merkille: `state.justDone`
(`{id, idx}`, asetetaan `[data-toggle-done]`-käsittelijässä),
`state.justSavedEx` ja `state.justDoneDay` (asetetaan `[data-save-ex]`-
käsittelijässä ennen `completeAndAdvance()`-kutsua, koska se piirtää useaan
kertaan). Liput nollataan klikkikäsittelijän alussa, ei `render()`:ssä,
jotta saman toimen useat piirrot eivät katkaise animaatiota. Molemmat
noudattavat `prefers-reduced-motion`-asetusta yhteisellä säännöllä.

Tablettiasettelu: `wideQuery = matchMedia("(min-width: 768px)")` ja
`isWideLayout()`. `render()` lisää `#app`-elementille luokan `wide` vain
Ohjelma-näkymässä ohjelman kanssa (ei muokkaustilassa), ja `renderOhjelma()`
kääri sisällön `.ohjelma-cols`-ruudukkoon: vasemmalla `.ohjelma-list`
(päivämäärärivi, valitsin, päiväkortit ja liikkeet ilman sarjoja,
`renderExercise(ex, true)`), oikealla kiinnitetty `<aside class="ohjelma-pane">`,
jossa avattu liike sarjoineen tai tyhjä tila. Kaikki käsittelijät toimivat
`data-id`-attribuutein, joten sama liike voi olla DOM:ssa kahdesti (listan
otsikko ja paneeli) ilman erillisiä käsittelijöitä. `wideQuery`:n
change-tapahtuma piirtää näkymän uudelleen, kun palstamäärä vaihtuu.
Playwrightin oletusikkuna on 1280 px leveä, joten vanhat testisarjat ajavat
Ohjelma-näkymän kaksipalstaisena; `test_v6.js` testaa molemmat leveydet ja
vaihdon niiden välillä.

## Otsikkorivin ja alavalikon kuvakkeet (toteutettu)

Otsikkorivin oikeassa kulmassa on Ohje (`data-tab="ohje"`, kysymysmerkki)
kaikissa näkymissä ja sen vieressä kynä (`[data-edit-program]`) vain
Ohjelma-näkymässä. Alavalikossa ovat Ohjelma, Historia, Kehitys ja Asetukset;
Asetukset siirrettiin otsikkorivin rataskuvakkeesta valikon viimeiseksi
kohdaksi käyttäjän pyynnöstä. Molemmat ovat tavallisia `[data-tab]`-
kohteita, joten välilehtikäsittelijä (settingsSection- ja
pendingRestore-nollaus, muokkaustilan esto) on sama.

## Ohjelmakirjasto (toteutettu)

Useita ohjelmia, yksi käytössä. `state.program` on käytössä oleva ohjelma
(avain `workout-program`, kaikki vanha koodi lukee sitä ennallaan) ja
`state.programs` muut ohjelmat (avain `programs`, `saveProgramLibrary()`).
`allPrograms()` listaa käytössä olevan ensin. Ohjelmalla on `id`
(`prog-<aikaleima>-<laskuri>`, `newProgramId()`) ja `name`;
`ensureProgramShape()` täydentää molemmat vanhoihin tallennuksiin, CSV-
jäsennin luo tunnisteen ja `handleFile()` antaa nimeksi tiedoston nimen
(`fileBaseName`), PDF-tuonti ensimmäisen tiedoston nimen ja rakentaja
"Oma ohjelma". Nimi on muokattavissa muokkaustilan yhteenvetokortissa
(`[data-editor-program-name]`) ja kirjastossa (`renameProgram`).

Uusi ohjelma ei koskaan korvaa käytössä olevaa ilman hyväksyntää.
`applyImportedProgram()` siirtää käytössä olleen ohjelman kirjastoon (ei
poista) ja poistaa uuden kirjastosta, jos se tuli sieltä. Kun ohjelma on jo
käytössä, CSV-tuonti (`handleFile`) ja muokkaustilan Valmis uudessa ja
tuontitilassa (`finishProgramEdit`) kutsuvat `offerNewProgram(program,
source)`:ia, joka avaa pohjalevyn `state.sheet === "uusi-ohjelma"`
(`state.pendingProgram`): `[data-new-program-activate]` →
`acceptPendingProgram(true)` → `applyImportedProgram`;
`[data-new-program-shelve]` → kirjastoon ilman vaihtoa;
`[data-new-program-cancel]` ja `closeSheet()` → muokkaus jatkuu (luonnos on
ennallaan, koska viimeistely tehtiin kopioon) tai CSV-tuonti perutaan.
Ilman ohjelmaa tallennus kulkee suoraan kuten ennen.

Kirjasto on Asetusten Ohjelma-osiossa (`renderProgramLibrary()`, `.lib-row`):
`[data-program-activate]` → `activateProgram(id)` (sama
`applyImportedProgram`-polku), `[data-program-rename]` /
`[data-program-rename-save]` (`state.programRename`),
`[data-program-delete]` kahdella painalluksella
(`state.confirmingDeleteProgram`); käytössä olevaa ei voi poistaa. Ohjelma-
näkymä näyttää `.program-row`-rivin (nimi ja `[data-open-settings="ohjelma"]`)
vain, kun ohjelmia on useampi. Merkintöihin ei kosketa missään näistä:
ne on sidottu liike-id:eihin, jotka ovat ohjelmakohtaisia, joten
ohjelmaan palattaessa `buildExerciseLogIndex()` löytää sen tehty-tilan
ennallaan. `resetAll()` poistaa myös kirjaston. Testit: `test_programs.js`.

## Selaimen historiapino (History API, toteutettu, 0.4.1)

Ruudun vaihdot kulkevat `navigate({ view, detail })`-funktion kautta, ja vain
ne viedään selaimen historiapinoon (ei avattuja liikkeitä, päiviä,
vahvistuksia eikä Kehityksen välilehteä). URL ei muutu: `pushState` ja
`replaceState` kutsutaan `location.href`-osoitteella. Merkintä on
`{ view, detail, depth }`; `depth` 0 = juuri (Ohjelma tai tuontiruutu),
1 = välilehti (Historia, Kehitys, Ohje), 2 = päällysruutu (Asetukset,
Kehityksen liikenäkymä). Nykyinen merkintä luetaan aina `history.state`-
oliosta (`currentHistoryScreen()`), joten sovellus ei pidä peilipinoa;
`state.navDepth` peilaa syvyyden. Säännöt (`navigate`): juuresta välilehdelle
`pushScreen`, välilehdeltä toiselle `replaceScreen`, välilehdeltä Ohjelmaan
`historyBack()`, päällysruutu aina `pushScreen`. Aktiivisen välilehden
napautus uudelleen (myös Asetukset) ei muuta pinoa vaan palauttaa ruudun
perustilan (`resetScreenState()`: riviluettelo, vieritys ylös) — poikkeaa
kehotteen rataskuvakelauseesta tietoisesti, koska Asetukset on alanavigaation
kohde ja aktiivisen kohteen napautus palaa sen juureen; sulkeminen tapahtuu
eleellä tai toisella välilehdellä. Kun
päällysruutu on auki ja pyydetään muuta ruutua, `state.navPending` saa
kohteen ja `historyBack()` kutsutaan; `popstate` tyhjentää sen ja kutsuu
`navigate(pending)` uudelleen (kaksivaiheinen siirtymä ilman välirenderöintiä).
`state.navSuppress` merkitsee sovelluksen itse aiheuttamaa paluuta; jos
popstate ei tule 800 ms:ssa, `finishPendingWithoutHistory()` tekee siirtymän
`replaceScreen`-kutsulla.

`applyScreen(screen)` on ainoa paikka, jossa `state.view` ja
`state.kehitysDetail` asetetaan (testi tarkistaa tämän grep-haulla); se nollaa
`confirmingReset`, `settingsSection`, `programRename`,
`confirmingDeleteProgram` ja `pendingRestore`, lataa Historian tai Kehityksen
tarvittaessa, vierittää uuden ruudun ylös ja palauttaa `kehitysScrollY`:n
liikenäkymästä listaan palattaessa. `restoreHistoryScreen()` ajetaan initin
lopussa: `history.state` palautetaan (uudelleenlataus välitilassa), muuten
nykyinen merkintä korvataan juurella. `loadKehitys` sulkee liikenäkymän, jos
liikettä ei enää ole: avoin päällysruutu `navigate`-kutsulla (back), ladattu
sivu `replaceScreen`-kutsulla syvyydelle 1. `resetAll` korvaa merkinnän
juurella. Kutsupaikat: `[data-tab]`, `[data-open-kehitys]`,
`[data-close-kehitys]`, `[data-open-settings]` (asettaa osion navigaten
jälkeen, koska se avataan juuresta synkronisesti), `applyImportedProgram`,
`applyBackupRestore`, `acceptPendingProgram`, `cancelProgramEdit`. Ohjelma-
näkymän avattu liike ei ole pinossa: taaksepäin poistuu sovelluksesta kuten
ennen. Ei hash-reititystä, ei beforeunload-varoitusta. Testi:
`test_history.js` (goBack/goForward, pinon pituus, URL, uudelleenlataus).

## Kehityksen laajennus: ennätykset, volyymi ja toteutuminen (toteutettu, 0.4.0)

Yhteinen laskentapohja: `loadAllEntries()` tekee yhden `storeList("entries:")`-
skannauksen ja palauttaa `[{ date, entry }]` nousevasti; `buildAllOneRepMaxSeries`,
`buildTotalWeightSeries`, `buildPainAnalysis` ja uudet rakentajat ottavat sen
parametrina (eivät ole enää async). `loadKehitys()` kutsuu sitä kerran; vaivalokin
poistokäsittelijä kutsuu `buildPainAnalysis(await loadAllEntries())`. Liikeavain on
kaikkialla `kehitysKeyFor(fullName)` = `baseExerciseName` pienin kirjaimin (sama
kuin 1RM-sarjoissa variaatioiden yhdistämisen jälkeen). `isoWeekStartISO(date)`
palauttaa viikon maanantain paikallisena päivänä.

Rakentajat: `buildRecordsByName` (raskain paino, paras sarja, `byRepRange`
`REP_RANGE_BINS`-alueille; vain paino > 0 ja toistot >= 1; tasatilanteessa
enemmän toistoja, sitten aikaisin päivä), `buildVolumeByName` (piste per päivä:
tonnage, sets, reps; yhdistelmillä tonnage 0), `buildWeeklySummary`
(`weekStart`, tonnage, sets, reps, days, byExercise) ja `buildAdherenceByName`
(kerta = merkintä; sarjat vs. `plan.sets`, toistotavoite, ehdotettu paino,
progressiotavoite 1RM-pisteestä ≥ edellinen × `PROGRESSION_COEFFICIENT`;
`stalled` = vähintään neljä pistettä ja kolme viimeisintä kukin ≤ edeltävä;
teho- ja yhdistelmäliikkeet ohitetaan progressiosta ja pysähtymisestä,
teholiikkeet tunnistetaan nykyisestä ohjelmasta `programIntensityNorms()`).
`buildAdherenceSummary` summaa `ADHERENCE_WINDOW_DAYS` (28) päivän kerrat ja
kerää pysähtyneet. `state.kehitys`-alkioissa ovat `norm`, `records`, `volume`
ja `adherence`; lisäksi `state.kehitysWeekly` ja `state.kehitysAdherenceSummary`.

Tietomalli: `saveExerciseLog` tallentaa merkintään `plan: { sets, reps,
suggestedWeight }` (`buildPlanForExercise`; `autoCalcInfo.type "formula"` sai
kentän `weight` = painavin ehdotettu työsarja; teholiikkeillä null). Jo
tallennetun merkinnän `plan` säilytetään korjauksessa. Simulointi kirjoittaa
saman kentän. Ilman kenttää olevat merkinnät päätellään `inferPlan(key, data,
previousSession)`: sarjat ja toistot `findExerciseById(key)`:stä, ehdotus
edellisen kerran viimeisestä sarjasta samalla kaavalla kuin `buildDraftRows`
(arvio, mainittu Ohjeessa). Vientiä ja tuontia ei muutettu.

Näkymä (master–detail): `renderKehitys()` piirtää etusivun `renderWeekCard()`
(2 × 2 `.stat-grid`, kokonaispaino vain jos > 0, `[data-toggle-week-exercises]`,
`state.expandedWeekExercises`; 0.4.6 alkaen myös 12 viikon volyymipylväät,
ks. oma osio), `renderVolumeCard()` (korvaa
`renderTotalWeightCard`; `[data-volume-scale]`, `state.kehitysVolumeScale`,
Päivä-karkeus on täsmälleen entinen käyrä), `renderAdherenceCard()`
(`renderMetricRow(label, hit, total)`, nimittäjä 0 → rivi pois; kaikki pois →
`ADHERENCE_EMPTY_TEXT`; pysähtyneet `.chip-danger.chip-btn`
`[data-open-kehitys]`) ja `renderKehitysList()` (`.kehitys-row` `role="button"`
`[data-open-kehitys]`, suodatin `[data-kehitys-filter]` kun liikkeitä >
`KEHITYS_LIST_FILTER_MIN`, päivitetään `#kehitys-list`-elementtiin input-
tapahtumassa ilman render()-kutsua). Vain yhdistelmämerkinnät → viikko-kortti
ja yksi lause. Liikenäkymä `renderKehitysDetail(item)`: `state.kehitysDetail`
(norm), `state.kehitysDetailTab` (`1rm | ennatykset | volyymi | toteutuminen`,
`role="tablist"`, datattomat `.dim`), `[data-close-kehitys]`; avaus tallentaa
`state.kehitysScrollY` ja vierittää ylös, paluu palauttaa asennon
`afterRender`-kutsulla; alanavigaation Kehitys nollaa `kehitysDetail`.
`loadKehitys` nollaa sen, jos liike ei enää ole tuloksissa. Näppäimistö:
`[data-open-kehitys]`, `[data-close-kehitys]`, `[data-kehitys-tab]` keydown-
listassa. Luvut `fmtKg`/`fmtInt`/`fmtSignedInt` (tuhaterotin ja yksikön
välilyönti ovat sitovia välilyöntejä; huomioi testien regexeissä); volyymin ja
määrien erot neutraalilla värillä (`neutralDelta`), 1RM-erot `renderDeltaValue`.
Testit: `test_kehitys2.js` (fixture `prog_10.csv`), `test_kehitys.js` ja
`test_variant_merge.js` avaavat liikenäkymän rivistä.

## Kehityksen etusivun segmentit ja viikkopylväät (toteutettu, 0.4.6)

Etusivu on kolme segmenttiä `state.kehitysTab` (`"yhteenveto" |
"liikkeet" | "vaivat"`; ei tallenneta, ei nollata `resetScreenState`- eikä
`applyScreen`-funktiossa, joten liikenäkymästä ja välilehdeltä palataan
samaan segmenttiin; ei ruutu historiapinossa). `renderKehitysSegments()`
on sama `segmented kehitys-tabs`-valitsin kuin liikenäkymässä
(`role="tablist"`, `aria-label="Kehityksen osiot"`, painikkeet `role="tab"`
`[data-kehitys-front-tab]`; käsittelijä asettaa tilan ja vierittää ylös
`afterRender`-kutsulla; attribuutti on `keydown`-käsittelijän
valitsinlistassa). `renderKehitys()`: lataus, tyhjä tila
(`renderPainSection(false)` otsikolla, ei valitsinta) ja liikenäkymä
ennallaan; muuten valitsin + Yhteenveto (`renderWeekCard` + datalla
`renderVolumeCard` + `renderAdherenceCard`), Liikkeet (`renderKehitysList`
tai ilman 1RM-dataa `detailSentence`-lause, joka aiemmin oli Viikko-kortin
alla) tai Vaivat (`renderPainSection(true)` ilman `day-heading`-otsikkoa).
Liikelistan otsikko on yhä "Liikkeet" + lukumäärä erillisinä span-
elementteinä (rivin sisältö kuuluu Kehitys-sarjan kehotteeseen 2).

`buildWeeklySummary` antaa viikolle `deload: true`, kun jonkin merkinnän
`data.deload === true` (kenttä on jo merkinnässä, `saveExerciseLog`).
`renderWeekBars(weekly, idx)` piirtää Viikko-korttiin `stat-grid`-ruudukon
jälkeen ja ennen `[data-toggle-week-exercises]`-painiketta SVG:n
(`viewBox 0 0 300 48`, `role="img"`, `aria-label="Viikkovolyymi 12
viikolta, 29.6.–14.9."`): kaksitoista viikkoa kortin viikkoon päättyen
(`isoAddDays(weekStart, -7k)`), pylväs `x = k*25`, leveys 18, `h =
max(4, round(tonnage/max*44))` tai 2 ilman merkintöjä; täyttö kortin
viikko `--brass`, kevennys `--line-strong`, muu `--surface-2`, tyhjä
`--line`. Tyhjä merkkijono, kun suurin tonnage on 0 (vain yhdistelmä-
liikkeitä), jolloin otsikko `.week-bars-title` "Viikkovolyymi, 12 viikkoa"
ja `renderWeekBarsLabels` (ensimmäinen viikko, keskellä "kevennys"
`--line-strong`-värillä jos jokin jakson viikko oli kevennys, kortin
viikko) jäävät pois. Testi kehotteen tapauksille 1–13 ajettiin
Playwrightilla (`test_kehitys_seg.js`; huom. Playwrightin klikkaus
vierittää rivin näkyviin ennen klikkausta, joten `kehitysScrollY`-vertailu
lukee aseman vasta `scrollIntoViewIfNeeded`-kutsun jälkeen).

## Kehitys-sarja 2–5: listan rivi, käyrä, 1RM-kortti ja tabletti (toteutettu, 0.4.7–0.4.10)

**Liikelistan rivi (0.4.7).** `fourWeekDelta(points)` (heti `computeProgress`-
funktion perässä, puhdas): `current` = `bestWithin(points, latest.date, 28)`
(sama luku kuin `progress.current`), `past` = paras jaksolta, joka päättyy
`latest.date − 28` päivää, tai viimeisin arvo ennen sitä; `past === null` →
ei muutosriviä. `kehitysListRowsHtml` käyttää sitä `renderDeltaValue`-
kutsussa (aiemmin viimeisin vs. edellinen piste, jolloin kevyt päivä värjäsi
rivin punaiseksi). `renderSparkline(points, muted)`: 8 viimeistä pistettä,
`viewBox 0 0 64 24`, `x = 2 + i/(n−1)·60`, `y = 22 − …·20`, samat arvot →
±1; alle 2 pistettä → tyhjä; pysähtynyt liike mist-värillä. Rivin rakenne
body → sparkline → right → nuoli; `.kehitys-spark` piilossa alle 375 px.

**Käyrä (0.4.8).** `state.kehitysRange` (`KEHITYS_RANGES`: 4vk 28, 3kk 91,
1v 365, kaikki; ei tallenneta) on yksi tila kaikille käyrille;
`renderRangeSelector()` (`.segmented.chart-range`, `[data-kehitys-range]`)
on 1RM-kortissa, volyymikortissa (Viikko|Päivä-valitsimen rinnalla) ja
Volyymi-välilehdellä. `filterByRange(points, secondary)` rajaa
`daysAgoISO(days − 1)`-päivästä; `renderProgressChart(points, titlePrefix,
unit, secondary, opts)` suodattaa itse, ellei `opts.prefiltered`
(`renderOneRepMaxChart` suodattaa ensin, jotta `captions` ja `markers`
osuvat indekseihin), ja tyhjä sarja antaa `.chart-empty`-lauseen (myös
prefiltered-tyhjä). SVG `viewBox 0 0 320 118`: kolme apuviivaa `vMax`,
`round1((vMax+vMin)/2)`, `vMin` arvoineen (`font-size="11"`, samat arvot →
yksi viiva), päivämäärät HTML-rivinä `.chart-x` (alku, kalenterin keskipiste
`isoAddDays(alku, floor(päiviä/2))`, loppu; yksi piste `.chart-x.single`),
näkymätön `rect.chart-hit[data-chart-point][data-caption][data-x][data-y]`
per piste puoliväliin naapureihin (ensimmäinen 40:stä, viimeinen 310:een),
`.chart-caption[role=status][aria-live=polite]` oletuksena viimeisen
pisteen selite, `opts.markers` pystykatkoviivoina tekstillä (teksti pois,
jos edellinen merkki < 30 yksikköä vasemmalla). Kääre `.chart`.
`[data-chart-point]`-käsittelijä päivittää selitteen ja `.chart-dot-on`-
ympyrän suoraan DOM:iin ilman `render()`-kutsua. `buildAllOneRepMaxSeries`
antaa pisteelle `deload` (`data.deload`, saman päivän merkinnöistä OR);
1RM-käyrän selite on "12.9. · 106 kg mitattu (106 kg × 1) · paras 4 vk
106 kg" ja legenda `.chart-legend` (paras 4 viikolta / päivän arvio).
Volyymiselite on `päivä · fmtValue kg` ilman tuhaterotinta (kehotteen
pseudokoodin ja testin mukaan; UI-tekstiesimerkki "2 640 kg" jäi
toteuttamatta tietoisesti).

**1RM-kortti (0.4.9).** `renderKehitysCard`: ei liikkeen nimeä; hero
`.kehitys-hero` (label "Paras 1RM · 4 viikkoa", `fmtNumberFI(current)` +
yksikkö) ja `.kehitys-delta-chip` up/down/flat (`fourWeekDelta`, "+5 kg · 4
vk" tai "ei vertailua"); aikavälivalitsin + käyrä; `stat-grid` neljällä
ruudulla (Kuukausi, Puoli vuotta, Vuosi, Ennätykseen; arvo `fmtSignedKg`
luokalla `.up`/`.down`, alarivi `fmtPctPlain` — uusi apuri ilman sulkeita,
`fmtSignedPct` ennallaan — tai "Ei dataa" / "ennätys nyt"); alle 2
pistettä → `.kehitys-note`-lause; variaatiot `.kehitys-variants`-chippeinä;
kaksi `.kehitys-note`-selitettä ("Mitattu/Laskennallinen 90 kg × 5, pvm" ja
"Viimeisin treeni …" vain, kun päivät eroavat). Inline-tyylit korvattu
luokilla `.kehitys-card`, `-head`, `-title`, `-value`, `-sub`, `.kehitys-
note`, `.kehitys-table-title` Viikko-, volyymi- ja toteutumiskorteissa,
välilehdissä ja `detailSentence`-lauseessa (arvot täsmälleen entiset).

**Tabletti (0.4.10).** `kehitysWide()` = ohjelma, ei lataus, ei
muokkaustila, `state.view === "kehitys"`, leveä. `render()` antaa `wide`-
luokan myös Kehitykselle; `renderKehitys` palauttaa leveänä
`.kehitys-cols` (`.kehitys-list` = segmentit sisältöineen, `aside.kehitys-
pane[aria-label="Valittu liike"]` = `renderKehitysDetail(item, true)` ilman
`‹ Kehitys` -painiketta tai tyhjä tila "Valitse liike"); valittu rivi
`.kehitys-row.on[aria-current=true]`. `[data-open-kehitys]` leveänä asettaa
`kehitysDetail` ja `kehitysDetailTab` ja piirtää ilman pinoa; `applyScreen`
leveänä säilyttää valinnan välilehdeltä (Historia, Asetukset, Ohje)
palattaessa ja nollaa sen vain juureen (Ohjelma) siirryttäessä — kehotteen
sanamuoto "screen.view !== kehitys nollaa" olisi rikkonut sen oman
testitapauksen 4, joten sääntö on juuri/ei-juuri; syvyyden 2 merkintä
(uudelleenlataus tai paluu kapeasta) siirretään paneeliin ja pino
korjataan `replaceScreen({kehitys,null},1)`. `loadKehitys`-loppu nollaa
poistuneen liikkeen leveänä ilman `navigate`-kutsua. `onWideChange`:
kapeaksi → `pushScreen({kehitys, detail}, 2)`, leveäksi →
`replaceScreen({kehitys,null},1)`. Kapea käytös ennallaan. Testi:
`test_kehitys_2_5.js` (kehotteiden 2–5 tapaukset; pisteiden arvot yhden
toiston mittauksina, jotta 1RM on paino sellaisenaan; poistuneen liikkeen
tapaus uudelleenlatauksella pinolla `{kehitys, id, 2}`).

## Kehityksen 1RM: liukuva paras (toteutettu)

`buildAllOneRepMaxSeries()` antaa jokaiselle päivälle raskaimman sarjan
Epley-arvion ja tallentaa pisteeseen myös sarjan (`set`) ja `measured`-lipun
(yhden toiston sarja on mittaus). `computeProgress()` ei käytä viimeisintä
pistettä vaan `bestWithin(points, latest.date, ONE_REP_MAX_WINDOW_DAYS)`:ia:
kortin luku on paras arvo jaksolta, joka päättyy viimeisimpään merkintään,
ja vertailukohdat (`month`, `halfYear`, `year`) lasketaan samalla säännöllä
kunkin ajankohdan jaksolta (jaksolla ilman merkintöjä viimeisin arvo ennen
sitä). `record` on kaikkien aikojen paras; "Edelliseen treeniin" ja "Koko
historian aikana" -rivit poistettiin ja tilalle tuli "Ennätykseen
verrattuna" sekä kortin rivi viimeisimmän treenin omasta arviosta.
`renderOneRepMaxChart()` piirtää liukuvan parhaan viivana ja päiväarviot
katkoviivana (`renderProgressChart`-funktion valinnainen `secondary`).
Syy: Epley olettaa sarjan tehdyksi uupumukseen, joten ohjelmoitu
submaksimaalinen päivä ei saa pudottaa mitattua maksimia. Testit:
`test_kehitys.js`.

## Vaivaloki (toteutettu)

`state.painLog` on taulukko `{ id: "pain-<aikaleima>", date, region, side,
severity, note }` avaimella `pain-log` (`STORAGE_PAIN_KEY`, `savePainLog()`);
`region` on `PAIN_REGIONS`-taulukon avain, `side` on `"vasen"`, `"oikea"`,
`"molemmat"` tai `""` (puoli kysytään vain `PAIN_PAIRED`-kehonosilta) ja
`severity` 1–3. Kirjaus tehdään Ohjelma-näkymässä (`renderPainEntry()` heti
päivämäärärivin jälkeen; `state.showPainForm`, `state.painDraft`) ja
kohdistuu kirjauspäivälle `state.draftDate`, kuten merkinnätkin.
Puoli- ja voimakkuuspainikkeet piirtävät näkymän uudelleen, joten
`painNoteFromDom()` kopioi huomiokentän luonnokseen ennen piirtoa; kehonosan
vaihto (`change`-käsittelijä, `#pain-region`) nollaa puolen ja palauttaa
fokuksen `afterRender`-kutsulla. Tallennus ja poisto asettavat
`state.painAnalysis = undefined`; tallennus lisäksi `state.kehitys =
undefined`, jotta Kehitys lasketaan uudelleen seuraavalla avauksella, ja
poisto (Kehitys-näkymässä) laskee analyysin heti uudelleen.

`buildPainAnalysis()` (`buildTotalWeightSeries()`:n jäljessä) lukee
merkinnät kuten Kehityksen muut sarjat: liikkeen päivävolyymi on työsarjojen
paino × toistot (lämmittelyt ovat erillisessä `warmups`-taulukossa eivätkä
sisälly), yhdistelmäliikkeet (`isCombo`) ohitetaan. Tavanomainen
viikkovolyymi on liikkeen koko volyymi jaettuna niiden ISO-viikkojen
(`isoWeekKey`) määrällä, joilla liikettä on kirjattu. Kirjaukset ryhmitellään
avaimella `region|side`; ryhmälle, jolla on vähintään `PAIN_MIN_EPISODES`
kirjausta, lasketaan jokaisen kirjauksen ikkuna `date−PAIN_WINDOW_DAYS …
date−1`, ja liike poikkeaa, kun ikkunan volyymi > `PAIN_VOLUME_RATIO` ×
tavanomainen. Löydös (`findings: [{ name, count, share }]`) näytetään, kun
`share ≥ PAIN_MIN_SHARE`; pienemmät ryhmät palautetaan `tooFew: true`.
`loadKehitys()` tallentaa tuloksen `state.painAnalysis`-tilaan ja
`renderPainSection()` lisätään `renderKehitys()`:n molempiin haaroihin
(myös tyhjään tilaan), jotta loki näkyy ilman 1RM-dataa. Vienti
`exportPainLogCSV()` on oma tiedosto (`vaivaloki_<pvm>.csv`, BOM);
varmuuskopion muotoon ei kosketa, eikä loki sisälly siihen. `resetAll()`
poistaa lokin. Testit: `test_pain.js`, `a11y_pain.js`.

## Tarkistettavat laskentaparametrit

Sovelluksen laskentakaavojen vakiot ovat alkuarvoja, joita on arvioitava
uudelleen, kun sovelluksen toiminnasta on kokemusta pidemmältä jaksolta.
Käynnissä on 10 viikon testijakso (ensimmäinen viikko alkoi syyskuussa
2026); kaavoja säädetään viimeistään testijakson päätyttyä, mutta niitä voi
muuttaa myös sen aikana. Tarkasteltavat arvot:

- `ONE_REP_MAX_WINDOW_DAYS = 28`: Kehityksen 1RM:n liukuvan jakson pituus.
  Lyhyempi jakso reagoi nopeammin mutta pudottaa lukua pelkkien kevyiden
  viikkojen jälkeen; kahdeksan viikkoa vastaisi tavallista maksimien
  testausväliä.
- `PROGRESSION_COEFFICIENT = 1.0125`: painoehdotuksen tavoiteltu kehitys
  per treenikerta.
- `TUNTUMA_RIR = { kevyt: 4, sujuva: 3, tyolas: 2, raskas: 1, aarirajoilla: 0 }`
  ja `TARGET_RIR = 2`: tuntuma RIR-arvona (varastoon jääneet toistot) ja
  työsarjan tavoitetuntuma. `tuntumaToRir(rpe)` kääntää tallennetun RPE-
  luvun 6–10 (`WARMUP_SCALE[i].key`) RIR:ksi; puuttuva tuntuma = `TARGET_RIR`,
  jolloin laskenta supistuu entiseen. `weightFromFeel(weight, reps, rir,
  targetReps, progression)` = `MROUND(weight × (1 + (reps + rir)/30) ×
  progression / (1 + (targetReps + TARGET_RIR)/30), 2,5)` on yhteinen
  kaava: `buildDraftRows` käyttää sitä `feelSuggestion()`-apurin kautta
  (status `"feel"`, ilman hit/near/missed-rajoja) kun viitesarjalla
  `last.sets[k].rpe` on luku — poikkeus: RIR 0 (Äärirajoilla) ja
  `prevReps >= targetReps` → `prevWeight` sellaisenaan (valmennuksellinen
  peruste: tavoitteen täyttänyt loppusarja on normaali, kevennys jakaisi
  volyymin vain uudelleen; kevennys vasta vajeesta; testi
  `test_feel_rule.js`, tavoite 10 ja 42,5 kg: sujuva/työläs/äärirajoilla
  → 45 / 42,5 / 42,5) — `inferPlan` samalla apurilla, ja
  `applyWarmupAdjustment` progressiolla 1, kun valmis lämmittely on
  työsarjan tasoinen (paino ≥ ensimmäisen työsarjan `base`, toistot ≥
  tavoite): jokainen keskeneräinen ja käsin muokkaamaton työsarja saa
  painon, `warmupAdjust.status === "worklevel"` (`from`, `to`, `sets`,
  `changed`) ja selite `setRangeText(sets)`-luettelolla. Funktio palauttaa
  ensin aiemman säädön (`weight === adjusted` → `base`), joten tuntuman
  vaihto lähtee aina alkuperäisestä ehdotuksesta. Työsarjan tuntuma on
  kentässä `rpe` kuten lämmittelyillä (ei erillistä `tuntuma`-kenttää):
  valinta tehdään RPE-ikkunassa (ks. oma osio; sama `[data-warmup-rpe]`-
  käsittelijä työ- ja lämmittelysarjoille, `[data-rpe-clear]` nollaa
  `rpe`-kentän), valittu
  luku näkyy `.rpe-btn-val`-merkkinä RPE-painikkeessa, `saveExerciseLog`
  vie sen merkinnän sarjaan ja `lastSet`-sarjaan, ja varmuuskopion
  `#MERKINNÄT`-osiossa on viimeisenä sarake `Tuntuma` (asteikon sana;
  `feelFromText()` lukee sanan tai luvun 6–10, puuttuva sarake = ei
  tuntumaa). Kehityksen `buildAllOneRepMaxSeries` ei käytä RIR:ää
  (historia pysyy vertailukelpoisena). Testi: `test_rir.js`.
- `WEIGHT_STEP = 2.5`, `PROGRESSION_MAX_FACTOR = 1.05` ja
  `REGRESSION_FACTOR = 0.95`: painoehdotuksen askel (sama kaikilla
  liikkeillä, myös käsipainoilla, käyttäjän päätöksellä), noston katto ja
  kevennys. Ehdotus on sarjakohtainen ja ehdollinen (`buildDraftRows`,
  `autoCalcInfo.perSet`, tilat `hit`/`near`/`missed`/`deload`); `state.lastSet`
  tallentaa sarjan `done`-tiedon.
- `HISTORY_DEPTH = 3` ja `DELOAD_FACTOR = 0.90`: `state.lastSet[nimi]` säilyttää
  päällimmäisen kerran `{ sets, date }` -muodossa ennallaan ja lisäksi
  `prior`-taulukon (enintään kaksi aiempaa kertaa, uusin ensin) sekä
  `deload: true` -lipun kevennyskerralle (`pushLastSet`,
  `rebuildTrackersForName` rakentaa saman merkinnöistä, merkinnässä
  `deload`). Jumitunnistus `buildDraftRows`-funktiossa: kolme kertaa ilman
  maksimipainon nousua (`maxes[0] <= maxes[viimeinen]`) ja vaje
  viimeisimmässä (`anyShortfall`) → `autoCalcInfo.plateau` ja jokaiselle
  sarjalle kevennys perSet-tilaan `"deload"`; ei laukea, jos jokin kolmesta
  kerrasta oli kevennys. Vaje ja kevennys noudattavat samaa tuntumasääntöä
  kuin ehdotus, sarjakohtaisesti:
  - ilman tuntumaa (perSet-tila `"near"` tai `"missed"`): vaje =
    `prevReps < targetReps`, kevennys `floorToStep(prevWeight ×
    DELOAD_FACTOR)` — täsmälleen entinen;
  - tuntuman kanssa (perSet-tila `"feel"`): vaje = `feelShortfall()` =
    `prevReps + tuntumaToRir(prevRpe) < targetReps + TARGET_RIR`, paitsi
    RIR 0 ja `prevReps >= targetReps` ei ole vaje (sama poikkeus kuin
    `feelSuggestion`; kaksi vajaaksi jäänyt Kevyt-sarja ei ole vaje);
    kevennys `floorToStep(feelTargetWeight(prevWeight, prevReps, RIR,
    targetReps, DELOAD_FACTOR))`, jossa `feelTargetWeight` on
    `weightFromFeel`-kaavan pyöristämätön ydin (ehdotus pyöristää
    lähimpään, kevennys alaspäin) — RIR 0 ja toistot täyttyivät kevennetään
    kuten ilman tuntumaa. Esimerkit tavoitteella 12: 162,5 × 10
    Äärirajoilla → 132,5; 162,5 × 12 Työläs → 145 (sama kuin ilman
    tuntumaa); 162,5 × 12 Äärirajoilla → ei vajetta (toisen sarjan
    laukaisemana 145); 162,5 × 10 Kevyt → ei vajetta, ehdotus 165.
  `perSet.prevRpe` säilyy `"deload"`-tilassa, joten `autoCalcHint` kertoo
  sarjan tuntumineen ("S1: 162,5 kg × 10 toistoa, äärirajoilla →
  kevennys") ja jumibanneri on "(−10 % tuntuma huomioiden)"; ilman
  tuntumaa rivi on "S1: kevennys" ja banneri "(−10 %)". Sama sääntö on
  kuvattu Ohjeen kohdassa "Jumitunnistus ja kevennys" ja READMEn
  Sarjapainojen laskenta -osiossa. Testit: `test_plateau.js` (ilman
  tuntumaa), `test_rir.js` osio H (tuntuman kanssa).
- `WARMUP_ADJUST_TOLERANCE = 2.5`, `WARMUP_MIN_MATCHES = 1`,
  `WARMUP_FACTOR_HEAVY = 0.95`, `WARMUP_FACTOR_VERY_HEAVY = 0.90` ja
  `WARMUP_FACTOR_LIGHT = 1.025`: lämmittelysäätö (`applyWarmupAdjustment`).
  Luonnosrivillä on `kind` (`"work"` | `"warmup"`), lämmittelyllä `rpe`,
  progressiorivillä `base` (ehdotus) ja säädön jälkeen `adjusted`; säätö
  koskee vain rivejä, joilla `weight === base` tai `weight === adjusted`,
  jotta RPE:n vaihto samassa treenissä säätää uudelleen mutta käsin
  muokattu rivi jää rauhaan. `lastSet`-kerroilla ja merkinnöillä on
  `warmups: [{ weight, reps, rpe }]`; lämmittelyt ovat varmuuskopiossa
  L-riveinä (ks. Varmuuskopio) mutta eivät Kehityksen laskennassa.
  Tuntuma kysytään käyttöliittymässä
  sanallisella asteikolla `WARMUP_SCALE` (Kevyt 6, Sujuva 7, Työläs 8,
  Raskas 9, Äärirajoilla 10; kuvaus = toistoja varastossa), mutta `rpe`
  tallennetaan yhä lukuna ja `data-rpe` on luku, joten käsittelijä, laskenta
  ja vanhat kirjaukset ovat ennallaan. Painikkeissa näkyvät luvut 6–10
  sanoineen (käyttäjän päätös 9.9.2026: ei hymiöitä; 10.9.2026: valinta
  siirtyi rivin alta RPE-ikkunaan, ks. oma osio; `WARMUP_SCALE[i].emoji`,
  `.feel-btn`, `.rpe-help-btn` ja `.warmup-feel-*` on poistettu).
  Selitteet ja Ohje käyttävät yhä sanoja (`warmupFeelWord(rpe)`; keskiarvo
  pyöristetään lähimpään pykälään), Ohjeen luettelossa luku sanan edellä.
  Uusi lämmittelyrivi
  lisätään aiempien lämmittelyjen perään (`splice(warmupRows(id).length, 0,
  …)`, ei `unshift`), jotta se on L2 eikä siirrä aiempaa L1:tä; avoimen
  näppäimistön `idx` siirtyy vastaavasti. Testit: `test_feel.js`,
  `test_warmup.js`.
- `WARMUP_LADDER = [{0.40, 8}, {0.60, 5}, {0.80, 3}, {0.90, 1}]`,
  `WARMUP_LIGHT_LIMIT = 20`, `WARMUP_LIGHT_PCT = 0.60` ja
  `WARMUP_MIN_WEIGHT = 5`: lämmittelyehdotus (`suggestWarmup(ex, id, n)`,
  n = lämmittelyn numero). "Lisää lämmittelysarja" täyttää rivin: lähde 1
  on viime kerran sama lämmittely (`warmups[n-1]`, sama viitekerta kuin
  Viime-sarakkeessa: `lastSet` tai `prior[0]`, kun päällimmäinen on tämän
  liikkeen tallennettu merkintä) skaalattuna suhteella `base /
  lastSession.sets[0].weight` (`warmupSuggestionContext`), lähde 2
  portaat `WARMUP_LADDER` (numeroa suuremmat viimeinen porras) tai kevyellä
  työpainolla (`base < WARMUP_LIGHT_LIMIT`) vain L1 `WARMUP_LIGHT_PCT`:llä
  ja tavoitetoistoilla. `base` on ensimmäisen työsarjan `base` (ehdotus
  ennen lämmittelysäätöä, kuten `applyWarmupAdjustment`-funktion
  `startWeight`) tai sen puuttuessa kirjoitettu paino; ehdotus hylätään,
  kun paino ≥ base tai < `WARMUP_MIN_WEIGHT`; ei yhdistelmäliikkeille eikä
  muille kuin `kind` plain (cluster ym.), mutta teholiikkeille kyllä.
  Kaikki pyöristykset `roundToStep(x, WEIGHT_STEP)`. Rivi saa tilapäisen
  `auto`-lipun (`"last"` | `"ladder"`), joka poistuu painon tai toistojen
  muokkauksessa (`[data-set-field]`-input-käsittelijä, jonka kautta myös
  `keypadSetValue` kulkee, ja `[data-weight-step]`) eikä tallennu
  (`saveExerciseLog` poimii vain weight/reps/rpe). Selite
  `.warmup-auto-note` (`warmupAutoNote`) Lämmittely-otsikon alla vain, kun
  jokin auto-rivi on kesken: "Lämmittelyt viime kerran mukaan[, skaalattu
  työpainoon 105 kg] — muokattavissa." tai "Lämmittelyt ehdotettu
  työpainosta 100 kg (40 / 60 / 80 / 90 %) — muokattavissa." (prosentit
  vakiosta; kevyellä "(60 %)"); `syncWarmupNoteDom` päivittää sen ilman
  render()-kutsua. Historia, Kehitys, simulointi, varmuuskopio ja
  `applyWarmupAdjustment` ovat ennallaan. Testi: `test_warmup_suggest.js`
  (fixture `prog_warm.csv`; kehotteen tapaukset 1–10: base 100 ilman
  historiaa kirjoittamalla paino, base 100 viime kerran 100×4:stä (near),
  base 105 viime kerran 100×5 sujuvasta).
- `PAIN_WINDOW_DAYS = 7`, `PAIN_VOLUME_RATIO = 1.2`, `PAIN_MIN_EPISODES = 3`
  ja `PAIN_MIN_SHARE = 0.6`: vaivalokin analyysin ikkuna, poikkeaman raja,
  kirjausten vähimmäismäärä ja löydöksen osuusraja (`buildPainAnalysis`).
  Raja 1,2 × tavanomainen viikkovolyymi on arvaus; jos löydöksiä tulee
  jokaisesta liikkeestä tai ei mistään, säädetään ensin tätä.

## Muutoskooste koekäyttäjille (toteutettu)

Asetukset › Muutokset (`SETTINGS_SECTIONS`-avain `muutokset`,
`renderSettingsMuutokset()`) näyttää `CHANGELOG`-taulukon (uusin ensin,
`{ date, items }`). **Päivitä taulukkoa jokaisessa käyttäjälle näkyvässä
muutoksessa**: kirjoita ensin, miten muutos vaikuttaa käyttöön, ei miten
se on toteutettu, ja pidä kohdat tiiviinä. Asetusten rivin alaotsikko
näyttää uusimman päivän ja sanan "uutta", kunnes osio on avattu
(`state.changelogSeen`, avain `changelog-seen`, verrataan
`CHANGELOG[0].date`-arvoon). Tyhjennys ei poista avainta, koska kyse ei ole
käyttäjän tiedoista.

