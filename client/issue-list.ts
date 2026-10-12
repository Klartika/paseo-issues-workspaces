// Plain logic behind the issues screen, kept free of React Native so it can be tested directly.

/** The picker appears only when there is a choice to make. */
export function showProjectSelector(options: readonly unknown[]): boolean {
  return options.length > 1;
}

/** The saved project when it is still offered, else the first one. */
export function pickProject<T extends { repo: string }>(options: readonly T[], selectedRepo: string): T | null {
  return options.find((o) => o.repo.toLowerCase() === selectedRepo.toLowerCase()) ?? options[0] ?? null;
}
