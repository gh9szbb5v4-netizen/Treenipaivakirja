# Treenipäiväkirja — kehitysroadmap

Tämä roadmap perustuu käytettävyys- ja ulkoasuarvioon, jossa verrattiin sovellusta markkinoilla oleviin vaihtoehtoihin (Hevy, Strong). Vaiheet on järjestetty niin, että aiempi vaihe on aina seuraavan edellytys tai muuten järkevämpi tehdä ensin — ei aihealueen "tärkeyden" mukaan sellaisenaan.

Jokainen vaihe on rajattu niin, että se on toteutettavissa yhtenä tai muutamana Code-kehotteena aiempien esimerkkien tapaan. Kun olet valmis aloittamaan jonkin vaiheen, pyydä kehote juuri sille vaiheelle — kehote kannattaa laatia vasta silloin, jotta se voi viitata koodin sen hetkiseen todelliseen tilaan.

---

## Vaihe 0 — Tehty

- Versioseuranta (`APP_VERSION`, `STORAGE_APP_VERSION_KEY`) ja tekijänoikeusmerkintä Asetukset-välilehdellä
- Hakukoneiden poissulkeminen (`noindex, nofollow`) ja hyväksyntänäkymä ennen sovelluksen avautumista

Nämä muodostavat pohjan sille, että sovellusta voi ylipäätään jakaa hallitusti testaajille. Loput vaiheet rakentuvat tämän päälle.

---

## Vaihe 1 — Tallennuksen luotettavuus — Tehty

**Miksi ensin:** Jos testaajan data katoaa, mikään muu parannus ei merkitse mitään — luottamus koko sovellukseen menetetään heti ensimmäisellä kerralla. Tämä on myös tekninen edellytys Vaiheelle 3, jossa ajastimen taustatoiminto todennäköisesti vaatii sovelluksen toimimisen aidosti asennettuna (standalone) PWA:na.

- Lisää `manifest.json` ja `apple-touch-icon`-kuvakkeet, jotta Koti-valikkoon lisääminen tuottaa oikean sovelluskuvakkeen oletusruudunkaappauksen sijaan, ja jotta sovellus avautuu aidosti itsenäisenä (standalone) web-sovelluksena
- Nosta Koti-valikko-ohje näkyvämmäksi: näytä se esimerkiksi kertaluontoisena vihjeenä heti ensimmäisen CSV-tuonnin jälkeen (`handleFile`-funktion yhteydessä), ei vain README:n rivillä
- Perustelu käyttäjälle: Safari poistaa selaimen omaan tallennustilaan (`localStorage`) kirjoitetun datan seitsemän päivän käyttämättömyyden jälkeen, jos sivua käytetään tavallisena selainvälilehtenä — Koti-valikkoon lisätty, itsenäisenä avautuva versio on tästä säännöstä vapautettu

**Tulos:** testaajan data ei katoa hiljaisesti, ja sovellus tuntuu asennetulta sovellukselta jo kuvaketasolla.

---

## Vaihe 2 — Sarjakohtainen suoritusmerkintä — Tehty

**Miksi tässä kohtaa:** Tämä on datamallin ja kirjaamisen työnkulun perustavanlaatuinen muutos, jonka päälle sekä Vaihe 3:n ajastin että Vaihe 4:n päivän niputtaminen rakentuvat. Kumpaakaan ei voi toteuttaa järkevästi ennen kuin sovellus tietää tarkasti, milloin yksittäinen sarja — ei vain koko liike — on merkitty suoritetuksi.

- Liikettä ei saa voida merkitä tehdyksi ennen kuin kaikkien sen sarjojen painot on kirjattu
- Useamman sarjan liikkeissä ledger pysyy avoinna näkymässä, kunnes jokaiseen sarjaan on syötetty paino ja jokainen sarja on erikseen merkitty suoritetuksi
- Vasta kun liikkeen kaikki sarjat on merkitty tehdyksi, liikkeen voi sulkea ja seuraavan liikkeen avata

**Tulos:** sovelluksella on tarkka, sarjatasoinen tieto suorituksen etenemisestä — edellytys sille, että ajastin voidaan kytkeä yksittäisen sarjan valmistumiseen ja että koko treenipäivän valmistuminen voidaan tunnistaa luotettavasti.

---

## Vaihe 3 — Lepoajastin ja muu tuki aktiivisen treenin aikana — Tehty

