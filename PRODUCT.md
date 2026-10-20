# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Ensisijainen käyttäjä on sovelluksen tekijä itse ja pieni koekäyttäjäjoukko. He kirjaavat sarjat puhelimella kuntosalilla treenin aikana, valmentajan tai oman ohjelmansa mukaan. Koekäyttö edeltää mahdollista ensimmäistä kaupallista kokeilua (`treenipaivakirja-roadmap.md`).

## Product Purpose

Treenipäiväkirja vie treeniohjelman puhelimeen (rakennettuna sovelluksessa tai tuotuna CSV- tai PDF-tiedostosta), tallentaa sarjakohtaiset merkinnät ja laskee seuraavien treenien sarjapainot automaattisesti. Onnistuminen tarkoittaa, että käyttäjä kirjaa treenin salilla nopeasti, saa joka kerralle perustellun painoehdotuksen ja näkee kehityksensä ilman omaa laskentaa.

## Positioning

Vertailukohtina ovat Hevy ja Strong. Vahvistetut erot ovat nämä kolme:

- Seuraavan kerran sarjapainot lasketaan ohjelmasta, sarjan tuntumasta (RIR) ja historiasta. Mukana ovat jumitunnistus, automaattinen ja pyydetty kevennys sekä lämmittelyehdotus.
- Sovelluksessa ei ole tiliä eikä palvelinta. Tiedot pysyvät laitteella, varmuuskopio on käyttäjän oma CSV-tiedosto, ja ohjelmatiedostoa ei lähetetä mihinkään.
- Käyttöliittymä ja liikekirjasto ovat suomeksi.

## Operating Context

Sovellusta käytetään kuntosalilla sarjojen välissä, usein yhdellä kädellä ja lyhyen lepotauon aikana. Sitä käytetään iPhonen Safarissa Koti-valikkoon lisättynä itsenäisenä sovelluksena (PWA), jolloin Safari ei poista tallennettuja tietoja käyttämättömyyden jälkeen. Laitteen taaksepäin-ele toimii kuten natiivisovelluksessa. Ohjelmat tulevat valmentajan PDF-tiedostoina tai CSV-tiedostoina (myös suomalaisen Excelin viennistä) tai rakennetaan sovelluksessa. Varmuuskopio kulkee CSV-tiedostona laitteiden välillä.

## Capabilities and Constraints

Toiminnot: ohjelman rakentaja ja muokkaustila, CSV- ja PDF-tuonti, ohjelmakirjasto, sarjakirjaus omalla numeronäppäimistöllä, RPE-asteikko sanallisena (Kevyt–Äärirajoilla), lepoajastin, cluster-sarjat, liikekirjasto (448 liikettä, kirjaustavat ja toispuolisuus), Historia, Kehitys (1RM-arvio, ennätykset, volyymi, toteutuminen, vaivaloki), varmuuskopio ja muutoskooste.

Pysyvät rajoitteet, jotka käyttäjä on vahvistanut:

- Puhelin tulee ensin, ja iPhonen Safari on ensisijainen ympäristö. Tablettiasettelu (≥ 768 px) on toissijainen.
- Tumma teema on ainoa teema. Vaaleaa teemaa ei ole.

Nykyinen tekninen toteutus, joka on kirjattu projektin `CLAUDE.md`-tiedostoon mutta jota ei vahvistettu suunnittelun sitovaksi rajoitteeksi:

- Sovellus on yksi `index.html` ilman build-vaihetta ja ilman CDN-riippuvuuksia. Ainoa ulkoinen kirjasto on pdf.js omina tiedostoinaan.
- Koodityyli on `var` ja `function`.
- Selaintestit (Playwright ja axe) ovat hakemistossa `tests/`.

Termit: treenipäivä, sarja, lämmittely, tuntuma, kevennys, 1RM-pohja, kirjaustapa ja osasarja (cluster).

## Brand Commitments

Nimi on Treenipäiväkirja, ja kieli on suomi.

## Evidence on Hand

Sovelluksella ei ole julkaistuja käyttäjäkokemuksia, asiakkaita eikä vertailulukuja. Niitä ei saa keksiä. Koekäyttäjien varmuuskopioita on käytetty kuivaharjoituksiin, mutta ne eivät ole repossa, koska ne ovat henkilökohtaista dataa.

## Product Principles

1. Kirjaus salilla on ensisijainen tehtävä, ja jokainen ylimääräinen napautus sarjojen välissä on kustannus.
2. Ehdotus on perusteltava: käyttäjä näkee, mistä paino tuli, ja voi aina muuttaa sitä.
3. Käyttäjän data on hänen omaansa. Se pysyy laitteella, on vietävissä ja palautettavissa, eikä muutos saa rikkoa vanhoja merkintöjä.
4. Suomi on ensisijainen kieli, ei käännös.
