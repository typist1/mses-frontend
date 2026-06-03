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

// Renders resume content into a hidden off-screen div and measures its height.
// Returns the fontScale needed to fit content in one Letter page (8.5" × 11" at 96dpi).
// Uses the same font sizes and spacing as buildDocx so the measurement is a reliable proxy.
const PAPER_WIDTH_PX = 816;
const PAPER_HEIGHT_PX = 1056;
const DEFAULT_SECTIONS = ['contact', 'summary', 'education', 'experience', 'skills', 'projects', 'certifications', 'honors_awards'];

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildMeasureHTML(resume) {
  const sectionOrder = resume.sectionOrder || DEFAULT_SECTIONS;
  const contactFieldOrder = resume.contactFieldOrder || ['name', 'email', 'phone', 'linkedin', 'github', 'location'];
  const contactParts = [
    ...contactFieldOrder.filter((k) => k !== 'name').map((k) => resume.contact?.[k]),
    ...((resume.contactExtra || []).filter((f) => f.value).map((f) => f.value)),
  ].filter(Boolean);

  const S = {
    name:    'font-size:16px;font-weight:bold;text-align:center;margin-bottom:2px',
    contact: 'font-size:9px;text-align:center;color:#444;margin-bottom:4px',
    heading: 'font-size:11px;font-weight:bold;text-transform:uppercase;border-bottom:0.5px solid #333;padding-bottom:1px;margin-top:8px;margin-bottom:3px',
    entryH:  'font-size:10px;font-weight:bold;margin-top:4px',
    sub:     'font-size:9px;color:#555;font-style:italic;margin-bottom:2px',
    body:    'font-size:10px',
    bullet:  'font-size:10px;margin-left:8px;margin-bottom:1px',
  };

  let html = `<div style="${S.name}">${escHtml(resume.contact?.name || '')}</div>`;
  html += `<div style="${S.contact}">${escHtml(contactParts.join(' | '))}</div>`;

  for (const key of sectionOrder) {
    if (key === 'contact') continue;

    if (key === 'summary' && resume.summary) {
      html += `<div style="${S.heading}">SUMMARY</div><div style="${S.body}">${escHtml(resume.summary)}</div>`;
      continue;
    }

    if (key === 'experience' && resume.experience?.length > 0) {
      html += `<div style="${S.heading}">EXPERIENCE</div>`;
      for (const exp of resume.experience) {
        html += `<div style="${S.entryH}">${escHtml(exp.company)}</div>`;
        if (exp.title) html += `<div style="${S.sub}">${escHtml(exp.title)}</div>`;
        for (const b of (exp.bullets || []).filter(Boolean)) html += `<div style="${S.bullet}">– ${escHtml(b)}</div>`;
      }
      continue;
    }

    if (key === 'education' && resume.education?.length > 0) {
      html += `<div style="${S.heading}">EDUCATION</div>`;
      for (const edu of resume.education) {
        html += `<div style="${S.entryH}">${escHtml(edu.institution)}</div>`;
        const degreeField = [edu.degree, edu.field].filter(Boolean).join(' in ');
        const dates = [edu.start, edu.end].filter(Boolean).join(' – ');
        if (degreeField || dates) html += `<div style="${S.sub}">${escHtml([degreeField, dates].filter(Boolean).join('  '))}</div>`;
        if (edu.gpa) html += `<div style="${S.sub}">GPA: ${escHtml(edu.gpa)}</div>`;
      }
      continue;
    }

    if (key === 'projects' && resume.projects?.length > 0) {
      html += `<div style="${S.heading}">PROJECTS</div>`;
      for (const proj of resume.projects) {
        html += `<div style="${S.entryH}">${escHtml(proj.name)}</div>`;
        if (proj.tech) html += `<div style="${S.sub}">${escHtml(Array.isArray(proj.tech) ? proj.tech.join(', ') : proj.tech)}</div>`;
        for (const b of (proj.bullets || []).filter(Boolean)) html += `<div style="${S.bullet}">– ${escHtml(b)}</div>`;
      }
      continue;
    }

    if (key === 'skills' && resume.skills?.length > 0) {
      html += `<div style="${S.heading}">TECHNICAL SKILLS</div>`;
      for (const sk of resume.skills) {
        html += `<div style="${S.body}">${sk.category ? `<strong>${escHtml(sk.category)}: </strong>` : ''}${escHtml(sk.items)}</div>`;
      }
      continue;
    }

    if (key === 'certifications' && resume.certifications?.length > 0) {
      html += `<div style="${S.heading}">CERTIFICATIONS</div>`;
      for (const cert of resume.certifications) {
        html += `<div style="${S.entryH}">${escHtml(cert.name)}</div>`;
        if (cert.issuer) html += `<div style="${S.sub}">${escHtml(cert.issuer)}</div>`;
      }
      continue;
    }

    if (key === 'honors_awards' && resume.honors_awards?.length > 0) {
      html += `<div style="${S.heading}">HONORS &amp; AWARDS</div>`;
      const parts = resume.honors_awards
        .map((a) => [a.title, a.issuer && `, ${a.issuer}`, a.date && ` (${a.date})`].filter(Boolean).join(''))
        .map(escHtml);
      html += `<div style="${S.body}">${parts.join(' • ')}</div>`;
      continue;
    }

    const cs = (resume.customSections || []).find((c) => c.id === key);
    if (cs && (cs.title || cs.description)) {
      if (cs.title) html += `<div style="${S.heading}">${escHtml(cs.title.toUpperCase())}</div>`;
      if (cs.description) html += `<div style="${S.body}">${escHtml(cs.description)}</div>`;
    }
  }

  return html;
}

function measureDocxFontScale(resume, format) {
  const margins = format?.margins ?? 40;
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:-99999px', 'left:-99999px',
    `width:${PAPER_WIDTH_PX}px`, `padding:${margins}px`,
    'box-sizing:border-box',
    'font-family:Roboto,Arial,sans-serif',
    `line-height:${format?.lineSpacing ?? 1.3}`,
    'font-size:10px',
    'visibility:hidden', 'pointer-events:none',
  ].join(';');
  el.innerHTML = buildMeasureHTML(resume);
  document.body.appendChild(el);
  const h = el.scrollHeight;
  document.body.removeChild(el);
  return Math.max(0.5, Math.min(1.0, PAPER_HEIGHT_PX / h));
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
