import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  getGetAvailabilityQueryKey,
  getListAppointmentsQueryKey,
  updateAppointment,
  useGetAvailability,
  useListAppointments,
  type Appointment,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Clock3, Mail, Search } from 'lucide-react';
import { localDateISO } from '@/lib/dates';
import { useLocale } from '@/lib/locale';

export default function GuestAppointments() {
  const { t, formatDate, translateServiceName, statusLabel, formatPrice } = useLocale();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [submitted, setSubmitted] = useState<{ email: string; lookupCode: string }>();
  const [movingId, setMovingId] = useState<number>();
  const [moveDate, setMoveDate] = useState(localDateISO());
  const [moveTime, setMoveTime] = useState('');
  const [feedback, setFeedback] = useState<string>();
  const params = useMemo(() => submitted, [submitted]);
  const appointmentsQuery = useListAppointments(params ?? { email: '' }, {
    query: { enabled: Boolean(submitted), queryKey: getListAppointmentsQueryKey(params) },
  });
  const appointments = appointmentsQuery.data ?? [];
  const moving = appointments.find((appointment) => appointment.id === movingId);
  const availabilityParams = {
    date: moveDate,
    stylistId: moving?.stylistId ?? 0,
    serviceIds: moving?.serviceIds ?? [],
  };
  const availabilityQuery = useGetAvailability(availabilityParams, {
    query: {
      enabled: Boolean(moving && submitted),
      queryKey: getGetAvailabilityQueryKey(availabilityParams),
    },
  });
  const slots = availabilityQuery.data?.[0]?.slots ?? [];

  const credentials = submitted
    ? { email: submitted.email, lookupCode: submitted.lookupCode }
    : undefined;

  const act = async (appointment: Appointment, data: { status?: 'cancelled'; date?: string; time?: string }, success: string) => {
    if (!credentials) return;
    setFeedback(undefined);
    try {
      await updateAppointment(appointment.id, { ...credentials, ...data });
      setFeedback(success);
      setMovingId(undefined);
      queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(params) });
    } catch {
      setFeedback(t('bookingErrorGeneric'));
    }
  };

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-14 sm:px-8 md:py-24">
      <div className="max-w-2xl reveal">
        <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('yourVisits')}</p>
        <h1 className="mt-4 font-display text-6xl leading-[.84] sm:text-8xl">{t('goodTimes')}</h1>
        <p className="mt-7 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('lookupIntro')} {t('enterReference')}</p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted({ email: email.trim(), lookupCode: lookupCode.trim().toUpperCase() });
        }}
        className="mt-12 flex max-w-xl flex-col gap-3"
      >
        <div className="relative">
          <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))]" />
          <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('lookupPlaceholder')} className="h-14 w-full rounded-full border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-11 pr-5 text-sm" data-testid="input-lookup-email" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input required minLength={6} maxLength={8} autoComplete="one-time-code" value={lookupCode} onChange={(event) => setLookupCode(event.target.value.toUpperCase())} placeholder={t('lookupCodePlaceholder')} aria-label={t('lookupCodeLabel')} className="h-14 flex-1 rounded-full border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-5 text-sm tracking-[.18em]" data-testid="input-lookup-code" />
          <button type="submit" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-7 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))]" data-testid="button-lookup-appointments"><Search size={15} /> {t('findVisits')}</button>
        </div>
      </form>
      {submitted && (
        <section className="mt-16 reveal">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-4xl">{t('appointments')}</h2>
            <span className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{submitted.email}</span>
          </div>
          {feedback && <p className="mb-4 text-sm text-[hsl(var(--secondary))]" role="status">{feedback}</p>}
          {appointmentsQuery.isLoading ? (
            <div className="space-y-3"><div className="skeleton h-28 rounded-2xl" /><div className="skeleton h-28 rounded-2xl" /></div>
          ) : appointmentsQuery.isError ? (
            <p className="rounded-2xl border border-[hsl(var(--destructive)/.26)] bg-[hsl(var(--destructive)/.06)] p-5 text-sm" role="alert">{t('enterReference')}</p>
          ) : appointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center" data-testid="empty-appointments">
              <CalendarDays className="mx-auto text-[hsl(var(--primary))]" size={25} />
              <p className="mt-4 font-display text-2xl">{t('nothingBooked')}</p>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{t('readyHere')}</p>
              <Link href="/book" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-empty-book">{t('bookAVisit')} <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-6" data-testid={`card-appointment-${appointment.id}`}>
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="space-y-1">{appointment.serviceNames.map((name) => <h3 key={name} className="font-display text-2xl">{translateServiceName(name)}</h3>)}</div>
                        <span className="rounded-full bg-[hsl(var(--accent)/.35)] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.08em]">{statusLabel(appointment.status)}</span>
                      </div>
                      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{appointment.stylistName}</p>
                      <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{appointment.totalDurationMinutes} {t('minutes')} · {formatPrice(appointment.totalPrice)}</p>
                    </div>
                    <div className="flex items-center gap-5 text-sm">
                      <span className="flex items-center gap-2"><CalendarDays size={15} className="text-[hsl(var(--primary))]" />{formatDate(appointment.date, { month: 'short', day: 'numeric' })}</span>
                      <span className="flex items-center gap-2"><Clock3 size={15} className="text-[hsl(var(--primary))]" />{appointment.time}</span>
                    </div>
                  </div>
                  {appointment.status !== 'cancelled' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setMovingId(appointment.id); setMoveDate(String(appointment.date).slice(0, 10)); setMoveTime(appointment.time); }} className="rounded-full border border-[hsl(var(--border))] px-3 py-2 text-[11px] font-bold" data-testid={`button-guest-move-${appointment.id}`}>{t('moveVisit')}</button>
                      <button type="button" onClick={() => { if (window.confirm(t('confirmCancelVisit'))) void act(appointment, { status: 'cancelled' }, t('visitCancelled')); }} className="rounded-full border border-[hsl(var(--destructive)/.35)] px-3 py-2 text-[11px] font-bold text-[hsl(var(--destructive))]" data-testid={`button-guest-cancel-${appointment.id}`}>{t('cancelVisit')}</button>
                    </div>
                  )}
                  {movingId === appointment.id && (
                    <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-[hsl(var(--primary)/.28)] bg-[hsl(var(--primary)/.05)] p-3">
                      <input type="date" value={moveDate} onChange={(event) => { setMoveDate(event.target.value); setMoveTime(''); }} className="h-10 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" />
                      <select value={moveTime} onChange={(event) => setMoveTime(event.target.value)} className="h-10 min-w-[8rem] rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm">
                        <option value="">{t('dateTime')}</option>
                        {slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                      </select>
                      <button type="button" disabled={!moveTime} onClick={() => void act(appointment, { date: moveDate, time: moveTime }, t('visitMoved'))} className="rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-[11px] font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{t('saveNewTime')}</button>
                      <button type="button" onClick={() => setMovingId(undefined)} className="rounded-full px-3 py-2 text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{t('cancel')}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
