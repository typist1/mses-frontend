import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.addVirtualFileSystem(pdfFonts);

export function getPdfBlob(resume, { fontScale = 1, margins = 36, lineSpacing = 1.2, bulletStyle = 'dash', sectionOrder: sectionOrderProp } = {}) {
  // margins slider is px (16–48); pdfmake uses pt — 1px ≈ 0.75pt
  const PAGE_MARGIN = Math.round(margins * 0.75);
  const CONTENT_WIDTH = 612 - 2 * PAGE_MARGIN;

  const sz = (n) => Math.round(n * fontScale * 10) / 10;
  const sp = (n) => Math.round(n * fontScale * 10) / 10;
  const GRAY = '#555555';
  const bulletChar = bulletStyle === 'dot' ? '•' : '–';

  const content = [];

  content.push({
    text: resume.contact.name || 'Your Name',
    bold: true,
    fontSize: sz(16),
    alignment: 'center',
    margin: [0, 0, 0, sp(2)],
  });

  const contactFieldOrder = resume.contactFieldOrder || ['name', 'email', 'phone', 'linkedin', 'github', 'location'];
  const contactParts = [
    ...contactFieldOrder.filter((k) => k !== 'name').map((k) => resume.contact[k]),
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
    return { text, italics: true, fontSize: sz(9), color: GRAY, margin: [0, 0, 0, sp(2)] };
  }

  function bulletList(bullets) {
    return bullets.filter(Boolean).map((b) => ({
      text: `${bulletChar} ${b}`,
      fontSize: sz(10),
      margin: [8, 0, 0, sp(1)],
    }));
  }

  const sectionOrder = sectionOrderProp || resume.sectionOrder || [
    'contact', 'summary', 'education', 'experience', 'skills', 'projects', 'certifications', 'honors_awards',
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
        const dates = [edu.start, edu.end].filter(Boolean).join(' \u2013 ');
        const degreeField = [edu.degree, edu.field].filter(Boolean).join(' in ');
        content.push(entryHeader(edu.institution, ''));
        if (degreeField || dates) {
          content.push({
            columns: [
              { text: degreeField, italics: true, fontSize: sz(9), color: GRAY, width: '*' },
              { text: dates, italics: true, fontSize: sz(9), color: GRAY, alignment: 'right', width: 'auto' },
            ],
            margin: [0, 0, 0, sp(2)],
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
          [exp.start, exp.end].filter(Boolean).join(' \u2013 '),
        ].filter(Boolean).join(' | ');
        content.push(entryHeader(exp.company, rightPart));
        if (exp.title) content.push(italicSub(exp.title));
        content.push(...bulletList(exp.bullets));
      });
      continue;
    }

    if (key === 'projects' && resume.projects.length > 0) {
      addHeading('Projects');
      resume.projects.forEach((proj) => {
        const dates = [proj.start, proj.end].filter(Boolean).join(' \u2013 ');
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

    if (key === 'honors_awards' && resume.honors_awards.length > 0) {
      addHeading('Honors & Awards');
      const runs = [];
      resume.honors_awards.forEach((award, i) => {
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
    defaultStyle: { fontSize: sz(10), lineHeight: lineSpacing },
    content,
  };

  return pdfMake.createPdf(docDef).getBlob();
}
