
export enum AppView {
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  VOTE_IDENTIFY = 'VOTE_IDENTIFY',
  VOTE_CONFIRM = 'VOTE_CONFIRM',
  VOTE_BOOTH = 'VOTE_BOOTH',
  VOTE_SUCCESS = 'VOTE_SUCCESS',
}

export enum PollCalculationType {
  NORMAL = 'NORMAL',
  HABITE_SE = 'HABITE_SE',
  FRACTION = 'FRACTION',
}

export type AttendanceStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'BLOCKED';

export interface Resident {
  unit: string;
  name: string;
  isDelinquent: boolean;
  hasHabiteSe: boolean; // For 'Condominio Habite-se'
  fraction: number;     // For 'Fração Ideal'
  cpf?: string;         // Document for validation (First 5 digits check)
  zoomName?: string;    // Name used in the meeting
  attendanceStatus?: AttendanceStatus; // Check-in status
  checkInTimestamp?: number; // When admin approved
}

export interface PollOption {
  id: string;
  text: string;
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  options: PollOption[];
  isActive: boolean;
  isEnded: boolean;
  createdAt: number;
  calculationType: PollCalculationType;
}

export interface VoteRecord {
  pollId: string;
  unit: string;
  optionId: string;
  timestamp: number;
  isDelinquentVote: boolean;
}

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role?: 'TI' | 'ADMIN'; // Technical permission level
  jobTitle?: string;     // Custom display title (Cargo)
}

export interface AdminState {
  isAuthenticated: boolean;
}

export interface AssemblyRecord {
  id: string;
  condoName: string;
  date: number;
  polls: Poll[];
  votes: VoteRecord[];
  residentsSnapshot: Resident[]; // Snapshot of residents/attendance at that time
}
