import React, { useState, useRef, useContext, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { Button, IconButton, CircularProgress } from '@mui/material';
import { Add, Delete, KeyboardArrowUp, KeyboardArrowDown } from '@mui/icons-material';
import axios from 'axios';
import { useSnackbar } from '@/common/contexts/SnackbarContext';
import { buildDocx, Packer } from '@/utils/buildDocx';
import { getPdfBlob } from '@/utils/buildPdf';
import { exportPdf, exportDocx } from '@/common/functions/exportFile';
import { UserContext } from '@/common/contexts/UserContext';
import './ResumeEditor.css';

import { BACKEND_URL } from '@/utils/constants';
import { skillsToRows } from '@/utils/resumeUtils';
const PAPER_WIDTH = 816;
const PAPER_HEIGHT = 1056;
const newId = () => crypto.randomUUID();

const DEFAULT_SECTION_ORDER = ['contact', 'summary', 'education', 'experience', 'skills', 'projects', 'certifications', 'honors_awards'];
const SECTION_TITLES = {
  contact: 'Contact Info',
  summary: 'Professional Summary',
  education: 'Education',
  experience: 'Work Experience',
  skills: 'Technical Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  honors_awards: 'Honors & Awards',
};

const DEMO_RESUME = {
  contact: {
    name: '',
    email: '',
    phone: '',
    linkedin: '',
    location: '',
    github: '',
  },
  contactExtra: [],
  summary:
    'Software engineer with 3 years of experience building scalable web applications. Proficient in React, Node.js, and cloud infrastructure. Passionate about clean code and developer tooling.',
  experience: [
    {
      id: newId(),
      company: 'Acme Corp',
      title: 'Software Engineer',
      location: 'Chicago, IL',
      start: 'Jun 2022',
      end: 'Present',
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
      institution: 'Northwestern University',
      degree: 'M.S.',
      field: 'Computer Science',
      start: 'Sep 2020',
      end: 'Jun 2022',
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
      start: 'Jan 2024',
      end: 'Present',
      bullets: [
        'Built AI-powered resume analyzer that compares resumes against job descriptions',
        'Implemented keyword matching and skills gap analysis using LLMs',
      ],
    },
  ],
  certifications: [
    { id: newId(), name: 'AWS Certified Developer – Associate', issuer: 'Amazon Web Services', date: 'Mar 2023' },
  ],
  honors_awards: [
    { id: newId(), title: "Dean's List", issuer: 'Northwestern University', date: '2021' },
  ],
  customSections: [],
};


// Editor rows array → LLM skills object (for DB save)
function rowsToSkills(rows) {
  const map = { technical: [], tools: [], languages: [], soft: [] };
  const nameMap = { technical: 'technical', tools: 'tools', languages: 'languages', 'soft skills': 'soft', soft: 'soft' };
  for (const row of (rows || [])) {
    const key = nameMap[(row.category || '').toLowerCase()] || 'technical';
    map[key] = (row.items || '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return map;
}

// Prepare LLM-format resume for editor state: expand skills to rows, join tech arrays, add IDs + editor-only fields
function initFromLLM(r) {
  return {
    ...r,
    skills: skillsToRows(r.skills),
    projects: (r.projects || []).map((p) => ({
      ...p,
      id: p.id || newId(),
      tech: Array.isArray(p.tech) ? p.tech.join(', ') : (p.tech || ''),
    })),
    experience:    (r.experience    || []).map((e)   => ({ ...e,   id: e.id   || newId() })),
    education:     (r.education     || []).map((edu) => ({ ...edu, id: edu.id || newId() })),
    certifications:(r.certifications|| []).map((c)   => ({ ...c,   id: c.id   || newId() })),
    honors_awards: (r.honors_awards || []).map((ha)  => ({ ...ha,  id: ha.id  || newId() })),
    contactExtra:  r.contactExtra  || [],
    customSections:r.customSections|| [],
  };
}

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
  const update = (i, val) => { const next = [...bullets]; next[i] = val; onChange(next); };
  const remove = (i) => onChange(bullets.filter((_, idx) => idx !== i));
  const add = () => onChange([...bullets, '']);
  return (
    <div className="bullet-list">
      {bullets.map((b, i) => (
        <div key={i} className="bullet-row">
          <span className="bullet-dot">•</span>
          <textarea className="editor-input bullet-input" value={b} onChange={(e) => update(i, e.target.value)} rows={2} placeholder="Bullet point" />
          <IconButton size="small" onClick={() => remove(i)} className="icon-btn-remove"><Delete fontSize="small" /></IconButton>
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
        <IconButton size="small" onClick={onRemove} className="icon-btn-remove"><Delete fontSize="small" /></IconButton>
      </div>
      {children}
    </div>
  );
}

function FormSection({ title, collapsed, onToggle, onMoveUp, onMoveDown, canMoveUp, canMoveDown, onRemove, children }) {
  return (
    <div className="section editor-collapsible-section">
      <div className="editor-section-header" onClick={onToggle}>
        <div className="editor-section-title-area">
          <span className="editor-collapse-icon">{collapsed ? '▶' : '▼'}</span>
          <h2>{title}</h2>
        </div>
        <div className="editor-section-controls" onClick={(e) => e.stopPropagation()}>
          <button className="section-move-btn" disabled={!canMoveUp} onClick={onMoveUp} title="Move up">
            <KeyboardArrowUp fontSize="small" />
          </button>
          <button className="section-move-btn" disabled={!canMoveDown} onClick={onMoveDown} title="Move down">
            <KeyboardArrowDown fontSize="small" />
          </button>
          {onRemove && (
            <IconButton size="small" onClick={onRemove} className="icon-btn-remove"><Delete fontSize="small" /></IconButton>
          )}
        </div>
      </div>
      {!collapsed && <div className="section-body">{children}</div>}
    </div>
  );
}

export default function ResumeEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resumeId } = useParams();
  const { getToken, user } = useContext(UserContext);
  const showSnackbar = useSnackbar();
  const previewRef = useRef(null);
  const contentWrapRef = useRef(null);
  const previewPanelRef = useRef(null);
  const [panelWidth, setPanelWidth] = useState(650);

  const [splitPct, setSplitPct] = useState(35);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const container = containerRef.current;
    const onMouseMove = (ev) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(Math.max(pct, 20), 70));
    };
    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const [resumeName, setResumeName] = useState(() => {
    if (location.state?.fileName) return location.state.fileName.replace(/\.[^/.]+$/, '');
    return 'My Resume';
  });
  const [resumeExt, setResumeExt] = useState(() => {
    const name = location.state?.fileName || '';
    return name.match(/\.[^/.]+$/)?.[0]?.toLowerCase() || '.docx';
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [format, setFormat] = useState({ margins: 40, lineSpacing: 1.3 });
  const [bulletStyle, setBulletStyle] = useState('dash');
  const [loadingResume, setLoadingResume] = useState(!!resumeId);
  const [fitToOnePage, setFitToOnePage] = useState(true);
  const [fitFontScale, setFitFontScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(PAPER_HEIGHT);

  const hasResume = location.state?.resume || resumeId;

  const [resume, setResume] = useState(() => {
    if (resumeId) return null;
    const r = location.state?.resume || null;
    return r ? initFromLLM(r) : null;
  });
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_ORDER);
  const [collapsed, setCollapsed] = useState(() =>
    Object.fromEntries(DEFAULT_SECTION_ORDER.map((k) => [k, true]))
  );

  useEffect(() => {
    if (!hasResume) { navigate('/resumes', { replace: true }); return; }
    if (!resumeId) return;
    if (!user) return;
    const fetchAndParse = async () => {
      try {
        const token = await getToken();
        const { data } = await axios.post(
          `${BACKEND_URL}/resumes/${resumeId}/parse`, {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const loaded = initFromLLM(data.parsed_resume);
        setResume(loaded);
        const savedOrder = data.parsed_resume?.sectionOrder;
        if (Array.isArray(savedOrder) && savedOrder.length > 0) {
          setSectionOrder(savedOrder);
          setCollapsed((c) => {
            const next = { ...c };
            savedOrder.forEach((k) => { if (!(k in next)) next[k] = true; });
            return next;
          });
        }
        if (data.file_name) {
          setResumeName(data.file_name.replace(/\.[^/.]+$/, ''));
          setResumeExt(data.file_name.match(/\.[^/.]+$/)?.[0]?.toLowerCase() || '.docx');
        }
        if (data.parsed_resume?.format) setFormat(data.parsed_resume.format);
        if (data.parsed_resume?.bulletStyle) setBulletStyle(data.parsed_resume.bulletStyle);
        if (data.parsed_resume?.fitToOnePage !== undefined) setFitToOnePage(data.parsed_resume.fitToOnePage);
      } catch (err) {
        console.error('Failed to load resume for editor:', err);
        showSnackbar('Could not load this resume. It may have been deleted.', 'error');
        navigate('/resumes', { replace: true });
      } finally {
        setLoadingResume(false);
      }
    };
    fetchAndParse();
  }, [resumeId, user]);

  useEffect(() => {
    if (!contentWrapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (contentWrapRef.current) setContentHeight(contentWrapRef.current.scrollHeight);
    });
    ro.observe(contentWrapRef.current);
    return () => ro.disconnect();
  }, [loadingResume]);

  useEffect(() => {
    if (!previewPanelRef.current) return;
    const ro = new ResizeObserver(() => {
      if (previewPanelRef.current) setPanelWidth(previewPanelRef.current.clientWidth);
    });
    ro.observe(previewPanelRef.current);
    return () => ro.disconnect();
  }, [loadingResume]);

  useLayoutEffect(() => {
    if (!contentWrapRef.current || !fitToOnePage) { setFitFontScale(1); return; }
    const el = contentWrapRef.current;
    el.style.zoom = '';
    const h = el.scrollHeight;
    setFitFontScale(Math.max(0.5, Math.min(1.5, PAPER_HEIGHT / h)));
  }, [fitToOnePage, resume, format, loadingResume]);

  const panelScale = panelWidth / PAPER_WIDTH;
  const numPages = fitToOnePage ? 1 : Math.ceil(contentHeight / PAPER_HEIGHT);
  const outerHeight = numPages * PAPER_HEIGHT * panelScale;

  // ── State helpers ──────────────────────────────────────────────────
  const set = (field, value) => setResume((r) => ({ ...r, [field]: value }));
  const setContact = (key, value) => setResume((r) => ({ ...r, contact: { ...r.contact, [key]: value } }));
  const addContactField = () => setResume((r) => ({ ...r, contactExtra: [...(r.contactExtra || []), { id: newId(), label: '', value: '' }] }));
  const updateContactExtra = (id, key, val) => setResume((r) => ({ ...r, contactExtra: r.contactExtra.map((f) => (f.id === id ? { ...f, [key]: val } : f)) }));
  const removeContactExtra = (id) => setResume((r) => ({ ...r, contactExtra: r.contactExtra.filter((f) => f.id !== id) }));

  const addEntry = (field, blank) => set(field, [...resume[field], { id: newId(), ...blank }]);
  const removeEntry = (field, id) => set(field, resume[field].filter((e) => e.id !== id));
  const updateEntry = (field, id, key, value) => set(field, resume[field].map((e) => (e.id === id ? { ...e, [key]: value } : e)));
  const updateBullets = (field, id, bullets) => updateEntry(field, id, 'bullets', bullets);

  // ── Custom section helpers ─────────────────────────────────────────
  const addCustomSection = () => {
    const id = newId();
    setResume((r) => ({ ...r, customSections: [...(r.customSections || []), { id, title: '', description: '' }] }));
    setSectionOrder((o) => [...o, id]);
    setCollapsed((c) => ({ ...c, [id]: false }));
  };
  const removeCustomSection = (id) => {
    setResume((r) => ({ ...r, customSections: (r.customSections || []).filter((cs) => cs.id !== id) }));
    setSectionOrder((o) => o.filter((k) => k !== id));
    setCollapsed((c) => { const next = { ...c }; delete next[id]; return next; });
  };
  const updateCustomSection = (id, key, val) =>
    setResume((r) => ({ ...r, customSections: (r.customSections || []).map((cs) => (cs.id === id ? { ...cs, [key]: val } : cs)) }));

  // ── Section order helpers ──────────────────────────────────────────
  const moveSection = (key, dir) => {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(key);
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };
  const toggleCollapsed = (key) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportPdf(resume, {
        sectionOrder,
        scale: 1,
        filename: resumeName || resume.contact.name || 'resume',
        format,
        bulletStyle,
        fitToOnePage,
      });
    } catch (err) {
      console.error('PDF export error:', err);
      showSnackbar('Failed to export PDF. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      await exportDocx(resume, {
        sectionOrder,
        scale: fitToOnePage ? Math.min(fitFontScale, 1.05) : 1,
        filename: resumeName || resume.contact.name || 'resume',
        format,
      });
    } catch (err) {
      console.error('DOCX export error:', err);
      showSnackbar('Failed to export DOCX. Please try again.', 'error');
    } finally {
      setExportingDocx(false);
    }
  };

  const handleSaveToResumes = async () => {
    if (!resumeId) {
      showSnackbar('No resume linked. Use Export to download your changes.', 'error');
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const parsedForSave = {
        ...resume,
        sectionOrder,
        format,
        bulletStyle,
        fitToOnePage,
        skills: rowsToSkills(resume.skills),
        projects: resume.projects.map((p) => ({
          ...p,
          tech: p.tech ? p.tech.split(',').map((s) => s.trim()).filter(Boolean) : [],
        })),
      };
      await axios.patch(
        `${BACKEND_URL}/resumes/${resumeId}`,
        { parsed_resume: parsedForSave, file_name: resumeName + resumeExt },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSnackbar('Saved changes', 'success');
      localStorage.setItem('resumeJustEdited', resumeId);
    } catch (err) {
      console.error('Save error:', err);
      showSnackbar(err.response?.data?.error || 'Failed to save resume. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Form section renderer ──────────────────────────────────────────
  const allContacts = [
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' }, { key: 'linkedin', label: 'LinkedIn' },
    { key: 'github', label: 'GitHub' }, { key: 'location', label: 'Location' },
  ];

  const renderFormSection = (key, idx) => {
    const canMoveUp = idx > 0;
    const canMoveDown = idx < sectionOrder.length - 1;
    const isCollapsed = collapsed[key] ?? true;
    const props = {
      key,
      collapsed: isCollapsed,
      onToggle: () => toggleCollapsed(key),
      onMoveUp: () => moveSection(key, -1),
      onMoveDown: () => moveSection(key, 1),
      canMoveUp,
      canMoveDown,
    };

    if (key === 'contact') return (
      <FormSection {...props} title="Contact Info">
        {allContacts.map(({ key: k, label }) => (
          <div className="field-row" key={k}>
            <span className="field-label">{label}</span>
            <input className="editor-input" value={resume.contact[k] || ''} onChange={(e) => setContact(k, e.target.value)} placeholder={label} />
          </div>
        ))}
        {(resume.contactExtra || []).map((f) => (
          <ContactField key={f.id} label={f.label} value={f.value} removable onChange={(k, v) => updateContactExtra(f.id, k, v)} onRemove={() => removeContactExtra(f.id)} />
        ))}
        <button className="add-bullet-btn" onClick={addContactField}>+ Add field</button>
      </FormSection>
    );

    if (key === 'summary') return (
      <FormSection {...props} title="Professional Summary">
        <textarea className="editor-input" value={resume.summary} onChange={(e) => set('summary', e.target.value)} rows={4} placeholder="Write a brief professional summary..." />
      </FormSection>
    );

    if (key === 'experience') return (
      <FormSection {...props} title="Work Experience">
        {resume.experience.map((exp) => (
          <SectionCard key={exp.id} title={exp.company || 'New Entry'} onRemove={() => removeEntry('experience', exp.id)}>
            <div className="field-row"><span className="field-label">Company</span><input className="editor-input" value={exp.company} onChange={(e) => updateEntry('experience', exp.id, 'company', e.target.value)} placeholder="Company" /></div>
            <div className="field-row"><span className="field-label">Role</span><input className="editor-input" value={exp.title} onChange={(e) => updateEntry('experience', exp.id, 'title', e.target.value)} placeholder="Job Title" /></div>
            <div className="field-row"><span className="field-label">Location</span><input className="editor-input" value={exp.location} onChange={(e) => updateEntry('experience', exp.id, 'location', e.target.value)} placeholder="City, ST" /></div>
            <div className="dates-row">
              <input className="editor-input" value={exp.start} onChange={(e) => updateEntry('experience', exp.id, 'start', e.target.value)} placeholder="Start" />
              <span>–</span>
              <input className="editor-input" value={exp.end} onChange={(e) => updateEntry('experience', exp.id, 'end', e.target.value)} placeholder="End / Present" />
            </div>
            <BulletList bullets={exp.bullets} onChange={(b) => updateBullets('experience', exp.id, b)} />
          </SectionCard>
        ))}
        <button className="add-section-btn" onClick={() => addEntry('experience', { company: '', title: '', location: '', start: '', end: '', bullets: [] })}>
          <Add fontSize="small" /> Add Experience
        </button>
      </FormSection>
    );

    if (key === 'education') return (
      <FormSection {...props} title="Education">
        {resume.education.map((edu) => (
          <SectionCard key={edu.id} title={edu.institution || 'New Entry'} onRemove={() => removeEntry('education', edu.id)}>
            <div className="field-row"><span className="field-label">School</span><input className="editor-input" value={edu.institution} onChange={(e) => updateEntry('education', edu.id, 'institution', e.target.value)} placeholder="University Name" /></div>
            <div className="field-row"><span className="field-label">Degree</span><input className="editor-input" value={edu.degree} onChange={(e) => updateEntry('education', edu.id, 'degree', e.target.value)} placeholder="B.S. / M.S. / Ph.D." /></div>
            <div className="field-row"><span className="field-label">Field</span><input className="editor-input" value={edu.field} onChange={(e) => updateEntry('education', edu.id, 'field', e.target.value)} placeholder="Computer Science" /></div>
            <div className="dates-row">
              <input className="editor-input" value={edu.start} onChange={(e) => updateEntry('education', edu.id, 'start', e.target.value)} placeholder="Start" />
              <span>–</span>
              <input className="editor-input" value={edu.end} onChange={(e) => updateEntry('education', edu.id, 'end', e.target.value)} placeholder="End" />
            </div>
            <div className="field-row"><span className="field-label">GPA</span><input className="editor-input" value={edu.gpa} onChange={(e) => updateEntry('education', edu.id, 'gpa', e.target.value)} placeholder="3.9" /></div>
          </SectionCard>
        ))}
        <button className="add-section-btn" onClick={() => addEntry('education', { institution: '', degree: '', field: '', start: '', end: '', gpa: '' })}>
          <Add fontSize="small" /> Add Education
        </button>
      </FormSection>
    );

    if (key === 'skills') return (
      <FormSection {...props} title="Technical Skills">
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
      </FormSection>
    );

    if (key === 'projects') return (
      <FormSection {...props} title="Projects">
        {resume.projects.map((proj) => (
          <SectionCard key={proj.id} title={proj.name || 'New Entry'} onRemove={() => removeEntry('projects', proj.id)}>
            <div className="field-row"><span className="field-label">Name</span><input className="editor-input" value={proj.name} onChange={(e) => updateEntry('projects', proj.id, 'name', e.target.value)} placeholder="Project Name" /></div>
            <div className="field-row"><span className="field-label">Tech</span><input className="editor-input" value={proj.tech} onChange={(e) => updateEntry('projects', proj.id, 'tech', e.target.value)} placeholder="React, Node.js, ..." /></div>
            <div className="dates-row">
              <input className="editor-input" value={proj.start} onChange={(e) => updateEntry('projects', proj.id, 'start', e.target.value)} placeholder="Start" />
              <span>–</span>
              <input className="editor-input" value={proj.end} onChange={(e) => updateEntry('projects', proj.id, 'end', e.target.value)} placeholder="End" />
            </div>
            <BulletList bullets={proj.bullets} onChange={(b) => updateBullets('projects', proj.id, b)} />
          </SectionCard>
        ))}
        <button className="add-section-btn" onClick={() => addEntry('projects', { name: '', tech: '', start: '', end: '', bullets: [] })}>
          <Add fontSize="small" /> Add Project
        </button>
      </FormSection>
    );

    if (key === 'certifications') return (
      <FormSection {...props} title="Certifications">
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
      </FormSection>
    );

    if (key === 'honors_awards') return (
      <FormSection {...props} title="Honors & Awards">
        {resume.honors_awards.map((award) => (
          <SectionCard key={award.id} title={award.title || 'New Entry'} onRemove={() => removeEntry('honors_awards', award.id)}>
            <div className="field-row"><span className="field-label">Title</span><input className="editor-input" value={award.title} onChange={(e) => updateEntry('honors_awards', award.id, 'title', e.target.value)} placeholder="Award Name" /></div>
            <div className="field-row"><span className="field-label">Issuer</span><input className="editor-input" value={award.issuer} onChange={(e) => updateEntry('honors_awards', award.id, 'issuer', e.target.value)} placeholder="Organization" /></div>
            <div className="field-row"><span className="field-label">Date</span><input className="editor-input" value={award.date} onChange={(e) => updateEntry('honors_awards', award.id, 'date', e.target.value)} placeholder="Mon YYYY" /></div>
          </SectionCard>
        ))}
        <button className="add-section-btn" onClick={() => addEntry('honors_awards', { title: '', issuer: '', date: '' })}>
          <Add fontSize="small" /> Add Honor / Award
        </button>
      </FormSection>
    );

    // Custom section
    const cs = (resume.customSections || []).find((c) => c.id === key);
    if (!cs) return null;
    return (
      <FormSection {...props} title={cs.title || 'Custom Section'} onRemove={() => removeCustomSection(key)}>
        <div className="field-row">
          <span className="field-label">Title</span>
          <input className="editor-input" value={cs.title} onChange={(e) => updateCustomSection(key, 'title', e.target.value)} placeholder="Section Title" />
        </div>
        <textarea className="editor-input" value={cs.description} onChange={(e) => updateCustomSection(key, 'description', e.target.value)} rows={4} placeholder="Section content..." style={{ marginTop: 8 }} />
      </FormSection>
    );
  };

  // ── Preview section renderer ───────────────────────────────────────
  const renderPreviewSection = (key) => {
    if (key === 'contact') return (
      <div key="contact" className="rp-header">
        <div className="rp-name">{resume.contact.name || 'Your Name'}</div>
        <div className="rp-contact-row">
          {[
            resume.contact.phone, resume.contact.email, resume.contact.linkedin,
            resume.contact.github, resume.contact.location,
            ...((resume.contactExtra || []).filter((f) => f.value).map((f) => f.value)),
          ].filter(Boolean).join(' | ')}
        </div>
      </div>
    );

    if (key === 'summary') return resume.summary ? (
      <div key="summary" className="rp-summary-block">{resume.summary}</div>
    ) : null;

    if (key === 'education' && resume.education.length > 0) return (
      <div key="education" className="rp-section">
        <div className="rp-section-title">Education</div>
        {resume.education.map((edu) => (
          <div key={edu.id} className="rp-entry">
            <div className="rp-entry-header"><span className="rp-entry-main">{edu.institution}</span></div>
            <div className="rp-entry-sub-row">
              <span className="rp-entry-sub">{[edu.degree, edu.field].filter(Boolean).join(' in ')}</span>
              <span className="rp-entry-sub">{[edu.start, edu.end].filter(Boolean).join(' – ')}</span>
            </div>
            {edu.gpa && <div className="rp-entry-sub">GPA: {edu.gpa}</div>}
          </div>
        ))}
      </div>
    );

    if (key === 'experience' && resume.experience.length > 0) return (
      <div key="experience" className="rp-section">
        <div className="rp-section-title">Experience</div>
        {resume.experience.map((exp) => (
          <div key={exp.id} className="rp-entry">
            <div className="rp-entry-header">
              <span className="rp-entry-main">{exp.company}</span>
              <span className="rp-entry-dates">{[exp.location, [exp.start, exp.end].filter(Boolean).join(' – ')].filter(Boolean).join(' | ')}</span>
            </div>
            {exp.title && <div className="rp-entry-sub">{exp.title}</div>}
            {exp.bullets.length > 0 && <ul className={`rp-bullets${bulletStyle === 'dot' ? ' dot' : ''}`}>{exp.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>}
          </div>
        ))}
      </div>
    );

    if (key === 'projects' && resume.projects.length > 0) return (
      <div key="projects" className="rp-section">
        <div className="rp-section-title">Projects</div>
        {resume.projects.map((proj) => (
          <div key={proj.id} className="rp-entry">
            <div className="rp-entry-header">
              <span className="rp-entry-main">{proj.name}{proj.tech ? <span className="rp-entry-sub"> | {proj.tech}</span> : ''}</span>
              <span className="rp-entry-dates">{[proj.start, proj.end].filter(Boolean).join(' – ')}</span>
            </div>
            {proj.bullets.length > 0 && <ul className={`rp-bullets${bulletStyle === 'dot' ? ' dot' : ''}`}>{proj.bullets.filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul>}
          </div>
        ))}
      </div>
    );

    if (key === 'skills' && resume.skills.length > 0) return (
      <div key="skills" className="rp-section">
        <div className="rp-section-title">Technical Skills</div>
        {resume.skills.map((sk) => (
          <div key={sk.id} className="rp-skill-row">
            {sk.category && <span className="rp-skill-cat">{sk.category}: </span>}
            <span>{sk.items}</span>
          </div>
        ))}
      </div>
    );

    if (key === 'certifications' && resume.certifications.length > 0) return (
      <div key="certifications" className="rp-section">
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
    );

    if (key === 'honors_awards' && resume.honors_awards.length > 0) return (
      <div key="honors_awards" className="rp-section">
        <div className="rp-section-title">Honors &amp; Awards</div>
        <div className="rp-honors-block">
          {resume.honors_awards.map((award, i) => (
            <span key={award.id}>
              {i > 0 && ' • '}
              {award.title}
              {award.issuer ? `, ${award.issuer}` : ''}
              {award.date ? ` (${award.date})` : ''}
            </span>
          ))}
        </div>
      </div>
    );

    // Custom section
    const cs = (resume.customSections || []).find((c) => c.id === key);
    if (cs && (cs.title || cs.description)) return (
      <div key={key} className="rp-section">
        {cs.title && <div className="rp-section-title">{cs.title}</div>}
        {cs.description && <div className="rp-summary-block" style={{ textAlign: 'left', paddingLeft: 8 }}>{cs.description}</div>}
      </div>
    );

    return null;
  };

  if (!hasResume) return <Navigate to="/resumes" replace />;

  if (loadingResume || resume === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <CircularProgress />
        <span style={{ color: '#6b7280' }}>Loading resume...</span>
      </div>
    );
  }

  return (
    <div className="editor-page" ref={containerRef}>
      {/* LEFT: FORM */}
      <div className="editor-form" style={{ width: `${splitPct}%` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input
            className="editor-input"
            style={{ fontSize: 16, fontWeight: 600, flexGrow: 1 }}
            value={resumeName}
            onChange={(e) => setResumeName(e.target.value)}
            placeholder="Resume name"
          />
        </div>
        {sectionOrder.map((key, idx) => renderFormSection(key, idx))}

        <button className="add-section-btn" style={{ marginBottom: 8 }} onClick={addCustomSection}>
          <Add fontSize="small" /> Add Custom Section
        </button>

        <div className="editor-actions">
          <Button variant="outlined" onClick={handleExportPdf} disabled={exporting} className="btn-export">
            {exporting ? <CircularProgress size={18} /> : 'Export PDF'}
          </Button>
          <Button variant="outlined" onClick={handleExportDocx} disabled={exportingDocx} className="btn-export">
            {exportingDocx ? <CircularProgress size={18} /> : 'Export DOCX'}
          </Button>
          <Button variant="contained" onClick={handleSaveToResumes} disabled={saving} className="btn-analyze">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* DRAG DIVIDER */}
      <div
        className={`editor-divider${isDragging ? ' dragging' : ''}`}
        onMouseDown={handleDividerMouseDown}
      />

      {/* RIGHT: PREVIEW */}
      <div className="editor-preview-panel" ref={previewPanelRef}>
        <div className="preview-toolbar-row">
          <span className="preview-label" style={{ marginBottom: 0 }}>Live Preview</span>
          <button className="fit-page-btn" onClick={() => setFitToOnePage((v) => !v)}>
            {fitToOnePage ? 'Default' : 'Fit to Page'}
          </button>
        </div>

        <div className="format-toolbar">
          <div className="format-row">
            <span className="format-label">Margins</span>
            <span className="format-hint">Narrow</span>
            <input type="range" min={16} max={48} step={4} value={format.margins} onChange={(e) => setFormat((f) => ({ ...f, margins: Number(e.target.value) }))} className="format-slider" />
            <span className="format-hint">Wide</span>
          </div>
          <div className="format-row">
            <span className="format-label">Spacing</span>
            <span className="format-hint">Tight</span>
            <input type="range" min={1.2} max={2.0} step={0.1} value={format.lineSpacing} onChange={(e) => setFormat((f) => ({ ...f, lineSpacing: Number(e.target.value) }))} className="format-slider" />
            <span className="format-hint">Loose</span>
          </div>
          <div className="format-row">
            <button
              className="bullet-style-toggle"
              onClick={() => setBulletStyle((s) => s === 'dash' ? 'dot' : 'dash')}
            >
              {bulletStyle === 'dash' ? '• Bullet' : '– Dash'}
            </button>
          </div>
        </div>

        <div className="rp-page-outer" style={{ height: outerHeight, width: panelWidth }}>
          {!fitToOnePage && Array.from({ length: numPages - 1 }, (_, i) => (
            <div key={i} className="rp-page-break" style={{ top: (i + 1) * PAPER_HEIGHT * panelScale }} />
          ))}
          <div
            className="resume-preview"
            ref={previewRef}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: PAPER_WIDTH,
              minHeight: numPages * PAPER_HEIGHT,
              transform: `scale(${panelScale})`,
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
              {sectionOrder.map((key) => renderPreviewSection(key))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
