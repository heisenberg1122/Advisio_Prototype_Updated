"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightIcon, disabled, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            "w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl transition-all duration-150",
            "border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0B1726]",
            "text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",
            "focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/20 dark:focus:border-[#C9A227] dark:focus:ring-[#C9A227]/20",
            "disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-white/5 disabled:cursor-not-allowed",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400">
            {rightIcon}
          </div>
        )}
        {error && (
          <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, disabled, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            "w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl transition-all duration-150 cursor-pointer",
            "border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0B1726]",
            "text-slate-800 dark:text-slate-100",
            "focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/20 dark:focus:border-[#C9A227] dark:focus:ring-[#C9A227]/20",
            "disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-white/5 disabled:cursor-not-allowed",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, disabled, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <textarea
          ref={ref}
          disabled={disabled}
          className={cn(
            "w-full p-3.5 text-xs sm:text-sm rounded-xl transition-all duration-150 resize-y min-h-[96px]",
            "border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0B1726]",
            "text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",
            "focus:outline-none focus:border-[#0B3A53] focus:ring-2 focus:ring-[#0B3A53]/20 dark:focus:border-[#C9A227] dark:focus:ring-[#C9A227]/20",
            "disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-white/5 disabled:cursor-not-allowed",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      {label && (
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
          {hint && (
            <span className="text-xs font-normal text-slate-400">
              {hint}
            </span>
          )}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default Input;
