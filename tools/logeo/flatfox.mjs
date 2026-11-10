// flatfox.ch : interface publique (JSON). Lecture complète du canton à chaque passage.
import { NPA, commune } from "./communes.mjs";

const API = "https://flatfox.ch/api/v1";
const CANTON = { west: 5.95, east: 6.32, south: 46.12, north: 46.37 };
const TYPES = { APARTMENT: "app", HOUSE: "maison", SHARED: "coloc" };

async function pins(get, box, depth = 0) {
  const q = `west=${box.west}&east=${box.east}&south=${box.south}&north=${box.north}&max_count=1000`;
  const list = await get(`${API}/pin/?${q}`);
  if (!Array.isArray(list)) throw new Error("réponse inattendue de flatfox (pin)");
  if (list.length < 1000 || depth >= 4) return list;
  // Zone saturée : on la coupe en quatre.
  const mx = (box.west + box.east) / 2, my = (box.south + box.north) / 2, out = [];
  for (const b of [
    { west: box.west, east: mx, south: box.south, north: my }, { west: mx, east: box.east, south: box.south, north: my },
    { west: box.west, east: mx, south: my, north: box.north }, { west: mx, east: box.east, south: my, north: box.north }
  ]) out.push(...await pins(get, b, depth + 1));
  return out;
}

function dispo(r) {
  if (r.moving_date_type === "imm") return "De suite";
  if (r.moving_date_type === "agr") return "À convenir";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r.moving_date || "");
  return m ? `${+m[3]}.${m[2]}.${m[1]}` : "";
}

export async function lireFlatfox(get) {
  const ids = [...new Set((await pins(get, CANTON)).map(p => p.pk))];
  const out = [];
  for (let i = 0; i < ids.length; i += 60) {
    const part = ids.slice(i, i + 60);
    const d = await get(`${API}/public-listing/?limit=100&` + part.map(k => "pk=" + k).join("&"));
    for (const r of d.results || []) {
      const k = TYPES[r.object_category];
      if (!k || r.offer_type !== "RENT" || r.status !== "act" || r.reserved) continue;
      if (!NPA[r.zipcode]) continue;
      const loyer = r.rent_gross || r.price_display || r.rent_net || null;
      if (loyer != null && loyer < 300) continue;                // places de parc mal classées
      const p = parseFloat(r.number_of_rooms) || null;
      out.push({
        id: "ff-" + r.pk, src: "flatfox", ag: (r.agency && r.agency.name) || "",
        t: (r.description_title || r.short_title || "").trim().slice(0, 140),
        k, p, s: r.surface_living || null,
        l: loyer, ch: r.rent_gross && r.rent_charges ? r.rent_charges : null, ci: !!(r.rent_gross || r.price_display_type === "TOTAL"),
        npa: r.zipcode, loc: r.city || "", com: commune(r.city, r.zipcode) || NPA[r.zipcode],
        adr: (r.street || "").trim(), d: dispo(r), meuble: !!r.is_furnished, temp: !!r.is_temporary,
        u: "https://flatfox.ch" + String(r.url || r.short_url || "").replace(/^\/en\//, "/fr/"),
        la: r.latitude ? +r.latitude.toFixed(4) : null, lo: r.longitude ? +r.longitude.toFixed(4) : null,
        pub: r.published || r.created || null
      });
    }
  }
  return { items: out, complet: true, note: ids.length + " objets dans la zone, " + out.length + " logements à louer dans le canton" };
}
