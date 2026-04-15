'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface RecentBoard {
  id: string;
  name: string;
  projectName: string;
}

interface ProjectContextValue {
  currentProjectId: string | null;
  currentBoardId: string | null;
  recentBoards: RecentBoard[];
  setProject: (id: string) => void;
  setBoard: (id: string) => void;
  addRecentBoard: (board: RecentBoard) => void;
}

const RECENT_BOARDS_KEY = 'bahjira-recent-boards';
const MAX_RECENT = 5;

const ProjectContext = createContext<ProjectContextValue>({
  currentProjectId: null,
  currentBoardId: null,
  recentBoards: [],
  setProject: () => {},
  setBoard: () => {},
  addRecentBoard: () => {},
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>([]);

  useEffect(() => {
    const savedProject = localStorage.getItem('bahjira-project');
    const savedBoard = localStorage.getItem('bahjira-board');
    if (savedProject) setCurrentProjectId(savedProject);
    if (savedBoard) setCurrentBoardId(savedBoard);

    try {
      const saved = localStorage.getItem(RECENT_BOARDS_KEY);
      if (saved) setRecentBoards(JSON.parse(saved));
    } catch {}
  }, []);

  function setProject(id: string) {
    setCurrentProjectId(id);
    localStorage.setItem('bahjira-project', id);
    setCurrentBoardId(null);
    localStorage.removeItem('bahjira-board');
  }

  function setBoard(id: string) {
    setCurrentBoardId(id);
    localStorage.setItem('bahjira-board', id);
  }

  function addRecentBoard(board: RecentBoard) {
    setRecentBoards((prev) => {
      const filtered = prev.filter((b) => b.id !== board.id);
      const updated = [board, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_BOARDS_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <ProjectContext.Provider value={{ currentProjectId, currentBoardId, recentBoards, setProject, setBoard, addRecentBoard }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
