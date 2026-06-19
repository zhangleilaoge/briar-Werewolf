/**
 * Math Utilities
 * 
 * Pure mathematical utility functions.
 * These functions are independent of game-specific logic.
 */

/**
 * Clamp a value between min and max
 * 
 * @param value - Value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate a random integer between min and max (inclusive)
 * 
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random integer
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max
 * 
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random float
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Pick a random element from an array
 * 
 * @param array - Array to pick from
 * @returns Random element
 */
export function randomPick<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle an array (Fisher-Yates algorithm)
 * 
 * @param array - Array to shuffle
 * @returns New shuffled array (does not modify original)
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Calculate the sum of an array of numbers
 * 
 * @param numbers - Array of numbers
 * @returns Sum
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, val) => acc + val, 0);
}

/**
 * Calculate the average of an array of numbers
 * 
 * @param numbers - Array of numbers
 * @returns Average
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 * 
 * @param numbers - Array of numbers
 * @returns Standard deviation
 */
export function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const avg = average(numbers);
  const squareDiffs = numbers.map(val => (val - avg) ** 2);
  return Math.sqrt(average(squareDiffs));
}
