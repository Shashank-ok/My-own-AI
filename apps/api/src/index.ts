import { app } from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`🚀 Express API running on http://localhost:${config.port} [${config.env}]`);
  console.log(`📡 C++ Engine URL : ${config.cppEngineUrl}`);
  console.log(`🦙 Ollama URL     : ${config.ollamaUrl}`);
});

function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
