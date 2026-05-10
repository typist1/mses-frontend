import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts;

const PAGE_MARGIN = 36; // pt (0.5 inch)
const CONTENT_WIDTH = 612 - 2 * PAGE_MARGIN; // 540pt

export function getPdfBlob(resume, fontScale = 1) {
  const sz = (n) => Math.round(n * fontScale * 10) / 10;
  const sp = (n) => Math.round(n * fontScale * 10) / 10;
  const GRAY = '#555555';

  const content = [];

  content.push({
    text: resume.contact.name || 'Your Name',
    bold: true,
    fontSize: sz(16),
    alignment: 'center',
    margin: [0, 0, 0, sp(2)],
  });

  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.contact.github,
    ...((resume.contactExtra || []).filter((f) => f.value).map((f) => f.value)),
  ].filter(Boolean);

  if (contactParts.length > 0) {
    content.push({
      text: contactParts.join('  |  '),
      fontSize: sz(9),
      alignment: 'center',
      color: '#444444',
      margin: [0, 0, 0, sp(4)],
    });
  }

  function addHeading(text) {
    content.push({
      stack: [
        { text: text.toUpperCase(), bold: true, fontSize: sz(11), margin: [0, sp(8), 0, sp(1)] },
        {
          canvas: [{
            type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0,
            lineWidth: 0.5, lineColor: '#333333',
          }],
          margin: [0, 0, 0, sp(3)],
        },
      ],
    });
  }

  function entryHeader(main, right) {
    if (!right) {
      return { text: main, bold: true, fontSize: sz(10), margin: [0, sp(4), 0, 0] };
    }
    return {
      columns: [
        { text: main, bold: true, fontSize: sz(10), width: '*' },
        { text: right, fontSize: sz(10), alignment: 'right', width: 'auto' },
      ],
      margin: [0, sp(4), 0, 0],
    };
  }

  function italicSub(text) {
    return { text, italics: true, fontSize: sz(9), color: GRAY, margin: [0, 0, 0, sp(1)] };
  }

  function bulletList(bullets) {
    return bullets.filter(Boolean).map((b) => ({
      text: `\u2013 ${b}`,
      fontSize: sz(10),
      margin: [8, 0, 0, sp(1)],
    }));
  }

  const sectionOrder = resume.sectionOrder || [
    'contact', 'summary', 'education', 'experience', 'skills', 'projects', 'certifications', 'honorsAwards',
  ];

  for (const key of sectionOrder) {
    if (key === 'contact') continue;

    if (key === 'summary' && resume.summary) {
      addHeading('Summary');
      content.push({ text: resume.summary, fontSize: sz(10), margin: [0, 0, 0, sp(3)] });
      continue;
    }

    if (key === 'education' && resume.education.length > 0) {
      addHeading('Education');
      resume.education.forEach((edu) => {
        const dates = [edu.startDate, edu.endDate].filter(Boolean).join(' \u2013 ');
        const degreeField = [edu.degree, edu.field].filter(Boolean).join(' in ');
        content.push(entryHeader(edu.school, ''));
        if (degreeField || dates) {
          content.push({
            columns: [
              { text: degreeField, italics: true, fontSize: sz(9), color: GRAY, width: '*' },
              { text: dates, italics: true, fontSize: sz(9), color: GRAY, alignment: 'right', width: 'auto' },
            ],
            margin: [0, 0, 0, sp(1)],
          });
        }
        if (edu.gpa) content.push(italicSub(`GPA: ${edu.gpa}`));
      });
      continue;
    }

    if (key === 'experience' && resume.experience.length > 0) {
      addHeading('Experience');
      resume.experience.forEach((exp) => {
        const rightPart = [
          exp.location,
          [exp.startDate, exp.endDate].filter(Boolean).join(' \u2013 '),
        ].filter(Boolean).join(' | ');
        content.push(entryHeader(exp.company, rightPart));
        if (exp.role) content.push(italicSub(exp.role));
        content.push(...bulletList(exp.bullets));
      });
      continue;
    }

    if (key === 'projects' && resume.projects.length > 0) {
      addHeading('Projects');
      resume.projects.forEach((proj) => {
        const dates = [proj.startDate, proj.endDate].filter(Boolean).join(' \u2013 ');
        content.push(entryHeader(proj.name, dates));
        if (proj.tech) content.push(italicSub(proj.tech));
        content.push(...bulletList(proj.bullets));
      });
      continue;
    }

    if (key === 'skills' && resume.skills.length > 0) {
      addHeading('Technical Skills');
      resume.skills.forEach((sk) => {
        const runs = sk.category
          ? [{ text: `${sk.category}: `, bold: true, fontSize: sz(10) }, { text: sk.items, fontSize: sz(10) }]
          : [{ text: sk.items, fontSize: sz(10) }];
        content.push({ text: runs, margin: [0, 0, 0, sp(1.5)] });
      });
      continue;
    }

    if (key === 'certifications' && resume.certifications.length > 0) {
      addHeading('Certifications');
      resume.certifications.forEach((cert) => {
        content.push(entryHeader(cert.name, cert.date));
        if (cert.issuer) content.push(italicSub(cert.issuer));
      });
      continue;
    }

    if (key === 'honorsAwards' && resume.honorsAwards.length > 0) {
      addHeading('Honors & Awards');
      const runs = [];
      resume.honorsAwards.forEach((award, i) => {
        if (i > 0) runs.push({ text: ' \u2022 ', fontSize: sz(10) });
        runs.push({ text: award.title, fontSize: sz(10) });
        if (award.issuer) runs.push({ text: `, ${award.issuer}`, fontSize: sz(10) });
        if (award.date) runs.push({ text: ` (${award.date})`, fontSize: sz(10) });
      });
      content.push({ text: runs, margin: [0, 0, 0, sp(3)] });
      continue;
    }

    const cs = (resume.customSections || []).find((c) => c.id === key);
    if (cs && (cs.title || cs.description)) {
      if (cs.title) addHeading(cs.title);
      if (cs.description) content.push({ text: cs.description, fontSize: sz(10), margin: [0, 0, 0, sp(3)] });
    }
  }

  const docDef = {
    pageSize: 'LETTER',
    pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN],
    defaultStyle: { fontSize: sz(10), lineHeight: 1.2 },
    content,
  };

  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).getBlob(
        (blob) => resolve(blob),
        (err) => reject(err ?? new Error('PDF generation failed')),
      );
    } catch (err) {
      reject(err);
    }
  });
}
