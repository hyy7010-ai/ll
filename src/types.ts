export type HealthStatus = 'green' | 'yellow' | 'red';
export type BathStatus = 'done' | 'due' | 'overdue';
export type MealStatus = 'eaten' | 'missed' | 'assisted';
export type ToiletStatus = 'independent' | 'assisted' | 'pad-change';

export interface Resident {
  id: string;
  name: string;
  room: string;
  avatarUrl: string;
  statusColor: HealthStatus;
  bathStatus: BathStatus;
  mealStatus: MealStatus;
  toiletStatus: ToiletStatus;
  careMinutesToday: number;
  careMinutesTarget: number;
}

export interface AIObservationResult {
  observationType?: 'wound' | 'excrement';
  observation: string;
  estimatedSizeOrType?: string;
  colour?: string;
  bristolStoolType?: string;
  potentialRiskFlag: string;
  bodyLocation?: string;
}

export interface SIRSReport {
  isReportable: boolean;
  category: string;
  priority: 1 | 2 | null;
  autofillReport: {
    whatHappened: string;
    immediateSafetyActions: string;
    emergencyServicesNotified: boolean;
    familyNotified: boolean;
    gpNotified: boolean;
    regulatorNotification: string;
    preventiveActions: string;
  };
}

export interface SIRSAlertData {
  priority: 1 | 2;
  message: string;
  reportInfo: SIRSReport;
}

export interface PendingReview {
  id: string;
  residentId: string;
  residentName: string;
  room: string;
  photoUrl: string;
  aiResult: AIObservationResult;
  timestamp: string;
}
