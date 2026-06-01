import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Container,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogContent,
  CircularProgress,
  Chip,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Box,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Download,
  Edit,
  Visibility,
  Star,
  StarBorder,
  Close,
  ExpandMore,
  ExpandLess,
  Search,
} from '@mui/icons-material';
import mammoth from 'mammoth';
import { buildDocx, Packer } from '@/utils/buildDocx';
import { UserContext } from '@/common/contexts/UserContext';
import './Resumes.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const DATE_PRESETS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '3m', label: 'Last 3 months' },
];

// Converts DB-format parsed_resume → buildDocx-compatible format
function prepareForDocx(parsedResume) {
  const skills = Array.isArray(parsedResume.skills)
    ? parsedResume.skills
    : [
        { id: 'sk-tech',  category: 'Technical',  items: (parsedResume.skills?.technical  || []).join(', ') },
        { id: 'sk-tools', category: 'Tools',       items: (parsedResume.skills?.tools      || []).join(', ') },
        { id: 'sk-lang',  category: 'Languages',   items: (parsedResume.skills?.languages  || []).join(', ') },
        { id: 'sk-soft',  category: 'Soft Skills', items: (parsedResume.skills?.soft       || []).join(', ') },
      ].filter((r) => r.items);

  return {
    ...parsedResume,
    skills,
    projects: (parsedResume.projects || []).map((p) => ({
      ...p,
      tech: Array.isArray(p.tech) ? p.tech.join(', ') : (p.tech || ''),
    })),
  };
}

