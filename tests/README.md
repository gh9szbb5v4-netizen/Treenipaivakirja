# Selaintestit

Playwright-testit, jotka ajavat `index.html`-sovellusta oikeassa Chromiumissa
paikallista HTTP-palvelinta vasten. Ne eivät ole osa sovellusta eivätkä
vaikuta sen "ei riippuvuuksia" -sääntöön: riippuvuudet asennetaan vain tähän
hakemistoon.

Asennus ja ajo:

    cd tests
    npm install
    npx playwright install chromium
    npm test

`run.sh` käynnistää tarvittaessa palvelimen porttiin 8765 (`python3 -m
http.server`), ajaa jokaisen `test_*.js`-tiedoston ja kirjoittaa tulosteen
tiedostoon `<testi>.log`. Yksittäisen testin voi ajaa suoraan `node
test_history_move.js`, kun palvelin on käynnissä.

Testit siementävät sovelluksen tilan `localStorage`-avaimilla
(`treenipk:workout-program`, `treenipk:entries:<pvm>` jne.) sivulla
`manifest.json`, jossa sovellus ei ole käynnissä, ja lataavat sitten
`index.html`-sivun. Jokainen tiedosto tulostaa rivit `ok`/`FAIL` ja lopuksi
`ALL OK` tai `FAILS: n`. Kuvakaappaukset (`*.png`) syntyvät tähän
hakemistoon eivätkä kuulu versionhallintaan.

| Tiedosto | Kattaa |
|---|---|
| `test_next_card.js` | Seuraavaksi-kortti (0.4.4) |
| `test_kirjaus.js` | Kirjausruutu kapeassa asettelussa (0.4.5) |
| `test_kehitys_seg.js` | Kehityksen segmentit ja viikkopylväät (0.4.6) |
| `test_kehitys_2_5.js` | Kehityksen listan rivi, käyrä, 1RM-kortti, tabletti (0.4.7–0.4.10) |
| `test_volume_row.js` | Kirjauskortin volyymirivi (0.4.11) |
| `test_kirjaus_2_5.js` | Otsikkorivi, tavoiterivi, desimaalipilkku, seuraava sarja (0.4.12–0.4.15) |
| `test_history_1.js` | Historian kuukausiryhmittely ja päiväkortti (0.4.16) |
| `test_history_2_3.js` | Historian sarjarivit, liikekohtaiset reitit, suodatin (0.4.17–0.4.18) |
| `test_rakentaja_1.js` | Rakentajan runkokysely ja viikon monistus (0.4.19) |
| `test_rakentaja_2.js` | Liikkeen lisäyssilmukka ja lomakkeen tiivistys (0.4.20) |
| `test_rakentaja_3.js` | Muokkaustilan tasoittainen navigointi (0.4.21) |
| `test_history_move.js` | Historian liikkeen siirto toiselle päivälle (0.4.22) |
| `test_swap_done.js` | Liikkeen nimen vaihto ei koske tehtyjä liikkeitä (0.4.23) |
| `test_1rm_pohja.js` | 1RM-pohja, 1RM-luettelo ja Kehityksen arvio, varmuuskopion 1RM-yhdistäminen päivämäärän mukaan (0.4.24) |
| `test_1rm_tuntuma.js` | Kehityksen 1RM-arvio tuntuma huomioiden: laskenta funktioita suoraan kutsumalla, selitteet, 1RM-luettelon Käytä pyöristämättömästä arviosta, ennätykset ja varmuuskopion kierros (0.4.25) |
| `test_max_nolla.js` | MAX-rivin 1RM raskaimmasta onnistuneesta nostosta, korjaus ei muuta 1RM:ää, nollan toiston sarjat pois Kehityksen 1RM-arviosta (0.4.26) |
| `test_warmup_suggest.js` | Lämmittelyehdotuksen nouseva sarja: viime kerran lämmittelyt vain kokonaisena sarjana työpainojen suhteella 0,85–1,15, alaraja aiemmista lämmittelyriveistä, porrashaku ylöspäin, sekalähteen selite sekä regressiot (yhdistelmä- ja cluster-liike, lämmittelysäätö, tallennus, Historia, Kehitys, varmuuskopio) (0.4.27) |
| `test_kevennys_1.js` | Kevennysmerkintä säilyy saman päivän uudelleentallennuksessa: jumikevennyksen tallennus, uudelleentallennus (merkintä, lastSet ja Historian merkki), seuraavan kerran ehdotus ilman uutta kevennystä, tavallinen liike, korjaus toiselle päivälle ja `deloadForSave` (0.4.28, kevennys-sarja 1/4) |
| `test_kevennys_2.js` | Varmuuskopion Kevennys-sarake: vienti (automaattinen, pyydetty, tyhjä), palautus tyhjälle laitteelle ja vaikutus seuraavaan ehdotukseen, vanha tiedosto ilman saraketta, tuntematon arvo, Excel-muoto ja kaksoistunniste (0.4.29, kevennys-sarja 2/4) |
| `test_kevennys_3.js` | Pyydetty kevennys: kytkin laskenta-ikkunassa, osittain tehty kerta, tallennus lajilla, seuraavan kerran viitekerta, jumikevennys ilman kytkintä, lämmittely ja työsarjatasoinen lämmittely, uudelleentallennus, jälkikäteinen merkintä, kelpaamattomat liikkeet, päivän vaihto, korjaus ja varmuuskopio (0.4.30, kevennys-sarja 3/4) |

Aiempien versioiden testit (esim. `test_cluster.js`, `test_rir.js`,
`test_editor.js`), joihin CLAUDE.md viittaa, eivät ole repossa.
