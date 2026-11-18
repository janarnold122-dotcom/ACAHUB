// backend/controllers/studentController.js - Student Management Controller
import { query } from '../db.js';

const SYSTEM_TITLE = 'La Consolacion College Bacolod - Academic Affairs Portal';

export const getStudentHome = (req, res) => {
  res.send(`${SYSTEM_TITLE} | Student & Class Roster Portal`);
};

export const getStudentProfile = (req, res) => {
  res.send(`${SYSTEM_TITLE} | Student Academic Profile`);
};

export const getStudentSettings = (req, res) => {
  res.send(`${SYSTEM_TITLE} | Student Portal Settings`);
};

export const addStudent = async (req, res) => {
  try {
    const { student_no, firstname, lastname, name, email, program, year_level } = req.body;
    const studentName = name || (firstname && lastname ? `${firstname} ${lastname}` : firstname || lastname);
    if (!student_no || !studentName) {
      return res.status(400).json({ success: false, message: "Student number and name are required" });
    }

    const studentEmail = email || `${student_no.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@student.lccb.edu.ph`;

    const [newStudent] = await query(
      `INSERT INTO students (student_no, name, email, program, year_level)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (student_no) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
       RETURNING *`,
      [student_no.trim(), studentName.trim(), studentEmail, program || 'BSIT', Number(year_level) || 1]
    );

    res.json({
      success: true,
      data: newStudent,
      message: "Student record saved successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const listStudents = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM students ORDER BY student_no ASC');
    res.json({
      success: true,
      system: SYSTEM_TITLE,
      title: 'Student Roster Directory',
      total: rows.length,
      data: rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      'SELECT * FROM students WHERE id = ? OR student_no = ?',
      [isNaN(Number(id)) ? 0 : Number(id), id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }

    res.json({
      success: true,
      system: SYSTEM_TITLE,
      title: 'Student Profile Details',
      data: rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { student_no, firstname, lastname, name, email, program, year_level } = req.body;
    const studentName = name || (firstname && lastname ? `${firstname} ${lastname}` : firstname || lastname);

    const [updated] = await query(
      `UPDATE students 
       SET student_no = COALESCE(?, student_no), 
           name = COALESCE(?, name), 
           email = COALESCE(?, email), 
           program = COALESCE(?, program), 
           year_level = COALESCE(?, year_level)
       WHERE id = ? OR student_no = ?
       RETURNING *`,
      [student_no || null, studentName || null, email || null, program || null, year_level ? Number(year_level) : null, isNaN(Number(id)) ? 0 : Number(id), id]
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }

    res.json({
      success: true,
      data: updated,
      message: "Student record updated successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const [deleted] = await query(
      'DELETE FROM students WHERE id = ? OR student_no = ? RETURNING id',
      [isNaN(Number(id)) ? 0 : Number(id), id]
    );

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Student record not found" });
    }

    res.json({
      success: true,
      message: "Student record deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};
