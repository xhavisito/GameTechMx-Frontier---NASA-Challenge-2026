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


## Niveles de dificultad / Difficulty levels

| Nivel | Decisiones | Pruebas antes de despegar | Misión |
|---|---|---|---|
| Fácil | destino + 1 herramienta | ninguna | 3 hallazgos, sin tiempo |
| Medio | + cohete y energía | 1 (combustible) | 4 hallazgos, más peligros |
| Difícil | + presupuesto y hasta 3 instrumentos | 4 (Δv, masa, costo, energía) | 5 hallazgos, 1 evento en el viaje, tiempo límite, combustible limitado en Júpiter |
| Experto | paneles, batería y escudo térmico en números | 7 con márgenes | 6 hallazgos, 2 eventos, poco tiempo, el casco del submarino aguanta menos |

Miller es un océano: el submarino (modelo CAD `sub`) sube y baja (Espacio/Q y C/Z, gatillos del control, botones ▲▼ en touch). El rover en Tierra y Marte es el ensamble CAD `rover_assem`. Los modelos están en `client/public/models/` (convertidos de STEP a GLB de pocos polígonos).

## Roguelite: taller, contratos y enemigos / Roguelite: workshop, contracts and enemies

- **Chatarra y taller.** Cada misión paga chatarra (más si el nivel es difícil o el contrato es arriesgado; si la nave explota se paga la mitad). En el **Taller** (botón en el hangar o al terminar una misión) hay un árbol de mejoras por nave: rover, orbitador de Júpiter, submarino y cohete. Las mejoras tienen requisitos, cuestan más cada nivel, se guardan en `localStorage` (`frontier-meta-v1`) y cambian el aspecto de la nave (visor 3D giratorio). Las del cohete suben Δv, carga y presupuesto de las pruebas y reducen el daño de los eventos.
- **Armas.** Empiezas sin arma: solo esquivas. Con *Láser / Cañón / Torpedos* (R, LB o botón en touch) puedes derrotar enemigos; auto-apunta al más cercano. Más niveles = más daño y recarga rápida.
- **Contratos.** Además de recolectar: reparar antenas/boyas/nodos (mantén E), rescatar una sonda/satélite/cápsula y llevarla a casa (vas más lento), fotografiar (Marte, requiere cámara). Más contratos disponibles en niveles altos; cada uno cambia el peligro y la paga.
- **Enemigos y ladrón.** Bichos (Marte), drones (Júpiter) y peces abisales (Miller); aparecen por oleadas, crecen con el tiempo y en Difícil/Experto hay élites. Un ladrón (mapache espacial / pulpo ladrón) puede robar una muestra, energía o la carga; atrápalo con E o disparándole.
- **Cartas de misión.** Antes de cada misión eliges 1 de 3 cartas temporales; algunas son arriesgadas.
- **Dificultad.** `levels.ts › modsFor` ahora también controla cantidad, velocidad, vida y daño de enemigos, oleadas, probabilidad del ladrón y multiplicador de chatarra.
- Lógica pura con pruebas: `meta.ts`, `combat.ts`, `pois.ts`, `contracts.ts`, `runkit.ts`, `design.ts`.
