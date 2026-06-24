# PolyFauna - Presupuesto de performance

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

## Reglas de cuidado

- PDF, scanner QR, admin y dashboards pesados deben permanecer lazy.
- No importar `html5-qrcode` en el top-level de paginas si solo se usa al montar el lector.
- No agrupar todas las dependencias PDF en un unico chunk gigante.
- Si aparece un chunk lazy sobre 260 KiB gzip, revisar si puede separarse por paquete o por flujo.
- Antes de ventas publicas, ejecutar Lighthouse/Web Vitals en movil real o throttling equivalente.
