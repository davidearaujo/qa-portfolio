export interface User {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  completed: number; // SQLite stores booleans as 0/1
  created_at: string;
  updated_at: string;
}

export interface TaskResponse {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JwtPayload {
  userId: number;
  email: string;
}

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
