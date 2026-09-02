# Treenipaivakirja

Selaimessa toimiva treenipäiväkirja, joka lukee treeniohjelman CSV-tiedostosta, tallentaa sarjakohtaiset merkinnät ja laskee seuraavien treenien sarjapainot automaattisesti. Koko sovellus on yhdessä `index.html`-tiedostossa: ei asennusta, ei palvelinta, ei riippuvuuksia.

## Käyttöönotto

Avaa julkaistu osoite selaimessa ja tuo treeniohjelmasi CSV-tiedostona. Ohjelma tallentuu selaimeen, joten tuonti tarvitsee tehdä vain kerran — sen jälkeen sovellus avautuu suoraan liikelistaan.

Kannattaa lisätä sivu laitteen aloitusnäytölle, jolloin se avautuu kuin natiivi sovellus eikä tavallisena selainvälilehtenä: iPhonella Safarin jakopainikkeesta ("Lisää Koti-valikkoon"), Androidilla selaimen valikosta ("Lisää aloitusnäytölle" tai "Asenna sovellus"). Tämä ei ole pelkkä kosmeettinen ero — Safari saattaa poistaa tavallisena selainvälilehtenä pidetyn sivun paikallisesti tallennetut tiedot noin seitsemän päivän käyttämättömyyden jälkeen, kun taas Koti-valikkoon lisätty, itsenäisenä avautuva versio on tästä vapautettu. Sovellus muistuttaa tästä kerran ensimmäisen CSV-tuonnin jälkeen, ellei se jo tuolloin ole käynnissä aloitusnäytöltä avattuna.

### Julkaisu GitHub Pagesissa

Lisää `index.html`, `manifest.json` sekä kuvaketiedostot (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) samaan kansioon repositorion `main`-haaraan, mene kohtaan **Settings → Pages**, valitse lähteeksi *Deploy from a branch*, haaraksi `main` ja kansioksi `/ (root)`. Sivu julkaistaan osoitteeseen `https://<käyttäjätunnus>.github.io/<repositorio>/` yleensä parissa minuutissa. Repositorion tulee olla julkinen, ellei tilisi ole maksullinen. `manifest.json` ja kuvakkeet on tärkeää julkaista `index.html`:n rinnalla samalla polulla, sillä ilman niitä Koti-valikkoon lisätty sivu saa oletusruudunkaappauksen omana kuvakkeenaan eikä avaudu itsenäisenä sovelluksena.

## CSV-muoto

Ainoa pakollinen sarake on liikkeen nimi. Muut sarakkeet tunnistetaan automaattisesti otsikon perusteella sekä suomeksi että englanniksi, ja kenttäerotin (`;`, `,` tai sarkain) tunnistetaan itsestään — myös suomalaisen Excelin puolipiste-eroteltu vienti toimii sellaisenaan.

| Sarake | Tunnistetaan mm. | Merkitys |
|---|---|---|
| Viikko | `Viikko`, `Week`, `Vko` | Ryhmittelee ohjelman viikoittain |
| Treenipäivä | `Treenipäivä`, `Päivä`, `Day` | Ryhmittelee päivittäin |
| Liike | `Liike`, `Exercise` | **Pakollinen** — liikkeen nimi |
| Sarjat | `Sarjat`, `Sets` | Ledgeriin luotavien rivien määrä |
| Toistot | `Toistot`, `Reps` | Tavoitetoistot |
| Yksiköt | `Yksiköt`, `Unit` | Esim. `toistoa`, `min`, `käsi` |
| Teho | `Teho`, `Intensity` | `MAX` tai prosentti, esim. `90 %` — ohjaa painoehdotuksen Liikkeiden 1RM -arvosta, ks. alla |

Esimerkki:

```csv
Viikko;Treenipäivä;Liike;Sarjat;Toistot;Yksiköt;Teho
1;1;Penkkipunnerrus;1;1;toistoa;MAX
1;1;Penkkipunnerrus;2;3;toistoa;90 %
1;1;Peck deck;3;10;toistoa;
```

