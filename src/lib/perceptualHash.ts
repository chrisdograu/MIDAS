// Item 120 — average hash (aHash) de 64 bits em poucas linhas com canvas.
// Redimensiona pra 8x8, converte pra cinza, compara cada pixel com a média.
// Resultado: string de 64 caracteres '0'/'1'. A comparação (distância de
// Hamming) roda no banco, em hash_distance(), no momento de publicar o anúncio.

export async function averageHash(file: File): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, 8, 8);
    bmp.close?.();
    const { data } = ctx.getImageData(0, 0, 8, 8);
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
    return gray.map((g) => (g >= avg ? '1' : '0')).join('');
  } catch {
    return null;
  }
}
