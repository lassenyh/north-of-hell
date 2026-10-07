# Keynote admin — implementeringsplan og overlevering

Dato: 23. september 2026. Status: godkjent retning, ikke implementert.

## Start her i neste samtale

Bygg en enkel keynote-admin i dette repoet etter planen nedenfor. Bruk beslutningene som utgangspunkt; ikke gjør en ny CMS-sammenligning. Les relevante filer og gjeldende skills før implementering. Start med en isolert branch, og la publisert innhold være urørt mens editoren bygges og testes. Ikke tolk tidligere deploygodkjenning som en bestilling om å publisere denne nye adminen nå.

Brukeren ønsker en løsning for en regissør med lite teknisk erfaring. Egen editor med eksisterende Supabase er valgt, uten Sanity. Fokus er tekst, legge til/fjerne slides og rekkefølge. Kladd, forhåndsvisning, publisering og enkel gjenoppretting skal gjøre det trygt å bruke.

Modellanbefalingen var Astra / High. Dette dokumentet skal spare gjentatt planlegging, ikke erstatte kontroll av faktisk kode eller tilgang.

## Bekreftet utgangspunkt

- Repo: `/Users/lassenyhaugen/Developer/Projects/north-of-hell`.
- GitHub: `https://github.com/lassenyh/north-of-hell`.
- `main` og siste produksjonsdeploy var på commit `ff2a305` ved overlevering.
- Produksjon: `https://north-of-hell.vercel.app`.
- `/main` viser keynoten etter gjesteinnlogging. `/demo-main` redirecter til `/main`.
- Gamle hovedside er bevart på `/main/legacy`, uten menylenke.
- Seks slides: Title, Logline, Film, Genre & Tone, Synopsis 1, Synopsis 2.
- Innholdet er hardkodet. Ingen keynote-tabell, editor eller publiseringsflyt er implementert.
- Lokal endring i `src/lib/supabase/auth.ts` fantes før dette arbeidet (to fjernede blanklinjer). Ikke overskriv eller ta den med utilsiktet.
- Ingen produksjonsdatabase ble undersøkt i vurderingen. Databasetilgang, faktiske RLS-regler, SMTP og Supabase Auth-konfigurasjon er fortsatt uverifisert.

## Filer å lese — ikke les hele repoet på nytt

1. `src/app/main/KeynoteClient.tsx`: alt slideinnhold, renderer, spiller, navigasjon og intro.
2. `src/app/main/keynote.module.css`: design, skalering, forhåndsvisninger og fullscreen-puls.
3. `src/app/main/page.tsx`: serverrute og gjestetilgang.
4. `src/lib/public-video-paths.ts`: Blob-adressen til filmen.
5. `src/app/admin/page.tsx`, `src/app/admin/actions.ts`: eksisterende storyboard-admin og actions.
6. `src/app/admin/login/actions.ts`, `src/lib/supabase/admin-auth.ts`: gammel admininnlogging.
7. `src/lib/supabase/server.ts` og `supabase/migrations/001_storyboard_frames.sql`, `004_project_admin_logins.sql`: eksisterende datatilgang og historiske policies.
8. `src/components/screenplay/ScreenplayEditor.tsx`: Tiptap finnes allerede. Gjenbruk biblioteket, ikke manuskriptets spesialblokker og snarveier.
9. `src/components/LoginDemoSwitcher.tsx`, `src/app/login/LoginPageClient.tsx`, `proxy.ts`: login, ruting og demomeny.

Stack: Next.js 16.1.6, React 19.2.3, TypeScript, Tailwind 4, Framer Motion, Supabase og Tiptap. Ikke oppgrader pakker som del av oppgaven uten et konkret behov.

## Brukeropplevelsen vi bygger

Ny rute: `/admin/keynote`.

