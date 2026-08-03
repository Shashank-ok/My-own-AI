import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/authenticate';
import { validateBody, validateParams } from '../middleware/validate';
import { RagService } from '../services/rag.service';
import { askQuestionSchema, conversationIdParamSchema } from '../schemas/chat.schema';

export const chatRouter = Router();
const ragService = new RagService();

chatRouter.use(authenticateToken);

/**
 * POST /api/chat/ask — Ask question using RAG workflow
 */
chatRouter.post(
  '/ask',
  validateBody(askQuestionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const response = await ragService.askQuestion({
        ownerId: userId,
        ...req.body,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

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
 * GET /api/chat/conversations/:id — Get conversation details
 */
chatRouter.get(
  '/conversations/:id',
  validateParams(conversationIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const conversationId = req.params.id;
      const conversation = await ragService.getConversation(userId, conversationId);
      res.status(200).json({ conversation });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/chat/conversations/:id — Delete conversation
 */
chatRouter.delete(
  '/conversations/:id',
  validateParams(conversationIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const conversationId = req.params.id;
      const result = await ragService.deleteConversation(userId, conversationId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
);
