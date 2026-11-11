/* Logéo : interface. Les annonces viennent d'un fichier produit par la collecte automatique (tools/logeo). */
(function () {
  "use strict";

  /* Adresse du fichier tenu à jour par la collecte (branche logeo-data du dépôt). */
  var DISTANT = "https://raw.githubusercontent.com/TomFo1810/T.FX.CV.github.io/logeo-data/listings.json";
  var LOCAL = "data/listings.json";
  var RELEVE_MIN = 5;            // l'interface revérifie toutes les 5 minutes
  var VIEUX_MIN = 180;           // au-delà, on signale que la collecte ne tourne plus
  var NEUF_H = 48;               // une annonce est « nouvelle » pendant 48 heures
  var PAGE = 40;
  var CLE = "logeo-v3";

  var C = window.LOGEO_CONTENU, REGIES = window.LOGEO_REGIES || [];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(v) { var n = parseFloat(String(v).replace(/['’\s]/g, "").replace(",", ".")); return isFinite(n) ? n : 0; }
  function chf(n) { return "CHF " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "’"); }
  function fp(n) { return String(n).replace(".", ","); }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function lien(u) { u = String(u || "").trim(); return /^https?:\/\/[^\s]+$/i.test(u) ? u : ""; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function pieces(p) { return fp(p) + (p >= 2 ? " pièces" : " pièce"); }
  function temps(iso) { var t = Date.parse(iso); return isFinite(t) ? t : 0; }
  function ilya(ts) {
    var m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return "à l'instant";
    if (m < 60) return "il y a " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "il y a " + h + " h";
    var j = Math.round(h / 24);
    return "il y a " + j + (j > 1 ? " jours" : " jour");
  }
  function heure(ts) { var d = new Date(ts); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function jourDiff(ts) { var a = new Date(ts), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.round((a - b) / 86400000); }
  function jour(ts) {
    var d = jourDiff(ts);
    if (d === 0) return "aujourd'hui";
    if (d === -1) return "hier";
    if (d === 1) return "demain";
    return d < 0 ? "il y a " + (-d) + " jours" : "dans " + d + " jours";
  }
  function dateSaisie(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null; }

  /* ---------- Données personnelles : enregistrées dans ce navigateur ---------- */
  function defauts() {
    return {
      v: 3,
      profil: { nom: "", contact: "", naissance: "", nationalite: "", situation: "", adresse: "", bailleur: "", loyerActuel: "", emploi: "", employeur: "", depuis: "", personnes: "1", revenu: "", entree: "" },
      crit: { loyerMax: "", piecesMin: "", communes: "" },
      docs: {}, projets: [], suivis: [],
      filtres: { q: "", com: "", p: "tous", max: "", cat: "", qui: "", tri: "recent", crit: false, neuf: false, vue: "liste" },
      visite: 0
    };
  }
  function fusion(base, lu) {
    if (!lu || typeof lu !== "object") return base;
    ["profil", "crit", "docs", "filtres"].forEach(function (k) { if (lu[k] && typeof lu[k] === "object") base[k] = Object.assign({}, base[k], lu[k]); });
    if (Array.isArray(lu.suivis)) base.suivis = lu.suivis.filter(function (x) { return x && x.id && typeof x.titre === "string"; });
    if (Array.isArray(lu.projets)) base.projets = lu.projets.filter(function (x) { return typeof x === "string"; });
    if (typeof lu.visite === "number") base.visite = lu.visite;
    return base;
  }
  var S = defauts(), stockage = true;
  try { var brut = localStorage.getItem(CLE); if (brut) S = fusion(defauts(), JSON.parse(brut)); } catch (e) { stockage = false; }
  var F = S.filtres;
  var visitePrec = S.visite || 0;
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(S)); stockage = true; } catch (e) { stockage = false; } }

  /* ---------- Annonces ---------- */
  var D = { genere: null, sources: {}, items: [] }, TOUS = [], PARID = {}, charge = false, enCours = false, erreurReseau = false;
  var affiches = PAGE, filtreSuivi = "tous", triSuivi = "recent", lettrePour = "", filtreProjet = "tous";

  /* Catégories : clé, libellé, couleur du point sur la carte. */
  var CATS = [["app", "Appartement", "#0071e3"], ["studio", "Studio", "#8250df"], ["maison", "Maison", "#1a7f37"],
    ["coloc", "Colocation", "#e8590c"], ["chambre", "Chambre", "#d6336c"], ["sousloc", "Sous-location ou durée limitée", "#9a6700"]];
  var CAT = {}; CATS.forEach(function (c) { CAT[c[0]] = c; });
  function cat(l) { return CAT[l.cat] ? l.cat : l.k === "maison" ? "maison" : l.k === "coloc" ? "coloc" : "app"; }
  function total(l) { return l.l == null ? null : l.l; }
  function particulier(l) { return l.src === "flatfox" && !l.ag; }
  function estNeuf(l) { return !!l.vu0 && Date.now() - temps(l.vu0) < NEUF_H * 3600000; }
  function regieDe(nom) {
    var n = norm(nom); if (!n) return null;
    for (var i = 0; i < REGIES.length; i++) if (new RegExp(REGIES[i].motif).test(n)) return REGIES[i];
    return null;
  }
  var GENRE = { papier: "PDF à imprimer et remplir à la main", ecran: "PDF à remplir à l'écran", pdf: "PDF", ligne: "Inscription en ligne", page: "Page de la régie" };
  function nomSource(l) { return (D.sources[l.src] && D.sources[l.src].nom) || l.src; }

  function recevoir(d) {
    var avant = charge ? Object.keys(PARID).length : -1, anciens = PARID;
    D = d; TOUS = (d.items || []).filter(function (x) { return !x.dbl; });
    PARID = {}; TOUS.forEach(function (x) { PARID[x.id] = x; });
    var nouvelles = 0;
    if (avant >= 0) TOUS.forEach(function (x) { if (!anciens[x.id]) nouvelles++; });
    charge = true;
    return nouvelles;
  }
  function lire(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { if (!d || !Array.isArray(d.items) || !d.genere) throw new Error("format"); return d; });
  }
  function actualiser(manuel) {
    if (enCours) return;
    enCours = true; etat();
    var tranche = Math.floor(Date.now() / (RELEVE_MIN * 60000));
    var essais = [lire(DISTANT + "?t=" + tranche).catch(function () { return null; }), lire(LOCAL + "?t=" + tranche).catch(function () { return null; })];
    Promise.all(essais).then(function (r) {
      var bons = r.filter(Boolean).sort(function (a, b) { return temps(b.genere) - temps(a.genere); });
      enCours = false;
      erreurReseau = !bons.length;
      if (bons.length && bons[0].genere !== D.genere) {
        var premier = !charge, n = recevoir(bons[0]);
        if (premier) { S.visite = Date.now(); sauver(); }
        rendre(true);
        if (n > 0) toast(n + (n > 1 ? " nouvelles annonces" : " nouvelle annonce"), "Voir", function () { F.tri = "recent"; sauver(); location.hash = "#logements"; rendre(); window.scrollTo(0, 0); });
        else if (manuel) toast("Annonces à jour");
      } else if (manuel) toast(bons.length ? "Aucun changement depuis " + heure(temps(D.genere)) : "Connexion impossible : dernières annonces connues affichées");
      if (!charge) rendre();
      etat();
    });
  }
  function etat() {
    var b = $("#etat"), t = $("#etatTxt"); if (!b) return;
    if (enCours && !charge) { b.dataset.k = "attente"; t.textContent = "Chargement"; return; }
    if (!charge) { b.dataset.k = "erreur"; t.textContent = "Hors ligne"; return; }
    var ts = temps(D.genere), age = (Date.now() - ts) / 60000;
    b.dataset.k = enCours ? "attente" : age > VIEUX_MIN ? "vieux" : "ok";
    t.textContent = "Mis à jour " + ilya(ts);
    b.title = "Dernière collecte : " + new Date(ts).toLocaleString("fr-CH") + ". Appuyez pour actualiser.";
  }

  /* ---------- Vue : logements ---------- */
  function selonCriteres(l) {
    var max = num(S.crit.loyerMax), min = num(S.crit.piecesMin), cs = String(S.crit.communes || "").split(",").map(norm).map(function (x) { return x.trim(); }).filter(Boolean), t = total(l);
    if (max > 0 && (t == null || t > max)) return false;
    if (min > 0 && (l.p == null || l.p < min)) return false;
    if (cs.length && !cs.some(function (c) { return norm(l.com).indexOf(c) >= 0 || norm(l.loc).indexOf(c) >= 0; })) return false;
    return true;
  }
  function filtrer() {
    var q = norm(F.q), max = num(F.max);
    var L = TOUS.filter(function (l) {
      var t = total(l);
      if (F.com && l.com !== F.com) return false;
      if (F.cat && cat(l) !== F.cat) return false;
      if (F.qui && (particulier(l) ? "part" : "regie") !== F.qui) return false;
      if (max > 0 && (t == null || t > max)) return false;
      if (F.p !== "tous") {
        if (l.p == null) return false;
        if (F.p === "1-2" && l.p > 2.5) return false;
        if (F.p === "3" && (l.p < 3 || l.p > 3.5)) return false;
        if (F.p === "4" && (l.p < 4 || l.p > 4.5)) return false;
        if (F.p === "5+" && l.p < 5) return false;
      }
      if (F.neuf && !estNeuf(l)) return false;
      if (F.crit && !selonCriteres(l)) return false;
      if (q && norm([l.t, l.loc, l.com, l.adr, l.ag, l.npa].join(" ")).indexOf(q) < 0) return false;
      return true;
    });
    var nul = function (a, b) { return (total(a) == null) - (total(b) == null); };
    var par = {
      recent: function (a, b) { return temps(b.vu0) - temps(a.vu0) || nul(a, b) || total(a) - total(b); },
      prix: function (a, b) { return nul(a, b) || total(a) - total(b); },
      "prix-d": function (a, b) { return nul(a, b) || total(b) - total(a); },
      surface: function (a, b) { return (b.s || 0) - (a.s || 0); },
      pieces: function (a, b) { return (b.p || 0) - (a.p || 0); }
    };
    return L.sort(par[F.tri] || par.recent);
  }
  function suivi(id) { return S.suivis.some(function (x) { return x.ref === id; }); }
  function ligneBien(l) {
    var t = total(l), rev = num(S.profil.revenu), u = lien(l.u), faits = [], marques = "", rg = regieDe(l.ag);
    if (l.p != null) faits.push("<b>" + pieces(l.p) + "</b>");
    if (l.s) faits.push("<b>" + fp(l.s) + " m²</b>");
    faits.push(esc((l.npa ? l.npa + " " : "") + (l.loc && l.loc !== l.com ? l.loc + " (" + l.com + ")" : l.com)));
    if (l.adr) faits.push(esc(l.adr));
    if (estNeuf(l)) marques += '<span class="badge neuf">Nouveau · ' + esc(ilya(temps(l.vu0))) + "</span>";
    var ct = cat(l);
    if (ct !== "app") marques += '<span class="badge"><i class="cat-pt" style="--c:' + CAT[ct][2] + '"></i>' + CAT[ct][1] + "</span>";
    if (l.meuble) marques += '<span class="badge">Meublé</span>';
    if (l.temp) marques += '<span class="badge">Durée limitée</span>';
    if (l.d) marques += '<span class="badge">Libre : ' + esc(l.d) + "</span>";
    if (rev > 0 && t != null) { var tx = t / rev * 100; marques += '<span class="badge ' + (tx <= 33.4 ? "ok" : "alerte") + '">Taux d\'effort ' + Math.round(tx) + " %</span>"; }
    var prix = t == null ? '<div class="prix nd">Loyer sur demande</div>' : '<div class="prix">' + chf(t) + "<small>par mois" + (l.ci ? ", charges comprises" : "") + "</small></div>";
    var orig = (particulier(l) ? "Particulier ou annonce directe" : esc(l.ag || "Annonceur non précisé")) + " · " + esc(nomSource(l)) +
      (rg ? ' · <a href="' + esc(rg.docs[0].u) + '" target="_blank" rel="noopener noreferrer">formulaire de la régie</a>' : "") +
      (l.u2 ? ' · <a href="' + esc(lien(l.u2)) + '" target="_blank" rel="noopener noreferrer">aussi sur immobilier.ch</a>' : "");
    var on = suivi(l.id);
    return '<article class="bien">' + prix +
      '<div class="corps"><h3><a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(l.t || "Logement à louer") + "</a></h3>" +
      '<div class="faits">' + faits.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>" +
      '<div class="origine">' + orig + "</div>" + (marques ? '<div class="marques">' + marques + "</div>" : "") + "</div>" +
      '<div class="act"><a class="btn petit voir" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">Voir l\'annonce</a>' +
      '<button type="button" class="btn petit ' + (on ? "actif" : "plein") + '" data-suivre="' + esc(l.id) + '" aria-pressed="' + on + '">' + (on ? "Suivi" : "Suivre") + "</button></div></article>";
  }
  function vueLogements() {
    if (!charge) return '<p class="vide">' + (erreurReseau ? "<b>Annonces indisponibles</b>Vérifiez la connexion, puis appuyez sur le bouton d'actualisation en haut de page." : "Chargement des annonces…") + "</p>";
    var cc = {}; TOUS.forEach(function (l) { cc[l.com] = (cc[l.com] || 0) + 1; });
    var coms = Object.keys(cc).sort(function (a, b) { return cc[b] - cc[a] || a.localeCompare(b, "fr"); });
    var opt = function (liste, val) { return liste.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join(""); };
    var puces = [["tous", "Toutes"], ["1-2", "1 à 2,5"], ["3", "3 à 3,5"], ["4", "4 à 4,5"], ["5+", "5 et plus"]].map(function (s) {
      return '<button type="button" class="puce" data-fp="' + s[0] + '" aria-pressed="' + (F.p === s[0]) + '">' + s[1] + "</button>";
    }).join("");
    var depuis = visitePrec ? TOUS.filter(function (l) { return temps(l.vu0) > visitePrec; }).length : 0;
    var neufs = TOUS.filter(estNeuf).length;
    var nc = {}; TOUS.forEach(function (l) { var k = cat(l); nc[k] = (nc[k] || 0) + 1; });
    var actifs = (F.q ? 1 : 0) + (F.com ? 1 : 0) + (F.p !== "tous" ? 1 : 0) + (F.max ? 1 : 0) + (F.cat ? 1 : 0) + (F.qui ? 1 : 0) + (F.crit ? 1 : 0) + (F.neuf ? 1 : 0);
    return '<section class="hero"><h1>Se loger à Genève.<br><span>Sans y passer ses soirées.</span></h1>' +
      '<p>Les annonces du canton réunies et relues en continu. Vos candidatures, votre dossier et les formulaires des régies au même endroit.</p>' +
      '<div class="chiffres"><div><b>' + TOUS.length + '</b><span>logements à louer</span></div><div><b>' + neufs + '</b><span>nouveaux en 48 heures</span></div>' +
      (depuis ? "<div><b>" + depuis + "</b><span>depuis votre dernière visite</span></div>" : '<div><b>' + REGIES.length + "</b><span>régies avec formulaire prêt</span></div>") + "</div></section>" +
      '<details class="carte filtres" id="filtres"' + (window.matchMedia("(min-width: 761px)").matches || actifs ? " open" : "") + "><summary>Filtres" + (actifs ? " (" + actifs + ")" : "") + '</summary><div class="f-corps">' +
      '<div class="f-grille">' +
      '<div class="champ"><label for="f_q">Recherche</label><input id="f_q" type="search" placeholder="Rue, quartier, régie, numéro postal" value="' + esc(F.q) + '"></div>' +
      '<div class="champ"><label for="f_com">Commune</label><select id="f_com"><option value="">Toutes</option>' + coms.map(function (k) { return '<option value="' + esc(k) + '"' + (F.com === k ? " selected" : "") + ">" + esc(k) + " (" + cc[k] + ")</option>"; }).join("") + "</select></div>" +
      '<div class="champ"><label for="f_max">Loyer maximum</label><input id="f_max" type="number" min="0" step="50" inputmode="numeric" placeholder="CHF" value="' + esc(F.max) + '"></div>' +
      '<div class="champ"><label for="f_qui">Annonceur</label><select id="f_qui">' + opt([["", "Tous"], ["regie", "Régies et agences"], ["part", "Particuliers"]], F.qui) + "</select></div></div>" +
      '<div class="puces" role="group" aria-label="Catégorie"><span class="lbl">Catégorie</span><button type="button" class="puce" data-fcat="" aria-pressed="' + !F.cat + '">Toutes</button>' +
      CATS.map(function (c) { return '<button type="button" class="puce" data-fcat="' + c[0] + '" aria-pressed="' + (F.cat === c[0]) + '"><i class="cat-pt" style="--c:' + c[2] + '"></i>' + c[1] + "<b>" + (nc[c[0]] || 0) + "</b></button>"; }).join("") + "</div>" +
      '<div class="puces" role="group" aria-label="Nombre de pièces"><span class="lbl">Pièces</span>' + puces + "</div>" +
      '<div class="puces"><button type="button" class="puce" data-bascule="neuf" aria-pressed="' + !!F.neuf + '">Nouvelles seulement</button>' +
      '<button type="button" class="puce" data-bascule="crit" aria-pressed="' + !!F.crit + '">Selon mes critères</button>' +
      (actifs ? '<button type="button" class="btn petit discret" data-raz>Réinitialiser</button>' : "") + "</div></div></details>" +
      '<div class="barre"><div class="bascule" role="group" aria-label="Affichage"><button type="button" data-vue="liste" aria-pressed="' + (F.vue !== "carte") + '">Liste</button><button type="button" data-vue="carte" aria-pressed="' + (F.vue === "carte") + '">Carte</button></div>' +
      '<div class="compte" id="compte"></div><div class="tri"' + (F.vue === "carte" ? " hidden" : "") + '><label for="f_tri">Tri</label><select id="f_tri">' +
      opt([["recent", "Plus récentes"], ["prix", "Loyer croissant"], ["prix-d", "Loyer décroissant"], ["surface", "Plus grande surface"], ["pieces", "Plus de pièces"]], F.tri) + "</select></div></div>" +
      (F.vue === "carte" ? '<div class="carte plan" id="liste"><div id="carte" role="application" aria-label="Carte des logements"></div><div class="legende" id="legende"></div></div>' : '<div class="carte liste" id="liste"></div>') +
      '<button type="button" class="btn plus" id="plus" hidden></button>';
  }

  /* ---------- Carte ---------- */
  var plan = null, calque = null, fondCommunes = null, planVue = { c: [46.212, 6.135], z: 12 }, CENTRES = null;
  function fermerCarte() {
    if (!plan) return;
    try { planVue = { c: [plan.getCenter().lat, plan.getCenter().lng], z: plan.getZoom() }; plan.remove(); } catch (e) {}
    plan = null; calque = null;
  }
  function centres() {
    if (CENTRES) return CENTRES;
    CENTRES = {};
    (window.LOGEO_COMMUNES || []).forEach(function (c) {
      var a = 0, b = 0, n = 0; c.r[0].forEach(function (p) { a += p[0]; b += p[1]; n++; });
      CENTRES[norm(c.n).replace(/^le /, "")] = [a / n, b / n];
    });
    return CENTRES;
  }
  function hache(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function position(l) {
    if (l.la && l.lo) return { p: [l.la, l.lo], approx: false };
    var c = centres()[norm(l.com).replace(/^le /, "")]; if (!c) return null;
    var h = hache(l.id), ang = (h % 3600) / 3600 * 2 * Math.PI, r = .0012 + ((h >>> 12) % 1000) / 1000 * .0045;   // dispersé autour du centre de la commune
    return { p: [c[0] + Math.sin(ang) * r, c[1] + Math.cos(ang) * r * 1.45], approx: true };
  }
  function bulle(l) {
    var t = total(l), f = [], ct = cat(l), on = suivi(l.id);
    if (l.p != null) f.push(pieces(l.p));
    if (l.s) f.push(fp(l.s) + " m²");
    f.push(esc((l.npa ? l.npa + " " : "") + (l.loc || l.com)));
    return '<div class="bulle"><div class="prix">' + (t == null ? "Loyer sur demande" : chf(t)) + '</div><b>' + esc(l.t || "Logement à louer") + '</b><div class="faits">' + f.join(" · ") + "</div>" +
      '<div class="faits"><i class="cat-pt" style="--c:' + CAT[ct][2] + '"></i>' + CAT[ct][1] + (l.adr ? " · " + esc(l.adr) : "") + "</div>" +
      '<div class="actions"><a class="btn petit" href="' + esc(lien(l.u)) + '" target="_blank" rel="noopener noreferrer">Voir l\'annonce</a>' +
      '<button type="button" class="btn petit ' + (on ? "actif" : "plein") + '" data-suivre="' + esc(l.id) + '">' + (on ? "Suivi" : "Suivre") + "</button></div></div>";
  }
  function rendreCarte(liste) {
    var el = $("#carte"), LF = window.L; if (!el) return;
    if (!LF) { el.innerHTML = '<p class="vide"><b>Carte indisponible</b>Le module de carte n\'a pas pu être chargé. La liste reste disponible.</p>'; return; }
    if (!plan) {
      var racine = document.documentElement, sombre = racine.dataset.theme === "dark" || (racine.dataset.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      el.classList.toggle("sombre-tuiles", sombre);
      plan = LF.map(el, { minZoom: 10, maxZoom: 18 }).setView(planVue.c, planVue.z);
      var trait = getComputedStyle(racine).getPropertyValue("--encre3").trim() || "#888", fond = getComputedStyle(racine).getPropertyValue("--carte").trim() || "#fff";
      fondCommunes = LF.layerGroup((window.LOGEO_COMMUNES || []).map(function (c) {
        return LF.polygon(c.r, { color: trait, weight: 1, opacity: .45, fillColor: fond, fillOpacity: 0, interactive: false });
      })).addTo(plan);
      var secours = false;
      LF.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' })
        .on("tileerror", function () {                     // sans fond de carte : on remplit les communes pour garder des repères
          if (secours) return; secours = true;
          el.classList.remove("sombre-tuiles");
          fondCommunes.eachLayer(function (p) { p.setStyle({ fillOpacity: 1, opacity: .7 }); });
          var n = $("#planNote"); if (n) n.hidden = false;
        }).addTo(plan);
      calque = LF.layerGroup().addTo(plan);
      plan.on("moveend", function () { planVue = { c: [plan.getCenter().lat, plan.getCenter().lng], z: plan.getZoom() }; });
    }
    calque.clearLayers();
    var approx = 0, sans = 0, nb = {};
    // les positions approximatives d'abord, pour que les positions exactes restent au-dessus
    liste.map(function (l) { return { l: l, q: position(l) }; }).sort(function (a, b) { return (b.q && b.q.approx ? 1 : 0) - (a.q && a.q.approx ? 1 : 0); }).forEach(function (o) {
      var l = o.l, q = o.q, ct = cat(l); nb[ct] = (nb[ct] || 0) + 1;
      if (!q) { sans++; return; }
      if (q.approx) approx++;
      LF.circleMarker(q.p, q.approx ? { radius: 5, color: CAT[ct][2], weight: 1.5, opacity: .7, fillColor: CAT[ct][2], fillOpacity: .12 } : { radius: 6.5, color: "#ffffff", weight: 1.5, fillColor: CAT[ct][2], fillOpacity: .95 })
        .bindPopup(function () { return bulle(l); }, { maxWidth: 300 }).addTo(calque);
    });
    $("#legende").innerHTML = CATS.filter(function (c) { return nb[c[0]]; }).map(function (c) { return '<span><i class="cat-pt" style="--c:' + c[2] + '"></i>' + c[1] + " · " + nb[c[0]] + "</span>"; }).join("") +
      (approx ? '<span class="approx">Cercles vides : ' + approx + " annonces sans adresse, placées dans leur commune" + (sans ? " · " + sans + " non placées" : "") + "</span>" : "") +
      '<span class="approx" id="planNote" hidden>Fond de carte indisponible ici : seuls les contours des communes sont affichés.</span>';
    setTimeout(function () { if (plan) plan.invalidateSize(); }, 60);
  }

  function rendreListe() {
    var box = $("#liste"); if (!box) return;
    var L = filtrer();
    $("#compte").innerHTML = L.length + " <span>sur " + TOUS.length + " logements</span>";
    var m = $("#plus");
    if (F.vue === "carte") { m.hidden = true; rendreCarte(L); return; }
    if (!L.length) { box.innerHTML = '<p class="vide"><b>Aucun logement ne correspond</b>Élargissez le loyer, les pièces ou la commune, ou réinitialisez les filtres.</p>'; m.hidden = true; return; }
    box.innerHTML = L.slice(0, affiches).map(ligneBien).join("");
    m.hidden = L.length <= affiches;
    m.textContent = "Afficher " + Math.min(PAGE, L.length - affiches) + " logements de plus (" + (L.length - affiches) + " restants)";
  }

  /* ---------- Vue : candidatures ---------- */
  var CL_ST = { a_postuler: "", postule: "info", visite: "alerte", accepte: "ok", refuse: "refus" };
  function vueSuivi() {
    var st = C.STATUTS.map(function (s) { return '<option value="' + s.k + '">' + s.t + "</option>"; }).join("");
    return '<div class="tete"><h1>Mes candidatures</h1><p>Chaque annonce suivie garde son état, de « À postuler » jusqu\'à la décision. Le taux d\'effort se calcule avec le revenu saisi dans le dossier.</p></div>' +
      '<div id="etapes"></div>' +
      '<details class="carte" id="ajout"><summary>Ajouter une annonce trouvée ailleurs</summary><form id="fAjout" autocomplete="off"><div class="grille">' +
      '<div class="champ large"><label for="a_titre">Titre</label><input id="a_titre" required placeholder="Ex. 3 pièces, rue de Carouge"></div>' +
      '<div class="champ"><label for="a_commune">Commune</label><input id="a_commune" placeholder="Genève"></div>' +
      '<div class="champ"><label for="a_loyer">Loyer mensuel (CHF)</label><input id="a_loyer" type="number" min="0" step="10" inputmode="numeric" required></div>' +
      '<div class="champ"><label for="a_pieces">Pièces</label><input id="a_pieces" type="number" min="0" step="0.5" inputmode="decimal"></div>' +
      '<div class="champ"><label for="a_surface">Surface (m²)</label><input id="a_surface" type="number" min="0" step="1" inputmode="numeric"></div>' +
      '<div class="champ"><label for="a_regie">Régie ou propriétaire</label><input id="a_regie"></div>' +
      '<div class="champ"><label for="a_statut">Statut</label><select id="a_statut">' + st + "</select></div>" +
      '<div class="champ large"><label for="a_lien">Lien de l\'annonce</label><input id="a_lien" type="url" placeholder="https://"></div></div>' +
      '<div class="actions"><button class="btn plein" type="submit">Enregistrer l\'annonce</button></div></form></details>' +
      '<div class="barre"><div class="tri"><label for="s_tri">Tri</label><select id="s_tri"><option value="recent"' + (triSuivi === "recent" ? " selected" : "") + '>Ajout récent</option><option value="loyer"' + (triSuivi === "loyer" ? " selected" : "") + ">Loyer croissant</option></select></div></div>" +
      '<div class="carte liste" id="cands"></div>';
  }
  function rendreSuivi() {
    var box = $("#cands"); if (!box) return;
    var L = S.suivis.slice(), cnt = { tous: L.length };
    C.STATUTS.forEach(function (s) { cnt[s.k] = 0; }); L.forEach(function (l) { cnt[l.statut] = (cnt[l.statut] || 0) + 1; });
    $("#etapes").innerHTML = '<div class="etapes" role="group" aria-label="Filtrer par statut">' + [{ k: "tous", t: "Toutes" }].concat(C.STATUTS).map(function (s) {
      return '<button type="button" data-etape="' + s.k + '" aria-pressed="' + (filtreSuivi === s.k) + '"><b>' + (cnt[s.k] || 0) + "</b><span>" + s.t + "</span></button>";
    }).join("") + "</div>";
    if (filtreSuivi !== "tous") L = L.filter(function (l) { return l.statut === filtreSuivi; });
    L.sort(triSuivi === "loyer" ? function (a, b) { return a.loyer - b.loyer; } : function (a, b) { return b.cree - a.cree; });
    if (!L.length) {
      box.innerHTML = '<p class="vide"><b>' + (S.suivis.length ? "Aucune annonce dans ce statut" : "Aucune annonce suivie") + "</b>" + (S.suivis.length ? "Changez de filtre pour voir les autres." : "Appuyez sur « Suivre » dans les logements, ou ajoutez une annonce trouvée ailleurs.") + "</p>";
      return;
    }
    var rev = num(S.profil.revenu), max = num(S.crit.loyerMax), min = num(S.crit.piecesMin);
    box.innerHTML = L.map(function (l) {
      var b = "", st = C.STATUTS.filter(function (s) { return s.k === l.statut; })[0];
      if (st) b += '<span class="badge ' + CL_ST[st.k] + '">' + esc(st.t) + "</span>";
      if (rev > 0 && l.loyer > 0) { var t = l.loyer / rev * 100; b += '<span class="badge ' + (t <= 33.4 ? "ok" : "alerte") + '">Taux d\'effort ' + Math.round(t) + " %</span>"; }
      if ((max > 0 && l.loyer > max) || (min > 0 && l.pieces && l.pieces < min)) b += '<span class="badge refus">Hors critères</span>';
      if (charge && l.ref && !PARID[l.ref] && !(D.items || []).some(function (x) { return x.id === l.ref; })) b += '<span class="badge alerte">Annonce retirée du site</span>';
      var meta = [];
      if (l.commune) meta.push(esc(l.commune));
      if (l.pieces) meta.push(esc(pieces(l.pieces)));
      if (l.surface) meta.push(esc(fp(l.surface)) + " m²");
      if (l.regie) meta.push(esc(l.regie));
      var vs = l.statut === "visite" ? dateSaisie(l.visite) : null;
      if (vs != null) meta.push("Visite " + esc(jour(vs)));
      if (l.cree) meta.push("Ajoutée " + esc(jour(l.cree)));
      var u = lien(l.lien), rgc = regieDe(l.regie);
      return '<article class="cand" data-id="' + esc(l.id) + '"><div><h3>' + esc(l.titre) + '</h3><div class="faits">' + meta.map(function (m) { return "<span>" + m + "</span>"; }).join("") + "</div></div>" +
        '<div class="prix">' + (l.loyer > 0 ? chf(l.loyer) : '<span class="note">Loyer sur demande</span>') + "</div>" +
        '<div class="bas">' + b + '<span class="pousse"></span>' +
        (l.statut === "visite" ? '<input type="date" data-act="visite" aria-label="Date de la visite" value="' + esc(l.visite || "") + '">' : "") +
        '<select data-act="statut" aria-label="Statut">' + C.STATUTS.map(function (s) { return '<option value="' + s.k + '"' + (s.k === l.statut ? " selected" : "") + ">" + s.t + "</option>"; }).join("") + "</select>" +
        '<button type="button" class="btn petit" data-act="lettre">Lettre</button>' +
        (rgc ? '<a class="btn petit" href="' + esc(rgc.docs[0].u) + '" target="_blank" rel="noopener noreferrer">Formulaire ' + esc(rgc.nom.split(" ")[0]) + "</a>" : "") +
        (u ? '<a class="btn petit" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">Ouvrir</a>' : "") +
        '<button type="button" class="btn petit discret" data-act="retirer">Retirer</button></div></article>';
    }).join("");
  }

  /* ---------- Vue : dossier ---------- */
  function champ(pre, attr, k, label, val, ph, type) {
    return '<div class="champ"><label for="' + pre + k + '">' + label + '</label><input id="' + pre + k + '" ' + attr + '="' + k + '" type="' + (type || "text") + '"' +
      (type === "number" ? ' min="0" step="any" inputmode="decimal"' : "") + ' value="' + esc(val) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : "") + "></div>";
  }
  function vueDossier() {
    var p = S.profil, c = S.crit;
    var coches = C.DOCS.map(function (d) { return '<label><input type="checkbox" data-doc="' + d.k + '"' + (S.docs[d.k] ? " checked" : "") + "><div><b>" + esc(d.t) + "</b><span>" + esc(d.d) + "</span></div></label>"; }).join("");
    var opts = '<option value="">Sans annonce précise</option>' + S.suivis.map(function (l) { return '<option value="' + esc(l.id) + '"' + (l.id === lettrePour ? " selected" : "") + ">" + esc(l.titre) + (l.commune ? ", " + esc(l.commune) : "") + "</option>"; }).join("");
    return '<div class="tete"><h1>Mon dossier</h1><p>Le profil sert à calculer le taux d\'effort et à écrire la lettre. Aucune pièce n\'est stockée ici : la liste sert à vérifier que tout est prêt.</p></div>' +
      '<div class="deux"><div class="pile">' +
      '<section class="carte pad pile"><h2>Profil</h2><div class="grille">' +
      champ("p_", "data-profil", "nom", "Nom et prénom", p.nom) + champ("p_", "data-profil", "contact", "Téléphone ou e-mail", p.contact) +
      champ("p_", "data-profil", "naissance", "Date de naissance", p.naissance, "Ex. 14.03.2001") + champ("p_", "data-profil", "nationalite", "Nationalité ou permis", p.nationalite, "Ex. Suisse, permis B") +
      champ("p_", "data-profil", "situation", "État civil", p.situation, "Ex. célibataire, en couple") + champ("p_", "data-profil", "adresse", "Adresse actuelle", p.adresse, "Rue, numéro postal, localité") +
      champ("p_", "data-profil", "bailleur", "Régie ou bailleur actuel", p.bailleur) + champ("p_", "data-profil", "loyerActuel", "Loyer actuel (CHF)", p.loyerActuel, "", "number") +
      champ("p_", "data-profil", "emploi", "Profession", p.emploi, "Ex. technicien en microtechnique") + champ("p_", "data-profil", "employeur", "Employeur", p.employeur) +
      champ("p_", "data-profil", "depuis", "En poste depuis", p.depuis, "Ex. août 2024") +
      champ("p_", "data-profil", "personnes", "Personnes dans le ménage", p.personnes, "", "number") + champ("p_", "data-profil", "revenu", "Revenu mensuel brut du ménage (CHF)", p.revenu, "", "number") +
      champ("p_", "data-profil", "entree", "Date d'entrée souhaitée", p.entree, "Ex. 1er janvier 2027") +
      '</div><p class="note">Beaucoup de régies attendent un loyer qui ne dépasse pas environ un tiers du revenu brut. C\'est un seuil usuel, pas une règle légale.</p></section>' +
      '<section class="carte pad pile"><h2>Critères de recherche</h2><div class="grille">' +
      champ("c_", "data-crit", "loyerMax", "Loyer maximum (CHF)", c.loyerMax, "", "number") + champ("c_", "data-crit", "piecesMin", "Pièces minimum", c.piecesMin, "", "number") +
      '<div class="champ large"><label for="c_communes">Communes visées, séparées par une virgule</label><input id="c_communes" data-crit="communes" value="' + esc(c.communes) + '" placeholder="Ex. Carouge, Lancy, Genève"></div>' +
      '</div><p class="note">Ces critères alimentent le filtre « Selon mes critères » des logements.</p></section></div>' +
      '<section class="carte pad pile"><h2>Pièces à fournir</h2><div class="avance"><div class="jauge" aria-hidden="true"><i id="jauge"></i></div><b id="avance"></b></div><div class="coches">' + coches + "</div></section></div>" +
      '<section class="carte pad pile" id="lettreBox"><h2>Lettre de candidature</h2><p class="note">Le texte est construit avec le profil. Les passages entre crochets sont à compléter. Il reste modifiable avant la copie.</p>' +
      '<div class="champ"><label for="l_sel">Annonce concernée</label><select id="l_sel">' + opts + "</select></div>" +
      '<div class="champ"><label for="lettre">Texte</label><textarea id="lettre" rows="16"></textarea></div>' +
      '<div class="actions"><button type="button" class="btn plein" id="l_copier">Copier le texte</button><button type="button" class="btn" id="l_regen">Régénérer depuis le profil</button></div></section>' +
      '<section class="carte pad pile"><h2>Fiche de candidature</h2><p class="note">Toutes les rubriques que demandent les formulaires des régies, dans le même ordre. À garder ouverte pendant que vous remplissez un formulaire, ou à joindre à un e-mail.</p>' +
      '<textarea id="fiche" rows="14" readonly aria-label="Fiche de candidature"></textarea><div class="actions"><button type="button" class="btn plein" id="f_copier">Copier la fiche</button></div></section>' +
      '<section class="pile" id="formulaires"><h2>Formulaires des régies</h2><p class="note">Liens relevés sur le site de chaque régie. Chaque régie exige son propre formulaire, signé.</p><div class="carte lignes">' +
      REGIES.map(function (r) {
        return "<div><div><b>" + esc(r.nom) + "</b>" + r.docs.map(function (d) { return "<small>" + esc(d.t) + " · " + GENRE[d.k] + (d.n ? " · " + esc(d.n) : "") + "</small>"; }).join("") + '</div><div class="actions">' +
          r.docs.map(function (d, i) { return '<a class="btn petit' + (i ? "" : " plein") + '" href="' + esc(d.u) + '" target="_blank" rel="noopener noreferrer">' + (d.k === "ligne" ? "S\'inscrire" : d.k === "page" ? "Ouvrir" : "PDF") + "</a>"; }).join("") + "</div></div>";
      }).join("") + "</div></section>" +
      '<section class="carte pad pile"><h2>Mes données</h2><p class="note">' + (stockage ? "Profil, critères et candidatures sont enregistrés dans ce navigateur uniquement. Pour les retrouver sur un autre appareil, exportez le fichier ici puis importez-le là-bas." : "Ce navigateur refuse l'enregistrement local : les données seront perdues à la fermeture. Exportez-les pour les conserver.") + "</p>" +
      '<div class="actions"><button type="button" class="btn" id="d_export">Exporter mes données</button><label class="btn" for="d_import">Importer un fichier</label><input id="d_import" type="file" accept="application/json,.json" hidden>' +
      '<button type="button" class="btn discret" id="d_effacer">Tout effacer</button></div><textarea id="d_texte" rows="5" readonly hidden aria-label="Données exportées"></textarea></section>';
  }
  function avance() {
    var n = C.DOCS.filter(function (d) { return S.docs[d.k]; }).length, t = $("#avance"), j = $("#jauge");
    if (t) t.textContent = n + " / " + C.DOCS.length;
    if (j) j.style.width = Math.round(n / C.DOCS.length * 100) + "%";
  }
  function ecrireFiche() {
    var z = $("#fiche"); if (!z) return;
    var p = S.profil, v = function (x) { return x && String(x).trim() ? String(x).trim() : "à compléter"; }, rev = num(p.revenu);
    z.value = ["CANDIDAT", "Nom et prénom : " + v(p.nom), "Date de naissance : " + v(p.naissance), "Nationalité ou permis : " + v(p.nationalite), "État civil : " + v(p.situation),
      "Téléphone ou e-mail : " + v(p.contact), "", "LOGEMENT ACTUEL", "Adresse : " + v(p.adresse), "Régie ou bailleur : " + v(p.bailleur), "Loyer actuel : " + (num(p.loyerActuel) ? chf(num(p.loyerActuel)) : "à compléter"),
      "", "SITUATION PROFESSIONNELLE", "Profession : " + v(p.emploi), "Employeur : " + v(p.employeur), "En poste depuis : " + v(p.depuis), "Revenu mensuel brut du ménage : " + (rev ? chf(rev) : "à compléter"),
      "", "MÉNAGE", "Nombre de personnes : " + v(p.personnes), "Date d'entrée souhaitée : " + v(p.entree),
      "", "PIÈCES JOINTES", C.DOCS.filter(function (d) { return S.docs[d.k]; }).map(function (d) { return "- " + d.t; }).join("\n") || "aucune pièce cochée dans le dossier"].join("\n");
  }
  function ecrireLettre() {
    var ta = $("#lettre"); if (!ta) return;
    var p = S.profil, l = S.suivis.filter(function (x) { return x.id === lettrePour; })[0];
    var vide = function (v, h) { return v && String(v).trim() ? String(v).trim() : "[" + h + "]"; };
    var n = parseInt(p.personnes, 10) || 1, rev = num(p.revenu), o = [];
    o.push("Objet : candidature pour " + (l ? l.titre + (l.commune ? ", " + l.commune : "") : "[le logement concerné]"), "", "Madame, Monsieur,", "");
    o.push("Je vous écris au sujet du logement " + (l ? "« " + l.titre + " »" + (l.commune ? " à " + l.commune : "") : "[préciser le logement]") + (l && l.regie ? ", proposé par " + l.regie : "") + ". Il correspond à ma recherche et je souhaite déposer ma candidature.", "");
    var argent = rev > 0 ? " Le revenu mensuel brut de mon ménage est de " + chf(rev) + (l && l.loyer > 0 ? ", ce qui représente un taux d'effort de " + Math.round(l.loyer / rev * 100) + " % pour ce loyer" : "") + "." : " Le revenu mensuel brut de mon ménage est de [montant] CHF.";
    o.push("Je suis " + vide(p.situation, "situation") + ", " + vide(p.emploi, "emploi") + ". Mon ménage compte " + n + " personne" + (n > 1 ? "s" : "") + "." + argent, "");
    o.push("Mon dossier complet est prêt et je peux vous le transmettre immédiatement. Je suis disponible pour une visite et je peux emménager dès " + vide(p.entree, "date d'entrée") + ".", "");
    o.push("Je reste à votre disposition pour tout renseignement.", "", "Veuillez agréer, Madame, Monsieur, mes salutations distinguées.", "", vide(p.nom, "nom et prénom"), vide(p.contact, "téléphone ou e-mail"));
    ta.value = o.join("\n");
  }

  /* ---------- Vue : démarches ---------- */
  var ST_PROJ = { inscription: ["Inscription sur le site du projet", "ok"], cpeg: ["Pré-inscription CPEG", "info"] };
  function vueDemarches() {
    var gs = []; C.ACCES.forEach(function (a) { if (gs.indexOf(a.g) < 0) gs.push(a.g); });
    var acces = gs.map(function (g) {
      return '<div class="groupe">' + esc(g) + '</div><div class="cartes">' + C.ACCES.filter(function (a) { return a.g === g; }).map(function (a) {
        return '<article class="carte pad"><h3>' + esc(a.cat) + "</h3><p>" + esc(a.d) + '</p><div class="actions">' + a.liens.map(function (x) { return '<a class="btn petit" href="' + esc(x[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(x[0]) + "</a>"; }).join("") + "</div></article>";
      }).join("") + "</div>";
    }).join("");
    var puces = [["tous", "Tous"], ["inscription", "Site du projet"], ["cpeg", "CPEG"], ["suivis", "Suivis"]].map(function (s) { return '<button type="button" class="puce" data-fproj="' + s[0] + '" aria-pressed="' + (filtreProjet === s[0]) + '">' + s[1] + "</button>"; }).join("");
    var P = C.PROJETS.filter(function (p) { return filtreProjet === "tous" || (filtreProjet === "suivis" ? S.projets.indexOf(p.id) >= 0 : p.statut === filtreProjet); });
    var projets = C.GROUPES.map(function (g) {
      var L = P.filter(function (p) { return p.g === g[0]; }); if (!L.length) return "";
      return '<div class="groupe">Livraison : ' + esc(g[1]) + '</div><div class="cartes">' + L.map(function (p) {
        var on = S.projets.indexOf(p.id) >= 0, st = ST_PROJ[p.statut] || ["", ""];
        return '<article class="carte pad"><div class="actions"><span class="badge ' + st[1] + '">' + st[0] + "</span></div><h3>" + esc(p.nom) + "</h3><p>" + esc(p.commune) + ". " + esc(p.log) + ".</p><p>" + esc(p.cal) + (p.note ? " " + esc(p.note) : "") + "</p>" +
          '<div class="actions"><a class="btn petit plein" href="' + esc(p.insc[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(p.insc[0]) + '</a><a class="btn petit" href="' + esc(p.src[1]) + '" target="_blank" rel="noopener noreferrer">Source : ' + esc(p.src[0]) + "</a>" +
          '<button type="button" class="btn petit' + (on ? " actif" : "") + '" data-projet="' + esc(p.id) + '" aria-pressed="' + on + '">' + (on ? "Suivi" : "Suivre") + "</button></div></article>";
      }).join("") + "</div>";
    }).join("");
    return '<div class="tete"><h1>Démarches et projets neufs</h1><p>Les logements sociaux, subventionnés, des caisses de pension et des fondations ne sont pas publiés en annonces : ils s\'obtiennent par inscription, souvent valable un an et à renouveler.</p></div>' +
      '<h2>Inscriptions</h2>' + acces +
      '<h2 style="margin-top:1rem">Projets neufs avec inscription</h2><div class="puces" role="group" aria-label="Filtrer les projets">' + puces + "</div>" +
      (projets || '<p class="vide">Aucun projet dans ce filtre.</p>') +
      '<p class="note">Démarches et projets relevés à la main en octobre et novembre 2026 : ils ne sont pas mis à jour automatiquement. Vérifiez les conditions sur le site de chaque organisme.</p>';
  }

  /* ---------- Vue : sources ---------- */
  function vueSources() {
    var lignes = Object.keys(D.sources || {}).map(function (k) {
      var s = D.sources[k];
      var etatS = s.ok ? '<span class="badge ok">Lue ' + esc(ilya(temps(s.lu))) + "</span>" : '<span class="badge alerte">Lecture refusée' + (s.lu ? ", dernière réussie " + esc(ilya(temps(s.lu))) : "") + "</span>";
      return "<div><div><b>" + esc(s.nom || k) + "</b> " + etatS + "<small>" + (s.mode === "complet" ? "Lecture complète à chaque passage. " : "Lecture par tranches : quelques pages à chaque passage. ") + esc(s.note || "") + (s.erreur ? " Dernier refus : " + esc(s.erreur) + "." : "") + '</small></div><div class="chiffre">' + (s.n || 0) + "</div></div>";
    }).join("");
    var liens = C.LIENS.map(function (x) { return '<div><div><b>' + esc(x[0]) + "</b><small>" + esc(x[1]) + '</small></div><a class="btn petit" href="' + esc(x[2]) + '" target="_blank" rel="noopener noreferrer">Ouvrir</a></div>'; }).join("");
    return '<div class="tete"><h1>Sources et limites</h1><p>D\'où viennent les annonces, à quelle fréquence elles sont relues, et ce que Logéo ne lit pas.</p></div>' +
      '<section class="carte lignes">' + (lignes || '<p class="vide">Aucune source chargée.</p>') + "</section>" +
      '<section class="carte pad texte"><h2>Fonctionnement</h2>' +
      "<p>Une collecte automatique relit les sources toutes les 30 minutes environ et publie un fichier d'annonces. Cette page le recharge toutes les " + RELEVE_MIN + " minutes, sans action de votre part. " + (charge ? "Dernière collecte : <b>" + esc(new Date(temps(D.genere)).toLocaleString("fr-CH")) + "</b>." : "") + "</p>" +
      "<p><b>flatfox.ch</b> met ses annonces à disposition par une interface publique : tout le canton est relu à chaque passage, particuliers compris.</p>" +
      "<p><b>immobilier.ch</b>, le portail des régies romandes, limite la lecture automatisée. Logéo respecte cette limite : la première page et quelques suivantes à chaque passage, et arrêt immédiat si le site refuse. Un tour complet prend plusieurs heures, une annonce retirée peut donc rester affichée un moment.</p>" +
      "<p>Une annonce présente sur les deux sites n'est comptée qu'une fois. Le badge « Nouveau » date de la première lecture par Logéo, pas de la publication.</p>" +
      "<p>Non lus : Homegate, ImmoScout24, comparis, anibis et tutti, qui interdisent ou bloquent la lecture automatisée, ainsi que la plateforme de la CPEG. Leurs alertes e-mail restent le moyen le plus rapide d'être prévenu chez eux.</p></section>" +
      '<h2>À consulter directement</h2><section class="carte lignes">' + liens + "</section>" +
      '<p class="note">Taux de vacance des logements à Genève : 0,31 % au 1er juin 2026, contre 0,34 % un an plus tôt (<a href="' + esc(C.VACANCE) + '" target="_blank" rel="noopener noreferrer">immobilier.ch, 22 juillet 2026</a>).</p>';
  }

  /* ---------- Navigation ---------- */
  var VUES = { logements: vueLogements, suivi: vueSuivi, dossier: vueDossier, demarches: vueDemarches, sources: vueSources };
  function vueActive() { var h = location.hash.replace("#", ""); return VUES[h] ? h : "logements"; }
  function rendre(garder) {
    var v = vueActive(), box = $("#vue");
    var y = window.scrollY, actif = document.activeElement && document.activeElement.id, pos = null;
    try { if (actif && document.activeElement.selectionStart != null) pos = document.activeElement.selectionStart; } catch (e) {}
    if (garder && v !== "logements" && v !== "sources" && v !== "suivi") { majOnglets(v); return; }   // on ne réécrit pas un formulaire en cours de saisie
    fermerCarte();
    box.innerHTML = VUES[v]();
    if (v === "logements") rendreListe();
    if (v === "suivi") rendreSuivi();
    if (v === "dossier") { avance(); ecrireLettre(); ecrireFiche(); }
    majOnglets(v);
    if (garder) {
      window.scrollTo(0, y);
      var e = actif && document.getElementById(actif);
      if (e) { e.focus(); try { if (pos != null) e.setSelectionRange(pos, pos); } catch (err) {} }
    }
  }
  function majOnglets(v) {
    $$("#tabs a").forEach(function (a) { if (a.dataset.tab === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    var n = $("#nSuivi"), c = S.suivis.length; n.hidden = !c; n.textContent = c;
    document.title = v === "logements" ? "Logéo" : "Logéo · " + { suivi: "Candidatures", dossier: "Dossier", demarches: "Démarches", sources: "Sources" }[v];
  }

  var tToast = null;
  function toast(msg, action, fn) {
    var h = $("#toast"); clearTimeout(tToast);
    h.innerHTML = "<div><span>" + esc(msg) + "</span>" + (action ? '<button type="button">' + esc(action) + "</button>" : "") + "</div>";
    if (action) h.querySelector("button").onclick = function () { h.innerHTML = ""; fn(); };
    tToast = setTimeout(function () { h.innerHTML = ""; }, 6000);
  }

  /* ---------- Événements ---------- */
  var tSaisie = null;
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "f_q" || t.id === "f_max") {
      F[t.id === "f_q" ? "q" : "max"] = t.value; affiches = PAGE;
      clearTimeout(tSaisie); tSaisie = setTimeout(function () { sauver(); rendreListe(); }, 180);
    } else if (t.dataset.profil) { S.profil[t.dataset.profil] = t.value; sauver(); }
    else if (t.dataset.crit) { S.crit[t.dataset.crit] = t.value; sauver(); }
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "f_com") { F.com = t.value; affiches = PAGE; sauver(); rendreListe(); }
    else if (t.id === "f_qui") { F.qui = t.value; affiches = PAGE; sauver(); rendreListe(); }
    else if (t.id === "f_tri") { F.tri = t.value; affiches = PAGE; sauver(); rendreListe(); }
    else if (t.id === "s_tri") { triSuivi = t.value; rendreSuivi(); }
    else if (t.id === "l_sel") { lettrePour = t.value; ecrireLettre(); }
    else if (t.dataset.doc) { S.docs[t.dataset.doc] = t.checked; sauver(); avance(); ecrireFiche(); }
    else if (t.dataset.profil || t.dataset.crit) { ecrireLettre(); ecrireFiche(); }
    else if (t.dataset.act === "statut" || t.dataset.act === "visite") {
      var id = t.closest("[data-id]").dataset.id, l = S.suivis.filter(function (x) { return x.id === id; })[0]; if (!l) return;
      if (t.dataset.act === "statut") l.statut = t.value; else l.visite = t.value;
      sauver(); rendreSuivi();
    } else if (t.id === "d_import" && t.files && t.files[0]) {
      var fr = new FileReader();
      fr.onload = function () {
        try { var lu = JSON.parse(fr.result); if (!lu || typeof lu !== "object" || (!lu.profil && !lu.suivis)) throw 0; S = fusion(defauts(), lu); F = S.filtres; sauver(); rendre(); toast("Données importées"); }
        catch (err) { toast("Ce fichier n'est pas un export Logéo"); }
      };
      fr.readAsText(t.files[0]);
    }
  });
  document.addEventListener("submit", function (e) {
    if (e.target.id !== "fAjout") return;
    e.preventDefault();
    S.suivis.push({ id: uid(), ref: "", titre: $("#a_titre").value.trim(), commune: $("#a_commune").value.trim(), loyer: num($("#a_loyer").value), pieces: num($("#a_pieces").value), surface: num($("#a_surface").value),
      regie: $("#a_regie").value.trim(), lien: lien($("#a_lien").value), statut: $("#a_statut").value, visite: "", cree: Date.now() });
    sauver(); e.target.reset(); $("#ajout").open = false; filtreSuivi = "tous"; rendreSuivi(); majOnglets("suivi"); toast("Annonce ajoutée au suivi");
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, [data-suivre]"); if (!t) return;
    if (t.id === "etat") { actualiser(true); return; }
    if (t.dataset.fcat != null) { F.cat = t.dataset.fcat; affiches = PAGE; sauver(); rendre(true); return; }
    if (t.dataset.vue) { F.vue = t.dataset.vue; sauver(); rendre(true); return; }
    if (t.dataset.fp) { F.p = t.dataset.fp; affiches = PAGE; sauver(); rendre(true); return; }
    if (t.dataset.bascule) {
      var k = t.dataset.bascule;
      if (k === "crit" && !F.crit && !num(S.crit.loyerMax) && !num(S.crit.piecesMin) && !String(S.crit.communes).trim()) { toast("Saisissez d'abord vos critères dans le dossier", "Ouvrir", function () { location.hash = "#dossier"; }); return; }
      F[k] = !F[k]; affiches = PAGE; sauver(); rendre(true); return;
    }
    if (t.hasAttribute("data-raz")) { S.filtres = F = Object.assign(defauts().filtres, { tri: F.tri }); affiches = PAGE; sauver(); rendre(); return; }
    if (t.id === "plus") { affiches += PAGE; rendreListe(); return; }
    if (t.dataset.suivre) {
      var id = t.dataset.suivre, l = PARID[id]; if (!l) return;
      if (suivi(id)) { S.suivis = S.suivis.filter(function (x) { return x.ref !== id; }); toast("Retirée du suivi"); }
      else {
        S.suivis.push({ id: uid(), ref: id, titre: l.t || "Logement à louer", commune: l.com, loyer: total(l) || 0, pieces: l.p || 0, surface: l.s || 0, regie: l.ag || "", lien: l.u, statut: "a_postuler", visite: "", cree: Date.now() });
        toast("Ajoutée à vos candidatures", "Ouvrir", function () { location.hash = "#suivi"; });
      }
      sauver(); rendreListe(); majOnglets(vueActive()); return;
    }
    if (t.dataset.etape) { filtreSuivi = t.dataset.etape; rendreSuivi(); return; }
    if (t.dataset.act === "retirer" || t.dataset.act === "lettre") {
      var cid = t.closest("[data-id]").dataset.id;
      if (t.dataset.act === "lettre") { lettrePour = cid; location.hash = "#dossier"; setTimeout(function () { var b = $("#lettreBox"); if (b) b.scrollIntoView(); }, 30); return; }
      var i = S.suivis.findIndex(function (x) { return x.id === cid; }), ote = S.suivis.splice(i, 1)[0];
      sauver(); rendreSuivi(); majOnglets("suivi");
      toast("Annonce retirée", "Annuler", function () { S.suivis.splice(i, 0, ote); sauver(); rendreSuivi(); majOnglets("suivi"); });
      return;
    }
    if (t.dataset.fproj) { filtreProjet = t.dataset.fproj; rendre(true); return; }
    if (t.dataset.projet) { var pi = S.projets.indexOf(t.dataset.projet); if (pi >= 0) S.projets.splice(pi, 1); else S.projets.push(t.dataset.projet); sauver(); rendre(true); return; }
    if (t.id === "l_regen") { ecrireLettre(); toast("Lettre régénérée"); return; }
    if (t.id === "l_copier" || t.id === "f_copier") {
      var ta = $(t.id === "l_copier" ? "#lettre" : "#fiche"), fin = function () { ta.focus(); ta.select(); toast("Texte sélectionné : copiez-le avec le menu de votre appareil"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { toast("Texte copié"); }, fin); else fin();
      return;
    }
    if (t.id === "d_export") {
      var txt = JSON.stringify(S, null, 1), nom = "logeo-mes-donnees.json";
      try {
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "application/json" })); a.download = nom;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      } catch (err) {}
      var z = $("#d_texte"); z.hidden = false; z.value = txt;
      toast("Fichier " + nom + " créé. Le texte est aussi affiché ci-dessous.");
      return;
    }
    if (t.id === "d_effacer") {
      if (t.dataset.sur !== "1") { t.dataset.sur = "1"; t.textContent = "Confirmer l'effacement"; t.classList.add("actif"); return; }
      S = defauts(); F = S.filtres; sauver(); rendre(); toast("Données effacées");
    }
  });
  window.addEventListener("hashchange", function () { affiches = PAGE; rendre(); window.scrollTo(0, 0); var m = $("#vue"); if (m) m.focus({ preventScroll: true }); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && (!charge || Date.now() - dernierReleve > 60000)) releve(); });
  window.addEventListener("online", function () { releve(); });

  /* ---------- Démarrage ---------- */
  var dernierReleve = 0;
  function releve() { dernierReleve = Date.now(); actualiser(false); }
  rendre();
  releve();
  setInterval(function () { if (!document.hidden) releve(); }, RELEVE_MIN * 60000);
  setInterval(etat, 30000);
  window.addEventListener("pagehide", function () { if (charge) { S.visite = Date.now(); sauver(); } });
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) { try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {} }
})();