- Venstre: thumbnails, navn og markering av valgt slide/startslide.
- Midten: nøyaktig forhåndsvisning med samme renderer og typografi som publisert keynote.
- Høyre: relevante tekstfelt og en liten verktøylinje. Klikk på et tekstområde i preview velger riktig felt; unngå en fri designflate i v1.
- Topp: lagringsstatus, Angre, Forhåndsvis og Publiser.
- «Ny slide»: Kort tekst eller Overskrift med tekst, lagt etter valgt slide.
- «Dupliser»: kopier valgt slide med ny ID.
- Endre rekkefølge ved dra-og-slipp samt tilgjengelige Flytt opp/Flytt ned-knapper.
- Fjern fra kladd med mulighet for Angre. Aldri la en tom presentasjon publiseres.
- «Start her» på en slide. Startpunktet følger ID, ikke posisjon. Krev nytt startpunkt før publisering hvis startsliden er fjernet.
- Tekst: avsnitt, linjeskift og «Fremhev» som gir Schneider. Ingen Markdown, rå HTML, fontvelger eller vilkårlige størrelser i UI.
- Innliming fra Docs/Word skal beholde tekst og avsnitt, men fjerne uønskede fonter, farger og størrelser.
- Redigering står stille. Piltaster flytter tekstmarkøren i tekstfelt, og styrer slides bare i presentasjons-/previewmodus.
- Desktop er primær editorflate. Kontroller også presentasjon på mobil og ulike skjermforhold.

Scope: tittelgrafikk, bakgrunn, fonter, fades og videospiller forblir designstyrt. Eksisterende tittel- og filmslide kan flyttes, dupliseres og fjernes. Ingen ny videouploader, frie layouter, AI-skriving, flerspråk, kommentarer eller avanserte roller i første versjon. Film fra Blob beholdes.

## Oppførsel som må bevares

- Innloggingens eksisterende overgang til keynoten.
- Svart tittel på rød bakgrunn i to sekunder ved innlasting; deretter logline som startslide.
- Tittelsliden ligger før startsliden, og nås ved å gå tilbake.
- Modellér introen separat fra startslide og ordinær tittelslide. Introen skal ikke forsvinne utilsiktet ved rekkefølgeendring.
- Fade ut før neste slide fades inn; redusert bevegelse respekteres.
- Filmens 16:9-ramme, rød bakgrunn og sentrert play-knapp. Native kontroller vises først etter første avspilling.
- Små sorte streker nederst, aktivmarkering, thumbnails uten etiketter, klikk og venstre/høyre piltast.
- Thumbnail skal ikke bli hengende når man klikker en strek og deretter bruker piltaster. Eksisterende `suppressPreview` og fokusflytting løser dette nå.
- Fullscreen-knapp nederst til høyre, skjult under intro. Fade inn med første innholdsslide, så puls 1–2, pause, 1–2 én gang per lasting.
- Demomeny med vis/skjul. Ikke legg nye adminlenker i gjestens keynote.

## Foreslått teknisk struktur

### 1. Skill data, visning og interaksjon

Tre lag: serialiserbart deck-dokument, ren `SlideView`, og presentasjonsspiller/editor rundt denne. Både thumbnails og hovedvisning skal bruke samme data og renderer.

Bruk stabile slide-ID-er og typebasert rendering. Fjern spesiallogikk som `index === 2` for film eller `index - 1` for synopsis. Valgt slide og startslide peker til ID; listen bestemmer rekkefølgen. Avled valgte posisjoner ved behov.

Foreslått deck-format:

- `schemaVersion`
- `slides`: ordnet liste med `id`, internt navn, type og innhold
- `startSlideId`
- slide-type: `title`, `text`, `video`
- text-layout: `short` eller `headed` (begge følger eksisterende design)
- riktekst med avsnitt og en begrenset `emphasis`-markering
- video: referanse til eksisterende Blob-film

Et Tiptap-dokument med bare tillatte noder/marks er et egnet tekstformat. Valider på serveren og render kontrollerte noder, ikke vilkårlig HTML. Konverter dagens stjernemarkeringer og JSX-emphasis én gang ved seeding.

Viktig for samsvar: dagens CSS bruker viewport-enheter. En liten editor-preview får feil proporsjoner hvis den bruker hele nettleservinduets `vw`/`svh`. Gjør dimensjonering relativ til previewens viewport/container og test mot vanlig presentasjon. Ikke kopier renderer med egne layoutregler.

