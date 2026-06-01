import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Collapse, Tooltip, IconButton, Alert, Button, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress,
} from '@mui/material';
import {
  ExpandMore, ExpandLess, CheckCircle, Cancel,
  InfoOutlined, Edit as EditIcon, ArrowDropDown,
} from '@mui/icons-material';
import { COURSES } from '../../assets/MSESCoursesFull.js';
import { buildDocx, Packer } from '../../utils/buildDocx.js';
import { exportPdf, exportDocx } from '../functions/exportFile.js';
import { UserContext } from '@/common/contexts/UserContext';

import { BACKEND_URL } from '@/utils/constants';
const COURSE_MAP = Object.fromEntries(COURSES.map((c) => [c.c, c]));

export function fitLabel(score) {
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

export function applyChangeLog(parsedResume, changeLog, accepted) {
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

function skillsToRows(skills) {
  if (Array.isArray(skills)) return skills;
  return [
    { id: 'sk-tech',  category: 'Technical',  items: (skills?.technical || []).join(', ') },
    { id: 'sk-tools', category: 'Tools',       items: (skills?.tools     || []).join(', ') },
    { id: 'sk-lang',  category: 'Languages',   items: (skills?.languages || []).join(', ') },
    { id: 'sk-soft',  category: 'Soft Skills', items: (skills?.soft      || []).join(', ') },
  ].filter((r) => r.items);
}

export function prepareMergedForExport(merged) {
  return {
    ...merged,
    contact: merged.contact || {},
    contactExtra: merged.contactExtra || [],
    experience: (merged.experience || []).map((e) => ({ ...e, bullets: e.bullets || [] })),
    education: merged.education || [],
    certifications: merged.certifications || [],
    honors_awards: merged.honors_awards || [],
    customSections: merged.customSections || [],
    skills: skillsToRows(merged.skills),
    projects: (merged.projects || []).map((p) => ({
      ...p,
      tech: Array.isArray(p.tech) ? p.tech.join(', ') : (p.tech || ''),
      bullets: p.bullets || [],
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

function ChangeLogPanel({ changeLog, accepted, onToggle, onEditRewritten, readOnly }) {
  const [expanded, setExpanded] = useState({});
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState('');
  const [hoveredRewritten, setHoveredRewritten] = useState(null);

  const commitEdit = (i) => {
    if (onEditRewritten) onEditRewritten(i, editText);
    setEditingIdx(null);
    setHoveredRewritten(null);
  };

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
              <div
                onMouseEnter={() => !readOnly && setHoveredRewritten(i)}
                onMouseLeave={() => editingIdx !== i && setHoveredRewritten(null)}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  REWRITTEN
                  {!readOnly && hoveredRewritten === i && editingIdx !== i && (
                    <EditIcon
                      style={{ fontSize: 12, cursor: 'pointer', color: '#6b7280' }}
                      onClick={(e) => { e.stopPropagation(); setEditingIdx(i); setEditText(entry.rewritten); }}
                    />
                  )}
                </div>
                {editingIdx === i ? (
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => commitEdit(i)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setEditingIdx(null); setHoveredRewritten(null); } }}
                    style={{ width: '100%', fontSize: 13, color: '#374151', background: '#f0fdf4', padding: 8, borderRadius: 4, border: '1px solid #86efac', resize: 'vertical', minHeight: 60, fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                ) : (
                  <div
                    style={{ fontSize: 13, color: '#374151', background: '#f0fdf4', padding: 8, borderRadius: 4, cursor: !readOnly ? 'text' : 'default' }}
                    onClick={(e) => { if (!readOnly) { e.stopPropagation(); setEditingIdx(i); setEditText(entry.rewritten); } }}
                  >
                    {entry.rewritten}
                  </div>
                )}
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

export default function AnalysisResults({
  analysis,
  fileContent = '',
  changeLogAccepted = {},
  onToggle,
  onEditRewritten,
  readOnly = false,
  analysisSaved = false,
  savedResumeId = null,
  onSaved,
}) {
  const { getToken } = useContext(UserContext);
  const navigate = useNavigate();
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [exportResumeMenuAnchor, setExportResumeMenuAnchor] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveResumeFileName, setSaveResumeFileName] = useState('');
  const [savingResume, setSavingResume] = useState(false);
  const [saveNameError, setSaveNameError] = useState('');
  const [existingResumeNames, setExistingResumeNames] = useState([]);

  const { overall_fit_score, score_breakdown, gap_analysis, change_log, flags } = analysis;
  const skills = gap_analysis?.skills || [];
  const hasFlags = flags?.truncated_resume || flags?.sparse_jd;
  const hasParsedResume = !!analysis.parsed_resume;
  const showSave = hasParsedResume && !!fileContent && !analysisSaved;
  const canOpenInEditor = !!savedResumeId || !!analysis?.resume_id || hasParsedResume;

  const getMerged = () => applyChangeLog(analysis.parsed_resume, change_log, changeLogAccepted);

  // ── Export Skill Gap Analysis ──────────────────────────────────────────────

  const handleExportExcel = () => {
    const s = skills;
    const summaryRows = [
      ['Overall Fit Score', `${overall_fit_score}%`],
      ['Job Title', analysis.job_title || ''],
      ['Company', analysis.company || ''],
      ['Score Breakdown', score_breakdown || ''],
      [],
      ['Fit Score Legend', ''],
      ['1', 'Not Found'],
      ['2', 'Related / Transferable Experience'],
      ['3', 'Explicitly Demonstrated'],
      ['4', 'Demonstrated with Measurable Impact'],
      [],
    ];
    const header = ['Skill', 'Importance', 'Fit Score', 'Fit Label', 'Gap Keywords', 'Recommended Actions', 'Recommended Courses'];
    const rows = s.map((sk) => [
      sk.skill,
      sk.importance === 0 ? 'Required' : 'Preferred',
      sk.fit_score,
      fitLabel(sk.fit_score),
      sk.gap_keywords || '',
      sk.recommended_actions || '',
      (sk.suggested_courses || []).map((c) => c.course_code).join(', '),
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([...summaryRows, header, ...rows]);
    const clHeader = ['Section', 'Field', 'Original', 'Rewritten', 'Reason', 'Status'];
    const clRows = (change_log || []).map((e, i) => [
      e.section, e.field, e.original, e.rewritten, e.reason,
      changeLogAccepted[i] !== false ? 'Accepted' : 'Rejected',
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([clHeader, ...clRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Skills Analysis');
    XLSX.utils.book_append_sheet(wb, ws2, 'Change Log');
    XLSX.writeFile(wb, `resume-analysis-${Date.now()}.xlsx`);
  };

  const handleExportSkillGapDocx = async () => {
    const { Document, Packer: DocxPacker, Paragraph, TextRun, Table: DocxTable, TableRow: DocxTableRow, TableCell: DocxTableCell, WidthType } = await import('docx');
    const changeLog = change_log || [];
    const h = (text, size = 24) => new Paragraph({ children: [new TextRun({ text, bold: true, size })], spacing: { before: 240, after: 120 } });
    const p = (text, size = 18) => new Paragraph({ children: [new TextRun({ text: String(text), size })], spacing: { after: 60 } });
    const cell = (text, bold = false) => new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(text || '—'), bold, size: 16 })] })], width: { size: 1, type: WidthType.AUTO } });
    const headerRow = new DocxTableRow({ children: ['Skill', 'Importance', 'Fit Score', 'Gap Keywords', 'Recommended Actions', 'Recommended Courses'].map((t) => cell(t, true)) });
    const skillRows = skills.map((s) => new DocxTableRow({
      children: [
        cell(s.skill),
        cell(s.importance === 0 ? 'Required' : 'Preferred'),
        cell(`${s.fit_score} — ${fitLabel(s.fit_score)}`),
        cell(s.gap_keywords || '—'),
        cell(s.recommended_actions || '—'),
        cell((s.suggested_courses || []).map((c) => c.course_code).join(', ') || '—'),
      ],
    }));
    const clParagraphs = changeLog.length > 0 ? [
      h('Resume Changes'),
      ...changeLog.flatMap((e, idx) => [
        new Paragraph({ children: [new TextRun({ text: `${idx + 1}. [${e.section}] ${e.field}`, bold: true, size: 20 })], spacing: { before: 200, after: 60 } }),
        new Paragraph({ children: [new TextRun({ text: 'Original: ', bold: true, size: 18 }), new TextRun({ text: e.original || '(none)', size: 18 })], spacing: { after: 40 } }),
        new Paragraph({ children: [new TextRun({ text: 'Rewritten: ', bold: true, size: 18 }), new TextRun({ text: e.rewritten, size: 18 })], spacing: { after: 40 } }),
        new Paragraph({ children: [new TextRun({ text: 'Reason: ', bold: true, size: 16, color: '666666' }), new TextRun({ text: e.reason, size: 16, color: '666666' })], spacing: { after: 120 } }),
      ]),
    ] : [];
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: 'Skill Gap Analysis', bold: true, size: 32 })], spacing: { after: 200 } }),
          p(`Overall Fit Score: ${overall_fit_score}%`),
          p(`Job Title: ${analysis.job_title || 'N/A'}`),
          p(`Company: ${analysis.company || 'N/A'}`),
          ...(score_breakdown ? [p(`Score Breakdown: ${score_breakdown}`)] : []),
          h('Skills Gap Analysis'),
          new DocxTable({ rows: [headerRow, ...skillRows], width: { size: 9000, type: WidthType.DXA } }),
          ...clParagraphs,
        ],
      }],
    });
    const blob = await DocxPacker.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `skill-gap-analysis-${Date.now()}.docx`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSkillGapPdf = async () => {
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    const pdfMake = pdfMakeModule.default;
    const pdfFonts = pdfFontsModule.default;
    pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts;
    const changeLog = change_log || [];
    const content = [
      { text: 'Skill Gap Analysis', bold: true, fontSize: 18, margin: [0, 0, 0, 10] },
      { text: `Overall Fit Score: ${overall_fit_score}%`, bold: true, fontSize: 12 },
      { text: `Job Title: ${analysis.job_title || 'N/A'}`, fontSize: 10 },
      { text: `Company: ${analysis.company || 'N/A'}`, fontSize: 10, margin: [0, 0, 0, 4] },
      ...(score_breakdown ? [{ text: `Score Breakdown: ${score_breakdown}`, fontSize: 9, color: '#6b7280', margin: [0, 0, 0, 12] }] : [{ text: '', margin: [0, 0, 0, 12] }]),
      { text: 'Skills Gap Analysis', bold: true, fontSize: 13, margin: [0, 0, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', '*', '*', 'auto'],
          body: [
            [
              { text: 'Skill', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
              { text: 'Importance', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
              { text: 'Fit Score', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
              { text: 'Gap Keywords', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
              { text: 'Recommended Actions', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
              { text: 'Recommended Courses', bold: true, fontSize: 8, fillColor: '#f3f4f6' },
            ],
            ...skills.map((s) => [
              { text: s.skill, fontSize: 8 },
              { text: s.importance === 0 ? 'Required' : 'Preferred', fontSize: 8 },
              { text: `${s.fit_score} — ${fitLabel(s.fit_score)}`, fontSize: 8 },
              { text: s.gap_keywords || '—', fontSize: 8 },
              { text: s.recommended_actions || '—', fontSize: 8 },
              { text: (s.suggested_courses || []).map((c) => c.course_code).join(', ') || '—', fontSize: 8 },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 16],
      },
    ];
    if (changeLog.length > 0) {
      content.push({ text: 'Resume Changes', bold: true, fontSize: 13, margin: [0, 0, 0, 6] });
      changeLog.forEach((e, idx) => {
        content.push(
          { text: `${idx + 1}. [${e.section}] ${e.field}`, bold: true, fontSize: 9, margin: [0, 6, 0, 2] },
          {
            columns: [
              [{ text: 'Original', bold: true, fontSize: 8, color: '#888888' }, { text: e.original || '(none)', fontSize: 8 }],
              [{ text: 'Rewritten', bold: true, fontSize: 8, color: '#888888' }, { text: e.rewritten, fontSize: 8 }],
            ],
            columnGap: 8,
            margin: [0, 0, 0, 2],
          },
          { text: [{ text: 'Reason: ', bold: true }, { text: e.reason, color: '#6b7280' }], fontSize: 8, margin: [0, 0, 0, 6] },
        );
      });
    }
    pdfMake.createPdf({ content, pageMargins: [36, 36, 36, 36] }).download(`skill-gap-analysis-${Date.now()}.pdf`);
  };

  // ── Export Optimized Resume ────────────────────────────────────────────────

  const handleExportPdf = async () => {
    if (!hasParsedResume) return;
    try {
      const merged = getMerged();
      await exportPdf(prepareMergedForExport(merged), {
        filename: `${analysis.job_title || 'resume'}-optimized`,
        getToken,
        backendUrl: BACKEND_URL,
      });
    } catch (err) {
      console.error('Export PDF error:', err);
      toast.error('Failed to export PDF. Please try again.');
    }
  };

  const handleExportDocx = async () => {
    if (!hasParsedResume) return;
    try {
      const merged = getMerged();
      await exportDocx(prepareMergedForExport(merged), {
        filename: `${analysis.job_title || 'resume'}-optimized`,
      });
    } catch (err) {
      console.error('Export DOCX error:', err);
      toast.error('Failed to export DOCX. Please try again.');
    }
  };

  // ── Save Optimized Resume ──────────────────────────────────────────────────

  const handleSaveResume = async () => {
    if (!hasParsedResume) return;
    const rawName = saveResumeFileName || `${analysis.job_title || 'optimized'}-resume`;
    const finalName = rawName.endsWith('.docx') ? rawName.toLowerCase() : `${rawName.toLowerCase()}.docx`;
    if (existingResumeNames.includes(finalName)) {
      setSaveNameError(`"${finalName}" already exists. Choose a different name.`);
      return;
    }
    setSavingResume(true);
    try {
      const merged = getMerged();
      const doc = buildDocx(prepareMergedForExport(merged));
      const blob = await Packer.toBlob(doc);
      const fileName = rawName.endsWith('.docx') ? rawName : `${rawName}.docx`;
      const file = new File([blob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const formData = new FormData();
      formData.append('file', file);
      const token = await getToken();
      // Do NOT manually set Content-Type — let the browser set it with the correct multipart boundary
      const uploadRes = await axios.post(`${BACKEND_URL}/resumes/upload`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newResumeId = uploadRes.data.resume?.id || null;
      if (newResumeId) {
        await axios.patch(
          `${BACKEND_URL}/resumes/${newResumeId}`,
          { parsed_resume: merged },
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch((e) => console.error('Failed to cache parsed_resume:', e));
        if (analysis?.id) {
          await axios.patch(
            `${BACKEND_URL}/analyze/${analysis.id}`,
            { saved_resume_id: newResumeId },
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch((e) => console.error('Failed to store saved_resume_id:', e));
        }
      }
      setSaveModalOpen(false);
      setSaveResumeFileName('');
      if (onSaved) onSaved({ resumeId: newResumeId });
      toast.success('Resume saved successfully!');
    } catch (err) {
      console.error('Save resume error:', err);
      toast.error(err.response?.data?.error || 'Failed to save resume. Please try again.');
    } finally {
      setSavingResume(false);
    }
  };

  // ── Open in Editor ─────────────────────────────────────────────────────────

  const handleOpenInEditor = () => {
    const rid = savedResumeId || analysis?.saved_resume_id || analysis?.resume_id;
    if (rid) {
      navigate(`/editor/${rid}`);
    } else {
      toast.error('No resume linked to this analysis. The analysis must have been run with a saved resume to open in the editor.');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Score */}
      <div className="section score-section" style={{ position: 'relative' }}>
        <Tooltip title="Match score is calculated by a combination of the skills' fit scores and whether they are required or not" arrow placement="left">
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

      {/* Flags */}
      {hasFlags && (
        <div className="section">
          <Alert severity="warning" style={{ marginBottom: 8 }}>
            {flags.truncated_resume && <div>Resume was very long; only the first 15,000 characters were analyzed.</div>}
            {flags.sparse_jd && <div>This job description appears sparse. The analysis may be lower quality.</div>}
          </Alert>
        </div>
      )}

      {/* Skills Gap */}
      <div className="section">
        <div className="section-header">
          <h3>Skills Gap Analysis</h3>
          <p>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#fef2f2', border: '1px solid #fca5a5', marginRight: 4 }} />Not Found (1)
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#fffbeb', border: '1px solid #fde68a', margin: '0 4px 0 12px' }} />Related / Transferable Experience (2)
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
            onEditRewritten={onEditRewritten}
            readOnly={readOnly}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="analyze-section" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button variant="outlined" endIcon={<ArrowDropDown />} onClick={(e) => setExportMenuAnchor(e.currentTarget)}>
          Export Skill Gap Analysis
        </Button>
        <Menu anchorEl={exportMenuAnchor} open={Boolean(exportMenuAnchor)} onClose={() => setExportMenuAnchor(null)}>
          <MenuItem onClick={() => { handleExportSkillGapPdf(); setExportMenuAnchor(null); }}>PDF</MenuItem>
          <MenuItem onClick={() => { handleExportSkillGapDocx(); setExportMenuAnchor(null); }}>Word (DOCX)</MenuItem>
          <MenuItem onClick={() => { handleExportExcel(); setExportMenuAnchor(null); }}>Excel</MenuItem>
        </Menu>

        <Button variant="outlined" endIcon={<ArrowDropDown />} disabled={!hasParsedResume} onClick={(e) => setExportResumeMenuAnchor(e.currentTarget)}>
          Export Optimized Resume
        </Button>
        <Menu anchorEl={exportResumeMenuAnchor} open={Boolean(exportResumeMenuAnchor)} onClose={() => setExportResumeMenuAnchor(null)}>
          <MenuItem onClick={() => { handleExportPdf(); setExportResumeMenuAnchor(null); }}>PDF</MenuItem>
          <MenuItem onClick={() => { handleExportDocx(); setExportResumeMenuAnchor(null); }}>Word (DOCX)</MenuItem>
        </Menu>

        <Button variant="outlined" onClick={handleOpenInEditor} disabled={!canOpenInEditor}>
          Open in Editor
        </Button>

        {showSave && (
          <Button variant="contained" onClick={async () => {
            const company = (analysis.company || '').replace(/\s+/g, '');
            const position = (analysis.job_title || '').replace(/\s+/g, '');
            const now = new Date();
            const date = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
            setSaveResumeFileName(`${company}${position}${date}`);
            setSaveNameError('');
            setSaveModalOpen(true);
            try {
              const token = await getToken();
              const res = await axios.get(`${BACKEND_URL}/resumes`, { headers: { Authorization: `Bearer ${token}` } });
              setExistingResumeNames((res.data.resumes || []).map((r) => r.file_name.toLowerCase()));
            } catch {}
          }}>
            Save Optimized Resume
          </Button>
        )}

        {analysisSaved && (
          <Button variant="contained" disabled>Resume Saved</Button>
        )}
      </div>

      {/* Save Modal */}
      <Dialog open={saveModalOpen} onClose={() => { setSaveModalOpen(false); setSaveNameError(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>Save Optimized Resume</DialogTitle>
        <DialogContent>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>File name</label>
            <TextField
              fullWidth
              size="small"
              placeholder="CompanyPositionMMDDYYYY"
              value={saveResumeFileName}
              error={!!saveNameError}
              onChange={(e) => {
                const val = e.target.value;
                setSaveResumeFileName(val);
                const fn = val.trim().endsWith('.docx') ? val.trim().toLowerCase() : `${val.trim().toLowerCase()}.docx`;
                setSaveNameError(existingResumeNames.includes(fn) ? `"${fn}" already exists. Choose a different name.` : '');
              }}
            />
            {saveNameError
              ? <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{saveNameError}</div>
              : <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>.docx will be appended automatically</div>
            }
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>
            {(change_log || []).filter((_, i) => changeLogAccepted[i] === false).length} change(s) rejected —
            rejected bullets will use the original text.
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSaveModalOpen(false); setSaveNameError(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveResume} disabled={savingResume || !!saveNameError}>
            {savingResume ? <CircularProgress size={18} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
