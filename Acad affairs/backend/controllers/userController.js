// backend/controllers/userController.js - User Accounts Controller
import { query } from '../db.js';

const SYSTEM_TITLE = 'La Consolacion College Bacolod - Academic Affairs Portal';

export const getUserHome = (req, res) => {
  res.send(`${SYSTEM_TITLE} | User Accounts & Authentication Portal`);
};

export const getUserProfile = (req, res) => {
  res.send(`${SYSTEM_TITLE} | User Account Profile`);
};

export const getUserSettings = (req, res) => {
  res.send(`${SYSTEM_TITLE} | Portal Account Settings`);
};

export const addUser = async (req, res) => {
  try {
    const { name, email, role, college_id } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Name and email are required" });
    }

    const [newUser] = await query(
      `INSERT INTO users (name, email, role, college_id) 
       VALUES (?, ?, ?, ?) RETURNING *`,
      [name.trim(), email.trim().toLowerCase(), role || 'faculty', Number(college_id) || 1]
    );

    res.json({
      success: true,
      data: newUser,
      message: "User account added successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const listUsers = async (req, res) => {
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

    res.json({
      success: true,
      system: SYSTEM_TITLE,
      title: 'Academic Portal Users Directory',
      total: rows.length,
      data: rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT u.*, c.name AS college_name, c.code AS college_code 
       FROM users u 
       LEFT JOIN colleges c ON u.college_id = c.id 
       WHERE u.id = ?`,
      [Number(id)]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User account not found" });
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

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, college_id } = req.body;

    const [updated] = await query(
      `UPDATE users 
       SET name = COALESCE(?, name), 
           email = COALESCE(?, email), 
           role = COALESCE(?, role), 
           college_id = COALESCE(?, college_id)
       WHERE id = ? RETURNING *`,
      [name || null, email ? email.trim().toLowerCase() : null, role || null, college_id ? Number(college_id) : null, Number(id)]
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "User account not found" });
    }

    res.json({
      success: true,
      data: updated,
      message: "User account updated successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM users WHERE id = ?', [Number(id)]);
    res.json({
      success: true,
      message: "User account deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Database error: " + error.message });
  }
};
