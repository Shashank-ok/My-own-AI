import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import openApiSpec from '../docs/openapi.json';
import { config } from '../config/env';

export const docsRouter = Router();

// Raw OpenAPI JSON spec endpoint
docsRouter.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(openApiSpec);
});

// Serve interactive Swagger UI documentation in development/non-production environments
if (config.env !== 'production') {
  docsRouter.use('/', swaggerUi.serve, swaggerUi.setup(openApiSpec));
} else {
  docsRouter.get('/', (_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: 'API documentation UI is disabled in production mode.',
      },
    });
  });
}
