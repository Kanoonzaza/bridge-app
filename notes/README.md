# System notes and convention card

These two pages are the published partnership notes. The files here are the source of truth: edit them, then republish.

| File | Published at |
|---|---|
| `system-notes.html` | https://claude.ai/artifact/NrdCttHcwDpCv83CsLGpfd |
| `convention-card.html` | https://claude.ai/artifact/E899gpbkkmxzkihMgyTzC5 |

The app's "Read more" links point at the `<h2 id>` anchors of `system-notes.html`. `data/notes-anchors.json` must list exactly those ids (a test checks it). After adding or renaming a section, update that file, then republish.

When an agreement changes, change the rules in `js/system/` and both pages together.
