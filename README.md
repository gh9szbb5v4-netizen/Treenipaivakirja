# Treenipaivakirja

Selaimessa toimiva treenipäiväkirja, joka lukee treeniohjelman CSV- tai PDF-tiedostosta tai antaa rakentaa sen suoraan sovelluksessa, tallentaa sarjakohtaiset merkinnät ja laskee seuraavien treenien sarjapainot automaattisesti. Sovelluslogiikka on kokonaan yhdessä `index.html`-tiedostossa: ei asennusta, ei palvelinta, ei build-vaihetta.

Ainoa ulkoinen kirjasto on PDF-tuonnin tarvitsema [pdf.js](https://mozilla.github.io/pdf.js/) (`pdf.min.js` ja `pdf.worker.min.js` `index.html`:n rinnalla). Se ladataan vasta kun käyttäjä valitsee PDF-tuonnin, joten CSV-käyttö ei lataa sitä lainkaan. Kirjasto pidetään omassa tiedostossaan eikä sitä upoteta `index.html`:ään, koska se kolminkertaistaisi sovellustiedoston koon — ja CDN:n sijaan omalla palvelimella siksi, ettei tuotavan ohjelman käsittely saa vaatia yhteyttä ulkopuoliseen palveluun.

## Käyttöönotto

Avaa julkaistu osoite selaimessa. Tervetuloruudun jälkeen sovellus kysyy, miten haluat aloittaa: rakenna ohjelma itse, tuo se tiedostosta (CSV tai valmentajan PDF — muoto tunnistetaan itsestään) tai palauta aiempi varmuuskopio toiselta laitteelta. Ohjelma tallentuu selaimeen, joten tämä tarvitsee tehdä vain kerran — sen jälkeen sovellus avautuu suoraan liikelistaan, ja ensimmäisellä kerralla Ohjelma-näkymän kärjessä on lyhyt ohje treenin kirjaamiseen.

Kannattaa lisätä sivu laitteen aloitusnäytölle, jolloin se avautuu kuin natiivi sovellus eikä tavallisena selainvälilehtenä: iPhonella Safarin jakopainikkeesta ("Lisää Koti-valikkoon"), Androidilla selaimen valikosta ("Lisää aloitusnäytölle" tai "Asenna sovellus"). Laitteen taaksepäin-ele ja selaimen taaksepäin-painike toimivat sovelluksessa kuten natiivisovelluksessa: ne palaavat edelliseen näkymään (Asetuksista tai Kehityksen liikenäkymästä takaisin, mistä tahansa välilehdestä Ohjelmaan) ja poistuvat sovelluksesta vasta Ohjelma-näkymästä; sivun uudelleenlataus palaa samaan näkymään, eikä osoite muutu missään vaiheessa. Aloitusnäytölle lisääminen ei ole pelkkä kosmeettinen ero — Safari saattaa poistaa tavallisena selainvälilehtenä pidetyn sivun paikallisesti tallennetut tiedot noin seitsemän päivän käyttämättömyyden jälkeen, kun taas Koti-valikkoon lisätty, itsenäisenä avautuva versio on tästä vapautettu. Sovellus muistuttaa tästä kerran ensimmäisen CSV-tuonnin jälkeen, ellei se jo tuolloin ole käynnissä aloitusnäytöltä avattuna.

### Julkaisu GitHub Pagesissa

Lisää `index.html`, `manifest.json`, PDF-tuonnin kirjastotiedostot (`pdf.min.js`, `pdf.worker.min.js`) sekä kuvaketiedostot (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) samaan kansioon repositorion `main`-haaraan, mene kohtaan **Settings → Pages**, valitse lähteeksi *Deploy from a branch*, haaraksi `main` ja kansioksi `/ (root)`. Sivu julkaistaan osoitteeseen `https://<käyttäjätunnus>.github.io/<repositorio>/` yleensä parissa minuutissa. Repositorion tulee olla julkinen, ellei tilisi ole maksullinen. `manifest.json` ja kuvakkeet on tärkeää julkaista `index.html`:n rinnalla samalla polulla, sillä ilman niitä Koti-valikkoon lisätty sivu saa oletusruudunkaappauksen omana kuvakkeenaan eikä avaudu itsenäisenä sovelluksena.

## CSV-muoto

Ainoa pakollinen sarake on liikkeen nimi. Muut sarakkeet tunnistetaan automaattisesti otsikon perusteella sekä suomeksi että englanniksi, ja kenttäerotin (`;`, `,` tai sarkain) tunnistetaan itsestään — myös suomalaisen Excelin puolipiste-eroteltu vienti toimii sellaisenaan.

| Sarake | Tunnistetaan mm. | Merkitys |
|---|---|---|
| Viikko | `Viikko`, `Week`, `Vko` | Ryhmittelee ohjelman viikoittain |
| Treenipäivä | `Treenipäivä`, `Päivä`, `Day` | Ryhmittelee päivittäin |
| Liike | `Liike`, `Exercise` | **Pakollinen** — liikkeen nimi |
| Variaatio | `Variaatio`, `Variation` | Liitetään nimeen pilkulla, esim. `Kulmasoutu tangolla, Trap bar` |
| Lisävariaatio | `Lisävariaatio`, `Subvariation` | Liitetään nimen loppuun, esim. `Kulmasoutu tangolla, Suora tanko, Vastaotteella`; vapaa teksti, liikepankissa ei ole lisävariaatioita |
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

## PDF-muoto

Valmentajien PDF-ohjelmat ovat tyypillisesti kaksisarakkeisia: vasemmalla liikkeen nimi, oikealla tavoite (`3x10`). Tuonti lukee tekstin kokonaan selaimessa pdf.js:llä eikä lähetä tiedostoa mihinkään. Rivit muodostetaan tekstipalojen y-koordinaatista, ei pdf.js:n palauttamasta järjestyksestä, joka ei vastaa visuaalista rivijärjestystä. Osiootsikot (`RINTA, HAUIS`) tunnistetaan poikkeamana sivun yleisimmästä fontti- ja kokoyhdistelmästä, ei fontin nimestä.

Useita tiedostoja voi valita kerralla, esimerkiksi yhden viikkoa kohden. Viikkonumero luetaan kansilehden `Viikko N` -riviltä; jos sitä ei ole, viikoksi tulee tiedoston valintajärjestys.

Tunnistetut tavoitemuodot:

| Tavoite PDF:ssä | Tulkinta |
|---|---|
| `3x15` | 3 sarjaa × 15 toistoa, painoehdotus käytössä |
| `3x10 Merkkaa kuormat!` | 3 × 10, perässä oleva teksti säilyy huomautuksena |
| `6, 10, 10` | 3 sarjaa, joilla kullakin oma toistotavoite |
| `2x10/jalka` | 2 × 10, ja `/jalka` siirtyy nimeen muodossa `(per jalka)` |
| `3x10+3` | rest-pause/pakkotoisto — ei painoehdotusta |
| `2xCluster`, `2x drop` | menetelmäsarja — ei painoehdotusta |
| `Cardiolaite 15min` | 1 sarja, 15 minuuttia (yksikkö `min`) |

Rivit, joiden tavoitetta ei tunnisteta (esim. `PC 20+18+15` tai kiertoharjoittelun `Askelkävely + Vatsarutistus`), tulevat mukaan ilman tavoitetta ja merkitään tarkistettaviksi.

**PDF-tuonti ei tallenna suoraan.** Jäsennetty ohjelma avautuu muokkaustilaan (ks. Ohjelman muokkaus sovelluksessa) kaikki viikot ja päivät auki: rivin napautus avaa lomakkeen nimen, sarjojen, toistojen, yksikön ja tehon korjaamiseen, ⋮-valikosta rivin voi poistaa ja päivään voi lisätä puuttuvan liikkeen. Tarkistettavat rivit on merkitty keltaisella, ja menetelmäselitteet sekä tiedoston muistiinpanot näytetään tarkistuksen yhteydessä. Vasta "Valmis" tallentaa ohjelman — samaa polkua kuin CSV-tuonti, eli uusi ohjelma korvaa vanhan mutta historia säilyy liikkeen nimen perusteella.

Ohjeteksti, jota ei tulkita liikkeiksi (`-Tauot sarjojen välissä 90 sekuntia.`), ei katoa: se tallennetaan ohjelman mukana ja näkyy Ohjelma-välilehden lopussa kohdassa "Ohjelman muistiinpanot". Määritelmämuotoiset rivit (`Cluster = ...`) liitetään lisäksi niihin liikkeisiin, joita ne koskevat, ja näkyvät liikkeen avatessa.

Skannattua PDF:ää, jossa ei ole tekstikerrosta, ei voi lukea. Sovellus havaitsee puuttuvan tekstikerroksen ja kertoo siitä erikseen sen sijaan, että tuonti epäonnistuisi hiljaisesti. Jäsennys on puhtaasti sääntöpohjaista: ohjelman sisältöä ei lähetetä tekoälypalveluun, koska se olisi ristiriidassa sen kanssa, ettei mikään data poistu laitteelta.

## Ohjelman rakentaminen sovelluksessa

Ohjelman voi koota myös ilman tiedostoa. Kortti "Rakenna itse" on etusivulla ennen ensimmäistä tuontia ja painike "Rakenna sovelluksessa" Asetusten Ohjelma-osiossa. Rakentaja on sama muokkaustila kuin tallennetun ohjelman muokkauksessa (seuraava kohta), mutta se alkaa tyhjästä ohjelmasta, jossa on valmiina viikko 1 ja Päivä 1.

Rakenne etenee ylhäältä alas: **viikko** → **treenipäivä** → **liike**. "Lisää liike" avaa pohjalevyn, jonka hakukenttä suodattaa koko liikelistan nimen tai lihasryhmän perusteella — sama lihasryhmittäin ryhmitelty katalogi variaatioineen kuin liikkeen vaihdossa, täydennettynä ohjelmassa ja historiassa jo esiintyvillä nimillä. Enter valitsee ensimmäisen osuman. Jos liikettä ei löydy, kirjoitettua nimeä voi käyttää sellaisenaan; samankaltaisesta katalogin nimestä huomautetaan, koska eri kirjoitusasu aloittaisi historian alusta. Valinnan jälkeen liikkeelle annetaan sarjat, toistot, yksikkö ja teho, eli täsmälleen samat tiedot kuin CSV:n vastaavissa sarakkeissa.

"Kopioi viimeinen viikko uudeksi" (tai viikon ⋮-valikon Kopioi) monistaa viikon päivineen ja liikkeineen, joten toistuvan ohjelman voi rakentaa kerran ja monistaa loput. Uuden viikon numero ja treenipäivän oletusnimi ovat ensimmäinen vapaa numero.

Ohjelma tallentuu vasta "Valmis"-painikkeesta, ja tallennus kulkee samaa polkua kuin CSV- ja PDF-tuonti: liikeoliot ovat täsmälleen samanmuotoisia, ja jos jokin ohjelma on jo käytössä, sovellus kysyy, otetaanko uusi käyttöön vai jääkö se kirjastoon (ks. Useita ohjelmia). Historia säilyy liikkeen nimen perusteella. Tallennus estyy selkeällä ilmoituksella, jos ohjelmassa ei ole yhtään liikettä, jos kaksi viikkoa on nimetty samoin tai jos saman viikon kaksi treenipäivää on nimetty samoin. Liikkeetön treenipäivä ja päivätön viikko jätetään pois tallennettavasta ohjelmasta. "Peruuta" palaa näkymään, josta rakentaja avattiin, ja kysyy vahvistuksen, jos luonnokseen on jo tehty muutoksia.

Rakentaja luo aina uuden ohjelman. Jo tallennettua ohjelmaa muokataan muokkaustilassa (seuraava kohta).

## Ohjelman muokkaus sovelluksessa

Tallennettua ohjelmaa voi muokata jälkikäteen ilman uutta tuontia. Muokkaustila avataan Ohjelma-näkymän oikean yläkulman kynäkuvakkeesta tai Asetusten Ohjelma-osion painikkeesta "Muokkaa nykyistä ohjelmaa". Muokkauksen ajaksi välilehdet piilotetaan, ja näytön alareunaan tulee palkki, jossa ovat "Peruuta" ja "Valmis".

Näkymä on sama ylhäältä alas etenevä rakenne kuin rakentajassa: viikot, niiden alla treenipäivät ja päivien alla liikkeet. Jokaisella rivillä on nuolet järjestyksen vaihtamiseen sekä ⋮-painike, jonka takaa löytyvät Kopioi, Aloita uudelleen ja Poista. Viikolle ja päivälle voi kirjoittaa oman nimen, esimerkiksi "Kevennysviikko" tai "Ylävartalo"; viikon oletusnimi on "Viikko 1", "Viikko 2" jne., ja nimen tyhjentäminen palauttaa oletuksen. Liikettä napauttamalla avautuu lomake, jossa muutetaan nimi, sarjat, toistot, yksikkö ja teho — samat tiedot kuin CSV:n sarakkeissa; nimen voi myös hakea liikelistasta lomakkeen hakupainikkeesta. "Lisää liike" avaa saman liikevalitsimen kuin rakentajassa, "Lisää päivä" ja "Lisää tyhjä viikko" lisäävät uuden kohdan, ja "Kopioi viimeinen viikko uudeksi" monistaa viimeisen viikon päivineen ja liikkeineen seuraavaksi vapaaksi viikkonumeroksi.

Liikkeen tehty-tila on sidottu liikkeen tunnisteeseen, historia ja painoehdotukset liikkeen nimeen. Tästä seuraa muutama sääntö:

- Sarjojen, toistojen tai tehon muuttaminen säilyttää tunnisteen, joten jo kirjattu merkintä pysyy liikkeellä.
- Nimen muuttaminen on sama asia kuin liikkeen vaihto: liike saa uuden tunnisteen ja aloittaa oman historiansa, ja vanhalla nimellä kirjatut merkinnät jäävät Historiaan ennalleen. Jos sama liike on useassa viikossa, lomakkeen valinta "vaihda kaikissa viikoissa" vaihtaa ne kaikki kerralla.
- "Aloita uudelleen" antaa uudet tunnisteet liikkeelle, päivälle, viikolle tai koko ohjelmalle, jolloin ne näkyvät taas tekemättöminä. Merkinnät ja 1RM-arvot säilyvät, joten painoehdotukset lasketaan edelleen historiasta. Viikon ja koko ohjelman kohdalla toiminto vahvistetaan toisella painalluksella.
- Liikkeen, päivän ja viikon poisto vahvistetaan aina toisella painalluksella. Poistetun liikkeen merkinnät säilyvät Historiassa.

Muutokset tallentuvat vasta "Valmis"-painikkeesta, ja siihen asti ne koskevat vain luonnosta; "Peruuta" kysyy vahvistuksen, jos muutoksia on tehty. Kopioidut ja lisätyt liikkeet ovat täsmälleen samanmuotoisia kuin tuonnin tuottamat, joten Historia, Kehitys ja 1RM-lista toimivat niille samalla tavalla — esimerkiksi MAX-teholla lisätty liike ilmestyy heti Asetusten 1RM-listaan. Viikkojen omat nimet ja päivien tunnisteet kulkevat myös varmuuskopion mukana.

## Useita ohjelmia

Sovelluksessa voi olla useita ohjelmia, mutta vain yksi on käytössä kerrallaan. Uusi ohjelma — tuotiin se tiedostosta tai rakennettiin sovelluksessa — ei koskaan korvaa käytössä olevaa ilman hyväksyntää: kun jokin ohjelma on jo käytössä, sovellus näyttää pohjalevyn, jossa valitaan "Ota uusi ohjelma käyttöön", "Tallenna kirjastoon, jatka nykyisellä" tai peruutus. Kummassakaan tapauksessa nykyinen ohjelma ei katoa, vaan se jää ohjelmakirjastoon.

Ohjelmakirjasto on Asetusten Ohjelma-osiossa. Siellä ohjelman voi ottaa käyttöön, nimetä uudelleen ja poistaa; käytössä olevaa ohjelmaa ei voi poistaa ennen kuin toinen on otettu käyttöön. Kun kirjastossa on useampi ohjelma, Ohjelma-näkymän yläreunassa näkyy käytössä olevan ohjelman nimi ja "Vaihda"-painike. Ohjelman nimen voi antaa myös muokkaustilan yhteenvetokortissa; tuodun ohjelman nimeksi tulee tiedoston nimi.

Ohjelman vaihto ei koske merkintöjä. Historia ja Kehitys näyttävät kaikki kirjatut treenit riippumatta siitä, mikä ohjelma on käytössä, ja koska merkinnät on sidottu ohjelmakohtaisiin liiketunnisteisiin, ohjelmaan palattaessa sen tehty-merkinnät ja keskeneräiset päivät löytyvät ennallaan. Myös ohjelman poisto kirjastosta jättää merkinnät Historiaan. Varmuuskopio sisältää kaikki ohjelmat, ja palautus lisää puuttuvat ohjelmat kirjastoon poistamatta mitään.

## Liikepankki

Sovellukseen on leivottu liikepankki, jota liikevalitsin (ohjelman rakentaminen ja muokkaus), "Vaihda liike toiseksi" ja liikkeen tietopalkki käyttävät. Versio 4.9.2026 sisältää 354 liikettä ja 905 riviä: jokaisella liikkeellä on väline (kahvakuula, kehonpaino, kelkka, kone, kuntopallo, käsipaino, muu, Smith-kone, TRX, talja, tanko tai vastuskuminauha) ja lihasryhmä (alaselkä, etureisi, hauis, kyynärvarsi, loitontaja, lähentäjä, niska, ojentaja, olkapää, pakara, pohje, rinta, selkä, takareisi tai vatsa). Taljaliikkeille voi valita yhdeksästä kahvasta (H-kahva, hihnat, köysi, lapiokahva, lat-tanko, Scott-kahva, suora tanko, V-kahva, yhden käden kahva) ja tankoliikkeille kuudesta tangosta (suora tanko, Scott-tanko, trap bar, moniotetanko, safety squat bar, Smith-tanko); 27 talja- ja tankoliikettä on ilman variaatioita, koska kahva tai tanko on jo nimessä tai tanko on kiinteä (yhden käden taljaliikkeet, landmine-liikkeet). Variaatio liitetään nimeen pilkulla, esim. "Kulmasoutu tangolla, Trap bar".

Liikevalitsimen haku kohdistuu nimeen, lihasryhmään ja välineeseen, joten esimerkiksi "talja köysi" tai "käsipaino etureisi" rajaa listan. Liikepankki on vain ehdotuslista: ohjelmaan voi kirjoittaa minkä tahansa nimen, ja ohjelmassa tai historiassa jo olevat nimet näkyvät valitsimessa omassa ryhmässään. Liikepankin päivitys ei muuta ohjelmiin tai historiaan tallennettuja nimiä.

Nimen jako liikkeeseen ja variaatioon tehdään liikepankin perusteella: pisin pilkuilla rajattu alkuosa, joka on liikepankin liike, on liikkeen nimi, ja loppu (variaatio, lisävariaatio tai muu tarkenne) on variaatiotekstiä. Ohjelma-näkymä näyttää nimen otsikkona ja variaatiotekstin välineen ja lihasryhmän kanssa sen alla; Kehitys ja vaivalokin analyysi käyttävät pelkkää liikkeen nimeä, joten esimerkiksi trap barilla ja suoralla tangolla kirjatut kulmasoudut ovat yksi liike. Liikepankin ulkopuolinen nimi (esimerkiksi vanhan liikepankin "Kyykky, taka") pysyy kokonaisena.

## Sarjapainojen laskenta

Sovellus ehdottaa painon kahdella eri säännöllä sen mukaan, onko liikkeelle määritelty teho. Ehdotus on aina muokattavissa, ja ledgerin yläpuolella kerrotaan, mihin se perustuu.

**Liikkeellä on teho (MAX tai prosentti).** Painoehdotus lasketaan liikkeen 1RM-arvosta — ei liikkeen aiemmista merkinnöistä. `MAX`-teholle ehdotetaan suoraan 1RM:ää; prosenttiteholle (esim. `90 %`) ehdotetaan kyseinen prosenttiosuus 1RM:stä. Jos liikkeelle ei ole vielä 1RM-arvoa, ehdotus jää tyhjäksi.

1RM-arvoa voi muokata milloin tahansa käsin Asetuksissa (alavalikon viimeinen kohta), mutta se päivittyy myös automaattisesti: kun kirjaat merkinnän `MAX`-teholliselle liikkeelle, sen ensimmäisen sarjan paino tallentuu 1RM:ksi ja korvaa Asetuksiin aiemmin tallennetun arvon.

**Liikkeellä ei ole tehoa.** Ehdotus lasketaan **jokaiselle sarjalle erikseen** liikkeen viime kerran samasta sarjasta (tai viimeisestä sarjasta, jos sarjoja oli vähemmän) sen mukaan, toteutuiko tavoitetoistomäärä. Jos toistot täyttyivät, uusi paino johdetaan Epley-kaavalla ja progressiokertoimella, mutta nosto rajataan vähintään 2,5 kilon ja enintään 5 prosentin nostoon. Jos toistoja jäi yksi vajaaksi, paino pysyy samana. Jos toistoja jäi kaksi tai enemmän vajaaksi, paino kevenee 5 prosenttia ja pyöristetään alaspäin 2,5 kilon askeleeseen.

```
toistot täyttyivät (edelliset_toistot ≥ tavoitetoistot):
  1RM_edellinen = edellinen_paino × (1 + edelliset_toistot / 30)
  paino = MROUND( 1RM_edellinen × progressiokerroin / (1 + tavoitetoistot / 30) , 2,5 )
  rajattuna välille [ edellinen_paino + 2,5 ; edellinen_paino × 1,05 ]
yksi toisto vajaaksi:   paino = edellinen_paino
kaksi tai enemmän vajaaksi: paino = FLOOR( edellinen_paino × 0,95 , 2,5 )
```

Progressiokerroin on oletuksena 1,0125 eli tavoitteena 1,25 % kehitys jokaisella kirjauskerralla; koska tämä on kevyillä painoilla pienempi kuin pyöristysaskel, nosto on aina vähintään 2,5 kg. Esimerkkejä tavoitteella 10 toistoa: 100 kg × 10 → 102,5 kg, 60 kg × 10 → 62,5 kg, 100 kg × 12 → 105 kg (katto), 100 kg × 9 → 100 kg, 100 kg × 7 → 95 kg, 60 kg × 7 → 55 kg. Ledgerin selite kertoo jokaisen sarjan perusteen.

**Lämmittelysäätö.** Liikkeelle voi lisätä lämmittelysarjoja, joille kirjataan paino, toistot ja tuntuma. Tuntuma kysytään viisiportaisella sanallisella asteikolla, joka vastaa kysymykseen, montako toistoa olisi vielä jaksanut: Kevyt (neljä tai enemmän), Sujuva (kolme), Työläs (kaksi), Raskas (yksi) ja Äärirajoilla (ei yhtään). Sisäisesti pykälät tallennetaan RPE-lukuina 6–10, joten laskenta ja aiemmat kirjaukset ovat ennallaan. Saman treenin painavin valmiiksi merkitty lämmittely, jolle on annettu tuntuma, verrataan liikkeen aiempiin lämmittelyihin, joissa paino on 2,5 kg:n sisällä ja toistot samat. Jos vertailudataa ei vielä ole, työsarjoja ei säädetä ja selite kertoo tämän. Muuten aiempien tuntumien keskiarvosta lasketaan ero: vähintään kaksi pykälää raskaampi → työsarjat −10 %, vähintään yksi pykälä raskaampi → −5 %, vähintään yksi pykälä kevyempi → +2,5 %, muuten ennallaan; paino pyöristetään alaspäin 2,5 kg:n askeleeseen. Säätö koskee vain progressioehdotuksen tuottamia rivejä, joita ei ole muokattu käsin, ja vain tehottomia liikkeitä. Lämmittelyt tallentuvat merkinnän mukana ja liikkeen kolmen viimeisimmän kerran historiaan, mutta ne eivät vaikuta Historian ja Kehityksen laskentaan, eivät käynnistä lepoajastinta eivätkä vielä sisälly CSV-vientiin.

Sovellus muistaa liikkeen kolme viimeisintä kertaa. **Jumitunnistus:** jos käytetty maksimipaino ei ole noussut kolmen kerran aikana ja viimeisimmässä kerrassa vähintään yksi sarja jäi vajaaksi, ehdotus on 10 prosentin kevennys edellisen kerran sarjasta (alaspäin pyöristäen), ja selite kertoo syyn. Kevennyksen pohjalta kirjattu kerta merkitään, eikä uutta kevennystä ehdoteta ennen kuin sen jälkeen on kolme tavallista kertaa.

Kehitys-näkymän laskennallinen 1 toiston maksimi on tästä erillinen, eikä siihen vaikuta liikkeen teho tai manuaalinen 1RM. Se lasketaan aina samalla Epley-kaavalla

```
1RM = paino × (1 + toistot / 30)
```

kunkin merkintäpäivän **raskaimmasta** sarjasta — sarjasta, joka antaa suurimman laskennallisen 1RM:n — riippumatta siitä mitä liikkeelle sinä päivänä oli ohjelmoitu tai missä järjestyksessä sarjat kirjattiin. Yhden toiston sarja on mittaus (1RM = paino), ei arvio. Ero sarjapainolaskuriin on kahdessa kohdassa: Kehitys-laskenta perustuu aina päivän raskaimpaan sarjaan eikä sisällä progressiokerrointa, kun taas sarjapainolaskuri perustuu edelliseen kirjattuun sarjaan ja sisältää progressiokertoimen.

Kehitys-kortin luku ei ole viimeisimmän päivän arvo vaan **paras arvo neljän viikon liukuvalta jaksolta**, joka päättyy viimeisimpään merkintään. Syy on se, että Epley-kaava olettaa sarjan tehdyksi uupumukseen: ohjelmoitu submaksimaalinen päivä, esimerkiksi 4 × 8 seitsemälläkymmenellä prosentilla mitatun 100 kilon maksimin jälkeen, antaisi arvioksi 87,5 kg ja näyttäisi 12,5 kilon laskuna, vaikka voima ei ole muuttunut. Liukuvan jakson kanssa luku laskee vasta, kun vastaava suoritus jää toistamatta koko jakson ajan. Kuukauden, puolen vuoden ja vuoden vertailukohdat lasketaan samalla säännöllä kunkin ajankohdan jaksolta (jos jaksolla ei ole merkintöjä, käytetään viimeisintä arvoa ennen sitä), ja neljäs rivi vertaa nykyistä parasta ennätykseen. Kortti kertoo lisäksi viimeisimmän treenin oman arvion, ja kuvaajassa liukuva paras on viiva ja päiväkohtaiset arviot katkoviiva. Jakson pituus (28 päivää) on alkuarvo, jota tarkastellaan uudelleen, kun sovelluksen käytöstä on kokemusta pidemmältä ajalta.

Yhdistelmäliikkeet, joiden nimessä on kauttaviiva (esim. `Cardiolaite / Punnerrus / Burpee, 12 min`), jätetään automaattilaskennan ulkopuolelle kokonaan.

Sama koskee PDF-tuonnin menetelmäliikkeitä (rest-pause, cluster, drop) sekä kiertoharjoittelu- ja kestorivejä: niille painoa ei ehdoteta lainkaan, koska tavoite ei ole yksiselitteinen sarjamäärä × toistot ja väärä ehdotus olisi huonompi kuin tyhjä kenttä. Kiertoharjoittelu- ja kestoriveillä sarjan voi merkitä valmiiksi ilman painoa.

## Vaivaloki

Ohjelma-välilehden "Kirjaa vaiva" -painike (treenipäivien alapuolella) kirjaa kehonosakohtaisen vaivan valitulle kirjauspäivälle: kehonosa (niska, olkapää, kyynärpää, ranne, alaselkä, lonkka, polvi, nilkka tai muu), parillisilla kehonosilla puoli (vasen, oikea tai molemmat), voimakkuus (lievä, kohtalainen tai voimakas) ja vapaa huomio. Kirjaukset näkyvät Kehitys-välilehden Vaivat-osiossa uusin ensin, ja yksittäisen kirjauksen voi poistaa kahdella painalluksella.

Kun samalle kehonosalle (ja puolelle) on vähintään kolme kirjausta, Kehitys etsii ajallisia yhteyksiä liikkeisiin: jokaiselle kirjaukselle lasketaan vaivaa edeltävän seitsemän päivän volyymi liikkeittäin (paino × toistot, työsarjat), ja liike "ylittää tavanomaisen", kun se on yli 1,2-kertainen liikkeen tavanomaiseen viikkovolyymiin nähden (liikkeen koko volyymi jaettuna niiden kalenteriviikkojen määrällä, joilla liikettä on kirjattu). Liike näytetään löydöksenä, kun näin kävi vähintään 60 prosentissa kirjauksista, muodossa "3 / 3 kertaa edelsi viikko, jolloin Pystypunnerrus ylitti tavanomaisen volyymin". Loki näyttää ajallisia yhteyksiä omissa kirjauksissa, ei syitä; jos vaiva jatkuu tai pahenee, on syytä ottaa yhteys terveydenhuollon ammattilaiseen. Raja-arvot ovat alkuarvoja, joita tarkastellaan koekäytön kokemusten perusteella.

Vaivalokin voi viedä omana CSV-tiedostonaan (sarakkeet Päivämäärä, Kehonosa, Puoli, Aste, Huomio) Asetusten Varmuuskopio-osiosta. Varmuuskopioon loki ei vielä sisälly, mutta kaikkien tietojen tyhjennys poistaa myös sen.

## Näkymät

Ohjelma, Historia, Kehitys ja Asetukset vaihdetaan näytön alareunassa kelluvasta valikosta. Ohje avataan näkymän oikean yläkulman kysymysmerkkikuvakkeesta, joka on näkyvissä jokaisessa näkymässä.

**Ohjelma.** Näkymän otsikkona on viikon nimi ja sen vieressä nuolet edelliseen ja seuraavaan viikkoon sekä laskuri (esim. "1 / 4"); Kaikki-tilassa otsikko on "Koko ohjelma" ja jokaisen viikon päivät ovat oman väliotsikon alla. Treenipäivät ovat kortteina, joissa on päivän nimi, tila (tehty, kesken, liikkeiden määrä) ja seuraavaksi vuorossa olevalla päivällä "Aloita"-painike, joka avaa päivän ja sen ensimmäisen kirjaamattoman liikkeen; avattu liike vieritetään näkyviin, ja tallennuksen jälkeen seuraava liike nousee esiin. Avatun päivän liikkeet on ryhmitelty päivän kortin alle. Liikkeen otsikkona on liikepankin liikenimi ja sen alla pienellä väline, variaatio ja lihasryhmä (esim. "Kulmasoutu tangolla" ja "Tanko · Trap bar · Selkä"); liikepankin ulkopuolinen nimi näytetään sellaisenaan. Liikkeen avaamalla kirjaat painot ja toistot sarjoittain yhdellä rivillä per sarja (sarakkeet Sarja, Viime, Kg, Toistot ja ✓; Viime näyttää edellisen kerran painon ja toistot, esim. 60×10, ja jää alle 375 px:n näytöillä pois näkyvistä tilan puutteen vuoksi). Painon tai toistojen napautus avaa sovelluksen oman näppäimistön näytön alareunaan laitteen näppäimistön sijaan: numerot, pilkku (vain painoille), askelpalautin, painoille ±2,5 kg -painikkeet ja Seuraava, joka siirtyy seuraavan sarjan samaan kenttään ja viimeisestä sarjasta sulkee näppäimistön; nuoli sulkee sen milloin tahansa, ja fyysinen näppäimistö toimii ennallaan (Enter = Seuraava, Esc sulkee). ✓ merkitsee sarjan tehdyksi (painike täyttyy vihreäksi, sarjanumero säilyy), ja "Tallenna merkintä" näkyy harmaana ääriviivana, kunnes kaikki sarjat on merkitty. Jo tallennetun merkinnän voi avata ja korjata myöhemmin, ja korjaus säilyy alkuperäisellä treenipäivällä. Sarjojen alla on koko rivin levyinen "+ Sarja" ja sen alla tekstipainike "Lisää lämmittelysarja", joka lisää lämmittelyrivin, jolle kirjataan paino, toistot ja tuntuma sanallisella asteikolla (Kevyt … Äärirajoilla; valitun pykälän kuvaus näkyy rivin alla), ja kun sama lämmittely on kirjattu aiemmin, poikkeava tuntuma säätää saman treenin työsarjojen painoehdotusta (ks. Sarjapainojen laskenta); ±2,5 kg -painikkeet tuovat tyhjään kenttään ensin viime kerran painon; sarjan huomio sekä poisto löytyvät rivin ⋮-painikkeesta. Painoehdotuksen selite kertoo, mihin kertaan ehdotus perustuu ja mikä on kunkin sarjan peruste; maksimitesti kertoo avattaessa, että nosto tallentuu liikkeen 1RM:ksi, ja tallennuksen ilmoitus näyttää uuden 1RM:n. Yläreunan "Viikko | Kaikki" -valitsin näyttää nykyisen viikon tai koko ohjelman, ja päivämääräsirpaleesta merkinnän voi kirjata myös takautuvasti. Treenipäivien alapuolella "Kirjaa vaiva" avaa vaivalokin lomakkeen samalle kirjauspäivälle (ks. Vaivaloki). Oikean yläkulman kynäkuvake avaa ohjelman muokkaustilan (ks. Ohjelman muokkaus sovelluksessa).

Vähintään 768 pikseliä leveällä näytöllä (tabletti, tietokone) Ohjelma-näkymä on kaksipalstainen: päivät ja liikkeet ovat vasemmalla ja avattu liike sarjoineen oikealla omassa paneelissaan, joka pysyy paikallaan listaa vieritettäessä. Puhelimella näkymä on yksi palsta. Valmiiksi merkitty sarja, tallennettu liike ja valmistunut päivä saavat pienen ponnahdusanimaation; se ja painikkeiden siirtymät ovat pois päältä, jos laitteen asetuksissa on valittu liikkeen vähentäminen.

Ohjelman liikkeen voi myös vaihtaa toiseksi ilman CSV:n uudelleentuontia: avaa liike ja valitse "Vaihda liike toiseksi". Sarjat, toistot ja teho säilyvät ennallaan, ja vaihdon voi kohdistaa joko vain kyseiseen kohtaan tai kaikkiin saman liikkeen esiintymiin ohjelmassa. Liike valitaan liikepankista lihasryhmittäin, talja- ja tankoliikkeille myös kahva tai tanko, ja esikatselu näyttää uuden nimen, välineen ja lihasryhmän (ks. Liikepankki). Vaihdettu liike aloittaa oman historiansa uudella nimellä; vanhalla nimellä tallennetut merkinnät säilyvät Historiassa ennallaan.

**Historia.** Merkinnät päivittäin; ennen ensimmäistä merkintää näkymä kertoo, mistä aloittaa, ja vie painikkeella Ohjelmaan. jokainen päiväkortti näyttää jo suljettuna liikkeiden määrän ja nostetun kokonaispainon. Yksittäisen päivän voi poistaa kortin alareunasta kahdella painalluksella, jolloin painoehdotukset ja Kehitys-näkymän laskennalliset maksimit lasketaan uudelleen jäljellä olevasta historiasta.

**Kehitys.** Etusivu vastaa kysymykseen ”miten menee”. Viikko-kortti näyttää kuluvan treeniviikon (tai jos sillä ei ole merkintöjä, viimeisimmän treeniviikon) kokonaispainon, sarjat, toistot ja treenipäivät 2 × 2 -ruudukkona sekä erot edelliseen merkintäviikkoon neutraalilla värillä; ”Näytä liikkeet” avaa viikon liikkeet sarjoineen, toistoineen ja kiloineen tonnagen mukaan järjestettynä, yhdistelmäliikkeet lopuksi. Nostettu kokonaispaino -kortissa on yksi käyrä, jonka karkeuden voi vaihtaa viikon ja päivän välillä (Päivä on aiempi treenipäivän kokonaispaino sellaisenaan). Ohjelman toteutuminen -kortti kertoo viimeiseltä 28 päivältä mittaririveinä ja palkkeina tehdyt sarjat suhteessa ohjelmoituihin, kuinka usein tavoitetoistot täyttyivät ja kuinka usein 1,25 %:n progressiotavoite toteutui, sekä pysähtyneet liikkeet napautettavina tunnisteina (1RM ei ole noussut kolmeen viimeisimpään kertaan). Alimpana on aakkosjärjestetty liikelista, jonka rivillä on liikkeen nimi, viimeisin päivä, laskennallinen 1RM ja ero edelliseen kertaan; yli kahdeksan liikkeen listaa voi suodattaa hakukentällä. Yhdistelmäliikkeet (nimessä kauttaviiva) eivät ole listassa, mutta ne lasketaan viikon sarja- ja toistomääriin.

Liikkeen rivi avaa liikenäkymän, jossa on takaisin-painike, liikkeen nimi ja neljä välilehteä. **1RM** on entinen kortti: paras arvo viimeiseltä neljältä viikolta (mitattu tai laskennallinen; yhden toiston sarja on mittaus, muista sarjoista Epley-kaava päivän raskaimmasta sarjasta), muutos kuukauteen, puoleen vuoteen, vuoteen ja ennätykseen verrattuna sekä käyrä, jossa päiväkohtaiset arviot ovat katkoviivana; saman liikkeen eri variaatiot lasketaan yhteen liikkeen nimen alle, ja kortti kertoo kirjatut variaatiot. **Ennätykset** näyttää raskaimman painon (tasatilanteessa enemmän toistoja, sitten aikaisin päivä), parhaan sarjan (paino × toistot) ja toistoaluekohtaiset ennätykset alueille 1–3, 4–6, 7–10, 11–15 ja 16+ taulukkona, jossa tyhjä alue näkyy viivana. **Volyymi** näyttää viimeisimmän kerran kokonaispainon, sarjat ja toistot erojen kanssa sekä liikkeen tonnagen käyrän. **Toteutuminen** vertaa jokaista kertaa siihen, mitä ohjelma ja painoehdotus edellyttivät: sarjat, toistotavoite (kaikissa sarjoissa vähintään tavoitetoistot), ehdotettu paino (jossakin sarjassa vähintään ehdotus tavoitetoistoilla) ja progressiotavoite (päivän 1RM vähintään edellinen × 1,0125), sekä viisi viimeisintä kertaa taulukkona. Alimpana etusivulla on Vaivat-osio (ks. Vaivaloki). Sama liikenimisääntö koskee vaivalokin analyysiä. Liike näkyy heti, kun sille on kirjattu yksikin merkintä, josta 1RM voidaan laskea; vertailurivit näkyvät vasta, kun vertailukohta on olemassa.

**Asetukset** (alavalikon viimeinen kohta)**.** Luettelo, jonka rivit avaavat omat näkymänsä: Ohjelma (tuonti tiedostosta, rakentaminen sovelluksessa tai nykyisen ohjelman muokkaus), Liikkeiden 1RM, Lepoajastin, Varmuuskopio, Muutokset (kooste koekäytön aikana tehdyistä muutoksista ja niiden vaikutuksesta käyttöön; rivi näyttää "uutta", kunnes uusin kooste on avattu) sekä Lisää, jonka alla ovat simulointi, palaute, tietoja ja kaikkien tietojen tyhjennys. Rivin alaotsikko kertoo tilan, esimerkiksi viikkojen ja päivien määrän tai lepoajan. 1RM-lista näyttää automaattisesti jokaisen ohjelmassa MAX-teholla merkityn liikkeen, myös ennen kuin sille on asetettu arvoa.

**Ohje** (kysymysmerkkikuvake oikeassa yläkulmassa)**.** Tiivis käyttöohje: CSV:n ja PDF:n tuonti, ohjelman rakentaminen sovelluksessa, treenin kirjaaminen, ohjelman muokkaus, painoehdotusten logiikka, sekä lyhyt kuvaus muista näkymistä. Näkyy myös ennen ensimmäistä tuontia linkkinä etusivulla.

## Varmuuskopio

Asetusten "Vie varmuuskopio CSV:nä" tallentaa yhteen tiedostoon kaiken, mitä sovelluksessa on: kirjatut treenit, sillä hetkellä käytössä olevan treeniohjelman, käyttäjän itse lisäämät liikkeet ja liikkeiden 1RM-arvot. Vaivaloki viedään erikseen saman osion "Vie vaivaloki CSV:nä" -painikkeella eikä se sisälly varmuuskopioon (ks. Vaivaloki). Tiedosto on yhä CSV ja avautuu taulukkolaskennassa, mutta se jakautuu osioihin, joista jokainen alkaa omalla `#`-rivillään:

| Osio | Sisältö |
|---|---|
| `#MERKINNÄT` | Kirjatut sarjat: päivämäärä, liike, sarjanumero, paino, toistot, huomiot, tyyppi ja liikkeen tunniste |
| `#OHJELMA` | Kaikkien ohjelmien jokainen liike viikkoineen ja treenipäivineen, mukaan lukien tyyppi, menetelmä, sarjakohtaiset toistot ja menetelmäselite sekä viikon nimi, päivän tunniste ja päivän nimi; ohjelman tunniste, nimi ja Käytössä-sarake erottavat ohjelmat toisistaan |
| `#OHJELMAN MUISTIINPANOT` | PDF-ohjelman mukana tullut ohjeteksti ohjelman tunnisteella varustettuna |
| `#OMAT LIIKKEET` | Käyttäjän itse lisäämät liikkeet variaatioineen ja lihasryhmineen |
| `#1RM` | Liikekohtaiset 1RM-arvot ja niiden päivitysajankohta |

Merkintärivin **Tunniste** on liikkeen ohjelma-id. Sen ansiosta palautus sitoo jokaisen merkinnän täsmälleen samaan ohjelman liikkeeseen kuin varmuuskopion hetkellä, eikä liikkeiden nimien varaan jäävää arvausta tarvita. Vanhemmissa, ennen tätä tehdyissä vientitiedostoissa saraketta ei ole; ne tuodaan yhä entiseen tapaan nimien perusteella kohdistaen.

Palautus näyttää ensin, mitä tiedosto sisältää, ja tekee muutokset vasta vahvistuksesta, koska se vaihtaa käytössä olevan ohjelman: varmuuskopiossa käytössä ollut ohjelma otetaan käyttöön ja laitteen nykyinen ohjelma **jää kirjastoon**. Ohjelmat, jotka ovat laitteella jo (sama tunniste), ohitetaan. Kaikki muu yhdistetään laitteella jo olevaan niin, että jo tallennettu voittaa eikä mitään poisteta: omat liikkeet lisätään ilman kaksoiskappaleita, merkinnöistä ohitetaan jo tallennetut, ja 1RM-arvo tuodaan vain liikkeille, joilla ei vielä ole arvoa. Näin vanhemman varmuuskopion palautus ei laske tuoreempaa 1RM:ää huomaamatta, ja saman tiedoston voi tuoda turvallisesti useaan kertaan. Pelkät merkinnät sisältävä vanha vientitiedosto tuodaan suoraan ilman vahvistusta, koska se ei voi korvata ohjelmaa.

1RM-osiossa liikkeen nimi kirjoitetaan ohjelman kirjoitusasussa ja luetaan takaisin pienin kirjaimin — se on avain, jolla painoehdotus etsii arvon, joten kirjoitusasun vaihtelu ei vaikuta palautukseen.

Varmuuskopion voi avata Excelissä katsottavaksi. Suomalaisilla asetuksilla Excel lukee pilkuilla erotellun tiedoston jokaisen rivin yhdeksi soluksi ja kirjoittaa tallennettaessa koko rivin lainausmerkkeihin; palautus tunnistaa tämän muodon ja purkaa rivit itse, joten myös Excelin tallentama tiedosto palautuu. Purku liittää takaisin yhteen myös liikkeen nimen, jonka pilkun Excel on jättänyt ilman lainausmerkkejä (1RM-osion "Liike, Variaatio"), ja desimaalipilkulliset luvut (97,5) luetaan oikein.

## Tietojen tallennus

Merkinnät tallennetaan selaimen omaan tallennustilaan ja säilyvät sovelluksen sulkemisen jälkeen. Versiosta 0.4.0 alkaen merkinnän liikkeeseen tallentuu myös `plan`-kenttä (ohjelman sarjat ja toistot sekä painoehdotus, teholiikkeillä ilman ehdotusta), josta Kehityksen Ohjelman toteutuminen lasketaan täsmällisesti; vanhemmille ja varmuuskopiosta palautetuille merkinnöille suunnitelma päätellään nykyisestä ohjelmasta ja edellisestä kerrasta, mikä on arvio. Mitään ei lähetetä palvelimelle — data ei koskaan poistu laitteeltasi, ja julkaistu sivu on pelkkä staattinen tiedosto.

Tallennustila on laite- ja osoitekohtainen, joten tiedot eivät siirry toiseen selaimeen, laitteeseen tai osoitteeseen automaattisesti. Siirto ja varmuuskopiointi tehdään Asetusten varmuuskopiotoiminnoilla (ks. edellinen osio). Sovellus näyttää ohjelmanäkymässä muistutusbannerin, jos edellisestä varmuuskopiosta on yli 14 päivää; muistutuksen voi ohittaa kuluvaksi istunnoksi tai ottaa varmuuskopion suoraan bannerista.

Jos tuotavassa tiedostossa ei ole liikkeen tunnistetta — eli se on vanha, pelkät merkinnät sisältävä vienti — tuonti kohdistaa jokaisen tuodun treenipäivän siihen ohjelman päivään, jonka liikkeisiin sen nimet parhaiten täsmäävät. Päivät käydään aikajärjestyksessä ja kukin ohjelmapäivä varataan kerran, jolloin peräkkäiset samanmuotoiset treenit osuvat viikoille 1, 2, 3 jne. Näin palautetut treenit näkyvät myös Ohjelma-välilehdellä tehtyinä, eivät vain Historiassa ja Kehityksessä. Liikkeet, joita ohjelmassa ei ole, säilyvät Historiassa ja Kehityksessä, ja tuonti kertoo niiden määrän.

Uuden treeniohjelman tuonti ei poista historiaa: merkinnät ja painoehdotukset säilyvät liikkeen nimen perusteella, joten uusi ohjelmajakso jatkaa siitä mihin edellinen jäi.

## Rajoitukset

Yksityinen selaus tai evästeiden esto voi estää tallennuksen. Sovellus havaitsee tämän ja kertoo siitä ruudun yläreunassa; tällöin merkinnät säilyvät vain istunnon ajan.

Sovellus ei myöskään toimi, jos `index.html` avataan suoraan laitteelta tiedostona: Safari estää tallennuksen `file:`-osoitteissa. Sivu on siis tarjoiltava osoitteen kautta, esimerkiksi GitHub Pagesista.

Liikkeet tunnistetaan nimen perusteella isot ja pienet kirjaimet sivuuttaen. Sama liike eri tavoin kirjoitettuna (`Peck deck` ja `Pec dec`) tulkitaan kahdeksi eri liikkeeksi, joten CSV:n kirjoitusasujen kannattaa olla yhtenäisiä.

Rakentaja ja tuonti luovat aina uuden ohjelman kirjastoon; käytössä olevaa ne eivät korvaa ilman hyväksyntää. Jo tallennettua ohjelmaa muokataan muokkaustilassa; siellä liikkeen nimen muuttaminen aloittaa liikkeelle uuden historian, koska historia sidotaan liikkeen nimeen.
