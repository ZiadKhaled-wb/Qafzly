import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => res.json({ message: 'Lesson routes placeholder' }));
export default router;
