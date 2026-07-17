# PolyFauna - Presupuesto de performance

Ultima medicion: 2026-07-17 sobre el build local posterior a `caa3a21`.

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
- JS total gzip: 729.8 KiB / 720 KiB — excede por 9.8 KiB.
- Archivos JS generados: 112.

Por tanto, `npm run perf:budget` y la etapa final de `npm run verify` quedan en rojo hasta reducir JS total o aprobar explicitamente un nuevo presupuesto con su tradeoff documentado. No se debe describir el estado actual como "verify completo en verde".

## Auditoria de navegacion del 2026-07-17

La prueba publica combino respuestas HTTP reales, recorrido visible del shell y revision de la ruta critica de cada cambio de seccion:

- primera solicitud completa observada: 668 ms, incluyendo resolucion DNS y establecimiento TLS;
- cuatro solicitudes posteriores: 265-293 ms totales;
- JS y CSS iniciales no aumentaron con la optimizacion;
- Radio, Podcasts, Event Terminal y Blog renderizaron correctamente en el recorrido local posterior al cambio, sin errores de consola.

La transicion anterior usaba `AnimatePresence mode="wait"`: esperaba una salida de 220 ms antes de montar la entrada, tambien de 220 ms, y aplicaba blur. La transicion actual monta salida y entrada en paralelo con `popLayout`, dura 140 ms, no usa blur y restablece el scroll sin animacion. El tiempo visual programado baja de hasta 440 ms a 140 ms, una reduccion maxima de 300 ms.

Los chunks de secciones probables se solicitan durante tiempo ocioso y tambien con hover, foco o `pointerdown`. La precarga automatica se omite con `Save-Data`, `slow-2g` o `2g` para no mejorar la velocidad aparente a costa del plan de datos del usuario.

## Cuidado con builds sin `.env`

Si `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no estan definidas al correr `npm run build` (por ejemplo, en un worktree nuevo sin `.env`), `src/lib/customSupabaseClient.js` lanza un error incondicional en la evaluacion del modulo. El bundler detecta que ese `throw` es alcanzable siempre y elimina `@supabase/supabase-js` (y todo lo que depende de el) como codigo muerto, lo que reduce artificialmente el JS inicial reportado (~91 KiB en vez de ~160 KiB medidos con credenciales reales). Antes de comparar o reportar numeros de este presupuesto, confirmar que el build corrio con un `.env` valido.

## Reglas de cuidado

- PDF, scanner QR, admin y dashboards pesados deben permanecer lazy.
- No importar `html5-qrcode` en el top-level de paginas si solo se usa al montar el lector.
- No agrupar todas las dependencias PDF en un unico chunk gigante.
- Si aparece un chunk lazy sobre 260 KiB gzip, revisar si puede separarse por paquete o por flujo.
- Antes de ventas publicas, ejecutar Lighthouse/Web Vitals en movil real o throttling equivalente.
