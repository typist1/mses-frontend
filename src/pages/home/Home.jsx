import React, { useState, useRef, useEffect, useContext } from 'react';
import mammoth from 'mammoth';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Button, Container, TextField, Tooltip, IconButton, CircularProgress,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemButton, ListItemText,
} from '@mui/material';
import {
  CloudUpload, Clear, Link as LinkIcon, FolderOpen,
} from '@mui/icons-material';
import help_outline from '../../assets/help_outline.svg';
import AnalysisResults from '../../common/components/AnalysisResults.jsx';
import '../../App.css';
import { UserContext } from '@/common/contexts/UserContext';

import { BACKEND_URL } from '@/utils/constants';
const ANALYSIS_CACHE_KEY = 'mses_analysis_cache';

const PHASES = [
  'Validating resume...',
  'Analyzing job description...',
  'Parsing resume...',
  'Running gap analysis...',
  'Optimizing resume...',
  'Finalizing results...',
];

function App() {
  const { user, getToken } = useContext(UserContext);
  const fileInputRef = useRef(null);
  const userInteractedRef = useRef(false);

  const [fileUpload, setFileUpload] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [inputMode, setInputMode] = useState(null);
  const [activeResumeId, setActiveResumeId] = useState(null);
  const [activeResumeFileName, setActiveResumeFileName] = useState(null);

  const [storedResumesOpen, setStoredResumesOpen] = useState(false);
  const [storedResumes, setStoredResumes] = useState([]);
  const [storedResumesLoading, setStoredResumesLoading] = useState(false);

  const [jobURL, setJobURL] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobLoading, setJobLoading] = useState(false);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizePhase, setOptimizePhase] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [changeLogAccepted, setChangeLogAccepted] = useState({});
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
      toast.error('Please upload either a PDF or DOCX file');
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
    setActiveResumeId(null);
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
      toast.error('Failed to load resume. Please try again.');
    }
  };

  const handleExtractText = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = await getToken();
      const res = await axios.post(`${BACKEND_URL}/file/extractText`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFileContent(res.data.text);
    } catch (err) {
      console.error('Error extracting text:', err);
    }
  };

  const isURLValid = () =>
    jobURL.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g) !== null;

  const handleFetchJobDescription = async () => {
    if (!isURLValid()) { toast.error('Please enter a valid URL'); return; }
    setJobLoading(true);
    setJobDescription('Loading...');
    try {
      const token = await getToken();
      const res = await axios.post(`${BACKEND_URL}/file/extractJobDescription`, { url: jobURL }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobDescription(res.data.text || '');
      if (!res.data.text) toast.error('Error fetching job description. Please paste manually.');
    } catch {
      setJobDescription('');
      toast.error('Failed to fetch job description. Please paste it manually.');
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
      toast.error(err.response?.data?.error || 'Analysis failed. Please try again.');
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

  const handleEditRewritten = (index, newText) => {
    setAnalysisResult((prev) => {
      const changeLog = [...prev.change_log];
      changeLog[index] = { ...changeLog[index], rewritten: newText };
      const updated = { ...prev, change_log: changeLog };
      try {
        const cached = JSON.parse(localStorage.getItem(ANALYSIS_CACHE_KEY));
        if (cached?.analysisResult) {
          localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify({ ...cached, analysisResult: updated }));
        }
      } catch {}
      return updated;
    });
  };

  const handleSaved = ({ resumeId }) => {
    setAnalysisSaved(true);
    setSavedResumeId(resumeId);
    try {
      const cached = JSON.parse(localStorage.getItem(ANALYSIS_CACHE_KEY));
      if (cached) localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify({ ...cached, analysisSaved: true, savedResumeId: resumeId }));
    } catch {}
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

      {/* Resume input */}
      <div className="section">
        <div className="section-header">
          <h2>1. Add Your Resume</h2>
          <p>Upload a file or paste your resume text below</p>
        </div>
        <div className="section-body">
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

      {/* File preview */}
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
          Analyze Resume
        </Button>
      </div>

      {/* Results */}
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
                onEditRewritten={handleEditRewritten}
                readOnly={analysisSaved}
                analysisSaved={analysisSaved}
                savedResumeId={savedResumeId}
                onSaved={handleSaved}
              />
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

    </Container>
  );
}

export default App;
