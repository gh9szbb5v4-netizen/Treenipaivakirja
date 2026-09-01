# Treenipäiväkirja — kehitysroadmap

Tämä roadmap perustuu käytettävyys- ja ulkoasuarvioon, jossa verrattiin sovellusta markkinoilla oleviin vaihtoehtoihin (Hevy, Strong). Toteutetut vaiheet poistetaan roadmapista sitä mukaa kun ne on tehty, joten tässä näkyvät vain vielä tekemättömät vaiheet.

Jokainen vaihe on rajattu niin, että se on toteutettavissa yhtenä tai muutamana Code-kehotteena aiempien esimerkkien tapaan. Kun olet valmis aloittamaan jonkin vaiheen, pyydä kehote juuri sille vaiheelle — kehote kannattaa laatia vasta silloin, jotta se voi viitata koodin sen hetkiseen todelliseen tilaan.

---

## Ohjelman muokattavuus

- Ohjelmaan kuuluva liike on voitava vaihtaa toiseksi suoraan ohjelmanäkymässä, ilman CSV:n uudelleentuontia

**Tulos:** käyttäjä voi mukauttaa ohjelmaa yksittäisen liikkeen osalta ilman koko ohjelman uudelleentuontia.

---

## Myöhemmin, vasta kysynnän validoinnin jälkeen

Näitä ei kannata aloittaa ennen kuin koekäyttö ja mahdollinen ensimmäinen kaupallinen kokeilu (ks. liiketaloudellinen suunnitelma) osoittavat, että niihin kannattaa investoida:

- Palvelinpuolen tallennus ja laitteiden välinen synkronointi
- Käyttäjätunnistus ja tilausmalli
- Laajempi liikekirjasto kuvineen
- Sujuvat siirtymäanimaatiot näkymien välillä (vaatisi luopumisen nykyisestä koko sovelluksen uudelleenpiirtävästä `render()`-mallista)
