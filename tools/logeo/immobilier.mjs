// immobilier.ch : pages de résultats publiques (autorisées par robots.txt).
// Le site limite la lecture automatisée : on lit quelques pages par passage, et on s'arrête dès qu'il refuse.
import { commune } from "./communes.mjs";
import { classer } from "./categories.mjs";

const BASE = "https://www.immobilier.ch";
const LISTE = n => `${BASE}/fr/louer/appartement-maison/geneve/page-${n}`;
const PAR_PAGE = 24;

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function texte(s) {
  return String(s || "").replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/g, (m, n) => ENT[n] || m).replace(/\s+/g, " ").trim();
}
const nombre = s => { const n = parseFloat(String(s || "").replace(/['’\s]/g, "").replace(",", ".")); return isFinite(n) ? n : null; };

export function analyser(html) {
  const total = +(/id="search-results"[^>]*data-count="(\d+)"/.exec(html) || [])[1] || null;
  const titres = {};
  for (const m of html.matchAll(/"url":\s*"([^"]+)",\s*"name":\s*("(?:[^"\\]|\\.)*")/g)) {
    try { titres[m[1].replace(BASE, "")] = JSON.parse(m[2]); } catch (e) { /* titre illisible : on garde le type de bien */ }
  }
  const items = [];
  for (const bloc of html.split('<div id="filter-item-').slice(1)) {
    const g = re => (re.exec(bloc) || [])[1];
    const num = g(/^(\d+)/), href = g(/href="(\/fr\/louer\/[^"]+)"/);
    if (!num || !href) continue;
    const prix = texte(g(/<strong class="title">([\s\S]*?)<\/strong>/));
    const type = texte(g(/class="object-type">([\s\S]*?)<\/p>/));
    const lieu = texte(g(/class="object-type">[\s\S]*?<\/p>\s*<p>([\s\S]*?)<\/p>/));
    const seg = href.split("/");                       // /fr/louer/<type>/<canton>/<localité>/<agence>/<titre-id>
    if (seg[4] !== "geneve") continue;
    const mensuel = /\/\s*mois/i.test(prix);
    const net = mensuel ? nombre((/CHF\s*([\d'’\s.,]+?)\.?-/.exec(prix) || [])[1]) : null;
    const ch = mensuel ? nombre((/\+\s*([\d'’\s]+)\.?-?\s*charges/i.exec(prix) || [])[1]) : null;
    const virg = lieu.indexOf(",");
    const tete = (virg < 0 ? lieu : lieu.slice(0, virg)).trim(), reste = virg < 0 ? "" : lieu.slice(virg + 1).trim();
    const npa = +((/^(\d{4})\b/.exec(tete) || [])[1]) || null;
    const loc = tete.replace(/^\d{4}\s*/, "").replace(/\s+GE$/, "");
    const s = nombre(g(/class="space">\s*([\d.,'’]+)/));
    const ll = (g(/data-latlng="([^"]*)"/) || "").split(",").map(Number);
    const x = {
      id: "im-" + num, src: "immobilier", ag: texte(g(/link-result-agency[^>]*>\s*<img[^>]*alt="([^"]*)"/)).replace(/\s+[–-]\s+.*$/, ""),
      t: (titres[href] || type).trim().slice(0, 140), ty: type.replace(/\s*[\d.,]+\s*pi[èe]ces?.*$/i, "").trim(),
      k: seg[3] === "maison" ? "maison" : "app",
      p: nombre((/([\d.,]+)\s*pi[èe]ce/i.exec(type) || [])[1]) || nombre(g(/icon-plan"[^>]*><\/i>\s*([\d.,]+)/)),
      s: s && s >= 8 ? s : null,
      l: net == null ? null : net + (ch || 0), ch: ch || null, ci: !!ch,
      npa, loc, com: commune(seg[5], npa) || commune(loc, npa) || loc,
      adr: /^contactez/i.test(reste) ? "" : reste, d: "", meuble: /meubl/i.test(type), temp: false,
      u: BASE + href, la: ll[0] ? +ll[0].toFixed(4) : null, lo: ll[1] ? +ll[1].toFixed(4) : null
    };
    x.cat = classer(x, "");
    items.push(x);
  }
  return { total, pages: total ? Math.ceil(total / PAR_PAGE) : null, items };
}

// etat : { page, cycle, pages } repris du passage précédent. quota : nombre de pages à lire cette fois.
export async function lireImmobilier(page, etat, quota) {
  const e = { page: Math.max(2, etat.page || 2), cycle: etat.cycle || 0, pages: etat.pages || 1 };
  const lues = [], items = [];
  let refus = "";
  const cibles = [1];
  for (let i = 0; i < quota - 1; i++) cibles.push(e.page + i);
  for (const n of cibles) {
    if (n > 1 && n > e.pages) break;
    const r = await page(LISTE(n));
    if (r.status !== 200 || r.defi) { refus = r.defi ? "le site demande une vérification anti-robot" : "réponse " + r.status; break; }
    const a = analyser(r.text);
    if (!a.items.length) { refus = "page " + n + " sans annonce lisible"; break; }
    if (a.pages) e.pages = a.pages;
    a.items.forEach(x => { x.pg = n; });
    items.push(...a.items); lues.push(n);
  }
  const suite = lues.filter(n => n > 1);
  if (suite.length) e.page = suite[suite.length - 1] + 1;
  if (e.page > e.pages) { e.page = 2; e.cycle++; }      // tour complet terminé
  return { items, lues, refus, etat: e };
}
