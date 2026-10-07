# Storyboard studio

The editor is at `/admin/storyboard`; the reader page remains `/storyboard`.
The editor has **Ferdig side** and **Editor** tabs. The former always shows the
last published snapshot. Saving updates only the draft. Publishing copies the
last saved draft to a separate published snapshot in one database row update.
The UI refuses publication while there are unsaved changes. The server checks
the expected draft version to detect another tab's changes.

## Document model

`StoryboardDocument` has a schema version, title and ordered chapters. Every
chapter has a stable ID, title and ordered sections. Sections have stable IDs
and one of four types: rich text (`html`, alignment, point size), screenplay
(`blocks`), images (`layout`, ordered `images`), or comic scroll (`src`, dimensions,
spacing, background, editable `bubbles` and `sounds`, and an optional published `renderedSrc`). Each image has an ID, source,
fixed slot number and independent plain text description. The image layouts
have capacities 1, 4, 6 and 9; all slots are visible in the editor, including
empty ones. Older packed image arrays migrate to slots in their saved order.
Descriptions use Courier but are not screenplay elements.
Image and screenplay section titles are editor labels and are omitted from the
finished and reader views. Regular body text uses the same Courier Prime face and default
12-point size as image descriptions; explicit text size choices still apply.

The initial document imports existing `storyboard_frames`, preserving their
frame order and text. It groups frames by the chapter directory in the image
path. If the table is empty, it imports assets from `public/storyboard`.
Until the first publication, `/storyboard` continues to show legacy content.

## Storage and access

The production store is `public.storyboard_documents` (migration
`20261006000000_storyboard_documents.sql`), with separate JSONB draft and
published columns and versions. It is readable and writable only with the
server-side `STORYBOARD_SUPABASE_SERVER_KEY`; no browser receives that key.
The app also needs `NEXT_PUBLIC_SUPABASE_URL`. Uploads use the public
`storyboard-images` bucket through the authenticated server route. The editor
uses the existing North of Hell administrator cookie and validates it against
`project_admin_logins` on every write. In development,
`STORYBOARD_REVIEW_MODE=local` enables an isolated filesystem store in
`.local/storyboard-state.json` and local image uploads so the whole flow can be
tested without touching the live site. Production does not silently fall back
to ephemeral filesystem writes; it reports a configuration error.
Local review mode takes precedence even when Supabase credentials are present.
For isolated browser tests, `STORYBOARD_LOCAL_STATE_PATH` can point to a separate
JSON state file and `STORYBOARD_LOCAL_UPLOAD_SUBDIR` chooses a subdirectory under
`public/storyboard-uploads` (letters, digits and hyphens only).

## Comic scroll sections

Create a **Comic scroll** section inside any chapter. Choose one illustration
from the image library or upload a new one, then set the space above and below
it. Add any number of speech bubbles up to 30. Drag a bubble to move it, its
square handle to resize it, and its round handle to aim the tail. The inspector
edits dialogue, tail side, text size and exact coordinates; bubbles can be
duplicated, removed and reordered. A mobile-width preview uses the same
800-unit composition scaled down to the reader width. Replacing the source
image keeps bubbles and sound effects editable and shifts those below it by the image-height
change. Changing the space above shifts the illustration and overlays anchored
below it together.

The bubble style uses an irregular hand-drawn outline with the tail in the same
continuous path, white fill and the supplied Jack Armstrong lettering. Text wraps and shrinks within
the bubble. If it still does not fit at 18 units, the editor warns and
publication is rejected with a corrective message. Sound effects are free
lettering with editable text, position, size, angle and color; they can cross
the image edge. All lettering remains editable in the draft. Publishing
rasterizes each changed comic section
to a WebP image in `storyboard-images` (or the local review upload directory)
and stores the image URL only in the published snapshot. The reader displays
that single composite image per section; unchanged sections reuse their
previous output. Original art is never overwritten.

## Screenplay behavior

