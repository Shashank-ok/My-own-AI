import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';

export const app: Express = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy: Origin not allowed'));
      }
    },
  }),
);
app.use(express.json({ limit: config.requestSizeLimit }));
app.use(requestLogger);

app.use(healthRouter);
app.use('/auth', authRouter);

app.use(errorHandler);
