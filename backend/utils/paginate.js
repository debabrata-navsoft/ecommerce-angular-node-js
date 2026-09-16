const MAX_LIMIT = 200;

export function readPaging(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const raw = query.limit === undefined ? 0 : Number(query.limit);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, MAX_LIMIT) : 0;

  return { page, limit };
}

export async function paginate(Model, filter, sort, query, serialize = (doc) => doc.toJSON()) {
  const { page, limit } = readPaging(query);

  const cursor = Model.find(filter).sort(sort);
  if (limit) cursor.skip((page - 1) * limit).limit(limit);

  const [docs, total] = await Promise.all([cursor.exec(), Model.countDocuments(filter)]);

  return {
    items: docs.map(serialize),
    total,
    page: limit ? page : 1,
    limit,
    pages: limit ? Math.ceil(total / limit) : 1,
  };
}
