import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Instagram,
  Mail,
  MapPin,
  Menu,
  Phone,
  Scissors,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import {
  getGetAvailabilityQueryKey,
  getGetSalonSummaryQueryKey,
  getListAppointmentsQueryKey,
  getListServicesQueryKey,
  getListStylistsQueryKey,
  useCreateService,
  useCreateAppointment,
  useGetAvailability,
  useGetSalonSummary,
  useHealthCheck,
  useListAppointments,
  useListServices,
  useListStylists,
  useUpdateService,
  useUpdateStylistSchedule,
  type Service,
  type ServiceInput,
  type Stylist,
  type StylistScheduleEntry,
} from '@workspace/api-client-react';
import storefrontImage from '@assets/WhatsApp_Image_2026-08-31_at_11.57.17_1788163048747.jpeg';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { bookingSteps, selectEmployee } from '@/lib/booking-flow';
import { Route, Switch, Link, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { href: '/', label: 'The salon' },
    { href: '/book', label: 'Book a visit' },
    { href: '/appointments', label: 'Your appointments' },
  ];
  return (
    <div className="grain min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--border)/.72)] bg-[hsl(var(--background)/.91)] backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-3" data-testid="link-brand">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--accent))] transition-transform duration-300 group-hover:rotate-[-8deg]">
              <Scissors size={18} strokeWidth={1.8} />
            </span>
            <span className="leading-none">
              <span className="block text-[13px] font-bold tracking-[.18em] text-[hsl(var(--foreground))]">CT STYLE</span>
              <span className="mt-1 block font-mono-ui text-[9px] tracking-[.3em] text-[hsl(var(--muted-foreground))]">SALON / STUDIO</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-9 md:flex" aria-label="Primary navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-testid={`link-nav-${link.label.toLowerCase().replaceAll(' ', '-')}`}
                className={`relative py-2 text-[12px] font-semibold tracking-[.08em] transition-colors hover:text-[hsl(var(--primary))] ${location === link.href ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}
              >
                {link.label}
                {location === link.href && <span className="absolute -bottom-[1px] left-0 h-[2px] w-full bg-[hsl(var(--primary))]" />}
              </Link>
            ))}
          </nav>
          <Link href="/book" className="hidden items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-[11px] font-bold tracking-[.12em] text-[hsl(var(--primary-foreground))] shadow-[0_8px_22px_hsl(var(--primary)/.18)] transition-all hover:-translate-y-0.5 hover:bg-[hsl(16_61%_48%)] md:flex" data-testid="link-header-book">
            Reserve a chair <ArrowRight size={14} />
          </Link>
          <button className="rounded-full p-2 text-[hsl(var(--foreground))] md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} data-testid="button-mobile-menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileOpen && (
          <nav className="border-t border-[hsl(var(--border)/.72)] bg-[hsl(var(--background))] px-5 py-4 md:hidden" aria-label="Mobile navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="flex items-center justify-between border-b border-[hsl(var(--border)/.55)] py-4 text-sm font-semibold" data-testid={`link-mobile-${link.href.slice(1) || 'home'}`}>
                {link.label} <ArrowRight size={15} className="text-[hsl(var(--primary))]" />
              </Link>
            ))}
          </nav>
        )}
      </header>
      {children}
      <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[hsl(var(--card))]">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr] md:py-16">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-[hsl(var(--accent)/.5)] text-[hsl(var(--accent))]"><Scissors size={16} /></span>
              <span className="font-display text-2xl">CT Style Salon</span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-6 text-[hsl(var(--card)/.66)]">A considered cut, a warm welcome, and a little time that belongs entirely to you.</p>
          </div>
          <div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-[hsl(var(--accent))]">Find us</p>
            <p className="mt-4 text-sm leading-6 text-[hsl(var(--card)/.76)]">My City Centre Masdar<br />Khalifa City, Abu Dhabi</p>
            <a href="tel:+97125520422" className="mt-3 flex items-center gap-2 text-sm text-[hsl(var(--card)/.76)] hover:text-[hsl(var(--accent))]"><Phone size={13} /> +971 2 552 0422</a>
          </div>
          <div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-[hsl(var(--accent))]">Stay in touch</p>
            <p className="mt-4 text-sm text-[hsl(var(--card)/.76)]">Daily · 11:00–22:00</p>
            <a href="https://instagram.com/ct_style_salon" className="mt-3 inline-flex items-center gap-2 text-sm text-[hsl(var(--card)/.76)] hover:text-[hsl(var(--accent))]" data-testid="link-instagram"><Instagram size={14} /> @ct_style_salon</a>
            <Link href="/manage" className="mt-5 flex items-center gap-2 text-[11px] text-[hsl(var(--card)/.5)] hover:text-[hsl(var(--accent))]" data-testid="link-manager-workspace"><ShieldCheck size={13} /> Manager workspace</Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1240px] justify-between border-t border-[hsl(var(--card)/.12)] px-5 py-5 font-mono-ui text-[9px] tracking-[.16em] text-[hsl(var(--card)/.4)] sm:px-8">
          <span>CT STYLE SALON</span><span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: count }).map((_, index) => <div key={index} className="skeleton h-44 rounded-2xl" />)}</div>;
}

function ErrorMessage({ retry }: { retry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--destructive)/.26)] bg-[hsl(var(--destructive)/.06)] p-5 text-sm" data-testid="status-error">
      <div className="flex items-center gap-3"><CircleAlert size={18} className="text-[hsl(var(--destructive))]" /><span>We could not reach the studio just now.</span></div>
      <button onClick={retry} className="rounded-full border border-[hsl(var(--destructive)/.35)] px-4 py-2 text-xs font-bold text-[hsl(var(--destructive))]" data-testid="button-retry">Try again</button>
    </div>
  );
}

function Home() {
  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });
  const summaryQuery = useGetSalonSummary({ query: { queryKey: getGetSalonSummaryQueryKey() } });
  const healthQuery = useHealthCheck();
  const services = servicesQuery.data ?? [];
  const stylists = stylistsQuery.data ?? [];
  const summary = summaryQuery.data;
  const featured = services.filter((service) => service.featured).slice(0, 3);

  return (
    <main>
      <section className="relative overflow-hidden bg-[hsl(var(--secondary))] text-[hsl(var(--card))]">
        <div className="absolute inset-0 opacity-40">
          <img src={storefrontImage} alt="CT Style Salon storefront" className="h-full w-full object-cover object-center opacity-55 mix-blend-luminosity" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--secondary))_0%,hsl(var(--secondary)/.88)_38%,hsl(var(--secondary)/.38)_100%)]" />
        <div className="relative mx-auto flex min-h-[570px] max-w-[1240px] items-end px-5 pb-14 pt-20 sm:px-8 md:min-h-[640px] md:pb-20">
          <div className="max-w-[650px] reveal">
            <p className="mb-7 flex items-center gap-3 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--accent))]"><span className="h-px w-8 bg-[hsl(var(--accent))]" /> My City Centre Masdar · Abu Dhabi</p>
            <h1 className="font-display text-[clamp(4.5rem,11vw,9rem)] leading-[.78] tracking-[-.045em] text-balance">The art<br /><i>of</i> looking well.</h1>
            <p className="mt-9 max-w-md text-base leading-7 text-[hsl(var(--card)/.74)] sm:text-lg">Modern grooming in a space made for slowing down. Come as you are. Leave a little sharper.</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/book" className="inline-flex items-center gap-3 rounded-full bg-[hsl(var(--accent))] px-6 py-4 text-xs font-bold tracking-[.12em] text-[hsl(var(--foreground))] transition-transform hover:-translate-y-1" data-testid="link-hero-book">Find your time <ArrowRight size={16} /></Link>
              <a href="#services" className="inline-flex items-center gap-2 px-3 py-3 text-xs font-semibold tracking-[.08em] text-[hsl(var(--card)/.75)] hover:text-[hsl(var(--accent))]" data-testid="link-hero-services">Explore services <ChevronRight size={15} /></a>
            </div>
          </div>
          <div className="absolute right-7 top-12 hidden w-28 text-right font-mono-ui text-[9px] uppercase leading-4 tracking-[.16em] text-[hsl(var(--card)/.45)] md:block">
            <span className="mb-2 block h-8 border-r border-[hsl(var(--accent)/.6)]" />Good hair<br />is a feeling.
          </div>
        </div>
      </section>

      <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="mx-auto grid max-w-[1240px] gap-6 px-5 py-7 sm:grid-cols-3 sm:px-8">
          <div className="flex items-center gap-4 border-b border-[hsl(var(--border)/.7)] pb-5 sm:border-b-0 sm:border-r sm:pb-0">
            <Star size={22} fill="hsl(var(--accent))" className="text-[hsl(var(--accent))]" />
            <div><strong className="block font-display text-2xl">{summary?.rating ?? '—'}</strong><span className="font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">{summary?.reviewCount ? `${summary.reviewCount} guest notes` : 'Guest rating'}</span></div>
          </div>
          <div className="flex items-center gap-4 border-b border-[hsl(var(--border)/.7)] pb-5 sm:border-b-0 sm:border-r sm:pb-0 sm:pl-6">
            <MapPin size={21} className="text-[hsl(var(--primary))]" />
            <div><strong className="block text-sm">{summary?.neighborhood ?? 'My City Centre Masdar'}</strong><span className="font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">Khalifa City · Abu Dhabi</span></div>
          </div>
          <div className="flex items-center gap-4 sm:pl-6">
            <Clock3 size={21} className="text-[hsl(var(--primary))]" />
            <div><strong className="block text-sm">{summary?.hours ?? 'Daily · 11 AM – 10 PM'}</strong><span className="font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">Sunday open until 11 PM</span></div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 md:py-28">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">The menu</p><h2 className="mt-3 font-display text-5xl leading-none sm:text-6xl">A little <i>ritual.</i></h2></div>
          <p className="max-w-xs text-sm leading-6 text-[hsl(var(--muted-foreground))]">Every service starts with a conversation, and ends with you feeling like yourself — only more so.</p>
        </div>
        {servicesQuery.isLoading ? <LoadingCards /> : servicesQuery.isError ? <ErrorMessage retry={() => servicesQuery.refetch()} /> : featured.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-featured-services">Our service menu is being refreshed. Please check back shortly.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1.35fr_1fr_1fr]">
            {featured.map((service, index) => (
              <Link href="/book" key={service.id} className={`group relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-2xl border border-[hsl(var(--border))] p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[hsl(var(--primary)/.45)] ${index === 0 ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--card))] md:min-h-[350px]' : 'bg-[hsl(var(--card))]'}`} data-testid={`card-service-${service.id}`}>
                <div className="flex items-start justify-between"><span className="font-mono-ui text-[10px] tracking-[.14em] opacity-60">0{index + 1}</span><ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></div>
                <div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{service.category}</p><h3 className="mt-3 font-display text-4xl leading-[.9]">{service.name}</h3><p className="mt-4 max-w-[260px] text-sm leading-5 opacity-65">{service.description}</p><div className="mt-6 flex gap-4 font-mono-ui text-[10px] uppercase tracking-[.1em] opacity-60"><span>{service.durationMinutes} min</span><span>${service.price}</span></div></div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-[hsl(var(--accent))]">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-[.85fr_1.15fr] md:py-24">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--secondary))]">Make it yours</p><h2 className="mt-4 max-w-md font-display text-5xl leading-[.88] text-[hsl(var(--secondary))] sm:text-6xl">Your chair<br /><i>is waiting.</i></h2></div>
          <div className="flex flex-col gap-5 border-l border-[hsl(var(--secondary)/.25)] pl-6 sm:pl-10">
            <p className="max-w-md text-lg leading-7 text-[hsl(var(--secondary)/.8)]">Choose a service, choose your person, then let us take care of the rest.</p>
            <Link href="/book" className="inline-flex w-fit items-center gap-3 rounded-full bg-[hsl(var(--secondary))] px-6 py-4 text-xs font-bold tracking-[.12em] text-[hsl(var(--card))] transition-transform hover:-translate-y-1" data-testid="link-cta-book">Book an appointment <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 md:py-28">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">The people</p><h2 className="mt-3 font-display text-5xl leading-none sm:text-6xl">Good hands.</h2></div><p className="max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">Not just stylists. Observant, curious people who know the difference a good detail makes.</p></div>
        {stylistsQuery.isLoading ? <div className="mt-10"><LoadingCards count={3} /></div> : stylistsQuery.isError ? <div className="mt-10"><ErrorMessage retry={() => stylistsQuery.refetch()} /></div> : stylists.length === 0 ? <div className="mt-10 rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-stylists">Our team profiles are on their way.</div> : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">{stylists.map((stylist) => <div key={stylist.id} className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-transform hover:-translate-y-1" data-testid={`card-stylist-${stylist.id}`}><div className="mb-12 flex items-start justify-between"><div className="grid h-14 w-14 place-items-center rounded-full text-sm font-bold" style={{ backgroundColor: `${stylist.accent}25`, color: stylist.accent }}>{stylist.initials}</div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">0{stylist.id}</span></div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">{stylist.role}</p><h3 className="mt-2 font-display text-3xl">{stylist.name}</h3><p className="mt-3 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{stylist.bio}</p></div>)}</div>
        )}
      </section>
      <div className="mx-auto max-w-[1240px] px-5 pb-10 text-right font-mono-ui text-[9px] tracking-[.12em] text-[hsl(var(--muted-foreground))] sm:px-8" data-testid="status-health">STUDIO STATUS · {healthQuery.data?.status ?? (healthQuery.isLoading ? 'CHECKING' : 'AVAILABLE')}</div>
    </main>
  );
}

