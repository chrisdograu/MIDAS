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
  // HEIC/HEIF: browser pode decodificar via createImageBitmap em alguns casos;
  // se não decodificar, cai no catch e o caller decide (aviso).
  'image/heic': 'image/jpeg',
  'image/heif': 'image/jpeg',
};

const MAX_DIMENSION = 6000; // 6000x6000 = 36MP, limite razoável pra web
const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;

export async function stripImageExif(file: File): Promise<File> {
  if (typeof document === 'undefined') return file;
  const mime = MIME_MAP[file.type];
  if (!mime) return file; // GIF/SVG/HEIC — não mexemos
  try {
    const bmp = await createImageBitmap(file);
    // Rejeita imagens gigantes (DoS local + memória)
    if (bmp.width * bmp.height > MAX_PIXELS) {
      console.warn('[stripImageExif] imagem muito grande:', bmp.width, 'x', bmp.height);
      bmp.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bmp.close?.(); return file; }
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, mime, 0.92)
    );
    if (!blob) {
      console.warn('[stripImageExif] toBlob retornou null — mantendo arquivo original');
      return file;
    }
    const name = file.name.replace(/\.[^.]+$/, '.jpg');
    return new File([blob], name, { type: mime, lastModified: Date.now() });
  } catch (e) {
    // Falha aberta: comentário no topo do arquivo explica o trade-off.
    // O caller (upload) decide se mostra aviso ao usuário.
    console.warn('[stripImageExif] falhou — arquivo original mantido:', e);
    return file;
  }
}
