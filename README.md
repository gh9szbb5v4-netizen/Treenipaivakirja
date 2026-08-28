# Treenipaivakirja

Selaimessa toimiva treenipäiväkirja, joka lukee treeniohjelman CSV-tiedostosta, tallentaa sarjakohtaiset merkinnät ja laskee seuraavien treenien sarjapainot automaattisesti. Koko sovellus on yhdessä `index.html`-tiedostossa: ei asennusta, ei palvelinta, ei riippuvuuksia.

## Käyttöönotto

Avaa julkaistu osoite selaimessa ja tuo treeniohjelmasi CSV-tiedostona. Ohjelma tallentuu selaimeen, joten tuonti tarvitsee tehdä vain kerran — sen jälkeen sovellus avautuu suoraan liikelistaan.

iPhonella kannattaa lisätä sivu Koti-valikkoon Safarin jakopainikkeesta, jolloin se avautuu kuin natiivi sovellus.

### Julkaisu GitHub Pagesissa

Lisää `index.html` repositorion `main`-haaraan, mene kohtaan **Settings → Pages**, valitse lähteeksi *Deploy from a branch*, haaraksi `main` ja kansioksi `/ (root)`. Sivu julkaistaan osoitteeseen `https://<käyttäjätunnus>.github.io/<repositorio>/` yleensä parissa minuutissa. Repositorion tulee olla julkinen, ellei tilisi ole maksullinen.

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

1RM-arvoa voi muokata milloin tahansa käsin Asetukset-välilehdellä, mutta se päivittyy myös automaattisesti: kun kirjaat merkinnän `MAX`-teholliselle liikkeelle, sen ensimmäisen sarjan paino tallentuu 1RM:ksi ja korvaa Asetuksiin aiemmin tallennetun arvon.

**Liikkeellä ei ole tehoa.** Ehdotus perustuu liikkeen **viimeksi kirjattuun sarjaan**. Jos sen toistomäärä vastaa ohjelman tavoitetta, ehdotetaan samaa painoa. Jos toistoja tuli enemmän tai vähemmän, uusi paino lasketaan kaavalla

```
paino = MROUND( edellinen_paino × (1 + edelliset_toistot / K) / (1 + tavoitetoistot / K) , 2,5 )
```

jossa `K` määräytyy liikkeen mukaan: penkki 30, kyykky 28, maastaveto 40, muut liikkeet 30.

Historia- ja Kehitys-välilehtien laskennallinen 1 toiston maksimi on tästä erillinen, eikä siihen vaikuta liikkeen teho tai manuaalinen 1RM: se lasketaan aina samalla toistopainolaskurin kaavalla liikkeen viimeisimmän merkintäpäivän **ensimmäisestä** sarjasta, riippumatta siitä mitä liikkeelle sinä päivänä oli ohjelmoitu.

Yhdistelmäliikkeet, joiden nimessä on kauttaviiva (esim. `Cardiolaite / Punnerrus / Burpee, 12 min`), jätetään automaattilaskennan ulkopuolelle kokonaan.

## Välilehdet

**Ohjelma.** Liikkeet viikoittain ja päivittäin. Liikkeen avaamalla kirjaat painot, toistot ja huomiot sarjoittain, ja näet nostetun kokonaispainon. Merkinnän voi kirjata myös takautuvasti päivämäärävalitsimella, ja ohjelmaan kuulumattoman liikkeen voi lisätä käsin.

**Historia.** Merkinnät päivittäin sekä laskennalliset yhden toiston maksimit jokaiselle seuratulle liikkeelle. Yksittäisen päivän voi poistaa, jolloin painoehdotukset ja laskennalliset maksimit lasketaan uudelleen jäljellä olevasta historiasta.

**Kehitys.** Jokaiselle liikkeelle kehitys laskennallisena 1RM:nä edelliseen treeniin, kuukauteen, puoleen vuoteen, vuoteen ja koko historiaan verrattuna — kiloina ja prosentteina. Liike näkyy, kun sille on vähintään kaksi merkintää.

**Asetukset.** Uuden ohjelman tuonti, liikekohtaisten 1RM-arvojen hallinta, merkintöjen vienti ja tuonti sekä kaikkien tietojen tyhjennys.

## Tietojen tallennus

Merkinnät tallennetaan selaimen omaan tallennustilaan ja säilyvät sovelluksen sulkemisen jälkeen. Mitään ei lähetetä palvelimelle — data ei koskaan poistu laitteeltasi, ja julkaistu sivu on pelkkä staattinen tiedosto.

Tallennustila on laite- ja osoitekohtainen, joten merkinnät eivät siirry toiseen selaimeen, laitteeseen tai osoitteeseen automaattisesti. Siirto ja varmuuskopiointi tehdään Asetukset-välilehden vienti- ja tuontitoiminnoilla. Tuonti yhdistää tiedot olemassa oleviin merkintöihin ja ohittaa jo tallennetut, joten saman tiedoston voi tuoda turvallisesti useaan kertaan.

Uuden treeniohjelman tuonti ei poista historiaa: merkinnät ja painoehdotukset säilyvät liikkeen nimen perusteella, joten uusi ohjelmajakso jatkaa siitä mihin edellinen jäi.

## Rajoitukset

Yksityinen selaus tai evästeiden esto voi estää tallennuksen. Sovellus havaitsee tämän ja kertoo siitä ruudun yläreunassa; tällöin merkinnät säilyvät vain istunnon ajan.

Sovellus ei myöskään toimi, jos `index.html` avataan suoraan laitteelta tiedostona: Safari estää tallennuksen `file:`-osoitteissa. Sivu on siis tarjoiltava osoitteen kautta, esimerkiksi GitHub Pagesista.

Liikkeet tunnistetaan nimen perusteella isot ja pienet kirjaimet sivuuttaen. Sama liike eri tavoin kirjoitettuna (`Peck deck` ja `Pec dec`) tulkitaan kahdeksi eri liikkeeksi, joten CSV:n kirjoitusasujen kannattaa olla yhtenäisiä.
