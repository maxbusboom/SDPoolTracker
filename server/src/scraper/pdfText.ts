export interface PdfTextItem {
  x: number;
  y: number;
  text: string;
}

export interface PdfPage {
  width: number;
  height: number;
  items: PdfTextItem[];
}

export interface PdfExtraction {
  pages: PdfPage[];
  fullText: string;
  source: "text-layer" | "ocr";
  warnings: string[];
}

async function extractWithPdf2Json(buffer: Buffer): Promise<PdfPage[]> {
  const { default: PDFParser } = await import("pdf2json");
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataError", (err: Error | { parserError: Error }) =>
      reject("parserError" in err ? err.parserError : err)
    );
    parser.on("pdfParser_dataReady", (data: any) => {
      const pages: PdfPage[] = data.Pages.map((page: any) => ({
        width: page.Width,
        height: page.Height,
        items: page.Texts.map((t: any) => ({
          x: t.x,
          y: t.y,
          text: decodeURIComponent(t.R.map((r: any) => r.T).join("")),
        })),
      }));
      resolve(pages);
    });
    parser.parseBuffer(buffer);
  });
}

function pagesToText(pages: PdfPage[]): string {
  return pages
    .map((page) => {
      const byLine = new Map<number, PdfTextItem[]>();
      for (const item of page.items) {
        const lineKey = Math.round(item.y * 4) / 4;
        if (!byLine.has(lineKey)) byLine.set(lineKey, []);
        byLine.get(lineKey)!.push(item);
      }
      const lines = [...byLine.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, items]) =>
          items
            .sort((a, b) => a.x - b.x)
            .map((i) => i.text)
            .join("")
            .replace(/\s+/g, " ")
            .trim()
        );
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Extracts text (and per-page positioned text items) from a PDF using the
 * embedded text layer. Falls back to rasterizing pages and running OCR when
 * the PDF has no extractable text layer (e.g. a scanned/image-only PDF), so
 * the scraper still produces data if the source ever swaps in a scanned
 * document. Positional data (needed for table parsing) is only available
 * via the text-layer path; the OCR fallback yields plain text only.
 */
export async function extractPdf(buffer: Buffer): Promise<PdfExtraction> {
  const warnings: string[] = [];
  try {
    const pages = await extractWithPdf2Json(buffer);
    const fullText = pagesToText(pages);
    if (fullText.trim().length > 0) {
      return { pages, fullText, source: "text-layer", warnings };
    }
    warnings.push("PDF text layer was empty; falling back to OCR");
  } catch (err) {
    warnings.push(`Text layer extraction failed (${(err as Error).message}); falling back to OCR`);
  }

  const ocrText = await ocrPdf(buffer);
  return { pages: [], fullText: ocrText, source: "ocr", warnings };
}

async function ocrPdf(buffer: Buffer): Promise<string> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: Tesseract } = await import("tesseract.js");

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableFontFace: true }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");
    // @ts-expect-error pdfjs expects a DOM CanvasRenderingContext2D; @napi-rs/canvas is compatible enough for rendering.
    await page.render({ canvasContext: ctx, viewport }).promise;
    const buf = canvas.toBuffer("image/png");
    const {
      data: { text },
    } = await Tesseract.recognize(buf, "eng");
    pageTexts.push(text);
  }
  return pageTexts.join("\n\n");
}
