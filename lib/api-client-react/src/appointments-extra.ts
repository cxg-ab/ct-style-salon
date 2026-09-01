import { customFetch } from './custom-fetch';
import type { Appointment, AppointmentUpdate } from './generated/api.schemas';

export function updateAppointment(
  appointmentId: number,
  data: AppointmentUpdate,
): Promise<Appointment> {
  return customFetch<Appointment>(`/api/appointments/${appointmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
