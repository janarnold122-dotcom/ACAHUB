// backend/index.js - Complete PostgreSQL / Supabase API Server for LCCB Academic Affairs
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool, updateConnection } from './db.js';

import studentRoutes from './routes/student.js';
import facultyRoutes from './routes/faculty.js';
import userRoutes from './routes/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// -------------------------------------------------------------
// Health Check
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      success: true,
      status: 'OK',
      database: 'connected',
      engine: 'PostgreSQL / Supabase',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'DB ERROR',
      message: 'Cannot connect to Supabase PostgreSQL: ' + err.message
    });
  }
});

// -------------------------------------------------------------
// Database Config & Live Reconnect Endpoint
// -------------------------------------------------------------
app.post('/api/config/db-connect', async (req, res) => {
  const { password, connectionString } = req.body;
  let targetConnStr = connectionString?.trim();

  if (!targetConnStr) {
    if (!password) {
      return res.status(400).json({ success: false, message: 'Database password or connection string is required.' });
    }
    const safePass = encodeURIComponent(password.trim());
    targetConnStr = `postgresql://postgres:${safePass}@db.uknbhdbrqhoomepalkct.supabase.co:5432/postgres`;
  }

  try {
    await updateConnection(targetConnStr);
    res.json({
      success: true,
      message: 'Connected to Supabase PostgreSQL database successfully!'
    });
  } catch (err) {
    console.error('Failed to update DB connection:', err.message);
    res.status(400).json({
      success: false,
      message: 'Supabase authentication failed: ' + err.message
    });
  }
});

