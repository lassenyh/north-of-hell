# Keynote-admin v1 — gjennomgang

Branch: `codex/keynote-admin`. Ingen produksjonsdeploy, produksjonsmigrasjon eller invitasjoner er utført. Den eksisterende lokale endringen i `src/lib/supabase/auth.ts` er ikke del av implementeringen.

## Åpne en isolert gjennomgang

```sh
npm ci
npm run keynote:review
```

Åpne <http://127.0.0.1:3100/admin/keynote>. Bruk `editor@example.test` / `local-test-only-password`. Dette er en syntetisk konto i det lokale testoppsettet, ikke en Supabase-konto. Serverne binder bare til localhost. Portene 3100 og 54329 må være ledige. Stopp med Ctrl+C.

Her virker redigering, lagring, publisering og historikk mot en disponibel Postgres-database (PGlite). Data forsvinner når gjennomgangen stoppes. Supabase Auth- og PostgREST-transport simuleres; ekte app-ruter, SSR-cookiehåndtering, server-actions, migrasjon, RLS og databasetransaksjoner brukes. Ingen auth-bypass eller test-API er lagt inn i appen. Testserveren ligger i `tests/` og inngår ikke i Next-rutene.

Bruk **Forhåndsvis** i editoren for å prøve presentasjonen. Den gamle gjesteinnloggingen er utenfor det isolerte oppsettet og beholder prosjektets eksisterende tilkobling.

## Implementert

- Seks opprinnelige slides med eksakt tekst og fremheving i `src/lib/keynote/seed.json`; separate intro- og startslideinnstillinger.
- Felles typebasert `SlideView` for presentasjon, thumbnails og editor. Editorens scene tegnes i valgt virtuell viewport og skaleres samlet, slik at fontgrenser og proporsjoner samsvarer med live.
- `/admin/keynote`: tekst og Fremhev, ren tekstinnliming med avsnitt, add/duplicate/delete/Angre, dra-og-slipp og flytteknapper, startpunkt etter ID, plassvarsel og tre previewformater.
- Autosave etter skrivepause. Én lagring om gangen; bekreftet versjon fra serveren brukes ved neste lagring. Feil beholder lokale endringer; konflikt krever eksport/henting av siste kladd og kan ikke overskrive automatisk.
- Publisering venter på saves og låser redigering. En transaksjon låser kladden, sammenligner versjon, validerer dokumentet, lager snapshot og flytter publisert referanse. Feil ruller tilbake hele operasjonen.
- Historikk med de siste 50 publiseringene. Gjenoppretting lager en vanlig ny kladd og krever egen publisering. Ingen gamle snapshots slettes.
- Ekte Supabase Auth med e-post/passord og servervalidert `getUser`, separat cookie og eksplisitt prosjektmedlemskap. Ingen selvregistrering eller gjenbruk av gammel admin-cookie.
- RLS på alle nye tabeller. Kladd/historikk er kun lesbare for medlemmer; brukere har ingen direkte skriverettigheter. Smale RPC-er utfører medlemskontroll og atomiske writes i privat schema; offentlige wrappers er `SECURITY INVOKER`.
- `/main` leser kun publisert snapshot når databasekilden er aktivert. Et åpent foredrag beholder sitt snapshot. Ingen realtime eller cache av publiserte dokumenter.

## Koble til et ekte previewmiljø

Dette gjenstår før redaktørbruk med reelle kontoer. Det er ikke utført mot produksjon.

1. Velg en isolert Supabase-utviklingsdatabase. Migrasjonen opprettet med Supabase CLI er `supabase/migrations/20260923195919_keynote_admin.sql`. Bruk prosjektets godkjente migrasjonsflyt. Den endrer bare nye keynote-objekter; eldre nummererte migrasjoner er historiske og skal ikke blindt spilles av på en eksisterende database.
2. Kjør Supabase Advisors mot dette miljøet etter migrering. Lokale tester kontrollerer RLS, funksjonsrettigheter, tomt `search_path`, validering og transaksjoner, men erstatter ikke en kontroll av miljøets faktiske roller og Data API-oppsett.
3. Opprett en bekreftet Auth-bruker med e-post/passord for den avtalte redaktøren. Mottaker må oppgis før invitasjon eller e-post sendes. E-postkode er ikke aktivert; SMTP er ikke verifisert.
4. Gi medlemskap via administrativ SQL med den faktiske Auth-brukerens ID:

   ```sql
   insert into public.keynote_editors(project_slug, user_id)
   values ('north-of-hell', '<auth-user-uuid>')
   on conflict do nothing;
   ```

