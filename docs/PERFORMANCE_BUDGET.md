# PolyFauna - Presupuesto de performance

Ultima medicion: 2026-07-17 sobre el build del commit `b2ac2ec`.

El presupuesto se ejecuta con:

```bash
npm run perf:budget
```

Tambien corre dentro de:

```bash
npm run verify
```

## Metricas actuales

El script `tools/performance-budget.js` mide el build generado en `dist/`:

- JS inicial gzip: suma de `script type="module"` y `modulepreload` de `dist/index.html`.
- CSS inicial gzip: hojas de estilo enlazadas desde `dist/index.html`.
- Chunk lazy mayor gzip: el chunk diferido mas pesado.
- JS total gzip: suma de todos los assets JS.

## Limites actuales

- JS inicial gzip: 190 KiB.
- CSS inicial gzip: 30 KiB.
- Chunk lazy mayor gzip: 260 KiB.
- JS total gzip: 720 KiB.

Estos limites son un baseline de control, no una meta final. Si una funcionalidad importante requiere subirlos, debe venir con una nota de tradeoff y, si es posible, una compensacion en otro punto del bundle.

## Estado actual

- JS inicial gzip: 173.7 KiB / 190 KiB — cumple.
- CSS inicial gzip: 18.7 KiB / 30 KiB — cumple.
- Chunk lazy mayor gzip: 124.7 KiB / 260 KiB — cumple (`vendor-pdf`).
- JS total gzip: 729.4 KiB / 720 KiB — excede por 9.4 KiB.
- Archivos JS generados: 112.

Por tanto, `npm run perf:budget` y la etapa final de `npm run verify` quedan en rojo hasta reducir JS total o aprobar explicitamente un nuevo presupuesto con su tradeoff documentado. No se debe describir el estado actual como "verify completo en verde".

## Cuidado con builds sin `.env`

Si `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no estan definidas al correr `npm run build` (por ejemplo, en un worktree nuevo sin `.env`), `src/lib/customSupabaseClient.js` lanza un error incondicional en la evaluacion del modulo. El bundler detecta que ese `throw` es alcanzable siempre y elimina `@supabase/supabase-js` (y todo lo que depende de el) como codigo muerto, lo que reduce artificialmente el JS inicial reportado (~91 KiB en vez de ~160 KiB medidos con credenciales reales). Antes de comparar o reportar numeros de este presupuesto, confirmar que el build corrio con un `.env` valido.

## Reglas de cuidado

- PDF, scanner QR, admin y dashboards pesados deben permanecer lazy.
- No importar `html5-qrcode` en el top-level de paginas si solo se usa al montar el lector.
- No agrupar todas las dependencias PDF en un unico chunk gigante.
- Si aparece un chunk lazy sobre 260 KiB gzip, revisar si puede separarse por paquete o por flujo.
- Antes de ventas publicas, ejecutar Lighthouse/Web Vitals en movil real o throttling equivalente.