**Miksi tässä kohtaa:** Ajastimen kytkeminen sarjan merkitsemiseen edellyttää Vaihe 2:n sarjakohtaista tilaa, ja luotettava taustatoiminto nojaa Vaihe 1:ssä rakennettuun PWA-perustaan. Nämä ovat ominaisuuksia, joita käyttäjä tarvitsee juuri siinä hetkessä, jolloin sovellusta oikeasti käytetään — salilla, kesken sarjan.

- Ajastin käynnistyy automaattisesti siitä, kun yksittäinen sarja merkitään suoritetuksi — ei vasta koko liikkeen tallennuksesta
- Ajastimen numeronäyttöä suurennettava selvästi: nykyinen näkymä on liian pieni, jotta jäljellä olevan ajan erottaisi esimerkiksi tilanteessa, jossa puhelin on lattialla tai penkillä ja käyttäjä seisoo sen vieressä noin metrin etäisyydellä
- Ajastimen päättyminen visualisoitava huomiota herättävästi (esim. värinä, ääni ja/tai voimakas visuaalinen muutos), jotta käyttäjä huomaa sen ilman jatkuvaa ruudun tarkkailua
- Ajastimen on jatkettava käyntiä ja ilmoitettava päättymisestä myös silloin, kun näyttö lukittuu tai käyttäjä siirtyy treenin aikana toiseen sovellukseen — selvitettävä, mitä tämä vaatii Safarin/iOS:n PWA-kontekstissa (esim. Notifications-, Wake Lock- tai taustaäänirajoitukset)
- Painon pikasäätönapit ledger-riveille (esim. −2,5 kg / +2,5 kg painokentän vierelle), jotta näppäimistöä ei tarvitse avata kesken sarjan

**Tulos:** sovellus tukee koko sarjan ja lepotauon suoritusta salilla, myös silloin kun puhelin ei ole kädessä tai näytöllä.

---

## Vaihe 4 — Treenipäivän niputtaminen — Tehty

**Miksi tässä kohtaa:** Edellyttää Vaihe 2:ssa rakennettua liikekohtaista valmiustilaa — sovelluksen on tiedettävä luotettavasti, milloin jokainen päivän liike on merkitty tehdyksi, ennen kuin näitä voidaan niputtaa yhdeksi koosteeksi.

- Kun päivän kaikki liikkeet on merkitty tehdyksi, yksittäiset liikkeet piilotetaan ohjelmanäkymästä
- Tilalle jää yksi kooste-olio, joka näyttää treenin yleistiedot — vähintään päivämäärän, jolloin treeni merkittiin tehdyksi

**Tulos:** ohjelmanäkymä pysyy selkeänä ja lyhyenä myös silloin, kun päivän treeni on jo suoritettu kokonaan.

---

## Vaihe 5 — Ajastimen pienentäminen - Tehty

**Miksi tässä kohtaa:** Korjaus koskee Vaiheessa 3 rakennettua ajastinta ja edellyttää sitä teknisesti, mutta on rajattu ja itsenäinen korjaus, joka ei riipu myöhemmistä vaiheista — se kannattaa tehdä omana pienenä kokonaisuutenaan heti Vaiheiden 1–4 valmistuttua sen sijaan, että se sekoitettaisiin uuteen, laajempaan kehitystyöhön.

- Nykyinen "Piilota"-toiminto korvataan "Pienennä"-toiminnolla: ajastimen ollessa päällä sen saa pienennettyä pieneksi näkymäksi näkymän yläreunaan sen sijaan, että se katoaisi kokonaan ja jäisi palauttamattomaksi
- Pienennettyä ajastinta painamalla näkymä palautuu takaisin koko näytön ajastimeksi

**Tulos:** käynnissä olevaa ajastinta ei voi enää kadottaa vahingossa näkyvistä; se on aina joko täysikokoisena tai pienennettynä nähtävissä.

---

## Vaihe 6 — Ohjelman muokattavuus

**Miksi tässä kohtaa:** Itsenäinen ominaisuus, joka ei riipu edeltävistä vaiheista teknisesti, mutta on luontevaa rakentaa vasta kun ydin-kirjaustyönkulku (Vaiheet 2–4) on vakiintunut — muutoin liikkeen vaihto-toiminto jouduttaisiin sovittamaan uudelleen näiden muutosten päälle.

