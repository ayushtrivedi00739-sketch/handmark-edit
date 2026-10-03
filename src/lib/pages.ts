// Client-side upload handling: validation, PDF → page images, rotation.
import type { PageImage } from "./types";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.pdf";
export const MAX_FILE_MB = 20;
const MAX_PDF_PAGES = 30;
const MAX_EDGE = 2000;

export function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `${file.name}: unsupported file type. Use JPG, PNG or PDF.`;
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `${file.name}: file is larger than ${MAX_FILE_MB} MB.`;
  return null;
}

function newPage(name: string, dataUrl: string): PageImage {
  return { id: crypto.randomUUID(), name, original: dataUrl, dataUrl, rotation: 0 };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image."));
    img.src = src;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function imageFileToDataUrl(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvasToJpeg(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pdfToDataUrls(file: File) {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const urls: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, MAX_PDF_PAGES); i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, MAX_EDGE / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    urls.push(canvasToJpeg(canvas));
  }
  return urls;
}

/** Converts uploaded files to page images. Invalid files are reported in `errors`, not thrown. */
export async function filesToPages(files: File[]) {
  const pages: PageImage[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const problem = validateFile(file);
    if (problem) {
      errors.push(problem);
      continue;
    }
    try {
      if (file.type === "application/pdf") {
        const urls = await pdfToDataUrls(file);
        urls.forEach((u, i) => pages.push(newPage(`${file.name} · p${i + 1}`, u)));
      } else {
        pages.push(newPage(file.name, await imageFileToDataUrl(file)));
      }
    } catch {
      errors.push(`${file.name}: could not be opened. The file may be damaged.`);
    }
  }
  return { pages, errors };
}

/** Returns a new page with rotation applied from the untouched original. */
export async function rotatePage(page: PageImage): Promise<PageImage> {
  const rotation = ((page.rotation + 90) % 360) as PageImage["rotation"];
  const img = await loadImage(page.original);
  const canvas = document.createElement("canvas");
  const swap = rotation % 180 !== 0;
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return { ...page, rotation, dataUrl: canvasToJpeg(canvas) };
}
