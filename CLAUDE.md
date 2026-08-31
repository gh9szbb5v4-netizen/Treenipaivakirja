# Treenipäiväkirja — muistiinpanot Claudelle

Yhden tiedoston (`index.html`) selainsovellus. Ei build-vaihetta, ei riippuvuuksia,
ei palvelinta. Koodityyli: `var`-määrittelyt, `function`-lausekkeet, ei arrow-
funktioita, ei `let`/`const`. Säilytä tämä tyyli kaikissa muutoksissa.

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
Vaihtoehto CSV-tuonnin rinnalle sekä alkunäytöllä (`renderUpload`) että
Asetuksissa ("Uusi ohjelma" -osio): "Tuo CSV" / "Rakenna sovelluksessa".
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
tekstikenttä liikkeen nimelle (kuten Ohjelma-välilehden "Lisää liike, jota
ei ole ohjelmassa" toimii jo nyt) — lista on ehdotus, ei rajoite.

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
