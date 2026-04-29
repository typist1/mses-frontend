import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, TabStopType, TabStopPosition,
} from 'docx';

export function buildDocx(resume, fontScale = 1) {
  const sz = (n) => Math.round(n * fontScale);
  const sp = (n) => Math.round(n * fontScale);

  function docxHeading(text) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: sz(22), allCaps: true })],
      spacing: { before: sp(160), after: sp(60), line: 240, lineRule: 'auto' },
      border: { bottom: { color: '333333', size: 6, style: BorderStyle.SINGLE, space: 2 } },
    });
  }

  function docxEntryHeader(main, right) {
    return new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: main, bold: true, size: sz(20) }),
        new TextRun({ text: `\t${right || ''}`, size: sz(20) }),
      ],
      spacing: { before: sp(80), after: 0, line: 240, lineRule: 'auto' },
    });
  }

  function docxItalicSub(text) {
    return new Paragraph({
      children: [new TextRun({ text, italics: true, size: sz(18), color: '555555' })],
      spacing: { after: sp(40), line: 240, lineRule: 'auto' },
    });
  }

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
      children: [new TextRun({ text: resume.contact.name || 'Your Name', bold: true, size: sz(32) })],
      spacing: { after: sp(40), line: 240, lineRule: 'auto' },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: contactParts.join('  |  '), size: sz(18), color: '444444' })],
      spacing: { after: sp(80), line: 240, lineRule: 'auto' },
    }),
  ];

  const sectionOrder = resume.sectionOrder || ['contact', 'summary', 'education', 'experience', 'skills', 'projects', 'certifications', 'honorsAwards'];

  for (const key of sectionOrder) {
    if (key === 'contact') continue; // already rendered as header

    if (key === 'summary' && resume.summary) {
      children.push(docxHeading('Summary'));
      children.push(new Paragraph({ children: [new TextRun({ text: resume.summary, size: sz(20) })], spacing: { after: sp(60), line: 240, lineRule: 'auto' } }));
      continue;
    }

    if (key === 'education' && resume.education.length > 0) {
      children.push(docxHeading('Education'));
      resume.education.forEach((edu) => {
        const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
        const degreeField = [edu.degree, edu.field].filter(Boolean).join(' in ');
        children.push(docxEntryHeader(edu.school, ''));
        if (degreeField || dates) {
          children.push(new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: degreeField, italics: true, size: sz(18), color: '555555' }),
              new TextRun({ text: `\t${dates}`, italics: true, size: sz(18), color: '555555' }),
            ],
            spacing: { after: sp(20), line: 240, lineRule: 'auto' },
          }));
        }
        if (edu.gpa) children.push(docxItalicSub(`GPA: ${edu.gpa}`));
      });
      continue;
    }

    if (key === 'experience' && resume.experience.length > 0) {
      children.push(docxHeading('Experience'));
      resume.experience.forEach((exp) => {
        const rightPart = [
          exp.location,
          [exp.startDate, exp.endDate].filter(Boolean).join(' – '),
        ].filter(Boolean).join(' | ');
        children.push(docxEntryHeader(exp.company, rightPart));
        if (exp.role) children.push(docxItalicSub(exp.role));
        exp.bullets.filter(Boolean).forEach((b) => {
          children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b, size: sz(20) })], spacing: { after: sp(20), line: 240, lineRule: 'auto' } }));
        });
      });
      continue;
    }

    if (key === 'projects' && resume.projects.length > 0) {
      children.push(docxHeading('Projects'));
      resume.projects.forEach((proj) => {
        const dates = [proj.startDate, proj.endDate].filter(Boolean).join(' – ');
        children.push(docxEntryHeader(proj.name, dates));
        if (proj.tech) children.push(docxItalicSub(proj.tech));
        proj.bullets.filter(Boolean).forEach((b) => {
          children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: b, size: sz(20) })], spacing: { after: sp(20), line: 240, lineRule: 'auto' } }));
        });
      });
      continue;
    }

    if (key === 'skills' && resume.skills.length > 0) {
      children.push(docxHeading('Technical Skills'));
      resume.skills.forEach((sk) => {
        const runs = sk.category
          ? [new TextRun({ text: `${sk.category}: `, bold: true, size: sz(20) }), new TextRun({ text: sk.items, size: sz(20) })]
          : [new TextRun({ text: sk.items, size: sz(20) })];
        children.push(new Paragraph({ children: runs, spacing: { after: sp(30), line: 240, lineRule: 'auto' } }));
      });
      continue;
    }

    if (key === 'certifications' && resume.certifications.length > 0) {
      children.push(docxHeading('Certifications'));
      resume.certifications.forEach((cert) => {
        children.push(docxEntryHeader(cert.name, cert.date));
        if (cert.issuer) children.push(docxItalicSub(cert.issuer));
      });
      continue;
    }

    if (key === 'honorsAwards' && resume.honorsAwards.length > 0) {
      children.push(docxHeading('Honors & Awards'));
      const honorRuns = [];
      resume.honorsAwards.forEach((award, i) => {
        if (i > 0) honorRuns.push(new TextRun({ text: ' • ', size: sz(20) }));
        honorRuns.push(new TextRun({ text: award.title, size: sz(20) }));
        if (award.issuer) honorRuns.push(new TextRun({ text: `, ${award.issuer}`, size: sz(20) }));
        if (award.date) honorRuns.push(new TextRun({ text: ` (${award.date})`, size: sz(20) }));
      });
      children.push(new Paragraph({ children: honorRuns, spacing: { after: sp(60), line: 240, lineRule: 'auto' } }));
      continue;
    }

    // Custom section
    const cs = (resume.customSections || []).find((c) => c.id === key);
    if (cs && (cs.title || cs.description)) {
      if (cs.title) children.push(docxHeading(cs.title));
      if (cs.description) {
        children.push(new Paragraph({ children: [new TextRun({ text: cs.description, size: sz(20) })], spacing: { after: sp(60), line: 240, lineRule: 'auto' } }));
      }
    }
  }

  const sectionProps = {
    page: {
      margin: { top: sp(720), bottom: sp(720), left: sp(720), right: sp(720) },
    },
  };

  return new Document({ sections: [{ properties: sectionProps, children }] });
}

export { Packer };
