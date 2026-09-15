const toMillis = (value) => (value instanceof Date ? value.getTime() : (value ?? null));

function normalize(ret, { aliasId, hide, after }) {
  if (ret._id !== undefined) ret.id = String(ret._id);
  if (aliasId) ret[aliasId] = ret.id;

  // The Angular models type createdAt as a number, so timestamps go out as epoch millis.
  if ('createdAt' in ret) ret.createdAt = toMillis(ret.createdAt);
  if ('updatedAt' in ret) ret.updatedAt = toMillis(ret.updatedAt);

  delete ret._id;
  delete ret.__v;
  for (const field of hide) delete ret[field];

  after?.(ret);
  return ret;
}

/**
 * Every schema serialized the same way by hand: expose `id`, strip Mongo internals, turn
 * Dates into millis. This applies that once.
 *
 * `aliasId` mirrors `id` under another key (the Angular `User` model keys off `uid`).
 * `hide` drops fields that must never leave the server. `after` handles the per-model
 * tweaks, e.g. Order using its public `orderId` as `id`.
 */
export function serializeJson(schema, { aliasId, hide = [], after } = {}) {
  schema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => normalize(ret, { aliasId, hide, after }),
  });
}

/**
 * Aggregation pipelines return plain objects, which never pass through a schema's toJSON,
 * so they need the same treatment applied directly.
 */
export function serializeLean(raw, options = {}) {
  return normalize({ ...raw }, { hide: [], ...options });
}
