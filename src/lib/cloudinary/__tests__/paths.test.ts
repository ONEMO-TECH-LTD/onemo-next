import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_PREFIX = process.env.CLOUDINARY_ENV_PREFIX;

afterEach(() => {
  if (ORIGINAL_PREFIX === undefined) {
    delete process.env.CLOUDINARY_ENV_PREFIX;
  } else {
    process.env.CLOUDINARY_ENV_PREFIX = ORIGINAL_PREFIX;
  }
  vi.resetModules();
});

describe('Cloudinary path helpers', () => {
  it('builds all paths with dev prefix when CLOUDINARY_ENV_PREFIX=dev/', async () => {
    process.env.CLOUDINARY_ENV_PREFIX = 'dev/';

    const {
      getPrivateFolder,
      getPublicPreviewsFolder,
      getOrderPreviewsFolder,
      getFramesFolder,
    } = await import('../paths');

    expect(getPrivateFolder('user_123')).toBe(
      'dev/onemo-designs/private/customer_user_123/',
    );
    expect(getPublicPreviewsFolder()).toBe('dev/onemo-designs/public_previews/');
    expect(getOrderPreviewsFolder()).toBe('dev/onemo-designs/order_previews/');
    expect(getFramesFolder()).toBe('dev/onemo-frames/');
  });

  it('builds all paths without prefix when CLOUDINARY_ENV_PREFIX is empty', async () => {
    process.env.CLOUDINARY_ENV_PREFIX = '';

    const {
      getPrivateFolder,
      getPublicPreviewsFolder,
      getOrderPreviewsFolder,
      getFramesFolder,
    } = await import('../paths');

    expect(getPrivateFolder('abc')).toBe('onemo-designs/private/customer_abc/');
    expect(getPublicPreviewsFolder()).toBe('onemo-designs/public_previews/');
    expect(getOrderPreviewsFolder()).toBe('onemo-designs/order_previews/');
    expect(getFramesFolder()).toBe('onemo-frames/');
  });

  it('falls back to empty prefix when CLOUDINARY_ENV_PREFIX is unset', async () => {
    delete process.env.CLOUDINARY_ENV_PREFIX;

    const {
      getPrivateFolder,
      getPublicPreviewsFolder,
      getOrderPreviewsFolder,
      getFramesFolder,
    } = await import('../paths');

    expect(getPrivateFolder('customer_9')).toBe(
      'onemo-designs/private/customer_customer_9/',
    );
    expect(getPublicPreviewsFolder()).toBe('onemo-designs/public_previews/');
    expect(getOrderPreviewsFolder()).toBe('onemo-designs/order_previews/');
    expect(getFramesFolder()).toBe('onemo-frames/');
  });
});
