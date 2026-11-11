// Classement des annonces. Ordre de priorité : sous-location, colocation, chambre, maison, studio, appartement.
const sansAccent = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const SOUS_LOC = /sous[- ]?lo(cation|uer|ue)|sublet|subletting|sublease|untermiet/;
const COLOC = /\bcoloc|colocation|co-?living|flat ?share|shared (flat|apartment|house)|a partager|wohngemeinschaft|\bwg\b|roommate|flatmate/;
const CHAMBRE = /^chambre|chambre (meublee|a louer|dans|chez|en |individuelle|privee|pour|independante|etudiant)|\broom (in|for|to)\b|single room|private room|furnished room|^zimmer/;
const STUDIO = /\bstudio\b|\bstudette\b/;

// base : "app", "maison" ou "coloc" selon la source. extra : texte complémentaire (description), jamais publié.
export function classer(x, extra) {
  const titre = sansAccent([x.t, x.ty].join(" ")), tout = titre + " " + sansAccent(extra);
  if (SOUS_LOC.test(tout) || x.temp) return "sousloc";
  if (x.k === "coloc" || COLOC.test(titre)) return "coloc";
  if (x.chambre || CHAMBRE.test(titre)) return "chambre";
  if (x.k === "maison") return "maison";
  if (STUDIO.test(titre) || (x.p != null && x.p <= 1.5)) return "studio";
  return "app";
}
