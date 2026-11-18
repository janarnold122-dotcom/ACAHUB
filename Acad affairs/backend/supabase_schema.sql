-- ==============================================================================
-- LCCB Academic Affairs Management System
-- PostgreSQL / Supabase Relational Schema & Demo Seed Data
-- Target: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. DROP EXISTING VIEWS & TABLES (For clean setup)
DROP VIEW IF EXISTS v_student_grades CASCADE;
DROP VIEW IF EXISTS v_room_utilization CASCADE;
DROP VIEW IF EXISTS v_faculty_workload CASCADE;
DROP VIEW IF EXISTS v_master_schedule CASCADE;

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS class_record_checklist CASCADE;
DROP TABLE IF EXISTS class_records CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS faculty CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS colleges CASCADE;

-- ------------------------------------------------------------------------------
-- 2. TABLE DEFINITIONS
-- ------------------------------------------------------------------------------

-- Colleges
CREATE TABLE colleges (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  role VARCHAR(30) NOT NULL DEFAULT 'faculty' CHECK (role IN ('vpaa', 'dean', 'program_chair', 'faculty')),
  college_id INT REFERENCES colleges(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  building VARCHAR(100) NOT NULL,
  capacity INT NOT NULL DEFAULT 30,
  room_type VARCHAR(30) NOT NULL DEFAULT 'lecture' CHECK (room_type IN ('lecture', 'computer_lab', 'science_lab')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty
CREATE TABLE faculty (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  college_id INT NOT NULL REFERENCES colleges(id) ON DELETE CASCADE ON UPDATE CASCADE,
  employment_status VARCHAR(20) NOT NULL DEFAULT 'full_time' CHECK (employment_status IN ('full_time', 'part_time')),
  max_regular_hours NUMERIC(4,1) NOT NULL DEFAULT 24.0,
  qualifications VARCHAR(255) DEFAULT '',
  preferred_days VARCHAR(50) DEFAULT '',
  preferred_start TIME DEFAULT '07:00:00',
  preferred_end TIME DEFAULT '19:00:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses
CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  units INT NOT NULL DEFAULT 3,
  lecture_hours INT NOT NULL DEFAULT 3,
  lab_hours INT NOT NULL DEFAULT 0,
  total_hours INT GENERATED ALWAYS AS (lecture_hours + lab_hours) STORED,
  requires_room_type VARCHAR(30) NOT NULL DEFAULT 'lecture' CHECK (requires_room_type IN ('lecture', 'computer_lab', 'science_lab')),
  college_id INT NOT NULL REFERENCES colleges(id) ON DELETE CASCADE ON UPDATE CASCADE,
  description TEXT,
  prerequisites VARCHAR(100) DEFAULT 'None',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sections
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
  section_code VARCHAR(20) NOT NULL,
  term VARCHAR(50) NOT NULL DEFAULT '1st Sem 2026-2027',
  program VARCHAR(50) DEFAULT '',
  expected_students INT NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'published', 'conflict')),
  college_id INT NOT NULL REFERENCES colleges(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uk_course_section_term UNIQUE (course_id, section_code, term)
);

-- Schedules
CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE ON UPDATE CASCADE,
  faculty_id INT REFERENCES faculty(id) ON DELETE SET NULL ON UPDATE CASCADE,
  room_id INT REFERENCES rooms(id) ON DELETE SET NULL ON UPDATE CASCADE,
  day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  student_no VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  program VARCHAR(50) NOT NULL,
  year_level INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enrollments
CREATE TABLE enrollments (
  section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE ON UPDATE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (section_id, student_id)
);

-- Assessments
CREATE TABLE assessments (
  id SERIAL PRIMARY KEY,
  section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE ON UPDATE CASCADE,
  term_period VARCHAR(20) NOT NULL DEFAULT 'midterm' CHECK (term_period IN ('prelim', 'midterm', 'final')),
  category VARCHAR(30) NOT NULL DEFAULT 'quiz' CHECK (category IN ('quiz', 'performance_task', 'exam', 'attendance', 'project')),
  name VARCHAR(100) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  weight NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores
CREATE TABLE scores (
  assessment_id INT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  raw_score NUMERIC(5,2) DEFAULT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (assessment_id, student_id)
);

-- Attendance
CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE ON UPDATE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'excused')),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uk_attendance_record UNIQUE (section_id, student_id, date)
);

