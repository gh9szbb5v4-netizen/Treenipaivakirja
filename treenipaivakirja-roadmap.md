# Treenipäiväkirja — kehitysroadmap

Tämä roadmap perustuu käytettävyys- ja ulkoasuarvioon, jossa verrattiin sovellusta markkinoilla oleviin vaihtoehtoihin (Hevy, Strong). Toteutetut vaiheet poistetaan roadmapista sitä mukaa kun ne on tehty, joten tässä näkyvät vain vielä tekemättömät vaiheet.

Kaikki suunnitellut vaiheet on nyt toteutettu. Jäljellä ovat enää alla olevat, kysynnän validointia odottavat kokonaisuudet.

---

## Myöhemmin, vasta kysynnän validoinnin jälkeen

Näitä ei kannata aloittaa ennen kuin koekäyttö ja mahdollinen ensimmäinen kaupallinen kokeilu (ks. liiketaloudellinen suunnitelma) osoittavat, että niihin kannattaa investoida:

- Palvelinpuolen tallennus ja laitteiden välinen synkronointi
- Käyttäjätunnistus ja tilausmalli
- Laajempi liikekirjasto kuvineen
- Sujuvat siirtymäanimaatiot näkymien välillä (vaatisi luopumisen nykyisestä koko sovelluksen uudelleenpiirtävästä `render()`-mallista)
