# Nik's JB2A for Automated Animations

Automated Animations' animation menus only list JB2A animations up to JB2A version 0.5.4 (early 2023). Everything JB2A
released since, thousands of animations, could only be used by typing its file path into the custom field.

This module adds every JB2A animation that Automated Animations doesn't list yet to its menus. With JB2A Patreon 0.8.9
that is about 6,600 animation files.

## How it works

- Each time the world loads, the module reads the animation list of your installed JB2A module and adds what's missing
  to Automated Animations' menus. When you download a new JB2A release, its new animations show up on the next load,
  with no extra step.
- Animations are sorted into the menus by where they are in the JB2A library:
  - **Range**: projectiles with distance versions (05ft to 90ft), such as arrows, bolts and spell projectiles.
    Returning versions (boomerang, dagger…) go into the Return menu.
  - **Melee**: melee weapon and creature attacks.
  - **Templates**: circle, cone, line and square effects.
  - **On Token**: everything else, sorted by JB2A folder (Marker, Magic Signs, Conditions, Zoning, Portals, Token
    Stage…). Folders Automated Animations has no category for get their own.
- Animations Automated Animations already knows are left as they are. Your existing animation settings are not
  changed.
- New entries get readable names from JB2A's own names, such as "Lava Spout" or "Dark Red". They are English.
- The module contains no JB2A files or file lists. You need your own JB2A module.

## Settings

- **Add missing JB2A animations** (world, default on): turn the module off without disabling it. Needs a reload.

## Requirements

- Foundry VTT 14
- Automated Animations 8.0.7 or newer, and Sequencer
- JB2A Patreon (`jb2a_patreon`). The free JB2A module (`JB2A_DnD5e`) is tried too, but hasn't been tested; if its
  animation list can't be read, a warning is shown and nothing is added.

## Limits

- Menu names are made from JB2A's internal names, so some variants have technical names such as "Circle Static 003".
- Some animation groups have many variants (for example JB2A's circle templates), so their menus get long.
- A few animations may land in an unexpected category, because JB2A's library isn't sorted fully consistently.

## Checking what was added

In the browser console:

```js
game.modules.get("niks-jb2a-for-aa").api.summary
```
