import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import {
  Button, Container, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, CircularProgress,
} from '@mui/material';
import AnalysisResults from '../../common/components/AnalysisResults.jsx';
import '../../App.css';
import { UserContext } from '@/common/contexts/UserContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function Analysis() {
  const { getToken } = useContext(UserContext);

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
          <div style={{ margin: '12px 0', padding: '12px 16px', background: '#eff6ff', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            Viewing: <strong>{viewingItem.job_title}</strong> at <strong>{viewingItem.company}</strong>
            <Button size="small" style={{ marginLeft: 8 }} onClick={() => setViewingItem(null)}>← Back to List</Button>
          </div>
          <div className="results-divider">
            <h2>
              {viewingItem.job_title
                ? `${viewingItem.job_title}${viewingItem.company ? ` — ${viewingItem.company}` : ''}`
                : 'Analysis Results'}
            </h2>
          </div>
          <AnalysisResults
            analysis={viewingItem}
            readOnly={true}
            changeLogAccepted={{}}
          />
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
