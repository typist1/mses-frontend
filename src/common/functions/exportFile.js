import { buildDocx, Packer } from '@/utils/buildDocx';
import { getPdfBlob } from '@/utils/buildPdf';

// Count pages in a pdfmake-generated PDF by scanning for /Type /Page objects
async function countPdfPages(blob) {
  const ab = await blob.arrayBuffer();
  const text = new TextDecoder('latin1').decode(ab);
  // /Type /Pages is the root page tree; /Type /Page (no 's') is each leaf page
  return (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

export async function getOptimalFontScale(resume, baseOptions) {
  let lo = 0.4, hi = 1.0, best = null;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const b = await getPdfBlob(resume, { ...baseOptions, fontScale: mid });
    if (await countPdfPages(b) <= 1) { best = mid; lo = mid; } else { hi = mid; }
  }
  return best ?? 0.4;
}

export async function getExportPdfBlob(resume, { sectionOrder, scale = 1, format, bulletStyle, fitToOnePage = false }) {
  const resumeData = sectionOrder ? { ...resume, sectionOrder } : resume;
  const baseOptions = {
    margins: format?.margins ?? 36,
    lineSpacing: format?.lineSpacing ?? 1.2,
    bulletStyle: bulletStyle ?? 'dash',
    sectionOrder,
  };

  if (fitToOnePage) {
    const optScale = await getOptimalFontScale(resumeData, baseOptions);
    return getPdfBlob(resumeData, { ...baseOptions, fontScale: optScale });
  }
  return getPdfBlob(resumeData, { ...baseOptions, fontScale: scale });
}

export async function exportPdf(resume, { sectionOrder, scale = 1, filename, format, bulletStyle, fitToOnePage = false }) {
  const blob = await getExportPdfBlob(resume, { sectionOrder, scale, format, bulletStyle, fitToOnePage });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportDocx(resume, { sectionOrder, scale = 1, filename, format, fitToOnePage = false }) {
  const resumeData = sectionOrder ? { ...resume, sectionOrder } : resume;
  let fontScale = scale;
  if (fitToOnePage) {
    fontScale = await getOptimalFontScale(resumeData, {
      margins: format?.margins ?? 36,
      lineSpacing: format?.lineSpacing ?? 1.2,
      sectionOrder,
    });
  }
  const doc = buildDocx(resumeData, fontScale, format);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
