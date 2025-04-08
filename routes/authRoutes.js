const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { poolPromise, sql } = require('../db');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { loginLimiter } = require('../middleware/rateLimiter');

function generateAccessToken(user) {
    return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })
}
function generateRefreshToken(user) {
    return jwt.sign(user, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

router.post('/register',
    [ // express - validator
        body('username').trim().notEmpty().withMessage('Username is required').escape(),
        body('email').isEmail().withMessage('Invalid email format'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        const { username, email, password, role } = req.body;

        try {
            const pool = await poolPromise;
            const hashedPassword = await bcrypt.hash(password, 10);

            await pool.request()
                .input('username', sql.VarChar, username)
                .input('email', sql.VarChar, email)
                .input('password', sql.VarChar, hashedPassword)
                .input('role', sql.VarChar, role)
                .query(`
                INSERT INTO Users (username, email, password, role)
                VALUES (@username, @email, @password, @role)
            `);

            res.status(201).json({ message: 'User registered successfully' })
        } catch (err) {
            res.status(500).json({ error: err.message })
        }
    });

router.post('/login',
    loginLimiter,
    [
        body('username').trim().notEmpty().withMessage('Username is required').escape(),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
        const { username, password } = req.body;

        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('username', sql.VarChar, username)
                .query('SELECT * FROM Users WHERE username = @username');

            if (result.recordset.length === 0) return res.status(401).json({ message: 'Invalid credentials' })

            const user = result.recordset[0];
            // { id, username, email, password, created_at } sumber dari DB

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).json({ message: 'Invalid credentials!' })

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

        if (result.recordset.length === 0) return res.status(403).json({ message: 'Invalid refresh token!' })

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