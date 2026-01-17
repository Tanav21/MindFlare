import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import ReactMarkdown from 'react-markdown';
import './ConsultationReport.css';

const ConsultationReport = () => {
  const { id: appointmentId } = useParams();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');

  const fetchConsultationAndGenerateReport = async () => {
    try {
      const response = await api.get(
        `/consultations/appointment/${appointmentId}`
      );

      const { consultation, appointment } = response.data;

      const aiResponse = await api.post('/ai/consultation-report', {
        consultation,
        appointment,
      });

      setReport(aiResponse.data.report);
    } catch (err) {
      console.error(err);
      setError('Failed to load consultation report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultationAndGenerateReport();
  }, []);

  if (loading) return <div className="report-loading">Generating report…</div>;
  if (error) return <div className="report-error">{error}</div>;

  return (
    <div className="report-page">
      <div className="report-card">
        <h1 className="report-title">Consultation Report</h1>

        <div className="report-markdown">
          <ReactMarkdown>{report}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ConsultationReport;
