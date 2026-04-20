import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
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
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Download,
  Visibility,
  Star,
  StarBorder,
  Close,
} from '@mui/icons-material';
import mammoth from 'mammoth';
import { UserContext } from '@/common/contexts/UserContext';
import './Resumes.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function Resumes() {
  const { user, getToken } = useContext(UserContext);
  const fileInputRef = useRef(null);

  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const token = await getToken();
      await axios.post(`${BACKEND_URL}/resumes/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

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

      fetchResumes();
    } catch (error) {
      console.error('Error setting active resume:', error);
      alert('Failed to set active resume. Please try again.');
    }
  };

  const handleView = async (resume) => {
    try {
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
        const url = URL.createObjectURL(blob);
        setPreviewContent(url);
      } else if (fileType === 'docx') {
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
          <div className="resumes-grid">
            {resumes.map((resume) => (
              <Card key={resume.id} className={`resume-card ${resume.is_active ? 'active' : ''}`}>
                <CardContent>
                  <div className="resume-card-header">
                    <div className="resume-info">
                      <h3>{resume.file_name}</h3>
                      <div className="resume-meta">
                        <span>{formatFileSize(resume.file_size)}</span>
                        <span>•</span>
                        <span>{formatDate(resume.created_at)}</span>
                      </div>
                    </div>
                    {resume.is_active && (
                      <Chip 
                        label="Active" 
                        color="success" 
                        size="small"
                        className="active-chip"
                      />
                    )}
                  </div>

                  <div className="resume-actions">
                    <Tooltip title={resume.is_active ? "Active resume" : "Set as active"}>
                      <IconButton
                        onClick={() => handleSetActive(resume.id)}
                        disabled={resume.is_active}
                        className="icon-btn"
                      >
                        {resume.is_active ? <Star color="warning" /> : <StarBorder />}
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="View">
                      <IconButton onClick={() => handleView(resume)} className="icon-btn">
                        <Visibility />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Download">
                      <IconButton onClick={() => handleDownload(resume)} className="icon-btn">
                        <Download />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Delete">
                      <IconButton 
                        onClick={() => handleDelete(resume.id, resume.file_name)}
                        className="icon-btn icon-btn-danger"
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
    </div >
  );
}

export default Resumes;