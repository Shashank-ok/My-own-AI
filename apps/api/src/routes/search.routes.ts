import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { SearchService } from '../services/search.service';
import { searchRequestSchema } from '../schemas/search.schema';

export const searchRouter = Router();
const searchService = new SearchService();

searchRouter.use(authenticateToken);

/**
 * POST /api/search — Authenticated semantic vector search
 */
searchRouter.post(
  '/',
  validateBody(searchRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const searchResponse = await searchService.search({
        ownerId: userId,
        ...req.body,
      });

      res.status(200).json(searchResponse);
    } catch (error) {
      next(error);
    }
  },
);
