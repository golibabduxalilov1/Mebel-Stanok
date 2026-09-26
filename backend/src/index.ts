import http from 'http';
import { env } from './env';
import { createApp } from './app';
import { initSocket } from './lib/socket';
import { storage } from './lib/storage';

async function main() {
  await storage.ensureReady();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    console.log(`Silknode Machine API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
