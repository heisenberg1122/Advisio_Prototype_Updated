import { QueryClient } from "@tanstack/react-query";

let browserQueryClient: QueryClient | undefined = undefined;

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Official actions must fail offline rather than replaying silently after reconnect.
      mutations: { networkMode: "always" },
      queries: {
        // Allow saved reads to execute instead of waiting for the network to return.
        networkMode: "always",
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: reuse singleton
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
