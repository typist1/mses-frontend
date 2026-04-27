import React, { useState, useRef, useEffect, useContext } from 'react';
import mammoth from 'mammoth';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Button, Container, TextField, Tooltip, IconButton, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow, Collapse, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tabs, Tab, Alert,
} from '@mui/material';
import {
  CloudUpload, Clear, Link as LinkIcon, ExpandMore, ExpandLess,
  CheckCircle, Cancel, Warning,
} from '@mui/icons-material';
import help_outline from '../../assets/help_outline.svg';
import { COURSES } from '../../assets/MSESCoursesFull.js';
import { buildDocx, Packer } from '../../utils/buildDocx.js';
import '../../App.css';
import { UserContext } from '@/common/contexts/UserContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const COURSE_MAP = Object.fromEntries(COURSES.map((c) => [c.c, c]));

function fitLabel(score) {
  return { 1: 'Not Found', 2: 'Weak Signal', 3: 'Transferable', 4: 'Direct Match', 5: 'Strong Match' }[score] || '';
}

function fitRowColor(score) {
  if (score <= 2) return '#fef2f2';
  if (score === 3) return '#fffbeb';
  return '#f0fdf4';
}

function countKeyword(text, keyword) {
  if (!text || !keyword) return 0;
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.toLowerCase().match(new RegExp(escaped, 'g')) || []).length;
}

