export interface PasswordRule {
  id: string
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'An uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'digit', label: 'A number (0–9)', test: (p) => /\d/.test(p) },
  { id: 'special', label: 'A special character (!@#$%…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function passwordMeetsAllRules(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}
