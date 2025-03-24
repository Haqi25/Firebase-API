const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const path = require('path');
const cookieParser = require('cookie-parser');
const cluster = require('cluster');
const os = require('os');
const { Worker } = require('worker_threads');
require('dotenv').config();

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} berjalan...`);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} berhenti, memulai ulang...`);
        cluster.fork();
    });
} else {
    // Inisialisasi Express
    const app = express();
    
    // Middleware
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));
    app.set('view engine', 'ejs');

    // Inisialisasi Firebase Admin SDK
// Menggunakan environment variable
   const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});
    // Middleware untuk verifikasi token
    const verifyToken = async (req, res, next) => {
        try {
            const idToken = req.cookies.session || '';
            if (!idToken) return res.redirect('/login');
            
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            req.user = decodedToken;
            next();
        } catch (error) {
            console.error('Error verifying token:', error);
            res.redirect('/login');
        }
    };

    // Routes
    app.get('/', (req, res) => res.render('index'));
    app.get('/login', (req, res) => res.render('login'));
    app.get('/register', (req, res) => res.render('register'));
    app.get('/beranda', verifyToken, (req, res) => res.render('beranda', { user: req.user }));

    // API untuk login
    app.post('/api/login', async (req, res) => {
        try {
            const idToken = req.body.idToken;
            await admin.auth().verifyIdToken(idToken);
            
            res.cookie('session', idToken, { 
                maxAge: 60 * 60 * 24 * 5 * 1000, // 5 hari
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production' 
            });
            res.status(200).json({ success: true, message: 'Login berhasil' });
        } catch (error) {
            console.error('Error login:', error);
            res.status(401).json({ success: false, message: 'Autentikasi gagal' });
        }
    });

    // API untuk logout
    app.get('/api/logout', (req, res) => {
        res.clearCookie('session');
        res.redirect('/login');
    });
    
    const workerPool = [];

for (let i = 0; i < require("os").cpus().length; i++) {
    workerPool.push(new Worker("./worker.js"));
}


    // API untuk tugas berat
    app.get("/heavy-task", (req, res) => {
        const worker = workerPool.pop() || new Worker("./worker.js");
    
        worker.on("message", (result) => {
            res.json({ message: "Task Completed", result });
            workerPool.push(worker);  // Kembalikan worker ke pool setelah selesai
        });
    
        worker.on("error", (err) => {
            res.status(500).json({ error: err.message });
        });
    });

   // Start Server - listen on all interfaces
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
});
