import { Router } from 'express';
import * as facultyController from '../controllers/facultyController.js';

const router = Router();

router.get('/', facultyController.getFacultyHome);
router.get('/profile', facultyController.getFacultyProfile);
router.get('/settings', facultyController.getFacultySettings);
router.post('/add', facultyController.addFaculty);
router.get('/view', facultyController.listFaculty);
router.get('/:id', facultyController.getFacultyById);
router.put('/:id', facultyController.updateFaculty);
router.delete('/:id', facultyController.deleteFaculty);

export default router;
