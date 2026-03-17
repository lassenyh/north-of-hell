# Deploy til Vercel – sjekkliste ved 404

Hvis du får **404 Not Found** på begge forsiden og admin (uten feilmelding i build), er det nesten alltid **Build & Development Settings** på Vercel.

## 1. Output Directory (viktigst ved 404 på alt)

- Gå til **Vercel Dashboard** → ditt prosjekt → **Settings** → **General** → **Build & Development Settings**.
- **Output Directory** skal være **tom** (ikke fylt inn).
- Hvis det står f.eks. `out`, `dist` eller `build`, fjern det. For Next.js skal Vercel bruke sin egen Next.js-runtime, ikke en statisk mappe. Feil output directory gir 404 på alle ruter.

## 2. Framework Preset

- Under **Build & Development Settings**: **Framework Preset** skal være **Next.js**.
- Hvis det står "Other" eller noe annet, endre til **Next.js** og lagre. Deretter: **Redeploy** (Deployments → ⋮ på siste deploy → Redeploy).

## 3. Root Directory

- **Settings** → **General** → **Root Directory**.
- Skal være **tom** (prosjektroten der `package.json` og `next.config.ts` ligger). Hvis prosjektet ditt ligger i en undermappe i repoet, sett Root Directory til den mappen (f.eks. `north-of-hell`).

## 4. Bygg på Vercel

- **Deployments** → åpne siste deployment → **Build Logs**.
- Bygget må fullføre uten feil (grønn check). Du bør bl.a. se at Next.js bygger og at ruter som `/`, `/admin` listes.

## 5. Åpne riktig URL

- Etter deploy får du en URL som: `https://north-of-hell-xxx.vercel.app`.
- Test **forsiden**: `https://ditt-prosjekt.vercel.app/` (med avsluttende `/` eller uten).
- Test **admin**: `https://ditt-prosjekt.vercel.app/admin`.

Hvis bare én av sidene gir 404, si ifra hvilken.

## 6. Miljøvariabler (valgfritt)

- Vi bruker hardkodede Supabase-verdier i koden, så appen skal fungere uten env på Vercel.
- Hvis du senere bytter til kun env-variabler: **Settings** → **Environment Variables** → legg inn `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY` for **Production** (og ev. Preview).

## 7. Endringer som er gjort i koden

- `export const dynamic = "force-dynamic"` er lagt til på **page.tsx** (forside), **admin/page.tsx** og **storyboard/page.tsx**. Da prøver ikke Vercel å bygge sidene statisk under deploy (som kan feile uten Supabase), og de kjører på server ved hver forespørsel.

Etter at du har sjekket punkt 1–5 (spesielt **Output Directory** og **Framework Preset**) og eventuelt pushet på nytt, prøv deploy igjen. Hvis du fortsatt får 404, send gjerne:
- om det er forsiden (`/`), `/admin` eller hele siden som gir 404, og
- et utklipp fra **Build Logs** for det siste deploymentet.
