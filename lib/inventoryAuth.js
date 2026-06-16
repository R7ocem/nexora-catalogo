export function inventoryAuthorized(request) {
  const token = process.env.INVENTORY_CRON_TOKEN;
  const header = request.headers.get('authorization') || '';

  return Boolean(token) && header === `Bearer ${token}`;
}

export function inventoryUnauthorized() {
  return Response.json(
    { error: 'unauthorized' },
    { status: 401 }
  );
}
