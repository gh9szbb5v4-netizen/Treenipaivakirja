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

Tuonti **ei tallenna suoraan**: tulos menee `state.pdfImport`-tilaan ja
`renderProgramReview()`-tarkistusnäkymään (`state.view === "tuonti"`), jossa
rivejä voi muokata ja poistaa. "Valmis" kutsuu `applyImportedProgram()`:ia —
samaa polkua kuin CSV-tuonti, ei omaa tallennuslogiikkaa.

Liikeoliossa on PDF:n takia neljä valinnaista kenttää: `kind` (oletus
`"plain"`), `method`, `perSet`, `methodNote` ja `autoCalc`. Kaikki ovat
valinnaisia, jotta vanhat tallennetut ohjelmat toimivat ennallaan:
`buildDraftRows()` ohittaa painoehdotuksen vain nimenomaisella
`autoCalc === false`:lla, ei puuttuvalla kentällä.

## Ohjelman rakentaminen sovelluksessa (toteutettu)

Kolmas tapa saada ohjelma sovellukseen CSV- ja PDF-tuonnin rinnalle.
Sisääntulo on sekä alkunäytöllä (`renderUpload`) että Asetusten Ohjelma-osiossa
(`[data-builder-start]`). Näkymä on `renderProgramBuilder()`
(`state.view === "rakenna"`), ja luonnos elää vain `state.builder`-kentässä:

```
state.builder = {
  weeks: [ { label: "1", days: [ { name: "Päivä 1", exercises: [ {name, sets, reps, unit, teho} ] } ] } ],
  picker: null   // { wi, di, liike, variaatio, lisavariaatio, free, freeName, nameHint }
}
```

`builderProgramFromDraft()` kokoaa luonnoksesta saman rakenteen kuin
`parseProgramCSV()` (päivän nimi `"Viikko <label> · <päivä>"`, liikeoliossa
`id`, `name`, `sets`, `reps`, `unit`, `weight`, `notes`, `intensity`, `kind:"plain"`,
`autoCalc:true`, oma `ex-<timestamp>`-etuliite), ja `saveProgramBuilder()`
tallentaa sen `applyImportedProgram()`:lla — ei omaa tallennuslogiikkaa. Tämä on
oleellista: Historia- ja Kehitys-yhteys toimii liikkeen nimen perusteella, joten
rakentajan on tuotettava täsmälleen samanmuotoisia liikeolioita kuin tuonti.

Liikelistaa ei koodattu erillisenä `EXERCISE_LIBRARY`-vakiona, vaikka
alkuperäinen suunnitelma niin esitti: `EXERCISE_VARIANTS` sisältää jo
`lihasryhma`-kentän jokaisella rivillä, joten toinen lista olisi ollut sama tieto
kahdesti ja olisi ajautunut erilleen. Lista luetaan jaetun
`exerciseOptionsByGroup()`-funktion kautta, jota käyttävät sekä rakentaja että
liikkeen vaihto — molemmat näyttävät siis saman listan, myös käyttäjän itse
lisäämien liikkeiden osalta. Vapaa tekstikenttä liikkeen nimelle on mukana
(”Liike ei löydy listalta”), ja siitä huomautetaan `findSimilarName()`:lla.

Validoinnit `builderProgramFromDraft()`:ssa: tyhjä viikon tai päivän nimi, kaksi
samannimistä viikkoa (viikkovalitsin etsii nimen mukaan) ja saman viikon kaksi
samannimistä päivää (`dayKey()` törmäisi) estävät tallennuksen; liikkeetön päivä
ja liikkeetön viikko jätetään pois. Uuden viikon ja päivän oletusnimi on
ensimmäinen vapaa numero.

**Ratkaistu kysymys:** rakentaja luo aina uuden ohjelman tyhjästä. Olemassa
olevan ohjelman jälkikäteinen muokkaus (lisää/poista/järjestä viikko tai liike)
jätettiin tietoisesti tekemättä; tarve arvioidaan vasta käytön perusteella.
Yksittäisen liikkeen vaihto on jo olemassa Ohjelma-näkymässä.

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
