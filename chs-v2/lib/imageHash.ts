// A small "fingerprint" of a photo (a 64-bit difference hash) computed in the browser. Two photos that look the
// same, even after resizing or recompression, have fingerprints that differ in only a few bits. CHS stores the
// fingerprint, not the photo, so a reviewer can be warned when the same photo appears in listings by different owners.

export async function photoFingerprint(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image"));
        el.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 9; canvas.height = 8;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, 9, 8);
      const { data } = ctx.getImageData(0, 0, 9, 8);
      const gray: number[] = [];
      for (let i = 0; i < data.length; i += 4) gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      let bits = "";
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gray[y * 9 + x] > gray[y * 9 + x + 1] ? "1" : "0";
      const ones = bits.split("1").length - 1;
      if (ones < 6 || ones > 58) return null; // a flat or blank image says nothing about the photo
      let hex = "";
      for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
      return hex;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}
