'use client';
import { useState, useMemo } from 'react';
import styles from './LeadTable.module.css';
import { Lead, PipelineStats } from '@/types';
import {
  FiDownload, FiShare2, FiExternalLink, FiAlertCircle, FiCheck,
  FiThumbsUp, FiThumbsDown, FiUserCheck, FiSearch,
  FiChevronUp, FiChevronDown, FiCopy, FiBarChart2, FiX,
} from 'react-icons/fi';

interface LeadTableProps {
  leads: Lead[];
  onExportSheets: (leads: Lead[]) => void;
  onFeedback: (lead: Lead, feedback: Lead['feedback']) => void;
  onStatusChange: (leadId: string, status: Lead['status']) => void;
  isExporting?: boolean;
  stats?: PipelineStats;
}

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  LinkedIn: { label: 'LI', color: '#0a66c2' },
  Google:   { label: 'GG', color: '#ea4335' },
  GitHub:   { label: 'GH', color: '#6e5494' },
  Reddit:   { label: 'RD', color: '#ff4500' },
};

const STATUS_OPTIONS: Lead['status'][] = ['new', 'contacted', 'replied', 'call booked', 'converted'];
const STATUS_COLORS: Record<string, string> = {
  new:         '#64748b',
  contacted:   '#3b82f6',
  replied:     '#f59e0b',
  'call booked': '#8b5cf6',
  converted:   '#10b981',
};

type SortKey = 'qualityScore' | 'intentScore' | 'graduationYear' | 'name';