### 2. Kladd, lagring og publisering

Anbefalt enkel lagring for én presentasjon:

- `keynote_decks`: prosjekt-ID, draft-dokument, draft-versjon, referanse til publisert revisjon, oppdatert av/tid.
- `keynote_revisions`: immutable komplette snapshots med revisjons-ID, deck-ID, dokument, publisert av/tid.
- Redaktørmedlemskap knyttet til ekte Auth-bruker og prosjekt.

Autosave etter en kort skrivepause. Vis «Lagret» først ved bekreftet serversvar. Serialiser saves og bruk forventet draft-versjon for å oppdage konflikter. Eldre eller sene nettverkssvar må ikke overskrive nyere tekst. Feil skal beholde lokale endringer og tilby ny lagring.

Publisering må atomisk validere og kopiere én bestemt lagret draft-versjon til en ny revisjon og oppdatere deckets publiserte referanse. Sørg for at ventende saves er ferdige først. Vis ikke publiseringssuksess før hele operasjonen er bekreftet.

Gjenoppretting: hent en tidligere publisert revisjon inn som ny kladd, forhåndsvis og publiser på vanlig måte. Behold historikken.

`/main` henter kun publisert dokument på serveren etter gjestetilgangskontroll. Et åpent foredrag beholder sitt snapshot; ingen realtime-utskifting midt i visningen. Nye åpninger får siste publiserte revisjon. Innholdsendringer krever ikke Git/deploy. Unngå at caching serverer gammel publisering.

### 3. Tilgang — må løses før redaktørbruk

Bekreftede funn i repoet, ikke en bekreftet produksjonsaudit:

- Gammel admin validerer passord direkte mot `project_admin_logins.password`.
- `noh_admin_auth` inneholder adminradens ID. Actions sjekker om denne raden finnes.
- Migrasjon 004 har policies med `using (true)` og `with check (true)` for admin-login-tabellen. Migrasjon 001 har tilsvarende åpne writes for storyboard.
- Serverklienten bruker en anon-nøkkel. En anon-nøkkel er ikke i seg selv en hemmelighet; problemet er tillatelsene og autorisasjonen.
- `proxy.ts` finnes og var med i produksjonsbygget; kommentaren om at den er ubrukt/styrt av `src/middleware.ts` er foreldet. Sistnevnte fil finnes ikke.

Ikke gjenbruk denne cookie-/passordmodellen for keynote-admin. Bruk Supabase Auth, servervalidert sesjon og eksplisitt prosjektmedlemskap. Gjestekode må aldri gi redigeringsrettigheter. Beskytt både sider, actions/API og database; `authenticated` alene er ikke prosjektgodkjenning.

Foreslått enkel innlogging: e-postkode for inviterte redaktører. Verifiser at prosjektet har egnet SMTP før dette loves som ferdig. Ikke opprett e-postleverandør, inviter en ukjent person eller send meldinger uten nødvendig mottakerinformasjon/autorisasjon. Vanlig e-post/passord med Supabase Auth kan være alternativ ved manglende SMTP.

Hold ny editor separat fra gammel storyboard-admin til migreringskonsekvensene er forstått. Ikke endre gamle produksjonspolicies blindt og lås ute brukere. Les gjeldende skjema/policies med read-only verktøy før SQL utformes; spør bare etter reelle blokkere. Nye keynote-tabeller må ha restriktive policies fra starten.

### 4. Migrering og trygg innføring

- Seed én gang fra dagens seks slides, med eksakt tekst, fremhevinger, videoreferanse og startslide-ID.
- Seed må være idempotent og aldri skrive over eksisterende redaktørinnhold ved neste deploy.
- Bygg editoren og test med en egen kladd før publisert renderer kobles over.
- Behold dagens hardkodede data som kontrollert førstegangs-/rollback-grunnlag. Ikke skjul driftsfeil ved å vise gamle tekster og påstå at nytt innhold er publisert.
- Ikke slett Blob-filer ved sletting av slides.

## Arbeidsrekkefølge

