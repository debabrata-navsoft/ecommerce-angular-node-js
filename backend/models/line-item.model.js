import mongoose from 'mongoose';

const { Schema } = mongoose;

export function createLineItemModel(modelName, collectionName) {
  const schema = new Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, default: 1, min: 1 },
    },
    { timestamps: true, collection: collectionName },
  );

  schema.index({ userId: 1, productId: 1 }, { unique: true });
  schema.index({ userId: 1, createdAt: -1 });

  return mongoose.model(modelName, schema);
}
