'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ProjectContextValue {
  currentProjectId: string | null;
  currentBoardId: string | null;
  setProject: (id: string) => void;
  setBoard: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  currentProjectId: null,
  currentBoardId: null,
  setProject: () => {},
  setBoard: () => {},
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);

  useEffect(() => {
    const savedProject = localStorage.getItem('bahjira-project');
    const savedBoard = localStorage.getItem('bahjira-board');
    if (savedProject) setCurrentProjectId(savedProject);
    if (savedBoard) setCurrentBoardId(savedBoard);
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

  return (
    <ProjectContext.Provider value={{ currentProjectId, currentBoardId, setProject, setBoard }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
