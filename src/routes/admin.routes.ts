import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => res.json({ message: 'Admin routes placeholder' }));
export default router;
