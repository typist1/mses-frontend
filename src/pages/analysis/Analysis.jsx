import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { useSnackbar } from '@/common/contexts/SnackbarContext';
import {
  Button, Container, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, CircularProgress, TextField, Select, MenuItem, FormControl,
  InputLabel, InputAdornment, Box,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import AnalysisResults from '../../common/components/AnalysisResults.jsx';
import '../../App.css';
import { UserContext } from '@/common/contexts/UserContext';

import { BACKEND_URL } from '@/utils/constants';

const DATE_PRESETS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '3m', label: 'Last 3 months' },
];

function Analysis() {
  const { getToken } = useContext(UserContext);
  const showSnackbar = useSnackbar();

  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('none');
  const [datePreset, setDatePreset] = useState('all');

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoffDays = { '7d': 7, '30d': 30, '3m': 90 };
    const days = cutoffDays[datePreset];
    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;

    return historyList
      .filter((item) => {
        if (q && !item.job_title?.toLowerCase().includes(q) && !item.company?.toLowerCase().includes(q)) return false;
        if (cutoff && new Date(item.created_at) < cutoff) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'asc') return a.overall_fit_score - b.overall_fit_score;
        if (sortOrder === 'desc') return b.overall_fit_score - a.overall_fit_score;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [historyList, search, sortOrder, datePreset]);

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
      showSnackbar('Failed to load analysis', 'error');
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
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                Filters
              </div>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 2, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search job title or company…"
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
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Fit Score</InputLabel>
                  <Select value={sortOrder} label="Fit Score" onChange={(e) => setSortOrder(e.target.value)}>
                    <MenuItem value="none">Default</MenuItem>
                    <MenuItem value="desc">High → Low</MenuItem>
                    <MenuItem value="asc">Low → High</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {filteredList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
                  No analyses match your filters.
                </div>
              ) : (
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
                    {filteredList.map((item) => (
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
            </>
          )}
        </div>
      )}
    </Container>
  );
}

export default Analysis;
