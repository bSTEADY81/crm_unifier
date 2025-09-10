import app from './app.js';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';

const port = config.port;

app.listen(port, () => {
  logger.info({ port }, 'Server started');
});

export default app;