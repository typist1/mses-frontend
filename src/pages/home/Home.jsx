import React, { useState, useEffect, useContext, useRef } from 'react';
import mammoth from 'mammoth'
import styled from 'styled-components';
import axios from "axios";

import { Subtitle, Title } from '@/common/components/atoms/Text';
import UsersList from '@/common/components/users/UsersList';
import { UserContext } from '@/common/contexts/UserContext';
import SignUpModal from '../account/SignUp';

const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const HomePage = styled.div`
  flex: 1 0 0;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 2rem;
`;

export default function Home() {
  const { user } = useContext(UserContext);
  const fileInputRef = useRef(null); // Add this ref
  const [fileType, setFileType] = useState();
  const [fileUpload, setFileUpload] = useState();
  const [filePreview, setFilePreview] = useState();
  const [fileContent, setFileContent] = useState();
  const [jobURL, setJobURL] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobLoading, setJobLoading] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  const handleClear = () => {
    // Revoke object URL before clearing to prevent memory leak
    if (filePreview && fileType === 'pdf') {
      URL.revokeObjectURL(filePreview);
    }

    setFileType(null);
    setFileUpload(null);
    setFilePreview(null);
    setFileContent('');
    setJobURL('');
    setJobDescription('');
    setJobLoading(false);

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Clean up previous preview if it exists
    if (filePreview && fileType === 'pdf') {
      URL.revokeObjectURL(filePreview);
    }

    setFileUpload(file);

    if (file.type === "application/pdf") {
      setFileType('pdf');
      setFilePreview(URL.createObjectURL(file));

    } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      setFileType('docx');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setFilePreview(result.value);

    } else {
      window.alert("Please upload either a pdf or docx file");
      return;
    }

    handleExtractText(file);
  };

  const handleExtractText = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    console.log(file.name, file.type);
    try {
      const res = await axios.post(
        "http://localhost:5050/file/extractText",
        formData);
      console.log(res);
      console.log(res.data);
      setFileContent(res.data.text);
    } catch (err) {
      console.error("Error extracting text: ", err);
    }
  }

  const handleFetchJobDescription = async () => {
    try {
      if (isURLValid()) {
        setJobLoading(true);
        setJobDescription("Loading...");

        const res = await axios.post(
          "http://localhost:5050/file/extractJobDescription",
          { url: jobURL }
        )
        console.log(res);
        if (res.data.text) {
          setJobDescription(res.data.text)
        } else {
          window.alert("Error fetching job description. Please paste manually.")
        }
        setJobLoading(false);
        console.log(res);
      } else {
        setJobLoading(false);
        window.alert("Please enter a valid URL")
      }
    } catch (err) {
      setJobLoading(false);
      console.log(err);
      console.error("Error extracting job description: ", err);
      window.alert("Error fetching job description. Please paste manually.")
  }
  //attempt to fetch the job description from the site
  //might get blocked, user might have to paste in description
  //which should be very simple
}

const isURLValid = () => {
  var res = jobURL.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
  if (res == null)
    return false;
  else
    return true;
}

// Clean up on unmount
useEffect(() => {
  return () => {
    if (filePreview && fileType === 'pdf') {
      URL.revokeObjectURL(filePreview);
    }
  }
}, [filePreview, fileType])

return (
  <HomePage>
    <button onClick={() => setSignupOpen(true)}>Sign Up</button>
      <SignUpModal 
        open={signupOpen} 
        onClose={() => setSignupOpen(false)} 
      />

    <TextContainer>
      <Title>Home Page</Title>
      <Subtitle>Welcome, {user?.firstname || 'User'}!</Subtitle>
    </TextContainer>
    <button onClick={handleClear}>Clear</button>

    <h2>Upload Resume/CV (only pdf or docx files supported)</h2>
    <input
      ref={fileInputRef}
      type="file"
      placeholder="Upload Resume or CV"
      onChange={handleFileUpload}
      accept=".pdf,.docx"
    />
    <input type="url" value={jobURL} placeholder="Job URL" onChange={(e) => setJobURL(e.target.value)} />
    <button onClick={handleFetchJobDescription}>Fetch Job Description</button>
    {
      fileUpload && (
        <>
          {fileType === "pdf" && (
            <iframe
              src={filePreview}
              width="80%"
              height="100%"
              title="File preview"
            />
          )
          }
          {
            fileType === "docx" && (
              <div dangerouslySetInnerHTML={{ __html: filePreview }} />
            )
          }

        </>
      )
    }
    <textarea style={{ marginBottom: 10, padding: 10 }} value={jobDescription} placeholder="Job Description" onChange={(e) => setJobDescription(e.target.value)} />
    <textarea style={{ marginBottom: 10, padding: 10 }} value={fileContent} placeholder="Parsed Resume Text" onChange={(e) => setFileContent(e.target.value)} />
    <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  </HomePage>
);
}