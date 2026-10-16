import type { ImageMetadata } from 'astro';

const pick = (glob: Record<string, { default: ImageMetadata }>) =>
  Object.fromEntries(
    Object.entries(glob).map(([path, mod]) => [
      path
        .split('/')
        .pop()!
        .replace(/\.(jpg|png)$/, ''),
      mod.default,
    ]),
  ) as Record<string, ImageMetadata>;

export const colorImages = pick(import.meta.glob('../assets/cores/*.jpg', { eager: true }));
export const environmentImages = {
  ...pick(import.meta.glob('../assets/ambientes/*.jpg', { eager: true })),
  ...pick(import.meta.glob('../assets/catalogo/*.jpg', { eager: true })),
};
export const badgeImages = pick(import.meta.glob('../assets/badges/*.png', { eager: true }));
