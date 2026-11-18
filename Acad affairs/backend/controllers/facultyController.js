// backend/controllers/facultyController.js - Faculty Management Controller
import { query } from '../db.js';

const SYSTEM_TITLE = 'La Consolacion College Bacolod - Academic Affairs Portal';

export const getFacultyHome = (req, res) => {
  res.send(`${SYSTEM_TITLE} | Faculty & Teaching Load Portal`);
};

export const getFacultyProfile = (req, res) => {
  res.send(`${SYSTEM_TITLE} | Faculty Member Profile`);
};

export const getFacultySettings = (req, res) => {
  res.send(`${SYSTEM_TITLE} | Faculty Portal Settings`);
};

export const addFaculty = async (req, res) => {
  try {
    const { name, firstname, lastname, email, college_id, employment_status, max_regular_hours, qualifications, preferred_days, preferred_start, preferred_end } = req.body;
    const facultyName = name || (firstname && lastname ? `${firstname} ${lastname}` : firstname || lastname);

    if (!facultyName) {
      return res.status(400).json({ success: false, message: "Faculty member name is required" });
    }

    const facultyEmail = email || `${facultyName.toLowerCase().replace(/[^a-z0-9]/g, '')}@lccb.edu.ph`;

    // Ensure user record exists
    const [user] = await query(
      `INSERT INTO users (name, email, role, college_id) 
       VALUES (?, ?, 'faculty', ?) 
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name 
       RETURNING id`,
      [facultyName, facultyEmail, Number(college_id) || 1]
    );

    const [newFac] = await query(
      `INSERT INTO faculty (user_id, name, email, college_id, employment_status, max_regular_hours, qualifications, preferred_days, preferred_start, preferred_end) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [
        user.id,
        facultyName,
        facultyEmail,
        Number(college_id) || 1,
        employment_status || 'full_time',
        Number(max_regular_hours) || 24,
        qualifications || '',
        preferred_days || '',
        preferred_start || '07:00:00',
        preferred_end || '19:00:00'
      ]
    );

    res.json({
      success: true,
      data: newFac,
      message: "Faculty member added successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const listFaculty = async (req, res) => {
  try {
    const rows = await query(`
      SELECT f.*, c.name AS college_name, c.code AS college_code 
      FROM faculty f 
      LEFT JOIN colleges c ON f.college_id = c.id 
      ORDER BY f.name ASC
    `);
    res.json({
      success: true,
      system: SYSTEM_TITLE,
      title: 'Faculty Members Directory',
      total: rows.length,
      data: rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const getFacultyById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(`
      SELECT f.*, c.name AS college_name, c.code AS college_code 
      FROM faculty f 
      LEFT JOIN colleges c ON f.college_id = c.id 
      WHERE f.id = ?
    `, [Number(id)]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Faculty member not found" });
    }

    res.json({
      success: true,
      system: SYSTEM_TITLE,
      data: rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, college_id, employment_status, max_regular_hours, qualifications, preferred_days } = req.body;

    const [updated] = await query(
      `UPDATE faculty 
       SET name = COALESCE(?, name), 
           email = COALESCE(?, email), 
           college_id = COALESCE(?, college_id), 
           employment_status = COALESCE(?, employment_status), 
           max_regular_hours = COALESCE(?, max_regular_hours), 
           qualifications = COALESCE(?, qualifications),
           preferred_days = COALESCE(?, preferred_days)
       WHERE id = ? RETURNING *`,
      [name || null, email || null, college_id ? Number(college_id) : null, employment_status || null, max_regular_hours ? Number(max_regular_hours) : null, qualifications || null, preferred_days || null, Number(id)]
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Faculty member not found" });
    }

    res.json({
      success: true,
      data: updated,
      message: "Faculty member updated successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM faculty WHERE id = ?', [Number(id)]);
    res.json({
      success: true,
      message: "Faculty member deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};
