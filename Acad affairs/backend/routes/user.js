import { Router } from 'express';
import * as userController from '../controllers/userController.js';

const router = Router();

router.get('/', userController.getUserHome);
router.get('/profile', userController.getUserProfile);
router.get('/settings', userController.getUserSettings);
router.post('/add', userController.addUser);
router.get('/view', userController.listUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

export default router;
