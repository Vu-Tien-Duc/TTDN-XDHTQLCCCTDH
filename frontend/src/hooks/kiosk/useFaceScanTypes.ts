/**
 * useFaceScanTypes.ts - Shared Types cho Face Scan Loop & Kiosk Component
 * 
 * Tách riêng types để tránh circular dependency giữa hooks
 */

export type KioskMode = 'auto' | 'check_in' | 'check_out';
export type KioskState = 'IDLE' | 'DETECTING' | 'VERIFYING' | 'SUCCESS' | 'ERROR';

export interface CheckInResult {
  action?: 'CHECK_IN' | 'CHECK_OUT';
  user: {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
    role: string;
  };
  attendance: any;
  confidenceScore: number;
  distance: number;
  statusText?: string;
  status?: string;
  workingDuration?: {
    totalMinutes: number;
    formatted: string;
  };
  earlyLeave?: {
    isEarlyLeave: boolean;
    earlyMinutes: number;
  };
  checkOutTime?: string;
  checkInTime?: string;
  scannedAt?: Date | string;
}