5. Sett følgende **servervariabler** i previewmiljøet (ingen `NEXT_PUBLIC_`-prefiks):

   ```dotenv
   KEYNOTE_SUPABASE_URL=https://<preview-project>.supabase.co
   KEYNOTE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
   KEYNOTE_SUPABASE_SERVER_KEY=<secret-or-service-role-key>
   KEYNOTE_PUBLISHED_SOURCE=database
   ```

   Servernøkkelen brukes bare til serverlesing av publisert revisjon etter eksisterende gjestekontroll. Editorens actions bruker brukerens JWT og prosjektmedlemskap. Nøkkelen skal aldri eksponeres i klienten. Ikke bruk produksjonsnøkler i det lokale testoppsettet.

6. Gjenta reell innlogging, refresh/sessionfornyelse, utlogging, tilbakekalt medlemskap, lagring og publisering i preview. Test nettverksbrudd og to kontoer/faner. Dette er den gjenværende eksterne integrasjonskontrollen: lokale nettlesertester simulerer Auth/PostgREST og verifiserer ikke SMTP, faktisk tokenfornyelse eller en bestemt Supabase-instans.
7. Produksjonsutrulling krever egen beslutning. Ingen eksisterende gjeste-/storyboardpolicies skal endres som en sideeffekt.

## Aktivering og rollback

Uten `KEYNOTE_PUBLISHED_SOURCE=database` bruker `/main` eksplisitt den innsjekkede originalen. Admin kan lagre kladd hvis tilkobling finnes, men publisering avvises med forklaring når publisert kilde/servernøkkel ikke er konfigurert. Når databasekilden er aktiv, kastes lesefeil; løsningen faller aldri stille tilbake til gammel tekst.

Seeden setter bare inn et deck dersom det ikke finnes. Den overskriver aldri redaktørinnhold ved gjentatt seeding. Vanlig rollback av innhold skjer via Historikk → Gjenopprett som kladd → Forhåndsvis → Publiser. Teknisk rollback kan eksplisitt deaktivere databasekilden og vise den innsjekkede originalen; det er en operatørbeslutning, ikke automatisk feilhåndtering.

## Verifikasjon

```sh
npm run test:keynote
npm run test:keynote:browser
npx tsc --noEmit
npx eslint src/app/admin/keynote src/components/keynote src/lib/keynote src/app/main/KeynoteClient.tsx src/app/main/page.tsx proxy.ts tests/keynote playwright.keynote.config.ts scripts/keynote-review.mjs
npm run build
```

Nettlesertestene bruker Chrome på standard macOS-sti. Sett `KEYNOTE_TEST_BROWSER` til en annen Chromium-binær ved behov. Testene eier sine lokale servere og nekter å gjenbruke en eksisterende server. Kjør dem etter at `keynote:review` er stoppet. Filmtesten leser den eksisterende offentlige Blob-filen; ingen opplasting skjer.

Testene dekker seed/ID-er, validering, serialiserte saves, feil/konflikter, RLS og RPC-tilgang, atomisk rollback ved publiseringsfeil, samtidige writes, refresh, gjenoppretting, frosset live-snapshot, tekstinnliming/Fremhev, Angre sletting, startslide, dra-og-slipp, plassvarsel, fullscreen, faktisk videoavspilling, thumbnail/piltast-regresjon og identisk rendererlayout ved 1440×810, 1440×1080 og 390×845.

`npm run lint` har eksisterende feil i `AdminEditor.tsx`, `ChapterNav.tsx`, `ChromeVideoPlayer.tsx`, `ManuscriptRichEditor.tsx` og `ScreenplayEditor.tsx`, samt eksisterende advarsler. Disse er utenfor denne endringen. Avgrenset lint for endrede/nye filer brukes i tillegg.

## Bekreftet ekstern kontroll

Read-only kontroll av Supabase-prosjektet «North of Hell» bekreftet de eksisterende tabellene og åpne policies (`using true` / `with check true`) på `project_admin_logins`, `project_logins` og `storyboard_frames`. Ingen innloggingsrader, passord eller produksjonsinnhold ble hentet. Ingen produksjonspolicies ble endret. Dette er ikke en full produksjonsaudit.

### Resultat 23. september 2026

- 6 modell-/lagrings-/Postgres-tester: bestått.
- 5 nettleserflyter i Chrome: bestått, inkludert ekte Blob-avspilling og fullscreen.
- TypeScript, avgrenset lint og `git diff --check`: bestått.
- Optimalisert Next.js-produksjonsbygg: bestått.
- Visuell kontroll av editor og representative presentasjonsformater: utført. Lange synopsistekster rulles på mobil; editoren varsler om plassmangel.
- Ekte Supabase Auth/PostgREST, tokenfornyelse og konto i et tilkoblet previewmiljø: gjenstår som beskrevet over.
