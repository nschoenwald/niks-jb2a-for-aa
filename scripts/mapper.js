/**
 * Maps the JB2A Sequencer database onto the Automated Animations database.
 *
 * Pure functions without Foundry globals, so the mapping can be run and checked in Node.
 *
 * AA's database has a fixed shape: section → type → animation → variant → color → [files]
 * (range and return: color → { "05ft": [files], … }). JB2A's database has a free shape with 2–8 keys per path.
 * Each JB2A file that AA doesn't know yet is placed by its folder in the JB2A library (section and type) and by
 * its keys (animation = first key, color = the last key that names a color, variant = the rest).
 */

const LIBRARY = "Library/";
const DISTANCE = /^\d+ft$/;
const COLOR_WORD = "red|blue|green|yellow|orange|purple|pink|white|black|grey|gray|brown|teal|cyan|magenta|gold|silver|"
   + "rainbow|multicolou?r(?:ed)?|multi|violet|lime|indigo|maroon|aqua|bronze|copper";
const COLOR = new RegExp(`^(?:(?:dark|light|bright|pale|deep|neon)?(?:${COLOR_WORD}))+\\d*$`);

/** Folders under Library/ that are not animations (TokenMagic textures). */
const SKIPPED_FOLDERS = ["TMFX"];

/** Generic/<Folder> → AA static type, where AA already has a type for it. Other folders get their own type. */
const STATIC_TYPES = {
   Conditions: "conditions", Creature: "creature", Energy: "energy", Eyes: "eyes", Fire: "fire", Ice: "ice",
   Impact: "impact", Lightning: "lightning", Liquid: "liquid", Magic_Signs: "magicsign", Marker: "marker",
   Nature: "nature", Particles: "particles", RangedSpell: "spell", Smoke: "smoke", Token_Border: "tokenborder",
   Traps: "trap",
};

const TEMPLATE_TYPES = { Circle: "circle", Cone: "cone", Line: "ray", Square: "square" };

/** JB2A templates of projectiles that stretch from source to target. Other templates with distances are cones/lines on the ground. */
const RANGE_TEMPLATES = new Set(["ranged", "line200", "line200B"]);

export const SECTIONS = ["range", "return", "melee", "static", "templatefx"];

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const toArray = (v) => (Array.isArray(v) ? v : [v]);
const flatKey = (k) => String(k).toLowerCase().replace(/[_\s.]/g, "");
const relPath = (file) => (file.includes(LIBRARY) ? file.slice(file.indexOf(LIBRARY) + LIBRARY.length) : file);

export function isColor(key) {
   return COLOR.test(flatKey(key));
}

