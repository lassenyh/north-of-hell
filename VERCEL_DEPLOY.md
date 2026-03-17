# Deploy til Vercel – sjekkliste ved 404

Hvis du får **404 Not Found** etter deploy, sjekk dette:

## 1. Bygg på Vercel

- Gå til **Vercel Dashboard** → ditt prosjekt → **Deployments**.
- Åpne det siste deploymentet og se **Build Logs**.
- Bygget må fullføre uten feil (grønn check). Hvis det står feil (rød X), les feilmeldingen og rett den først.

## 2. Root Directory

- **Settings** → **General** → **Root Directory**.
- Skal være **tom** eller **`.`** (prosjektroten der `package.json` og `next.config.ts` ligger).
- Hvis du har valgt en undermappe, kan Vercel ikke finne Next.js-appen → 404.

## 3. Åpne riktig URL

- Etter deploy får du en URL som: `https://north-of-hell-xxx.vercel.app`.
- Test **forsiden**: `https://ditt-prosjekt.vercel.app/` (med avsluttende `/` eller uten).
- Test **admin**: `https://ditt-prosjekt.vercel.app/admin`.

Hvis bare én av sidene gir 404, si ifra hvilken.

## 4. Miljøvariabler (valgfritt)

- Vi bruker hardkodede Supabase-verdier i koden, så appen skal fungere uten env på Vercel.
- Hvis du senere bytter til kun env-variabler: **Settings** → **Environment Variables** → legg inn `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY` for **Production** (og ev. Preview).

## 5. Endringer som er gjort i koden

- `export const dynamic = "force-dynamic"` er lagt til på **page.tsx** (forside), **admin/page.tsx** og **storyboard/page.tsx**. Da prøver ikke Vercel å bygge sidene statisk under deploy (som kan feile uten Supabase), og de kjører på server ved hver forespørsel.

Etter at du har sjekket punkt 1–3 og eventuelt pushet på nytt, prøv deploy igjen. Hvis du fortsatt får 404, send gjerne:
- om det er forsiden (`/`), `/admin` eller hele siden som gir 404, og
- et utklipp fra **Build Logs** for det siste deploymentet.
