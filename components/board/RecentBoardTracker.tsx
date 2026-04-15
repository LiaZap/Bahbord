'use client';

import { useEffect } from 'react';
import { useProject } from '@/lib/project-context';

/**
 * Client component that tracks the current board as a recent board.
 * Rendered inside the board page to register it on visit.
 */
export default function RecentBoardTracker() {
  const { currentBoardId, addRecentBoard } = useProject();

  useEffect(() => {
    if (!currentBoardId) return;

    // Fetch board and project info to register as recent
    async function track() {
      try {
        const [boardsRes, projectsRes] = await Promise.all([
          fetch('/api/options?type=boards'),
          fetch('/api/options?type=projects'),
        ]);
        const boards: Array<{ id: string; name: string; project_id: string }> = await boardsRes.json();
        const projects: Array<{ id: string; name: string }> = await projectsRes.json();

        const board = boards.find((b) => b.id === currentBoardId);
        if (!board) return;

        const project = projects.find((p) => p.id === board.project_id);
        addRecentBoard({
          id: board.id,
          name: board.name,
          projectName: project?.name ?? 'Projeto',
        });
      } catch {}
    }

    track();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoardId]);

  return null;
}
