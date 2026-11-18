import { Router } from 'express';
import * as studentController from '../controllers/studentController.js';

const router = Router();

router.get('/', studentController.getStudentHome);
router.get('/profile', studentController.getStudentProfile);
router.get('/settings', studentController.getStudentSettings);
router.post('/add', studentController.addStudent);
router.get('/view', studentController.listStudents);
router.get('/:id', studentController.getStudentById);
router.put('/:id', studentController.updateStudent);
router.delete('/:id', studentController.deleteStudent);

export default router;
