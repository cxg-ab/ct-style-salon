export const bookingSteps = ['Service', 'Employee', 'Date & time', 'Details'] as const;

export type BookingSelection = {
  stylistId?: number;
  serviceIds: number[];
  time: string;
  step: number;
};
