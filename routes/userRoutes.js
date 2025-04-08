const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const { poolPromise, sql } = require('../db');
const authorizeRole = require('../middleware/authorizeRole');
const router = express.Router();

router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Users');
        res.json(result.recordset)
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message)
    }
})

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query("SELECT * FROM Users where id = @id")
        res.json(result.recordset[0])
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message)
    }
})
module.exports = router;
