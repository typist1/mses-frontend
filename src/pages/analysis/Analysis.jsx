import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Button, Container, Table, TableBody, TableCell, TableHead, TableRow,
  Collapse, Chip, CircularProgress, Alert,
} from '@mui/material';
import { ExpandMore, ExpandLess, CheckCircle, Cancel } from '@mui/icons-material';
import { COURSES } from '../../assets/MSESCoursesFull.js';
import { exportPdf, exportDocx } from '../../common/functions/exportFile.js';
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

function SkillsTable({ skills }) {
  const [expandedCourse, setExpandedCourse] = useState(null);

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell><strong>Skill</strong></TableCell>
          <TableCell><strong>Importance</strong></TableCell>
          <TableCell><strong>Fit</strong></TableCell>
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

function ChangeLogPanel({ changeLog }) {
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

function AnalysisResults({ analysis }) {
  const { overall_fit_score, score_breakdown, gap_analysis, change_log, flags } = analysis;
  const skills = gap_analysis?.skills || [];
  const hasFlags = flags?.truncated_resume || flags?.sparse_jd;

  return (
    <div>
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

      {hasFlags && (
        <div className="section">
          <Alert severity="warning" style={{ marginBottom: 8 }}>
            {flags.truncated_resume && <div>Resume was very long; only the first 15,000 characters were analyzed.</div>}
            {flags.sparse_jd && <div>This job description appears sparse. The analysis may be lower quality.</div>}
          </Alert>
        </div>
      )}

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
          <SkillsTable skills={skills} />
        </div>
      </div>

      {change_log?.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h3>Resume Changes</h3>
          </div>
          <ChangeLogPanel changeLog={change_log} />
        </div>
      )}
    </div>
  );
}

function Analysis() {
  const { getToken } = useContext(UserContext);
  const navigate = useNavigate();

  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
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
    load();
  }, []);

  const handleViewItem = async (id) => {
    setViewingLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.get(`${BACKEND_URL}/analyze/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setViewingItem(data);
    } catch {
      alert('Failed to load analysis');
    } finally {
      setViewingLoading(false);
    }
  };

  const getEditorResume = (analysis) => {
    const pr = analysis.parsed_resume;
    if (!pr) return null;
    // parsed_resume may be in editor schema format (if user previously saved optimized resume,
    // which patches resumes.parsed_resume with editor schema). Detect by skills being an array.
    if (Array.isArray(pr.skills)) return pr;
    const merged = applyChangeLog(pr, analysis.change_log, {});
    return toEditorSchema(merged);
  };

  const handleExportExcel = () => {
    if (!viewingItem) return;
    const skills = viewingItem.gap_analysis?.skills || [];
    const summaryRows = [
      ['Overall Fit Score', `${viewingItem.overall_fit_score}%`],
      ['Job Title', viewingItem.job_title || ''],
      ['Company', viewingItem.company || ''],
      ['Score Breakdown', viewingItem.score_breakdown || ''],
      [],
    ];
    const header = ['Skill', 'Importance', 'Fit Score', 'Fit Label', 'Gap Keywords', 'Recommended Actions', 'Courses'];
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
    const clHeader = ['Section', 'Field', 'Original', 'Rewritten', 'Reason'];
    const clRows = (viewingItem.change_log || []).map((e) => [
      e.section, e.field, e.original, e.rewritten, e.reason,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([clHeader, ...clRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Skills Analysis');
    XLSX.utils.book_append_sheet(wb, ws2, 'Change Log');
    XLSX.writeFile(wb, `resume-analysis-${Date.now()}.xlsx`);
  };

  const handleExportPdf = async () => {
    if (!viewingItem) return;
    try {
      await exportPdf(getEditorResume(viewingItem), {
        filename: `${viewingItem.job_title || 'resume'}-optimized`,
        getToken,
        backendUrl: BACKEND_URL,
      });
    } catch {
      alert('Failed to export PDF. Please try again.');
    }
  };

  const handleExportDocx = async () => {
    if (!viewingItem) return;
    try {
      await exportDocx(getEditorResume(viewingItem), {
        filename: `${viewingItem.job_title || 'resume'}-optimized`,
      });
    } catch {
      alert('Failed to export DOCX. Please try again.');
    }
  };

  const handleOpenInEditor = () => {
    const editorResume = getEditorResume(viewingItem);
    if (!editorResume) return;
    navigate('/editor', { state: { resume: editorResume } });
  };

  return (
    <Container maxWidth="lg" className="main-container">
      <div className="hero">
        <h1>Past Analyses</h1>
        <p>View and export your previous resume analyses</p>
      </div>

      {viewingLoading && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <CircularProgress />
        </div>
      )}

      {!viewingLoading && viewingItem && (
        <div>
          <Alert severity="info" style={{ margin: '12px 0' }}>
            Viewing historical analysis for <strong>{viewingItem.job_title}</strong> at <strong>{viewingItem.company}</strong>.
            <Button size="small" style={{ marginLeft: 8 }} onClick={() => setViewingItem(null)}>Back to List</Button>
          </Alert>
          <div className="results-divider">
            <h2>
              {viewingItem.job_title
                ? `${viewingItem.job_title}${viewingItem.company ? ` — ${viewingItem.company}` : ''}`
                : 'Analysis Results'}
            </h2>
          </div>
          <AnalysisResults analysis={viewingItem} />
          <div className="analyze-section" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={handleExportExcel}>Export to Excel</Button>
            <Button variant="outlined" onClick={handleExportPdf} disabled={!viewingItem?.parsed_resume}>Export PDF</Button>
            <Button variant="outlined" onClick={handleExportDocx} disabled={!viewingItem?.parsed_resume}>Export DOCX</Button>
            <Button
              variant="outlined"
              onClick={handleOpenInEditor}
              disabled={!viewingItem?.parsed_resume}
            >
              Open in Editor
            </Button>
          </div>
        </div>
      )}

      {!viewingLoading && !viewingItem && (
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
                  <TableCell><strong>Actions</strong></TableCell>
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
                      <Button size="small" variant="outlined" onClick={() => handleViewItem(item.id)}>
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
    </Container>
  );
}

export default Analysis;
