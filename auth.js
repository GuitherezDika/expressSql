const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { sql, poolPromise } = require('./db');

// Register
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const pool = await poolPromise;
        const hashedPassword = await bcrypt.hash(password, 10);
        // encrypt plain text
        // 10 tingkat kompleksitas enkripsi

        await pool.request()
            .input('username', sql.VarChar, username)
            .input('email', sql.VarChar, email)
            .input('password', sql.VarChar, hashedPassword)
            .query(`
                INSERT INTO Users (username, email, password)
                VALUES (@username, @email, @password)
            `);

        res.status(201).json({ message: 'User registered successfully' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT * FROM Users WHERE username = @username');

        if (result.recordset.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }

        const user = result.recordset[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials!' })
        }

        res.json({ message: 'Login successful' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

module.exports = router;