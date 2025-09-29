export interface User {
  role: 'admin' | 'member';
  email: string;
  secure_expires_at: number;
  exp: number;
  iat: number;
  iss: string;
  token: string;
}
