// Liikekirjaston generointi index.html:ään (kehittäjän työkalu, ei osa
// sovellusta; ei riippuvuuksia). Lukee tämän hakemiston CSV-tiedostot ja
// kirjoittaa index.html:n merkkirivien
//   // LIIKEKIRJASTO-ALKU ... // LIIKEKIRJASTO-LOPPU
// väliin vakiot LIIKEKIRJASTO_VERSIO, LIIKEKIRJASTO ja NIMIMUUNNOKSET.
//
// Käyttö (repon juuresta):
//   node data/liikekirjasto/generoi.js            kirjoittaa index.html:n
//   node data/liikekirjasto/generoi.js --tarkista  vain tarkistus, ei kirjoitusta
//   node data/liikekirjasto/generoi.js --kohde polku/index.html  muu kohdetiedosto
//
// Tarkistukset: tunnisteet yksilöllisiä ja muotoa [a-z0-9-], näyttönimet
// yksilöllisiä, näyttönimi on muotoa "otsikko[, Variaatio]", kirjaustapa ja
// toispuolisuus tunnettuja arvoja, ja jokainen nimimuunnoksen kohde on
// kirjastossa ja sen näyttönimi täsmää. Sovellukseen otetaan nimimuunnoksista
// vain rivit, joiden lähde on sovelluksen data (LAHDE_SOVELLUS); vanhan
// Excel-listan rivit ovat CSV:ssä jäljitettävyyden vuoksi.
var fs = require("fs");
var path = require("path");

var VERSIO = "2026-10-19";
var KIRJASTO_CSV = path.join(__dirname, "liikekirjasto_v19.10.2026.csv");
var MUUNNOS_CSV = path.join(__dirname, "nimimuunnokset_v19.10.2026.csv");
var kohdeArg = process.argv.indexOf("--kohde");
var INDEX = kohdeArg !== -1 ? path.resolve(process.argv[kohdeArg + 1]) : path.join(__dirname, "..", "..", "index.html");
var LAHDE_SOVELLUS = "Treenipäiväkirja ja -ohjelmat 23.9.2026";
var KIRJAUSTAVAT = ["Paino ja toistot", "Lisäpaino ja toistot", "Avustus ja toistot", "Toistot", "Aika", "Lisäpaino ja aika", "Paino ja matka", "Matka ja aika"];

function parseCSV(text){
  var rows = [], row = [], field = "", quoted = false;
  text = text.replace(/^﻿/, "");
  for(var i = 0; i < text.length; i++){
    var ch = text.charAt(i);
    if(quoted){
      if(ch === '"'){
        if(text.charAt(i + 1) === '"'){ field += '"'; i++; }
        else quoted = false;
      } else field += ch;
    } else if(ch === '"') quoted = true;
    else if(ch === ","){ row.push(field); field = ""; }
    else if(ch === "\n"){ row.push(field); rows.push(row); row = []; field = ""; }
    else if(ch !== "\r") field += ch;
  }
  if(field || row.length){ row.push(field); rows.push(row); }
  var head = rows.shift();
  return rows.filter(function(r){ return r.length > 1 || r[0]; }).map(function(r){
    var o = {};
    head.forEach(function(h, k){ o[h.trim()] = (r[k] || "").trim(); });
    return o;
  });
}

var virheet = [];
function vaadi(ehto, viesti){ if(!ehto) virheet.push(viesti); }

var kirjasto = parseCSV(fs.readFileSync(KIRJASTO_CSV, "utf8")).map(function(r){
  return {
    id: r["Tunniste"],
    nimi: r["Näyttönimi"],
    liike: r["Liikkeen nimi"],
    variaatio: r["Variaatio (esim etu, taka)"] || null,
    lisavariaatio: r["Lisävariaatio"] || null,
    lihasryhma: r["Lihasryhmä"],
    avustavat: r["Avustavat lihasryhmät"],
    liikeperhe: r["Liikeperhe"],
    liikemalli: r["Liikemalli"],
    valine: r["Väline"],
    harjoitustyyppi: r["Harjoitustyyppi"],
    kirjaustapa: r["Kirjaustapa"],
    toispuolinen: r["Toispuolinen"] === "Kyllä",
    englanti: r["Englanninkielinen nimi"],
    muutNimet: r["Muut nimet"],
    huomio: r["Huomio"],
    _toispuolinenRaaka: r["Toispuolinen"]
  };
});

var idt = {}, nimet = {};
kirjasto.forEach(function(r, i){
  var rivi = "kirjaston rivi " + (i + 2) + " (" + r.id + ")";
  vaadi(/^[a-z0-9-]+$/.test(r.id), rivi + ": tunniste ei ole muotoa [a-z0-9-]");
  vaadi(!idt[r.id], rivi + ": tunniste toistuu");
  idt[r.id] = r;
  var nk = r.nimi.toLowerCase();
  vaadi(r.nimi && !nimet[nk], rivi + ": näyttönimi puuttuu tai toistuu");
  nimet[nk] = r;
  vaadi(r.liike, rivi + ": liikkeen nimi puuttuu");
  vaadi(r.lihasryhma, rivi + ": lihasryhmä puuttuu");
  vaadi(KIRJAUSTAVAT.indexOf(r.kirjaustapa) !== -1, rivi + ": tuntematon kirjaustapa " + r.kirjaustapa);
  vaadi(r._toispuolinenRaaka === "Kyllä" || r._toispuolinenRaaka === "Ei", rivi + ": Toispuolinen ei ole Kyllä/Ei");
  // Otsikko (näyttönimi ilman varustetta) on Kehityksen ryhmittelyn avain:
  // pilkku saa esiintyä vain ennen variaatiota.
  var otsikko = r.variaatio ? r.nimi.slice(0, r.nimi.length - (", " + r.variaatio).length) : r.nimi;
  vaadi(!r.variaatio || r.nimi === otsikko + ", " + r.variaatio, rivi + ": näyttönimi ei pääty variaatioon");
  vaadi(otsikko.indexOf(",") === -1, rivi + ": näyttönimen otsikko-osassa on pilkku");
  delete r._toispuolinenRaaka;
});

