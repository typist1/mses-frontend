import React, { useState, useRef, useEffect, useContext } from 'react';
import mammoth from 'mammoth';
import axios from 'axios';
import {
  Button,
  Container,
  TextField,
  Tooltip,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Clear,
  Link as LinkIcon,
} from '@mui/icons-material';
import help_outline from "../../assets/help_outline.svg";
import nuLogo from "../../assets/nuLogo.svg";
import '../../App.css';
import { UserContext } from '@/common/contexts/UserContext';
import SignUpModal from '../account/SignUp';

function App() {
  const { user, logout } = useContext(UserContext);
  const fileInputRef = useRef(null);

  // Resume states
  const [fileUpload, setFileUpload] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [fileContent, setFileContent] = useState('');

  // Job description states
  const [jobURL, setJobURL] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobLoading, setJobLoading] = useState(false);

  // Results states
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [matchScore, setMatchScore] = useState(0);
  const [results, setResults] = useState({
    matchingSkills: [],
    missingSkills: [],
    suggestions: [],
  });

  // Auth modal state
  const [signupOpen, setSignupOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      handleClear();
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to log out. Please try again.');
    }
  };

  const handleClear = () => {
    if (filePreview && fileType === 'pdf') {
      URL.revokeObjectURL(filePreview);
    }
    setFileType(null);
    setFileUpload(null);
    setFilePreview('');
    setFileContent('');
    setJobURL('');
    setJobDescription('');
    setJobLoading(false);
    setShowResults(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (filePreview && fileType === 'pdf') {
      URL.revokeObjectURL(filePreview);
    }

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

  const handleExtractText = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    console.log(file.name, file.type);

    try {
      const res = await axios.post('http://localhost:5050/file/extractText', formData);
      console.log(res);
      console.log(res.data);
      setFileContent(res.data.text);
    } catch (err) {
      console.error('Error extracting text:', err);
    }
  };

  const isURLValid = () => {
    const res = jobURL.match(
      /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g
    );
    return res !== null;
  };

  const handleFetchJobDescription = async () => {
    if (!isURLValid()) {
      alert('Please enter a valid URL');
      return;
    }

    setJobLoading(true);
    setJobDescription('Loading...');

    try {
      const res = await axios.post('http://localhost:5050/file/extractJobDescription', { url: jobURL });
      console.log(res);
      if (res.data.text) {
        setJobDescription(res.data.text);
      } else {
        alert('Error fetching job description. Please paste manually.');
      }
      setJobLoading(false);
    } catch (err) {
      console.error('Error extracting job description:', err);
      setJobLoading(false);
      // Fallback to demo data if backend is not available
      setJobDescription(
        `We are seeking a talented Full Stack Developer to join our growing team.\n\nResponsibilities:\n- Design and develop scalable web applications using React and Node.js\n- Collaborate with cross-functional teams to define and implement new features\n- Write clean, maintainable code following best practices\n- Deploy and maintain applications on AWS cloud infrastructure\n\nRequired Skills:\n- 3+ years of experience with JavaScript/TypeScript\n- Strong proficiency in React, Node.js, and Express\n- Experience with Python for backend development\n- Knowledge of AWS services and Docker containerization\n- Familiarity with CI/CD pipelines\n- Strong problem-solving skills and attention to detail\n\nNice to Have:\n- Experience with MongoDB or other NoSQL databases\n- Knowledge of microservices architecture\n- Contributions to open-source projects`
      );
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);

    try {
      // TODO: Replace with actual API call to analyze resume
      // const res = await axios.post('http://localhost:5050/analyze', {
      //   resume: fileContent,
      //   jobDescription: jobDescription
      // });

      // Simulate API call with demo data
      setTimeout(() => {
        setMatchScore(72);
        setResults({
          matchingSkills: ['React', 'JavaScript', 'TypeScript', 'Node.js'],
          missingSkills: ['Python', 'AWS', 'Docker'],
          suggestions: [
            'Add more specific metrics to quantify your achievements',
            'Include keywords: "cloud infrastructure", "CI/CD pipeline"',
            'Emphasize leadership experience in recent roles',
          ],
        });
        setIsOptimizing(false);
        setShowResults(true);
      }, 2000);
    } catch (err) {
      console.error('Error analyzing resume:', err);
      setIsOptimizing(false);
      alert('Error analyzing resume. Please try again.');
    }
  };

  const canOptimize = () => {
    return fileContent !== '' && jobDescription !== '' && !jobLoading;
  };

  useEffect(() => {
    return () => {
      if (filePreview && fileType === 'pdf') {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview, fileType]);

  return (
    <div className="app">
      <div className="header">
        <Container maxWidth="lg">
          <div className="header-content">
            <div className="header-left">
              <img src={nuLogo} style={{ maxWidth: 25 }} />
              <span className="header-title">Resume Optimizer</span>
            </div>
            <div className="header-right">
              {user ? (
                <Button className="btn-header" onClick={handleLogout}>
                  Sign Out
                </Button>
              ) : (
                <Button className="btn-header btn-primary" onClick={() => setSignupOpen(true)}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </Container>
      </div>

      <SignUpModal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
      />

      <Container maxWidth="lg" className="main-container">
        {/* Hero */}
        {!fileUpload && (
          <div className="hero">
            <h1>Optimize Your Resume for Any Job</h1>
            <p>Upload your resume and compare it against job descriptions to see how well you match</p>
          </div>
        )}

        {/* Clear button */}
        {(fileUpload || jobDescription) && (
          <div className="clear-section">
            <Button startIcon={<Clear />} onClick={handleClear} className="btn-clear">
              Clear All
            </Button>
          </div>
        )}

        {/* Upload Section */}
        <div className="section">
          <div className="section-header">
            <h2>1. Upload Your Resume</h2>
            <p>PDF or DOCX files supported</p>
          </div>
          <div className="section-body">
            <Button
              variant="contained"
              component="label"
              startIcon={<CloudUpload />}
              className="btn-upload"
            >
              {fileUpload ? fileUpload.name : 'Choose File'}
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".pdf,.docx"
                onChange={handleFileUpload}
              />
            </Button>
          </div>
        </div>

        {/* File Preview */}
        {fileUpload && (
          <div className="section">
            <div className="section-header">
              <h2>File Preview</h2>
            </div>
            <div className="preview-container">
              {fileType === 'pdf' && (
                <iframe src={filePreview} className="pdf-preview" title="Resume preview" />
              )}
              {fileType === 'docx' && (
                <div className="docx-preview" dangerouslySetInnerHTML={{ __html: filePreview }} />
              )}
            </div>
          </div>
        )}

        {/* Extracted Text */}
        {fileContent && (
          <div className="section">
            <div className="section-header">
              <div className="header-with-tooltip">
                <h2>Extracted Resume Text</h2>
                <Tooltip
                  title="Resume format should be as simple as possible to be easily parsed by automated resume screeners. Use standard fonts, clear section headers, and avoid complex formatting (e.g. columns, tables, graphics)."
                  arrow
                  placement="right"
                  slotProps={{
                    tooltip: {
                      sx: {
                        fontSize: '16px',
                      },
                    },
                  }}
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

        {/* Job Description */}
        <div className="section">
          <div className="section-header">
            <h2>2. Add Job Description</h2>
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
                InputProps={{
                  startAdornment: <LinkIcon className="url-icon" />,
                }}
              />
              <Button
                variant="contained"
                onClick={handleFetchJobDescription}
                disabled={jobLoading || !jobURL}
                className="btn-fetch"
              >
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

        {/* Analyze Button */}
        <div className="analyze-section">
          <Button
            variant="contained"
            size="large"
            onClick={handleOptimize}
            disabled={!user || !canOptimize() || isOptimizing}
            className="btn-analyze"
          >
            {isOptimizing ? 'Analyzing...' : 'Analyze Resume'}
          </Button>
        </div>

        {/* Results */}
        {showResults && (
          <>
            <div className="results-divider">
              <h2>Analysis Results</h2>
            </div>

            {/* Match Score */}
            <div className="section score-section">
              <div className="score-content">
                <div className="score-circle" style={{
                  background: `conic-gradient(${matchScore >= 70 ? '#10b981' : '#f59e0b'} ${matchScore * 3.6}deg, #e5e7eb 0deg)`
                }}>
                  <div className="score-inner">
                    <div className="score-number">{matchScore}%</div>
                    <div className="score-label">Match</div>
                  </div>
                </div>
                <div className="score-message">
                  {matchScore >= 70
                    ? 'Your resume is a good match for this position'
                    : 'Your resume could be improved to better match this job'}
                </div>
              </div>
            </div>

            {/* Skills Grid */}
            <div className="skills-grid">
              <div className="section">
                <div className="section-header">
                  <h3>✓ Matching Skills</h3>
                </div>
                <div className="skills-list">
                  {results.matchingSkills.map((skill, index) => (
                    <div key={index} className="skill-tag skill-match">
                      {skill}
                    </div>
                  ))}
                </div>
              </div>

              <div className="section">
                <div className="section-header">
                  <h3>⚠ Missing Skills</h3>
                </div>
                <div className="skills-list">
                  {results.missingSkills.map((skill, index) => (
                    <div key={index} className="skill-tag skill-missing">
                      {skill}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Suggestions */}
            <div className="section">
              <div className="section-header">
                <h3>💡 Suggestions for Improvement</h3>
              </div>
              <div className="section-body">
                <ul className="suggestions">
                  {results.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </Container>
    </div>
  );
}

export default App;