import React, { useState, useRef, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, TabStopType, TabStopPosition,
} from 'docx';
import { UserContext } from '@/common/contexts/UserContext';
import './ResumeEditor.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const newId = () => crypto.randomUUID();

const DEMO_RESUME = {
  contact: {
    name: 'Alex Johnson',
    email: 'alex.johnson@email.com',
    phone: '(555) 123-4567',
    linkedin: 'linkedin.com/in/alexjohnson',
    location: 'Chicago, IL',
    github: 'github.com/alexjohnson',
  },
  contactExtra: [],
  summary:
    'Software engineer with 3 years of experience building scalable web applications. Proficient in React, Node.js, and cloud infrastructure. Passionate about clean code and developer tooling.',
  experience: [
    {
      id: newId(),
      company: 'Acme Corp',
      role: 'Software Engineer',
      location: 'Chicago, IL',
      startDate: 'Jun 2022',
      endDate: 'Present',
      bullets: [
        'Built and maintained React frontend serving 50k+ daily active users',
        'Reduced API response time by 40% through query optimization and caching',
        'Led migration from REST to GraphQL, cutting over-fetching by 60%',
      ],
    },
  ],
  education: [
    {
      id: newId(),
      school: 'Northwestern University',
      degree: 'M.S.',
      field: 'Computer Science',
      startDate: 'Sep 2020',
      endDate: 'Jun 2022',
      gpa: '3.9',
    },
  ],
  skills: [
    { id: newId(), category: 'Languages', items: 'JavaScript, TypeScript, Python, SQL' },
    { id: newId(), category: 'Frameworks', items: 'React, Node.js, Express, GraphQL' },
    { id: newId(), category: 'Tools', items: 'AWS, Docker, Git, PostgreSQL' },
  ],
  projects: [
    {
      id: newId(),
      name: 'Resume Optimizer',
      tech: 'React, Node.js, OpenAI API',
      startDate: 'Jan 2024',
      endDate: 'Present',
      bullets: [
        'Built AI-powered resume analyzer that compares resumes against job descriptions',
        'Implemented keyword matching and skills gap analysis using LLMs',
      ],
    },
  ],
  certifications: [
    { id: newId(), name: 'AWS Certified Developer – Associate', issuer: 'Amazon Web Services', date: 'Mar 2023' },
  ],
  honorsAwards: [
    { id: newId(), title: "Dean's List", issuer: 'Northwestern University', date: '2021', description: 'Top 5% of graduate cohort' },
  ],
};

function ContactField({ label, value, onChange, onRemove, removable = false }) {
  return (
    <div className="field-row">
      <input className="editor-input field-label-input" value={label} readOnly={!removable} onChange={removable ? (e) => onChange('label', e.target.value) : undefined} placeholder="Label" />
      <input className="editor-input" value={value} onChange={(e) => onChange('value', e.target.value)} placeholder={label} />
      {removable && (
        <IconButton size="small" onClick={onRemove} className="icon-btn-remove">
          <Delete fontSize="small" />
        </IconButton>
      )}
    </div>
  );
}

function BulletList({ bullets, onChange }) {
  const update = (i, val) => {
    const next = [...bullets];
    next[i] = val;
    onChange(next);
  };
  const remove = (i) => onChange(bullets.filter((_, idx) => idx !== i));
  const add = () => onChange([...bullets, '']);

  return (
    <div className="bullet-list">
      {bullets.map((b, i) => (
        <div key={i} className="bullet-row">
          <span className="bullet-dot">•</span>
          <textarea
            className="editor-input bullet-input"
            value={b}
            onChange={(e) => update(i, e.target.value)}
            rows={2}
            placeholder="Bullet point"
          />
          <IconButton size="small" onClick={() => remove(i)} className="icon-btn-remove">
            <Delete fontSize="small" />
          </IconButton>
        </div>
      ))}
      <button className="add-bullet-btn" onClick={add}>+ Add bullet</button>
    </div>
  );
}