The editor supports all 17 Elements in the supplied Final Draft menu: General,
Scene Heading, Action, Character, Parenthetical, Dialogue, Transition, Shot,
Cast List, New Act, Sequence, End of Act, Summary, Outline 1–3 and Note. Each is
editable, can be chosen by its menu letter or number, and persists through
draft save and publication. The screenplay controls, SmartType labels, help and
Elements menu use English. The screenplay toolbar sits below the selected
section title. It uses 12 point Courier Prime, uppercase display for scene
headings, character cues, transitions, shots and act/sequence markers, and distinct indents for character,
parenthetical and dialogue. The finished and reader views render screenplay
lines directly on the document background; the active editor keeps its light
writing surface. On a populated line, Enter creates the usual next element: scene
heading→action, action→action, character→dialogue,
parenthetical→dialogue, dialogue→action, transition→scene heading. Tab
advances through a scene heading's intro, location and time before creating an
action line. Elsewhere Tab changes the current element: action→character,
character→parenthetical (or transition on an empty character line),
dialogue→parenthetical, parenthetical→dialogue, transition→scene heading.
⌘+0–9 on Mac and Ctrl+0–9 on Windows select the main elements. The extra
elements use ⌘+Control+0–4/8–9 on Mac and Ctrl+Shift+0–4/8–9 on Windows.
On an empty line, Enter opens the
17-element picker; arrows and Enter, the displayed letter/number key, or a
mouse click choose an element. The active element also
appears in the screenplay toolbar and can be changed there or by right-clicking
an existing line. Tab from dialogue inserts a parenthetical with `()` and puts
the caret between the parentheses. Enter after the parenthetical keeps the
closing `)` on that line and creates dialogue. Typing `INT.`, `EXT.` or `I/E.`
at the start of an action line converts it to a scene heading. Native
⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z undo and redo. Arrow, Home and End keys use the
browser editor's standard navigation. Pasted plain text or HTML is parsed into
screenplay blocks using the existing PDF/Fountain-style parser.

