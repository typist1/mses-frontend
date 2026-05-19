import { buildDocx, Packer } from '@/utils/buildDocx';
import { getPdfBlob } from '@/utils/buildPdf';

// Count pages in a pdfmake-generated PDF by scanning for /Type /Page objects
async function countPdfPages(blob) {
  const ab = await blob.arrayBuffer();
  const text = new TextDecoder('latin1').decode(ab);
  // /Type /Pages is the root page tree; /Type /Page (no 's') is each leaf page
  return (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

export async function exportPdf(resume, { sectionOrder, scale = 1, filename, format, bulletStyle, fitToOnePage = false }) {
  const resumeData = sectionOrder ? { ...resume, sectionOrder } : resume;
  const baseOptions = {
    margins: format?.margins ?? 36,
    lineSpacing: format?.lineSpacing ?? 1.2,
    bulletStyle: bulletStyle ?? 'dash',
    sectionOrder,
  };

  let blob;

  if (fitToOnePage) {
    // Binary search for the largest fontScale that fits content on exactly 1 page.
    // pdfmake layout differs from CSS layout, so we can't trust fitFontScale from the editor.
    let lo = 0.4, hi = 1.0, bestBlob = null;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      const b = await getPdfBlob(resumeData, { ...baseOptions, fontScale: mid });
      if (await countPdfPages(b) <= 1) {
        bestBlob = b;
        lo = mid; // fits — try larger scale
      } else {
        hi = mid; // overflows — try smaller scale
      }
    }
    blob = bestBlob ?? await getPdfBlob(resumeData, { ...baseOptions, fontScale: 0.4 });
  } else {
    blob = await getPdfBlob(resumeData, { ...baseOptions, fontScale: scale });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportDocx(resume, { sectionOrder, scale = 1, filename, format }) {
  const resumeData = sectionOrder ? { ...resume, sectionOrder } : resume;
  const doc = buildDocx(resumeData, scale, format);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
