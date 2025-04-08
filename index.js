const express = require('express');
const app = express();
const authRoutes = require('./auth');
const port = 3000;


app.use(express.json());
app.use('/auth', authRoutes)

app.listen(port, ()=> {
    console.log(`🚀 Server is running on http://localhost:${port}`);
})