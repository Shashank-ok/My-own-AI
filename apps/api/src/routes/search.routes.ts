import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/authenticate';
import { SearchService } from '../services/search.service';

export const searchRouter = Router();
const searchService = new SearchService();

const searchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  k: z.number().int().positive().optional().default(5),
  documentIds: z.array(z.string()).optional(),
  algorithm: z.enum(['bruteforce', 'kdtree', 'hnsw']).optional(),
  metric: z.enum(['cosine', 'euclidean', 'manhattan']).optional(),
});

searchRouter.use(authenticateToken);

/**
 * POST /api/search — Authenticated semantic vector search
 */
searchRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = searchRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          details: parseResult.error.format(),
        },
      });
      return;
    }

    const userId = req.user!.userId;
    const searchResponse = await searchService.search({
      ownerId: userId,
      ...parseResult.data,
    });

    res.status(200).json(searchResponse);
  } catch (error) {
    next(error);
  }
});
