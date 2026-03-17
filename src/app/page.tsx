'use client';

import { useState, useEffect, useRef } from 'react';
import GuidedFlow from '@/components/GuidedFlow';
import LeadTable from '@/components/LeadTable';
import ErrorBoundary from '@/components/ErrorBoundary';
import { GenerationParams, Lead, PipelineStats, SearchHistoryEntry } from '@/types';
import { FiLoader, FiCheckCircle, FiDatabase, FiTarget, FiMessageSquare, FiAlertTriangle, FiRefreshCw, FiClock } from 'react-icons/fi';
import styles from './page.module.css';

const SESSION_KEY = 'careerx_session';
const HISTORY_KEY = 'careerx_history';

export default function Home() {
  const [phase, setPhase]               = useState<'gathering' | 'processing' | 'results' | 'error'>('gathering');
  const [processingStep, setProcessingStep] = useState(0);
  const [leads, setLeads]               = useState<Lead[]>([]);
  const [isExporting, setIsExporting]   = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [mockWarning, setMockWarning]   = useState<string | null>(null);
  const [stats, setStats]               = useState<PipelineStats | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [elapsed, setElapsed]           = useState(0);
  const timerRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const { leads: l, stats: s, mockWarning: m } = JSON.parse(saved);
        if (l?.length) { setLeads(l); setStats(s || null); setMockWarning(m || null); setPhase('results'); }
      }
      const hist = localStorage.getItem(HISTORY_KEY);
      if (hist) setSearchHistory(JSON.parse(hist));
    } catch { /* ignore corrupt localStorage */ }
  }, []);

  // ── Persist session whenever leads change ─────────────────────────────────
  useEffect(() => {
    if (leads.length > 0) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ leads, stats, mockWarning }));
      } catch { /* storage full, ignore */ }
    }
  }, [leads, stats, mockWarning]);

  // ── Elapsed timer helpers ─────────────────────────────────────────────────
  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };
  useEffect(() => () => stopTimer(), []);

  const fmtElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Main pipeline ─────────────────────────────────────────────────────────
  const handleFlowComplete = async (params: GenerationParams) => {
    setPhase('processing');
    setErrorMessage('');
    setMockWarning(null);
    setStats(null);
    setElapsed(0);

    try {
      // Step 1 — Generate strategy
      setProcessingStep(1);
      const strategyRes = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!strategyRes.ok) throw new Error((await strategyRes.json()).error || 'Failed to generate strategy');
      const strategy = await strategyRes.json();

      // Step 2 — Scrape (with elapsed timer)
      setProcessingStep(2);
      startTimer();
      const scrapeRes = await fetch('/api/scrape-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy, params }),
      });
      stopTimer();
      if (!scrapeRes.ok) throw new Error((await scrapeRes.json()).error || 'Failed to scrape leads');
      const scrapeData = await scrapeRes.json();
      const profiles: any[] = scrapeData.profiles || [];
      const warnings: string[] = [];
      if (scrapeData.isMock) warnings.push(`Profiles: ${scrapeData.mockReason}`);

      // Step 3 — Qualify
      setProcessingStep(3);
      const qualifyRes = await fetch('/api/qualify-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles, params }),
      });
      if (!qualifyRes.ok) throw new Error((await qualifyRes.json()).error || 'Qualification engine failure');
      const qualifyData = await qualifyRes.json();

      if (qualifyData.isMock) warnings.push(`Scoring: ${qualifyData.mockReason}`);
      if (qualifyData.partialMock) warnings.push(`Scoring: ${qualifyData.mockReason}`);

      const pipelineStats: PipelineStats = {
        scraped:   qualifyData.scrapedCount  ?? profiles.length,
        qualified: qualifyData.qualifiedCount ?? (qualifyData.leads || []).length,
        rejected:  qualifyData.rejectedCount  ?? Math.max(0, profiles.length - (qualifyData.leads || []).length),
      };

      setMockWarning(warnings.length > 0 ? warnings.join(' · ') : null);
      setStats(pipelineStats);
      setLeads(qualifyData.leads || []);

      // Save to search history
      const entry: SearchHistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        params,
        qualifiedCount: pipelineStats.qualified,
      };
      setSearchHistory(prev => {
        const updated = [entry, ...prev].slice(0, 5);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
        return updated;
      });

      setPhase('results');

    } catch (error: any) {
      stopTimer();
      console.error('Lead generation failed:', error);
      setErrorMessage(error.message || 'An unexpected error occurred during lead discovery.');
      setPhase('error');
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStatusChange = (leadId: string, status: Lead['status']) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
  };

  const handleExportSheets = async (filteredLeads: Lead[]) => {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const res = await fetch('/api/export-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: filteredLeads }),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = data.duplicatesFound > 0
          ? `Exported ${data.totalSent} leads (${data.duplicatesFound} already in sheet)`
          : `Exported ${data.totalSent} leads to Google Sheets`;
        setExportMessage(msg);
        setTimeout(() => setExportMessage(null), 4000);
      } else {
        throw new Error(data.error || 'Export failed');
      }
    } catch (error: any) {
      console.error('Export error:', error);
      setExportMessage(`Export failed: ${error.message}`);
      setTimeout(() => setExportMessage(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLeadFeedback = async (lead: Lead, feedback: Lead['feedback']) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, feedback } : l));
    try {
      await fetch('/api/lead-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, linkedinUrl: lead.linkedinUrl, feedback, name: lead.name }),
      });
    } catch (e) { console.error('Failed to send feedback:', e); }
  };

  const handleNewSearch = () => {
    setPhase('gathering');
    localStorage.removeItem(SESSION_KEY);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container">

      {/* ── Gathering ── */}
      {phase === 'gathering' && (
        <div className="animate-fade-in">
          <div className={styles.heroSection}>
            <h1 className="text-gradient">CareerXcelerator Discovery</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Identify high-intent candidates globally. Our AI browses platforms, applies strict quality guardrails, and exports vetted leads directly to your workspace.
            </p>
          </div>

          {/* Search history */}
          {searchHistory.length > 0 && (
            <div className={styles.historyBar}>
              <span className={styles.historyLabel}>Recent searches:</span>
              {searchHistory.map(h => (
                <button
                  key={h.id}
                  className={styles.historyChip}
                  onClick={() => handleFlowComplete(h.params)}
                  title={`${new Date(h.timestamp).toLocaleDateString()} · ${h.qualifiedCount} leads`}
                >
                  {h.params.fields} · {h.params.originCountry} · {h.qualifiedCount} leads
                </button>
              ))}
            </div>
          )}

          <ErrorBoundary>
            <GuidedFlow onComplete={handleFlowComplete} />
          </ErrorBoundary>
        </div>
      )}

      {/* ── Processing ── */}
      {phase === 'processing' && (
        <div className={`${styles['processing-container']} animate-fade-in`}>
          <div className={`glass-panel ${styles['processing-card']}`}>
            <div className={styles['processing-header']}>
              <div className={styles.pulseRing}></div>
              <FiLoader className={styles.spinner} size={48} />
              <h2 style={{ marginTop: '1.5rem' }} className="text-gradient">CareerXcelerator Agent at Work</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Applying strict guardrails and filtering noise…</p>
            </div>

            <div className={styles.processingSteps}>
              <div className={`${styles.step} ${processingStep >= 1 ? styles.stepActive : ''}`}>
                <div className={styles.stepIcon}>{processingStep > 1 ? <FiCheckCircle /> : <FiTarget />}</div>
                <div className={styles.stepText}>
                  <h4>Formulating Search Strategy</h4>
                  <p>Analyzing parameters to find the best platforms and queries</p>
                </div>
              </div>
              <div className={`${styles.step} ${processingStep >= 2 ? styles.stepActive : ''}`}>
                <div className={styles.stepIcon}>{processingStep > 2 ? <FiCheckCircle /> : <FiDatabase />}</div>
                <div className={styles.stepText}>
                  <h4>Gathering Profiles</h4>
                  <p>Running Apify actors to collect potential leads</p>
                </div>
                {processingStep === 2 && elapsed > 0 && (
                  <div className={styles.elapsedBadge}>
                    <FiClock size={11} /> {fmtElapsed(elapsed)}
                  </div>
                )}
              </div>
              <div className={`${styles.step} ${processingStep >= 3 ? styles.stepActive : ''}`}>
                <div className={styles.stepIcon}>{processingStep > 3 ? <FiCheckCircle /> : <FiMessageSquare />}</div>
                <div className={styles.stepText}>
                  <h4>Strict Qualification (12 Guardrails)</h4>
                  <p>Rejecting irrelevant profiles and scoring for high intent</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {phase === 'error' && (
        <div className={`${styles['processing-container']} animate-fade-in`}>
          <div className={`glass-panel ${styles['processing-card']} ${styles['error-card']}`}>
            <FiAlertTriangle size={64} color="#ef4444" />
            <h2 className="text-gradient" style={{ marginTop: '1.5rem' }}>Discovery Interrupted</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{errorMessage}</p>
            <button className="btn btn-primary" onClick={() => setPhase('gathering')}>
              <FiRefreshCw className="mr-2" /> Try Again
            </button>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'results' && (
        <div className="animate-fade-in">
          {mockWarning && (
            <div className={styles.mockBanner}>
              <FiAlertTriangle size={15} />
              <strong>Demo data shown</strong> — {mockWarning}
            </div>
          )}

          {exportMessage && (
            <div className={`${styles.exportToast} ${exportMessage.startsWith('Export failed') ? styles.exportToastError : ''}`}>
              <FiCheckCircle size={18} /> {exportMessage}
            </div>
          )}

          <div className={styles.resultsHeader}>
            <div>
              <h1 className="text-gradient">Qualified Leads Found</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Quality Score threshold (≥6) applied. Adjust with the score slider below.</p>
            </div>
            <button className="btn btn-secondary" onClick={handleNewSearch}>
              Start New Search
            </button>
          </div>

          <ErrorBoundary>
            <LeadTable
              leads={leads}
              onExportSheets={handleExportSheets}
              onFeedback={handleLeadFeedback}
              onStatusChange={handleStatusChange}
              isExporting={isExporting}
              stats={stats ?? undefined}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
