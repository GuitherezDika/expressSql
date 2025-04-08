const express = require('express');
const app = express();
const authRoutes = require('./auth');
const port = 3000;
const authenticateToken = require('./middleware/auth');
const { poolPromise } = require('./db');


app.use(express.json());
app.use('/auth', authRoutes)

app.get('/users', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Users');
        res.json(result.recordset)
    } catch (error) {
        console.log(error);
        
        res.status(500).send(error.message)
    }
})

app.listen(port, ()=> {
    console.log(`🚀 Server is running on http://localhost:${port}`);
})