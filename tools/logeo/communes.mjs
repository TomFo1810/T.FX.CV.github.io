// Canton de Genève : numéros postaux et rattachement des localités aux communes.
export const NPA = {
  1200: "Genève", 1201: "Genève", 1202: "Genève", 1203: "Genève", 1204: "Genève", 1205: "Genève", 1206: "Genève",
  1207: "Genève", 1208: "Genève", 1209: "Genève", 1211: "Genève", 1212: "Lancy", 1213: "Onex", 1214: "Vernier",
  1215: "Grand-Saconnex", 1216: "Meyrin", 1217: "Meyrin", 1218: "Grand-Saconnex", 1219: "Vernier", 1220: "Vernier",
  1222: "Collonge-Bellerive", 1223: "Cologny", 1224: "Chêne-Bougeries", 1225: "Chêne-Bourg", 1226: "Thônex",
  1227: "Carouge", 1228: "Plan-les-Ouates", 1231: "Chêne-Bougeries", 1232: "Confignon", 1233: "Bernex",
  1234: "Veyrier", 1236: "Cartigny", 1237: "Avully", 1239: "Collex-Bossy", 1241: "Puplinge", 1242: "Satigny",
  1243: "Presinge", 1244: "Choulex", 1245: "Collonge-Bellerive", 1246: "Corsier", 1247: "Anières", 1248: "Hermance",
  1251: "Gy", 1252: "Meinier", 1253: "Vandœuvres", 1254: "Jussy", 1255: "Veyrier", 1256: "Troinex",
  1257: "Bardonnex", 1258: "Perly-Certoux", 1281: "Russin", 1283: "Dardagny", 1284: "Chancy", 1285: "Avusy",
  1286: "Soral", 1287: "Laconnex", 1288: "Aire-la-Ville", 1290: "Versoix", 1292: "Pregny-Chambésy",
  1293: "Bellevue", 1294: "Genthod", 1298: "Céligny"
};

const LOCALITES = {
  "geneve": "Genève", "geneva": "Genève", "genf": "Genève", "petit-saconnex": "Genève", "champel": "Genève",
  "eaux-vives": "Genève", "paquis": "Genève", "plainpalais": "Genève", "servette": "Genève", "jonction": "Genève",
  "carouge": "Carouge", "carouge ge": "Carouge", "acacias": "Carouge", "les acacias": "Carouge",
  "lancy": "Lancy", "petit-lancy": "Lancy", "grand-lancy": "Lancy", "onex": "Onex",
  "vernier": "Vernier", "chatelaine": "Vernier", "le lignon": "Vernier", "lignon": "Vernier", "aire": "Vernier",
  "les avanchets": "Vernier", "avanchets": "Vernier",
  "meyrin": "Meyrin", "cointrin": "Meyrin", "grand-saconnex": "Grand-Saconnex", "le grand-saconnex": "Grand-Saconnex",
  "collonge-bellerive": "Collonge-Bellerive", "vesenaz": "Collonge-Bellerive", "cologny": "Cologny",
  "chene-bougeries": "Chêne-Bougeries", "conches": "Chêne-Bougeries", "chene-bourg": "Chêne-Bourg", "thonex": "Thônex",
  "plan-les-ouates": "Plan-les-Ouates", "confignon": "Confignon", "bernex": "Bernex", "lully": "Bernex",
  "veyrier": "Veyrier", "vessy": "Veyrier", "cartigny": "Cartigny", "avully": "Avully",
  "collex-bossy": "Collex-Bossy", "collex": "Collex-Bossy", "bossy": "Collex-Bossy", "puplinge": "Puplinge",
  "satigny": "Satigny", "presinge": "Presinge", "choulex": "Choulex", "corsier": "Corsier", "corsier ge": "Corsier",
  "anieres": "Anières", "hermance": "Hermance", "gy": "Gy", "meinier": "Meinier", "vandoeuvres": "Vandœuvres",
  "jussy": "Jussy", "troinex": "Troinex", "bardonnex": "Bardonnex", "croix-de-rozon": "Bardonnex",
  "la croix-de-rozon": "Bardonnex", "perly": "Perly-Certoux", "perly-certoux": "Perly-Certoux", "certoux": "Perly-Certoux",
  "russin": "Russin", "dardagny": "Dardagny", "la plaine": "Dardagny", "chancy": "Chancy", "avusy": "Avusy",
  "athenaz": "Avusy", "athenaz (avusy)": "Avusy", "sezegnin": "Avusy", "soral": "Soral", "laconnex": "Laconnex",
  "aire-la-ville": "Aire-la-Ville", "versoix": "Versoix", "pregny-chambesy": "Pregny-Chambésy",
  "chambesy": "Pregny-Chambésy", "pregny": "Pregny-Chambésy", "bellevue": "Bellevue", "genthod": "Genthod",
  "celigny": "Céligny"
};

export function cle(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe")
    .replace(/[’']/g, "-").replace(/\s+/g, " ").trim();
}

// Renvoie la commune genevoise, ou null si la localité est hors canton.
export function commune(localite, npa) {
  const k = cle(localite).replace(/ ge$/, "");
  if (LOCALITES[k]) return LOCALITES[k];
  if (LOCALITES[k.replace(/ /g, "-")]) return LOCALITES[k.replace(/ /g, "-")];
  if (npa && NPA[npa]) return NPA[npa];
  return null;
}
