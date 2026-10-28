import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// configuracion del pool de conexiones hacia mariadb / mysql
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fitmanager',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// funcion auxiliar para verificar el estado de la conexion
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { ok: true };
  } catch (error) {
    // retornamos el error controlado sin exponer detalles sensibles
    return { ok: false, error: error.message };
  }
}

export default pool;
