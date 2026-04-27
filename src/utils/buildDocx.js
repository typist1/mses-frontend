import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, TabStopType, TabStopPosition,
} from 'docx';

function docxHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, allCaps: true })],
    spacing: { before: 160, after: 60 },
    border: { bottom: { color: '333333', size: 6, style: BorderStyle.SINGLE, space: 2 } },
  });
}

function docxEntryHeader(main, date) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: main, bold: true, size: 20 }),
      new TextRun({ text: `\t${date || ''}`, size: 20 }),
    ],
    spacing: { before: 80 },
  });
}

export function buildDocx(resume) {
  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.contact.github,
    ...((resume.contactExtra || []).filter((f) => f.value).map((f) => f.value)),
  ].filter(Boolean);

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: resume.contact.name || 'Your Name', bold: true, size: 32 })],
      spacing: { after: 40 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: contactParts.join('  |  '), size: 18, color: '444444' })],
      spacing: { after: 80 },
    }),
  ];

  if (resume.summary) {
    children.push(docxHeading('Summary'));
    children.push(new Paragraph({ children: [new TextRun({ text: resume.summary, size: 20 })], spacing: { after: 60 } }));
  }

  if (resume.experience.length > 0) {
    children.push(docxHeading('Work Experience'));
    resume.experience.forEach((exp) => {
      const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' – ');
      const mainLabel = [exp.role, exp.company].filter(Boolean).join(' — ');
      children.push(docxEntryHeader(mainLabel, dates));
      if (exp.location) {
        children.push(new Paragraph({ children: [new TextRun({ text: exp.location, italics: true, size: 18, color: '555555' })], spacing: { after: 40 } }));
      }
      exp.bullets.filter(Boolean).forEach((b) => {
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b, size: 20 })], spacing: { after: 20 } }));
      });
    });
  }

  if (resume.education.length > 0) {
    children.push(docxHeading('Education'));
    resume.education.forEach((edu) => {
      const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
      children.push(docxEntryHeader(edu.school, dates));
      const sub = [edu.degree, edu.field].filter(Boolean).join(', ') + (edu.gpa ? `  •  GPA: ${edu.gpa}` : '');
      if (sub) {
        children.push(new Paragraph({ children: [new TextRun({ text: sub, italics: true, size: 18, color: '555555' })], spacing: { after: 40 } }));
      }
    });
  }

  if (resume.skills.length > 0) {
    children.push(docxHeading('Skills'));
    resume.skills.forEach((sk) => {
      const runs = sk.category
        ? [new TextRun({ text: `${sk.category}: `, bold: true, size: 20 }), new TextRun({ text: sk.items, size: 20 })]
        : [new TextRun({ text: sk.items, size: 20 })];
      children.push(new Paragraph({ children: runs, spacing: { after: 30 } }));
    });
  }

  if (resume.projects.length > 0) {
    children.push(docxHeading('Projects'));
    resume.projects.forEach((proj) => {
      const dates = [proj.startDate, proj.endDate].filter(Boolean).join(' – ');
      children.push(docxEntryHeader(proj.name, dates));
      if (proj.tech) {
        children.push(new Paragraph({ children: [new TextRun({ text: proj.tech, italics: true, size: 18, color: '555555' })], spacing: { after: 40 } }));
      }
      proj.bullets.filter(Boolean).forEach((b) => {
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b, size: 20 })], spacing: { after: 20 } }));
      });
    });
  }

  if (resume.certifications.length > 0) {
    children.push(docxHeading('Certifications'));
    resume.certifications.forEach((cert) => {
      children.push(docxEntryHeader(cert.name, cert.date));
      if (cert.issuer) {
        children.push(new Paragraph({ children: [new TextRun({ text: cert.issuer, italics: true, size: 18, color: '555555' })], spacing: { after: 40 } }));
      }
    });
  }

  if (resume.honorsAwards.length > 0) {
    children.push(docxHeading('Honors & Awards'));
    resume.honorsAwards.forEach((award) => {
      children.push(docxEntryHeader(award.title, award.date));
      const sub = [award.issuer, award.description].filter(Boolean).join('  —  ');
      if (sub) {
        children.push(new Paragraph({ children: [new TextRun({ text: sub, italics: true, size: 18, color: '555555' })], spacing: { after: 40 } }));
      }
    });
  }

  return new Document({ sections: [{ children }] });
}

export { Packer };
