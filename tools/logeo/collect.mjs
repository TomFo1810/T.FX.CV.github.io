#!/usr/bin/env node
// Collecte des annonces de Logéo. Aucune dépendance : Node 20 ou plus récent.
//   node tools/logeo/collect.mjs --prev ancien.json --out logeo/data/listings.json [--pages 4]
import fs from "node:fs";
import { lireFlatfox } from "./flatfox.mjs";
import { lireImmobilier } from "./immobilier.mjs";
import { classer } from "./categories.mjs";

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("out", "logeo/data/listings.json"), PREV = arg("prev", OUT), PAGES = +arg("pages", 4);
const UA = "Mozilla/5.0 (compatible; LogeoCollecte/1.0)";
const pause = ms => new Promise(r => setTimeout(r, ms));
const maintenant = new Date().toISOString().slice(0, 16) + "Z";

async function requete(url, accept) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": accept, "Accept-Language": "fr-CH,fr;q=0.9" }, signal: AbortSignal.timeout(40000) });
  return r;
}
const json = async url => { await pause(300); const r = await requete(url, "application/json"); if (!r.ok) throw new Error("réponse " + r.status); return r.json(); };
const page = async url => {
  await pause(3000);
  try {
    const r = await requete(url, "text/html");
    return { status: r.status, defi: !!r.headers.get("x-amzn-waf-action"), text: r.status === 200 ? await r.text() : "" };
  } catch (e) { return { status: 0, defi: false, text: "" }; }
};

let prev = { items: [], sources: {} };
try { prev = JSON.parse(fs.readFileSync(PREV, "utf8")); } catch (e) { console.log("Pas de données précédentes : premier passage."); }
const avant = new Map((prev.items || []).map(x => [x.id, x]));
const sources = {};
let items = [];

/* ---- flatfox : lecture complète ---- */
{
  const anciens = (prev.items || []).filter(x => x.src === "flatfox");
  try {
    const r = await lireFlatfox(json);
    if (anciens.length > 40 && r.items.length < anciens.length * 0.5) throw new Error("résultat anormalement court (" + r.items.length + ")");
    for (const x of r.items) {
      const a = avant.get(x.id);
      // Premier import : la date de publication tient lieu de date de découverte.
      x.vu0 = a ? a.vu0 : (anciens.length ? maintenant : (x.pub || "").slice(0, 16) || null);
      x.vu = maintenant; delete x.pub;
    }
    items.push(...r.items);
    sources.flatfox = { nom: "flatfox.ch", ok: true, lu: maintenant, n: r.items.length, mode: "complet", note: r.note };
  } catch (e) {
    items.push(...anciens);
    sources.flatfox = { ...(prev.sources.flatfox || { nom: "flatfox.ch" }), ok: false, n: anciens.length, erreur: String(e.message || e), essai: maintenant };
  }
}

/* ---- immobilier.ch : quelques pages par passage ---- */
{
  const anciens = (prev.items || []).filter(x => x.src === "immobilier");
  const ps = prev.sources.immobilier || {};
  const r = await lireImmobilier(page, ps.etat || {}, PAGES);
  const rodage = (ps.etat ? ps.etat.cycle : 0) < 1 && r.etat.cycle < 1;   // premier tour : on ne sait pas dater les annonces
  const map = new Map(anciens.map(x => [x.id, x]));
  for (const x of r.items) {
    const a = map.get(x.id), pg = x.pg; delete x.pg;
    x.vu0 = a ? a.vu0 : (pg === 1 || !rodage ? maintenant : null);
    x.vu = maintenant; x.cy = r.etat.cycle;
    map.set(x.id, x);
  }
  // Retrait : une annonce absente de deux tours complets a quitté le site.
  const garde = [...map.values()].filter(x => (x.cy || 0) >= r.etat.cycle - 2);
  items.push(...garde);
  sources.immobilier = {
    nom: "immobilier.ch", ok: r.lues.length > 0, lu: r.lues.length ? maintenant : ps.lu || null, n: garde.length, mode: "partiel",
    note: r.lues.length ? "pages " + r.lues.join(", ") + " sur " + r.etat.pages + " lues à ce passage" : "aucune page lue à ce passage",
    ...(r.refus ? { erreur: r.refus, essai: maintenant } : {}), etat: r.etat
  };
}

/* ---- doublons entre sources : même commune, pièces, surface et loyer ---- */
{
  const cle = x => x.s && x.l && x.p ? [x.com, x.p, x.s, x.l].join("|") : null;
  const ff = new Map();
  for (const x of items) if (x.src === "flatfox") { const k = cle(x); if (k && !ff.has(k)) ff.set(k, x); delete x.u2; }
  items = items.filter(x => {
    if (x.src !== "immobilier") return true;
    const k = cle(x), f = k && ff.get(k);
    if (!f) { delete x.dbl; return true; }
    if (!f.u2) f.u2 = x.u;
    x.dbl = 1; return true;                               // conservée pour le suivi du tour, masquée à l'affichage
  });
}

for (const x of items) if (x.src !== "flatfox" || !x.cat) x.cat = classer(x, "");   // le titre suffit hors flatfox : on reclasse à chaque passage
const visibles = items.filter(x => !x.dbl).length;
if (!visibles) { console.error("Aucune annonce : rien n'est écrit."); process.exit(1); }
fs.mkdirSync(OUT.replace(/[^/]+$/, "") || ".", { recursive: true });
// Fichier compact : les champs vides ne sont pas écrits.
const net = x => Object.fromEntries(Object.entries(x).filter(([k, v]) => !(v === null || v === "" || v === false || v === undefined) || k === "vu0"));
fs.writeFileSync(OUT, JSON.stringify({ v: 1, genere: maintenant, n: visibles, sources, items: items.map(net) }));
for (const [k, s] of Object.entries(sources)) console.log(k + " : " + (s.ok ? "lu" : "ÉCHEC") + ", " + s.n + " annonces. " + (s.note || "") + (s.erreur ? " [" + s.erreur + "]" : ""));
console.log(visibles + " annonces affichées, écrites dans " + OUT);
