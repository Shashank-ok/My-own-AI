import { app } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './db/connection';

async function startServer() {
  try {
    await connectDatabase();
    const server = app.listen(config.port, () => {
      console.log(`🚀 Express API running on http://localhost:${config.port} [${config.env}]`);
      console.log(`📡 C++ Engine URL : ${config.cppEngineUrl}`);
      console.log(`🦙 Ollama URL     : ${config.ollamaUrl}`);
    });

    async function gracefulShutdown(signal: string) {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      await disconnectDatabase();
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
