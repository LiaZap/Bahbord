'use client';

import { useEffect, useState } from 'react';
import { GitPullRequest, GitCommit, GitBranch, ExternalLink } from 'lucide-react';

interface GitHubLink {
  id: string;
  type: 'pr' | 'commit' | 'issue' | 'branch';
  url: string;
  title: string | null;
  state: string | null;
  number: number | null;
  author: string | null;
  created_at: string;
}

interface GitHubLinksProps {
  ticketId: string;
}

export default function GitHubLinks({ ticketId }: GitHubLinksProps) {
  const [links, setLinks] = useState<GitHubLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/github-links?ticket_id=${ticketId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setLinks(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (links.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold text-slate-200">
        <GitPullRequest size={16} /> GitHub
      </h3>
      <div className="space-y-1">
        {links.map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border border-border/40 bg-surface2 px-3 py-2 text-[12px] hover:bg-input/40"
          >
            {l.type === 'pr' && (
              <GitPullRequest
                size={13}
                className={
                  l.state === 'merged'
                    ? 'text-violet-400'
                    : l.state === 'closed'
                    ? 'text-red-400'
                    : 'text-emerald-400'
                }
              />
            )}
            {l.type === 'commit' && <GitCommit size={13} className="text-slate-500" />}
            {l.type === 'branch' && <GitBranch size={13} className="text-slate-500" />}
            {l.type === 'issue' && (
              <GitPullRequest
                size={13}
                className={l.state === 'closed' ? 'text-red-400' : 'text-emerald-400'}
              />
            )}
            <span className="flex-1 truncate text-slate-300">
              {l.type === 'pr' && l.number ? `#${l.number} ` : ''}
              {l.title}
            </span>
            {l.state && (
              <span className="text-[10px] uppercase text-slate-500">{l.state}</span>
            )}
            <ExternalLink size={11} className="text-slate-600" />
          </a>
        ))}
      </div>
    </section>
  );
}
