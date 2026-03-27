
export enum AppView {
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  COMPANY_DASHBOARD = 'COMPANY_DASHBOARD',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  VOTE_IDENTIFY = 'VOTE_IDENTIFY',
  VOTE_CONFIRM = 'VOTE_CONFIRM',
  VOTE_BOOTH = 'VOTE_BOOTH',
  VOTE_SUCCESS = 'VOTE_SUCCESS',
}

export enum AssemblyType {
  HYBRID = 'HYBRID',
  PRESENTIAL = 'PRESENTIAL',
  ONLINE = 'ONLINE',
}

export interface ActiveAssembly {
  id: string;
  condoName: string;
  createdAt: number;
  isActive: boolean;
  type?: AssemblyType;
  status?: 'active' | 'completed';
  startedBy?: string;
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
  proxyCount?: number;       // Column G: Quantity of proxies
  proxyUnits?: string;       // Column H: Units in proxy
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
  hasStarted?: boolean;
  createdAt: number;
  calculationType: PollCalculationType;
  manualVotes?: Record<string, number>; // optionId -> count
}

export interface VoteRecord {
  pollId: string;
  unit: string;
  optionId: string;
  timestamp: number;
  isDelinquentVote: boolean;
  zoomName?: string; // Name used in the platform
}

export interface ErrorLog {
  id: string;
  timestamp: number;
  error: string;
  operationType: string;
  path: string | null;
  userId: string | undefined;
  userName: string | undefined;
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

export interface SystemLog {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: string;
  details?: string;
  assemblyId?: string;
}

export interface AssemblyRecord {
  id: string;
  condoName: string;
  date: number;
  polls: Poll[];
  votes: VoteRecord[];
  residentsSnapshot: Resident[]; // Snapshot of residents/attendance at that time
  logs?: SystemLog[];
  startedBy?: string;
}
