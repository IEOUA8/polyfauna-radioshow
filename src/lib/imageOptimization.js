const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export const IMAGE_UPLOAD_PRESETS = Object.freeze({
  default: Object.freeze({ maxWidth: 1920, maxHeight: 1920, quality: 0.82, passthroughBytes: 450 * 1024 }),
  square: Object.freeze({ maxWidth: 1200, maxHeight: 1200, quality: 0.82, passthroughBytes: 350 * 1024 }),
  avatar: Object.freeze({ maxWidth: 640, maxHeight: 640, quality: 0.80, passthroughBytes: 180 * 1024 }),
  eventBanner: Object.freeze({ maxWidth: 1920, maxHeight: 1080, quality: 0.82, passthroughBytes: 500 * 1024 }),
  eventMobile: Object.freeze({ maxWidth: 1080, maxHeight: 1600, quality: 0.82, passthroughBytes: 450 * 1024 }),
  eventTicket: Object.freeze({ maxWidth: 1200, maxHeight: 1600, quality: 0.82, passthroughBytes: 450 * 1024 }),
});

export function getImageUploadPreset(preset = 'default') {
  if (typeof preset === 'object' && preset) {
    return { ...IMAGE_UPLOAD_PRESETS.default, ...preset };
  }
  return IMAGE_UPLOAD_PRESETS[preset] || IMAGE_UPLOAD_PRESETS.default;
}

export function calculateContainedDimensions(width, height, maxWidth, maxHeight) {
  if (![width, height, maxWidth, maxHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Dimensiones de imagen inválidas');
  }
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function webpFilename(filename = 'imagen') {
  const base = String(filename).replace(/\.[^.]+$/, '').trim() || 'imagen';
  return `${base}.webp`;
}

export function formatUploadSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close?.(),
    };
  }

  if (typeof document === 'undefined') {
    throw new Error('Este navegador no permite procesar imágenes antes de subirlas');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('No fue posible leer la imagen seleccionada'));
      element.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function encodeWebp(source, width, height, quality) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('No fue posible preparar la imagen');
    context.drawImage(source, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/webp', quality });
  }

  if (typeof document === 'undefined') {
    throw new Error('Este navegador no permite convertir imágenes a WebP');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('No fue posible preparar la imagen');
  context.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Este navegador no pudo convertir la imagen a WebP')),
      'image/webp',
      quality,
    );
  });
}

export async function optimizeImageForUpload(file, preset = 'default') {
  if (!file || !SUPPORTED_IMAGE_TYPES.has(String(file.type).toLowerCase())) {
    throw new Error('Usa una imagen JPG, PNG o WebP');
  }

  const options = getImageUploadPreset(preset);
  const decoded = await decodeImage(file);
  try {
    const dimensions = calculateContainedDimensions(
      decoded.width,
      decoded.height,
      options.maxWidth,
      options.maxHeight,
    );
    const alreadyEfficientWebp = file.type === 'image/webp'
      && dimensions.width === decoded.width
      && dimensions.height === decoded.height
      && file.size <= options.passthroughBytes;

    if (alreadyEfficientWebp) return file;

    const blob = await encodeWebp(decoded.source, dimensions.width, dimensions.height, options.quality);
    if (!blob || blob.type !== 'image/webp') {
      throw new Error('La conversión a WebP no está disponible en este navegador');
    }

    return new File([blob], webpFilename(file.name), {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    decoded.dispose();
  }
}