var muunnokset = parseCSV(fs.readFileSync(MUUNNOS_CSV, "utf8"));
var sovellus = muunnokset.filter(function(r){ return r["Lähde"] === LAHDE_SOVELLUS; }).map(function(r){
  var id = r["Uusi tunniste"];
  if(id === "–" || id === "-") id = "";
  return { vanha: r["Vanha nimi (nimi | variaatio | lisävariaatio)"], id: id || null, toimenpide: r["Toimenpide"], uusiNimi: r["Uusi näyttönimi"] };
});
muunnokset.forEach(function(r, i){
  var id = r["Uusi tunniste"];
  if(!id || id === "–" || id === "-") return;
  var kohde = idt[id];
  vaadi(kohde, "muunnosrivi " + (i + 2) + ": kohdetta " + id + " ei ole kirjastossa");
  if(kohde) vaadi(kohde.nimi === r["Uusi näyttönimi"], "muunnosrivi " + (i + 2) + ": näyttönimi " + r["Uusi näyttönimi"] + " ≠ " + kohde.nimi);
});
var vanhat = {};
sovellus.forEach(function(m){
  var k = m.vanha.trim().toLowerCase().replace(/\s+/g, " ");
  vaadi(!vanhat[k], "sovelluksen vanha nimi toistuu: " + m.vanha);
  vanhat[k] = true;
  vaadi(m.id || m.toimenpide === "Ei kohdistettu", "kohdistamaton rivi ilman toimenpidettä Ei kohdistettu: " + m.vanha);
});

console.log("Kirjasto: " + kirjasto.length + " liikettä; sovelluksen nimimuunnoksia " + sovellus.length +
  " (kohdistettu " + sovellus.filter(function(m){ return m.id; }).length + ").");
if(virheet.length){
  console.error("Virheitä " + virheet.length + ":\n  " + virheet.join("\n  "));
  process.exit(1);
}
if(process.argv.indexOf("--tarkista") !== -1) process.exit(0);

function js(v){ return JSON.stringify(v); }
var KENTAT = ["id", "nimi", "liike", "variaatio", "lisavariaatio", "lihasryhma", "avustavat", "liikeperhe", "liikemalli", "valine", "harjoitustyyppi", "kirjaustapa", "toispuolinen", "englanti", "muutNimet", "huomio"];
var lohko = [
  "  // LIIKEKIRJASTO-ALKU — generoitu tiedostoista data/liikekirjasto/*.csv",
  "  // skriptillä data/liikekirjasto/generoi.js. Älä muokkaa käsin: muuta CSV:tä",
  "  // ja aja skripti uudelleen.",
  "  var LIIKEKIRJASTO_VERSIO = " + js(VERSIO) + ";",
  "  var LIIKEKIRJASTO = ["
];
kirjasto.forEach(function(r, i){
  lohko.push("    { " + KENTAT.map(function(k){ return k + ":" + js(r[k]); }).join(", ") + " }" + (i < kirjasto.length - 1 ? "," : ""));
});
lohko.push("  ];");
lohko.push("  // Sovelluksen datassa 23.9.2026 olleet nimet uusiin tunnisteisiin");
lohko.push("  // (nimimuunnosten lähde \"" + LAHDE_SOVELLUS + "\"). id null =");
lohko.push("  // Ei kohdistettu: nimi jää vapaatekstiksi.");
lohko.push("  var NIMIMUUNNOKSET = [");
sovellus.forEach(function(m, i){
  lohko.push("    { vanha:" + js(m.vanha) + ", id:" + js(m.id) + ", toimenpide:" + js(m.toimenpide) + " }" + (i < sovellus.length - 1 ? "," : ""));
});
lohko.push("  ];");
lohko.push("  // LIIKEKIRJASTO-LOPPU");

var html = fs.readFileSync(INDEX, "utf8");
var alku = html.indexOf("  // LIIKEKIRJASTO-ALKU");
var loppuMerkki = "  // LIIKEKIRJASTO-LOPPU";
var loppu = html.indexOf(loppuMerkki);
if(alku === -1 || loppu === -1 || loppu < alku){
  console.error("index.html:stä puuttuvat merkkirivit LIIKEKIRJASTO-ALKU / LIIKEKIRJASTO-LOPPU");
  process.exit(1);
}
html = html.slice(0, alku) + lohko.join("\n") + html.slice(loppu + loppuMerkki.length);
fs.writeFileSync(INDEX, html);
console.log("Kirjoitettu " + path.relative(process.cwd(), INDEX) + ".");
