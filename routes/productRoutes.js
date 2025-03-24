const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// ✅ GET Semua Produk (Render ke Halaman Beranda)
router.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        res.render('beranda', { products, user: { email: 'user@example.com', uid: '12345' } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ POST Tambah Produk
router.post('/add', async (req, res) => {
    try {
        const { name, price } = req.body;
        const newProduct = new Product({ name, price });
        await newProduct.save();
        res.redirect('/products');
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ✅ POST Edit Produk
router.post('/edit/:id', async (req, res) => {
    try {
        const { name, price } = req.body;
        await Product.findByIdAndUpdate(req.params.id, { name, price });
        res.redirect('/products');
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ✅ GET Hapus Produk
router.get('/delete/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/products');
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ GET Data untuk Tombol "Ambil Data"
router.get('/api/data', async (req, res) => {
    try {
        const products = await Product.find();
        res.json({
            message: "Data berhasil diambil!",
            status: "success",
            products
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
