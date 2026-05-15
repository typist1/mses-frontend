import React, { useState, useRef, useEffect, useContext } from 'react';
import mammoth from 'mammoth';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Button, Container, TextField, Tooltip, IconButton, CircularProgress,
  Collapse, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  List, ListItem, ListItemButton, ListItemText,
} from '@mui/material';
import {
  CloudUpload, Clear, Link as LinkIcon, ExpandMore, ExpandLess,
  CheckCircle, Cancel, FolderOpen, InfoOutlined,
} from '@mui/icons-material';
import help_outline from '../../assets/help_outline.svg';
import { COURSES } from '../../assets/MSESCoursesFull.js';
import { buildDocx, Packer } from '../../utils/buildDocx.js';
import { exportPdf, exportDocx } from '../../common/functions/exportFile.js';
import '../../App.css';
import { UserContext } from '@/common/contexts/UserContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const ANALYSIS_CACHE_KEY = 'mses_analysis_cache';

const COURSE_MAP = Object.fromEntries(COURSES.map((c) => [c.c, c]));

function fitLabel(score) {
  return {
    1: 'Not Found',
    2: 'Related / Transferable Experience',
    3: 'Explicitly Demonstrated',
    4: 'Demonstrated with Measurable Impact',
  }[score] || '';
}

function fitRowColor(score) {
  if (score <= 1) return '#fef2f2';
  if (score === 2) return '#fffbeb';
  return '#f0fdf4';
}

function applyChangeLog(parsedResume, changeLog, accepted) {
  const merged = JSON.parse(JSON.stringify(parsedResume));
  (changeLog || []).forEach((entry, i) => {
    if (accepted[i] !== false) {
      if (entry.section === 'summary') {
        merged.summary = entry.rewritten;
      } else if (entry.section === 'experience') {
        for (const exp of merged.experience || []) {
          const idx = (exp.bullets || []).indexOf(entry.original);
          if (idx !== -1) { exp.bullets[idx] = entry.rewritten; break; }
        }
      } else if (entry.section === 'projects') {
        for (const proj of merged.projects || []) {
          const idx = (proj.bullets || []).indexOf(entry.original);
          if (idx !== -1) { proj.bullets[idx] = entry.rewritten; break; }
        }
      } else if (entry.section === 'skills' && entry.original === '') {
        const cat = entry.field;
        if (merged.skills?.[cat] && !merged.skills[cat].includes(entry.rewritten)) {
          merged.skills[cat].push(entry.rewritten);
        }
      }
    }
  });
  return merged;
}

function toEditorSchema(resume) {
  return {
    contact: {
      name: resume.contact?.name || '',
      email: resume.contact?.email || '',
      phone: resume.contact?.phone || '',
      linkedin: resume.contact?.linkedin || '',
      location: resume.contact?.location || '',
      github: resume.contact?.github || '',
    },
    contactExtra: [],
    summary: resume.summary || '',
    experience: (resume.experience || []).map((exp, i) => ({
      id: `exp-${i}`, company: exp.company || '', role: exp.title || '',
      location: exp.location || '', startDate: exp.start || '', endDate: exp.end || '',
      bullets: exp.bullets || [],
    })),
    education: (resume.education || []).map((edu, i) => ({
      id: `edu-${i}`, school: edu.institution || '', degree: edu.degree || '',
      field: edu.field || '', startDate: edu.start || '', endDate: edu.end || '',
      gpa: edu.gpa || '',
    })),
    skills: [
      ...(resume.skills?.technical?.length ? [{ id: 'sk-tech', category: 'Technical', items: resume.skills.technical.join(', ') }] : []),
      ...(resume.skills?.tools?.length ? [{ id: 'sk-tools', category: 'Tools', items: resume.skills.tools.join(', ') }] : []),
      ...(resume.skills?.languages?.length ? [{ id: 'sk-lang', category: 'Languages', items: resume.skills.languages.join(', ') }] : []),
      ...(resume.skills?.soft?.length ? [{ id: 'sk-soft', category: 'Soft Skills', items: resume.skills.soft.join(', ') }] : []),
    ],
    projects: (resume.projects || []).map((proj, i) => ({
      id: `proj-${i}`, name: proj.name || '',
      tech: Array.isArray(proj.tech) ? proj.tech.join(', ') : (proj.tech || ''),
      startDate: '', endDate: '', bullets: proj.bullets || [],
    })),
    certifications: (resume.certifications || []).map((cert, i) => ({
      id: `cert-${i}`, name: cert.name || '', issuer: cert.issuer || '', date: cert.date || '',
    })),
    honorsAwards: (resume.honors_awards || []).map((ha, i) => ({
      id: `ha-${i}`, title: ha.title || '', issuer: ha.issuer || '', date: ha.date || '', description: '',
    })),
  };
}

