import { body, param } from 'express-validator';

export const objectIdParam = (name) =>
  param(name).isMongoId().withMessage(`${name} must be a valid id`);

export const objectIdBody = (name) =>
  body(name).isMongoId().withMessage(`${name} must be a valid id`);

export const addressRules = (prefix = '') => {
  const at = (field) => (prefix ? `${prefix}.${field}` : field);

  return [
    body(at('fullName')).isString().trim().notEmpty().withMessage('Full name is required'),
    body(at('email')).isEmail().withMessage('A valid email is required').normalizeEmail(),
    body(at('phone'))
      .isString()
      .trim()
      .matches(/^[0-9+\-\s()]{7,20}$/)
      .withMessage('A valid phone number is required'),
    body(at('address')).isString().trim().notEmpty().withMessage('Address is required'),
    body(at('landmark')).optional({ values: 'falsy' }).isString().trim(),
    body(at('city')).isString().trim().notEmpty().withMessage('City is required'),
    body(at('state')).isString().trim().notEmpty().withMessage('State is required'),
    body(at('pinCode'))
      .customSanitizer((value) => String(value ?? '').trim())
      .matches(/^[0-9]{4,10}$/)
      .withMessage('A valid PIN code is required'),
  ];
};

export const productRules = ({ partial = false } = {}) => {
  const need = (chain) => (partial ? chain.optional() : chain);

  return [
    need(body('title').isString().trim().notEmpty().withMessage('Title is required')),
    need(body('price').isFloat({ min: 0 }).withMessage('Price must be 0 or more').toFloat()),
    need(body('stock').isInt({ min: 0 }).withMessage('Stock must be 0 or more').toInt()),
    need(body('brand').isString().trim().notEmpty().withMessage('Brand is required')),
    need(body('category').isString().trim().notEmpty().withMessage('Category is required')),
    need(body('image').isString().trim().notEmpty().withMessage('Image is required')),

    body('subCategory').optional({ values: 'falsy' }).isString().trim(),
    body('color').optional({ values: 'falsy' }).isString().trim(),
    body('description').optional({ values: 'falsy' }).isString(),
    body('discount').optional().isFloat({ min: 0, max: 100 }).toFloat(),
    body('rating').optional().isFloat({ min: 0, max: 5 }).toFloat(),
    body('sales').optional().isInt({ min: 0 }).toInt(),
    body('views').optional().isInt({ min: 0 }).toInt(),
  ];
};
