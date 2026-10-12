// Plain logic behind the issues screen, kept free of React Native so it can be tested directly.

/** The picker appears only when there is a choice to make. */
export function showProjectSelector(options: readonly unknown[]): boolean {
  return options.length > 1;
}
