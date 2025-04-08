const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { sql, poolPromise } = require('./db');
const jwt = require('jsonwebtoken');

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

// =========== HANDLE LOGIN REFRESH TOKEN =======================
function generateAccessToken(user) {
    return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })
}
function generateRefreshToken(user) {
    return jwt.sign(user, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

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
        // { id, username, email, password, created_at } sumber dari DB

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials!' })
        }

        const payload = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }

        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        await pool.request()
            .input('refreshToken', sql.VarChar, refreshToken)
            .input('id', sql.Int, user.id)
            .query('UPDATE Users SET refreshToken = @refreshToken WHERE id = @id')

        res.json({
            message: 'Login successful',
            accessToken,
            refreshToken
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

router.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' })

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('refreshToken', sql.VarChar, refreshToken)
            .query('SELECT * FROM Users WHERE refreshToken = @refreshToken')

        if (result.recordset.length === 0) {
            return res.status(403).json({ message: 'Invalid refresh token!' })
        }
        const user = result.recordset[0];
        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
            if (err) return res.status(403).json({ message: 'Invalid or expired refresh token' });
            const payload = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }

            const newAccessToken = generateAccessToken(payload);
            res.json({ accessToken: newAccessToken })
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('refreshToken', sql.VarChar, refreshToken)
            .query('UPDATE Users SET refreshToken = NULL WHERE refreshToken = @refreshToken')

        res.json({ message: 'Logged out successfully' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})
module.exports = router;