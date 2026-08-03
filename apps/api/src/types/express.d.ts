import { AuthUserPayload } from '../middleware/authenticate';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