const weekDays = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

function scheduleErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }
  return fallback;
}

function validateScheduleInForm(schedule: StylistScheduleEntry[]) {
  for (const entry of schedule) {
    if (entry.openTime >= entry.closeTime) {
      return 'Each opening time must be earlier than its closing time.';
    }
  }
  for (let index = 0; index < schedule.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < schedule.length; otherIndex += 1) {
      const entry = schedule[index];
      const other = schedule[otherIndex];
      if (entry.dayOfWeek === other.dayOfWeek && entry.openTime < other.closeTime && other.openTime < entry.closeTime) {
        return 'Working hours cannot overlap on the same day.';
      }
    }
  }
  return undefined;
}

function ScheduleEditor({ stylist }: { stylist: Stylist }) {
  const [schedule, setSchedule] = useState<StylistScheduleEntry[]>(stylist.schedule);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string }>();
  const updateSchedule = useUpdateStylistSchedule({
    request: { headers: { 'x-salon-manager': 'true' } },
  });

  useEffect(() => {
    setSchedule(stylist.schedule);
  }, [stylist.id, stylist.schedule]);

  const entryForDay = (dayOfWeek: number) => schedule.find((entry) => entry.dayOfWeek === dayOfWeek);
  const updateEntry = (dayOfWeek: number, field: 'openTime' | 'closeTime', value: string) => {
    setFeedback(undefined);
    setSchedule((current) => current.map((entry) => entry.dayOfWeek === dayOfWeek ? { ...entry, [field]: value } : entry));
  };
  const toggleDay = (dayOfWeek: number, enabled: boolean) => {
    setFeedback(undefined);
    setSchedule((current) => {
      if (!enabled) return current.filter((entry) => entry.dayOfWeek !== dayOfWeek);
      return [...current, { dayOfWeek, openTime: '10:00', closeTime: '18:00' }].sort((left, right) => left.dayOfWeek - right.dayOfWeek);
    });
  };
  const save = () => {
    const validationError = validateScheduleInForm(schedule);
    if (validationError) {
      setFeedback({ tone: 'error', message: validationError });
      return;
    }
    updateSchedule.mutate(
      { stylistId: stylist.id, data: { schedule } },
      {
        onSuccess: (updatedStylist) => {
          setSchedule(updatedStylist.schedule);
          setFeedback({ tone: 'success', message: `${stylist.name}'s schedule is saved.` });
          queryClient.invalidateQueries({ queryKey: getListStylistsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
        },
        onError: (error) => {
          setFeedback({ tone: 'error', message: scheduleErrorMessage(error, 'We could not save this schedule. Check the hours and try again.') });
        },
      },
    );
  };

  return (
    <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7" data-testid={`schedule-editor-${stylist.id}`}>
      <div className="flex flex-col justify-between gap-4 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold" style={{ backgroundColor: `${stylist.accent}25`, color: stylist.accent }}>{stylist.initials}</span>
          <div><h2 className="font-display text-3xl">{stylist.name}</h2><p className="mt-1 font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">{stylist.role}</p></div>
        </div>
        <button type="button" onClick={save} disabled={updateSchedule.isPending} className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" data-testid={`button-save-schedule-${stylist.id}`}>
          {updateSchedule.isPending ? 'Saving…' : 'Save schedule'} <Check size={14} />
        </button>
      </div>
      <div className="mt-5 space-y-2">
        {weekDays.map((day) => {
          const entry = entryForDay(day.value);
          return (
            <div key={day.value} className={`grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(140px,1fr)_1fr_1fr] ${entry ? 'border-[hsl(var(--border))] bg-[hsl(var(--background)/.45)]' : 'border-transparent bg-[hsl(var(--muted)/.45)]'}`}>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input type="checkbox" checked={Boolean(entry)} onChange={(event) => toggleDay(day.value, event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid={`checkbox-schedule-${stylist.id}-${day.short.toLowerCase()}`} />
                <span>{day.label}</span>
              </label>
              {entry ? (
                <>
                  <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">Open
                    <input type="time" value={entry.openTime} onChange={(event) => updateEntry(day.value, 'openTime', event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-open-${stylist.id}-${day.short.toLowerCase()}`} />
                  </label>
                  <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">Close
                    <input type="time" value={entry.closeTime} onChange={(event) => updateEntry(day.value, 'closeTime', event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-close-${stylist.id}-${day.short.toLowerCase()}`} />
                  </label>
                </>
              ) : <span className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))] sm:col-span-2">Day off</span>}
            </div>
          );
        })}
      </div>
      {feedback && <p className={`mt-4 text-sm ${feedback.tone === 'error' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--secondary))]'}`} role={feedback.tone === 'error' ? 'alert' : 'status'} data-testid={`status-schedule-${stylist.id}`}>{feedback.message}</p>}
      <p className="mt-4 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Booking times are offered every 90 minutes and stop when the selected service would run past closing.</p>
    </section>
  );
}

type ServiceFormState = {
  name: string;
  description: string;
  category: string;
  price: string;
  durationMinutes: string;
  featured: boolean;
};

const emptyServiceForm: ServiceFormState = {
  name: '',
  description: '',
  category: '',
  price: '',
  durationMinutes: '',
  featured: false,
};

function serviceToForm(service: Service): ServiceFormState {
  return {
    name: service.name,
    description: service.description,
    category: service.category,
    price: String(service.price),
    durationMinutes: String(service.durationMinutes),
    featured: service.featured,
  };
}

function ServiceEditor({
  service,
  onCancel,
  onSaved,
}: {
  service?: Service;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<ServiceFormState>(() => service ? serviceToForm(service) : emptyServiceForm);
  const [feedback, setFeedback] = useState<string>();
  const createService = useCreateService({
    request: { headers: { 'x-salon-manager': 'true' } },
  });
  const updateService = useUpdateService({
    request: { headers: { 'x-salon-manager': 'true' } },
  });
  const isPending = createService.isPending || updateService.isPending;

  useEffect(() => {
    setForm(service ? serviceToForm(service) : emptyServiceForm);
    setFeedback(undefined);
  }, [service?.id]);

  const updateField = <K extends keyof ServiceFormState>(field: K, value: ServiceFormState[K]) => {
    setFeedback(undefined);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const description = form.description.trim();
    const category = form.category.trim();
    const durationMinutes = Number(form.durationMinutes);
    const price = Number(form.price);

    if (!name || !description || !category || !form.price.trim() || !form.durationMinutes.trim()) {
      setFeedback('Name, description, category, price, and duration are required.');
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      setFeedback('Duration must be a positive whole number of minutes.');
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim()) || !Number.isFinite(price) || price < 0) {
      setFeedback('Enter a valid price with no more than two decimal places.');
      return;
    }

    const data: ServiceInput = {
      name,
      description,
      category,
      durationMinutes,
      price,
      featured: form.featured,
    };
    const onError = (error: unknown) => {
      setFeedback(scheduleErrorMessage(error, 'We could not save this service. Check the details and try again.'));
    };
    if (service) {
      updateService.mutate(
        { serviceId: service.id, data },
        {
          onSuccess: () => onSaved(`${service.name} was updated.`),
          onError,
        },
      );
    } else {
      createService.mutate(
        { data },
        {
          onSuccess: () => onSaved(`${name} was added to the menu.`),
          onError,
        },
      );
    }
  };

  return (
    <form onSubmit={save} className="mt-6 rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card))] p-5 shadow-[0_14px_34px_hsl(var(--secondary)/.06)] sm:p-7" data-testid={service ? `service-editor-${service.id}` : 'service-editor-new'}>
      <div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{service ? 'Edit service' : 'New service'}</p>
          <h2 className="mt-2 font-display text-3xl">{service ? service.name : 'Add to the menu'}</h2>
        </div>
        <button type="button" onClick={onCancel} className="self-start text-xs font-bold tracking-[.08em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-cancel-service">Cancel</button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Name
          <input required value={form.name} onChange={(event) => updateField('name', event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-4 text-sm font-normal" data-testid="input-service-name" />
        </label>
        <label className="text-xs font-semibold">Category
          <input required value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="Hair, Beard, Signature…" className="mt-2 h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-4 text-sm font-normal" data-testid="input-service-category" />
        </label>
        <label className="text-xs font-semibold sm:col-span-2">Description
          <textarea required value={form.description} onChange={(event) => updateField('description', event.target.value)} className="mt-2 min-h-[96px] w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-4 text-sm font-normal" data-testid="input-service-description" />
        </label>
        <label className="text-xs font-semibold">Price
          <div className="relative mt-2"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))]">$</span><input required type="text" inputMode="decimal" value={form.price} onChange={(event) => updateField('price', event.target.value)} placeholder="120.00" className="h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-9 pr-4 text-sm font-normal" data-testid="input-service-price" /></div>
        </label>
        <label className="text-xs font-semibold">Duration
          <div className="relative mt-2"><input required type="number" min="1" step="1" value={form.durationMinutes} onChange={(event) => updateField('durationMinutes', event.target.value)} placeholder="45" className="h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-4 pr-16 text-sm font-normal" data-testid="input-service-duration" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">minutes</span></div>
        </label>
      </div>
      <label className="mt-5 flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={form.featured} onChange={(event) => updateField('featured', event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid="checkbox-service-featured" />
        Show in featured menu
      </label>
      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-4 border-t border-[hsl(var(--border))] pt-5 sm:flex-row sm:items-center">
        {feedback ? <p className="text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-service-error">{feedback}</p> : <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Duration controls the available booking times.</span>}
        <button type="submit" disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" data-testid="button-save-service">
          {isPending ? 'Saving…' : service ? 'Save changes' : 'Add service'} <Check size={14} />
        </button>
      </div>
    </form>
  );
}

function ServiceManagement() {
  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const services = servicesQuery.data ?? [];
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [feedback, setFeedback] = useState<string>();

  const finishSave = (message: string) => {
    setEditing(null);
    setFeedback(message);
    queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
  };

  return (
    <section className="mt-12 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.42)] p-5 sm:p-7" data-testid="service-management">
      <div className="flex flex-col justify-between gap-4 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-end">
        <div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Service menu</p><h2 className="mt-2 font-display text-4xl">The rituals.</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Update the details guests see and the time each service needs.</p></div>
        <button type="button" onClick={() => { setEditing('new'); setFeedback(undefined); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-5 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--card))] hover:bg-[hsl(var(--secondary)/.88)]" data-testid="button-add-service"><span className="text-lg leading-none">+</span> Add service</button>
      </div>
      {feedback && <p className="mt-5 text-sm text-[hsl(var(--secondary))]" role="status" data-testid="status-service-success">{feedback}</p>}
      {editing === 'new' && <ServiceEditor onCancel={() => setEditing(null)} onSaved={finishSave} />}
      <div className="mt-6 space-y-3">
        {servicesQuery.isLoading ? <LoadingCards count={2} /> : servicesQuery.isError ? <ErrorMessage retry={() => servicesQuery.refetch()} /> : services.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-10 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-managed-services">No services yet. Add the first ritual to your menu.</div> : services.map((service) => (
          <div key={service.id} className="flex flex-col gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:flex-row sm:items-center sm:justify-between" data-testid={`service-manager-card-${service.id}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3"><h3 className="font-display text-2xl">{service.name}</h3>{service.featured && <span className="rounded-full bg-[hsl(var(--accent)/.45)] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.08em]">Featured</span>}</div>
              <p className="mt-2 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{service.description}</p>
              <div className="mt-3 flex flex-wrap gap-4 font-mono-ui text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]"><span>{service.category}</span><span>{service.durationMinutes} min</span><span>${service.price.toFixed(2)}</span></div>
            </div>
            <button type="button" onClick={() => { setEditing(service.id); setFeedback(undefined); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[hsl(var(--border))] px-4 py-3 text-[11px] font-bold tracking-[.1em] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid={`button-edit-service-${service.id}`}>Edit service <ArrowRight size={14} /></button>
          </div>
        ))}
      </div>
      {typeof editing === 'number' && services.find((service) => service.id === editing) && <ServiceEditor service={services.find((service) => service.id === editing)} onCancel={() => setEditing(null)} onSaved={finishSave} />}
    </section>
  );
}

function ManagerSchedule() {
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });
  const stylists = stylistsQuery.data ?? [];
  return (
    <main className="mx-auto max-w-[1000px] px-5 py-14 sm:px-8 md:py-24">
      <div className="max-w-2xl reveal">
        <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">Manager workspace</p>
        <h1 className="mt-4 font-display text-6xl leading-[.84] sm:text-8xl">Keep the<br /><i>chairs ready.</i></h1>
        <p className="mt-7 max-w-xl text-base leading-7 text-[hsl(var(--muted-foreground))]">Keep the service menu current and update each employee’s working days and open hours. Changes are used by booking as soon as you save.</p>
      </div>
      <ServiceManagement />
      <div className="mt-12 space-y-5">
        {stylistsQuery.isLoading ? <LoadingCards count={3} /> : stylistsQuery.isError ? <ErrorMessage retry={() => stylistsQuery.refetch()} /> : stylists.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No employees are available to schedule.</div> : stylists.map((stylist) => <ScheduleEditor key={stylist.id} stylist={stylist} />)}
      </div>
    </main>
  );
}

function DateStrip({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const days = useMemo(() => Array.from({ length: 10 }, (_, index) => { const value = new Date(); value.setHours(12, 0, 0, 0); value.setDate(value.getDate() + index); return value; }), []);
  return <div className="flex gap-2 overflow-x-auto pb-2" data-testid="date-strip">{days.map((day) => { const iso = day.toISOString().slice(0, 10); const selected = iso === date; return <button key={iso} onClick={() => onChange(iso)} className={`min-w-[68px] rounded-xl border px-2 py-3 text-center transition-all ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_8px_18px_hsl(var(--primary)/.18)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.55)]'}`} data-testid={`button-date-${iso}`}><span className="block font-mono-ui text-[9px] uppercase tracking-[.08em] opacity-70">{indexDay(day)}</span><span className="mt-1 block text-xl font-semibold">{day.getDate()}</span><span className="block text-[9px] uppercase opacity-60">{day.toLocaleDateString('en-US', { month: 'short' })}</span></button>; })}</div>;
}

function indexDay(day: Date) { return day.toLocaleDateString('en-US', { weekday: 'short' }); }

function Book() {
  const [step, setStep] = useState(1);
  const [stylistId, setStylistId] = useState<number>();
  const [serviceId, setServiceId] = useState<number>();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('');
  const [form, setForm] = useState({ customerName: '', email: '', phone: '', notes: '' });
  const [confirmed, setConfirmed] = useState<any>();
  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });
  const availabilityParams = useMemo(() => ({ date, stylistId: stylistId ?? 0, serviceId: serviceId ?? 0 }), [date, stylistId, serviceId]);
  const availabilityQuery = useGetAvailability(availabilityParams, { query: { enabled: Boolean(date && stylistId && serviceId), queryKey: getGetAvailabilityQueryKey(availabilityParams) } });
  const createAppointment = useCreateAppointment();
  const services = servicesQuery.data ?? [];
  const stylists = stylistsQuery.data ?? [];
  const selectedService = services.find((service) => service.id === serviceId);
  const selectedStylist = stylists.find((stylist) => stylist.id === stylistId);
  const slots = availabilityQuery.data?.[0]?.slots ?? [];

  const canNext = (step === 1 && Boolean(stylistId)) || (step === 2 && Boolean(serviceId)) || (step === 3 && Boolean(time)) || step === 4;
  const updateField = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!serviceId || !stylistId || !time) return;
    createAppointment.mutate({ data: { serviceId, stylistId, date, time, customerName: form.customerName, email: form.email, phone: form.phone, notes: form.notes || null } }, { onSuccess: (appointment) => setConfirmed(appointment) });
  };
  if (confirmed) return <Confirmation appointment={confirmed} />;

  return (
    <main className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 md:py-20">
      <div className="mb-12 max-w-2xl reveal"><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">Reserve your chair</p><h1 className="mt-4 font-display text-6xl leading-[.84] sm:text-8xl">A good hour<br /><i>starts here.</i></h1><p className="mt-7 text-base leading-7 text-[hsl(var(--muted-foreground))]">Choose your person, then your ritual. We will show times that fit their schedule.</p></div>
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-10 flex items-center gap-0">{bookingSteps.map((label, index) => <div key={label} className="flex flex-1 items-center"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${step > index + 1 ? 'border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))] text-[hsl(var(--card))]' : step === index + 1 ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}>{step > index + 1 ? <Check size={14} /> : index + 1}</div><span className={`ml-2 hidden text-[10px] font-semibold uppercase tracking-[.1em] sm:block ${step === index + 1 ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>{label}</span>{index < bookingSteps.length - 1 && <span className="mx-2 h-px flex-1 bg-[hsl(var(--border))] sm:mx-4" />}</div>)}</div>
          {step === 1 && <StepPanel eyebrow="01 / Choose your person" title="Who would you like to see?">{stylistsQuery.isLoading ? <LoadingCards count={2} /> : stylistsQuery.isError ? <ErrorMessage retry={() => stylistsQuery.refetch()} /> : stylists.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Our team profiles are on their way.</div> : <div className="grid gap-3 sm:grid-cols-2">{stylists.map((stylist) => <button key={stylist.id} onClick={() => { const next = selectEmployee(stylist.id); setStylistId(next.stylistId); setServiceId(next.serviceId); setTime(next.time); setStep(next.step); }} className={`rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${stylistId === stylist.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)] ring-2 ring-[hsl(var(--primary)/.15)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.45)]'}`} data-testid={`button-stylist-${stylist.id}`}><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-full text-sm font-bold" style={{ backgroundColor: `${stylist.accent}25`, color: stylist.accent }}>{stylist.initials}</span><div><h3 className="font-display text-2xl">{stylist.name}</h3><p className="font-mono-ui text-[9px] uppercase tracking-[.11em] text-[hsl(var(--primary))]">{stylist.role}</p></div></div><p className="mt-5 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{stylist.bio}</p></button>)}</div>}</StepPanel>}
          {step === 2 && <StepPanel eyebrow="02 / Choose a service" title="What are we doing today?"><div className="grid gap-3 sm:grid-cols-2">{servicesQuery.isLoading ? <LoadingCards count={2} /> : servicesQuery.isError ? <ErrorMessage retry={() => servicesQuery.refetch()} /> : services.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Our service menu is being refreshed. Please check back shortly.</div> : services.map((service) => <button key={service.id} onClick={() => { setServiceId(service.id); setTime(''); setStep(3); }} className={`group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${serviceId === service.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)] ring-2 ring-[hsl(var(--primary)/.15)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.45)]'}`} data-testid={`button-service-${service.id}`}><div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Scissors size={16} /></span>{service.featured && <span className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--primary))]">Most loved</span>}</div><h3 className="mt-8 font-display text-3xl">{service.name}</h3><p className="mt-2 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{service.description}</p><div className="mt-5 flex gap-4 font-mono-ui text-[10px] uppercase tracking-[.09em] text-[hsl(var(--muted-foreground))]"><span>{service.durationMinutes} min</span><span>${service.price}</span></div></button>)}</div><BackButton onClick={() => setStep(1)} /></StepPanel>}
          {step === 3 && <StepPanel eyebrow="03 / Find your time" title={`When feels right for ${selectedStylist?.name ?? 'your employee'}?`}><p className="mb-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Choose a date to see only the times this employee is scheduled to work.</p><DateStrip date={date} onChange={(value) => { setDate(value); setTime(''); }} /><div className="mt-8">{availabilityQuery.isLoading ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4"><div className="skeleton h-12 rounded-xl" /><div className="skeleton h-12 rounded-xl" /><div className="skeleton h-12 rounded-xl" /></div> : availabilityQuery.isError ? <ErrorMessage retry={() => availabilityQuery.refetch()} /> : slots.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-time-slots">No open times for {selectedStylist?.name ?? 'this employee'} on this date. Choose another date from their schedule.</div> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((slot) => <button key={slot} onClick={() => setTime(slot)} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${time === slot ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-time-${slot.replaceAll(':', '-')}`}>{slot}</button>)}</div>}</div><BackButton onClick={() => setStep(2)} /></StepPanel>}
          {step === 4 && <StepPanel eyebrow="04 / Your details" title="Where should we send the note?"><form onSubmit={submit} className="space-y-4"><Field icon={<UserRound size={16} />} label="Full name" value={form.customerName} onChange={(value) => updateField('customerName', value)} required testId="input-customer-name" /><Field icon={<Mail size={16} />} label="Email address" type="email" value={form.email} onChange={(value) => updateField('email', value)} required testId="input-customer-email" /><Field icon={<Phone size={16} />} label="Phone number" type="tel" value={form.phone} onChange={(value) => updateField('phone', value)} required testId="input-customer-phone" /><label className="block text-xs font-semibold">Anything we should know? <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="A preference, a question, or simply hello." className="mt-2 min-h-[92px] w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-4 text-sm font-normal placeholder:text-[hsl(var(--muted-foreground))]" data-testid="input-notes" /></label><div className="flex items-center justify-between gap-4 pt-4"><BackButton onClick={() => setStep(3)} /><button disabled={createAppointment.isPending} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-4 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" type="submit" data-testid="button-confirm-appointment">{createAppointment.isPending ? 'Holding your chair…' : 'Confirm appointment'} <ArrowRight size={15} /></button></div>{createAppointment.isError && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="status-booking-error">That time was just taken. Please go back and choose another.</p>}</form></StepPanel>}
          {step < 4 && <div className="mt-7 flex justify-end">{step !== 1 && <button onClick={() => setStep(step + 1)} disabled={!canNext} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-4 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-40" data-testid={`button-next-step-${step}`}>Continue <ArrowRight size={15} /></button>}</div>}
        </div>
        <aside className="h-fit rounded-2xl bg-[hsl(var(--secondary))] p-6 text-[hsl(var(--card))] lg:sticky lg:top-28"><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">Your visit</p><div className="mt-8 border-b border-[hsl(var(--card)/.15)] pb-6"><p className="font-display text-3xl">{selectedService?.name ?? 'Select a service'}</p><p className="mt-2 text-sm text-[hsl(var(--card)/.58)]">{selectedService ? `${selectedService.durationMinutes} min · $${selectedService.price}` : 'Your ritual begins with a choice.'}</p></div><div className="space-y-5 py-6 text-sm"><div className="flex gap-3"><UserRound size={16} className="mt-0.5 text-[hsl(var(--accent))]" /><span>{selectedStylist?.name ?? 'Stylist to be chosen'}</span></div><div className="flex gap-3"><CalendarDays size={16} className="mt-0.5 text-[hsl(var(--accent))]" /><span>{date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Date to be chosen'}{time ? ` · ${time}` : ''}</span></div></div><div className="flex gap-2 border-t border-[hsl(var(--card)/.15)] pt-5 text-[11px] leading-5 text-[hsl(var(--card)/.54)]"><ShieldCheck size={15} className="shrink-0 text-[hsl(var(--accent))]" /> No payment required. We will send a gentle confirmation to your inbox.</div></aside>
      </div>
    </main>
  );
}

function StepPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="reveal rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)] p-5 sm:p-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</p><h2 className="mt-3 mb-8 font-display text-4xl leading-none sm:text-5xl">{title}</h2>{children}</section>;
}
function BackButton({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[.08em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-back"><ChevronLeft size={15} /> Back</button>; }
function Field({ icon, label, value, onChange, type = 'text', required = false, testId }: { icon: React.ReactNode; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; testId: string }) {
  return <label className="block text-xs font-semibold">{label}<span className="relative mt-2 block"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))]">{icon}</span><input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-11 pr-4 text-sm font-normal placeholder:text-[hsl(var(--muted-foreground))]" data-testid={testId} /></span></label>;
}

function Confirmation({ appointment }: { appointment: any }) {
  return <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[760px] items-center px-5 py-16 sm:px-8"><div className="w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 text-center shadow-[0_24px_70px_hsl(var(--secondary)/.08)] sm:p-14"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--secondary))]"><Check size={28} /></span><p className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">It is in the books</p><h1 className="mt-4 font-display text-6xl leading-[.85] sm:text-8xl">See you<br /><i>soon.</i></h1><p className="mx-auto mt-7 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">A confirmation is headed to {appointment.email}. We have kept a chair for you.</p><div className="mx-auto mt-10 max-w-md rounded-2xl bg-[hsl(var(--muted)/.75)] p-5 text-left"><div className="flex justify-between border-b border-[hsl(var(--border))] pb-4"><span className="font-display text-2xl">{appointment.serviceName}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--primary))]">{appointment.status}</span></div><div className="grid gap-4 pt-4 text-sm sm:grid-cols-2"><span className="flex items-center gap-2"><CalendarDays size={15} className="text-[hsl(var(--primary))]" />{new Date(`${appointment.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span><span className="flex items-center gap-2"><Clock3 size={15} className="text-[hsl(var(--primary))]" />{appointment.time}</span><span className="flex items-center gap-2"><UserRound size={15} className="text-[hsl(var(--primary))]" />{appointment.stylistName}</span></div></div><Link href="/appointments" className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary))]" data-testid="link-view-appointments">View your appointments <ArrowRight size={15} /></Link></div></main>;
}

function Appointments() {
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const params = useMemo(() => ({ email: submittedEmail }), [submittedEmail]);
  const appointmentsQuery = useListAppointments(params, { query: { enabled: Boolean(submittedEmail), queryKey: getListAppointmentsQueryKey(params) } });
  const appointments = appointmentsQuery.data ?? [];
  return <main className="mx-auto max-w-[1000px] px-5 py-14 sm:px-8 md:py-24"><div className="max-w-2xl reveal"><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">Your visits</p><h1 className="mt-4 font-display text-6xl leading-[.84] sm:text-8xl">Keep the<br /><i>good times.</i></h1><p className="mt-7 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">Enter the email you used when booking and we will bring up your salon notes.</p></div><form onSubmit={(event) => { event.preventDefault(); setSubmittedEmail(email.trim()); }} className="mt-12 flex max-w-xl flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))]" /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-14 w-full rounded-full border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-11 pr-5 text-sm" data-testid="input-lookup-email" /></div><button type="submit" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-7 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))]" data-testid="button-lookup-appointments"><Search size={15} /> Find my visits</button></form>{submittedEmail && <section className="mt-16 reveal"><div className="mb-6 flex items-center justify-between"><h2 className="font-display text-4xl">Your appointments</h2><span className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{submittedEmail}</span></div>{appointmentsQuery.isLoading ? <div className="space-y-3"><div className="skeleton h-28 rounded-2xl" /><div className="skeleton h-28 rounded-2xl" /></div> : appointmentsQuery.isError ? <ErrorMessage retry={() => appointmentsQuery.refetch()} /> : appointments.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center" data-testid="empty-appointments"><CalendarDays className="mx-auto text-[hsl(var(--primary))]" size={25} /><p className="mt-4 font-display text-2xl">Nothing booked yet.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">When you are ready, we will be here.</p><Link href="/book" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-empty-book">Book a visit <ArrowRight size={14} /></Link></div> : <div className="space-y-3">{appointments.map((appointment) => <div key={appointment.id} className="flex flex-col justify-between gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:flex-row sm:items-center sm:p-6" data-testid={`card-appointment-${appointment.id}`}><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Scissors size={18} /></div><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-display text-2xl">{appointment.serviceName}</h3><span className="rounded-full bg-[hsl(var(--accent)/.35)] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.08em]">{appointment.status}</span></div><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{appointment.stylistName}</p></div></div><div className="flex items-center gap-5 border-t border-[hsl(var(--border)/.7)] pt-4 text-sm sm:border-t-0 sm:pt-0"><span className="flex items-center gap-2"><CalendarDays size={15} className="text-[hsl(var(--primary))]" />{new Date(`${appointment.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span className="flex items-center gap-2"><Clock3 size={15} className="text-[hsl(var(--primary))]" />{appointment.time}</span></div></div>)}</div>}</section>}</main>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/book" component={Book} /><Route path="/appointments" component={Appointments} /><Route path="/manage" component={ManagerSchedule} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Shell><Router /></Shell></WouterRouter></QueryClientProvider>;
}

export default App;
