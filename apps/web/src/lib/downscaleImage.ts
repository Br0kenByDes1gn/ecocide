/**
 * Downscales a data-URL image to fit within `maxDim × maxDim` and re-encodes it
 * as JPEG with the given quality. Used to produce the compact ~360px "source
 * snapshot" that both the initial oracle verdict and any re-arbitration send to
 * the vision model (and that the archive persists for re-arbitrations).
 */
export function downscaleDataUrl(
  dataUrl: string,
  maxDim: number = 360,
  quality: number = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Unable to allocate canvas context');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for downscale'));
    img.src = dataUrl;
  });
}