function SectionCard({ title, onRemove, children }) {
  return (
    <div className="entry-card">
      <div className="entry-card-header">
        <span className="entry-card-title">{title}</span>
        <IconButton size="small" onClick={onRemove} className="icon-btn-remove">
          <Delete fontSize="small" />
        </IconButton>
      </div>
      {children}
    </div>
  );
}

// Build DOCX section heading paragraph
function docxHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, allCaps: true })],
    spacing: { before: 160, after: 60 },
    border: { bottom: { color: '333333', size: 6, style: BorderStyle.SINGLE, space: 2 } },
  });
}

// Build right-tab paragraph for "Main Text    Date" layout
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

function buildDocx(resume) {
  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.contact.github,
    ...((resume.contactExtra || []).filter((f) => f.value).map((f) => f.value)),
  ].filter(Boolean);

  const children = [
    // Name
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: resume.contact.name || 'Your Name', bold: true, size: 32 })],
      spacing: { after: 40 },
    }),
    // Contact row
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: contactParts.join('  |  '), size: 18, color: '444444' })],
      spacing: { after: 80 },
    }),
  ];

  // Summary
  if (resume.summary) {
    children.push(docxHeading('Summary'));
    children.push(new Paragraph({ children: [new TextRun({ text: resume.summary, size: 20 })], spacing: { after: 60 } }));
  }

  // Experience
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

  // Education
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

  // Skills
  if (resume.skills.length > 0) {
    children.push(docxHeading('Skills'));
    resume.skills.forEach((sk) => {
      const runs = sk.category
        ? [new TextRun({ text: `${sk.category}: `, bold: true, size: 20 }), new TextRun({ text: sk.items, size: 20 })]
        : [new TextRun({ text: sk.items, size: 20 })];
      children.push(new Paragraph({ children: runs, spacing: { after: 30 } }));
    });
  }

  // Projects
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

  // Certifications
  if (resume.certifications.length > 0) {
    children.push(docxHeading('Certifications'));
    resume.certifications.forEach((cert) => {
      children.push(docxEntryHeader(cert.name, cert.date));
      if (cert.issuer) {
        children.push(new Paragraph({ children: [new TextRun({ text: cert.issuer, italics: true, size: 18, color: '555555' })], spacing: { after: 40 } }));
      }
    });
  }

  // Honors & Awards
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

