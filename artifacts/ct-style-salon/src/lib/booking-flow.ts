export const bookingSteps = ['Employee', 'Service', 'Date & time', 'Details'] as const;

export type BookingSelection = {
  stylistId?: number;
  serviceId?: number;
  time: string;
  step: number;
};

export function selectEmployee(stylistId: number): BookingSelection {
  return {
    stylistId,
    serviceId: undefined,
    time: '',
    step: 2,
  };
}