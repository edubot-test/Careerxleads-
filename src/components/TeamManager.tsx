'use client';
import { useState, useEffect } from 'react';
import { Lead } from '@/types';
import { FiUserPlus, FiX, FiUsers, FiShuffle, FiDownload, FiCopy } from 'react-icons/fi';
import styles from './TeamManager.module.css';

const TEAM_KEY = 'careerx_team_members';

interface TeamManagerProps {
  leads: Lead[];
  onAssign: (assignments: Record<string, string>) => void; // leadId → memberName
}

export default function TeamManager({ leads, onAssign }: TeamManagerProps) {
  const [members, setMembers] = useState<string[]>([]);
  const [newMember, setNewMember] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [copiedNote, setCopiedNote] = useState<string | null>(null);

  // Load team members from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEAM_KEY);
      if (saved) setMembers(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Persist team members
  const saveMembers = (updated: string[]) => {
    setMembers(updated);
    try { localStorage.setItem(TEAM_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const addMember = () => {
    const name = newMember.trim();
    if (!name || members.includes(name)) return;
    saveMembers([...members, name]);
    setNewMember('');
  };

  const removeMember = (name: string) => {
    saveMembers(members.filter(m => m !== name));
  };

  // Auto-split: round-robin assignment by tier (hot leads distributed evenly)
  const autoSplit = () => {
    if (members.length === 0) return;

    // Sort leads by tier (hot first) so each member gets equal hot/warm/cold
    const sorted = [...leads].sort((a, b) => (a.tier || 3) - (b.tier || 3));
    const assignments: Record<string, string> = {};
    sorted.forEach((lead, i) => {
      assignments[lead.id] = members[i % members.length];
    });
    onAssign(assignments);
  };

  // Export leads for a specific team member as CSV
  const exportMemberCSV = (memberName: string) => {
    const memberLeads = leads.filter(l => l.assignedTo === memberName);
    if (memberLeads.length === 0) return;

    const headers = ['Name', 'LinkedIn URL', 'Email', 'Phone', 'University', 'Field', 'Tier', 'Intent', 'LinkedIn Note', 'Outreach Message', 'WhatsApp URL', 'Status'];
    const rows = memberLeads.map(l => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${l.linkedinUrl || ''}"`,
      `"${l.email || ''}"`,
      `"${l.phone || ''}"`,
      `"${(l.university || '').replace(/"/g, '""')}"`,
      `"${(l.fieldOfStudy || '').replace(/"/g, '""')}"`,
      l.tier || 3,
      l.intentScore || 1,
      `"${(l.linkedInNote || '').replace(/"/g, '""')}"`,
      `"${(l.outreachMessage || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${l.whatsAppUrl || ''}"`,
      l.status || 'new',
    ]);

    const csv = '\ufeff' + [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `careerx_${memberName.toLowerCase().replace(/\s+/g, '_')}_leads.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const copyLinkedInNote = (note: string) => {
    navigator.clipboard.writeText(note).catch(() => {});
    setCopiedNote(note);
    setTimeout(() => setCopiedNote(null), 1500);
  };

  // Count leads per member
  const memberCounts = members.reduce<Record<string, { total: number; hot: number; contacted: number }>>((acc, m) => {
    const memberLeads = leads.filter(l => l.assignedTo === m);
    acc[m] = {
      total: memberLeads.length,
      hot: memberLeads.filter(l => l.tier === 1).length,
      contacted: memberLeads.filter(l => l.status !== 'new').length,
    };
    return acc;
  }, {});

  const unassignedCount = leads.filter(l => !l.assignedTo).length;

  if (!isOpen) {
    return (
      <button className={styles.toggleBtn} onClick={() => setIsOpen(true)} title="Team Management">
        <FiUsers size={14} />
        <span>Team ({members.length})</span>
        {unassignedCount > 0 && <span className={styles.badge}>{unassignedCount} unassigned</span>}
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3><FiUsers size={16} /> Team Management</h3>
        <button className={styles.closeBtn} onClick={() => setIsOpen(false)}><FiX size={16} /></button>
      </div>

      {/* Add member */}
      <div className={styles.addRow}>
        <input
          type="text"
          value={newMember}
          onChange={e => setNewMember(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addMember()}
          placeholder="Team member name..."
          className={styles.input}
        />
        <button className={styles.addBtn} onClick={addMember} disabled={!newMember.trim()}>
          <FiUserPlus size={14} /> Add
        </button>
      </div>

      {/* Auto-split button */}
      {members.length > 0 && leads.length > 0 && (
        <button className={styles.splitBtn} onClick={autoSplit}>
          <FiShuffle size={14} /> Auto-Split {leads.length} Leads Across {members.length} Members
        </button>
      )}

      {/* Member list with stats */}
      {members.length > 0 && (
        <div className={styles.memberList}>
          {members.map(m => {
            const c = memberCounts[m] || { total: 0, hot: 0, contacted: 0 };
            return (
              <div key={m} className={styles.memberRow}>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{m}</span>
                  <span className={styles.memberStats}>
                    {c.total} leads · {c.hot} hot · {c.contacted} contacted
                  </span>
                </div>
                <div className={styles.memberActions}>
                  {c.total > 0 && (
                    <button className={styles.iconBtn} onClick={() => exportMemberCSV(m)} title={`Export ${m}'s leads as CSV`}>
                      <FiDownload size={13} />
                    </button>
                  )}
                  <button className={styles.iconBtn} onClick={() => removeMember(m)} title={`Remove ${m}`}>
                    <FiX size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {members.length > 0 && (
        <div className={styles.summary}>
          {unassignedCount > 0
            ? <span>{unassignedCount} leads unassigned — click Auto-Split to distribute</span>
            : <span>All {leads.length} leads assigned across {members.length} members</span>
          }
        </div>
      )}

      {members.length === 0 && (
        <p className={styles.emptyMsg}>Add team members above, then auto-split leads for LinkedIn outreach.</p>
      )}
    </div>
  );
}