export default function ResumeEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useContext(UserContext);
  const previewRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [format, setFormat] = useState({ margins: 32, lineSpacing: 1.5 });

  const initial = location.state?.resume || DEMO_RESUME;
  const [resume, setResume] = useState(initial);

  const set = (field, value) => setResume((r) => ({ ...r, [field]: value }));
  const setContact = (key, value) => setResume((r) => ({ ...r, contact: { ...r.contact, [key]: value } }));

  // Contact extra fields
  const addContactField = () =>
    setResume((r) => ({ ...r, contactExtra: [...(r.contactExtra || []), { id: newId(), label: '', value: '' }] }));
  const updateContactExtra = (id, key, val) =>
    setResume((r) => ({ ...r, contactExtra: r.contactExtra.map((f) => (f.id === id ? { ...f, [key]: val } : f)) }));
  const removeContactExtra = (id) =>
    setResume((r) => ({ ...r, contactExtra: r.contactExtra.filter((f) => f.id !== id) }));

  // Generic entry helpers
  const addEntry = (field, blank) => set(field, [...resume[field], { id: newId(), ...blank }]);
  const removeEntry = (field, id) => set(field, resume[field].filter((e) => e.id !== id));
  const updateEntry = (field, id, key, value) =>
    set(field, resume[field].map((e) => (e.id === id ? { ...e, [key]: value } : e)));
  const updateBullets = (field, id, bullets) => updateEntry(field, id, 'bullets', bullets);

  const generatePdfBlob = async () => {
    const canvas = await html2canvas(previewRef.current, { scale: 1.5, useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.75);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -y, pageW, imgH);
      y += pageH;
    }
    return pdf.output('blob');
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resume.contact.name || 'resume'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      const doc = buildDocx(resume);
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resume.contact.name || 'resume'}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('DOCX export error:', err);
      alert('Failed to export DOCX. Please try again.');
    } finally {
      setExportingDocx(false);
    }
  };

  const handleSaveToResumes = async () => {
    setSaving(true);
    try {
      const blob = await generatePdfBlob();
      const fileName = `${resume.contact.name || 'resume'}-edited.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);
      const token = await getToken();
      await axios.post(`${BACKEND_URL}/resumes/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      navigate('/resumes');
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save resume. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const allContacts = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'github', label: 'GitHub' },
    { key: 'location', label: 'Location' },
  ];

  return (
    <div className="editor-page">
      {/* LEFT: FORM */}
      <div className="editor-form">
        {/* Contact */}
        <div className="section">
          <div className="section-header"><h2>Contact Info</h2></div>
          <div className="section-body">
            {allContacts.map(({ key, label }) => (
              <div className="field-row" key={key}>
                <span className="field-label">{label}</span>
                <input className="editor-input" value={resume.contact[key] || ''} onChange={(e) => setContact(key, e.target.value)} placeholder={label} />
              </div>
            ))}
            {(resume.contactExtra || []).map((f) => (
              <ContactField key={f.id} label={f.label} value={f.value} removable onChange={(k, v) => updateContactExtra(f.id, k, v)} onRemove={() => removeContactExtra(f.id)} />
            ))}
            <button className="add-bullet-btn" onClick={addContactField}>+ Add field</button>
          </div>
        </div>

        {/* Summary */}
        <div className="section">
          <div className="section-header"><h2>Professional Summary</h2></div>
          <div className="section-body">
            <textarea className="editor-input" value={resume.summary} onChange={(e) => set('summary', e.target.value)} rows={4} placeholder="Write a brief professional summary..." />
          </div>
        </div>

        {/* Experience */}
        <div className="section">
          <div className="section-header"><h2>Work Experience</h2></div>
          <div className="section-body">
            {resume.experience.map((exp) => (
              <SectionCard key={exp.id} title={exp.company || 'New Entry'} onRemove={() => removeEntry('experience', exp.id)}>
                <div className="field-row"><span className="field-label">Company</span><input className="editor-input" value={exp.company} onChange={(e) => updateEntry('experience', exp.id, 'company', e.target.value)} placeholder="Company" /></div>
                <div className="field-row"><span className="field-label">Role</span><input className="editor-input" value={exp.role} onChange={(e) => updateEntry('experience', exp.id, 'role', e.target.value)} placeholder="Job Title" /></div>
                <div className="field-row"><span className="field-label">Location</span><input className="editor-input" value={exp.location} onChange={(e) => updateEntry('experience', exp.id, 'location', e.target.value)} placeholder="City, ST" /></div>
                <div className="dates-row">
                  <input className="editor-input" value={exp.startDate} onChange={(e) => updateEntry('experience', exp.id, 'startDate', e.target.value)} placeholder="Start" />
                  <span>–</span>
                  <input className="editor-input" value={exp.endDate} onChange={(e) => updateEntry('experience', exp.id, 'endDate', e.target.value)} placeholder="End / Present" />
                </div>
                <BulletList bullets={exp.bullets} onChange={(b) => updateBullets('experience', exp.id, b)} />
              </SectionCard>
            ))}
            <button className="add-section-btn" onClick={() => addEntry('experience', { company: '', role: '', location: '', startDate: '', endDate: '', bullets: [] })}>
              <Add fontSize="small" /> Add Experience
            </button>
          </div>
        </div>

        {/* Education */}
        <div className="section">
          <div className="section-header"><h2>Education</h2></div>
          <div className="section-body">
            {resume.education.map((edu) => (
              <SectionCard key={edu.id} title={edu.school || 'New Entry'} onRemove={() => removeEntry('education', edu.id)}>
                <div className="field-row"><span className="field-label">School</span><input className="editor-input" value={edu.school} onChange={(e) => updateEntry('education', edu.id, 'school', e.target.value)} placeholder="University Name" /></div>
                <div className="field-row"><span className="field-label">Degree</span><input className="editor-input" value={edu.degree} onChange={(e) => updateEntry('education', edu.id, 'degree', e.target.value)} placeholder="B.S. / M.S. / Ph.D." /></div>
                <div className="field-row"><span className="field-label">Field</span><input className="editor-input" value={edu.field} onChange={(e) => updateEntry('education', edu.id, 'field', e.target.value)} placeholder="Computer Science" /></div>
                <div className="dates-row">
                  <input className="editor-input" value={edu.startDate} onChange={(e) => updateEntry('education', edu.id, 'startDate', e.target.value)} placeholder="Start" />
                  <span>–</span>
                  <input className="editor-input" value={edu.endDate} onChange={(e) => updateEntry('education', edu.id, 'endDate', e.target.value)} placeholder="End" />
                </div>
                <div className="field-row"><span className="field-label">GPA</span><input className="editor-input" value={edu.gpa} onChange={(e) => updateEntry('education', edu.id, 'gpa', e.target.value)} placeholder="3.9" /></div>
              </SectionCard>
            ))}
            <button className="add-section-btn" onClick={() => addEntry('education', { school: '', degree: '', field: '', startDate: '', endDate: '', gpa: '' })}>
              <Add fontSize="small" /> Add Education
            </button>
          </div>
        </div>

        {/* Skills */}
        <div className="section">
          <div className="section-header"><h2>Skills</h2></div>
          <div className="section-body">
            {resume.skills.map((sk) => (
              <div key={sk.id} className="entry-card">
                <div className="entry-card-header">
                  <input className="editor-input category-input" value={sk.category} onChange={(e) => updateEntry('skills', sk.id, 'category', e.target.value)} placeholder="Category (e.g. Languages)" />
                  <IconButton size="small" onClick={() => removeEntry('skills', sk.id)} className="icon-btn-remove"><Delete fontSize="small" /></IconButton>
                </div>
                <input className="editor-input" value={sk.items} onChange={(e) => updateEntry('skills', sk.id, 'items', e.target.value)} placeholder="Skill1, Skill2, Skill3..." />
              </div>
            ))}
            <button className="add-section-btn" onClick={() => addEntry('skills', { category: '', items: '' })}>
              <Add fontSize="small" /> Add Skill Group
            </button>
          </div>
        </div>

        {/* Projects */}
        <div className="section">
          <div className="section-header"><h2>Projects</h2></div>
          <div className="section-body">
            {resume.projects.map((proj) => (
              <SectionCard key={proj.id} title={proj.name || 'New Entry'} onRemove={() => removeEntry('projects', proj.id)}>
                <div className="field-row"><span className="field-label">Name</span><input className="editor-input" value={proj.name} onChange={(e) => updateEntry('projects', proj.id, 'name', e.target.value)} placeholder="Project Name" /></div>
                <div className="field-row"><span className="field-label">Tech</span><input className="editor-input" value={proj.tech} onChange={(e) => updateEntry('projects', proj.id, 'tech', e.target.value)} placeholder="React, Node.js, ..." /></div>
                <div className="dates-row">
                  <input className="editor-input" value={proj.startDate} onChange={(e) => updateEntry('projects', proj.id, 'startDate', e.target.value)} placeholder="Start" />
                  <span>–</span>
                  <input className="editor-input" value={proj.endDate} onChange={(e) => updateEntry('projects', proj.id, 'endDate', e.target.value)} placeholder="End" />
                </div>
                <BulletList bullets={proj.bullets} onChange={(b) => updateBullets('projects', proj.id, b)} />
              </SectionCard>
            ))}
            <button className="add-section-btn" onClick={() => addEntry('projects', { name: '', tech: '', startDate: '', endDate: '', bullets: [] })}>
              <Add fontSize="small" /> Add Project
            </button>
          </div>
        </div>

        {/* Certifications */}
        <div className="section">
          <div className="section-header"><h2>Certifications</h2></div>
          <div className="section-body">
            {resume.certifications.map((cert) => (
              <SectionCard key={cert.id} title={cert.name || 'New Entry'} onRemove={() => removeEntry('certifications', cert.id)}>
                <div className="field-row"><span className="field-label">Name</span><input className="editor-input" value={cert.name} onChange={(e) => updateEntry('certifications', cert.id, 'name', e.target.value)} placeholder="Certification Name" /></div>
                <div className="field-row"><span className="field-label">Issuer</span><input className="editor-input" value={cert.issuer} onChange={(e) => updateEntry('certifications', cert.id, 'issuer', e.target.value)} placeholder="Issuing Organization" /></div>
                <div className="field-row"><span className="field-label">Date</span><input className="editor-input" value={cert.date} onChange={(e) => updateEntry('certifications', cert.id, 'date', e.target.value)} placeholder="Mon YYYY" /></div>
              </SectionCard>
            ))}
            <button className="add-section-btn" onClick={() => addEntry('certifications', { name: '', issuer: '', date: '' })}>
              <Add fontSize="small" /> Add Certification
            </button>
          </div>
        </div>

        {/* Honors & Awards */}
        <div className="section">
          <div className="section-header"><h2>Honors &amp; Awards</h2></div>
          <div className="section-body">
            {resume.honorsAwards.map((award) => (
              <SectionCard key={award.id} title={award.title || 'New Entry'} onRemove={() => removeEntry('honorsAwards', award.id)}>
                <div className="field-row"><span className="field-label">Title</span><input className="editor-input" value={award.title} onChange={(e) => updateEntry('honorsAwards', award.id, 'title', e.target.value)} placeholder="Award Name" /></div>
                <div className="field-row"><span className="field-label">Issuer</span><input className="editor-input" value={award.issuer} onChange={(e) => updateEntry('honorsAwards', award.id, 'issuer', e.target.value)} placeholder="Organization" /></div>
                <div className="field-row"><span className="field-label">Date</span><input className="editor-input" value={award.date} onChange={(e) => updateEntry('honorsAwards', award.id, 'date', e.target.value)} placeholder="Mon YYYY" /></div>
                <div className="field-row"><span className="field-label">Description</span><input className="editor-input" value={award.description} onChange={(e) => updateEntry('honorsAwards', award.id, 'description', e.target.value)} placeholder="Brief description" /></div>
              </SectionCard>
            ))}
            <button className="add-section-btn" onClick={() => addEntry('honorsAwards', { title: '', issuer: '', date: '', description: '' })}>
              <Add fontSize="small" /> Add Honor / Award
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="editor-actions">
          <Button variant="outlined" onClick={handleExportPdf} disabled={exporting} className="btn-export">
            {exporting ? <CircularProgress size={18} /> : 'Export PDF'}
          </Button>
          <Button variant="outlined" onClick={handleExportDocx} disabled={exportingDocx} className="btn-export">
            {exportingDocx ? <CircularProgress size={18} /> : 'Export DOCX'}
          </Button>
          <Button variant="contained" onClick={handleSaveToResumes} disabled={saving} className="btn-analyze">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Save to My Resumes'}
          </Button>
        </div>
      </div>

      {/* RIGHT: PREVIEW */}
      <div className="editor-preview-panel">
        <div className="preview-label">Live Preview</div>

        {/* Format toolbar */}
        <div className="format-toolbar">
          <div className="format-row">
            <span className="format-label">Margins</span>
            <span className="format-hint">Narrow</span>
            <input
              type="range" min={16} max={48} step={4}
              value={format.margins}
              onChange={(e) => setFormat((f) => ({ ...f, margins: Number(e.target.value) }))}
              className="format-slider"
            />
            <span className="format-hint">Wide</span>
          </div>
          <div className="format-row">
            <span className="format-label">Spacing</span>
            <span className="format-hint">Tight</span>
            <input
              type="range" min={1.2} max={2.0} step={0.1}
              value={format.lineSpacing}
              onChange={(e) => setFormat((f) => ({ ...f, lineSpacing: Number(e.target.value) }))}
              className="format-slider"
            />
            <span className="format-hint">Loose</span>
          </div>
        </div>

        <div
          className="resume-preview"
          ref={previewRef}
          style={{ padding: `${format.margins}px ${format.margins + 4}px`, lineHeight: format.lineSpacing }}
        >
          {/* Header */}
          <div className="rp-header">
            <div className="rp-name">{resume.contact.name || 'Your Name'}</div>
            <div className="rp-contact-row">
              {[
                resume.contact.email,
                resume.contact.phone,
                resume.contact.location,
                resume.contact.linkedin,
                resume.contact.github,
                ...((resume.contactExtra || []).filter((f) => f.value).map((f) => f.value)),
              ].filter(Boolean).join('  |  ')}
            </div>
          </div>

          {/* Summary */}
          {resume.summary && (
            <div className="rp-section">
              <div className="rp-section-title">Summary</div>
              <p className="rp-text">{resume.summary}</p>
            </div>
          )}

          {/* Experience */}
          {resume.experience.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Work Experience</div>
              {resume.experience.map((exp) => (
                <div key={exp.id} className="rp-entry">
                  <div className="rp-entry-header">
                    <span className="rp-entry-main">{exp.role}{exp.company ? ` — ${exp.company}` : ''}</span>
                    <span className="rp-entry-dates">{[exp.startDate, exp.endDate].filter(Boolean).join(' – ')}</span>
                  </div>
                  {exp.location && <div className="rp-entry-sub">{exp.location}</div>}
                  {exp.bullets.length > 0 && (
                    <ul className="rp-bullets">{exp.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Education */}
          {resume.education.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Education</div>
              {resume.education.map((edu) => (
                <div key={edu.id} className="rp-entry">
                  <div className="rp-entry-header">
                    <span className="rp-entry-main">{edu.school}</span>
                    <span className="rp-entry-dates">{[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}</span>
                  </div>
                  <div className="rp-entry-sub">
                    {[edu.degree, edu.field].filter(Boolean).join(', ')}
                    {edu.gpa ? `  •  GPA: ${edu.gpa}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Skills */}
          {resume.skills.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Skills</div>
              {resume.skills.map((sk) => (
                <div key={sk.id} className="rp-skill-row">
                  {sk.category && <span className="rp-skill-cat">{sk.category}: </span>}
                  <span>{sk.items}</span>
                </div>
              ))}
            </div>
          )}

          {/* Projects */}
          {resume.projects.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Projects</div>
              {resume.projects.map((proj) => (
                <div key={proj.id} className="rp-entry">
                  <div className="rp-entry-header">
                    <span className="rp-entry-main">{proj.name}</span>
                    <span className="rp-entry-dates">{[proj.startDate, proj.endDate].filter(Boolean).join(' – ')}</span>
                  </div>
                  {proj.tech && <div className="rp-entry-sub">{proj.tech}</div>}
                  {proj.bullets.length > 0 && (
                    <ul className="rp-bullets">{proj.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Certifications */}
          {resume.certifications.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Certifications</div>
              {resume.certifications.map((cert) => (
                <div key={cert.id} className="rp-entry">
                  <div className="rp-entry-header">
                    <span className="rp-entry-main">{cert.name}</span>
                    <span className="rp-entry-dates">{cert.date}</span>
                  </div>
                  {cert.issuer && <div className="rp-entry-sub">{cert.issuer}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Honors & Awards */}
          {resume.honorsAwards.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Honors &amp; Awards</div>
              {resume.honorsAwards.map((award) => (
                <div key={award.id} className="rp-entry">
                  <div className="rp-entry-header">
                    <span className="rp-entry-main">{award.title}</span>
                    <span className="rp-entry-dates">{award.date}</span>
                  </div>
                  <div className="rp-entry-sub">
                    {award.issuer}{award.description ? `  —  ${award.description}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
