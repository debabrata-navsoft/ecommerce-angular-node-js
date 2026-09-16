const millis = (value) => (value instanceof Date ? value.getTime() : (value ?? null));

export function toCartItem(doc) {
  const product = doc.productId;
  if (!product || !product._id) return null;

  return {
    id: String(product._id),
    productId: String(product._id),
    name: product.title,
    price: product.price,
    discount: product.discount ?? 0,
    image: product.image,
    category: product.category,
    subCategory: product.subCategory ?? '',
    brand: product.brand,
    stock: product.stock,
    quantity: doc.quantity ?? 1,
    createdAt: millis(doc.createdAt),
  };
}

export function toWishlistProduct(doc) {
  const product = doc.productId;
  if (!product || !product._id) return null;

  return {
    ...(typeof product.toJSON === 'function' ? product.toJSON() : product),
    createdAt: millis(doc.createdAt),
  };
}

export function mapDefined(docs, mapper) {
  return docs.map(mapper).filter(Boolean);
}

export function toOrderItem(doc) {
  const product = doc.productId;
  return {
    productId: product._id,
    title: product.title,
    image: product.image,
    price: product.price,
    quantity: doc.quantity ?? 1,
    discount: product.discount ?? 0,
  };
}