function Resumes() {
  const { user, getToken } = useContext(UserContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const pendingTopIdRef = useRef(null);

  const [resumes, setResumes] = useState([]);
  const [orderedGroups, setOrderedGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState({});
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('all');

  // Preview modal states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewResume, setPreviewResume] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewType, setPreviewType] = useState('');

  useEffect(() => {
    if (user) {
      fetchResumes();
    }
  }, [user]);

  const persistOrder = useCallback(async (groups) => {
    try {
      const token = await getToken();
      await axios.put(`${BACKEND_URL}/resumes/reorder`, {
        items: groups.map((g, i) => ({ id: g.id, sort_order: i })),
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.error('Error persisting resume order:', err);
    }
  }, [getToken]);

  const moveGroupToTop = useCallback((rootId) => {
    setOrderedGroups((prev) => {
      const idx = prev.findIndex((r) => r.id === rootId);
      if (idx <= 0) return prev;
      const newOrder = [prev[idx], ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      persistOrder(newOrder);
      return newOrder;
    });
  }, [persistOrder]);

  useEffect(() => {
    let groups = resumes.filter((r) => !r.parent_resume_id);
    let topId = pendingTopIdRef.current;
    pendingTopIdRef.current = null;
    if (!topId) {
      topId = localStorage.getItem('resumeJustEdited');
    }
    if (topId) {
      const idx = groups.findIndex((r) => r.id === topId);
      if (idx > 0) {
        localStorage.removeItem('resumeJustEdited');
        const newOrder = [groups[idx], ...groups.slice(0, idx), ...groups.slice(idx + 1)];
        persistOrder(newOrder);
        setOrderedGroups(newOrder);
        return;
      } else if (idx === 0) {
        localStorage.removeItem('resumeJustEdited');
      }
    }
    // Preserve current order on data refresh; use server order only on initial load
    setOrderedGroups((prev) => {
      if (prev.length === 0) return groups;
      const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));
      const preserved = prev.filter((r) => groupById[r.id]).map((r) => groupById[r.id]);
      const prevIds = new Set(prev.map((r) => r.id));
      const newGroups = groups.filter((g) => !prevIds.has(g.id));
      return [...preserved, ...newGroups];
    });
  }, [resumes, persistOrder]);

  const versionMap = useMemo(() => {
    const map = {};
    resumes.filter((r) => r.parent_resume_id).forEach((r) => {
      if (!map[r.parent_resume_id]) map[r.parent_resume_id] = [];
      map[r.parent_resume_id].push(r);
    });
    return map;
  }, [resumes]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoffDays = { '7d': 7, '30d': 30, '3m': 90 };
    const days = cutoffDays[datePreset];
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
    return orderedGroups.filter((r) => {
      if (q && !r.file_name.toLowerCase().includes(q)) return false;
      if (cutoff && new Date(r.created_at) < cutoff) return false;
      return true;
    });
  }, [orderedGroups, search, datePreset]);

  const fetchResumes = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await axios.get(`${BACKEND_URL}/resumes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResumes(response.data.resumes || []);
    } catch (error) {
      console.error('Error fetching resumes:', error);
      alert('Failed to load resumes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' &&
      file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      alert('Please upload either a PDF or DOCX file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const dupName = resumes.find((r) => r.file_name.toLowerCase() === file.name.toLowerCase());
    if (dupName) {
      alert(`A resume named "${file.name}" already exists. Rename your file before uploading.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const token = await getToken();
      const uploadResponse = await axios.post(`${BACKEND_URL}/resumes/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      pendingTopIdRef.current = uploadResponse.data.resume?.id;
      alert('Resume uploaded successfully!');
      fetchResumes();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      alert(error.response?.data?.error || 'Failed to upload resume. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (resumeId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    try {
      const token = await getToken();
      await axios.delete(`${BACKEND_URL}/resumes/${resumeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert('Resume deleted successfully!');
      fetchResumes();
    } catch (error) {
      console.error('Error deleting resume:', error);
      alert('Failed to delete resume. Please try again.');
    }
  };

  const handleSetActive = async (resumeId) => {
    try {
      const token = await getToken();
      await axios.put(`${BACKEND_URL}/resumes/${resumeId}/active`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const resume = resumes.find((r) => r.id === resumeId);
      pendingTopIdRef.current = resume?.parent_resume_id || resumeId;
      fetchResumes();
    } catch (error) {
      console.error('Error setting active resume:', error);
      alert('Failed to set active resume. Please try again.');
    }
  };

  const handleRenameStart = (resume) => {
    setRenamingId(resume.id);
    setRenameValue(resume.file_name.replace(/\.[^/.]+$/, ''));
    setRenameError('');
  };

  const handleRenameCommit = async (resume) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === resume.file_name.replace(/\.[^/.]+$/, '')) {
      setRenamingId(null);
      setRenameError('');
      return;
    }
    const ext = resume.file_name.match(/\.[^/.]+$/)?.[0] || '';
    const newName = trimmed + ext;
    const dup = resumes.find((r) => r.id !== resume.id && r.file_name.toLowerCase() === newName.toLowerCase());
    if (dup) {
      setRenameError(`"${newName}" already exists.`);
      return;
    }
    setRenamingId(null);
    setRenameError('');
    try {
      const token = await getToken();
      await axios.patch(`${BACKEND_URL}/resumes/${resume.id}`, { file_name: newName }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rootId = resume.parent_resume_id || resume.id;
      moveGroupToTop(rootId);
      fetchResumes();
    } catch (error) {
      console.error('Error renaming resume:', error);
      alert(error.response?.data?.error || 'Failed to rename resume. Please try again.');
    }
  };

  const handleView = async (resume) => {
    try {
      if (resume.parsed_resume) {
        const doc = buildDocx(prepareForDocx(resume.parsed_resume));
        const blob = await Packer.toBlob(doc);
        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setPreviewResume(resume);
        setPreviewType('docx');
        setPreviewContent(result.value);
        setPreviewOpen(true);
        return;
      }

      const token = await getToken();
      const response = await axios.get(`${BACKEND_URL}/resumes/${resume.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      const blob = response.data;
      const fileType = resume.file_name.endsWith('.pdf') ? 'pdf' : 'docx';

      setPreviewResume(resume);
      setPreviewType(fileType);

      if (fileType === 'pdf') {
        setPreviewContent(URL.createObjectURL(blob));
      } else {
        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setPreviewContent(result.value);
      }

      setPreviewOpen(true);
    } catch (error) {
      console.error('Error viewing resume:', error);
      alert('Failed to load resume preview. Please try again.');
    }
  };

  const handleDownload = async (resume) => {
    try {
      if (resume.parsed_resume) {
        const doc = buildDocx(prepareForDocx(resume.parsed_resume));
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = resume.file_name.replace(/\.[^/.]+$/, '') + '.docx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const token = await getToken();
      const response = await axios.get(`${BACKEND_URL}/resumes/${resume.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = resume.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading resume:', error);
      alert('Failed to download resume. Please try again.');
    }
  };

  const handleClosePreview = () => {
    if (previewContent && previewType === 'pdf') {
      URL.revokeObjectURL(previewContent);
    }
    setPreviewOpen(false);
    setPreviewContent('');
    setPreviewType('');
    setPreviewResume(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const ResumeCard = ({ resume, isVersion }) => (
    <Card
      className={`resume-card ${resume.is_active ? 'active' : ''}`}
      style={isVersion ? { marginLeft: 24, marginTop: 8, borderLeft: '3px solid #e5e7eb' } : {}}
    >
      <CardContent>
        <div className="resume-card-header">
          <div className="resume-info">
            <h3>
              {resume.version_label && (
                <Chip label={resume.version_label} size="small" style={{ marginRight: 6 }} />
              )}
              {renamingId === resume.id ? (
                <>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
                    onBlur={() => handleRenameCommit(resume)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCommit(resume);
                      if (e.key === 'Escape') { setRenamingId(null); setRenameError(''); }
                    }}
                    style={{ fontSize: 'inherit', fontWeight: 'inherit', border: `1px solid ${renameError ? '#ef4444' : '#2563eb'}`, borderRadius: 4, padding: '2px 6px', outline: 'none', width: '80%' }}
                  />
                  {renameError && <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 400, marginTop: 2 }}>{renameError}</div>}
                </>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} className="resume-name-row">
                  {resume.file_name}
                  <IconButton
                    size="small"
                    onClick={() => handleRenameStart(resume)}
                    title="Rename"
                    className="rename-btn"
                    style={{ padding: 2, opacity: 0, transition: 'opacity 0.15s' }}
                  >
                    <Edit style={{ fontSize: 14 }} />
                  </IconButton>
                </span>
              )}
            </h3>
            <div className="resume-meta">
              <span>{formatFileSize(resume.file_size)}</span>
              <span>•</span>
              <span>{formatDate(resume.created_at)}</span>
            </div>
          </div>
          {resume.is_active && <Chip label="Active" color="success" size="small" className="active-chip" />}
        </div>
        <div className="resume-actions">
          <Tooltip title={resume.is_active ? 'Active resume' : 'Set as active'}>
            <IconButton onClick={() => handleSetActive(resume.id)} disabled={resume.is_active} className="icon-btn">
              {resume.is_active ? <Star color="warning" /> : <StarBorder />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton onClick={() => navigate(`/editor/${resume.id}`)} className="icon-btn">
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="View">
            <IconButton onClick={() => handleView(resume)} className="icon-btn"><Visibility /></IconButton>
          </Tooltip>
          <Tooltip title="Download">
            <IconButton onClick={() => handleDownload(resume)} className="icon-btn"><Download /></IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton onClick={() => handleDelete(resume.id, resume.file_name)} className="icon-btn icon-btn-danger">
              <Delete />
            </IconButton>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );

  const renderGroup = (resume) => {
    const versions = versionMap[resume.id] || [];
    const isExpanded = expandedVersions[resume.id];
    return (
      <>
        <ResumeCard resume={resume} isVersion={false} />
        {versions.length > 0 && (
          <>
            <div
              style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}
              onClick={() => setExpandedVersions((prev) => ({ ...prev, [resume.id]: !prev[resume.id] }))}
            >
              {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              {versions.length} version{versions.length > 1 ? 's' : ''}
            </div>
            {isExpanded && versions.map((v) => (
              <ResumeCard key={v.id} resume={v} isVersion />
            ))}
          </>
        )}
      </>
    );
  };

  return (
    <div>
      <Container maxWidth="lg" className="main-container">
        <div className="resumes-header">
          <div>
            <h1>My Resumes</h1>
            <p>Manage your resumes and set which one is active for job applications</p>
          </div>
          <Button
            variant="contained"
            component="label"
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
            className="btn-upload"
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Resume'}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".pdf,.docx"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </Button>
        </div>

        {loading ? (
          <div className="loading-container">
            <CircularProgress />
            <p>Loading your resumes...</p>
          </div>
        ) : resumes.length === 0 ? (
          <div className="empty-state">
            <CloudUpload style={{ fontSize: 64, color: '#ccc' }} />
            <h2>No resumes yet</h2>
            <p>Upload your first resume to get started</p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Filters
            </div>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search by resume name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 240 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Date</InputLabel>
                <Select value={datePreset} label="Date" onChange={(e) => setDatePreset(e.target.value)}>
                  {DATE_PRESETS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <div className="resumes-grid">
              {filteredGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
                  No resumes match your search.
                </div>
              ) : filteredGroups.map((resume) => (
                <div key={resume.id}>
                  {renderGroup(resume)}
                </div>
              ))}
            </div>
          </>
        )}
      </Container>

      <Dialog
        open={previewOpen}
        onClose={handleClosePreview}
        maxWidth="md"
        fullWidth
        className="preview-dialog"
      >
        <div className="preview-dialog-header">
          <h2>{previewResume?.file_name}</h2>
          <IconButton onClick={handleClosePreview}>
            <Close />
          </IconButton>
        </div>
        <DialogContent className="preview-dialog-content">
          {previewType === 'pdf' && (
            <iframe
              src={previewContent}
              className="pdf-preview-modal"
              title="Resume preview"
            />
          )}
          {previewType === 'docx' && (
            <div
              className="docx-preview-modal"
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Resumes;
