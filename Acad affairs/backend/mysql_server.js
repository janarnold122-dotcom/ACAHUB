import express from 'express';
import userRoutes from './routes/user.js';
import studentRoutes from './routes/student.js';
import facultyRoutes from './routes/faculty.js';

const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('La Consolacion College Bacolod - Academic Affairs Portal API');
});

app.use('/user', userRoutes);
app.use('/student', studentRoutes);
app.use('/faculty', facultyRoutes);

app.listen(port, () => {
  console.log(`LCCB Academic Affairs API listening at http://localhost:${port}`);
});
