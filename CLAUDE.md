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
`"plain"`), `method`, `perSet`, `methodNote` ja `autoCalc`. Kaikki ovat
valinnaisia, jotta vanhat tallennetut ohjelmat toimivat ennallaan:
`buildDraftRows()` ohittaa painoehdotuksen vain nimenomaisella
`autoCalc === false`:lla, ei puuttuvalla kentällä.

## Ohjelman rakentaminen sovelluksessa (toteutettu)

Kolmas tapa saada ohjelma sovellukseen CSV- ja PDF-tuonnin rinnalle.
Sisääntulo on sekä alkunäytöllä (`renderUpload`) että Asetusten Ohjelma-osiossa
(`[data-builder-start]`). Rakentajalla ei ole omaa näkymää eikä omaa tilaa:
`startProgramBuilder()` avaa muokkaustilan tilassa `"new"` luonnokselle
`{ days: [Päivä 1], weeks: ["1"], weekLabels: {} }`, ja kaikki rivit,
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
(`renderExercisePickList(query)`, `exercisePickEntries()`): koko
`allExerciseVariants()`-katalogi koostettuina niminä lihasryhmittäin sekä
`knownExerciseNames()`-nimet ryhmässä "Ohjelmassa ja historiassa". Haku
suodattaa nimen ja lihasryhmän mukaan, ja jokaisen sanan on osuttava;
hakulista päivitetään `#liike-lista`-elementtiin suoraan DOM:iin ilman
`render()`-kutsua, jottei fokus katoa. Kirjoitetun nimen voi aina ottaa
käyttöön (`[data-pick-free]`; rivi on listan lopussa, kun osumia on, ja ainoa
rivi, kun osumia ei ole), jolloin `findSimilarName()` huomauttaa katalogin
samankaltaisesta nimestä. Enter valitsee ensimmäisen katalogiosuman tai
kirjoitetun nimen, jos osumia ei ole.
"Lisää liike" avaa lomakkeen ja pohjalevyn yhtä aikaa; lomakkeen hakupainike
`[data-open-sheet="liike"]` avaa sen uudelleen, ja `closeSheet()` palauttaa
fokuksen siihen. Liikelistaa ei koodattu erillisenä `EXERCISE_LIBRARY`-
vakiona: `EXERCISE_VARIANTS` sisältää jo `lihasryhma`-kentän, joten toinen
lista olisi ollut sama tieto kahdesti. `exerciseOptionsByGroup()` on yhä
liikkeen vaihdon käytössä.

**Ratkaistu kysymys:** rakentaja luo aina uuden ohjelman tyhjästä. Olemassa
olevan ohjelman muokkaus on sama muokkaustila tilassa `"edit"`, ei erillinen
toteutus. Yksittäisen liikkeen vaihto on lisäksi Ohjelma-näkymässä.

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
`mode`, `openWeeks` ja `openDays` (kartat, useampi voi olla auki),
`editingExercise`, `addingExerciseTo`, `confirmDelete` (`"delete:<kohde>"`
tai `"restart:<kohde>"`, kohde `week:<avain>`, `day:<id>`, `ex:<id>` tai
`program`), `confirmCancel`, `swapAll`, `menuFor`, `form`, `baseline`
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

`applyBackupRestore()` palauttaa järjestyksessä omat liikkeet → 1RM → ohjelma →
merkinnät. Järjestys on pakollinen: merkinnät sidotaan ohjelman liike-id:eihin,
joten ohjelman on oltava paikallaan ensin. Ohjelman palautus korvaa nykyisen
ohjelman, joten se vahvistetaan erikseen (`state.pendingRestore` +
`renderRestoreConfirm()`); ilman ohjelmaosiota oleva tiedosto tuodaan suoraan.

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
`.btn-danger` (tuhoava); koot `.btn-sm`, leveys `.btn-auto`. `.save-btn` on
alias `.btn-primary`:lle vanhojen kutsupaikkojen takia — älä käytä uudessa
koodissa. Merkit `.chip` + `.chip-brass/-muted/-success`. Banneri
`renderBanner(kind, iconName, title, bodyHtml, actionsHtml)`, kind `""`,
`"info"` tai `"danger"`; kaikki aiemmat ad hoc -laatikot käyttävät sitä.

Kuvakkeet: `ICONS`-olio (24 px, viiva 1,7) ja `icon(name, size)`. Ei
kuvakefonttia. `gearIcon()` on säilytetty aliaksena. Kuvake on aina
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

Vihjeet: yksi kerrallaan. `shouldShowFirstLogHint()` näyttää kolmen askeleen
kirjausohjeen kunnes ensimmäinen merkintä on tallennettu tai kortti suljetaan
(`STORAGE_FIRST_LOG_HINT_KEY`); aloitusnäyttövinkki näytetään vasta sen
jälkeen ja on tiivis banneri, jonka ohjeen saa auki erikseen.

Ilmoitusruutu nousee alhaalta navigaation yläpuolelle, ei enää yläpalkin päälle.

## Ohjelma-näkymä ja kirjaus (toteutettu, UX-vaihe 3)

Päiväkortti `renderDayCard(day, expanded, isNext)`: otsikkona päivän nimi
(`dayCardTitle()`: viikkonäkymässä `day.label`, koko ohjelman näkymässä
`dayDisplayName()` viikon nimen kanssa),
alarivillä tila. Nimiosa on avaava painike ja seuraavaksi vuorossa olevan
päivän "Aloita/Jatka"-painike (`[data-start-day]`) on sen sisar, ei sisällä —
sisäkkäiset painikkeet olisivat saavutettavuusrike. Avattuna sama kortti
toimii otsikkona ja liikkeet ovat `.day-exercises`-lohkossa sen alla; erillistä
`.day-heading`-riviä ja "Piilota liikkeet" -linkkiä ei enää ole.

Sarjarivi: numero, paino, toistot, ✓ ja ⋮ yhdellä rivillä
(`grid-template-columns:24px 1fr 0.72fr 42px 30px`). ±2,5 kg -säätimet näkyvät
vain aktiivisen sarjan alla: `state.activeSet` asetetaan `focusin`-
kuuntelijassa, joka vaihtaa `.hidden`-luokkaa suoraan DOM:ssa ilman render()-
kutsua (fokus säilyy); render() lukee saman tilan `activeSetIndex()`:llä, ja
ilman tilaa aktiivinen on ensimmäinen keskeneräinen sarja. Huomiokenttä ja
poisto ovat `state.setExtra[id][idx]`-lisärivillä, joka on auki myös aina kun
huomio ei ole tyhjä.

Tallennuslohko ei ole kiinnitetty (position:sticky kokeiltiin ja hylättiin:
se peitti sarjarivit heti kortin avautuessa, koska kortti on näyttöä
korkeampi).

Viikko/kaikki-valinta on `renderWeekModeSwitch()` (`[data-week-mode]`),
samalla rivillä päivämääräsirpaleen kanssa; vanha `[data-toggle-week-view]`-
käsittelijä on jäänyt koodiin vaarattomana. Näkyvä "Kirjataan päivälle"
-teksti on ruudunlukijalle `.sr-only`-elementtinä.

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
(`historyDaySummary()`). Poisto on kortin alareunan tekstipainike, joka
vahvistettaessa muuttuu tuhoavaksi painikkeeksi; `data-delete-history` ja
`confirmingDeleteDate` ennallaan.

Kehitys näyttää vertailurivin vain, kun vertailukohta on olemassa, ja yhdellä
merkinnällä yhden lauseen "Ei dataa" -rivien sijaan.
