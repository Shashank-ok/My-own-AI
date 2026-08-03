import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/authenticate';
import { IngestionService } from '../services/ingestion.service';
import { DocumentModel } from '../models/Document';

export const documentRouter = Router();
const ingestionService = new IngestionService();

const createDocumentSchema = z.object({
  title: z.string().min(1, 'Document title is required'),
  text: z.string().min(1, 'Document text content is required'),
  originalFileName: z.string().optional(),
  mimeType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  chunkSize: z.number().int().positive().optional(),
  chunkOverlap: z.number().int().nonnegative().optional(),
});

const retryDocumentSchema = z.object({
  text: z.string().min(1, 'Document text content is required for retry'),
});

// All routes require authentication
documentRouter.use(authenticateToken);

/**
 * POST /api/documents — Ingest a new document
 */
documentRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = createDocumentSchema.safeParse(req.body);
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
    const doc = await ingestionService.ingestDocument({
      ownerId: userId,
      ...parseResult.data,
    });

    res.status(201).json({ document: doc });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents — List all documents belonging to authenticated user
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
 * GET /api/documents/:id — Get a single document by ID for authenticated user
 */
documentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const documentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      res.status(400).json({ error: { message: 'Invalid document ID format' } });
      return;
    }

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
});

/**
 * DELETE /api/documents/:id — Delete document, MongoDB chunks, and C++ engine vectors
 */
documentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const documentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      res.status(400).json({ error: { message: 'Invalid document ID format' } });
      return;
    }

    const result = await ingestionService.deleteDocument(userId, documentId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/documents/:id/retry — Retry ingestion for a failed document
 */
documentRouter.post('/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = retryDocumentSchema.safeParse(req.body);
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
    const documentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      res.status(400).json({ error: { message: 'Invalid document ID format' } });
      return;
    }

    const doc = await ingestionService.retryIngestion(
      userId,
      documentId,
      parseResult.data.text,
    );

    res.status(200).json({ document: doc });
  } catch (error) {
    next(error);
  }
});
