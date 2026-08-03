import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { requestTimeout } from './middleware/requestTimeout';
import { apiRateLimiter } from './middleware/apiRateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { documentRouter } from './routes/document.routes';
import { searchRouter } from './routes/search.routes';
import { chatRouter } from './routes/chat.routes';
import { adminRouter } from './routes/admin.routes';

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
app.use(requestTimeout);
app.use(requestLogger);

app.use(healthRouter);
app.use('/auth', authRouter);

// Apply general API rate limiting to all /api routes
app.use('/api', apiRateLimiter);
app.use('/api/documents', documentRouter);
app.use('/api/search', searchRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);
