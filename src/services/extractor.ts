import fs from 'fs';
import pdfParse from 'pdf-parse';

// Custom pagerender to preserve spatial spacing between columns and fields
function customPagerender(pageData: any): Promise<string> {
  return pageData.getTextContent({ normalizeWhitespace: true }).then(function (textContent: any) {
    let lastY: number | null = null;
    let text = '';
    for (const item of textContent.items) {
      if (lastY === null) {
        text += item.str;
      } else if (Math.abs(lastY - item.transform[5]) < 4) {
        // Same line: add space between text elements
        text += ' ' + item.str;
      } else {
        // New line
        text += '\n' + item.str;
      }
      lastY = item.transform[5];
    }
    return text;
  });
}

export async function extractText(filepath: string, fileType: string): Promise<string> {
  const ext = fileType.toLowerCase().replace(/^\./, '');

  if (ext === 'txt' || ext === 'csv' || ext === 'log') {
    return fs.readFileSync(filepath, 'utf-8');
  }

  // 1. PDF extraction
  if (ext === 'pdf') {
    let pdfText = '';
    try {
      const dataBuffer = fs.readFileSync(filepath);
      const parsed = await pdfParse(dataBuffer, { pagerender: customPagerender });
      if (parsed && parsed.text && parsed.text.trim()) {
        pdfText = parsed.text;
      }
    } catch (err) {
      console.warn('pdf-parse custom pagerender failed, falling back to standard extraction:', err);
    }

    if (!pdfText.trim()) {
      try {
        const dataBuffer = fs.readFileSync(filepath);
        const parsed = await pdfParse(dataBuffer);
        if (parsed && parsed.text && parsed.text.trim()) {
          pdfText = parsed.text;
        }
      } catch (err) {
        console.warn('standard pdf-parse failed:', err);
      }
    }

    if (pdfText && pdfText.trim().length > 30) {
      return pdfText;
    }

    // Fallback: extract printable strings from PDF buffer
    try {
      const raw = fs.readFileSync(filepath, 'utf-8');
      const textMatches = raw.match(/\(([^()]{2,})\)/g);
      if (textMatches && textMatches.length > 5) {
        const joined = textMatches.map((m) => m.slice(1, -1)).join(' ');
        if (joined.length > 30) return joined;
      }
    } catch {
      // ignore
    }

    if (pdfText && pdfText.trim().length > 0) {
      return pdfText;
    }
  }

  // 2. Images (PNG, JPG, JPEG, WEBP, BMP, TIFF, GIF) - Tesseract OCR
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'gif'];
  if (imageExts.includes(ext)) {
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const ret = await worker.recognize(filepath);
      await worker.terminate();
      if (ret?.data?.text && ret.data.text.trim()) {
        console.log(`[OCR] Successfully extracted ${ret.data.text.trim().length} chars from ${filepath}`);
        return ret.data.text.trim();
      }
    } catch (ocrErr: any) {
      console.warn('[OCR] Tesseract error processing image:', ocrErr?.message || ocrErr);
    }
  }

  // 3. Word Documents
  if (ext === 'doc' || ext === 'docx') {
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 20) return text;
    } catch {
      // ignore
    }
  }

  // Generic fallback
  try {
    const raw = fs.readFileSync(filepath, 'utf-8');
    // Only return if printable ASCII/Unicode
    if (/^[ -~\t\n\r]+$/.test(raw.slice(0, 500))) {
      return raw;
    }
    return '';
  } catch {
    return '';
  }
}
