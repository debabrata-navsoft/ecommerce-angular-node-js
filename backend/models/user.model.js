import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { serializeJson } from '../utils/mongoose-json.js';

const { Schema } = mongoose;

const SALT_ROUNDS = 12;

const addressSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pinCode: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

serializeJson(addressSchema);

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    phoneNumber: { type: [String], default: [] },
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    addresses: { type: [addressSchema], default: [] },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

serializeJson(userSchema, {
  aliasId: 'uid',
  hide: ['passwordHash', 'resetTokenHash', 'resetTokenExpiresAt'],
});

userSchema.virtual('displayName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
};

userSchema.methods.comparePassword = function (plain) {
  if (!this.passwordHash) {
    throw new Error('comparePassword called on a user loaded without +passwordHash');
  }
  return bcrypt.compare(plain, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
