import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, TabStopType, TabStopPosition,
} from 'docx';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Decode base64 font data from pdfmake's vfs into Uint8Array for DOCX embedding.
// vfs_fonts is already loaded by buildPdf.js — Vite deduplicates the module (no extra cost).
function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

export function buildDocx(resume, fontScale = 1, format = {}) {
  const margins = format.margins ?? 40;
  const lineSpacing = format.lineSpacing ?? 1.3;
  const pageMarginTwips = Math.round(margins * 15);

  const sz = (n) => Math.round(n * fontScale);

  // Exact line height in twips to match CSS line-height: lineSpacing on a given pt font.
  // Formula: pt * fontScale * (96/72 px/pt) * (15 twips/px) * lineSpacing = pt * fontScale * 20 * lineSpacing
  const ln = (pt) => Math.round(pt * fontScale * 20 * lineSpacing);

  const F = 'Roboto';

  function docxHeading(text) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: sz(22), allCaps: true, font: F })],
      spacing: { before: sz(160), after: sz(60), line: ln(11), lineRule: 'exact' },
      border: { bottom: { color: '333333', size: 6, style: BorderStyle.SINGLE, space: 2 } },
    });
  }

  function docxEntryHeader(main, right) {
    return new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: main, bold: true, size: sz(20), font: F }),
        new TextRun({ text: `\t${right || ''}`, size: sz(20), font: F }),
      ],
      spacing: { before: sz(80), after: 0, line: ln(10), lineRule: 'exact' },
    });
  }

  function docxItalicSub(text) {
    return new Paragraph({
      children: [new TextRun({ text, italics: true, size: sz(18), color: '555555', font: F })],
      spacing: { after: sz(40), line: ln(9), lineRule: 'exact' },
    });
  }

  const contactFieldOrder = resume.contactFieldOrder || ['name', 'email', 'phone', 'linkedin', 'github', 'location'];
  const contactParts = [
    ...contactFieldOrder.filter((k) => k !== 'name').map((k) => resume.contact[k]),
    ...((resume.contactExtra || []).filter((f) => f.value).map((f) => f.value)),
  ].filter(Boolean);

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: resume.contact.name || 'Your Name', bold: true, size: sz(32), font: F })],
      spacing: { after: sz(40), line: ln(16), lineRule: 'exact' },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: contactParts.join('  |  '), size: sz(18), color: '444444', font: F })],
      spacing: { after: sz(80), line: ln(9), lineRule: 'exact' },
    }),
  ];

  const sectionOrder = resume.sectionOrder || ['contact', 'summary', 'education', 'experience', 'skills', 'projects', 'certifications', 'honors_awards'];

  for (const key of sectionOrder) {
    if (key === 'contact') continue;

    if (key === 'summary' && resume.summary) {
      children.push(docxHeading('Summary'));
      children.push(new Paragraph({ children: [new TextRun({ text: resume.summary, size: sz(20), font: F })], spacing: { after: sz(60), line: ln(10), lineRule: 'exact' } }));
      continue;
    }

    if (key === 'education' && (resume.education || []).length > 0) {
      children.push(docxHeading('Education'));
      resume.education.forEach((edu) => {
        const dates = [edu.start, edu.end].filter(Boolean).join(' – ');
        const degreeField = [edu.degree, edu.field].filter(Boolean).join(' in ');
        children.push(docxEntryHeader(edu.institution, ''));
        if (degreeField || dates) {
          children.push(new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: degreeField, italics: true, size: sz(18), color: '555555', font: F }),
              new TextRun({ text: `\t${dates}`, italics: true, size: sz(18), color: '555555', font: F }),
            ],
            spacing: { after: sz(20), line: ln(9), lineRule: 'exact' },
          }));
        }
        if (edu.gpa) children.push(docxItalicSub(`GPA: ${edu.gpa}`));
      });
      continue;
    }

    if (key === 'experience' && (resume.experience || []).length > 0) {
      children.push(docxHeading('Experience'));
      resume.experience.forEach((exp) => {
        const rightPart = [
          exp.location,
          [exp.start, exp.end].filter(Boolean).join(' – '),
        ].filter(Boolean).join(' | ');
        children.push(docxEntryHeader(exp.company, rightPart));
        if (exp.title) children.push(docxItalicSub(exp.title));
        (exp.bullets || []).filter(Boolean).forEach((b) => {
          children.push(new Paragraph({ indent: { left: sz(160) }, children: [new TextRun({ text: `– ${b}`, size: sz(20), font: F })], spacing: { after: sz(20), line: ln(10), lineRule: 'exact' } }));
        });
      });
      continue;
    }

    if (key === 'projects' && (resume.projects || []).length > 0) {
      children.push(docxHeading('Projects'));
      resume.projects.forEach((proj) => {
        const dates = [proj.start, proj.end].filter(Boolean).join(' – ');
        children.push(docxEntryHeader(proj.name, dates));
        if (proj.tech) children.push(docxItalicSub(proj.tech));
        (proj.bullets || []).filter(Boolean).forEach((b) => {
          children.push(new Paragraph({ indent: { left: sz(160) }, children: [new TextRun({ text: `– ${b}`, size: sz(20), font: F })], spacing: { after: sz(20), line: ln(10), lineRule: 'exact' } }));
        });
      });
      continue;
    }

    if (key === 'skills' && (resume.skills || []).length > 0) {
      children.push(docxHeading('Technical Skills'));
      resume.skills.forEach((sk) => {
        const runs = sk.category
          ? [new TextRun({ text: `${sk.category}: `, bold: true, size: sz(20), font: F }), new TextRun({ text: sk.items, size: sz(20), font: F })]
          : [new TextRun({ text: sk.items, size: sz(20), font: F })];
        children.push(new Paragraph({ children: runs, spacing: { after: sz(30), line: ln(10), lineRule: 'exact' } }));
      });
      continue;
    }

    if (key === 'certifications' && (resume.certifications || []).length > 0) {
      children.push(docxHeading('Certifications'));
      resume.certifications.forEach((cert) => {
        children.push(docxEntryHeader(cert.name, cert.date));
        if (cert.issuer) children.push(docxItalicSub(cert.issuer));
      });
      continue;
    }

    if (key === 'honors_awards' && (resume.honors_awards || []).length > 0) {
      children.push(docxHeading('Honors & Awards'));
      const honorRuns = [];
      resume.honors_awards.forEach((award, i) => {
        if (i > 0) honorRuns.push(new TextRun({ text: ' • ', size: sz(20), font: F }));
        honorRuns.push(new TextRun({ text: award.title, size: sz(20), font: F }));
        if (award.issuer) honorRuns.push(new TextRun({ text: `, ${award.issuer}`, size: sz(20), font: F }));
        if (award.date) honorRuns.push(new TextRun({ text: ` (${award.date})`, size: sz(20), font: F }));
      });
      children.push(new Paragraph({ children: honorRuns, spacing: { after: sz(60), line: ln(10), lineRule: 'exact' } }));
      continue;
    }

    // Custom section
    const cs = (resume.customSections || []).find((c) => c.id === key);
    if (cs && (cs.title || cs.description)) {
      if (cs.title) children.push(docxHeading(cs.title));
      if (cs.description) {
        children.push(new Paragraph({ children: [new TextRun({ text: cs.description, size: sz(20), font: F })], spacing: { after: sz(60), line: ln(10), lineRule: 'exact' } }));
      }
    }
  }

  const sectionProps = {
    page: {
      size: { width: 12240, height: 15840 }, // Letter: 8.5" x 11" in twips
      margin: { top: pageMarginTwips, bottom: pageMarginTwips, left: pageMarginTwips, right: pageMarginTwips },
    },
  };

  const robotoData = base64ToUint8Array(pdfFonts['Roboto-Regular.ttf']);

  return new Document({
    fonts: [{ name: 'Roboto', data: robotoData }],
    sections: [{ properties: sectionProps, children }],
  });
}

export { Packer };
