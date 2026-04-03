require('dotenv').config();

const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const basicAuth = require('express-basic-auth');

const database = require("./database");

const app = express();
const PORT = process.env.PORT || 3012;

// ================= MIDDLEWARE CRÍTICO - ORDEN ESPECÍFICO =================

// 1. CORS primero
app.use(cors());

// 2. Body parsers ANTES de cualquier otra cosa
// Parser para JSON
app.use(express.json({ 
    limit: '10mb',
    strict: false  // Permite JSON más flexible
}));

// Parser para URL encoded
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 10000
}));

// 3. Middleware personalizado para capturar body crudo (debug)
app.use((req, res, next) => {
    let data = '';
    req.on('data', chunk => {
        data += chunk;
    });
    req.on('end', () => {
        req.rawBody = data;
        console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Raw body length:', data.length);
        if (data) {
            console.log('Raw body preview:', data.substring(0, 200));
        }
    });
    next();
});

// 4. Middleware para verificar que el body llegó
app.use((req, res, next) => {
    if (req.path === '/api/agendar') {
        console.log('Body después de parsers:', req.body);
        console.log('Body keys:', Object.keys(req.body || {}));
    }
    next();
});

// 5. Rate limiting DESPUÉS de los parsers
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: "Demasiadas solicitudes, intenta más tarde." }
});
app.use("/api/agendar", limiter);

// 6. Archivos estáticos al final
app.use(express.static(path.join(__dirname, "public")));

// ================= EMAIL CONFIG =================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error("❌ Email error:", error.message);
    } else {
        console.log("✅ Email OK");
    }
});