-- Class Records
CREATE TABLE class_records (
  id SERIAL PRIMARY KEY,
  teacher VARCHAR(100) NOT NULL,
  subject VARCHAR(50) NOT NULL,
  schedule VARCHAR(100) NOT NULL,
  department VARCHAR(20) NOT NULL,
  base_percentage INT NOT NULL DEFAULT 50,
  
  threshold_percentage INT NOT NULL DEFAULT 75,
  gate_type VARCHAR(50) DEFAULT 'Examination',
  review_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'returned')),
  reviewer_name VARCHAR(100) DEFAULT NULL,
  decision_date DATE DEFAULT NULL,
  remarks TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class Record Checklist
CREATE TABLE class_record_checklist (
  id SERIAL PRIMARY KEY,
  class_record_id INT NOT NULL REFERENCES class_records(id) ON DELETE CASCADE ON UPDATE CASCADE,
  label VARCHAR(255) NOT NULL,
  auto_key VARCHAR(50) DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ok', 'fix')),
  notes VARCHAR(255) DEFAULT NULL
);

-- Audit Logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_name VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT DEFAULT NULL
);

-- ------------------------------------------------------------------------------
-- 3. ANALYTICAL VIEWS
-- ------------------------------------------------------------------------------

-- Master Schedule View
CREATE OR REPLACE VIEW v_master_schedule AS
SELECT 
  s.id AS schedule_id,
  c.code AS course_code,
  c.title AS course_title,
  sec.section_code,
  col.code AS college_code,
  f.name AS faculty_name,
  r.name AS room_name,
  r.building,
  s.day_of_week,
  s.start_time,
  s.end_time,
  s.is_locked,
  sec.status AS section_status
FROM schedules s
JOIN sections sec ON s.section_id = sec.id
JOIN courses c ON sec.course_id = c.id
JOIN colleges col ON sec.college_id = col.id
LEFT JOIN faculty f ON s.faculty_id = f.id
LEFT JOIN rooms r ON s.room_id = r.id;

-- Faculty Workload View
CREATE OR REPLACE VIEW v_faculty_workload AS
SELECT 
  f.id AS faculty_id,
  f.name AS faculty_name,
  f.employment_status,
  f.max_regular_hours,
  col.code AS college_code,
  COUNT(s.id) AS total_sections_assigned,
  COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 2), 0.00) AS total_teaching_hours,
  CASE 
    WHEN COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 0) > f.max_regular_hours 
    THEN ROUND(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0) - f.max_regular_hours, 2)
    ELSE 0.00 
  END AS overload_hours,
  CASE 
    WHEN COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 0) > f.max_regular_hours THEN 'overload'
    WHEN COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0), 0) = f.max_regular_hours THEN 'normal'
    ELSE 'underload'
  END AS workload_status
FROM faculty f
JOIN colleges col ON f.college_id = col.id
LEFT JOIN schedules s ON f.id = s.faculty_id
GROUP BY f.id, f.name, f.employment_status, f.max_regular_hours, col.code;

-- Room Utilization View
CREATE OR REPLACE VIEW v_room_utilization AS
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
GROUP BY r.id, r.name, r.building, r.capacity, r.room_type;