## Sarjapainojen laskenta

Sovellus ehdottaa painon kahdella eri säännöllä sen mukaan, onko liikkeelle määritelty teho. Ehdotus on aina muokattavissa, ja ledgerin yläpuolella kerrotaan, mihin se perustuu.

**Liikkeellä on teho (MAX tai prosentti).** Painoehdotus lasketaan liikkeen 1RM-arvosta — ei liikkeen aiemmista merkinnöistä. `MAX`-teholle ehdotetaan suoraan 1RM:ää; prosenttiteholle (esim. `90 %`) ehdotetaan kyseinen prosenttiosuus 1RM:stä. Jos liikkeelle ei ole vielä 1RM-arvoa, ehdotus jää tyhjäksi.

1RM-arvoa voi muokata milloin tahansa käsin Asetuksissa (rataskuvake oikeassa yläkulmassa), mutta se päivittyy myös automaattisesti: kun kirjaat merkinnän `MAX`-teholliselle liikkeelle, sen ensimmäisen sarjan paino tallentuu 1RM:ksi ja korvaa Asetuksiin aiemmin tallennetun arvon.

**Liikkeellä ei ole tehoa.** Ehdotus perustuu liikkeen **viimeksi kirjattuun sarjaan** ja Epley-kaavaan: edellisestä sarjasta arvioidaan 1RM, siihen sovelletaan progressiokerrointa, ja tuloksesta lasketaan takaisin paino tavoitetoistomäärälle.

```
1RM_edellinen = edellinen_paino × (1 + edelliset_toistot / 30)
1RM_tavoite   = 1RM_edellinen × progressiokerroin
paino         = MROUND( 1RM_tavoite / (1 + tavoitetoistot / 30) , 2,5 )
```

Progressiokerroin on oletuksena 1,0125 eli tavoitteena 1,25 % kehitys jokaisella kirjauskerralla. Jos tavoitetoistomäärä on sama kuin edellisellä kerralla, kaava supistuu muotoon `paino = MROUND( edellinen_paino × progressiokerroin , 2,5 )` — ehdotus siis nousee hieman aina, eikä jää koskaan täysin samaksi kuin viimeksi.

Kehitys-näkymän laskennallinen 1 toiston maksimi on tästä erillinen, eikä siihen vaikuta liikkeen teho tai manuaalinen 1RM. Se lasketaan aina samalla Epley-kaavalla

```
1RM = paino × (1 + toistot / 30)
```

kunkin merkintäpäivän **raskaimmasta** sarjasta — sarjasta, joka antaa suurimman laskennallisen 1RM:n — riippumatta siitä mitä liikkeelle sinä päivänä oli ohjelmoitu tai missä järjestyksessä sarjat kirjattiin. Ero sarjapainolaskuriin on kahdessa kohdassa: Kehitys-laskenta perustuu aina päivän raskaimpaan sarjaan eikä sisällä progressiokerrointa, kun taas sarjapainolaskuri perustuu edelliseen kirjattuun sarjaan ja sisältää progressiokertoimen.

Yhdistelmäliikkeet, joiden nimessä on kauttaviiva (esim. `Cardiolaite / Punnerrus / Burpee, 12 min`), jätetään automaattilaskennan ulkopuolelle kokonaan.

## Näkymät

Ohjelma, Historia, Kehitys ja Ohje vaihdetaan näytön alareunassa kelluvasta valikosta. Asetukset avataan näkymän oikean yläkulman rataskuvakkeesta.

**Ohjelma.** Liikkeet viikoittain ja päivittäin. Liikkeen avaamalla kirjaat painot, toistot ja huomiot sarjoittain, ja näet nostetun kokonaispainon. Merkinnän voi kirjata myös takautuvasti päivämäärävalitsimella.

