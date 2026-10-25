import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './providers';
import { DashboardWorkspaceProvider } from './providers/dashboard-workspace-provider';
import { ActiveProjectProvider } from './providers/active-project-provider';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <DashboardWorkspaceProvider>
          <ActiveProjectProvider>
            <AppRoutes />
          </ActiveProjectProvider>
        </DashboardWorkspaceProvider>
      </Providers>
    </BrowserRouter>
  );
}
