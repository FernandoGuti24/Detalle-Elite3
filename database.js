const Database = require('better-sqlite3');
const path = require('path');

let db;
let dbInitialized = false;

function initDatabase() {
    try {
        const dbPath = path.join(__dirname, 'bookings.db');
        db = new Database(dbPath);

        // Crear tabla si no existe
        db.exec(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id TEXT,
                nombre TEXT,
                email TEXT,
                telefono TEXT,
                direccion TEXT,
                fecha TEXT,
                hora TEXT,
                servicio TEXT,
                vehiculo TEXT,
                extras TEXT,
                total TEXT,
                comentarios TEXT,
                status TEXT DEFAULT 'confirmada',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                user_agent TEXT
            )
        `);

        // Índice para búsquedas rápidasa
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_appointments_fecha_hora 
            ON appointments(fecha, hora)
        `);

        dbInitialized = true;
        console.log('✅ Base de datos SQLite (better-sqlite3) inicializada');
        return db;
    } catch (error) {
        console.error('❌ Error inicializando DB:', error);
        throw error;
    }
}

function saveAppointment(bookingData, ipAddress, userAgent) {
    if (!db) throw new Error('DB no inicializada');

    const stmt = db.prepare(`
        INSERT INTO appointments (
            booking_id, nombre, email, telefono, direccion,
            fecha, hora, servicio, vehiculo, extras, total,
            comentarios, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
        bookingData.booking_id || ('BK-' + Date.now()),
        bookingData.nombre || 'No especificado',
        bookingData.email || 'no-email@proporcionado.com',
        bookingData.telefono || null,
        bookingData.direccion || 'No especificada',
        bookingData.fecha || '',
        bookingData.hora || '',
        bookingData.servicio || 'No especificado',
        bookingData.vehiculo || 'No especificado',
        bookingData.extras || null,
        bookingData.total || '0',
        bookingData.comentarios || null,
        ipAddress || null,
        userAgent || null
    );

    return {
        id: info.lastInsertRowid,
        booking_id: bookingData.booking_id
    };
}

function isSlotBooked(fecha, hora) {
    if (!db) return false;
    const stmt = db.prepare(`
        SELECT COUNT(*) as count FROM appointments
        WHERE fecha = ? AND hora = ? AND status = 'confirmada'
    `);
    const result = stmt.get(fecha, hora);
    return result.count > 0;
}

function getAllAppointments() {
    if (!db) return [];
    const stmt = db.prepare(`
        SELECT * FROM appointments ORDER BY fecha DESC, hora DESC
    `);
    return stmt.all();
}

module.exports = {
    saveAppointment,
    isSlotBooked,
    initDatabase,
    isInitialized: () => dbInitialized,
    getAllAppointments
};