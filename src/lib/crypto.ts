export async function hashString(message: string, salt?: string): Promise<string> {
  const input = salt ? `${salt}:${message}` : message;
  const msgBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function generateRecoveryKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const segment1 = Array.from(array.slice(0, 4)).map(b => chars[b % chars.length]).join('');
  const segment2 = Array.from(array.slice(4, 8)).map(b => chars[b % chars.length]).join('');
  return `POP-${segment1}-${segment2}`;
}

export function evaluatePasswordStrength(password: string): string {
  if (password.length === 0) return "";
  if (password.length < 6) return "Weak";
  
  let score = 0;
  if (password.length > 8) score++;
  if (password.length > 11) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score >= 4) return "Very Strong";
  if (score >= 3) return "Strong";
  if (score >= 2) return "Moderate";
  return "Weak";
}