export default function LeadTable({
  leads, onExportSheets, onFeedback, onStatusChange, isExporting = false, stats,
}: LeadTableProps) {
  const [minScore, setMinScore]           = useState(6);
  const [filterReview, setFilterReview]   = useState('all');
  const [filterUniversity, setFilterUniversity] = useState('all');
  const [filterPlatform, setFilterPlatform]     = useState('all');
  const [searchName, setSearchName]       = useState('');
  const [sortBy, setSortBy]               = useState<SortKey>('qualityScore');
  const [sortDir, setSortDir]             = useState<'desc' | 'asc'>('desc');
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [expandedOutreach, setExpandedOutreach] = useState<string | null>(null);
  const [copiedId, setCopiedId]           = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const universities = useMemo(
    () => Array.from(new Set(leads.map(l => l.university).filter(Boolean))).sort(),
    [leads],
  );
  const platforms = useMemo(
    () => Array.from(new Set(leads.map(l => l.metadata?.platform as string).filter(Boolean))).sort(),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const result = leads.filter(lead => {
      if ((lead.qualityScore ?? 0) < minScore) return false;
      if (filterReview !== 'all' && lead.reviewFlag !== filterReview) return false;
      if (filterUniversity !== 'all' && lead.university !== filterUniversity) return false;
      if (filterPlatform !== 'all' && lead.metadata?.platform !== filterPlatform) return false;
      if (searchName && !lead.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      return true;
    });
    result.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortBy === 'qualityScore')  { av = a.qualityScore ?? 0; bv = b.qualityScore ?? 0; }
      else if (sortBy === 'intentScore') { av = a.intentScore ?? 0; bv = b.intentScore ?? 0; }
      else if (sortBy === 'graduationYear') { av = a.graduationYear || ''; bv = b.graduationYear || ''; }
      else if (sortBy === 'name')     { av = a.name; bv = b.name; }
      if (sortDir === 'desc') return av < bv ? 1 : av > bv ? -1 : 0;
      return av > bv ? 1 : av < bv ? -1 : 0;
    });
    return result;
  }, [leads, minScore, filterReview, filterUniversity, filterPlatform, searchName, sortBy, sortDir]);

  // Analytics data
  const analytics = useMemo(() => {
    const scoreDist: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) scoreDist[i] = 0;
    const uniCounts: Record<string, number> = {};
    const fieldCounts: Record<string, number> = {};
    const platformCounts: Record<string, number> = {};
    leads.forEach(l => {
      if (l.qualityScore) scoreDist[l.qualityScore] = (scoreDist[l.qualityScore] || 0) + 1;
      if (l.university) uniCounts[l.university] = (uniCounts[l.university] || 0) + 1;
      if (l.fieldOfStudy) fieldCounts[l.fieldOfStudy] = (fieldCounts[l.fieldOfStudy] || 0) + 1;
      const p = (l.metadata?.platform as string) || 'Unknown';
      platformCounts[p] = (platformCounts[p] || 0) + 1;
    });
    return {
      scoreDist,
      topUnis: Object.entries(uniCounts).sort(([, a], [, b]) => b - a).slice(0, 8),
      topFields: Object.entries(fieldCounts).sort(([, a], [, b]) => b - a).slice(0, 6),
      byPlatform: Object.entries(platformCounts).sort(([, a], [, b]) => b - a),
    };
  }, [leads]);

  const handleSortBy = (col: SortKey) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const allSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedIds.has(l.id));
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(filteredLeads.map(l => l.id)));
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleBulkStatus = (status: Lead['status']) => {
    selectedIds.forEach(id => onStatusChange(id, status));
    setSelectedIds(new Set());
  };

  const handleCopyEmail = (lead: Lead) => {
    if (!lead.email) return;
    navigator.clipboard.writeText(lead.email);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportCSV = () => {
    const headers = ['Name', 'LinkedIn', 'University', 'Degree', 'Field', 'Grad Year', 'Email', 'Platform', 'Quality Score', 'Intent Score', 'Seeking Internship', 'Seeking Full-time', 'Status', 'Review Flag', 'Outreach'];
    const rows = filteredLeads.map(l => {
      const msg = editedMessages[l.id] ?? l.outreachMessage;
      return [
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.linkedinUrl || '').replace(/"/g, '""')}"`,
        `"${(l.university || '').replace(/"/g, '""')}"`,
        `"${(l.degree || '').replace(/"/g, '""')}"`,
        `"${(l.fieldOfStudy || '').replace(/"/g, '""')}"`,
        l.graduationYear || '',
        l.email || '',
        (l.metadata?.platform as string) || '',
        l.qualityScore ?? '',
        l.intentScore ?? '',
        l.seekingInternship ? 'Yes' : 'No',
        l.seekingFullTime ? 'Yes' : 'No',
        l.status || 'new',
        l.reviewFlag || '',
        `"${(msg || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'careerx_leads.csv'; a.click();
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return <FiChevronUp style={{ opacity: 0.3, flexShrink: 0 }} size={12} />;
    return sortDir === 'desc'
      ? <FiChevronDown style={{ flexShrink: 0 }} size={12} />
      : <FiChevronUp style={{ flexShrink: 0 }} size={12} />;
  };

  const maxAnalyticsVal = (arr: [string, number][]) => Math.max(...arr.map(([, v]) => v), 1);

  return (
    <div className={styles.tableContainer}>

      {/* ── Header ── */}
      <div className={styles.tableHeader}>
        <div>
          <h3>Qualified Leads <span className={styles.leadCount}>({filteredLeads.length})</span></h3>
          {stats && (
            <p className={styles.statsLine}>
              {stats.scraped} scraped → {stats.qualified} qualified
              {stats.rejected > 0 && <span className={styles.rejectedCount}> · {stats.rejected} rejected by guardrails</span>}
            </p>
          )}
        </div>
        <div className={styles.actions}>
          <button className="btn btn-secondary" onClick={() => setShowAnalytics(true)}>
            <FiBarChart2 className={styles.mr2} size={15}/> Analytics
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <FiDownload className={styles.mr2} size={15}/> CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onExportSheets(filteredLeads.map(l => ({ ...l, outreachMessage: editedMessages[l.id] ?? l.outreachMessage })))}
            disabled={isExporting}
          >
            <FiShare2 className={styles.mr2} size={15}/> {isExporting ? 'Exporting…' : 'Export CRM'}
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className={styles.filtersPanel}>
        <div className={styles.filtersRow}>
          <div className={styles.searchBox}>
            <FiSearch size={13} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search name…"
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.scoreSliderWrap}>
            <span className={styles.scoreLabel}>Min Score: <strong>{minScore}</strong></span>
            <input type="range" min={1} max={10} value={minScore}
              onChange={e => setMinScore(Number(e.target.value))} className={styles.scoreSlider} />
          </div>
          <select className="input-field" value={filterReview} onChange={e => setFilterReview(e.target.value)}>
            <option value="all">Any Review</option>
            <option value="approved">Approved</option>
            <option value="review_needed">Needs Review</option>
          </select>
          <select className="input-field" value={filterUniversity} onChange={e => setFilterUniversity(e.target.value)}>
            <option value="all">All Universities</option>
            {universities.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          {platforms.length > 0 && (
            <select className="input-field" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
              <option value="all">All Platforms</option>
              {platforms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Bulk Actions ── */}
      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.size} selected</span>
          <span className={styles.bulkLabel}>Mark as:</span>
          {STATUS_OPTIONS.map(s => (
            <button key={s} className={styles.bulkStatusBtn} onClick={() => handleBulkStatus(s)}>{s}</button>
          ))}
          <button className={styles.bulkClear} onClick={() => setSelectedIds(new Set())}>Clear</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className={styles.tableWrapper}>
        {filteredLeads.length === 0 ? (
          <div className={styles.emptyState}>
            <FiSearch size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
            <p>No leads match the current filters.</p>
            <button className="btn btn-secondary" style={{ marginTop: '1rem', fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
              onClick={() => { setMinScore(6); setFilterReview('all'); setFilterUniversity('all'); setFilterPlatform('all'); setSearchName(''); }}>
              Clear Filters
            </button>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th>Candidate</th>
                <th>Headline &amp; Intent</th>
                <th className={styles.sortableHeader} onClick={() => handleSortBy('qualityScore')}>
                  Score <SortIcon col="qualityScore" />
                </th>
                <th>Source</th>
                <th>Status</th>
                <th>Email</th>
                <th>Review</th>
                <th>Feedback</th>
                <th>Outreach</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => {
                const platform = lead.metadata?.platform as string | undefined;
                const platMeta = platform ? PLATFORM_META[platform] : undefined;
                const statusColor = STATUS_COLORS[lead.status || 'new'];
                const outreachText = editedMessages[lead.id] ?? lead.outreachMessage;

                return (
                  <tr key={lead.id} className={`${styles.tableRow} ${selectedIds.has(lead.id) ? styles.selectedRow : ''}`}>
                    <td className={styles.checkboxCell}>
                      <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} />
                    </td>

                    {/* Candidate */}
                    <td>
                      <div className={styles.candidateInfo}>
                        <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className={styles.candidateName}>
                          {lead.name} <FiExternalLink size={11} />
                        </a>
                        <div className={styles.candidateSub}>{lead.university}</div>
                        <div className={styles.candidateSub}>{[lead.degree, lead.fieldOfStudy].filter(Boolean).join(' · ')}</div>
                        {(lead.location || lead.graduationYear) && (
                          <div className={styles.candidateSub}>
                            {[lead.location, lead.graduationYear].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Headline & Intent */}
                    <td>
                      <div className={styles.intentCell}>
                        <p className={styles.headlineText}>
                          {lead.headline ? (lead.headline.length > 100 ? lead.headline.slice(0, 100) + '…' : lead.headline) : '—'}
                        </p>
                        <div className={styles.intentBadges}>
                          {lead.seekingInternship && <span className={`${styles.intentBadge} ${styles.internBadge}`}>Internship</span>}
                          {lead.seekingFullTime   && <span className={`${styles.intentBadge} ${styles.ftBadge}`}>Full-time</span>}
                          <span className={styles.intentScore} title={`Intent Score: ${lead.intentScore}/3`}>⚡{lead.intentScore ?? '—'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Score */}
                    <td>
                      <div className={styles.scoreCell}>
                        <div className={`${styles.scoreBadge} ${(lead.qualityScore ?? 0) >= 8 ? styles.scoreHigh : styles.scoreMedium}`}>
                          {lead.qualityScore}/10
                        </div>
                        <div className={styles.guardrailList}>
                          {lead.qualityBreakdown?.indianOriginConfirmed && <span title="Indian Origin">🇮🇳</span>}
                          {lead.qualityBreakdown?.mastersStudent         && <span title="Masters Student">🎓</span>}
                          {lead.qualityBreakdown?.jobSearchIntent        && <span title="Job Search Intent">🔎</span>}
                          {lead.qualityBreakdown?.nonTier1University     && <span title="Non-Tier 1 Uni">🏛️</span>}
                        </div>
                      </div>
                    </td>

                    {/* Source platform */}
                    <td>
                      {platMeta ? (
                        <span className={styles.platformBadge}
                          style={{ background: `${platMeta.color}20`, color: platMeta.color, borderColor: `${platMeta.color}50` }}>
                          {platMeta.label}
                        </span>
                      ) : <span className={styles.platformBadge}>—</span>}
                    </td>

                    {/* Status dropdown */}
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={lead.status || 'new'}
                        onChange={e => onStatusChange(lead.id, e.target.value as Lead['status'])}
                        style={{ borderColor: `${statusColor}80`, color: statusColor }}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>

                    {/* Email */}
                    <td>
                      {lead.email ? (
                        <div className={styles.emailCell}>
                          <span className={styles.emailText}>{lead.email}</span>
                          <button className={styles.copyBtn} onClick={() => handleCopyEmail(lead)} title="Copy email">
                            {copiedId === lead.id ? <FiCheck size={11} color="#10b981" /> : <FiCopy size={11} />}
                          </button>
                        </div>
                      ) : <span className={styles.emptyDash}>—</span>}
                    </td>

                    {/* Review flag */}
                    <td>
                      {lead.reviewFlag === 'review_needed'
                        ? <span className={styles.reviewBadge}><FiAlertCircle size={11} /> Review</span>
                        : <span className={styles.approvedBadge}><FiCheck size={11} /> OK</span>}
                    </td>

                    {/* Feedback */}
                    <td>
                      <div className={styles.feedbackLoop}>
                        <button className={`${styles.feedBtn} ${lead.feedback === 'good_lead' ? styles.feedActive : ''}`}
                          onClick={() => onFeedback(lead, 'good_lead')} title="Good Lead">
                          <FiThumbsUp size={13} />
                        </button>
                        <button className={`${styles.feedBtn} ${lead.feedback === 'irrelevant_lead' ? styles.feedActiveIrrelevant : ''}`}
                          onClick={() => onFeedback(lead, 'irrelevant_lead')} title="Irrelevant">
                          <FiThumbsDown size={13} />
                        </button>
                        <button className={`${styles.feedBtn} ${lead.feedback === 'converted_lead' ? styles.feedActiveConverted : ''}`}
                          onClick={() => onFeedback(lead, 'converted_lead')} title="Converted">
                          <FiUserCheck size={13} />
                        </button>
                      </div>
                    </td>

                    {/* Outreach (editable) */}
                    <td className={styles.messageColumn}>
                      {expandedOutreach === lead.id ? (
                        <textarea
                          className={styles.messageEditor}
                          value={outreachText}
                          onChange={e => setEditedMessages(prev => ({ ...prev, [lead.id]: e.target.value }))}
                          rows={6}
                          onBlur={() => setExpandedOutreach(null)}
                          autoFocus
                        />
                      ) : (
                        <div className={styles.messageCard} onClick={() => setExpandedOutreach(lead.id)} title="Click to edit">
                          {outreachText}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Analytics Modal ── */}
      {showAnalytics && (
        <div className={styles.modalOverlay} onClick={() => setShowAnalytics(false)}>
          <div className={styles.analyticsModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Lead Analytics</h3>
              <button className={styles.modalClose} onClick={() => setShowAnalytics(false)}><FiX /></button>
            </div>

            <div className={styles.analyticsGrid}>
              {/* Score distribution */}
              <div className={styles.analyticsCard}>
                <h4>Score Distribution</h4>
                {Object.entries(analytics.scoreDist).filter(([, v]) => v > 0).map(([score, count]) => (
                  <div key={score} className={styles.barRow}>
                    <span className={styles.barLabel}>{score}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${(count / leads.length) * 100}%`, background: Number(score) >= 8 ? '#10b981' : '#f59e0b' }} />
                    </div>
                    <span className={styles.barCount}>{count}</span>
                  </div>
                ))}
              </div>

              {/* By platform */}
              <div className={styles.analyticsCard}>
                <h4>By Platform</h4>
                {analytics.byPlatform.map(([platform, count]) => {
                  const meta = PLATFORM_META[platform];
                  return (
                    <div key={platform} className={styles.barRow}>
                      <span className={styles.barLabel} style={{ color: meta?.color }}>{meta?.label || platform}</span>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${(count / leads.length) * 100}%`, background: meta?.color || '#64748b' }} />
                      </div>
                      <span className={styles.barCount}>{count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Top universities */}
              <div className={styles.analyticsCard}>
                <h4>Top Universities</h4>
                {analytics.topUnis.map(([uni, count]) => (
                  <div key={uni} className={styles.barRow}>
                    <span className={styles.barLabel} title={uni}>{uni.length > 22 ? uni.slice(0, 22) + '…' : uni}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${(count / maxAnalyticsVal(analytics.topUnis)) * 100}%` }} />
                    </div>
                    <span className={styles.barCount}>{count}</span>
                  </div>
                ))}
              </div>

              {/* Top fields */}
              <div className={styles.analyticsCard}>
                <h4>By Field of Study</h4>
                {analytics.topFields.map(([field, count]) => (
                  <div key={field} className={styles.barRow}>
                    <span className={styles.barLabel} title={field}>{field.length > 22 ? field.slice(0, 22) + '…' : field}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${(count / maxAnalyticsVal(analytics.topFields)) * 100}%`, background: '#8b5cf6' }} />
                    </div>
                    <span className={styles.barCount}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
