import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/authenticate';
import { RagService } from '../services/rag.service';

export const chatRouter = Router();
const ragService = new RagService();

const askQuestionSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  conversationId: z.string().optional(),
  k: z.number().int().positive().optional(),
  documentIds: z.array(z.string()).optional(),
});

chatRouter.use(authenticateToken);

/**
 * POST /api/chat/ask — Ask a question using RAG workflow
 */
chatRouter.post('/ask', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = askQuestionSchema.safeParse(req.body);
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
    const response = await ragService.askQuestion({
      ownerId: userId,
      ...parseResult.data,
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/conversations — List all user's conversations
 */
chatRouter.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const conversations = await ragService.listConversations(userId);
    res.status(200).json({ conversations });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/conversations/:id — Get single conversation with full history
 */
chatRouter.get('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;
    const conversation = await ragService.getConversation(userId, conversationId);
    res.status(200).json({ conversation });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chat/conversations/:id — Delete a conversation
 */
chatRouter.delete('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;
    const result = await ragService.deleteConversation(userId, conversationId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
