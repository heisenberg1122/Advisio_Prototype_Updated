import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './providers';
import { DashboardWorkspaceProvider } from './providers/dashboard-workspace-provider';
import { ActiveProjectProvider } from './providers/active-project-provider';
import { AppRoutes } from './routes';
import { EvaluationBanner } from './components/evaluation/EvaluationBanner';
import { ResearcherGuideProvider } from './providers/researcher-guide-provider';

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <DashboardWorkspaceProvider>
          <ActiveProjectProvider>
            <ResearcherGuideProvider>
              <AppRoutes />
              <EvaluationBanner />
            </ResearcherGuideProvider>
          </ActiveProjectProvider>
        </DashboardWorkspaceProvider>
      </Providers>
    </BrowserRouter>
  );
}
