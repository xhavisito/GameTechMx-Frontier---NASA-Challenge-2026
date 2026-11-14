import { createGameServer } from './server.js';

const configuredPort = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535) throw new Error('PORT must be an integer from 1 to 65535');
const game = createGameServer({ corsOrigins: process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) });
const port = await game.listen(configuredPort);
console.log(`GameTechMx Frontier mission server listening on port ${port}`);
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await game.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
