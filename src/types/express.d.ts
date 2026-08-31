import { AuthPayload } from '../middleware/authenticate';

declare global {
    namespace Express {
        interface Request {
        user?: AuthPayload;
        }
    }
}

export {};