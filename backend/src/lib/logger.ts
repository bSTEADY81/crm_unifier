import pino from 'pino';
import { config } from '../config/index.js';

const transport = config.logging.format === 'pretty' ? {
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'hostname,pid'
    }
  }
} : {};

export const logger = pino({
  level: config.logging.level,
  ...transport
});

// Create child loggers for different components
export const createLogger = (component: string) => {
  return logger.child({ component });
};