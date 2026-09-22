export function normalizeServiceId(serviceId: string): string {
  if (serviceId.startsWith('srv-')) return serviceId
  return `srv-${String(serviceId).padStart(3, '0')}`
}