const PHASES = [
  'Validating resume...',
  'Analyzing job description...',
  'Parsing resume...',
  'Running gap analysis...',
  'Optimizing resume...',
  'Finalizing results...',
];

function SkillsTable({ skills }) {
  const [expandedCourse, setExpandedCourse] = useState(null);

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell><strong>Skill</strong></TableCell>
          <TableCell><strong>Importance</strong></TableCell>
          <TableCell><strong>Fit</strong></TableCell>
          <TableCell><strong>Gap Description</strong></TableCell>
          <TableCell><strong>Recommended Actions</strong></TableCell>
          <TableCell><strong>Recommended Courses</strong></TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {(skills || []).map((s, i) => (
          <React.Fragment key={i}>
            <TableRow style={{ backgroundColor: fitRowColor(s.fit_score) }}>
              <TableCell>{s.skill}</TableCell>
              <TableCell>
                <Chip
                  label={s.importance === 0 ? 'Required' : 'Preferred'}
                  size="small"
                  color={s.importance === 0 ? 'error' : 'default'}
                />
              </TableCell>
              <TableCell>
                <Chip label={`${s.fit_score}`} size="small" />
              </TableCell>
              <TableCell style={{ fontSize: 12 }}>{s.gap_keywords || '—'}</TableCell>
              <TableCell style={{ fontSize: 12 }}>{s.recommended_actions || '—'}</TableCell>
              <TableCell>
                {(s.suggested_courses || []).map((sc) => (
                  <Chip
                    key={sc.course_code}
                    label={sc.course_code}
                    size="small"
                    style={{ margin: 2, cursor: COURSE_MAP[sc.course_code] ? 'pointer' : 'default' }}
                    onClick={() => setExpandedCourse(expandedCourse === `${i}-${sc.course_code}` ? null : `${i}-${sc.course_code}`)}
                  />
                ))}
              </TableCell>
            </TableRow>
            {(s.suggested_courses || []).map((sc) => {
              const course = COURSE_MAP[sc.course_code];
              if (!course || expandedCourse !== `${i}-${sc.course_code}`) return null;
              return (
                <TableRow key={`detail-${sc.course_code}`} style={{ backgroundColor: '#f8fafc' }}>
                  <TableCell colSpan={6} style={{ padding: '12px 16px' }}>
                    <strong>{course.c} — {course.t}</strong> ({course.q})<br />
                    <em style={{ fontSize: 13, color: '#555' }}>{course.s}</em><br />
                    <span style={{ fontSize: 12, color: '#666' }}>
                      <strong>Keywords:</strong> {(course.k || []).join(', ')}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

function ChangeLogPanel({ changeLog, accepted, onToggle, readOnly }) {
  const [expanded, setExpanded] = useState({});

  return (
    <div>
      {(changeLog || []).map((entry, i) => (
        <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', backgroundColor: '#f9fafb' }}
            onClick={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
          >
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
              [{entry.section}] {entry.field}
            </span>
            {!readOnly && (
              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                <Chip
                  label="Accept"
                  size="small"
                  color={accepted[i] !== false ? 'success' : 'default'}
                  onClick={() => onToggle(i, true)}
                  icon={<CheckCircle style={{ fontSize: 14 }} />}
                />
                <Chip
                  label="Reject"
                  size="small"
                  color={accepted[i] === false ? 'error' : 'default'}
                  onClick={() => onToggle(i, false)}
                  icon={<Cancel style={{ fontSize: 14 }} />}
                />
              </div>
            )}
            {expanded[i] ? <ExpandLess /> : <ExpandMore />}
          </div>
          <Collapse in={!!expanded[i]}>
            <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4 }}>ORIGINAL</div>
                <div style={{ fontSize: 13, color: '#374151', background: '#fef2f2', padding: 8, borderRadius: 4 }}>
                  {entry.original || '(none)'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4 }}>REWRITTEN</div>
                <div style={{ fontSize: 13, color: '#374151', background: '#f0fdf4', padding: 8, borderRadius: 4 }}>
                  {entry.rewritten}
                </div>
              </div>
              <div style={{ gridColumn: '1/-1', fontSize: 12, color: '#6b7280' }}>
                <strong>Reason:</strong> {entry.reason}
              </div>
            </div>
          </Collapse>
        </div>
      ))}
    </div>
  );
}

function AnalysisResults({ analysis, fileContent, changeLogAccepted, onToggle, readOnly }) {
  const { overall_fit_score, score_breakdown, gap_analysis, change_log, flags } = analysis;
  const skills = gap_analysis?.skills || [];
  const hasFlags = flags?.truncated_resume || flags?.sparse_jd;

  return (
    <div>
      {/* Score */}
      <div className="section score-section" style={{ position: 'relative' }}>
        <Tooltip title="Match score is calculated by a combination of the skills and the degree to which they are present" arrow placement="left">
          <IconButton size="small" style={{ position: 'absolute', top: 8, right: 8, padding: 2 }}>
            <InfoOutlined style={{ fontSize: 16, color: '#9ca3af' }} />
          </IconButton>
        </Tooltip>
        <div className="score-content">
          <div className="score-circle" style={{
            background: `conic-gradient(${overall_fit_score >= 70 ? '#10b981' : '#f59e0b'} ${overall_fit_score * 3.6}deg, #e5e7eb 0deg)`
          }}>
            <div className="score-inner">
              <div className="score-number">{overall_fit_score}%</div>
              <div className="score-label">Match</div>
            </div>
          </div>
          <div className="score-message">
            <div>{overall_fit_score >= 70 ? 'Your resume is a good match for this position' : 'Your resume could be improved to better match this job'}</div>
            {score_breakdown && <div style={{ marginTop: 6, fontSize: 14, color: '#6b7280' }}>{score_breakdown}</div>}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {hasFlags && (
        <div className="section">
          <Alert severity="warning" style={{ marginBottom: 8 }}>
            {flags.truncated_resume && <div>Resume was very long; only the first 15,000 characters were analyzed.</div>}
            {flags.sparse_jd && <div>This job description appears sparse. The analysis may be lower quality.</div>}
          </Alert>
        </div>
      )}

      {/* Skills Table */}
      <div className="section">
        <div className="section-header">
          <h3>Skills Gap Analysis</h3>
          <p>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#fef2f2', border: '1px solid #fca5a5', marginRight: 4 }} />Not Found (1)
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#fffbeb', border: '1px solid #fde68a', margin: '0 4px 0 12px' }} />Related / Transferable Experience(2)
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#f0fdf4', border: '1px solid #6ee7b7', margin: '0 4px 0 12px' }} />Explicitly Demonstrated (3) with Measurable Impact (4)
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <SkillsTable skills={skills} />
        </div>
      </div>

      {/* Change Log */}
      {change_log?.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h3>Resume Changes</h3>
            {!readOnly && <p>Review and accept or reject each suggested change before using the optimized resume.</p>}
          </div>
          <ChangeLogPanel
            changeLog={change_log}
            accepted={changeLogAccepted}
            onToggle={onToggle}
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  );
}

function App() {
  const { user, getToken } = useContext(UserContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const userInteractedRef = useRef(false);

  // Resume upload states
  const [fileUpload, setFileUpload] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [inputMode, setInputMode] = useState(null); // null | 'upload' | 'paste'
  const [activeResumeId, setActiveResumeId] = useState(null);
  const [activeResumeFileName, setActiveResumeFileName] = useState(null);

  // Stored resume picker
  const [storedResumesOpen, setStoredResumesOpen] = useState(false);
  const [storedResumes, setStoredResumes] = useState([]);
  const [storedResumesLoading, setStoredResumesLoading] = useState(false);

  // Job description states
  const [jobURL, setJobURL] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobLoading, setJobLoading] = useState(false);

  // Analysis states
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizePhase, setOptimizePhase] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [changeLogAccepted, setChangeLogAccepted] = useState({});

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveResumeFileName, setSaveResumeFileName] = useState('');
  const [savingResume, setSavingResume] = useState(false);
  const [analysisSaved, setAnalysisSaved] = useState(false);
  const [savedResumeId, setSavedResumeId] = useState(null);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(ANALYSIS_CACHE_KEY));
      if (cached?.analysisResult) {
        setAnalysisResult(cached.analysisResult);
        setChangeLogAccepted(cached.changeLogAccepted || {});
        setAnalysisSaved(cached.analysisSaved || false);
        setSavedResumeId(cached.savedResumeId || null);
      }
    } catch {}
  }, []);

  const handleClear = () => {
    if (filePreview && fileType === 'pdf') URL.revokeObjectURL(filePreview);
    setFileType(null);
    setFileUpload(null);
    setFilePreview('');
    setFileContent('');
    setInputMode(null);
    setJobURL('');
    setJobDescription('');
    setJobLoading(false);
    setAnalysisResult(null);
    setChangeLogAccepted({});
    setAnalysisSaved(false);
    setSavedResumeId(null);
    localStorage.removeItem(ANALYSIS_CACHE_KEY);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (file) => {
    if (filePreview && fileType === 'pdf') URL.revokeObjectURL(filePreview);
    setFileUpload(file);
    if (file.type === 'application/pdf') {
      setFileType('pdf');
      setFilePreview(URL.createObjectURL(file));
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setFileType('docx');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setFilePreview(result.value);
    } else {
      alert('Please upload either a PDF or DOCX file');
      return;
    }
    handleExtractText(file);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    userInteractedRef.current = true;
    await processFile(file);
    setInputMode('upload');
    setActiveResumeId(null); // manual upload is not the saved resume; skip cache
  };

  useEffect(() => {
    if (!user) return;
    const autoPopulate = async () => {
      try {
        const token = await getToken();
        const { data } = await axios.get(`${BACKEND_URL}/resumes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const active = (data.resumes || []).find((r) => r.is_active);
        if (!active) return;
        if (userInteractedRef.current) return;
        setActiveResumeId(active.id);
        setActiveResumeFileName(active.file_name);
        const blobRes = await axios.get(`${BACKEND_URL}/resumes/${active.id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        });
        if (userInteractedRef.current) return;
        const mimeType = active.file_name.endsWith('.pdf')
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        await processFile(new File([blobRes.data], active.file_name, { type: mimeType }));
        setInputMode('upload');
      } catch (err) {
        console.error('Error auto-populating active resume:', err);
      }
    };
    autoPopulate();
  }, [user]);

  const handleOpenStoredResumes = async () => {
    setStoredResumesOpen(true);
    setStoredResumesLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.get(`${BACKEND_URL}/resumes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStoredResumes(data.resumes || []);
    } catch (err) {
      console.error('Error fetching resumes:', err);
    } finally {
      setStoredResumesLoading(false);
    }
  };

  const handleSelectStoredResume = async (resume) => {
    setStoredResumesOpen(false);
    userInteractedRef.current = true;
    try {
      const token = await getToken();
      const blobRes = await axios.get(`${BACKEND_URL}/resumes/${resume.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const mimeType = resume.file_name.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      await processFile(new File([blobRes.data], resume.file_name, { type: mimeType }));
      setInputMode('upload');
      setActiveResumeId(resume.id);
      setActiveResumeFileName(resume.file_name);
    } catch (err) {
      console.error('Error loading stored resume:', err);
      alert('Failed to load resume. Please try again.');
    }
  };

  const handleExtractText = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${BACKEND_URL}/file/extractText`, formData);
      setFileContent(res.data.text);
    } catch (err) {
      console.error('Error extracting text:', err);
    }
  };

  const isURLValid = () =>
    jobURL.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g) !== null;

  const handleFetchJobDescription = async () => {
    if (!isURLValid()) { alert('Please enter a valid URL'); return; }
    setJobLoading(true);
    setJobDescription('Loading...');
    try {
      const res = await axios.post(`${BACKEND_URL}/file/extractJobDescription`, { url: jobURL });
      setJobDescription(res.data.text || '');
      if (!res.data.text) alert('Error fetching job description. Please paste manually.');
    } catch {
      setJobDescription('');
      alert('Failed to fetch job description. Please paste it manually.');
    } finally {
      setJobLoading(false);
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setAnalysisResult(null);

    let phaseIdx = 0;
    setOptimizePhase(PHASES[0]);
    const timer = setInterval(() => {
      phaseIdx = Math.min(phaseIdx + 1, PHASES.length - 1);
      setOptimizePhase(PHASES[phaseIdx]);
    }, 10000);

    try {
      const token = await getToken();
      const { data } = await axios.post(
        `${BACKEND_URL}/analyze`,
        { resumeText: fileContent, jdText: jobDescription, resumeId: activeResumeId || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnalysisResult(data);
      const accepted = {};
      (data.change_log || []).forEach((_, i) => { accepted[i] = true; });
      setChangeLogAccepted(accepted);
      setAnalysisSaved(false);
      setSavedResumeId(null);
      try {
        localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify({ analysisResult: data, changeLogAccepted: accepted, analysisSaved: false, savedResumeId: null }));
      } catch {}
    } catch (err) {
      alert(err.response?.data?.error || 'Analysis failed. Please try again.');
    } finally {
      clearInterval(timer);
      setIsOptimizing(false);
    }
  };

  const handleToggleChange = (index, value) => {
    setChangeLogAccepted((prev) => {
      const next = { ...prev, [index]: value };
      try {
        const cached = JSON.parse(localStorage.getItem(ANALYSIS_CACHE_KEY));
        if (cached?.analysisResult) {
          localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify({ ...cached, changeLogAccepted: next }));
        }
      } catch {}
      return next;
    });
  };

  const handleExportExcel = () => {
    if (!analysisResult) return;
    const skills = analysisResult.gap_analysis?.skills || [];
    const summaryRows = [
      ['Overall Fit Score', `${analysisResult.overall_fit_score}%`],
      ['Job Title', analysisResult.job_title || ''],
      ['Company', analysisResult.company || ''],
      ['Score Breakdown', analysisResult.score_breakdown || ''],
      [],
      ['Fit Score Legend', ''],
      ['1', 'Not Found'],
      ['2', 'Related / Transferable Experience'],
      ['3', 'Explicitly Demonstrated'],
      ['4', 'Demonstrated with Measurable Impact'],
      [],
    ];
    const header = ['Skill', 'Importance', 'Fit Score', 'Fit Label', 'Gap Keywords', 'Recommended Actions', 'Recommended Courses'];
    const rows = skills.map((s) => [
      s.skill,
      s.importance === 0 ? 'Required' : 'Preferred',
      s.fit_score,
      fitLabel(s.fit_score),
      s.gap_keywords || '',
      s.recommended_actions || '',
      (s.suggested_courses || []).map((c) => c.course_code).join(', '),
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([...summaryRows, header, ...rows]);
    const clHeader = ['Section', 'Field', 'Original', 'Rewritten', 'Reason', 'Status'];
    const clRows = (analysisResult.change_log || []).map((e, i) => [
      e.section, e.field, e.original, e.rewritten, e.reason,
      changeLogAccepted[i] !== false ? 'Accepted' : 'Rejected',
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([clHeader, ...clRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Skills Analysis');
    XLSX.utils.book_append_sheet(wb, ws2, 'Change Log');
    XLSX.writeFile(wb, `resume-analysis-${Date.now()}.xlsx`);
  };

  const handleOpenInEditor = () => {
    if (!analysisResult) return;
    navigate(`/editor/${savedResumeId}`);
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildOptimizedEditorResume = (analysis, accepted) => {
    const merged = applyChangeLog(analysis.parsed_resume, analysis.change_log, accepted);
    return toEditorSchema(merged);
  };

  const getDisplayedEditorResume = () => {
    return buildOptimizedEditorResume(analysisResult, changeLogAccepted);
  };

  const handleExportPdf = async () => {
    if (!analysisResult) return;
    try {
      await exportPdf(getDisplayedEditorResume(), {
        filename: `${analysisResult.job_title || 'resume'}-optimized`,
        getToken,
        backendUrl: BACKEND_URL,
      });
    } catch {
      alert('Failed to export PDF. Please try again.');
    }
  };

  const handleExportDocx = async () => {
    if (!analysisResult) return;
    try {
      await exportDocx(getDisplayedEditorResume(), {
        filename: `${analysisResult.job_title || 'resume'}-optimized`,
      });
    } catch {
      alert('Failed to export DOCX. Please try again.');
    }
  };

  const handleSaveResume = async () => {
    if (!analysisResult) return;
    setSavingResume(true);
    try {
      const merged = applyChangeLog(
        analysisResult.parsed_resume,
        analysisResult.change_log,
        changeLogAccepted
      );
      const editorResume = toEditorSchema(merged);
      const doc = buildDocx(editorResume);
      const blob = await Packer.toBlob(doc);
      const rawName = saveResumeFileName || `${analysisResult.job_title || 'optimized'}-resume`;
      const fileName = rawName.endsWith('.docx') ? rawName : `${rawName}.docx`;
      const file = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('resumeText', fileContent);
      const token = await getToken();
      const uploadRes = await axios.post(`${BACKEND_URL}/resumes/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      const newResumeId = uploadRes.data.resume?.id || null;

      if (activeResumeId) {
        try {
          await axios.patch(
            `${BACKEND_URL}/resumes/${activeResumeId}`,
            { parsed_resume: editorResume },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch {
          console.error('Failed to update parsed_resume on resume');
        }
      }

      setSaveModalOpen(false);
      setSaveResumeFileName('');
      setAnalysisSaved(true);
      setSavedResumeId(newResumeId);
      try {
        const cached = JSON.parse(localStorage.getItem(ANALYSIS_CACHE_KEY));
        if (cached) localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify({ ...cached, analysisSaved: true, savedResumeId: newResumeId }));
      } catch {}
      alert('Resume saved successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save resume. Please try again.');
    } finally {
      setSavingResume(false);
    }
  };

  const JD_CHAR_LIMIT = 20000;
  const canOptimize = () => fileContent !== '' && jobDescription !== '' && !jobLoading && jobDescription.length <= JD_CHAR_LIMIT;

  useEffect(() => {
    return () => { if (filePreview && fileType === 'pdf') URL.revokeObjectURL(filePreview); };
  }, [filePreview, fileType]);

  return (
    <Container maxWidth="lg" className="main-container">
  
        <div className="hero">
          <h1>Optimize Your Resume for Any Job</h1>
          <p>Upload your resume and compare it against job descriptions to see how well you match</p>
        </div>

      {(fileUpload || fileContent || jobDescription) && (
        <div className="clear-section">
          <Button startIcon={<Clear />} onClick={handleClear} className="btn-clear">Clear All</Button>
        </div>
      )}

      {/* Resume input: upload or paste (mutually exclusive) */}
      <div className="section">
        <div className="section-header">
          <h2>1. Add Your Resume</h2>
          <p>Upload a file or paste your resume text below</p>
        </div>
        <div className="section-body">
          {/* Upload option */}
          <Tooltip title={inputMode === 'paste' ? 'Clear text to upload a file' : ''} arrow placement="top">
            <span style={{ display: 'inline-block' }}>
              <div style={{ opacity: inputMode === 'paste' ? 0.4 : 1, pointerEvents: inputMode === 'paste' ? 'none' : 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="contained" component="label" startIcon={<CloudUpload />} className="btn-upload">
                  {fileUpload ? fileUpload.name : 'Choose File'}
                  <input ref={fileInputRef} type="file" hidden accept=".pdf,.docx" onChange={handleFileUpload} />
                </Button>
                {user && (
                  <Button variant="outlined" startIcon={<FolderOpen />} onClick={handleOpenStoredResumes}>
                    Select Saved Resume
                  </Button>
                )}
              </div>
            </span>
          </Tooltip>

          <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            <span style={{ color: '#9ca3af', fontSize: 14 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          </div>

          {/* Paste option */}
          <Tooltip title={inputMode === 'upload' ? 'Clear file upload to paste text' : ''} arrow placement="top">
            <span style={{ display: 'block' }}>
              <div style={{ opacity: inputMode === 'upload' ? 0.4 : 1, pointerEvents: inputMode === 'upload' ? 'none' : 'auto' }}>
                <textarea
                  className="text-input"
                  value={inputMode === 'upload' ? '' : fileContent}
                  onChange={(e) => {
                    userInteractedRef.current = true;
                    setFileContent(e.target.value);
                    setInputMode(e.target.value ? 'paste' : null);
                    setActiveResumeId(null);
                  }}
                  placeholder="Paste your resume text here..."
                  rows={12}
                  disabled={inputMode === 'upload'}
                />
              </div>
            </span>
          </Tooltip>
        </div>
      </div>

      {/* File preview (upload mode only) */}
      {inputMode === 'upload' && fileUpload && (
        <div className="section">
          <div className="section-header"><h2>File Preview</h2></div>
          <div className="preview-container">
            {fileType === 'pdf' && <iframe src={filePreview} className="pdf-preview" title="Resume preview" />}
            {fileType === 'docx' && <div className="docx-preview" dangerouslySetInnerHTML={{ __html: filePreview }} />}
          </div>
        </div>
      )}

      {/* Job description */}
      <div className="section">
        <div className="section-header">
          <div className="header-with-tooltip">
            <h2>2. Add Job Description</h2>
            <Tooltip
              title="Fetching from LinkedIn or Indeed may be blocked. Pasting manually is more reliable."
              arrow placement="right"
              slotProps={{ tooltip: { sx: { fontSize: '16px' } } }}
            >
              <IconButton className="tooltip-icon">
                <img src={help_outline} placeholder="help icon" />
              </IconButton>
            </Tooltip>
          </div>
          <p>Enter job URL or paste the description manually</p>
        </div>
        <div className="section-body">
          <div className="url-input-row">
            <TextField
              fullWidth
              placeholder="https://example.com/job-posting"
              value={jobURL}
              onChange={(e) => setJobURL(e.target.value)}
              variant="outlined"
              className="url-field"
              slotProps={{ input: { startAdornment: <LinkIcon className="url-icon" /> } }}
            />
            <Button variant="contained" onClick={handleFetchJobDescription} disabled={jobLoading || !jobURL} className="btn-fetch">
              {jobLoading ? <CircularProgress size={20} color="inherit" /> : 'Fetch'}
            </Button>
          </div>
          <textarea
            className="text-input"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Or paste job description here..."
            rows={10}
            disabled={jobLoading}
          />
          {jobDescription.length > JD_CHAR_LIMIT && (
            <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 4 }}>
              Job description is too long ({jobDescription.length.toLocaleString()} / {JD_CHAR_LIMIT.toLocaleString()} characters). Please trim it before running analysis.
            </div>
          )}
        </div>
      </div>

      {/* Analyze button */}
      <div className="analyze-section">
        <Button
          variant="contained"
          size="large"
          onClick={handleOptimize}
          disabled={!user || !canOptimize() || isOptimizing}
          className="btn-analyze"
        >
          {isOptimizing ? optimizePhase : 'Analyze Resume'}
        </Button>
      </div>

      {/* Results area */}
      {user && (
        <div style={{ marginTop: 32 }}>
          {!analysisResult && !isOptimizing && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
              Run an analysis to see results here.
            </div>
          )}
          {isOptimizing && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <CircularProgress />
              <div style={{ marginTop: 16, color: '#6b7280' }}>{optimizePhase}</div>
            </div>
          )}
          {analysisResult && !isOptimizing && (
            <>
              <div className="results-divider">
                <h2>
                  {analysisResult.job_title ? `${analysisResult.job_title}${analysisResult.company ? ` — ${analysisResult.company}` : ''}` : 'Analysis Results'}
                </h2>
              </div>
              <AnalysisResults
                analysis={analysisResult}
                fileContent={fileContent}
                changeLogAccepted={changeLogAccepted}
                onToggle={handleToggleChange}
                readOnly={analysisSaved}
              />
              <div className="analyze-section" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={handleExportExcel}>Export to Excel</Button>
                <Button variant="outlined" onClick={handleExportPdf} disabled={!analysisResult?.parsed_resume}>Export PDF</Button>
                <Button variant="outlined" onClick={handleExportDocx} disabled={!analysisResult?.parsed_resume}>Export DOCX</Button>
                <Tooltip title={!analysisSaved ? 'Save the optimized resume with your changes before opening in editor' : ''} arrow>
                  <span>
                    <Button
                      variant="outlined"
                      onClick={handleOpenInEditor}
                      disabled={!analysisSaved || !savedResumeId}
                    >
                      Open in Editor
                    </Button>
                  </span>
                </Tooltip>
                <Button variant="contained" disabled={analysisSaved} onClick={() => {
                  const company = (analysisResult?.company || '').replace(/\s+/g, '');
                  const position = (analysisResult?.job_title || '').replace(/\s+/g, '');
                  const now = new Date();
                  const date = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
                  setSaveResumeFileName(`${company}${position}${date}`);
                  setSaveModalOpen(true);
                }}>{analysisSaved ? 'Resume Saved' : 'Save Optimized Resume'}</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Stored Resume Picker */}
      <Dialog open={storedResumesOpen} onClose={() => setStoredResumesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Select a Saved Resume</DialogTitle>
        <DialogContent>
          {storedResumesLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><CircularProgress /></div>
          ) : storedResumes.length === 0 ? (
            <div style={{ color: '#6b7280', padding: '16px 0' }}>No saved resumes found.</div>
          ) : (
            <List disablePadding>
              {storedResumes.map((r) => (
                <ListItem key={r.id} disablePadding>
                  <ListItemButton onClick={() => handleSelectStoredResume(r)}>
                    <ListItemText
                      primary={r.file_name}
                      secondary={new Date(r.created_at).toLocaleDateString()}
                    />
                    {r.is_active && <Chip label="Active" size="small" color="primary" style={{ marginLeft: 8 }} />}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStoredResumesOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Save Resume Modal */}
      <Dialog open={saveModalOpen} onClose={() => setSaveModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Optimized Resume</DialogTitle>
        <DialogContent>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>File name</label>
            <TextField
              fullWidth
              size="small"
              placeholder="CompanyPositionMMDDYYYY"
              value={saveResumeFileName}
              onChange={(e) => setSaveResumeFileName(e.target.value)}
            />
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>.docx will be appended automatically</div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
            {(analysisResult?.change_log || []).filter((_, i) => changeLogAccepted[i] === false).length} change(s) rejected —
            rejected bullets will use the original text.
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveResume} disabled={savingResume}>
            {savingResume ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}

export default App;
