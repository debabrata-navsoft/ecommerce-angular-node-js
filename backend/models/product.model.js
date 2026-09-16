import mongoose from 'mongoose';

import { serializeJson } from '../utils/mongoose-json.js';

const { Schema } = mongoose;

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    searchName: { type: String, index: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    brand: { type: String, required: true, trim: true },
    color: { type: String, trim: true, default: '' },
    category: { type: String, required: true, trim: true, lowercase: true, index: true },
    subCategory: { type: String, trim: true, lowercase: true, default: '', index: true },
    image: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    sales: { type: Number, default: 0, min: 0 },
    views: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    discountPrice: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true },
);

serializeJson(productSchema);

productSchema.index({ category: 1, subCategory: 1 });
productSchema.index({ discount: -1, createdAt: -1 });
productSchema.index({ title: 'text', brand: 'text', description: 'text' });

export function computeDiscountPrice(price, discount) {
  if (!discount) return price;
  return price - (price * discount) / 100;
}

productSchema.pre('save', function (next) {
  if (this.isModified('title')) this.searchName = this.title.toLowerCase().trim();
  if (this.isModified('price') || this.isModified('discount')) {
    this.discountPrice = computeDiscountPrice(this.price, this.discount);
  }
  next();
});

productSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() ?? {};
  const $set = update.$set ?? update;

  if (typeof $set.title === 'string') $set.searchName = $set.title.toLowerCase().trim();

  if ($set.price !== undefined || $set.discount !== undefined) {
    const current = await this.model.findOne(this.getQuery()).select('price discount').lean();
    if (current) {
      $set.discountPrice = computeDiscountPrice(
        $set.price ?? current.price,
        $set.discount ?? current.discount ?? 0,
      );
    }
  }

  this.setUpdate(update.$set ? { ...update, $set } : $set);
  next();
});

export const Product = mongoose.model('Product', productSchema);