- Ohjelmaan kuuluva liike on voitava vaihtaa toiseksi suoraan ohjelmanäkymässä, ilman CSV:n uudelleentuontia

**Tulos:** käyttäjä voi mukauttaa ohjelmaa yksittäisen liikkeen osalta ilman koko ohjelman uudelleentuontia.

---

## Vaihe 7 — Edistymisen visualisointi

**Miksi tässä kohtaa:** Riippumaton Vaiheista 1–6 ja voidaan tehdä niiden jälkeen ilman, että aiempi työ pitää tehdä uudelleen. 1RM-tiedon siirto Historiasta Kehitykseen kannattaa tehdä ennen SVG-käyrän rakentamista, jotta käyrä rakennetaan heti oikean, lopullisen tietomallin päälle.

- Laskennalliset 1RM-maksimit poistetaan Historia-näkymästä ja siirretään näytettäväksi Kehitys-näkymässä
- Kehitys-näkymän näyttölogiikka muutetaan: liikekohtainen merkintä tulee näkyviin heti, kun liikkeelle voidaan laskea 1RM — nykyinen vaatimus vähintään kahdesta merkinnästä poistuu
- SVG-viivakäyrä Kehitys-välilehdelle: laskennallinen 1RM ajan funktiona per liike, olemassa olevan `buildAllOneRepMaxSeries`-datan päälle
- Harkitse samaa kuvaajaa myös nostetun kokonaispainon kehitykselle, jos data koetaan hyödylliseksi ensimmäisen version jälkeen

**Tulos:** kehitys näkyy heti ensimmäisestä merkinnästä alkaen, sekä lukuina että silmäiltävänä trendinä lukutaulukon sijaan.

**Tila:** osittain tehty — SVG-viivakäyrä (`renderOneRepMaxChart`) on jo rakennettu, mutta Historian 1RM-listausta (`renderOneRepMaxSection`) ei ole vielä poistettu eikä `computeProgress`-funktion kahden merkinnän vähimmäisvaatimusta ole vielä poistettu.

---

## Vaihe 8 — Liikkeiden yhtenäisyys — Tehty

**Miksi tässä kohtaa:** Tämä on pienempi, kokemuksellinen parannus, joka kannattaa tehdä vasta kun isommat puutteet (Vaiheet 1–7) on korjattu, koska sen hyöty riippuu siitä, että käyttäjällä on jo kertynyttä historiaa jota hyödyntää.

- Autocomplete liikkeen nimikentälle (manuaalinen lisäys ja mahdollinen CSV-tuonnin jälkeinen tarkistus) perustuen `allExercises()`-dataan, jotta esim. "Peck deck" ja "Pec dec" eivät jää kahdeksi eri liikkeeksi

**Tulos:** pienempi kirjoitusvirheiden aiheuttama datan pirstoutuminen historiassa ja kehityslaskennassa.

---

## Vaihe 9 — Saavutettavuuden viimeistely — Tehty

**Miksi viimeisenä tässä listassa:** Tämä on auditointi- ja hienosäätövaihe, joka kannattaa tehdä, kun näkymien sisältö on jo vakiintunut Vaiheiden 1–8 jälkeen — muuten samat tarkistukset joutuu tekemään useaan kertaan.

- Mittaa `--mist`-värin (#8891a0) kontrastisuhde tummaa taustaa vasten erityisesti pienillä fonttikoilla (esim. `.exercise-target`, `.history-date-head` sisällä), ja korjaa tarvittaessa
- Tarkista sama `--danger`- ja `--success`-väreille

**Tulos:** sovellus täyttää kohtuulliset saavutettavuusvaatimukset ennen laajempaa jakelua.

---

## Myöhemmin, vasta kysynnän validoinnin jälkeen

Näitä ei kannata aloittaa ennen kuin koekäyttö ja mahdollinen ensimmäinen kaupallinen kokeilu (ks. liiketaloudellinen suunnitelma) osoittavat, että niihin kannattaa investoida:

- Palvelinpuolen tallennus ja laitteiden välinen synkronointi
- Käyttäjätunnistus ja tilausmalli
- Laajempi liikekirjasto kuvineen
- Sujuvat siirtymäanimaatiot näkymien välillä (vaatisi luopumisen nykyisestä koko sovelluksen uudelleenpiirtävästä `render()`-mallista)
