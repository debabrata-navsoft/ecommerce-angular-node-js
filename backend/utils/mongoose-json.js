const toMillis = (value) => (value instanceof Date ? value.getTime() : (value ?? null));

function normalize(ret, { aliasId, hide, after }) {
  if (ret._id !== undefined) ret.id = String(ret._id);
  if (aliasId) ret[aliasId] = ret.id;

  if ('createdAt' in ret) ret.createdAt = toMillis(ret.createdAt);
  if ('updatedAt' in ret) ret.updatedAt = toMillis(ret.updatedAt);

  delete ret._id;
  delete ret.__v;
  for (const field of hide) delete ret[field];

  after?.(ret);
  return ret;
}

export function serializeJson(schema, { aliasId, hide = [], after } = {}) {
  schema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => normalize(ret, { aliasId, hide, after }),
  });
}

export function serializeLean(raw, options = {}) {
  return normalize({ ...raw }, { hide: [], ...options });
}