/** "dark_red" → "Dark Red", "bluepurple" → "Blue Purple", "hard_edge_01" → "Hard Edge 01". */
export function humanize(key) {
   const colorSplit = new RegExp(`(dark|light|bright|pale|deep|neon|${COLOR_WORD})`, "g");
   const words = String(key).split(/[_\s]+/).flatMap((part) => {
      if (isColor(part)) { return part.toLowerCase().split(colorSplit).filter(Boolean); }
      return part.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ");
   });
   return words.filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** All library-relative file paths in a database. */
export function collectFiles(node, out = new Set()) {
   if (typeof node === "string") { out.add(relPath(node)); }
   else if (Array.isArray(node)) { node.forEach((n) => collectFiles(n, out)); }
   else if (isObject(node)) {
      for (const [k, v] of Object.entries(node)) { if (!k.startsWith("_")) { collectFiles(v, out); } }
   }
   return out;
}

/** Every leaf of the JB2A database with the keys leading to it and the inherited metadata. */
export function* jb2aLeaves(db) {
   function* walk(node, keys, meta) {
      if (typeof node === "string" || Array.isArray(node)) { yield { keys, files: toArray(node), ...meta }; return; }
      if (!isObject(node)) { return; }
      if (typeof node.file === "string" || Array.isArray(node.file)) { yield { keys, files: toArray(node.file), ...meta }; return; }
      const next = { ...meta };
      if (node._template) { next.template = node._template; }
      if (node._markers) { next.markers = node._markers; }
      if (node._metadata?.name && keys.length === 1) { next.name = node._metadata.name; }
      for (const [k, v] of Object.entries(node)) {
         if (!k.startsWith("_")) { yield* walk(v, [...keys, k], next); }
      }
   }
   for (const [k, v] of Object.entries(db)) {
      if (!k.startsWith("_")) { yield* walk(v, [k], {}); }
   }
}

/** Section and type for a JB2A leaf, from its library folder, template and keys. */
export function classify({ files, template, keys }) {
   const parts = relPath(files[0]).split("/");
   const [top, folder, sub] = parts;
   const hasDistance = DISTANCE.test(keys.at(-1));
   const isReturn = keys.includes("return") || /_Return_/.test(files[0]);
   const isTemplateFolder = top === "Generic" && folder === "Template";

   if (hasDistance && !isTemplateFolder && (!template || RANGE_TEMPLATES.has(template))) {
      const type = folder === "Weapon_Attacks" ? "weapon"
         : top !== "Generic" || folder === "RangedSpell" ? "spell" : "generic";
      return { section: isReturn ? "return" : "range", type: isReturn ? "weapon" : type };
   }
   if (template?.startsWith("melee")) {
      const type = folder === "Weapon_Attacks" ? "weapon" : folder === "Creature" ? "creature" : "generic";
      return { section: "melee", type };
   }
   if (isTemplateFolder) { return { section: "templatefx", type: TEMPLATE_TYPES[sub] ?? flatKey(sub ?? "generic") }; }
   if (template?.startsWith("cone")) { return { section: "templatefx", type: "cone" }; }
   if (template === "ray" || template?.startsWith("line")) { return { section: "templatefx", type: "ray" }; }
   if (template === "side_impact") { return { section: "static", type: "sideImpact" }; }
   if (top !== "Generic") { return { section: "static", type: "spell" }; }
   return { section: "static", type: STATIC_TYPES[folder] ?? flatKey(folder) };
}

/** Animation, variant, color and distance keys for a JB2A leaf. */
export function splitKeys(keys, section) {
   const rest = keys.slice(1).filter((k) => k !== "return");
   const distance = DISTANCE.test(rest.at(-1)) ? rest.pop() : null;
   let colorIndex = -1;
   for (let i = rest.length - 1; i >= 0; i--) { if (isColor(rest[i])) { colorIndex = i; break; } }
   let color;
   if (colorIndex >= 0) { color = rest.splice(colorIndex, 1)[0]; }
   else { color = rest.length ? rest.pop() : "default"; }
   const variantParts = rest.map((k) => String(k).toLowerCase());
   const isRange = section === "range" || section === "return";
   if (distance && !isRange) { variantParts.push(distance); }
   return {
      animation: flatKey(keys[0]),
      animationRaw: keys[0],
      variant: variantParts.join("_") || "01",
      color: flatKey(color),
      colorRaw: color,
      distance: isRange ? distance : null,
   };
}

const sameFiles = (a, b) => Array.isArray(a) && a.length === b.length && a.every((f, i) => relPath(f) === relPath(b[i]));
const isRangeSection = (section) => section === "range" || section === "return";
const isReturnLeaf = (leaf) => leaf.keys.includes("return") || /_Return_/.test(leaf.files[0]);

/**
 * JB2A group of a leaf: its keys without color and distance. Leaves of one group are colors of the same animation,
 * so AA keeps them in one place, though often under its own names (JB2A fireball.beam → AA range.spell.fireballbeam.01).
 */
function groupOf(keys) {
   const rest = keys.slice(1);
   const isReturn = rest.includes("return");
   const parts = rest.filter((k) => k !== "return" && !DISTANCE.test(k));
   let colorIndex = -1;
   for (let i = parts.length - 1; i >= 0; i--) { if (isColor(parts[i])) { colorIndex = i; break; } }
   parts.splice(colorIndex >= 0 ? colorIndex : parts.length - 1, 1);
   return `${isReturn ? "return:" : ""}${keys[0]}|${parts.join("|")}`;
}

/** Library path → every place AA keeps that file: { section, type, animation, variant, color, distance }. */
function indexLocations(aaDb) {
   const index = new Map();
   const add = (files, loc) => {
      for (const f of toArray(files)) {
         if (typeof f !== "string") { continue; }
         const rel = relPath(f);
         if (!index.has(rel)) { index.set(rel, []); }
         index.get(rel).push(loc);
      }
   };
   const entries = (node) => Object.entries(node ?? {}).filter(([k, v]) => !k.startsWith("_") && isObject(v));
   for (const section of SECTIONS) {
      for (const [type, typeNode] of entries(aaDb[section])) {
         for (const [animation, animNode] of entries(typeNode)) {
            for (const [variant, variantNode] of entries(animNode)) {
               for (const [color, leaf] of Object.entries(variantNode)) {
                  if (color.startsWith("_")) { continue; }
                  const loc = { section, type, animation, variant, color, distance: null };
                  if (isObject(leaf)) {
                     for (const [k, v] of Object.entries(leaf)) { if (!k.startsWith("_")) { add(v, { ...loc, distance: k }); } }
                  } else { add(leaf, loc); }
               }
            }
         }
      }
   }
   return index;
}

/**
 * Add every JB2A file that the AA database doesn't contain yet. Mutates `aaDb`.
 * A new color of a JB2A group that AA already has goes next to AA's other colors of that group. Everything else
 * is placed by its library folder (see classify() and splitKeys()). A return version goes into AA's return section
 * under exactly the names of its throw version, because AA looks it up that way (and only for range weapons).
 * @param {object} jb2aDb   JB2A's database (as built by its jb2a_sequencer.js)
 * @param {object} aaDb     AA's database (the object passed to the `aa.ready` hook)
 * @returns {{ added: object, skipped: number, besideAA: number, unplaced: number, labels: object, templates: Set<string> }}
 */
export function extendDatabase(jb2aDb, aaDb) {
   const known = collectFiles(aaDb);
   const added = Object.fromEntries(SECTIONS.map((s) => [s, 0]));
   const labels = { menuTypes: {}, animations: {}, variants: {}, colors: {} };
   const templates = new Set();
   let skipped = 0;
   let besideAA = 0;
   let unplaced = 0;

   const child = (node, key) => (node[key] ??= {});
   const all = [...jb2aLeaves(jb2aDb)].filter((leaf) => !SKIPPED_FOLDERS.includes(relPath(leaf.files[0]).split("/")[0]));
   // Return versions last: they go where their throw version ended up.
   const leaves = [...all.filter((l) => !isReturnLeaf(l)), ...all.filter(isReturnLeaf)];
   /** JB2A keys of a range leaf → where it is in AA's range section. */
   const rangePlaces = new Map();

   // Where AA keeps the groups it knows.
   const locations = indexLocations(aaDb);
   const groupLocations = new Map();
   for (const leaf of leaves) {
      const locs = locations.get(relPath(leaf.files[0]));
      if (!locs) { continue; }
      const group = groupOf(leaf.keys);
      if (!groupLocations.has(group)) { groupLocations.set(group, new Map()); }
      for (const { section, type, animation, variant } of locs) {
         groupLocations.get(group).set(`${section}.${type}.${animation}.${variant}`, { section, type, animation, variant });
      }
      const rangeLoc = locs.find((loc) => loc.section === "range" && loc.distance);
      if (rangeLoc) { rangePlaces.set(leaf.keys.join("|"), rangeLoc); }
   }

   /** Put the leaf into an existing AA place if the slot is free. Returns false if it isn't. */
   const placeAt = (loc, color, distance, files) => {
      if (isRangeSection(loc.section) !== !!distance) { return false; }
      const variantNode = aaDb[loc.section]?.[loc.type]?.[loc.animation]?.[loc.variant];
      if (!isObject(variantNode)) { return false; }
      if (distance) {
         const slot = variantNode[color]?.[distance];
         if (slot !== undefined && !sameFiles(slot, files)) { return false; }
         child(variantNode, color)[distance] = [...files];
      } else {
         if (variantNode[color] !== undefined && !sameFiles(variantNode[color], files)) { return false; }
         variantNode[color] = [...files];
      }
      return true;
   };

   for (const leaf of leaves) {
      const rel = relPath(leaf.files[0]);
      if (leaf.files.every((f) => known.has(relPath(f)))) { skipped++; continue; }

      if (isReturnLeaf(leaf)) {
         // JB2A names a return version like its throw version, with "return" for "throw" (or added to the keys).
         const throwPlace = rangePlaces.get(leaf.keys.map((key) => (key === "return" ? "throw" : key)).join("|"))
            ?? rangePlaces.get(leaf.keys.filter((key) => key !== "return").join("|"));
         if (throwPlace?.type !== "weapon") { unplaced++; continue; }
         const colorNode = child(child(child(child(child(aaDb, "return"), "weapon"), throwPlace.animation), throwPlace.variant), throwPlace.color);
         const slot = colorNode[throwPlace.distance];
         // AA already has a return version for this throw: keep AA's.
         if (slot !== undefined && !sameFiles(slot, leaf.files)) { unplaced++; continue; }
         colorNode[throwPlace.distance] = [...leaf.files];
         leaf.files.forEach((f) => known.add(relPath(f)));
         added.return++;
         continue;
      }

      const own = classify(leaf);
      const k = splitKeys(leaf.keys, own.section);
      const rawDistance = DISTANCE.test(leaf.keys.at(-1)) ? leaf.keys.at(-1) : null;

      const besideLocs = [...(groupLocations.get(groupOf(leaf.keys))?.values() ?? [])];
      const placed = besideLocs.filter((loc) => placeAt(loc, k.color, rawDistance, leaf.files));
      if (placed.length) {
         const rangeLoc = placed.find((loc) => loc.section === "range");
         if (rangeLoc && rawDistance) { rangePlaces.set(leaf.keys.join("|"), { ...rangeLoc, color: k.color, distance: rawDistance }); }
         besideAA++;
         added[placed[0].section]++;
         labels.colors[k.color] ??= humanize(k.colorRaw);
         leaf.files.forEach((f) => known.add(relPath(f)));
         continue;
      }

      const { section, type } = own;
      const isRange = !!k.distance;
      const typeNode = child(child(aaDb, section), type);
      // JB2A and AA sometimes differ only in plural ("energy_strands" / AA "energystrand"): use AA's animation.
      const animation = typeNode[k.animation] ? k.animation
         : [k.animation.replace(/s$/, ""), `${k.animation}s`].find((key) => key !== k.animation && isObject(typeNode[key])) ?? k.animation;
      const animNode = child(typeNode, animation);

      // Find a variant slot where this color (and distance) is free or already holds these files.
      let variant = k.variant;
      for (let n = 2; ; n++) {
         const existing = animNode[variant]?.[k.color];
         const slot = isRange ? existing?.[k.distance] : existing;
         if (slot === undefined || sameFiles(slot, leaf.files)) { break; }
         variant = `${k.variant}_${n}`;
      }

      const variantNode = child(animNode, variant);
      if (isRange) {
         if (section === "range") { rangePlaces.set(leaf.keys.join("|"), { type, animation, variant, color: k.color, distance: k.distance }); }
         const colorNode = child(variantNode, k.color);
         colorNode[k.distance] = [...leaf.files];
         if (leaf.template && !colorNode._template) { colorNode._template = leaf.template; templates.add(leaf.template); }
      } else {
         variantNode[k.color] = [...leaf.files];
      }
      if (leaf.markers && !variantNode._markers) { variantNode._markers = leaf.markers; }
      leaf.files.forEach((f) => known.add(relPath(f)));
      added[section]++;

      labels.menuTypes[type] ??= type === "sideImpact" ? "Side Impact"
         : section === "static" && !Object.values(STATIC_TYPES).includes(type) ? humanize(rel.split("/")[1]) : humanize(type);
      labels.animations[animation] ??= leaf.name ?? humanize(k.animationRaw);
      labels.variants[variant] ??= humanize(variant);
      labels.colors[k.color] ??= humanize(k.colorRaw);
   }
   return { added, skipped, besideAA, unplaced, labels, templates };
}
