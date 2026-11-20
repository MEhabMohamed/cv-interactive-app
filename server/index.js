import { createServer } from './app.js';
import { env } from './lib/config/env.js';

const server = createServer();
server.listen(env.port, () => {
  console.log(`CV Interactive API Proxy running on port ${env.port} (${env.nodeEnv})`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

