# GameTechMx Frontier

**GameTechMx Frontier** es un juego educativo bilingüe donde una persona o un equipo diseña, negocia y simula una misión espacial completa. Cada instrumento, subsistema, órbita, lanzador y red terrena cambia en tiempo real la masa, energía, presupuesto, enlace de datos, almacenamiento y calendario.

El proyecto se creó para el reto *Space Mission Design Game* descrito para NASA Space Apps Challenge 2026. Es un proyecto independiente: no usa insignias ni logotipos de NASA y no implica respaldo de NASA.

## Demo

La URL prevista después de subir este repositorio y activar GitHub Pages es:

`https://xhavisito.github.io/GameTechMx-Frontier---NASA-Challenge-2026/`

La URL se deja como **pendiente de verificación** porque la entrega se genera como ZIP para que el equipo la suba. El workflow incluido publicará el cliente desde `main`.

## Ejecutar

Requiere Node 20.

```bash
nvm use
npm install
npm run dev
```

Cliente: `http://localhost:5173`. Servidor de salas: `http://localhost:3001` (`/health` comprueba su estado).

```bash
npm test        # motor, puntuación, reglas de equipo y protocolo de salas
npm run build   # cliente estático + servidor Node
npm run preview # vista del build del cliente
```

## Cómo se juega

1. Elige individual, equipo local, equipo online o sandbox, y una dificultad.
2. Lee el briefing y diseña objetivo, órbita, instrumentos, subsistemas, red y lanzador.
3. Sigue las barras de recursos y los avisos causales mientras haces cambios.
4. Completa la revisión PDR/CDR y lanza con una semilla reproducible.
5. Decide cómo responder a eventos, revisa la puntuación y rediseña conservando la comparación.

El modo local funciona sin servidor con 2–4 personas, roles combinados, propuestas, votación, paso del dispositivo, chat y registro. El modo online usa códigos de seis caracteres y mantiene el estado autoritativo en memoria. Las salas terminan al reiniciar el servidor.

## Arquitectura

```text
client/  React + TypeScript + Vite + Tailwind + Zustand
server/  Node + Socket.IO; salas autoritativas y validación de mensajes
shared/  tipos, catálogos y motor TypeScript puro y determinista
docs/    diseño, entrega y guiones de demo
```

La UI nunca calcula el resultado de vuelo. `shared/engine` expone `validateDesign`, `calculateResources`, `simulateMission`, `scoreMission` y `generateReport`. El mismo diseño, respuestas y semilla siempre producen la misma línea de tiempo.

## Despliegue

GitHub Actions ejecuta tests y build en cada push y pull request. En `main`, sube `client/dist` a Pages.

1. Sube todos los archivos a la rama `main`.
2. En **Settings → Pages → Build and deployment**, selecciona **GitHub Actions**.
3. Para multijugador online, despliega `server/` en un proveedor Node 20 con WebSocket y configura `CORS_ORIGINS=https://xhavisito.github.io`.
4. Crea la variable de Actions `VITE_SERVER_URL` con la URL HTTPS del servidor. Sin ella, la demo estática mantiene individual, sandbox y hot-seat.

No subas `.env`. Consulta [.env.example](.env.example).

## Datos, fuentes y límites

Las masas, precios, fiabilidades, contactos y puntuaciones son aproximaciones educativas inventadas para producir decisiones comprensibles. Los órdenes de magnitud y conceptos se documentaron con recursos públicos:

- [NASA Small Spacecraft Systems Virtual Institute](https://www.nasa.gov/smallsat-institute/sst-soa/)
- [NASA Space Communications and Navigation](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/)
- [NASA Basics of Space Flight](https://science.nasa.gov/learn/basics-of-space-flight/)
- [NASA Earthdata](https://www.earthdata.nasa.gov/)
- [NASA Landsat](https://science.nasa.gov/mission/landsat/)
- [NASA James Webb Space Telescope](https://science.nasa.gov/mission/webb/)
- [NASA Mars Exploration](https://science.nasa.gov/mars/)

El modelo no hace propagación orbital ni diseño de enlace o análisis térmico de ingeniería. Sus fórmulas y simplificaciones están en [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

## Entregables

- [Project submission](docs/PROJECT_SUBMISSION.md)
- [Guion de demo](docs/DEMO_SCRIPT.md)
- [Diseño del juego y fórmulas](docs/GAME_DESIGN.md)
- [Guía para subir y publicar](docs/UPLOAD_TO_GITHUB.md)

Licencia MIT. Hecho por el equipo GameTechMx Frontier con React, TypeScript, Vite, Zustand, Socket.IO y Vitest.
