# GameTechMx Frontier

Juego de exploración espacial en mundo abierto, pensado para todas las edades (NASA Space Apps 2026). Empiezas en la Tierra, preparas tu nave, despegas y exploras tres mundos:

- **Marte**: maneja el rover, busca muestras, esquiva meteoritos y regresa al módulo.
- **Júpiter**: vuela alrededor del planeta y escanea 4 zonas para completar el mapa de su atmósfera.
- **Miller** (el planeta oceánico de *Interstellar*): navega entre olas gigantes y busca 3 señales de vida.

Se juega con **teclado** (WASD / flechas, Shift, E), **control** (stick, A) o **pantalla táctil** (joystick y botón E). Español e inglés.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de la lógica del mundo
npm run build      # build estático (GitHub Pages)
```

Todo está en `client/` (React + TypeScript + Vite + Three.js, estilo low-poly): `src/world/` contiene el mundo de la Tierra y las tres misiones; `src/three/` ruido determinista y geometrías low-poly. Mundo y puntuación son deterministas por semilla y tienen pruebas en `marsWorld.test.ts`.

## Despliegue

GitHub Actions ejecuta pruebas y build en cada push. En `main` publica `client/dist` en GitHub Pages (Settings → Pages → Source: GitHub Actions).

> `docs/` conserva notas del diseño anterior (simulador técnico) y puede estar desactualizado.
