import { extendDatabase } from "./mapper.js";

const MODULE_ID = "niks-jb2a-for-aa";
const LOG = "Nik's JB2A for AA |";

/** JB2A modules, preferred first. Both build their Sequencer database in scripts/jb2a_sequencer.js. */
const JB2A_MODULES = ["jb2a_patreon", "JB2A_DnD5e"];

/**
 * JB2A's Sequencer templates ([gridSize, startPoint, endPoint]), used when JB2A's own copy is gone:
 * Sequencer deletes `_templates` from a database when it registers it. Taken from JB2A Patreon 0.8.9.
 */
const FALLBACK_TEMPLATES = {
   cone: [100, 0, 0], cone100: [100, 100, 100], cone100_02: [100, 50, 150], cone200: [200, 100, 100],
   large: [200, 0, 0], line100: [100, 50, 150], line200: [200, 200, 200], line200B: [200, 0, 300],
   melee: [200, 300, 300], melee_large: [200, 400, 400], ranged: [200, 200, 200], ray: [100, 0, 0],
   side_impact: [200, 100, 0],
};

const summary = { source: null, added: null, skipped: 0 };

Hooks.once("init", () => {
   game.settings.register(MODULE_ID, "enabled", {
      name: "NJAA.Settings.Enabled.Name",
      hint: "NJAA.Settings.Enabled.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      requiresReload: true,
   });
   game.modules.get(MODULE_ID).api = { summary };
});

Hooks.once("aa.ready", (aaDatabase) => {
   if (!game.settings.get(MODULE_ID, "enabled")) { return; }
   extend(aaDatabase).catch((err) => console.error(LOG, "Could not add the JB2A animations.", err));
});

async function extend(aaDatabase) {
   if (typeof globalThis.AutomatedAnimations?.refreshDatabase !== "function") {
      if (game.user.isGM) { ui.notifications.warn("NJAA.Notify.OldAA", { localize: true }); }
      return;
   }
   const jb2a = JB2A_MODULES.map((id) => game.modules.get(id)).find((m) => m?.active);
   if (!jb2a) { return; }

   const jb2aDatabase = await loadJB2ADatabase(jb2a.id);
   if (!jb2aDatabase) {
      if (game.user.isGM) { ui.notifications.warn("NJAA.Notify.NoDatabase", { localize: true }); }
      return;
   }

   const { added, skipped, labels } = extendDatabase(jb2aDatabase, aaDatabase);

   // Sequencer deletes `_templates` from AA's database when AA registers it, and AA's refreshDatabase()
   // registers the database again without it (AA 8.0.7). Without the "ranged" template, range animations
   // would no longer stretch from source to target, AA's own included.
   aaDatabase._templates = { ...FALLBACK_TEMPLATES, ...jb2aDatabase._templates, ...aaDatabase._templates };

   for (const [level, entries] of Object.entries(labels)) {
      for (const [key, label] of Object.entries(entries)) {
         const id = `autoanimations.${level}.${key}`;
         if (!game.i18n.has(id)) { foundry.utils.setProperty(game.i18n.translations, id, label); }
      }
   }

   globalThis.AutomatedAnimations.refreshDatabase();

   Object.assign(summary, { source: `${jb2a.id} ${jb2a.version}`, added, skipped });
   const total = Object.values(added).reduce((a, b) => a + b, 0);
   console.log(`${LOG} Added ${total} JB2A animations from ${jb2a.id} ${jb2a.version} to Automated Animations.`, added);
}

/**
 * Import JB2A's own database module. It resolves to the module instance JB2A already loaded, so the database
 * is normally filled already. If not (e.g. a different URL), it is built with JB2A's own function.
 */
async function loadJB2ADatabase(moduleId) {
   const url = new URL(`../../${moduleId}/scripts/jb2a_sequencer.js`, import.meta.url).href;
   let exports;
   try { exports = await import(url); }
   catch (err) {
      console.warn(LOG, `Could not load ${url}.`, err);
      return null;
   }
   const values = Object.values(exports);
   const database = values.find((v) => v && typeof v === "object" && !Array.isArray(v));
   const build = values.find((v) => typeof v === "function");
   if (!database) { return null; }

   const hasEntries = Object.keys(database).some((k) => !k.startsWith("_"));
   if (!hasEntries && build) {
      const location = game.settings.settings.has(`${moduleId}.jb2aLocation`) ? game.settings.get(moduleId, "jb2aLocation") : "";
      await build(location?.trim() || "modules");
   }
   return Object.keys(database).some((k) => !k.startsWith("_")) ? database : null;
}
