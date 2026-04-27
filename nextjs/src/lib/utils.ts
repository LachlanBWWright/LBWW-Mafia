import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility to merge class names using clsx and tailwind-merge.
 * Handles Tailwind CSS class conflicts by merging and deduplicating.
 *
 * @param {ClassValue[]} inputs - Array of class names, objects, or conditional classes
 * @returns {string} Merged CSS class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