Ohjelman liikkeen voi myös vaihtaa toiseksi ilman CSV:n uudelleentuontia: avaa liike ja valitse "Vaihda liike toiseksi". Sarjat, toistot ja teho säilyvät ennallaan, ja vaihdon voi kohdistaa joko vain kyseiseen kohtaan tai kaikkiin saman liikkeen esiintymiin ohjelmassa. Vaihdettu liike aloittaa oman historiansa uudella nimellä; vanhalla nimellä tallennetut merkinnät säilyvät Historiassa ennallaan.

**Historia.** Merkinnät päivittäin. Yksittäisen päivän voi poistaa, jolloin painoehdotukset ja Kehitys-näkymän laskennalliset maksimit lasketaan uudelleen jäljellä olevasta historiasta.

**Kehitys.** Jokaiselle liikkeelle kehitys laskennallisena 1RM:nä edelliseen treeniin, kuukauteen, puoleen vuoteen, vuoteen ja koko historiaan verrattuna — kiloina ja prosentteina, sekä SVG-viivakäyränä ajan yli. Liike näkyy heti, kun sille on kirjattu yksikin merkintä, josta 1RM voidaan laskea — toisesta merkinnästä lähtien käyrässä näkyy myös kehityssuunta. Ylimpänä myös vastaava käyrä treenipäivän nostetulle kokonaispainolle.

**Asetukset** (rataskuvake oikeassa yläkulmassa)**.** Uuden ohjelman tuonti, liikekohtaisten 1RM-arvojen hallinta, lepoajastimen kytkeminen päälle/pois ja sen keston muuttaminen, merkintöjen vienti ja tuonti sekä kaikkien tietojen tyhjennys. 1RM-lista näyttää automaattisesti jokaisen ohjelmassa MAX-teholla merkityn liikkeen, myös ennen kuin sille on asetettu arvoa.

**Ohje.** Tiivis käyttöohje: CSV:n muoto ja tuonti, treenin kirjaaminen, painoehdotusten logiikka, sekä lyhyt kuvaus muista näkymistä. Näkyy myös ennen ensimmäistä CSV-tuontia linkkinä etusivulla.

## Tietojen tallennus

Merkinnät tallennetaan selaimen omaan tallennustilaan ja säilyvät sovelluksen sulkemisen jälkeen. Mitään ei lähetetä palvelimelle — data ei koskaan poistu laitteeltasi, ja julkaistu sivu on pelkkä staattinen tiedosto.

Tallennustila on laite- ja osoitekohtainen, joten merkinnät eivät siirry toiseen selaimeen, laitteeseen tai osoitteeseen automaattisesti. Siirto ja varmuuskopiointi tehdään Asetusten vienti- ja tuontitoiminnoilla. Tuonti yhdistää tiedot olemassa oleviin merkintöihin ja ohittaa jo tallennetut, joten saman tiedoston voi tuoda turvallisesti useaan kertaan.

Uuden treeniohjelman tuonti ei poista historiaa: merkinnät ja painoehdotukset säilyvät liikkeen nimen perusteella, joten uusi ohjelmajakso jatkaa siitä mihin edellinen jäi.

## Rajoitukset

Yksityinen selaus tai evästeiden esto voi estää tallennuksen. Sovellus havaitsee tämän ja kertoo siitä ruudun yläreunassa; tällöin merkinnät säilyvät vain istunnon ajan.

Sovellus ei myöskään toimi, jos `index.html` avataan suoraan laitteelta tiedostona: Safari estää tallennuksen `file:`-osoitteissa. Sivu on siis tarjoiltava osoitteen kautta, esimerkiksi GitHub Pagesista.

Liikkeet tunnistetaan nimen perusteella isot ja pienet kirjaimet sivuuttaen. Sama liike eri tavoin kirjoitettuna (`Peck deck` ja `Pec dec`) tulkitaan kahdeksi eri liikkeeksi, joten CSV:n kirjoitusasujen kannattaa olla yhtenäisiä.