Copy/paste from Final Draft is supported through the browser clipboard's plain
text and HTML representations. Plain text with screenplay-style indentation is
split into scene headings, action, character cues, dialogue, parentheticals and
transitions. HTML carrying element classes or `data-block-type` keeps those
element types, inline bold/italic/underline and line breaks. Pasting over a
full-document selection replaces the document; pasting in the middle of a line
keeps the surrounding text. Paste is undoable and redoable. Final Draft's
[clipboard guide](https://kb.finaldraft.com/hc/en-us/articles/28002784585748-How-do-I-use-the-clipboard-Cut-Copy-and-Paste)
describes format retention inside Final Draft, while its
[export guide](https://kb.finaldraft.com/hc/en-us/articles/27525594609684-How-do-I-export-a-Final-Draft-file-to-a-different-format-like-RTF-or-TXT)
distinguishes formatted HTML/RTF from plain text. Browser clipboard APIs do not
expose Final Draft's private native clipboard data; when HTML is unavailable,
the editor infers elements from the text and its indentation. This was tested
with representative text and HTML payloads, not a live Final Draft clipboard.

The toolbar changes when a screenplay section is selected. It offers the
Elements selector, Courier Prime 12 pt indicator, bold, italic, underline,
undo and redo. Scene headings, character cues and transitions are uppercase
automatically. All elements have their own placement and spacing. Outline 1–3
are shown as bold headings, and Note is italic. Ordinary screenplay elements
are not automatically bold, italic or underlined.
Selected text can receive these inline styles, which survive draft save and
published rendering. Final Draft documents uppercase and automatic
parentheses in its [element reference](https://kb.finaldraft.com/hc/en-us/articles/27646947570196-What-are-script-elements),
and describes bold/italic/underline as [text or template style choices](https://kb.finaldraft.com/hc/en-us/articles/27647938211604-How-do-I-modify-element-behavior-change-element-fonts-and-margins-or-create-new-custom-elements).
The attached Quick Start Guide transcript demonstrates the empty-line Elements
picker, Tab from action to character, Tab from dialogue to parenthetical and
automatic parentheses.

SmartType offers a gray completion at the caret and a selection list beside it.
The editor builds lists from all screenplay sections in the current draft for
character names, character extensions, scene intros, locations, times and
transitions. Common scene intros, times, extensions and transitions are also
available before they have been used in the draft. Suggestions narrow as text
is entered. Up/Down changes the highlighted item, Tab or Enter inserts it,
clicking an item inserts it, and Escape dismisses the list until the text or
caret changes. Within scene headings, Tab adds `.` after an unfinished intro
and ` - ` after a location; after a complete time it creates an action line.
An empty scene heading uses Enter to open the Elements picker. Completed
entries in the document are immediately available to later lines, including
other manuscript sections. SmartType is only a writing aid; the saved content
remains the 17 screenplay block types, so the published page uses the same
text and typography.

The behavior follows [Final Draft's SmartType list and gray completion
description](https://kb.finaldraft.com/hc/en-us/articles/27750003388948-What-is-SmartType-and-how-do-I-use-it),
its [web editor's arrow, Tab and mouse behavior](https://kb.finaldraft.com/hc/en-us/articles/44647441895572-Using-SmartType-Auto-Completion-in-Final-Draft-Writer),
and its [scene heading Tab progression](https://kb.finaldraft.com/hc/en-us/articles/15575071386516-I-can-t-type-my-Scene-Headings-without-the-cursor-jumping-to-the-next-line).
Unlike Final Draft, this editor derives lists from the current document rather
than offering a separate list-management dialog with custom ordering or an
automatic next-character guess. The built-in choices and separators are fixed.

This matches [Final Draft's documented default Enter/Tab transitions and
element shortcuts](https://kb.finaldraft.com/hc/en-us/articles/27977488282644-What-keyboard-shortcuts-can-I-use-in-Final-Draft)
for the core screenplay elements. General, Shot, Cast List, New Act, End of Act
and Summary use Final Draft's documented Enter transitions; Outline 1–3 use
its documented Enter-to-Summary and Tab-to-next-level behavior. Sequence and
Note use simple predictable transitions because Final Draft does not specify
defaults for them in its shortcut article. The Cast List here is manually
edited rather than populated from scene characters. [Final Draft describes 12 point Courier as the script
standard](https://www.finaldraft.com/learn/how-to-format-a-screenplay/). The
web editor does not implement dual dialogue, scene numbering, production
revisions or Final Draft's pagination. It lays out a
continuous web page; page count and breaks may differ from Final Draft's
printer-specific calculations, as [Final Draft itself notes for imported
scripts](https://kb.finaldraft.com/hc/en-us/articles/15575255120276-I-imported-a-script-from-another-program-and-now-it-s-several-pages-longer-or-shorter-).

## Editing controls

The interface, validation messages and new-section defaults are in English.
Older Norwegian default section names are shown in English when loaded;
author-written titles, descriptions and screenplay text retain their wording.

The regular text toolbar follows the relevant Sign controls: paragraph style,
point size, bold, italic, underline, alignment and lists. It omits contract
fields and legal controls. The toolbar sits below the selected text section's
title, matching the screenplay toolbar's placement. Chapter and section actions
in the layer panel and on the document canvas call the same state operations.
The drag handle moves
whole chapters or sections, including their content; arrow buttons provide a
keyboard-accessible alternative. Section creation buttons sit below each
chapter on the canvas;
the layer panel is reserved for navigation and rearrangement. The right-hand
document inspector is removed so the canvas uses the available width. Draft
and publication status remain in the top bar. Image cards can be moved or
swapped between fixed slots by drag or arrow buttons. Empty image tiles have
dashed borders and drop icons; each
accepts a dropped image file. Dropping a
file onto an occupied image replaces it while retaining its description.
The file chooser remains available. Drops accept one JPG, PNG, WebP or GIF at
a time, up to 10 MB, and show validation or upload errors in the image section.
Chapters and sections are saved in array order; images retain their explicit
slot number even when earlier slots are empty.
Finished and published views show only occupied image slots, in slot order.
Images in a partial final row expand to use the available width.

## First-time browser testing

Four independent first-time reviewers received the product brief and a running
local URL, without implementation notes. Scores below are in the order text,
screenplay, images/descriptions, chapters/layers, draft/publishing, overall.

| Round | Tasks and observed result | Scores | Finding and change |
| --- | --- | --- | --- |
| 1 | Created chapter 17 with formatted text, six screenplay elements and two described images; moved sections/chapters; saved and published. The reader changed only after publication. | 4, 4, 4, 3, 5, 4 | Newly selected layer was hard to find; image library was a long plain list; screenplay label lagged after Tab. Added layer scrolling, searchable thumbnails and immediate label updates. |
| 2 | Created chapter 18, used bold and undo/redo, tried all four image layouts and image reordering, then verified separate draft and published states. | 4, 4, 4, 4, 5, 4 | Reader was long and image search had 331 results. Added chapter jump and chapter filtering. |
| 3 | Created chapter 19, narrowed image search to one result, moved described images, rearranged sections and checked published order and chapter navigation. | 4, 5, 4, 4, 5, 4 | Imported chapters opened with many sections, and the chapter menu stayed open after navigation. Chapters now start collapsed; the menu closes after selection. |
| 4 | Created chapter 20 with bold text, all six screenplay elements and two described images; tested layouts, image reorder, save/publish separation and the 390 px reader. No horizontal overflow or publication leak was observed. | 4, 4, 4, 4, 5, 4 | The shortcut hint lacked a key map, parenthetical punctuation was unclear, filenames were technical and long layer titles clipped. Added explicit shortcuts and parentheses guidance, readable frame labels, and wrapping titles. |

After round 4, a direct browser check also verified local file upload and
image drag-and-drop. At 390 px, the editor used its stacked layout without
horizontal overflow. The uploaded dummy image and test chapters were removed
from the local review document. `npx tsc --noEmit`, focused ESLint,
`npm run test:storyboard`, `npm run test:keynote` and
`npx next build --webpack` passed. The production build needed network access
to fetch this project's existing Google Fonts.
