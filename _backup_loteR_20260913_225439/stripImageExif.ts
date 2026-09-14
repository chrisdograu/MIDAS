// Client-side EXIF/GPS strip. Re-encodes the image through canvas — the canvas
// pipeline drops all metadata (EXIF, GPS, orientation tags, IPTC/XMP). Não é
// necessário para imagens que já são PNG/WebP sem EXIF, mas custa quase nada
// aplicar de forma uniforme. Aplicado em uploads de anúncio, biblioteca, chat,
// perfil — a mesma imagem nunca vaza coordenadas do celular do usuário.
//
// Falha aberta: se o navegador não suportar (SSR, decode error), devolvemos o
// File original para não bloquear o upload. É trade-off consciente: privacidade
// é opt-in de infra, não trava de UX.

const MIME_MAP: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

export async function stripImageExif(file: File): Promise<File> {
  if (typeof document === 'undefined') return file;
  const mime = MIME_MAP[file.type];
  if (!mime) return file; // GIF/SVG/HEIC — não mexemos
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, mime, 0.92)
    );
    if (!blob) return file;
    const name = file.name.replace(/\.(jpe?g|png|webp)$/i, (ext) => ext);
    return new File([blob], name, { type: mime, lastModified: Date.now() });
  } catch {
    return file;
  }
}
