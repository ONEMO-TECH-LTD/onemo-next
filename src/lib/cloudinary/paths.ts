const prefix = process.env.CLOUDINARY_ENV_PREFIX ?? '';

export function getPrivateFolder(userId: string): string {
  return `${prefix}onemo-designs/private/customer_${userId}/`;
}

export function getPublicPreviewsFolder(): string {
  return `${prefix}onemo-designs/public_previews/`;
}

export function getOrderPreviewsFolder(): string {
  return `${prefix}onemo-designs/order_previews/`;
}

export function getFramesFolder(): string {
  return `${prefix}onemo-frames/`;
}
