import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => res.json({ message: 'Module routes placeholder' }));
export default router;