// ================= ENDPOINT DE PRUEBA DE EMAIL (NUEVO) =================
app.get("/api/test-email", async (req, res) => {
    try {
        await transporter.sendMail({
            from: `"Elite Detail Test" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: "🔧 Prueba de correo",
            text: "Si recibes este mensaje, la configuración de correo funciona correctamente.",
            html: "<p>✅ Correo enviado con éxito.</p>"
        });
        res.send("✅ Email enviado correctamente");
    } catch (error) {
        console.error("Error al enviar email de prueba:", error);
        res.status(500).send(`❌ Error: ${error.message}`);
    }
});

// ========== ADMIN PANEL CON AUTENTICACIÓN ==========

// Middleware de autenticación para rutas bajo /admin
app.use('/admin', basicAuth({
    users: {
        [process.env.ADMIN_USER || 'fjgutierrez@gmail.com']: process.env.ADMIN_PASS || 'Joseparrales2026'
    },
    challenge: true,
    realm: 'Admin Panel'
}));

// 1. Endpoint JSON con todas las citas
app.get('/admin/db', (req, res) => {
    try {
        if (!database.isInitialized()) {
            return res.status(500).json({ error: 'Base de datos no inicializada' });
        }
        const appointments = database.getAllAppointments();
        res.json(appointments);
    } catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Endpoint HTML con tabla amigable
app.get('/admin', (req, res) => {
    try {
        const rows = database.getAllAppointments();
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Panel Admin - Elite Detail</title>
            <style>
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    margin: 30px;
                    background: #f5f7fa;
                }
                h1 { color: #2c7a4d; }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                }
                th {
                    background-color: #2c7a4d;
                    color: white;
                }
                tr:nth-child(even) {
                    background-color: #f2f2f2;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <h1>📋 Citas registradas - Elite Detail</h1>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Booking ID</th>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Teléfono</th>
                        <th>Dirección</th>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Servicio</th>
                        <th>Vehículo</th>
                        <th>Extras</th>
                        <th>Total</th>
                        <th>Comentarios</th>
                        <th>Estado</th>
                        <th>Fecha creación</th>
                    </tr>
                </thead>
                <tbody>
        `;
        for (let row of rows) {
            html += `
                <tr>
                    <td>${escapeHtml(row.id)}</td>
                    <td>${escapeHtml(row.booking_id || '')}</td>
                    <td>${escapeHtml(row.nombre)}</td>
                    <td>${escapeHtml(row.email)}</td>
                    <td>${escapeHtml(row.telefono || '')}</td>
                    <td>${escapeHtml(row.direccion)}</td>
                    <td>${escapeHtml(row.fecha)}</td>
                    <td>${escapeHtml(row.hora)}</td>
                    <td>${escapeHtml(row.servicio)}</td>
                    <td>${escapeHtml(row.vehiculo)}</td>
                    <td>${escapeHtml(row.extras || '')}</td>
                    <td>${escapeHtml(row.total)}</td>
                    <td>${escapeHtml(row.comentarios || '')}</td>
                    <td>${escapeHtml(row.status || 'confirmada')}</td>
                    <td>${escapeHtml(row.created_at || '')}</td>
                </tr>
            `;
        }
        html += `
                </tbody>
            </table>
            <div class="footer">
                <p>Total de citas: ${rows.length}</p>
                <p>Generado el: ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (error) {
        console.error('Error al generar panel:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// Función auxiliar para escapar HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ================= ENDPOINT PRINCIPAL =================
app.post("/api/agendar", async (req, res) => {
    console.log("\n" + "=".repeat(60));
    console.log("📥 NUEVA CITA");
    console.log("=".repeat(60));
    
    try {
        // ========== RECUPERACIÓN DEFENSIVA DEL BODY ==========
        let body = req.body;
        
        // Si req.body está vacío, intentar parsear rawBody
        if (!body || Object.keys(body).length === 0) {
            console.log("⚠️ req.body vacío, intentando rawBody...");
            try {
                if (req.rawBody && req.rawBody.trim()) {
                    body = JSON.parse(req.rawBody);
                    console.log("✅ Parseado desde rawBody:", body);
                }
            } catch (parseError) {
                console.error("❌ Error parseando rawBody:", parseError.message);
                return res.status(400).json({ 
                    error: "JSON inválido",
                    details: parseError.message 
                });
            }
        }
        
        // Si sigue vacío, error
        if (!body || Object.keys(body).length === 0) {
            console.error("❌ Body completamente vacío");
            return res.status(400).json({ 
                error: "No se recibieron datos",
                tip: "Verifica que estés enviando Content-Type: application/json"
            });
        }
        
        console.log("Body final:", JSON.stringify(body, null, 2));
        
        // ========== EXTRAER CAMPOS ==========
        const nombre = String(body.nombre || "").trim();
        const email = String(body.email || "").trim();
        const telefono = String(body.telefono || "").trim();
        const direccion = String(body.direccion || "").trim();
        const fecha = String(body.fecha || "").trim();
        const hora = String(body.hora || "").trim();
        const servicio = String(body.servicio || "No especificado").trim();
        const vehiculo = String(body.vehiculo || "No especificado").trim();
        const extras = String(body.extras || "Ninguno").trim();
        const total = String(body.total || "$0").trim();
        const comentarios = String(body.comentarios || "").trim();
        
        console.log("Campos extraídos:", { nombre, email, fecha, hora });
        
        // ========== VALIDACIONES ==========
        if (!nombre) {
            return res.status(400).json({ 
                error: "El nombre es requerido",
                received: body.nombre,
                type: typeof body.nombre
            });
        }
        
        if (!email || !email.includes("@")) {
            return res.status(400).json({ error: "Email válido requerido" });
        }
        
        if (!direccion) return res.status(400).json({ error: "Dirección requerida" });
        if (!fecha) return res.status(400).json({ error: "Fecha requerida" });
        if (!hora) return res.status(400).json({ error: "Hora requerida" });
        
        // ========== INICIALIZAR DB ==========
        if (!database.isInitialized()) {
            await database.initDatabase();
        }
        
        // ========== VERIFICAR DISPONIBILIDAD ==========
        const isBooked = database.isSlotBooked(fecha, hora);
        if (isBooked) {
            return res.status(409).json({ error: "Horario ya reservado" });
        }
        
        // ========== GUARDAR ==========
        const bookingId = 'ELITE-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);
        
        const appointmentData = {
            booking_id: bookingId,
            nombre: nombre,
            email: email.toLowerCase(),
            telefono: telefono,
            direccion: direccion,
            fecha: fecha,
            hora: hora,
            servicio: servicio,
            vehiculo: vehiculo,
            extras: extras,
            total: total,
            comentarios: comentarios
        };
        
        console.log("💾 Guardando:", appointmentData);
        
        const saved = database.saveAppointment(
            appointmentData,
            req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            req.headers['user-agent']
        );
        
        console.log("✅ Guardado exitoso:", saved);
        
        // ========== ENVIAR EMAILS ==========
        let emailSent = false;
        try {
            // Email cliente
            await transporter.sendMail({
                from: `"Elite Detail" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "✅ Confirmación de Cita - Elite Detail",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px;">
                        <h2 style="color: #2c7a4d;">✨ ¡Hola ${nombre}!</h2>
                        <p>Tu cita ha sido <strong>confirmada</strong>.</p>
                        <p><strong>ID:</strong> ${bookingId}</p>
                        <p><strong>📅 Fecha:</strong> ${fecha}</p>
                        <p><strong>⏰ Hora:</strong> ${hora}</p>
                        <p><strong>📍 Dirección:</strong> ${direccion}</p>
                        <p><strong>🧼 Servicio:</strong> ${servicio}</p>
                        <p><strong>➕Extras:</strong> ${extras}</p>
                        <p><strong>💰 Total:</strong> ${total}</p>
                    </div>
                `
            });
            
            // Email admin
            await transporter.sendMail({
                from: `"Elite Detail" <${process.env.EMAIL_USER}>`,
                to: process.env.EMAIL_USER,
                subject: `🔔 Nueva Cita - ${nombre}`,
                html: `
                    <div>
                        <h2>🚗 Nueva Cita</h2>
                        <p><strong>Cliente:</strong> ${nombre}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Tel:</strong> ${telefono}</p>
                        <p><strong>Fecha/Hora:</strong> ${fecha} ${hora}</p>
                        <p><strong>Dirección:</strong> ${direccion}</p>
                        <p><strong>Servicio:</strong> ${servicio}</p>
                        <p><strong> Extras:</strong> ${extras}</p>
                        <p><strong>Total:</strong> ${total}</p>
                    </div>
                `
            });
            
            emailSent = true;
            console.log("📧 Emails enviados");
        } catch (emailError) {
            console.error("❌ Error email:", emailError.message);
        }
        
        res.json({
            success: true,
            message: "Cita confirmada exitosamente",
            bookingId: bookingId,
            emailSent: emailSent
        });
        
    } catch (error) {
        console.error("❌ Error general:", error);
        res.status(500).json({ 
            error: "Error al procesar la cita: " + error.message,
            stack: error.stack
        });
    }
});

// ================= ADMIN: LISTAR CITAS =================
app.get("/admin/appointments", (req, res) => {
    try {
        if (!database.isInitialized()) {
            return res.status(500).json({ error: "Base de datos no inicializada" });
        }
        const appointments = database.getAllAppointments();
        res.json(appointments);
    } catch (error) {
        console.error("Error obteniendo citas:", error);
        res.status(500).json({ error: error.message });
    }
});

// ================= TEST ENDPOINT =================
app.post("/api/test", (req, res) => {
    res.json({
        body: req.body,
        rawBody: req.rawBody,
        contentType: req.headers['content-type']
    });
});

// ================= OTROS ENDPOINTS =================
app.get("/api/health", (req, res) => {
    res.json({ 
        status: "OK", 
        dbInitialized: database.isInitialized(),
        emailConfigured: !!process.env.EMAIL_USER
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
});

// ================= START =================
app.listen(PORT, async () => {
    console.log("=".repeat(50));
    console.log(`🚀 Servidor: http://localhost:${PORT}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER || 'NO CONFIGURADO'}`);
    console.log("=".repeat(50));
    
    try {
        await database.initDatabase();
        console.log("✅ DB lista");
    } catch (err) {
        console.error("❌ Error DB:", err);
    }
});