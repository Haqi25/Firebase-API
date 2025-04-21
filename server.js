const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const cookieParser = require("cookie-parser");
const cluster = require("cluster");
const os = require("os");
const { Worker } = require("worker_threads");
require("dotenv").config();

const numCPUs = os.cpus().length;

// 🛑 Cegah penggunaan cluster di Azure App Service
if (cluster.isMaster && !process.env.WEBSITE_INSTANCE_ID) {
  console.log(`Master ${process.pid} berjalan...`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} berhenti, memulai ulang...`);
    cluster.fork();
  });
} else {
  // ✅ Inisialisasi Express
  const app = express();

  // ✅ Middleware
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, "public")));
  app.set("view engine", "ejs");

  // ✅ Inisialisasi Firebase Admin SDK
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log("🔥 Firebase Admin SDK berhasil diinisialisasi.");
  } catch (err) {
    console.error("❌ Gagal menginisialisasi Firebase:", err);
    process.exit(1); // Hentikan server jika Firebase gagal diinisialisasi
  }

  // ✅ Middleware untuk verifikasi token
  const verifyToken = async (req, res, next) => {
    try {
      const idToken = req.cookies.session || "";
      if (!idToken) return res.redirect("/login");

      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Error verifying token:", error);
      res.redirect("/login");
    }
  };

  // ✅ Routes
  app.get("/", (req, res) => res.render("index"));
  app.get("/login", (req, res) => res.render("login"));
  app.get("/register", (req, res) => res.render("register"));
  app.get("/beranda", verifyToken, (req, res) =>
    res.render("beranda", { user: req.user })
  );

  // ✅ API untuk login
  app.post("/api/login", async (req, res) => {
    try {
      const idToken = req.body.idToken;
      await admin.auth().verifyIdToken(idToken);

      res.cookie("session", idToken, {
        maxAge: 60 * 60 * 24 * 5 * 1000, // 5 hari
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      });
      res.status(200).json({ success: true, message: "Login berhasil" });
    } catch (error) {
      console.error("Error login:", error);
      res.status(401).json({ success: false, message: "Autentikasi gagal" });
    }
  });

  // ✅ API untuk logout
  app.get("/api/logout", (req, res) => {
    res.clearCookie("session");
    res.redirect("/login");
  });

  // ✅ Inisialisasi Worker Pool
  const workerPool = [];
  try {
    for (let i = 0; i < os.cpus().length; i++) {
      workerPool.push(new Worker("./worker.js"));
    }
    console.log("⚡ Worker pool berhasil dibuat.");
  } catch (err) {
    console.error("❌ Worker threads tidak bisa dibuat:", err);
  }

  // ✅ API untuk tugas berat
  app.get("/heavy-task", (req, res) => {
    let worker = workerPool.pop();

    if (!worker) {
      try {
        worker = new Worker("./worker.js"); // Buat worker baru jika pool kosong
      } catch (err) {
        return res.status(500).json({ error: "Tidak bisa membuat worker" });
      }
    }

    worker.on("message", (result) => {
      res.json({ message: "Task Completed", result });
      workerPool.push(worker); // Masukkan kembali worker ke pool
    });

    worker.on("error", (err) => {
      res.status(500).json({ error: err.message });
    });
  });

  // ✅ Start Server - listen on all interfaces

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
