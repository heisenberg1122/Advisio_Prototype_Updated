import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './providers';
import { ActiveProjectProvider } from './providers/active-project-provider';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <ActiveProjectProvider>
          <AppRoutes />
        </ActiveProjectProvider>
      </BrowserRouter>
    </Providers>
  );
}