// -------------------------------------------------------------
// Auth: Login
// -------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  try {
    const cleanUser = username.trim().toLowerCase();

    // Map shorthand login usernames to real emails in the DB
    // This ensures dean_sslate → dean.cas@lccb.edu.ph (SSLATE dean), etc.
    const USERNAME_TO_EMAIL = {
      'vpaa':        'vpaa@lccb.edu.ph',
      'dean_sbit':   'dean.ccs@lccb.edu.ph',
      'dean_shtm':   'dean.cba@lccb.edu.ph',
      'dean_sslate': 'dean.cas@lccb.edu.ph',
      'dean_sarfaid':'dean.con@lccb.edu.ph',
      'chair_sbit':  'chair.ccs@lccb.edu.ph',
      'chair_it':    'chair.ccs@lccb.edu.ph',
      'chair_shtm':  'chair.cba@lccb.edu.ph',
      'faculty1':    'jose.ramirez@lccb.edu.ph',
    };

    // Resolve to email if shorthand matches, otherwise use as-is
    const lookupEmail = USERNAME_TO_EMAIL[cleanUser] || cleanUser;

    // Find user in PostgreSQL — search by resolved email, email prefix, or name
    const users = await query(
      `SELECT u.*, c.name AS college_name, c.code AS college_code 
       FROM users u 
       LEFT JOIN colleges c ON u.college_id = c.id 
       WHERE LOWER(u.email) = ? 
          OR LOWER(SPLIT_PART(u.email, '@', 1)) = ?
          OR LOWER(REPLACE(u.name, ' ', '')) LIKE ?`,
      [lookupEmail, lookupEmail, `%${lookupEmail}%`]
    );

    let user = users[0];

    // Secondary fallback: resolve by role + college code from the username pattern
    // e.g. "dean_sslate"  → role=dean, college code=sslate
    //      "chair_it"     → role=program_chair, college code=it
    if (!user) {
      let targetRole = null;
      let collegeCode = null;

      if (cleanUser === 'vpaa') {
        targetRole = 'vpaa';
      } else if (cleanUser.startsWith('dean_')) {
        targetRole = 'dean';
        collegeCode = cleanUser.slice('dean_'.length);
      } else if (cleanUser.startsWith('chair_')) {
        targetRole = 'program_chair';
        collegeCode = cleanUser.slice('chair_'.length);
      } else if (cleanUser.startsWith('faculty')) {
        targetRole = 'faculty';
      }

      if (targetRole) {
        if (collegeCode) {
          const byRoleCollege = await query(
            `SELECT u.*, c.name AS college_name, c.code AS college_code 
             FROM users u 
             LEFT JOIN colleges c ON u.college_id = c.id 
             WHERE u.role = ? AND LOWER(c.code) = ? LIMIT 1`,
            [targetRole, collegeCode]
          );
          user = byRoleCollege[0];
          if (!user) {
            const byRoleCollegeName = await query(
              `SELECT u.*, c.name AS college_name, c.code AS college_code 
               FROM users u 
               LEFT JOIN colleges c ON u.college_id = c.id 
               WHERE u.role = ? AND LOWER(c.name) LIKE ? LIMIT 1`,
              [targetRole, `%${collegeCode}%`]
            );
            user = byRoleCollegeName[0];
          }
        } else {
          const byRole = await query(
            `SELECT u.*, c.name AS college_name, c.code AS college_code 
             FROM users u 
             LEFT JOIN colleges c ON u.college_id = c.id 
             WHERE u.role = ? LIMIT 1`,
            [targetRole]
          );
          user = byRole[0];
        }
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Role-specific passwords requested by user:
    // - VPAA (Super Admin): vpaa123
    // - Program Chair: chair123
    // - Faculty: faculty123
    // - Deans: keep existing credentials (no change)
    const inputPass = String(password || '').trim();
    if (user.role === 'vpaa') {
      if (inputPass !== 'vpaa123') {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }
    } else if (user.role === 'program_chair') {
      if (inputPass !== 'chair123') {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }
    } else if (user.role === 'faculty') {
      if (inputPass !== 'faculty123') {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }
    }

    const token = 'token_' + Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString('base64');
    
    const safeUser = {
      id: user.id,
      username: username.trim(),
      name: user.name,
      email: user.email,
      role: user.role,
      college_id: user.college_id,
      college_name: user.college_name,
      college_code: user.college_code,
      department: user.department || null
    };

    return res.json({
      success: true,
      user: safeUser,
      token,
      message: 'Login successful'
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Database query failed: ' + err.message });
  }
});

// -------------------------------------------------------------
// Colleges
// -------------------------------------------------------------
app.get('/api/colleges', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM colleges ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Users
// -------------------------------------------------------------
app.get('/api/users', async (req, res) => {
  try {
    const { role } = req.query;
    let sql = `SELECT u.*, c.name AS college_name, c.code AS college_code 
               FROM users u 
               LEFT JOIN colleges c ON u.college_id = c.id`;
    const params = [];
    if (role) {
      sql += ' WHERE u.role = ?';
      params.push(role);
    }
    sql += ' ORDER BY u.id ASC';
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, role, college_id } = req.body;
    const [newUser] = await query(
      'INSERT INTO users (name, email, role, college_id) VALUES (?, ?, ?, ?) RETURNING *',
      [name, email.toLowerCase(), role || 'faculty', Number(college_id) || 1]
    );
    res.json({ success: true, data: newUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Rooms
// -------------------------------------------------------------
app.get('/api/rooms', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM rooms ORDER BY name ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { name, building, capacity, room_type } = req.body;
    const [newRoom] = await query(
      'INSERT INTO rooms (name, building, capacity, room_type) VALUES (?, ?, ?, ?) RETURNING *',
      [name, building, Number(capacity) || 30, room_type || 'lecture']
    );
    res.json({ success: true, data: newRoom });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    const rid = Number(req.params.id);
    await query('DELETE FROM rooms WHERE id = ?', [rid]);
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/rooms/occupancy', async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        r.id AS room_id,
        r.name AS room_name,
        r.building,
        r.capacity,
        r.room_type,
        COUNT(s.id) AS total_scheduled_classes,
        COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 2), 0.00) AS total_hours_used,
        ROUND((COUNT(s.id) / 72.0) * 100, 1) AS utilization_pct
      FROM rooms r
      LEFT JOIN schedules s ON r.id = s.room_id
      GROUP BY r.id, r.name, r.building, r.capacity, r.room_type
      ORDER BY r.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Faculty
// -------------------------------------------------------------
app.get('/api/faculty', async (req, res) => {
  try {
    const rows = await query(`
      SELECT f.*, c.name AS college_name, c.code AS college_code 
      FROM faculty f 
      LEFT JOIN colleges c ON f.college_id = c.id 
      ORDER BY f.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/faculty', async (req, res) => {
  try {
    const { name, email, college_id, employment_status, max_regular_hours, qualifications, preferred_days, preferred_start, preferred_end } = req.body;
    
    const userEmail = email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@lccb.edu.ph`;
    const [user] = await query(
      `INSERT INTO users (name, email, role, college_id) 
       VALUES (?, ?, 'faculty', ?) 
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name 
       RETURNING id`,
      [name, userEmail, college_id || 1]
    );

    const [newFac] = await query(
      `INSERT INTO faculty (user_id, name, email, college_id, employment_status, max_regular_hours, qualifications, preferred_days, preferred_start, preferred_end) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [
        user.id,
        name,
        userEmail,
        Number(college_id) || 1,
        employment_status || 'full_time',
        Number(max_regular_hours) || 24,
        qualifications || '',
        preferred_days || '',
        preferred_start || '07:00:00',
        preferred_end || '19:00:00'
      ]
    );
    res.json({ success: true, data: newFac });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/faculty/:id', async (req, res) => {
  try {
    await query('DELETE FROM faculty WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/faculty/load-summary', async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        f.id AS faculty_id,
        f.name AS faculty_name,
        f.college_id,
        f.employment_status,
        f.max_regular_hours,
        col.code AS college_code,
        COUNT(s.id)::int AS class_count,
        COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0)::numeric, 2), 0.00) AS total_hours,
        CASE 
          WHEN COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 0) > f.max_regular_hours 
          THEN ROUND((SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0) - f.max_regular_hours)::numeric, 2)
          ELSE 0.00 
        END AS overload_hours,
        COALESCE(ROUND((SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0) / NULLIF(f.max_regular_hours, 0) * 100)::numeric, 1), 0) AS utilization_pct,
        CASE 
          WHEN COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 0) > f.max_regular_hours THEN true
          ELSE false
        END AS is_overloaded
      FROM faculty f
      JOIN colleges col ON f.college_id = col.id
      LEFT JOIN schedules s ON f.id = s.faculty_id
      GROUP BY f.id, f.name, f.college_id, f.employment_status, f.max_regular_hours, col.code
      ORDER BY f.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Courses
// -------------------------------------------------------------
app.get('/api/courses', async (req, res) => {
  try {
    const { college_id } = req.query;
    let sql = `SELECT c.*, col.name AS college_name, col.code AS college_code 
               FROM courses c 
               LEFT JOIN colleges col ON c.college_id = col.id`;
    const params = [];
    if (college_id) {
      sql += ' WHERE c.college_id = ?';
      params.push(Number(college_id));
    }
    sql += ' ORDER BY c.code ASC';
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/courses', async (req, res) => {
  try {
    const { code, title, units, lecture_hours, lab_hours, requires_room_type, college_id, description, prerequisites, actor } = req.body;
    if (!code || !title) {
      return res.status(400).json({ success: false, message: 'Course code and title are required.' });
    }

    const [newCourse] = await query(
      `INSERT INTO courses (code, title, units, lecture_hours, lab_hours, requires_room_type, college_id, description, prerequisites)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [
        code.trim().toUpperCase(),
        title.trim(),
        Number(units) || 3,
        Number(lecture_hours) || 3,
        Number(lab_hours) || 0,
        requires_room_type || 'lecture',
        Number(college_id) || 1,
        description || '',
        prerequisites || 'None'
      ]
    );

    await query(
      'INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)',
      [actor || 'Dean', 'Created new course offering', `${newCourse.code} - ${newCourse.title}`]
    );

    res.json({ success: true, data: newCourse });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/courses/:id', async (req, res) => {
  try {
    const cid = Number(req.params.id);
    await query('DELETE FROM courses WHERE id = ?', [cid]);
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Sections
// -------------------------------------------------------------
app.get('/api/sections', async (req, res) => {
  try {
    const { college_id, status } = req.query;
    let sql = `
      SELECT sec.*, c.code AS course_code, c.title AS course_title 
      FROM sections sec 
      JOIN courses c ON sec.course_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (college_id) {
      sql += ' AND sec.college_id = ?';
      params.push(Number(college_id));
    }
    if (status) {
      sql += ' AND sec.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY c.code ASC, sec.section_code ASC';
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sections', async (req, res) => {
  try {
    const { course_id, section_code, term, program, expected_students, actor } = req.body;
    const courses = await query('SELECT * FROM courses WHERE id = ?', [course_id]);
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });
    const course = courses[0];

    const [newSec] = await query(
      `INSERT INTO sections (course_id, section_code, term, program, expected_students, status, college_id) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?) RETURNING *`,
      [course_id, section_code, term || '1st Sem 2026-2027', program || '', expected_students || 30, course.college_id]
    );

    await query(
      'INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)',
      [actor || 'Staff', 'Requested new section', `${course.code} ${section_code}`]
    );

    res.json({
      success: true,
      data: {
        ...newSec,
        course_code: course.code,
        course_title: course.title,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/sections/:id', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    await query('DELETE FROM sections WHERE id = ?', [sid]);
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Section Roster (Students)
app.get('/api/sections/:id/roster', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const rows = await query(`
      SELECT st.*, e.enrolled_at 
      FROM enrollments e 
      JOIN students st ON e.student_id = st.id 
      WHERE e.section_id = ?
      ORDER BY st.name ASC
    `, [sid]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sections/:id/roster', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    if (!sid || isNaN(sid)) {
      return res.status(400).json({ success: false, message: 'Valid section ID is required.' });
    }
    const { student_id, student_no, name, program, email } = req.body;
    let stid = student_id ? Number(student_id) : null;

    if (!stid && student_no && name) {
      let existing = await query('SELECT id FROM students WHERE student_no = ?', [student_no.trim()]);
      if (existing.length > 0) {
        stid = existing[0].id;
      } else {
        const studentEmail = email || `${student_no.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-4)}@student.lccb.edu.ph`;
        try {
          await query("SELECT setval(pg_get_serial_sequence('students', 'id'), COALESCE((SELECT MAX(id) FROM students), 1))");
        } catch {}
        const [newStudent] = await query(
          'INSERT INTO students (student_no, name, email, program, year_level) VALUES (?, ?, ?, ?, 1) RETURNING id',
          [student_no.trim(), name.trim(), studentEmail, program || 'BSIT']
        );
        stid = newStudent?.id;
      }
    }

    if (!stid) {
      return res.status(400).json({ success: false, message: 'Student ID or student number & name required.' });
    }

    await query('INSERT INTO enrollments (section_id, student_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [sid, stid]);
    res.json({ success: true, enrolled: true, student_id: stid });
  } catch (err) {
    console.error('Add student error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/sections/:id/roster', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const stid = Number(req.query.student_id || req.body.student_id);
    await query('DELETE FROM enrollments WHERE section_id = ? AND student_id = ?', [sid, stid]);
    res.json({ success: true, removed: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Section Assessments
app.get('/api/sections/:id/assessments', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const rows = await query('SELECT * FROM assessments WHERE section_id = ? ORDER BY id ASC', [sid]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sections/:id/assessments', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const { term_period, category, name, max_score, weight } = req.body;
    const [newAss] = await query(
      `INSERT INTO assessments (section_id, term_period, category, name, max_score, weight) 
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [sid, term_period || 'midterm', category || 'quiz', name || 'Assessment', Number(max_score) || 100, Number(weight) || 0]
    );
    res.json({ success: true, data: newAss });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/assessments/:id', async (req, res) => {
  try {
    const aid = Number(req.params.id);
    await query('DELETE FROM assessments WHERE id = ?', [aid]);
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Assessment Scores
app.get('/api/assessments/:id/scores', async (req, res) => {
  try {
    const aid = Number(req.params.id);
    const rows = await query('SELECT student_id, raw_score FROM scores WHERE assessment_id = ?', [aid]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/assessments/:id/scores', async (req, res) => {
  try {
    const aid = Number(req.params.id);
    const { student_id, raw_score } = req.body;
    await query(
      `INSERT INTO scores (assessment_id, student_id, raw_score) 
       VALUES (?, ?, ?) 
       ON CONFLICT (assessment_id, student_id) DO UPDATE SET raw_score = EXCLUDED.raw_score`,
      [aid, student_id, raw_score === null ? null : Number(raw_score)]
    );
    res.json({ success: true, saved: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Section Attendance
app.get('/api/sections/:id/attendance', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const { date } = req.query;
    let sql = 'SELECT * FROM attendance WHERE section_id = ?';
    const params = [sid];
    if (date) {
      sql += ' AND date = ?';
      params.push(date);
    }
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sections/:id/attendance', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const { student_id, date, status } = req.body;
    await query(
      `INSERT INTO attendance (section_id, student_id, date, status) 
       VALUES (?, ?, ?, ?) 
       ON CONFLICT (section_id, student_id, date) DO UPDATE SET status = EXCLUDED.status`,
      [sid, student_id, date, status || 'present']
    );
    res.json({ success: true, saved: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Section Grades
app.get('/api/sections/:id/grades', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const rows = await query('SELECT * FROM v_student_grades WHERE section_id = ?', [sid]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sections/:id/grades/submit', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const { actor } = req.body;
    await query(
      'INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)',
      [actor || 'Faculty', 'Submitted final grades', `Section ID: ${sid}`]
    );
    res.json({ success: true, submitted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Schedules
// -------------------------------------------------------------
app.get('/api/schedules', async (req, res) => {
  try {
    const { college_id } = req.query;
    let sql = `
      SELECT 
        s.*, 
        sec.course_id, 
        sec.section_code, 
        sec.college_id, 
        sec.expected_students,
        CASE WHEN s.is_locked THEN 'published' ELSE COALESCE(sec.status, 'published') END AS status,
        c.code AS course_code, 
        c.title AS course_title, 
        f.name AS faculty_name, 
        r.name AS room_name,
        r.building AS room_building,
        r.capacity AS room_capacity
      FROM schedules s 
      JOIN sections sec ON s.section_id = sec.id 
      JOIN courses c ON sec.course_id = c.id 
      LEFT JOIN faculty f ON s.faculty_id = f.id 
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE 1=1
    `;
    const params = [];
    if (college_id) {
      sql += ' AND sec.college_id = ?';
      params.push(Number(college_id));
    }
    sql += ' ORDER BY s.day_of_week ASC, s.start_time ASC';
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/schedules', async (req, res) => {
  try {
    const { section_id, faculty_id, room_id, day_of_week, start_time, end_time, actor } = req.body;
    const [newSched] = await query(
      `INSERT INTO schedules (section_id, faculty_id, room_id, day_of_week, start_time, end_time, is_locked) 
       VALUES (?, ?, ?, ?, ?, ?, false) RETURNING *`,
      [section_id, faculty_id ? Number(faculty_id) : null, room_id ? Number(room_id) : null, day_of_week, start_time, end_time]
    );

    await query('UPDATE sections SET status = \'scheduled\' WHERE id = ?', [section_id]);

    await query(
      'INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)',
      [actor || 'VPAA', 'Created schedule entry', `Section: ${section_id}, ${day_of_week} ${start_time}-${end_time}`]
    );

    res.json({ success: true, data: newSched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/schedules/:id', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    const existing = await query('SELECT section_id FROM schedules WHERE id = ?', [sid]);
    await query('DELETE FROM schedules WHERE id = ?', [sid]);

    if (existing.length > 0) {
      const remaining = await query('SELECT id FROM schedules WHERE section_id = ?', [existing[0].section_id]);
      if (remaining.length === 0) {
        await query('UPDATE sections SET status = \'pending\' WHERE id = ?', [existing[0].section_id]);
      }
    }

    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/schedules/check-conflicts', async (req, res) => {
  try {
    const { day_of_week, start_time, end_time, room_id, faculty_id } = req.body;
    const conflicts = [];

    if (room_id) {
      const roomOverlap = await query(`
        SELECT s.*, r.name AS room_name 
        FROM schedules s 
        JOIN rooms r ON s.room_id = r.id 
        WHERE s.room_id = ? AND s.day_of_week = ? 
          AND (s.start_time < ? AND s.end_time > ?)
      `, [room_id, day_of_week, end_time, start_time]);
      if (roomOverlap.length) {
        conflicts.push({ message: `Room ${roomOverlap[0].room_name} already occupied at this time.` });
      }
    }

    if (faculty_id) {
      const facultyOverlap = await query(`
        SELECT s.*, f.name AS faculty_name 
        FROM schedules s 
        JOIN faculty f ON s.faculty_id = f.id 
        WHERE s.faculty_id = ? AND s.day_of_week = ? 
          AND (s.start_time < ? AND s.end_time > ?)
      `, [faculty_id, day_of_week, end_time, start_time]);
      if (facultyOverlap.length) {
        conflicts.push({ message: `Faculty ${facultyOverlap[0].faculty_name} is already teaching at this time.` });
      }
    }

    res.json({ success: true, data: conflicts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Auto-scheduler Engine
app.post('/api/schedules/auto-generate', async (req, res) => {
  try {
    const { section_ids, actor } = req.body;
    let sectionsToSchedule;
    if (section_ids && section_ids.length > 0) {
      const placeholders = section_ids.map(() => '?').join(',');
      sectionsToSchedule = await query(
        `SELECT s.*, c.code AS course_code, c.title AS course_title, c.requires_room_type, c.total_hours
         FROM sections s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id IN (${placeholders}) AND s.status = 'pending'`,
        section_ids
      );
    } else {
      sectionsToSchedule = await query(
        `SELECT s.*, c.code AS course_code, c.title AS course_title, c.requires_room_type, c.total_hours
         FROM sections s
         JOIN courses c ON s.course_id = c.id
         WHERE s.status = 'pending'`
      );
    }

    const placed = [];
    const failed = [];

    const slots = [
      { day: 'Mon', start: '08:00:00', end: '10:00:00' },
      { day: 'Mon', start: '10:00:00', end: '12:00:00' },
      { day: 'Mon', start: '13:00:00', end: '15:00:00' },
      { day: 'Mon', start: '15:00:00', end: '17:00:00' },
      { day: 'Tue', start: '08:30:00', end: '10:00:00' },
      { day: 'Tue', start: '10:00:00', end: '11:30:00' },
      { day: 'Tue', start: '13:00:00', end: '14:30:00' },
      { day: 'Tue', start: '14:30:00', end: '16:00:00' },
      { day: 'Wed', start: '08:00:00', end: '10:00:00' },
      { day: 'Wed', start: '10:00:00', end: '12:00:00' },
      { day: 'Wed', start: '13:00:00', end: '15:00:00' },
      { day: 'Wed', start: '15:00:00', end: '17:00:00' },
      { day: 'Thu', start: '08:30:00', end: '10:00:00' },
      { day: 'Thu', start: '10:00:00', end: '11:30:00' },
      { day: 'Thu', start: '13:00:00', end: '14:30:00' },
      { day: 'Thu', start: '14:30:00', end: '16:00:00' },
      { day: 'Fri', start: '08:00:00', end: '11:00:00' },
      { day: 'Fri', start: '13:00:00', end: '16:00:00' },
    ];

    const rooms = await query('SELECT * FROM rooms WHERE is_active = true ORDER BY capacity DESC');
    const facultyList = await query('SELECT * FROM faculty ORDER BY max_regular_hours DESC');

    for (const sec of sectionsToSchedule) {
      const compatibleRooms = rooms.filter(
        r => r.room_type === sec.requires_room_type && r.capacity >= sec.expected_students
      );
      const targetRooms = compatibleRooms.length > 0 ? compatibleRooms : rooms;

      const collegeFaculty = facultyList.filter(f => f.college_id === sec.college_id);
      const targetFaculty = collegeFaculty.length > 0 ? collegeFaculty : facultyList;

      let allocated = false;

      for (const slot of slots) {
        for (const rm of targetRooms) {
          const roomConflicts = await query(
            `SELECT id FROM schedules 
             WHERE room_id = ? AND day_of_week = ? 
               AND (start_time < ? AND end_time > ?)`,
            [rm.id, slot.day, slot.end, slot.start]
          );
          if (roomConflicts.length > 0) continue;

          for (const fac of targetFaculty) {
            const facConflicts = await query(
              `SELECT id FROM schedules 
               WHERE faculty_id = ? AND day_of_week = ? 
                 AND (start_time < ? AND end_time > ?)`,
              [fac.id, slot.day, slot.end, slot.start]
            );
            if (facConflicts.length > 0) continue;

            await query(
              `INSERT INTO schedules (section_id, faculty_id, room_id, day_of_week, start_time, end_time, is_locked)
               VALUES (?, ?, ?, ?, ?, ?, false)`,
              [sec.id, fac.id, rm.id, slot.day, slot.start, slot.end]
            );
            await query('UPDATE sections SET status = \'scheduled\' WHERE id = ?', [sec.id]);

            placed.push({
              section_id: sec.id,
              course_code: sec.course_code,
              section_code: sec.section_code,
              day_of_week: slot.day,
              start_time: slot.start,
              end_time: slot.end,
              room_name: rm.name,
              faculty_name: fac.name,
            });
            allocated = true;
            break;
          }
          if (allocated) break;
        }
        if (allocated) break;
      }

      if (!allocated) {
        failed.push({
          section_id: sec.id,
          course_code: sec.course_code,
          section_code: sec.section_code,
          reason: 'No available conflict-free room or faculty slot.',
        });
      }
    }

    await query(
      'INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)',
      [actor || 'VPAA Engine', 'Auto-generated schedule batch', `Placed: ${placed.length}, Unplaced: ${failed.length}`]
    );

    res.json({ success: true, data: { placed, failed } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/schedules/:id/publish', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    await query('UPDATE schedules SET is_locked = true WHERE id = ?', [sid]);
    res.json({ success: true, published: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/schedules/:id/lock', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    await query('UPDATE schedules SET is_locked = true WHERE id = ?', [sid]);
    res.json({ success: true, locked: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/schedules/:id/unlock', async (req, res) => {
  try {
    const sid = Number(req.params.id);
    await query('UPDATE schedules SET is_locked = false WHERE id = ?', [sid]);
    res.json({ success: true, unlocked: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/schedules/publish-all', async (req, res) => {
  try {
    await query('UPDATE schedules SET is_locked = true');
    await query('UPDATE sections SET status = \'published\' WHERE status = \'scheduled\'');
    res.json({ success: true, publishedAll: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Class Records (Review)
// -------------------------------------------------------------
app.get('/api/class-records', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM class_records ORDER BY id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/class-records/:id/review', async (req, res) => {
  try {
    const cid = Number(req.params.id);
    const { status, remarks, reviewer_name } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    const [updated] = await query(
      `UPDATE class_records 
       SET review_status = ?, remarks = ?, reviewer_name = ?, decision_date = ? 
       WHERE id = ? RETURNING *`,
      [status || 'approved', remarks || '', reviewer_name || 'VPAA', today, cid]
    );

    await query(
      'INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)',
      [reviewer_name || 'Reviewer', `Decision: ${status}`, `Class Record #${cid}`]
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Audit Log
// -------------------------------------------------------------
app.get('/api/audit-log', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/audit-log', async (req, res) => {
  try {
    const { actor, action, details } = req.body;
    await query(
      'INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)',
      [actor || 'System', action || 'Action', details || '']
    );
    res.json({ success: true, logged: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Analytics Overview
// -------------------------------------------------------------
app.get('/api/analytics/overview', async (req, res) => {
  try {
    const [secStats] = await query(`
      SELECT
        COUNT(*)::int AS total_sections,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_sections,
        COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled_sections,
        COUNT(*) FILTER (WHERE status = 'published')::int AS published_sections
      FROM sections
    `);
    const [facStats] = await query(`
      SELECT
        COUNT(*)::int AS total_faculty,
        COUNT(*) FILTER (
          WHERE (
            SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 0)
            FROM schedules s WHERE s.faculty_id = f.id
          ) > f.max_regular_hours
        )::int AS overloaded_faculty
      FROM faculty f
    `);
    const overloadedNames = await query(`
      SELECT f.name
      FROM faculty f
      WHERE (
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 0)
        FROM schedules s WHERE s.faculty_id = f.id
      ) > f.max_regular_hours
      ORDER BY f.name ASC
    `);
    const [roomUtil] = await query(`
      SELECT COALESCE(ROUND(AVG(util.pct)::numeric, 1), 0) AS avg_room_utilization_pct
      FROM (
        SELECT r.id, COALESCE(ROUND((COUNT(s.id) / 72.0 * 100)::numeric, 1), 0) AS pct
        FROM rooms r LEFT JOIN schedules s ON r.id = s.room_id
        GROUP BY r.id
      ) util
    `);
    const [rCount] = await query('SELECT COUNT(*)::int AS total FROM rooms');
    const conflictRows = await query(`
      SELECT COUNT(*)::int AS cnt
      FROM schedules s1
      JOIN schedules s2 ON s1.id < s2.id
        AND s1.day_of_week = s2.day_of_week
        AND s1.start_time < s2.end_time
        AND s1.end_time > s2.start_time
        AND (s1.room_id = s2.room_id OR s1.faculty_id = s2.faculty_id)
    `);

    res.json({
      success: true,
      data: {
        total_sections: secStats?.total_sections || 0,
        pending_sections: secStats?.pending_sections || 0,
        scheduled_sections: secStats?.scheduled_sections || 0,
        published_sections: secStats?.published_sections || 0,
        total_faculty: facStats?.total_faculty || 0,
        overloaded_faculty: facStats?.overloaded_faculty || 0,
        overloaded_faculty_names: overloadedNames.map(r => r.name),
        total_rooms: rCount?.total || 0,
        avg_room_utilization_pct: roomUtil?.avg_room_utilization_pct || 0,
        conflicted_schedules: conflictRows[0]?.cnt || 0,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// Mount Modular Controllers & Routes
// -------------------------------------------------------------
app.use('/api/students', studentRoutes);
app.use('/api/faculty-members', facultyRoutes);
app.use('/api/portal-users', userRoutes);

// Catch-all
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`=================================================`);
  console.log(`🚀 LCCB Backend API running on http://localhost:${PORT}`);
  console.log(`📡 Connecting to Supabase PostgreSQL...`);
  try {
    await query('SELECT 1');
    console.log(`✅ Supabase PostgreSQL connected successfully!`);
  } catch (err) {
    console.warn(`⚠️ Supabase PostgreSQL not reachable yet (${err.code || err.message}). Please set DATABASE_URL in .env.`);
  }
  console.log(`=================================================`);
});
