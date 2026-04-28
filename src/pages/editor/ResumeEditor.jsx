import React, { useState, useRef, useContext, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { buildDocx, Packer } from '@/utils/buildDocx';
import { UserContext } from '@/common/contexts/UserContext';
import './ResumeEditor.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const PAPER_WIDTH = 816;
const PAPER_HEIGHT = 1056;
const PANEL_WIDTH = 650;

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


function toEditorSchema(parsed) {
  return {
    contact: {
      name: parsed.contact?.name || '',
      email: parsed.contact?.email || '',
      phone: parsed.contact?.phone || '',
      linkedin: parsed.contact?.linkedin || '',
      location: parsed.contact?.location || '',
      github: parsed.contact?.github || '',
    },
    contactExtra: [],
    summary: parsed.summary || '',
    experience: (parsed.experience || []).map((exp, i) => ({
      id: `exp-${i}`, company: exp.company || '', role: exp.title || '',
      location: exp.location || '', startDate: exp.start || '', endDate: exp.end || '',
      bullets: exp.bullets || [],
    })),
    education: (parsed.education || []).map((edu, i) => ({
      id: `edu-${i}`, school: edu.institution || '', degree: edu.degree || '',
      field: edu.field || '', startDate: edu.start || '', endDate: edu.end || '',
      gpa: edu.gpa || '',
    })),
    skills: [
      ...(parsed.skills?.technical?.length ? [{ id: 'sk-tech', category: 'Technical', items: parsed.skills.technical.join(', ') }] : []),
      ...(parsed.skills?.tools?.length ? [{ id: 'sk-tools', category: 'Tools', items: parsed.skills.tools.join(', ') }] : []),
      ...(parsed.skills?.languages?.length ? [{ id: 'sk-lang', category: 'Languages', items: parsed.skills.languages.join(', ') }] : []),
      ...(parsed.skills?.soft?.length ? [{ id: 'sk-soft', category: 'Soft Skills', items: parsed.skills.soft.join(', ') }] : []),
    ],
    projects: (parsed.projects || []).map((proj, i) => ({
      id: `proj-${i}`, name: proj.name || '',
      tech: Array.isArray(proj.tech) ? proj.tech.join(', ') : (proj.tech || ''),
      startDate: '', endDate: '', bullets: proj.bullets || [],
    })),
    certifications: (parsed.certifications || []).map((cert, i) => ({
      id: `cert-${i}`, name: cert.name || '', issuer: cert.issuer || '', date: cert.date || '',
    })),
    honorsAwards: (parsed.honors_awards || []).map((ha, i) => ({
      id: `ha-${i}`, title: ha.title || '', issuer: ha.issuer || '', date: ha.date || '', description: '',
    })),
  };
}

export default function ResumeEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useContext(UserContext);
  const previewRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [format, setFormat] = useState({ margins: 40, lineSpacing: 1.3 });
  const [loadingResume, setLoadingResume] = useState(false);
  const [fitToOnePage, setFitToOnePage] = useState(false);
  const [fitFontScale, setFitFontScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(PAPER_HEIGHT);
  const contentWrapRef = useRef(null);

  const [resume, setResume] = useState(location.state?.resume || DEMO_RESUME);

  useEffect(() => {
    const resumeId = location.state?.resumeId;
    if (!resumeId || location.state?.resume) return;

    const fetchAndParse = async () => {
      setLoadingResume(true);
      try {
        const token = await getToken();
        const { data } = await axios.post(
          `${BACKEND_URL}/resumes/${resumeId}/parse`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setResume(toEditorSchema(data.parsed_resume));
      } catch (err) {
        console.error('Failed to load resume for editor:', err);
      } finally {
        setLoadingResume(false);
      }
    };

    fetchAndParse();
  }, []);

  useEffect(() => {
    if (!contentWrapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (contentWrapRef.current) {
        setContentHeight(contentWrapRef.current.scrollHeight);
      }
    });
    ro.observe(contentWrapRef.current);
    return () => ro.disconnect();
  }, [loadingResume]);

  // Compute zoom scale so content fills exactly one page.
  // Runs after every resume/format change while fitToOnePage is on.
  useLayoutEffect(() => {
    if (!contentWrapRef.current || !fitToOnePage) {
      setFitFontScale(1);
      return;
    }
    const el = contentWrapRef.current;
    el.style.zoom = '';                          // measure at natural size
    const h = el.scrollHeight;
    const scale = Math.max(0.5, Math.min(1.5, PAPER_HEIGHT / h));
    setFitFontScale(scale);
  }, [fitToOnePage, resume, format]);

  const panelScale = PANEL_WIDTH / PAPER_WIDTH;
  const totalScale = panelScale;
  const numPages = fitToOnePage ? 1 : Math.ceil(contentHeight / PAPER_HEIGHT);
  const outerHeight = numPages * PAPER_HEIGHT * panelScale;

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
    const el = previewRef.current;
    const savedTransform = el.style.transform;
    el.style.transform = 'none';
    const canvas = await html2canvas(el, { scale: 1.5, useCORS: true });
    el.style.transform = savedTransform;
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

  if (loadingResume) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <CircularProgress />
        <span style={{ color: '#6b7280' }}>Parsing resume...</span>
      </div>
    );
  }

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
        <div className="preview-toolbar-row">
          <span className="preview-label" style={{ marginBottom: 0 }}>Live Preview</span>
          <button className="fit-page-btn" onClick={() => setFitToOnePage(v => !v)}>
            {fitToOnePage ? 'Normal View' : 'Fit to 1 Page'}
          </button>
        </div>

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

        <div className="rp-page-outer" style={{ height: outerHeight }}>
          {!fitToOnePage && Array.from({ length: numPages - 1 }, (_, i) => (
            <div key={i} className="rp-page-break" style={{ top: (i + 1) * PAPER_HEIGHT * panelScale }} />
          ))}
          <div
            className="resume-preview"
            ref={previewRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: PAPER_WIDTH,
              minHeight: numPages * PAPER_HEIGHT,
              transform: `scale(${totalScale})`,
              transformOrigin: 'top left',
            }}
          >
          <div
            ref={contentWrapRef}
            style={{
              padding: `${format.margins}px ${format.margins + 4}px`,
              lineHeight: format.lineSpacing,
              zoom: fitToOnePage ? fitFontScale : undefined,
            }}
          >
          {/* Header */}
          <div className="rp-header">
            <div className="rp-name">{resume.contact.name || 'Your Name'}</div>
            <div className="rp-contact-row">
              {[
                resume.contact.phone,
                resume.contact.email,
                resume.contact.linkedin,
                resume.contact.github,
                resume.contact.location,
                ...((resume.contactExtra || []).filter((f) => f.value).map((f) => f.value)),
              ].filter(Boolean).join(' | ')}
            </div>
          </div>

          {/* Summary — no section heading, inline block */}
          {resume.summary && (
            <div className="rp-summary-block">{resume.summary}</div>
          )}

          {/* Education */}
          {resume.education.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Education</div>
              {resume.education.map((edu) => (
                <div key={edu.id} className="rp-entry">
                  <div className="rp-entry-header">
                    <span className="rp-entry-main">{edu.school}</span>
                  </div>
                  <div className="rp-entry-sub-row">
                    <span className="rp-entry-sub">{[edu.degree, edu.field].filter(Boolean).join(' in ')}</span>
                    <span className="rp-entry-sub">{[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}</span>
                  </div>
                  {edu.gpa && <div className="rp-entry-sub">GPA: {edu.gpa}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Experience */}
          {resume.experience.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Experience</div>
              {resume.experience.map((exp) => (
                <div key={exp.id} className="rp-entry">
                  <div className="rp-entry-header">
                    <span className="rp-entry-main">{exp.company}</span>
                    <span className="rp-entry-dates">
                      {[exp.location, [exp.startDate, exp.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' | ')}
                    </span>
                  </div>
                  {exp.role && <div className="rp-entry-sub">{exp.role}</div>}
                  {exp.bullets.length > 0 && (
                    <ul className="rp-bullets">{exp.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>
                  )}
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
                    <span className="rp-entry-main">
                      {proj.name}{proj.tech ? <span className="rp-entry-sub"> | {proj.tech}</span> : ''}
                    </span>
                    <span className="rp-entry-dates">{[proj.startDate, proj.endDate].filter(Boolean).join(' – ')}</span>
                  </div>
                  {proj.bullets.length > 0 && (
                    <ul className="rp-bullets">{proj.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Technical Skills */}
          {resume.skills.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Technical Skills</div>
              {resume.skills.map((sk) => (
                <div key={sk.id} className="rp-skill-row">
                  {sk.category && <span className="rp-skill-cat">{sk.category}: </span>}
                  <span>{sk.items}</span>
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

          {/* Honors & Awards — rendered as flowing text block matching PDF style */}
          {resume.honorsAwards.length > 0 && (
            <div className="rp-section">
              <div className="rp-section-title">Honors &amp; Awards</div>
              <div className="rp-honors-block">
                {resume.honorsAwards.map((award, i) => (
                  <span key={award.id}>
                    {i > 0 && ' • '}
                    {award.title}
                    {award.issuer ? `, ${award.issuer}` : ''}
                    {award.date ? ` (${award.date})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          </div>{/* end contentWrapRef */}
          </div>{/* end resume-preview */}
        </div>
      </div>
    </div>
  );
}
