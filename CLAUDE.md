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

## Suunnitellut ominaisuudet (ei vielä toteutettu)

### Ohjelman rakentaminen sovelluksessa (vaihtoehto CSV-tuonnille)

Käyttäjä pyysi mahdollisuutta luoda treeniohjelma suoraan sovelluksessa CSV-
tiedoston lataamisen sijaan. Ensimmäinen vaihe: pelkkä tuonti/luonti, ei vielä
olemassa olevan ohjelman muokkausta (lisää/poista/järjestä jälkikäteen) —
sen tarve arvioidaan myöhemmin.

**Datamalli — ei muutoksia:**
`state.program = { weeks: [...], days: [{ week, name, exercises: [{ name, sets,
reps, unit, intensity }] }] }` säilyy täysin samana. Rakentaja täyttää saman
rakenteen kuin CSV-tuonti (`parseProgramCSV`) täyttää nyt.

**Uusi näkymä:**
Vaihtoehto CSV- ja PDF-tuonnin rinnalle sekä alkunäytöllä (`renderUpload`) että
Asetuksissa ("Ohjelma"-osio): "Tuo CSV" / "Tuo PDF" / "Rakenna sovelluksessa".
Rakentaja voi käyttää pohjana `renderProgramReview()`-tarkistusnäkymää, joka jo
muokkaa ohjelmarakennetta paikallaan ja tallentaa `applyImportedProgram()`:lla.
Rakentajassa käyttäjä lisää viikkoja → viikon sisään päiviä → päivän sisään
liikkeitä, ja täyttää kullekin liikkeelle sarjat, toistot, yksikön ja tehon
(sama kenttäsetti kuin CSV:n sarakkeet).

**Liikkeiden valinta — kiinteä liikelista lihasryhmittäin:**
Liikelista koodataan suoraan sovellukseen JS-vakiona (esim.
`EXERCISE_LIBRARY = { "Rinta": [...], "Selkä": [...], "Jalat": [...],
"Hartiat": [...], "Käsivarret": [...], "Keskivartalo": [...] }`), EI tuoda
erillisenä tiedostona. Perustelu: sovelluksen koko idea on yksi tiedosto
ilman ulkoisia riippuvuuksia tai tuontivaiheita; kiinteä referenssilista
sopii tähän paremmin kuin uusi tuontimuoto, ja lista on heti käytettävissä
ilman erillistä tuontiaskelta. Rakentajassa pitää silti sallia myös vapaa
tekstikenttä liikkeen nimelle — lista on ehdotus, ei rajoite. (Ohjelma-
välilehdellä oli aiemmin vastaava "Lisää liike, jota ei ole ohjelmassa"
-kenttä, mutta se on poistettu näkymästä, koska yksittäisen liikkeen
lisääminen ei ole hyödyllinen ilman laajempaa ohjelman muokkausta.)

**Tallennus:**
"Valmis"-painike kirjoittaa koostetun rakenteen `state.program`-muuttujaan
ja kutsuu olemassa olevaa `saveProgram()`-funktiota — sama polku kuin CSV-
tuonnissa, ei uutta tallennuslogiikkaa. Sama semantiikka kuin CSV-tuonnilla:
uusi ohjelma korvaa vanhan, mutta merkinnät/historia säilyvät liikkeen nimen
perusteella ennallaan (tämä on tärkeää: Historia/Kehitys-yhteys toimii
liikkeen nimen perusteella, joten rakentajan pitää tuottaa täsmälleen
samanmuotoiset liikeoliot kuin CSV-tuonti).

**Ei kosketa:** Historia/Kehitys/Asetukset-logiikkaan, storage-adapteriin tai
1RM-laskentaan ei tarvitse koskea — ne toimivat jo pelkän `state.program`-
rakenteen varassa riippumatta siitä, tuliko se CSV:stä vai rakentajasta.

**Avoin kysymys jatkoa varten:** pitääkö rakentajan pystyä myöhemmin myös
muokkaamaan olemassa olevaa ohjelmaa jälkikäteen (lisää/poista/järjestä
viikko tai liike), vai riittääkö pysyvästi pelkkä "luo uusi ohjelma tyhjästä"
CSV-tuonnin rinnalle.
