import React, { type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient } from "@/lib/query/query-client";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider, useAuth } from "./auth-provider";

function UserThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return <ThemeProvider userId={user?.id}>{children}</ThemeProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserThemeProvider>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </UserThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export { ThemeProvider, useTheme } from "./theme-provider";
export { AuthProvider, useAuth } from "./auth-provider";
