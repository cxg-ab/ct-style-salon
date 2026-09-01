export const bookingSteps = ['Employee', 'Service', 'Date & time', 'Details'] as const;

export type BookingSelection = {
  stylistId?: number;
  serviceIds: number[];
  time: string;
  step: number;
};

export function selectEmployee(stylistId: number, serviceIds: number[] = []): BookingSelection {
  return {
    stylistId,
    serviceIds,
    time: '',
    step: 2,
  };
}