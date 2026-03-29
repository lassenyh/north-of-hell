# Animatic-video i storyboard (standardoppsett)

**Notis til fremtiden:** Når det sies at en *ny animatic-video* skal legges inn i storyboard, skal det følge **dette oppsettet** — samme som dagens fishing-storm-animatic og explore-location-spilleren.

## Spiller: `ChromeVideoPlayer`

- Felles komponent: `src/components/ChromeVideoPlayer.tsx`
- **Alltid** for animatic i storyboard:
  - `showFullscreen`
  - `disablePictureInPicture` (animatic skal ikke tilby PiP)
  - `videoClassName`: `block h-auto w-full cursor-pointer object-contain` (innenfor sort ramme som i `StoryboardFishingStormVideo`)

**Funksjoner som skal beholdes (ikke forenkle bort):**

- Overlay på videorammen (gradient nederst)
- Én rad kontroller: **play** → **current tid** → **seek** → **total tid** → **volum** (vertikal slider ved hover) → **fullscreen**
- Play/volum/fullscreen: kun ikon, **bakgrunn først ved hover** (gullkant / zinc-bakgrunn)
- Under avspilling: kontroller og musepeker **skjules** etter ~2 s uten bevegelse; **400 ms** fade; vises igjen ved musebevegelse i rammen; museleave skjuler mens det spilles
- Touch: første trykk kan bare vise kontroller (uten å pause), deretter vanlig play/pause på video
- Fullscreen: hele spillerrammen (video + kontroller), samme oppførsel som explore location

## Filplassering

- Legg MP4 under `public/storyboard/<kapittelmappe>/` (URL-kod stier med mellomrom i kode)

## Integrasjon i storyboard-flyten

Mal: `src/components/StoryboardFishingStormVideo.tsx`

1. **Konstant** som identifiserer *hvilken PNG-ramme* animaticen skal vises rett etter (f.eks. `STORYBOARD_*_AFTER` + `includes` i `frame.src`).
2. **Hjelpefunksjon** `show…VideoAfter(frameSrc: string): boolean`
3. **Komponent** som rendrer `ChromeVideoPlayer` med riktig `src`, label («Animatic» e.l.), **list**- og **grid**-variant (samme ramme/skygge som frames).
4. **`ComicScrollPage.tsx`**
   - **List:** etter `ScrollFrame` for matchende frame → rendre animatic-komponenten
   - **Grid:** i `gridItems`-løkken, etter matchende frame → `video-block` + oppdater `gridIndex` slik at videoen spenner **2 kolonner** (`sm:col-span-2`) og neste kapittel/frame kan starte i **venstre kolonne** (samme logikk som `gridIndex += 2 + (gridIndex % 2)` etter video)

Ved ny animatic: enten generaliser fishing-storm-filen (flere videoer) eller kopier mønsteret til egen komponent og koble inn i `ComicScrollPage` på samme måte.

## Ekstern side (valgfritt)

Explore location bruker samme `ChromeVideoPlayer` med `showFullscreen`; animatic bruker i tillegg `disablePictureInPicture`.