-- Student Grades View
CREATE OR REPLACE VIEW v_student_grades AS
SELECT 
  sec.id AS section_id,
  c.code AS course_code,
  sec.section_code,
  st.id AS student_id,
  st.student_no,
  st.name AS student_name,
  ROUND(AVG(CASE WHEN a.term_period = 'midterm' THEN (sc.raw_score / a.max_score) * 100 END), 2) AS midterm_pct,
  ROUND(AVG(CASE WHEN a.term_period = 'final' THEN (sc.raw_score / a.max_score) * 100 END), 2) AS final_pct,
  ROUND(AVG((sc.raw_score / a.max_score) * 100), 2) AS overall_pct,
  CASE 
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 97 THEN 1.00
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 94 THEN 1.25
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 91 THEN 1.50
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 88 THEN 1.75
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 85 THEN 2.00
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 82 THEN 2.25
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 79 THEN 2.50
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 76 THEN 2.75
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 75 THEN 3.00
    ELSE 5.00
  END AS transmuted_grade,
  CASE 
    WHEN AVG((sc.raw_score / a.max_score) * 100) >= 75 THEN 'Passed'
    ELSE 'Failed'
  END AS remarks
FROM enrollments e
JOIN sections sec ON e.section_id = sec.id
JOIN courses c ON sec.course_id = c.id
JOIN students st ON e.student_id = st.id
LEFT JOIN assessments a ON sec.id = a.section_id
LEFT JOIN scores sc ON a.id = sc.assessment_id AND st.id = sc.student_id
GROUP BY sec.id, c.code, sec.section_code, st.id, st.student_no, st.name;

-- ------------------------------------------------------------------------------
-- 4. SEED DATA INSERTION
-- ------------------------------------------------------------------------------

-- Colleges
INSERT INTO colleges (id, code, name) VALUES
(1, 'SBIT', 'School of Business and Information Technology'),
(2, 'SHTM', 'School of Hospitality and Tourism Management'),
(3, 'SSLATE', 'School of Sciences, Liberal Arts, and Teacher Education'),
(4, 'SARFAID', 'School of Architecture, Fine Arts and Interior Design')
ON CONFLICT (id) DO NOTHING;

-- Users
INSERT INTO users (id, name, email, role, college_id) VALUES
(1, 'Dr. Penny Sanchez', 'vpaa@lccb.edu.ph', 'vpaa', NULL),
(2, 'Dr. Ramel Flandes', 'dean.ccs@lccb.edu.ph', 'dean', 1),
(3, 'Dr. Christian Angelo Ituriaga', 'dean.cba@lccb.edu.ph', 'dean', 2),
(4, 'Dr. Cookie Alcantara Sanicas', 'dean.cas@lccb.edu.ph', 'dean', 3),
(5, 'Dr. Vincent Raymund Alovera', 'dean.con@lccb.edu.ph', 'dean', 4),
(6, 'Prof. Miguel Santos', 'chair.ccs@lccb.edu.ph', 'program_chair', 1),
(7, 'Prof. Liza Fernandez', 'chair.cba@lccb.edu.ph', 'program_chair', 2),
(8, 'Prof. Jose Ramirez', 'jose.ramirez@lccb.edu.ph', 'faculty', 1),
(9, 'Prof. Carla Dizon', 'carla.dizon@lccb.edu.ph', 'faculty', 1),
(10, 'Prof. Noel Aguilar', 'noel.aguilar@lccb.edu.ph', 'faculty', 1),
(11, 'Prof. Michelle Uy', 'michelle.uy@lccb.edu.ph', 'faculty', 2),
(12, 'Prof. Rico Salvador', 'rico.salvador@lccb.edu.ph', 'faculty', 2),
(13, 'Prof. Erika Mendoza', 'erika.mendoza@lccb.edu.ph', 'faculty', 3),
(14, 'Prof. Daniel Ong', 'daniel.ong@lccb.edu.ph', 'faculty', 3),
(15, 'Prof. Sarah Bautista', 'sarah.bautista@lccb.edu.ph', 'faculty', 4),
(16, 'Prof. Kevin Torres', 'kevin.torres@lccb.edu.ph', 'faculty', 1),
(17, 'Prof. Angeline Cruz', 'angeline.cruz@lccb.edu.ph', 'faculty', 1)
ON CONFLICT (id) DO NOTHING;

