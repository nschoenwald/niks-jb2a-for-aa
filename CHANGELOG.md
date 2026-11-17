# Changelog

All notable changes to Nik's JB2A for Automated Animations are documented in this file.

## [14.0.2] - 2026-11-17
### Fixed
- **Returning weapons**: The return animations of weapons Automated Animations didn't know yet, such as the Fork and the thrown Shield, now play when you turn on Return Animation. Before, the option could be turned on, but the return animation couldn't be found.

## [14.0.1] - 2026-11-17
### Fixed
- **Animations in AA's own categories**: New colors of an animation that Automated Animations already lists now go next to its existing colors, under AA's name for it. For example, the yellow Fireball Beam is now under Fireball Beam with the other colors instead of in a separate Fireball entry. This also applies to the On Token and Template versions of Fireball and about 460 other entries.
- **Plural names**: Energy Strands and Claws are added as more variants of AA's Energy Strand and Claw instead of separate entries.

## [14.0.0] - 2026-11-17
### Added
- **Missing JB2A animations in Automated Animations**: Every JB2A animation that Automated Animations' menus don't list yet is added to them: range, return, melee, template and on-token animations, about 6,600 files with JB2A Patreon 0.8.9. No more typing file paths into the custom field.
- **Always up to date**: The module reads your installed JB2A version each time the world loads, so new JB2A releases show up without any extra step.
- **Readable names**: New entries get names from JB2A's own names.
