import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/authenticate';
import { validateBody, validateParams } from '../middleware/validate';
import { IngestionService } from '../services/ingestion.service';
import { DocumentModel } from '../models/Document';
import {
  createDocumentSchema,
  retryDocumentSchema,
  documentIdParamSchema,
} from '../schemas/document.schema';

export const documentRouter = Router();
const ingestionService = new IngestionService();

documentRouter.use(authenticateToken);

/**
 * POST /api/documents — Ingest new document
 */
documentRouter.post(
  '/',
  validateBody(createDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const doc = await ingestionService.ingestDocument({
        ownerId: userId,
        ...req.body,
      });

      res.status(201).json({ document: doc });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/documents — List all user's documents
 */
documentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const documents = await DocumentModel.find({
      ownerId: new mongoose.Types.ObjectId(userId),
    }).sort({ createdAt: -1 });

    res.status(200).json({ documents });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:id — Get document details
 */
documentRouter.get(
  '/:id',
  validateParams(documentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const documentId = req.params.id;

      const doc = await DocumentModel.findOne({
        _id: new mongoose.Types.ObjectId(documentId),
        ownerId: new mongoose.Types.ObjectId(userId),
      });

      if (!doc) {
        res.status(404).json({ error: { message: 'Document not found' } });
        return;
      }

      res.status(200).json({ document: doc });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/documents/:id — Delete document
 */
documentRouter.delete(
  '/:id',
  validateParams(documentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const documentId = req.params.id;

      const result = await ingestionService.deleteDocument(userId, documentId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/documents/:id/retry — Retry failed document ingestion
 */
documentRouter.post(
  '/:id/retry',
  validateParams(documentIdParamSchema),
  validateBody(retryDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const documentId = req.params.id;

      const doc = await ingestionService.retryIngestion(
        userId,
        documentId,
        req.body.text,
      );

      res.status(200).json({ document: doc });
    } catch (error) {
      next(error);
    }
  },
);