1. Kontroller git-status og opprett feature-branch. Les denne planen og nøkkelfilene.
2. Flytt dagens innhold til typed seed-data og trekk ut renderer. Verifiser at presentasjonen ser og fungerer likt.
3. Lag editor med lokal draft-state, tekst, add/duplicate/delete/undo, flytting og startslide.
4. Verifiser Supabase-tilgang og auth-forutsetninger. Utform schema og policies etter gjeldende Supabase-skill; bruk migrasjonsverktøy, ikke gjett neste filnavn.
5. Koble på sikker lagring, autosave, versjonskontroll og publisering/gjenoppretting.
6. Test hele flyten og avklar kun reelle eksterne blokkere (for eksempel redaktørens e-post eller manglende tilgang).
7. Gjør resultatet reviewbart i preview før produksjonsutrulling.

## Akseptansetester

- Dagens seks slides importeres uten tap av innhold, rekkefølge eller emphasis.
- Edit/add/duplicate/delete/reorder fungerer, og valg/startpunkt følger ID etter endringer.
- Ny kladd overlever refresh, mens publisert visning er uendret.
- Angre sletting fungerer; tom presentasjon eller slettet startpunkt kan ikke publiseres.
- Fremhev og innliming fungerer uten HTML-/formatlekkasje.
- Publisering oppdaterer tekst og rekkefølge samlet; feil gir ingen delvis publisering.
- Forrige revisjon kan gjenopprettes; åpne presentasjoner skifter ikke midt i visning.
- To editorfaner og langsomme/feilede saves gir ikke stille overskriving.
- Gjest, utlogget bruker og innlogget bruker uten redaktørmedlemskap kan ikke lese kladd eller skrive/publisere.
- Piltaster i editor flytter tekstmarkør. Presentasjonsnavigasjon, thumbnail-feiltesten, fullscreen og video fungerer fortsatt.
- Lange tekster får tydelig plassvarsel, ikke avklipping eller skjult automatisk krymping. Preview og live samsvarer på representative viewport-størrelser.
- Relevant lint, TypeScript, produksjonsbygg og browser-flow passerer. Skriv fokuserte tester for ID-/rekkefølgelogikk, publisering/konflikter og tilgang.

## Drift og tidligere kontrollgrenser

- Produksjonsprosjekt Vercel: `north-of-hell`, scope `lassenyhs-projects`.
- Vercel MCP returnerte 403 for teamet. Eksisterende Vercel CLI-innlogging fungerte. CLI ble funnet i lokal npx-cache; oppdag tilgjengelig CLI på nytt ved behov.
- Moodfilm er webkodet 1080p, ca. 52 MB, og ligger på adressen i `PUBLIC_KEYNOTE_FILM` i `src/lib/public-video-paths.ts`. Original og webkopi er ignorert i Git/deploy. Ikke last opp eller encode filmen på nytt.
- Automatisk godkjenningskontroll avviste henting av alle production env-vars. Eksisterende lokal, avgrenset Blob-nøkkel ble brukt til opplasting i stedet. Ikke omgå avvisningen eller skriv ut hemmeligheter.
- Automatisk godkjenningskontroll avviste innlogging mot produksjon med gjestekoden uten eksplisitt tillatelse til produksjonstesten. Innlogging og flyt ble testet lokalt; offentlige redirects og Blob range-respons ble verifisert i produksjon. Ikke gjenta den avviste testen indirekte.
- Denne samtalen bestiller bare planen. Ikke push eller deploy dette dokumentet automatisk.

## Kilder brukt i vurderingen

- Supabase Auth / e-postkode: https://supabase.com/docs/guides/auth/auth-email-passwordless
- SMTP-forutsetninger: https://supabase.com/docs/guides/auth/auth-smtp
- Tilgangsregler: https://supabase.com/docs/guides/database/postgres/row-level-security
- Sanity vurdert og valgt bort for dette avgrensede behovet: https://www.sanity.io/docs/user-guides/preview-and-page-building og https://www.sanity.io/pricing

Ingen ny CMS-utredning er nødvendig. Verifiser gjeldende API-dokumentasjon når løsningen implementeres.
