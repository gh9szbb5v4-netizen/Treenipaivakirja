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
