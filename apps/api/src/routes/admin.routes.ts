import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/authenticate';
import { validateParams } from '../middleware/validate';
import { SyncService } from '../services/sync.service';
import { namespaceParamSchema } from '../schemas/admin.schema';

export const adminRouter = Router();
const syncService = new SyncService();

adminRouter.use(authenticateToken);

/**
 * GET /api/admin/namespaces/:namespace/status
 */
adminRouter.get(
  '/namespaces/:namespace/status',
  validateParams(namespaceParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const namespace = req.params.namespace;
      const userId = req.user!.userId;
      const consistency = await syncService.checkNamespaceConsistency(namespace, userId);
      res.status(200).json(consistency);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/admin/namespaces/:namespace/check
 */
adminRouter.get(
  '/namespaces/:namespace/check',
  validateParams(namespaceParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const namespace = req.params.namespace;
      const userId = req.user!.userId;
      const result = await syncService.checkNamespaceConsistency(namespace, userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/admin/namespaces/:namespace/rebuild
 */
adminRouter.post(
  '/namespaces/:namespace/rebuild',
  validateParams(namespaceParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const namespace = req.params.namespace;
      const userId = req.user!.userId;
      const result = await syncService.rebuildNamespace(namespace, userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);
