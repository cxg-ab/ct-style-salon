import { useMemo, useState } from 'react';
import {
  getGetAvailabilityQueryKey,
  getListAppointmentsQueryKey,
  updateAppointment,
  useGetAvailability,
  useListAppointments,
  useListStylists,
  type Appointment,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, Phone, UserRound } from 'lucide-react';
import { addDays, localDateISO } from '@/lib/dates';
import { useLocale } from '@/lib/locale';

export function AppointmentBook() {
  const { t, formatDate, formatPrice, translateServiceName, statusLabel } = useLocale();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(localDateISO());
  const [stylistId, setStylistId] = useState<number>();
  const [movingId, setMovingId] = useState<number>();
  const [moveDate, setMoveDate] = useState(localDateISO());
  const [moveTime, setMoveTime] = useState('');
  const [feedback, setFeedback] = useState<string>();
  const [pendingId, setPendingId] = useState<number>();

  const range = useMemo(() => (
    view === 'week'
      ? { from: date, to: addDays(date, 6), stylistId }
      : { date, stylistId }
  ), [date, stylistId, view]);

  const bookQuery = useListAppointments(range, {
    query: { queryKey: getListAppointmentsQueryKey(range) },
  });
  const stylistsQuery = useListStylists();
  const appointments = bookQuery.data ?? [];
  const stylists = stylistsQuery.data ?? [];
  const moving = appointments.find((appointment) => appointment.id === movingId);
  const availabilityParams = {
    date: moveDate,
    stylistId: moving?.stylistId ?? 0,
    serviceIds: moving?.serviceIds ?? [],
  };
  const availabilityQuery = useGetAvailability(availabilityParams, {
    query: {
      enabled: Boolean(moving && moveDate),
      queryKey: getGetAvailabilityQueryKey(availabilityParams),
    },
  });
  const slots = availabilityQuery.data?.[0]?.slots ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
  };

  const cancelVisit = async (appointment: Appointment) => {
    if (!window.confirm(`${t('confirmCancelVisit')} ${appointment.customerName}?`)) return;
    setPendingId(appointment.id);
    setFeedback(undefined);
    try {
      await updateAppointment(appointment.id, { status: 'cancelled' });
      setFeedback(t('visitCancelled'));
      refresh();
    } catch {
      setFeedback(t('bookingErrorGeneric'));
    } finally {
      setPendingId(undefined);
    }
  };

  const saveMove = async () => {
    if (!moving || !moveTime) return;
    setPendingId(moving.id);
    setFeedback(undefined);
    try {
      await updateAppointment(moving.id, { date: moveDate, time: moveTime });
      setFeedback(t('visitMoved'));
      setMovingId(undefined);
      setMoveTime('');
      refresh();
    } catch {
      setFeedback(t('bookingTaken'));
    } finally {
      setPendingId(undefined);
    }
  };

  const grouped = useMemo(() => {
    const days = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = String(appointment.date).slice(0, 10);
      days.set(key, [...(days.get(key) ?? []), appointment]);
    }
    return [...days.entries()];
  }, [appointments]);

  return (
    <section className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.42)] p-4 sm:p-5" data-testid="appointment-book">
      <div className="flex flex-col justify-between gap-4 border-b border-[hsl(var(--border))] pb-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{t('appointmentBook')}</p>
          <h2 className="mt-1 font-display text-3xl">{t('todaysBook')}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-[hsl(var(--border))] p-1 text-[10px] font-bold">
            <button type="button" onClick={() => setView('day')} className={`rounded-full px-3 py-1.5 ${view === 'day' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--card))]' : ''}`} data-testid="button-book-day">{t('dayView')}</button>
            <button type="button" onClick={() => setView('week')} className={`rounded-full px-3 py-1.5 ${view === 'week' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--card))]' : ''}`} data-testid="button-book-week">{t('weekView')}</button>
          </div>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-full border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" data-testid="input-book-date" />
          <select value={stylistId ?? ''} onChange={(event) => setStylistId(event.target.value ? Number(event.target.value) : undefined)} className="h-10 rounded-full border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" data-testid="select-book-stylist">
            <option value="">{t('filterAll')}</option>
            {stylists.map((stylist) => <option key={stylist.id} value={stylist.id}>{stylist.name}</option>)}
          </select>
        </div>
      </div>
      {feedback && <p className="mt-4 text-sm text-[hsl(var(--secondary))]" role="status">{feedback}</p>}
      {bookQuery.isLoading ? <div className="mt-4 skeleton h-28 rounded-2xl" /> : grouped.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-appointment-book">{t('noVisitsToday')}</p>
      ) : (
        <div className="mt-4 space-y-6">
          {grouped.map(([day, visits]) => (
            <div key={day}>
              <p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{formatDate(day, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <div className="mt-2 space-y-2">
                {visits.map((appointment) => (
                  <article key={appointment.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid={`book-card-${appointment.id}`}>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-2xl">{appointment.customerName}</h3>
                          <span className="rounded-full bg-[hsl(var(--accent)/.35)] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.08em]">{statusLabel(appointment.status)}</span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
                          {appointment.serviceNames.map((name) => <p key={name}>{translateServiceName(name)}</p>)}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm">
                          <span className="inline-flex items-center gap-1.5"><Clock3 size={14} className="text-[hsl(var(--primary))]" />{appointment.time}</span>
                          <span className="inline-flex items-center gap-1.5"><UserRound size={14} className="text-[hsl(var(--primary))]" />{appointment.stylistName}</span>
                          <span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-[hsl(var(--primary))]" />{appointment.phone}</span>
                          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-[hsl(var(--primary))]" />{appointment.totalDurationMinutes} {t('minutes')} · {formatPrice(appointment.totalPrice)}</span>
                        </div>
                      </div>
                      {appointment.status !== 'cancelled' && (
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => { setMovingId(appointment.id); setMoveDate(String(appointment.date).slice(0, 10)); setMoveTime(appointment.time); }} className="rounded-full border border-[hsl(var(--border))] px-3 py-2 text-[11px] font-bold" data-testid={`button-move-${appointment.id}`}>{t('moveVisit')}</button>
                          <button type="button" disabled={pendingId === appointment.id} onClick={() => void cancelVisit(appointment)} className="rounded-full border border-[hsl(var(--destructive)/.35)] px-3 py-2 text-[11px] font-bold text-[hsl(var(--destructive))]" data-testid={`button-cancel-book-${appointment.id}`}>{t('cancelVisit')}</button>
                        </div>
                      )}
                    </div>
                    {movingId === appointment.id && (
                      <div className="mt-4 rounded-xl border border-[hsl(var(--primary)/.28)] bg-[hsl(var(--primary)/.05)] p-3">
                        <div className="flex flex-wrap gap-2">
                          <input type="date" value={moveDate} onChange={(event) => { setMoveDate(event.target.value); setMoveTime(''); }} className="h-10 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" />
                          <select value={moveTime} onChange={(event) => setMoveTime(event.target.value)} className="h-10 min-w-[8rem] rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm">
                            <option value="">{t('dateTime')}</option>
                            {slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                          </select>
                          <button type="button" disabled={!moveTime || pendingId === appointment.id} onClick={() => void saveMove()} className="rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-[11px] font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{t('saveNewTime')}</button>
                          <button type="button" onClick={() => setMovingId(undefined)} className="rounded-full px-3 py-2 text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{t('cancel')}</button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
