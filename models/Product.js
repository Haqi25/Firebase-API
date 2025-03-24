const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: String,
    price: Number
}, { collection: 'products' }); // Nama koleksi di MongoDB

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
