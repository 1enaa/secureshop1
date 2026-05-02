'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes
router.get('/', productController.listProducts);
router.get('/search', [query('q').trim().notEmpty()], productController.searchProducts);
router.get('/categories', productController.listCategories);
router.get('/:id', productController.getProduct);

// Admin routes
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('name').trim().notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('sku').trim().notEmpty(),
  ],
  productController.createProduct
);

router.put('/:id', authenticate, requireAdmin, productController.updateProduct);
router.delete('/:id', authenticate, requireAdmin, productController.deleteProduct);

module.exports = router;
