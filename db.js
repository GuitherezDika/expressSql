const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config();

const {
    DB_USER,
    DB_PASSWORD,
    DB_SERVER,
    DB_DATABASE,
    DB_PORT
} = process.env;

const config = {
    user: DB_USER,
    password: DB_PASSWORD,
    server: DB_SERVER,
    database: DB_DATABASE,
    port: parseInt(DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
}

const poolPromise = new sql.ConnectionPool(config)
poolPromise
    .connect()
    .then(pool => {
        console.log("Connected to SQL Server ");
        return pool
    })
    .catch(err => {
        console.log('Database connection failed! ', err);
        process.exit(1)
    })

module.exports = {
    sql, poolPromise
}