-- Faculty
INSERT INTO faculty (id, user_id, name, email, college_id, employment_status, max_regular_hours, qualifications) VALUES
(1, 8, 'Prof. Jose Ramirez', 'jose.ramirez@lccb.edu.ph', 1, 'full_time', 24.0, 'BSIT, Programming'),
(2, 9, 'Prof. Carla Dizon', 'carla.dizon@lccb.edu.ph', 1, 'full_time', 24.0, 'BSCS, Databases'),
(3, 10, 'Prof. Noel Aguilar', 'noel.aguilar@lccb.edu.ph', 1, 'part_time', 12.0, 'BSIT, Networking'),
(4, 11, 'Prof. Michelle Uy', 'michelle.uy@lccb.edu.ph', 2, 'full_time', 24.0, 'BSBA, Marketing'),
(5, 12, 'Prof. Rico Salvador', 'rico.salvador@lccb.edu.ph', 2, 'full_time', 24.0, 'BSBA, Finance'),
(6, 13, 'Prof. Erika Mendoza', 'erika.mendoza@lccb.edu.ph', 3, 'part_time', 12.0, 'AB, English'),
(7, 14, 'Prof. Daniel Ong', 'daniel.ong@lccb.edu.ph', 3, 'full_time', 24.0, 'General Chemistry'),
(8, 15, 'Prof. Sarah Bautista', 'sarah.bautista@lccb.edu.ph', 4, 'full_time', 24.0, 'BSN, Fundamentals of Nursing'),
(9, 16, 'Prof. Kevin Torres', 'kevin.torres@lccb.edu.ph', 1, 'part_time', 12.0, 'BSIT, Capstone Adviser'),
(10, 17, 'Prof. Angeline Cruz', 'angeline.cruz@lccb.edu.ph', 1, 'full_time', 24.0, 'BSCS, Algorithms')
ON CONFLICT (id) DO NOTHING;

-- Rooms
INSERT INTO rooms (id, name, building, capacity, room_type) VALUES
(1, 'Room 101', 'Main Building', 40, 'lecture'),
(2, 'Room 102', 'Main Building', 35, 'lecture'),
(3, 'Room 201', 'Main Building', 45, 'lecture'),
(4, 'Comp Lab 1', 'IT Building', 30, 'computer_lab'),
(5, 'Comp Lab 2', 'IT Building', 30, 'computer_lab'),
(6, 'Science Lab A', 'Science Wing', 25, 'science_lab'),
(7, 'Nursing Skills Lab', 'Health Sciences Bldg', 20, 'science_lab'),
(8, 'Room 301', 'Main Building', 50, 'lecture')
ON CONFLICT (id) DO NOTHING;

-- Courses
INSERT INTO courses (id, code, title, units, lecture_hours, lab_hours, requires_room_type, college_id, description, prerequisites) VALUES
(1, 'IT101', 'Introduction to Computing', 3, 2, 1, 'computer_lab', 1, 'Fundamental concepts of computing, hardware and software basics, operating systems overview.', 'None'),
(2, 'IT205', 'Data Structures and Algorithms', 3, 3, 0, 'lecture', 1, 'Study of fundamental data structures and algorithm analysis and design.', 'IT101'),
(3, 'IT301', 'Database Management Systems', 3, 2, 1, 'computer_lab', 1, 'Relational database design, SQL, normalization, transaction management, and database administration.', 'IT205'),
(4, 'CS210', 'Computer Networks and Data Communication', 3, 2, 1, 'computer_lab', 1, 'OSI model, TCP/IP protocol suite, IP addressing, routing protocols, and network configuration.', 'IT101'),
(5, 'CS305', 'Software Engineering', 3, 3, 0, 'lecture', 1, 'Software development lifecycles, agile methodologies, requirements engineering, and software testing.', 'IT205'),
(6, 'BA101', 'Principles of Management', 3, 3, 0, 'lecture', 2, 'Overview of management functions: planning, organizing, leading, and controlling.', 'None'),
(7, 'BA202', 'Financial Accounting and Reporting', 3, 3, 0, 'lecture', 2, 'Accounting cycle, financial statements, balance sheets, income statements, and cash flows.', 'BA101'),
(8, 'HM101', 'Introduction to Hospitality Management', 3, 3, 0, 'lecture', 2, 'Foundations of hotel, restaurant, and tourism industries with customer service principles.', 'None'),
(9, 'ENG101', 'Purposive Communication', 3, 3, 0, 'lecture', 3, 'Writing, speaking, and presenting to different audiences for various academic purposes.', 'None'),
(10, 'MATH101', 'Mathematics in the Modern World', 3, 3, 0, 'lecture', 3, 'Patterns in nature, mathematics as a tool, and problem-solving strategies.', 'None'),
(11, 'NURS101', 'Theoretical Foundations of Nursing', 3, 3, 0, 'lecture', 4, 'Historical background, philosophies, theories, and concepts underpinning the nursing discipline.', 'None'),
(12, 'ARCH101', 'Architectural Design 1', 3, 1, 2, 'science_lab', 4, 'Basic design principles, form and space manipulation, color theory, and drawing exercises.', 'None')
ON CONFLICT (id) DO NOTHING;

