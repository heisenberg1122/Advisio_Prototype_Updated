"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  maxWidth?: "default" | "wide" | "narrow" | "full";
}

const maxWidthMap = {
  default: "max-w-7xl",
  wide: "max-w-screen-2xl",
  narrow: "max-w-4xl",
  full: "max-w-full",
};

/**
 * Standardized Page Container
 * Provides consistent horizontal centering, maximum width, and responsive padding across all pages.
 */
export function PageContainer({
  children,
  className,
  maxWidth = "default",
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        maxWidthMap[maxWidth],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default PageContainer;