function applyChangeLog(optimizedResume, changeLog, accepted) {
  const merged = JSON.parse(JSON.stringify(optimizedResume));
  (changeLog || []).forEach((entry, i) => {
    if (accepted[i] === false) {
      if (entry.section === 'summary') {
        merged.summary = entry.original;
      } else if (entry.section === 'experience') {
        for (const exp of merged.experience || []) {
          const idx = (exp.bullets || []).indexOf(entry.rewritten);
          if (idx !== -1) { exp.bullets[idx] = entry.original; break; }
        }
      } else if (entry.section === 'projects') {
        for (const proj of merged.projects || []) {
          const idx = (proj.bullets || []).indexOf(entry.rewritten);
          if (idx !== -1) { proj.bullets[idx] = entry.original; break; }
        }
      } else if (entry.section === 'skills' && entry.original === '') {
        for (const cat of Object.keys(merged.skills || {})) {
          const idx = (merged.skills[cat] || []).indexOf(entry.rewritten);
          if (idx !== -1) { merged.skills[cat].splice(idx, 1); break; }
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

function SkillsTable({ skills, fileContent }) {
  const [expandedCourse, setExpandedCourse] = useState(null);

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell><strong>Skill</strong></TableCell>
          <TableCell><strong>Importance</strong></TableCell>
          <TableCell><strong>Fit</strong></TableCell>
          <TableCell><strong>ATS Count</strong></TableCell>
          <TableCell><strong>Gap Keywords</strong></TableCell>
          <TableCell><strong>Recommended Actions</strong></TableCell>
          <TableCell><strong>Courses</strong></TableCell>
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
                <Chip label={`${s.fit_score} — ${fitLabel(s.fit_score)}`} size="small" />
              </TableCell>
              <TableCell>{countKeyword(fileContent, s.skill)}x</TableCell>
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
                  <TableCell colSpan={7} style={{ padding: '12px 16px' }}>
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

function ChangeLogPanel({ changeLog, accepted, onToggle, flaggedBullets, readOnly }) {
  const [expanded, setExpanded] = useState({});
  const flaggedIndices = new Set((flaggedBullets || []).map((f) => f.index));

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
              {flaggedIndices.has(i) && (
                <Tooltip title="Contains numbers not in original — please verify">
                  <Warning style={{ color: '#f59e0b', marginLeft: 6, fontSize: 16, verticalAlign: 'middle' }} />
                </Tooltip>
              )}
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
  const hasFlags = flags?.truncated_resume || flags?.sparse_jd || (flags?.flagged_bullets?.length > 0);

  return (
    <div>
      {/* Score */}
      <div className="section score-section">
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
            {flags.flagged_bullets?.length > 0 && <div>Some rewritten bullets contain numbers not in the original. Review them before using.</div>}
          </Alert>
        </div>
      )}

      {/* Skills Table */}
      <div className="section">
        <div className="section-header">
          <h3>Skills Gap Analysis</h3>
          <p>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#fef2f2', border: '1px solid #fca5a5', marginRight: 4 }} />Not found
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#fffbeb', border: '1px solid #fde68a', margin: '0 4px 0 12px' }} />Transferable
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#f0fdf4', border: '1px solid #6ee7b7', margin: '0 4px 0 12px' }} />Strong match
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <SkillsTable skills={skills} fileContent={fileContent} />
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
            flaggedBullets={flags?.flagged_bullets}
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

  // Resume upload states
  const [fileUpload, setFileUpload] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [activeResumeId, setActiveResumeId] = useState(null);
  const [activeResumeFileName, setActiveResumeFileName] = useState(null);

  // Job description states
  const [jobURL, setJobURL] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobLoading, setJobLoading] = useState(false);

  // Analysis states
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizePhase, setOptimizePhase] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [changeLogAccepted, setChangeLogAccepted] = useState({});

  // Results tabs
  const [resultsTab, setResultsTab] = useState(0);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingHistoryItem, setViewingHistoryItem] = useState(null);

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveAsVersion, setSaveAsVersion] = useState(false);
  const [saveResumeFileName, setSaveResumeFileName] = useState('');
  const [savingResume, setSavingResume] = useState(false);

  const displayedAnalysis = viewingHistoryItem || analysisResult;
  const isReadOnly = viewingHistoryItem !== null;

  const handleClear = () => {
    if (filePreview && fileType === 'pdf') URL.revokeObjectURL(filePreview);
    setFileType(null);
    setFileUpload(null);
    setFilePreview('');
    setFileContent('');
    setJobURL('');
    setJobDescription('');
    setJobLoading(false);
    setAnalysisResult(null);
    setViewingHistoryItem(null);
    setChangeLogAccepted({});
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
    await processFile(file);
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
        setActiveResumeId(active.id);
        setActiveResumeFileName(active.file_name);
        const blobRes = await axios.get(`${BACKEND_URL}/resumes/${active.id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        });
        const mimeType = active.file_name.endsWith('.pdf')
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        await processFile(new File([blobRes.data], active.file_name, { type: mimeType }));
      } catch (err) {
        console.error('Error auto-populating active resume:', err);
      }
    };
    autoPopulate();
  }, [user]);

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
    setViewingHistoryItem(null);

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
      setResultsTab(0);
    } catch (err) {
      alert(err.response?.data?.error || 'Analysis failed. Please try again.');
    } finally {
      clearInterval(timer);
      setIsOptimizing(false);
    }
  };

  const handleToggleChange = (index, value) => {
    setChangeLogAccepted((prev) => ({ ...prev, [index]: value }));
  };

  const handleLoadHistory = async () => {
    setResultsTab(1);
    if (historyList.length > 0) return;
    setHistoryLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.get(`${BACKEND_URL}/analyze`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistoryList(data.analyses || []);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewHistoryItem = async (id) => {
    try {
      const token = await getToken();
      const { data } = await axios.get(`${BACKEND_URL}/analyze/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setViewingHistoryItem(data);
      setResultsTab(0);
    } catch {
      alert('Failed to load analysis');
    }
  };

  const handleExportExcel = () => {
    if (!displayedAnalysis) return;
    const skills = displayedAnalysis.gap_analysis?.skills || [];
    const summaryRows = [
      ['Overall Fit Score', `${displayedAnalysis.overall_fit_score}%`],
      ['Job Title', displayedAnalysis.job_title || ''],
      ['Company', displayedAnalysis.company || ''],
      ['Score Breakdown', displayedAnalysis.score_breakdown || ''],
      [],
    ];
    const header = ['Skill', 'Importance', 'Fit Score', 'Fit Label', 'ATS Count', 'Gap Keywords', 'Recommended Actions', 'Courses'];
    const rows = skills.map((s) => [
      s.skill,
      s.importance === 0 ? 'Required' : 'Preferred',
      s.fit_score,
      fitLabel(s.fit_score),
      countKeyword(fileContent, s.skill),
      s.gap_keywords || '',
      s.recommended_actions || '',
      (s.suggested_courses || []).map((c) => c.course_code).join(', '),
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([...summaryRows, header, ...rows]);
    const clHeader = ['Section', 'Field', 'Original', 'Rewritten', 'Reason', 'Status'];
    const clRows = (displayedAnalysis.change_log || []).map((e, i) => [
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
    if (!displayedAnalysis) return;
    const merged = applyChangeLog(
      displayedAnalysis.optimized_resume,
      displayedAnalysis.change_log,
      isReadOnly ? {} : changeLogAccepted
    );
    navigate('/editor', { state: { resume: toEditorSchema(merged) } });
  };

  const handleSaveResume = async () => {
    if (!displayedAnalysis) return;
    setSavingResume(true);
    try {
      const merged = applyChangeLog(
        displayedAnalysis.optimized_resume,
        displayedAnalysis.change_log,
        isReadOnly ? {} : changeLogAccepted
      );
      const editorResume = toEditorSchema(merged);
      const doc = buildDocx(editorResume);
      const blob = await Packer.toBlob(doc);
      const rawName = saveResumeFileName || `${displayedAnalysis.job_title || 'optimized'}-resume`;
      const fileName = rawName.endsWith('.docx') ? rawName : `${rawName}.docx`;
      const file = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const formData = new FormData();
      formData.append('file', file);
      if (saveAsVersion && activeResumeId) {
        formData.append('parentResumeId', String(activeResumeId));
      }
      const token = await getToken();
      await axios.post(`${BACKEND_URL}/resumes/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setSaveModalOpen(false);
      setSaveResumeFileName('');
      alert('Resume saved successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save resume. Please try again.');
    } finally {
      setSavingResume(false);
    }
  };

  const canOptimize = () => fileContent !== '' && jobDescription !== '' && !jobLoading;

  useEffect(() => {
    return () => { if (filePreview && fileType === 'pdf') URL.revokeObjectURL(filePreview); };
  }, [filePreview, fileType]);

  return (
    <Container maxWidth="lg" className="main-container">
      {!fileUpload && (
        <div className="hero">
          <h1>Optimize Your Resume for Any Job</h1>
          <p>Upload your resume and compare it against job descriptions to see how well you match</p>
        </div>
      )}

      {(fileUpload || jobDescription) && (
        <div className="clear-section">
          <Button startIcon={<Clear />} onClick={handleClear} className="btn-clear">Clear All</Button>
        </div>
      )}

      {/* Upload */}
      <div className="section">
        <div className="section-header">
          <h2>1. Upload Your Resume</h2>
          <p>PDF or DOCX files supported</p>
        </div>
        <div className="section-body">
          <Button variant="contained" component="label" startIcon={<CloudUpload />} className="btn-upload">
            {fileUpload ? fileUpload.name : 'Choose File'}
            <input ref={fileInputRef} type="file" hidden accept=".pdf,.docx" onChange={handleFileUpload} />
          </Button>
        </div>
      </div>

      {/* Preview */}
      {fileUpload && (
        <div className="section">
          <div className="section-header"><h2>File Preview</h2></div>
          <div className="preview-container">
            {fileType === 'pdf' && <iframe src={filePreview} className="pdf-preview" title="Resume preview" />}
            {fileType === 'docx' && <div className="docx-preview" dangerouslySetInnerHTML={{ __html: filePreview }} />}
          </div>
        </div>
      )}

      {/* Extracted text */}
      {fileContent && (
        <div className="section">
          <div className="section-header">
            <div className="header-with-tooltip">
              <h2>Extracted Resume Text</h2>
              <Tooltip
                title="Resume format should be as simple as possible. Use standard fonts, clear section headers, and avoid complex formatting (e.g. columns, tables, graphics)."
                arrow placement="right"
                slotProps={{ tooltip: { sx: { fontSize: '16px' } } }}
              >
                <IconButton className="tooltip-icon">
                  <img src={help_outline} placeholder="help icon" />
                </IconButton>
              </Tooltip>
            </div>
            <p>Review and edit the extracted text to ensure accuracy</p>
          </div>
          <div className="section-body">
            <textarea
              className="text-input"
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              placeholder="Extracted resume text will appear here..."
              rows={12}
            />
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
        {isOptimizing && <CircularProgress size={20} style={{ marginLeft: 12 }} />}
      </div>

      {/* Results area */}
      {user && (
        <div style={{ marginTop: 32 }}>
          <Tabs value={resultsTab} onChange={(_, v) => { if (v === 1) handleLoadHistory(); else setResultsTab(v); }}>
            <Tab label="Analysis Results" />
            <Tab label="History" />
          </Tabs>

          {resultsTab === 0 && (
            <div>
              {!displayedAnalysis && !isOptimizing && (
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
              {displayedAnalysis && !isOptimizing && (
                <>
                  {isReadOnly && (
                    <Alert severity="info" style={{ margin: '12px 0' }}>
                      Viewing historical analysis for <strong>{displayedAnalysis.job_title}</strong> at <strong>{displayedAnalysis.company}</strong>.
                      <Button size="small" style={{ marginLeft: 8 }} onClick={() => setViewingHistoryItem(null)}>Back to Current</Button>
                    </Alert>
                  )}
                  <div className="results-divider">
                    <h2>
                      {displayedAnalysis.job_title ? `${displayedAnalysis.job_title}${displayedAnalysis.company ? ` — ${displayedAnalysis.company}` : ''}` : 'Analysis Results'}
                    </h2>
                  </div>
                  <AnalysisResults
                    analysis={displayedAnalysis}
                    fileContent={fileContent}
                    changeLogAccepted={changeLogAccepted}
                    onToggle={handleToggleChange}
                    readOnly={isReadOnly}
                  />
                  <div className="analyze-section" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Button variant="outlined" onClick={handleExportExcel}>Export to Excel</Button>
                    <Button variant="outlined" onClick={handleOpenInEditor}>Open in Editor</Button>
                    {!isReadOnly && (
                      <Button variant="contained" onClick={() => setSaveModalOpen(true)}>Save Optimized Resume</Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {resultsTab === 1 && (
            <div style={{ marginTop: 16 }}>
              {historyLoading && <div style={{ textAlign: 'center', padding: 32 }}><CircularProgress /></div>}
              {!historyLoading && historyList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
                  No past analyses found.
                </div>
              )}
              {!historyLoading && historyList.length > 0 && (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Job Title</strong></TableCell>
                      <TableCell><strong>Company</strong></TableCell>
                      <TableCell><strong>Fit Score</strong></TableCell>
                      <TableCell><strong>Date</strong></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historyList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.job_title || '—'}</TableCell>
                        <TableCell>{item.company || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={`${item.overall_fit_score}%`}
                            size="small"
                            color={item.overall_fit_score >= 70 ? 'success' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => handleViewHistoryItem(item.id)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save Resume Modal */}
      <Dialog open={saveModalOpen} onClose={() => setSaveModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Optimized Resume</DialogTitle>
        <DialogContent>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>File name</label>
            <TextField
              fullWidth
              size="small"
              placeholder={`${displayedAnalysis?.job_title || 'optimized'}-resume`}
              value={saveResumeFileName}
              onChange={(e) => setSaveResumeFileName(e.target.value)}
            />
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>.docx will be appended automatically</div>
          </div>
          {activeResumeId && (
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Save type</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <Chip
                  label="New Resume"
                  color={!saveAsVersion ? 'primary' : 'default'}
                  onClick={() => setSaveAsVersion(false)}
                  clickable
                />
                <Chip
                  label={`New Version of "${activeResumeFileName}"`}
                  color={saveAsVersion ? 'primary' : 'default'}
                  onClick={() => setSaveAsVersion(true)}
                  clickable
                />
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
            {(displayedAnalysis?.change_log || []).filter((_, i) => changeLogAccepted[i] === false).length} change(s) rejected —
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