-- Sections
INSERT INTO sections (id, course_id, section_code, term, program, expected_students, status, college_id) VALUES
(1, 1, 'CC-1A', '1st Sem 2026-2027', 'BSIT', 35, 'scheduled', 1),
(2, 1, 'CC-1B', '1st Sem 2026-2027', 'BSCS', 30, 'scheduled', 1),
(3, 2, 'CC-2A', '1st Sem 2026-2027', 'BSIT', 30, 'scheduled', 1),
(4, 3, 'CC-3A', '1st Sem 2026-2027', 'BSIT', 28, 'scheduled', 1),
(5, 4, 'CC-2B', '1st Sem 2026-2027', 'BSCS', 25, 'scheduled', 1),
(6, 5, 'CC-3B', '1st Sem 2026-2027', 'BSCS', 25, 'scheduled', 1),
(7, 6, 'BA-1A', '1st Sem 2026-2027', 'BSBA', 40, 'scheduled', 2),
(8, 7, 'BA-2A', '1st Sem 2026-2027', 'BSBA', 35, 'scheduled', 2),
(9, 8, 'HM-1A', '1st Sem 2026-2027', 'BSHM', 30, 'scheduled', 2),
(10, 9, 'GE-1A', '1st Sem 2026-2027', 'All Programs', 45, 'scheduled', 3),
(11, 10, 'GE-1B', '1st Sem 2026-2027', 'All Programs', 45, 'scheduled', 3),
(12, 11, 'NU-1A', '1st Sem 2026-2027', 'BSN', 20, 'scheduled', 4)
ON CONFLICT (id) DO NOTHING;

-- Schedules
INSERT INTO schedules (id, section_id, faculty_id, room_id, day_of_week, start_time, end_time, is_locked) VALUES
(1, 1, 1, 4, 'Mon', '08:00:00', '10:00:00', true),
(2, 1, 1, 1, 'Wed', '08:00:00', '09:00:00', true),
(3, 2, 10, 5, 'Tue', '09:00:00', '11:00:00', true),
(4, 2, 10, 2, 'Thu', '09:00:00', '10:00:00', true),
(5, 3, 2, 1, 'Mon', '10:00:00', '11:30:00', true),
(6, 3, 2, 1, 'Wed', '10:00:00', '11:30:00', true),
(7, 4, 2, 4, 'Tue', '13:00:00', '15:00:00', true),
(8, 4, 2, 3, 'Thu', '13:00:00', '14:00:00', true),
(9, 5, 3, 5, 'Wed', '13:00:00', '15:00:00', true),
(10, 5, 3, 2, 'Fri', '13:00:00', '14:00:00', true),
(11, 6, 9, 3, 'Mon', '14:00:00', '15:30:00', true),
(12, 6, 9, 3, 'Wed', '14:00:00', '15:30:00', true),
(13, 7, 4, 1, 'Tue', '08:00:00', '09:30:00', true),
(14, 7, 4, 1, 'Thu', '08:00:00', '09:30:00', true),
(15, 8, 5, 2, 'Mon', '13:00:00', '14:30:00', true),
(16, 8, 5, 2, 'Wed', '13:00:00', '14:30:00', true),
(17, 9, 4, 3, 'Fri', '08:00:00', '11:00:00', true),
(18, 10, 6, 8, 'Tue', '10:00:00', '11:30:00', true),
(19, 10, 6, 8, 'Thu', '10:00:00', '11:30:00', true),
(20, 11, 7, 8, 'Mon', '08:00:00', '09:30:00', true),
(21, 11, 7, 8, 'Wed', '08:00:00', '09:30:00', true),
(22, 12, 8, 7, 'Fri', '13:00:00', '16:00:00', true)
ON CONFLICT (id) DO NOTHING;

