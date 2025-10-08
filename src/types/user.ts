/**
 * Represents a user with JWT authentication details
 */
export interface User {
  email: string;
  exp: number;
  iat: number;
  iss: string;
  role: 'admin' | 'member';
  secure_expires_at: number;
  token: string;
}