-- Students (Initially empty)
-- INSERT INTO students (id, student_no, name, email, program, year_level) VALUES ...

-- Enrollments (Initially empty)
-- INSERT INTO enrollments (section_id, student_id) VALUES ...

-- Assessments
INSERT INTO assessments (id, section_id, term_period, category, name, max_score, weight) VALUES
(1, 1, 'midterm', 'quiz', 'Quiz 1', 20.00, 20.00),
(2, 1, 'midterm', 'quiz', 'Quiz 2', 20.00, 20.00),
(3, 1, 'midterm', 'performance_task', 'Programming Exercise', 50.00, 30.00),
(4, 1, 'midterm', 'exam', 'Midterm Exam', 100.00, 30.00),
(5, 1, 'final', 'quiz', 'Quiz 3', 20.00, 20.00),
(6, 1, 'final', 'performance_task', 'Final Capstone Project', 100.00, 30.00),
(7, 1, 'final', 'exam', 'Final Exam', 100.00, 50.00)
ON CONFLICT (id) DO NOTHING;

-- Scores (Initially empty)
-- INSERT INTO scores (assessment_id, student_id, raw_score) VALUES ...



-- Attendance (Initially empty)
-- INSERT INTO attendance (section_id, student_id, date, status) VALUES ...

-- Audit Logs
INSERT INTO audit_logs (id, timestamp, user_name, action, details) VALUES
(1, NOW() - INTERVAL '5 days', 'Dr. Penny Sanchez', 'System initialized', 'Database created and demo data seeded for academic year 2026-2027'),
(2, NOW() - INTERVAL '4 days', 'Prof. Miguel Santos', 'Requested new section', 'IT301 CC-1A (Database Management Systems)'),
(3, NOW() - INTERVAL '3 days', 'Dr. Ramel Flandes', 'Approved course offering', 'CS210 Computer Networks for SBIT'),
(4, NOW() - INTERVAL '2 days', 'Dr. Penny Sanchez', 'Published master timetable', '12 sections locked and published for 1st Semester')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence IDs to highest values
SELECT setval(pg_get_serial_sequence('colleges', 'id'), COALESCE(MAX(id), 1)) FROM colleges;
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('faculty', 'id'), COALESCE(MAX(id), 1)) FROM faculty;
SELECT setval(pg_get_serial_sequence('rooms', 'id'), COALESCE(MAX(id), 1)) FROM rooms;
SELECT setval(pg_get_serial_sequence('courses', 'id'), COALESCE(MAX(id), 1)) FROM courses;
SELECT setval(pg_get_serial_sequence('sections', 'id'), COALESCE(MAX(id), 1)) FROM sections;
SELECT setval(pg_get_serial_sequence('schedules', 'id'), COALESCE(MAX(id), 1)) FROM schedules;
SELECT setval(pg_get_serial_sequence('students', 'id'), COALESCE(MAX(id), 1)) FROM students;
SELECT setval(pg_get_serial_sequence('assessments', 'id'), COALESCE(MAX(id), 1)) FROM assessments;
SELECT setval(pg_get_serial_sequence('attendance', 'id'), COALESCE(MAX(id), 1)) FROM attendance;
SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), COALESCE(MAX(id), 1)) FROM audit_logs;
