import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowRight,
  Archive,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Instagram,
  Mail,
  MapPin,
  Menu,
  Pencil,
  Plus,
  Phone,
  Scissors,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  getGetAvailabilityQueryKey,
  getGetSalonSummaryQueryKey,
  getListAppointmentsQueryKey,
  getListManagerAppointmentsQueryKey,
  getListManagerCustomersQueryKey,
  getListServicesQueryKey,
  getListStylistsQueryKey,
  useCancelAppointment,
  useCreateStylist,
  useCreateAppointment,
  useCreateAppointmentGroup,
  useCreateService,
  useGetAvailability,
  useGetSalonSummary,
  useHealthCheck,
  useListAppointments,
  useListManagerAppointments,
  useListManagerCustomers,
  useListServices,
  useListStylists,
  useDeleteService,
  useDeleteStylist,
  useUpdateAppointment,
  useUpdateService,
  useUpdateStylist,
  useUpdateStylistSchedule,
  useUpdateManagerAppointment,
  requestUploadUrl,
  type Service,
  type ServiceInput,
  type Appointment,
  type GroupBooking,
  type Stylist,
  type StylistInput,
  type StylistScheduleEntry,
  type StylistUpdate,
  type ManagerAppointmentUpdate,
} from '@workspace/api-client-react';
import storefrontImage from '@assets/WhatsApp_Image_2026-08-31_at_11.57.17_1788163048747.jpeg';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { bookingSteps } from '@/lib/booking-flow';
import { trackEvent } from '@/lib/analytics';
import { LocaleProvider, useLocale } from '@/lib/locale';
import {
  addIsoDays,
  bookingDateBounds,
  isFutureUaeSlot,
  rolloverDate,
  slotTimeToMinutes,
  uaeDateTimeParts,
  uaeIsoDate,
} from '@/lib/uae-booking-time';
import { Route, Switch, Link, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function useUaeClockTick() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    const refreshOnResume = () => setNow(Date.now());
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshOnResume();
      }
    };

    window.addEventListener('focus', refreshOnResume);
    document.addEventListener('visibilitychange', refreshOnVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnResume);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, []);

  return now;
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object' || !('data' in error)) {
    return fallback;
  }
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || !('error' in data)) {
    return fallback;
  }
  const message = (data as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(20 55% 45%)',
    colorForeground: 'hsl(26 14% 17%)',
    colorMutedForeground: 'hsl(27 11% 42%)',
    colorDanger: 'hsl(5 58% 43%)',
    colorBackground: 'hsl(36 35% 97%)',
    colorInput: 'hsl(36 35% 97%)',
    colorInputForeground: 'hsl(26 14% 17%)',
    colorNeutral: 'hsl(30 13% 79%)',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.85rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[hsl(36_35%_97%)] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display text-3xl text-[hsl(26_14%_17%)]',
    headerSubtitle: 'text-[hsl(27_11%_42%)]',
    socialButtonsBlockButtonText: 'text-[hsl(26_14%_17%)]',
    formFieldLabel: 'text-[hsl(26_14%_17%)]',
    footerActionLink: 'text-[hsl(20_55%_45%)]',
    footerActionText: 'text-[hsl(27_11%_42%)]',
    dividerText: 'text-[hsl(27_11%_42%)]',
    identityPreviewEditButton: 'text-[hsl(20_55%_45%)]',
    formFieldSuccessText: 'text-[hsl(20_55%_45%)]',
    alertText: 'text-[hsl(5_58%_43%)]',
    logoBox: 'h-12 w-12',
    logoImage: 'h-12 w-12 rounded-full',
    socialButtonsBlockButton: 'border-[hsl(30_13%_79%)]',
    formButtonPrimary: 'bg-[hsl(20_55%_45%)] hover:bg-[hsl(16_61%_48%)]',
    formFieldInput: 'border-[hsl(30_14%_73%)] bg-[hsl(36_35%_97%)]',
    footerAction: 'border-0',
    dividerLine: 'bg-[hsl(30_13%_79%)]',
    alert: 'border-[hsl(5_58%_43%/.26)] bg-[hsl(5_58%_43%/.06)]',
    otpCodeFieldInput: 'border-[hsl(30_14%_73%)]',
    formFieldRow: 'gap-2',
    main: 'px-2',
  },
};

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { locale, setLocale, t } = useLocale();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const links = [
    { href: '/', label: t('theSalon'), testId: 'salon' },
    { href: '/book', label: t('bookVisit'), testId: 'book' },
    { href: '/appointments', label: t('yourAppointments'), testId: 'appointments' },
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
           <nav className="hidden items-center gap-9 md:flex" aria-label={t('theSalon')}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                 data-testid={`link-nav-${link.testId}`}
                className={`relative py-2 text-[12px] font-semibold tracking-[.08em] transition-colors hover:text-[hsl(var(--primary))] ${location === link.href ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}
              >
                {link.label}
                {location === link.href && <span className="absolute -bottom-[1px] left-0 h-[2px] w-full bg-[hsl(var(--primary))]" />}
              </Link>
            ))}
          </nav>
           <div className="flex items-center gap-2">
             <div className="flex items-center rounded-full border border-[hsl(var(--border))] p-1 text-[10px] font-bold" aria-label={t('language')}>
               <button type="button" onClick={() => setLocale('en')} aria-pressed={locale === 'en'} className={`rounded-full px-2.5 py-1.5 transition-colors ${locale === 'en' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--card))]' : 'text-[hsl(var(--muted-foreground))]'}`}>EN</button>
               <button type="button" onClick={() => setLocale('ar')} aria-pressed={locale === 'ar'} className={`rounded-full px-2.5 py-1.5 transition-colors ${locale === 'ar' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--card))]' : 'text-[hsl(var(--muted-foreground))]'}`}>العربية</button>
             </div>
             <Link href="/book" className="hidden items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-[11px] font-bold tracking-[.12em] text-[hsl(var(--primary-foreground))] shadow-[0_8px_22px_hsl(var(--primary)/.18)] transition-all hover:-translate-y-0.5 hover:bg-[hsl(16_61%_48%)] md:flex" data-testid="link-header-book">
               {t('reserveChair')} <ArrowRight size={14} />
             </Link>
            <Link href={isSignedIn ? '/appointments' : '/sign-in'} className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] px-3 py-2.5 text-[11px] font-bold text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] md:flex" data-testid={isSignedIn ? 'link-header-account' : 'link-header-sign-in'}>
              <UserRound size={14} /> {isSignedIn ? (user?.firstName || t('myAccount')) : t('signIn')}
            </Link>
           </div>
           <button className="rounded-full p-2 text-[hsl(var(--foreground))] md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? t('closeMenu') : t('openMenu')} data-testid="button-mobile-menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {mobileOpen && (
           <nav className="border-t border-[hsl(var(--border)/.72)] bg-[hsl(var(--background))] px-5 py-4 md:hidden" aria-label={t('theSalon')}>
            {links.map((link) => (
               <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="flex items-center justify-between border-b border-[hsl(var(--border)/.55)] py-4 text-sm font-semibold" data-testid={`link-mobile-${link.testId}`}>
                 {link.label} <ArrowRight size={15} className="text-[hsl(var(--primary))]" />
              </Link>
            ))}
            <Link href={isSignedIn ? '/appointments' : '/sign-in'} onClick={() => setMobileOpen(false)} className="flex items-center justify-between border-b border-[hsl(var(--border)/.55)] py-4 text-sm font-semibold" data-testid="link-mobile-account">
              <span className="flex items-center gap-2"><UserRound size={15} /> {isSignedIn ? t('myAccount') : t('signIn')}</span><ArrowRight size={15} className="text-[hsl(var(--primary))]" />
            </Link>
             <div className="flex items-center justify-between pt-4 text-xs font-semibold">
                 <span>{t('language')}</span>
               <div className="flex items-center gap-2">
                 <button type="button" onClick={() => setLocale('en')} className={locale === 'en' ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}>EN</button>
                 <span className="text-[hsl(var(--border))]">/</span>
                 <button type="button" onClick={() => setLocale('ar')} className={locale === 'ar' ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}>العربية</button>
               </div>
             </div>
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
             <p className="mt-5 max-w-xs text-sm leading-6 text-[hsl(var(--card)/.66)]">{t('salonDescription')}</p>
          </div>
          <div>
             <p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-[hsl(var(--accent))]">{t('findUs')}</p>
             <p className="mt-4 text-sm leading-6 text-[hsl(var(--card)/.76)]">My City Centre Masdar<br />{t('khalifaCity')}</p>
            <a href="tel:+97125520422" className="mt-3 flex items-center gap-2 text-sm text-[hsl(var(--card)/.76)] hover:text-[hsl(var(--accent))]"><Phone size={13} /> +971 2 552 0422</a>
          </div>
          <div>
             <p className="font-mono-ui text-[10px] uppercase tracking-[.22em] text-[hsl(var(--accent))]">{t('stayInTouch')}</p>
             <p className="mt-4 text-sm text-[hsl(var(--card)/.76)]">{t('dailyHours')}</p>
            <a href="https://instagram.com/ct_style_salon" className="mt-3 inline-flex items-center gap-2 text-sm text-[hsl(var(--card)/.76)] hover:text-[hsl(var(--accent))]" data-testid="link-instagram"><Instagram size={14} /> @ct_style_salon</a>
             <Link href="/manage" className="mt-5 flex items-center gap-2 text-[11px] text-[hsl(var(--card)/.5)] hover:text-[hsl(var(--accent))]" data-testid="link-manager-workspace"><ShieldCheck size={13} /> {t('managerWorkspace')}</Link>
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
  const { t } = useLocale();
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--destructive)/.26)] bg-[hsl(var(--destructive)/.06)] p-5 text-sm" data-testid="status-error">
      <div className="flex items-center gap-3"><CircleAlert size={18} className="text-[hsl(var(--destructive))]" /><span>{t('notReachStudio')}</span></div>
      <button onClick={retry} className="rounded-full border border-[hsl(var(--destructive)/.35)] px-4 py-2 text-xs font-bold text-[hsl(var(--destructive))]" data-testid="button-retry">{t('tryAgain')}</button>
    </div>
  );
}

function Home() {
  const { t, formatPrice, serviceCopy, stylistCopy, locale } = useLocale();
  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });
  const summaryQuery = useGetSalonSummary({ query: { queryKey: getGetSalonSummaryQueryKey() } });
  const healthQuery = useHealthCheck();
  const services = servicesQuery.data ?? [];
  const stylists = stylistsQuery.data ?? [];
  const summary = summaryQuery.data;
  const featured = services.filter((service) => service.featured).slice(0, 3).map(serviceCopy);
  const displayedStylists = stylists.map(stylistCopy);

  return (
    <main>
      <section className="relative overflow-hidden bg-[hsl(var(--secondary))] text-[hsl(var(--card))]">
        <div className="absolute inset-0 opacity-40">
           <img src={storefrontImage} alt="CT Style Salon storefront" className="h-full w-full object-cover object-center opacity-75" />
        </div>
         <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--secondary)/.94)_0%,hsl(var(--secondary)/.72)_35%,hsl(var(--secondary)/.2)_100%)]" />
        <div className="relative mx-auto flex min-h-[570px] max-w-[1240px] items-end px-5 pb-14 pt-20 sm:px-8 md:min-h-[640px] md:pb-20">
          <div className="max-w-[650px] reveal">
             <p className="mb-7 flex items-center gap-3 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--accent))]"><span className="h-px w-8 bg-[hsl(var(--accent))]" /> {t('locationLine')}</p>
            <h1 className="font-display text-[clamp(4.5rem,11vw,9rem)] leading-[.78] tracking-[-.045em] text-balance">{t('heroTitle')}</h1>
             <p className="mt-9 max-w-md text-base leading-7 text-[hsl(var(--card)/.74)] sm:text-lg">{t('salonDescription')}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
               <Link href="/book" className="inline-flex items-center gap-3 rounded-full bg-[hsl(var(--accent))] px-6 py-4 text-xs font-bold tracking-[.12em] text-[hsl(var(--foreground))] transition-transform hover:-translate-y-1" data-testid="link-hero-book">{t('findYourTime')} <ArrowRight size={16} /></Link>
               <a href="#services" className="inline-flex items-center gap-2 px-3 py-3 text-xs font-semibold tracking-[.08em] text-[hsl(var(--card)/.75)] hover:text-[hsl(var(--accent))]" data-testid="link-hero-services">{t('exploreServices')} <ChevronRight size={15} /></a>
            </div>
          </div>
          <div className="absolute right-7 top-12 hidden w-28 text-right font-mono-ui text-[9px] uppercase leading-4 tracking-[.16em] text-[hsl(var(--card)/.45)] md:block">
             <span className="mb-2 block h-8 border-r border-[hsl(var(--accent)/.6)]" />{t('goodHairFeeling')}
          </div>
        </div>
      </section>

      <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="mx-auto grid max-w-[1240px] gap-6 px-5 py-7 sm:grid-cols-2 sm:px-8">
          <div className="flex items-center gap-4 border-b border-[hsl(var(--border)/.7)] pb-5 sm:border-b-0 sm:border-r sm:pb-0 sm:pl-6">
            <MapPin size={21} className="text-[hsl(var(--primary))]" />
             <div><strong className="block text-sm">{summary?.neighborhood ?? 'My City Centre Masdar'}</strong><span className="font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">{t('khalifaCity')}</span></div>
          </div>
          <div className="flex items-center gap-4 sm:pl-6">
            <Clock3 size={21} className="text-[hsl(var(--primary))]" />
             <div><strong className="block text-sm">{locale === 'ar' ? t('dailyHours') : (summary?.hours ?? t('dailyHours'))}</strong><span className="font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">{t('sundayOpen')}</span></div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 md:py-28">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
           <div><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('theMenu')}</p><h2 className="mt-3 font-display text-5xl leading-none sm:text-6xl">{t('littleRitual')}</h2></div>
           <p className="max-w-xs text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('serviceIntro')}</p>
        </div>
        {servicesQuery.isLoading ? <LoadingCards /> : servicesQuery.isError ? <ErrorMessage retry={() => servicesQuery.refetch()} /> : featured.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-featured-services">{t('featuredEmpty')}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1.35fr_1fr_1fr]">
            {featured.map((service, index) => (
              <Link href="/book" key={service.id} className={`group relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-2xl border border-[hsl(var(--border))] p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[hsl(var(--primary)/.45)] ${index === 0 ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--card))] md:min-h-[350px]' : 'bg-[hsl(var(--card))]'}`} data-testid={`card-service-${service.id}`}>
                <div className="flex items-start justify-between"><span className="font-mono-ui text-[10px] tracking-[.14em] opacity-60">0{index + 1}</span><ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></div>
                 <div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{service.category}</p><h3 className="mt-3 font-display text-4xl leading-[.9]">{service.name}</h3><p className="mt-4 max-w-[260px] text-sm leading-5 opacity-65">{service.description}</p><div className="mt-6 flex gap-4 font-mono-ui text-[10px] uppercase tracking-[.1em] opacity-60"><span>{service.durationMinutes} {t('minutes')}</span><span>{formatPrice(service.price)}</span></div></div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-[hsl(var(--accent))]">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-[.85fr_1.15fr] md:py-24">
           <div><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--secondary))]">{t('makeItYours')}</p><h2 className="mt-4 max-w-md font-display text-5xl leading-[.88] text-[hsl(var(--secondary))] sm:text-6xl">{t('yourChairWaiting')}</h2></div>
          <div className="flex flex-col gap-5 border-l border-[hsl(var(--secondary)/.25)] pl-6 sm:pl-10">
             <p className="max-w-md text-lg leading-7 text-[hsl(var(--secondary)/.8)]">{t('chooseServicePerson')}</p>
             <Link href="/book" className="inline-flex w-fit items-center gap-3 rounded-full bg-[hsl(var(--secondary))] px-6 py-4 text-xs font-bold tracking-[.12em] text-[hsl(var(--card))] transition-transform hover:-translate-y-1" data-testid="link-cta-book">{t('bookAppointment')} <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 md:py-28">
         <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('thePeople')}</p><h2 className="mt-3 font-display text-5xl leading-none sm:text-6xl">{t('goodHands')}</h2></div><p className="max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('peopleIntro')}</p></div>
         {stylistsQuery.isLoading ? <div className="mt-10"><LoadingCards count={3} /></div> : stylistsQuery.isError ? <div className="mt-10"><ErrorMessage retry={() => stylistsQuery.refetch()} /></div> : displayedStylists.length === 0 ? <div className="mt-10 rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-stylists">{t('teamOnWay')}</div> : (
           <div className="people-marquee mt-10" data-testid="people-marquee">
             <div className="people-marquee-track">
               {[0, 1].map((copy) => (
                 <div key={copy} className="people-marquee-group" aria-hidden={copy === 1 ? true : undefined}>
                   {displayedStylists.map((stylist) => (
                     <article key={`${copy}-${stylist.id}`} className="people-marquee-card group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-transform hover:-translate-y-1" data-testid={copy === 0 ? `card-stylist-${stylist.id}` : undefined}>
                       <div className="mb-12 flex items-start justify-between"><StylistAvatar stylist={stylist} className="h-14 w-14" /><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">0{stylist.id}</span></div>
                       <p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">{stylist.role}</p>
                       <h3 className="mt-2 font-display text-3xl">{stylist.name}</h3>
                       {stylist.bio && <p className="mt-3 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{stylist.bio}</p>}
                     </article>
                   ))}
                 </div>
               ))}
             </div>
           </div>
         )}
      </section>
       <div className="mx-auto max-w-[1240px] px-5 pb-10 text-right font-mono-ui text-[9px] tracking-[.12em] text-[hsl(var(--muted-foreground))] sm:px-8" data-testid="status-health">{t('studioStatus')} · {healthQuery.data?.status ?? (healthQuery.isLoading ? t('checking') : t('available'))}</div>
    </main>
  );
}

const weekDays = [
  { value: 1, short: 'mon' }, { value: 2, short: 'tue' }, { value: 3, short: 'wed' },
  { value: 4, short: 'thu' }, { value: 5, short: 'fri' }, { value: 6, short: 'sat' },
  { value: 0, short: 'sun' },
];

function presetBreak(openTime = '10:00', closeTime = '18:00') {
  const [openHour, openMinute] = openTime.split(':').map(Number);
  const [closeHour, closeMinute] = closeTime.split(':').map(Number);
  const open = openHour * 60 + openMinute;
  const close = closeHour * 60 + closeMinute;
  const duration = Math.max(15, close - open);
  const breakDuration = Math.min(60, duration);
  const preferredStart = open + 180;
  const start = Math.min(preferredStart, close - breakDuration);
  const formatTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return { startTime: formatTime(start), endTime: formatTime(start + breakDuration) };
}

function scheduleWithPresetBreaks(schedule: StylistScheduleEntry[]): StylistScheduleEntry[] {
  return schedule.map((entry) => entry.breaks === undefined ? { ...entry, breaks: [presetBreak()] } : entry);
}

function scheduleErrorMessage(
  error: unknown,
  fallback: string,
  translations: {
    openingBeforeClosing?: string;
    scheduleOverlap?: string;
    breakBeforeEnd?: string;
    breakOutsideHours?: string;
    breakOverlap?: string;
    serviceDeleteConflict?: string;
  },
) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      if (data.error === 'Each opening time must be earlier than its closing time.') return translations.openingBeforeClosing ?? data.error;
      if (data.error === 'Working hours cannot overlap on the same day.') return translations.scheduleOverlap ?? data.error;
      if (data.error === 'Each break must start before it ends.') return translations.breakBeforeEnd ?? data.error;
      if (data.error === 'Breaks must fall within working hours.') return translations.breakOutsideHours ?? data.error;
      if (data.error === 'Breaks cannot overlap on the same day.') return translations.breakOverlap ?? data.error;
      if (data.error === 'This service cannot be deleted because it has existing appointments.') return translations.serviceDeleteConflict ?? data.error;
      return data.error;
    }
  }
  return fallback;
}

function isManagerAccessDenied(error: unknown) {
  if (!error || typeof error !== 'object' || !('data' in error)) return false;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || !('error' in data)) return false;
  return (data as { error?: unknown }).error === 'Your account does not have salon manager access.';
}
function validateScheduleInForm(schedule: StylistScheduleEntry[]) {
  for (const entry of schedule) {
    if (entry.openTime >= entry.closeTime) {
      return 'Each opening time must be earlier than its closing time.';
    }
    const breaks = entry.breaks ?? [];
    for (const breakTime of breaks) {
      if (breakTime.startTime >= breakTime.endTime) {
        return 'Each break must start before it ends.';
      }
      if (breakTime.startTime < entry.openTime || breakTime.endTime > entry.closeTime) {
        return 'Breaks must fall within working hours.';
      }
    }
    for (let breakIndex = 0; breakIndex < breaks.length; breakIndex += 1) {
      for (let otherBreakIndex = breakIndex + 1; otherBreakIndex < breaks.length; otherBreakIndex += 1) {
        const breakTime = breaks[breakIndex];
        const otherBreak = breaks[otherBreakIndex];
        if (breakTime.startTime < otherBreak.endTime && otherBreak.startTime < breakTime.endTime) {
          return 'Breaks cannot overlap on the same day.';
        }
      }
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

function StylistAvatar({ stylist, className = 'h-12 w-12', alt }: { stylist: Stylist; className?: string; alt?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const photoSource = stylistPhotoSource(stylist.photoUrl);
  useEffect(() => setImageFailed(false), [photoSource]);
  if (photoSource && !imageFailed) {
    return <img src={photoSource} alt={alt ?? stylist.name} className={`${className} rounded-full object-cover`} onError={() => setImageFailed(true)} />;
  }
  return <span className={`${className} grid place-items-center rounded-full text-sm font-bold`} style={{ backgroundColor: `${stylist.accent}25`, color: stylist.accent }} aria-label={alt ?? stylist.name}>{stylistInitials(stylist)}</span>;
}

function stylistInitials(stylist: Stylist) {
  const initials = stylist.initials.trim();
  if (initials) return initials;
  const nameParts = stylist.name.trim().split(/\s+/).filter(Boolean);
  return nameParts.length > 1
    ? nameParts.map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : nameParts[0]?.slice(0, 2).toUpperCase() || '?';
}

function stylistPhotoSource(photoUrl?: string | null): string | undefined {
  if (!photoUrl) return undefined;
  return photoUrl.startsWith('/objects/') ? `/api/storage${photoUrl}` : photoUrl;
}

const EMPLOYEE_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_EMPLOYEE_PHOTO_SIZE = 5 * 1024 * 1024;

function uploadFileToStorage(file: File, uploadURL: string, onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadURL);
    request.setRequestHeader('Content-Type', file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Photo upload failed.'));
    request.onerror = () => reject(new Error('Photo upload failed.'));
    request.send(file);
  });
}

function ScheduleFields({
  schedule,
  onChange,
  idPrefix,
}: {
  schedule: StylistScheduleEntry[];
  onChange: (schedule: StylistScheduleEntry[]) => void;
  idPrefix: string;
}) {
  const { t, weekday } = useLocale();
  const entryForDay = (dayOfWeek: number) => schedule.find((entry) => entry.dayOfWeek === dayOfWeek);
  const updateEntry = (dayOfWeek: number, field: 'openTime' | 'closeTime', value: string) => {
    onChange(schedule.map((entry) => entry.dayOfWeek === dayOfWeek ? { ...entry, [field]: value } : entry));
  };
  const updateBreak = (dayOfWeek: number, breakIndex: number, field: 'startTime' | 'endTime', value: string) => {
    onChange(schedule.map((entry) => entry.dayOfWeek === dayOfWeek
      ? { ...entry, breaks: (entry.breaks ?? []).map((breakTime, index) => index === breakIndex ? { ...breakTime, [field]: value } : breakTime) }
      : entry));
  };
  const addBreak = (dayOfWeek: number) => {
    onChange(schedule.map((entry) => entry.dayOfWeek === dayOfWeek
      ? { ...entry, breaks: [...(entry.breaks ?? []), presetBreak(entry.openTime, entry.closeTime)] }
      : entry));
  };
  const removeBreak = (dayOfWeek: number, breakIndex: number) => {
    onChange(schedule.map((entry) => entry.dayOfWeek === dayOfWeek
      ? { ...entry, breaks: (entry.breaks ?? []).filter((_, index) => index !== breakIndex) }
      : entry));
  };
  const toggleDay = (dayOfWeek: number, enabled: boolean) => {
    if (!enabled) {
      onChange(schedule.filter((entry) => entry.dayOfWeek !== dayOfWeek));
      return;
    }
    onChange([...schedule, { dayOfWeek, openTime: '10:00', closeTime: '18:00', breaks: [presetBreak()] }].sort((left, right) => left.dayOfWeek - right.dayOfWeek));
  };

  return (
    <div className="space-y-2">
      {weekDays.map((day) => {
        const entry = entryForDay(day.value);
        return (
          <div key={day.value} className={`grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(140px,1fr)_1fr_1fr] ${entry ? 'border-[hsl(var(--border))] bg-[hsl(var(--background)/.45)]' : 'border-transparent bg-[hsl(var(--muted)/.45)]'}`}>
            <label className="flex items-center gap-3 text-sm font-semibold">
              <input type="checkbox" checked={Boolean(entry)} onChange={(event) => toggleDay(day.value, event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid={`checkbox-schedule-${idPrefix}-${day.short}`} />
              <span>{weekday(new Date(Date.UTC(2023, 0, 1 + day.value)), false)}</span>
            </label>
            {entry ? (
              <>
                <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{t('open')}
                  <input type="time" value={entry.openTime} onChange={(event) => updateEntry(day.value, 'openTime', event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-open-${idPrefix}-${day.short}`} />
                </label>
                <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{t('close')}
                  <input type="time" value={entry.closeTime} onChange={(event) => updateEntry(day.value, 'closeTime', event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-close-${idPrefix}-${day.short}`} />
                </label>
                <div className="sm:col-span-3 rounded-lg border border-[hsl(var(--border)/.75)] bg-[hsl(var(--card)/.55)] p-2.5" data-testid={`breaks-${idPrefix}-${day.short}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-ui text-[9px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{t('breaks')}</span>
                    {(entry.breaks ?? []).length < 3 && <button type="button" onClick={() => addBreak(day.value)} className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2.5 py-1.5 text-[10px] font-bold hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid={`button-add-break-${idPrefix}-${day.short}`}><Plus size={12} /> {t('addBreak')}</button>}
                  </div>
                  {(entry.breaks ?? []).length === 0 ? <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{t('noBreaks')}</p> : (
                    <div className="mt-2 space-y-2">
                      {(entry.breaks ?? []).map((breakTime, breakIndex) => (
                        <div key={`${day.value}-${breakIndex}`} className="flex flex-wrap items-center gap-2" data-testid={`break-row-${idPrefix}-${day.short}-${breakIndex}`}>
                          <label className="flex min-w-[130px] flex-1 items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{t('breakStart')}<input type="time" value={breakTime.startTime} onChange={(event) => updateBreak(day.value, breakIndex, 'startTime', event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-2 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-break-start-${idPrefix}-${day.short}-${breakIndex}`} /></label>
                          <label className="flex min-w-[130px] flex-1 items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{t('breakEnd')}<input type="time" value={breakTime.endTime} onChange={(event) => updateBreak(day.value, breakIndex, 'endTime', event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-2 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-break-end-${idPrefix}-${day.short}-${breakIndex}`} /></label>
                          <button type="button" onClick={() => removeBreak(day.value, breakIndex)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]" aria-label={t('removeBreak')} data-testid={`button-remove-break-${idPrefix}-${day.short}-${breakIndex}`}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : <span className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))] sm:col-span-2">{t('dayOff')}</span>}
          </div>
        );
      })}
    </div>
  );
}
function ScheduleEditor({ stylist, embedded = false }: { stylist: Stylist; embedded?: boolean }) {
  const { t, weekday, stylistCopy } = useLocale();
  const displayedStylist = stylistCopy(stylist);
  const [schedule, setSchedule] = useState<StylistScheduleEntry[]>(() => scheduleWithPresetBreaks(stylist.schedule));
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string }>();
  const [expanded, setExpanded] = useState(false);
  const updateSchedule = useUpdateStylistSchedule({
  });

  useEffect(() => {
    setSchedule(scheduleWithPresetBreaks(stylist.schedule));
  }, [stylist.id, stylist.schedule]);

  const entryForDay = (dayOfWeek: number) => schedule.find((entry) => entry.dayOfWeek === dayOfWeek);
  const updateEntry = (dayOfWeek: number, field: 'openTime' | 'closeTime', value: string) => {
    setFeedback(undefined);
    setSchedule((current) => current.map((entry) => entry.dayOfWeek === dayOfWeek ? { ...entry, [field]: value } : entry));
  };
  const updateBreak = (dayOfWeek: number, breakIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setFeedback(undefined);
    setSchedule((current) => current.map((entry) => entry.dayOfWeek === dayOfWeek
      ? { ...entry, breaks: (entry.breaks ?? []).map((breakTime, index) => index === breakIndex ? { ...breakTime, [field]: value } : breakTime) }
      : entry));
  };
  const addBreak = (dayOfWeek: number) => {
    setFeedback(undefined);
    setSchedule((current) => current.map((entry) => entry.dayOfWeek === dayOfWeek
      ? { ...entry, breaks: [...(entry.breaks ?? []), { startTime: '13:00', endTime: '14:00' }] }
      : entry));
  };
  const removeBreak = (dayOfWeek: number, breakIndex: number) => {
    setFeedback(undefined);
    setSchedule((current) => current.map((entry) => entry.dayOfWeek === dayOfWeek
      ? { ...entry, breaks: (entry.breaks ?? []).filter((_, index) => index !== breakIndex) }
      : entry));
  };
  const toggleDay = (dayOfWeek: number, enabled: boolean) => {
    setFeedback(undefined);
    setSchedule((current) => {
      if (!enabled) return current.filter((entry) => entry.dayOfWeek !== dayOfWeek);
      return [...current, { dayOfWeek, openTime: '10:00', closeTime: '18:00', breaks: [presetBreak()] }].sort((left, right) => left.dayOfWeek - right.dayOfWeek);
    });
  };
  const save = () => {
    const validationError = validateScheduleInForm(schedule);
    if (validationError) {
       const message = validationError === 'Each opening time must be earlier than its closing time.'
         ? t('openingBeforeClosing')
         : validationError === 'Working hours cannot overlap on the same day.'
           ? t('scheduleOverlap')
           : validationError === 'Each break must start before it ends.'
             ? t('breakBeforeEnd')
             : validationError === 'Breaks must fall within working hours.'
               ? t('breakOutsideHours')
               : t('breakOverlap');
       setFeedback({ tone: 'error', message });
      return;
    }
    updateSchedule.mutate(
      { stylistId: stylist.id, data: { schedule } },
      {
        onSuccess: (updatedStylist) => {
          setSchedule(updatedStylist.schedule);
           setFeedback({ tone: 'success', message: `${stylist.name} ${t('scheduleSaved')}` });
          queryClient.invalidateQueries({ queryKey: getListStylistsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
        },
        onError: (error) => {
           setFeedback({ tone: 'error', message: scheduleErrorMessage(error, t('scheduleError'), {
             openingBeforeClosing: t('openingBeforeClosing'),
             scheduleOverlap: t('scheduleOverlap'),
             breakBeforeEnd: t('breakBeforeEnd'),
             breakOutsideHours: t('breakOutsideHours'),
             breakOverlap: t('breakOverlap'),
           }) });
        },
      },
    );
  };
  return (
    <section className={embedded ? 'mt-4 border-t border-[hsl(var(--border))] pt-4' : 'rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-5'} data-testid={`schedule-editor-${stylist.id}`}>
       <div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            {!embedded && <StylistAvatar stylist={stylist} className="h-10 w-10 shrink-0" alt="" />}
            <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} aria-controls={`schedule-details-${stylist.id}`} className="min-w-0 text-left">
              {embedded ? (
                <>
                  <span className="flex items-center gap-2"><span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.14em] text-[hsl(var(--primary))]">{t('workingSchedule')}</span><ChevronDown size={16} className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} /></span>
                  <p className="mt-0.5 font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">{schedule.length} {t('days')}</p>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-2"><h2 className="font-display text-xl">{displayedStylist.name}</h2><ChevronDown size={16} className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} /></span>
                  <p className="mt-0.5 font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">{displayedStylist.role} · {schedule.length} {t('days')}</p>
                </>
              )}
            </button>
         </div>
         <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={save} disabled={updateSchedule.isPending} className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" data-testid={`button-save-schedule-${stylist.id}`}>
            {updateSchedule.isPending ? t('saving') : t('saveSchedule')} <Check size={14} />
           </button>
         </div>
      </div>
        <div id={`schedule-details-${stylist.id}`} hidden={!expanded} className="mt-4 space-y-2">
        {weekDays.map((day) => {
          const entry = entryForDay(day.value);
          return (
             <div key={day.value} className={`grid items-center gap-2 rounded-xl border p-2.5 sm:grid-cols-[minmax(140px,1fr)_1fr_1fr] ${entry ? 'border-[hsl(var(--border))] bg-[hsl(var(--background)/.45)]' : 'border-transparent bg-[hsl(var(--muted)/.45)]'}`}>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input type="checkbox" checked={Boolean(entry)} onChange={(event) => toggleDay(day.value, event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid={`checkbox-schedule-${stylist.id}-${day.short.toLowerCase()}`} />
                 <span>{weekday(new Date(Date.UTC(2023, 0, 1 + day.value)), false)}</span>
              </label>
              {entry ? (
                <>
                   <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{t('open')}
                     <input type="time" value={entry.openTime} onChange={(event) => updateEntry(day.value, 'openTime', event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-2 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-open-${stylist.id}-${day.short.toLowerCase()}`} />
                  </label>
                   <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{t('close')}
                     <input type="time" value={entry.closeTime} onChange={(event) => updateEntry(day.value, 'closeTime', event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-2 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-close-${stylist.id}-${day.short.toLowerCase()}`} />
                  </label>
                   <div className="sm:col-span-3 rounded-lg border border-[hsl(var(--border)/.75)] bg-[hsl(var(--card)/.55)] p-2.5" data-testid={`breaks-${stylist.id}-${day.short.toLowerCase()}`}>
                     <div className="flex flex-wrap items-center justify-between gap-2">
                       <span className="font-mono-ui text-[9px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{t('breaks')}</span>
                       {(entry.breaks ?? []).length < 3 && <button type="button" onClick={() => addBreak(day.value)} className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2.5 py-1.5 text-[10px] font-bold hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid={`button-add-break-${stylist.id}-${day.short.toLowerCase()}`}><Plus size={12} /> {t('addBreak')}</button>}
                     </div>
                     {(entry.breaks ?? []).length === 0 ? <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{t('noBreaks')}</p> : (
                       <div className="mt-2 space-y-2">
                         {(entry.breaks ?? []).map((breakTime, breakIndex) => (
                           <div key={`${day.value}-${breakIndex}`} className="flex flex-wrap items-center gap-2" data-testid={`break-row-${stylist.id}-${day.short.toLowerCase()}-${breakIndex}`}>
                             <label className="flex min-w-[130px] flex-1 items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{t('breakStart')}<input type="time" value={breakTime.startTime} onChange={(event) => updateBreak(day.value, breakIndex, 'startTime', event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-2 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-break-start-${stylist.id}-${day.short.toLowerCase()}-${breakIndex}`} /></label>
                             <label className="flex min-w-[130px] flex-1 items-center gap-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{t('breakEnd')}<input type="time" value={breakTime.endTime} onChange={(event) => updateBreak(day.value, breakIndex, 'endTime', event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-2 text-sm font-normal normal-case tracking-normal text-[hsl(var(--foreground))]" data-testid={`input-break-end-${stylist.id}-${day.short.toLowerCase()}-${breakIndex}`} /></label>
                             <button type="button" onClick={() => removeBreak(day.value, breakIndex)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]" aria-label={t('removeBreak')} data-testid={`button-remove-break-${stylist.id}-${day.short.toLowerCase()}-${breakIndex}`}><Trash2 size={14} /></button>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                </>
               ) : <span className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))] sm:col-span-2">{t('dayOff')}</span>}
            </div>
          );
        })}
      </div>
      {feedback && <p className={`mt-4 text-sm ${feedback.tone === 'error' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--secondary))]'}`} role={feedback.tone === 'error' ? 'alert' : 'status'} data-testid={`status-schedule-${stylist.id}`}>{feedback.message}</p>}
       {expanded && <p className="mt-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">{t('scheduleIntro')}</p>}
    </section>
  );
}

type EmployeeFormState = {
  name: string;
  role: string;
  bio: string;
  initials: string;
  accent: string;
  photoUrl: string;
  schedule: StylistScheduleEntry[];
  serviceIds: number[];
};
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
  const { t } = useLocale();
  const [form, setForm] = useState<ServiceFormState>(() => service ? serviceToForm(service) : emptyServiceForm);
  const [feedback, setFeedback] = useState<string>();
  const createService = useCreateService({
  });
  const updateService = useUpdateService({
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
       setFeedback(t('errorRequired'));
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
       setFeedback(t('errorDuration'));
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim()) || !Number.isFinite(price) || price < 0) {
       setFeedback(t('errorPrice'));
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
       setFeedback(scheduleErrorMessage(error, t('serviceSaveError'), { openingBeforeClosing: t('openingBeforeClosing'), scheduleOverlap: t('scheduleOverlap') }));
    };
    if (service) {
      updateService.mutate(
        { serviceId: service.id, data },
        {
           onSuccess: () => onSaved(`${service.name} ${t('serviceUpdated')}`),
          onError,
        },
      );
    } else {
      createService.mutate(
        { data },
        {
           onSuccess: () => onSaved(`${name} ${t('serviceAdded')}`),
          onError,
        },
      );
    }
  };

  return (
    <form onSubmit={save} className="mt-4 rounded-xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card))] p-4 shadow-[0_10px_24px_hsl(var(--secondary)/.05)] sm:p-5" data-testid={service ? `service-editor-${service.id}` : 'service-editor-new'}>
      <div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-4 sm:flex-row sm:items-start">
        <div>
           <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{service ? t('editService') : t('newService')}</p>
           <h2 className="mt-1 font-display text-2xl">{service ? service.name : t('addToMenu')}</h2>
        </div>
         <button type="button" onClick={onCancel} className="self-start text-xs font-bold tracking-[.08em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-cancel-service">{t('cancel')}</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
         <label className="text-xs font-semibold">{t('name')}
           <input required value={form.name} onChange={(event) => updateField('name', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-service-name" />
        </label>
         <label className="text-xs font-semibold">{t('category')}
            <input required value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder={t('hairBeardSignature')} className="mt-1.5 h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-service-category" />
        </label>
         <label className="text-xs font-semibold sm:col-span-2">{t('description')}
           <textarea required value={form.description} onChange={(event) => updateField('description', event.target.value)} className="mt-1.5 min-h-[76px] w-full resize-y rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-3 text-sm font-normal" data-testid="input-service-description" />
        </label>
         <label className="text-xs font-semibold">{t('price')}
            <div className="relative mt-1.5"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))]">AED</span><input required type="text" inputMode="decimal" value={form.price} onChange={(event) => updateField('price', event.target.value)} placeholder="120.00" className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-12 pr-3 text-sm font-normal" data-testid="input-service-price" /></div>
        </label>
         <label className="text-xs font-semibold">{t('duration')}
            <div className="relative mt-1.5"><input required type="number" min="1" step="1" value={form.durationMinutes} onChange={(event) => updateField('durationMinutes', event.target.value)} placeholder="45" className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 pr-16 text-sm font-normal" data-testid="input-service-duration" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{t('minutes')}</span></div>
        </label>
      </div>
      <label className="mt-5 flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={form.featured} onChange={(event) => updateField('featured', event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid="checkbox-service-featured" />
         {t('showFeatured')}
      </label>
      <div className="mt-4 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[hsl(var(--border))] pt-4 sm:flex-row sm:items-center">
         {feedback ? <p className="text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-service-error">{feedback}</p> : <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('durationControls')}</span>}
        <button type="submit" disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" data-testid="button-save-service">
           {isPending ? t('saving') : service ? t('saveChanges') : t('addService')} <Check size={14} />
        </button>
      </div>
    </form>
  );
}

function ServiceManagement() {
  const { t, formatPrice } = useLocale();
  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const services = servicesQuery.data ?? [];
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string }>();
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const deleteService = useDeleteService({});

  const finishSave = (message: string) => {
    setEditing(null);
    setFeedback({ tone: 'success', message });
    queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
  };

  return (
    <section id="service-management" className="manager-section mt-0 rounded-2xl border p-4 sm:p-5" data-testid="service-management">
      <div className={`flex flex-col justify-between gap-3 sm:flex-row sm:items-end ${expanded ? 'border-b border-[hsl(var(--border))] pb-4' : ''}`}>
         <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} aria-controls="service-management-details" className="min-w-0 text-left">
           <span className="manager-section-header block ps-3"><span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{t('serviceMenu')}</span><span className="mt-1 flex items-center gap-2"><span className="font-display text-3xl">{t('rituals')}</span><ChevronDown size={17} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /></span><span className="mt-1 block text-sm text-[hsl(var(--muted-foreground))]">{t('serviceIntroManager')}</span></span>
         </button>
         <div className="flex flex-wrap gap-2">
           <button type="button" onClick={() => setExpanded((current) => !current)} className="inline-flex min-h-10 items-center justify-center rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] hover:border-[hsl(var(--primary))]" data-testid="button-toggle-services">{expanded ? t('closeSection') : t('openAndEdit')}</button>
           <button type="button" onClick={() => { setExpanded(true); setEditing('new'); setFeedback(undefined); setConfirmingDelete(null); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-4 py-2.5 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--card))] hover:bg-[hsl(var(--secondary)/.88)]" data-testid="button-add-service"><Plus size={15} /> {t('addService')}</button>
         </div>
      </div>
      <div id="service-management-details" hidden={!expanded}>
       {feedback && <p className={`mt-4 text-sm ${feedback.tone === 'error' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--secondary))]'}`} role={feedback.tone === 'error' ? 'alert' : 'status'} data-testid={feedback.tone === 'error' ? 'status-service-delete-error' : 'status-service-success'}>{feedback.message}</p>}
      {editing === 'new' && <ServiceEditor onCancel={() => setEditing(null)} onSaved={finishSave} />}
       <div className="mt-4 space-y-2">
         {servicesQuery.isLoading ? <LoadingCards count={2} /> : servicesQuery.isError ? <ErrorMessage retry={() => servicesQuery.refetch()} /> : services.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-10 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-managed-services">{t('noManagedServices')}</div> : services.map((service) => (
          <div key={service.id} className="flex flex-col gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`service-manager-card-${service.id}`}>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl">{service.name}</h3>{service.featured && <span className="rounded-full bg-[hsl(var(--accent)/.45)] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.08em]">{t('featured')}</span>}</div>
               <p className="mt-1 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{service.description}</p>
                <div className="mt-2 flex flex-wrap gap-3 font-mono-ui text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]"><span>{service.category}</span><span>{service.durationMinutes} {t('minutes')}</span><span>{formatPrice(service.price)}</span></div>
            </div>
              {confirmingDelete === service.id ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--destructive)/.28)] bg-[hsl(var(--destructive)/.05)] p-2" role="alert" data-testid={`confirm-delete-service-${service.id}`}>
                  <span className="px-1 text-[11px] text-[hsl(var(--destructive))]">{t('confirmDeleteService')} <span className="opacity-70">{t('deleteServiceWarning')}</span></span>
                  <button type="button" onClick={() => { setConfirmingDelete(null); }} className="rounded-full border border-[hsl(var(--border))] px-3 py-2 text-[10px] font-bold" data-testid={`button-cancel-delete-service-${service.id}`}>{t('cancel')}</button>
                  <button type="button" disabled={deleteService.isPending} onClick={() => deleteService.mutate({ serviceId: service.id }, {
                    onSuccess: () => {
                      setConfirmingDelete(null);
                      setFeedback({ tone: 'success', message: `${service.name} ${t('serviceDeleted')}` });
                      queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
                    },
                    onError: (error) => {
                      setFeedback({ tone: 'error', message: scheduleErrorMessage(error, t('serviceDeleteError'), { serviceDeleteConflict: t('serviceDeleteConflict') }) });
                      setConfirmingDelete(null);
                    },
                  })} className="rounded-full bg-[hsl(var(--destructive))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--destructive-foreground))] disabled:opacity-60" data-testid={`button-confirm-delete-service-${service.id}`}>{deleteService.isPending ? t('saving') : t('confirmDelete')}</button>
                </div>
              ) : (
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => { setEditing(service.id); setFeedback(undefined); setConfirmingDelete(null); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-[hsl(var(--border))] px-3 py-2.5 text-[11px] font-bold tracking-[.1em] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid={`button-edit-service-${service.id}`}>{t('editService')} <ArrowRight size={14} /></button>
                  <button type="button" onClick={() => { setConfirmingDelete(service.id); setEditing(null); setFeedback(undefined); }} className="inline-flex items-center justify-center rounded-full border border-[hsl(var(--destructive)/.35)] px-3 py-2.5 text-[11px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.06)]" aria-label={`${t('deleteService')} ${service.name}`} data-testid={`button-delete-service-${service.id}`}><Trash2 size={14} /></button>
                </div>
              )}
          </div>
        ))}
      </div>
      {typeof editing === 'number' && services.find((service) => service.id === editing) && <ServiceEditor service={services.find((service) => service.id === editing)} onCancel={() => setEditing(null)} onSaved={finishSave} />}
      </div>
    </section>
  );
}

function EmployeeCard({
  stylist,
  isEditing,
  isRemoving,
  onEdit,
  onRemove,
  onCancel,
  onSaved,
}: {
  stylist: Stylist;
  isEditing: boolean;
  isRemoving: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useLocale();

  return (
    <article className="manager-list-row rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid={`employee-card-${stylist.id}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <StylistAvatar stylist={stylist} className="h-12 w-12 shrink-0" alt={`${stylist.name} ${t('profilePhoto')}`} />
          <div className="min-w-0">
            <h3 className="font-display text-2xl">{stylist.name}</h3>
            <p className="mt-0.5 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">{stylist.role}</p>
            {stylist.bio && <p className="mt-2 max-w-xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">{stylist.bio}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onEdit} className="inline-flex items-center justify-center gap-2 rounded-full border border-[hsl(var(--border))] px-4 py-3 text-[11px] font-bold tracking-[.1em] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid={`button-edit-employee-${stylist.id}`}><Pencil size={14} /> {t('editEmployee')}</button>
          <button type="button" onClick={onRemove} disabled={isRemoving} className="inline-flex items-center justify-center gap-2 rounded-full border border-[hsl(var(--destructive)/.35)] px-4 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.06)] disabled:opacity-60" data-testid={`button-remove-employee-${stylist.id}`}><Trash2 size={14} /> {t('removeEmployee')}</button>
        </div>
      </div>
      {isEditing && <EmployeeProfileEditor stylist={stylist} onCancel={onCancel} onSaved={onSaved} />}
      <ScheduleEditor stylist={stylist} embedded />
    </article>
  );
}

function ManagerCustomers() {
  const { t, formatDate } = useLocale();
  const customersQuery = useListManagerCustomers({ query: { queryKey: getListManagerCustomersQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const customers = customersQuery.data ?? [];
  const [expanded, setExpanded] = useState(false);

  return (
       <section id="customer-management" className="manager-section mt-0 rounded-2xl border p-4 sm:p-5" data-testid="customer-management">
      <div className={`flex flex-col justify-between gap-3 sm:flex-row sm:items-center ${expanded ? 'border-b border-[hsl(var(--border))] pb-4' : ''}`}>
        <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} aria-controls="customer-management-details" className="min-w-0 text-left">
          <span className="manager-section-header block ps-3">
            <span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{t('customerList')}</span>
            <span className="mt-1 flex items-center gap-2"><span className="font-display text-3xl">{t('customers')}</span><ChevronDown size={17} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /></span>
            <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{t('customerIntro')}</span>
          </span>
        </button>
        <button type="button" onClick={() => setExpanded((current) => !current)} className="inline-flex min-h-10 items-center justify-center rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] hover:border-[hsl(var(--primary))]" data-testid="button-toggle-customers">{expanded ? t('closeSection') : t('openAndEdit')}</button>
      </div>
      <div id="customer-management-details" className="mt-4 space-y-3" hidden={!expanded}>
        {customersQuery.isLoading ? <LoadingCards count={2} /> : customersQuery.isError ? <ErrorMessage retry={() => customersQuery.refetch()} /> : customers.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noCustomers')}</div> : customers.map((customer) => (
          <article key={customer.email} className="manager-list-row rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid={`customer-manager-card-${customer.email}`}>
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><UserRound size={16} /></span><div className="min-w-0"><h3 className="truncate font-semibold">{customer.customerName}</h3><p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{customer.email}</p><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{customer.phone}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-[hsl(var(--border))] pt-3 font-mono-ui text-[10px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]"><span>{customer.appointmentCount} {t('visits')}</span><span>{customer.upcomingAppointmentCount} {t('upcoming')}</span>{customer.lastVisit && <span>{t('lastVisit')} {formatDate(customer.lastVisit, { month: 'short', day: 'numeric' })}</span>}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function downloadAppointmentsCsv(appointments: Appointment[], filename: string) {
  const headers = ['Date', 'Time', 'Customer', 'Phone', 'Email', 'Stylist', 'Services', 'Status', 'Price', 'Duration', 'Notes', 'Created'];

  const escapeCsv = (str: string | number | null | undefined) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = appointments.map(a => [
    a.date,
    a.time,
    a.customerName,
    a.phone,
    a.email,
    a.stylistName,
    a.serviceNames.join(', '),
    a.status,
    a.totalPrice,
    a.totalDurationMinutes,
    a.notes || '',
    a.createdAt
  ]);

  const csvContent = [headers.map(escapeCsv).join(','), ...rows.map(row => row.map(escapeCsv).join(','))].join('\r\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function timeInputValue(value: string): string {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(value);
  if (!match) return value;
  const hour = (Number(match[1]) % 12) + (match[3] === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function appointmentTimeValue(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hour24 = Number(match[1]);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${match[2]} ${period}`;
}

function bookingLinkStylistId(): number | undefined {
  const value = Number(new URLSearchParams(window.location.search).get('stylistId'));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function appointmentStart(appointment: Pick<Appointment, 'date' | 'time'>): number {
  const [year, month, day] = localIsoDate(appointment.date).split('-').map(Number);
  const inputTime = timeInputValue(appointment.time);
  const [hour, minute] = inputTime.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function scheduleMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function stylistHasAvailabilityWithinTwoHours(
  stylist: Stylist,
  appointments: Appointment[],
  now: Date,
): boolean {
  const current = uaeDateTimeParts(now);
  const weekday = new Date(`${current.date}T12:00:00.000Z`).getUTCDay();
  const latestStart = current.minutes + 120;
  const activeAppointments = appointments.filter((appointment) =>
    localIsoDate(appointment.date) === current.date &&
    appointment.stylistId === stylist.id &&
    !['cancelled', 'completed'].includes(appointment.status.trim().toLowerCase()),
  );

  return stylist.schedule
    .filter((entry) => entry.dayOfWeek === weekday)
    .some((entry) => {
      const open = scheduleMinutes(entry.openTime);
      const close = scheduleMinutes(entry.closeTime);
      for (let start = open; start + 90 <= close; start += 90) {
        if (start < current.minutes || start > latestStart) continue;
        const overlapsBreak = (entry.breaks ?? []).some((breakTime) => {
          const breakStart = scheduleMinutes(breakTime.startTime);
          const breakEnd = scheduleMinutes(breakTime.endTime);
          return start < breakEnd && breakStart < start + 90;
        });
        if (overlapsBreak) continue;
        const overlapsAppointment = activeAppointments.some((appointment) => {
          const appointmentStartMinutes = slotTimeToMinutes(appointment.time);
          if (appointmentStartMinutes === undefined) return false;
          return appointmentStartMinutes < start + 90 &&
            start < appointmentStartMinutes + appointment.totalDurationMinutes;
        });
        if (!overlapsAppointment) return true;
      }
      return false;
    });
}

function appointmentIsArchived(appointment: Appointment, now = Date.now()): boolean {
  return appointment.status === 'cancelled' ||
    appointment.status === 'completed' ||
    appointmentStart(appointment) < now;
}

function ManagerAppointmentEditor({
  appointment,
  onCancel,
  onSaved,
}: {
  appointment: Appointment;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useLocale();
  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });
  const services = servicesQuery.data ?? [];
  const stylists = stylistsQuery.data ?? [];

  const [form, setForm] = useState({
    customerName: appointment.customerName,
    email: appointment.email,
    phone: appointment.phone,
    stylistId: appointment.stylistId,
    serviceIds: appointment.serviceIds,
    date: localIsoDate(appointment.date),
    time: appointment.time,
    notes: appointment.notes || '',
    status: appointment.status,
  });

  const [feedback, setFeedback] = useState<string>();
  const updateAppointment = useUpdateManagerAppointment();

  const updateField = <Key extends keyof typeof form>(field: Key, value: (typeof form)[Key]) => {
    setFeedback(undefined);
    setForm(f => ({ ...f, [field]: value }));
  };

  const toggleService = (id: number) => {
    setForm(f => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter(s => s !== id)
        : [...f.serviceIds, id]
    }));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.phone || !form.date || !form.time || !form.stylistId || form.serviceIds.length === 0) {
      setFeedback(t('errorRequired'));
      return;
    }

    updateAppointment.mutate(
      {
        appointmentId: appointment.id,
        data: {
          customerName: form.customerName,
          email: form.email,
          phone: form.phone,
          stylistId: form.stylistId,
          serviceIds: form.serviceIds,
          date: form.date,
          time: form.time,
          notes: form.notes || null,
          status: form.status as ManagerAppointmentUpdate['status'],
        }
      },
      {
        onSuccess: () => onSaved(t('bookingUpdated')),
        onError: () => setFeedback(t('bookingUpdateError')),
      }
    );
  };

  return (
    <form onSubmit={save} className="mt-4 rounded-xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card))] p-4 shadow-[0_10px_24px_hsl(var(--secondary)/.05)] sm:p-5" data-testid={`appointment-editor-${appointment.id}`}>
      <div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-4 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{t('editBooking')}</p>
          <h2 className="mt-1 font-display text-2xl">{appointment.customerName}</h2>
        </div>
        <button type="button" onClick={onCancel} className="self-start text-xs font-bold tracking-[.08em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-cancel-appointment-edit">{t('cancel')}</button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
         <label className="text-xs font-semibold">{t('fullName')}
           <input required value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-edit-name" />
        </label>
         <label className="text-xs font-semibold">{t('phoneNumber')}
           <input required type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-edit-phone" />
        </label>
         <label className="text-xs font-semibold sm:col-span-2">{t('emailAddress')}
           <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-edit-email" />
        </label>
         <label className="text-xs font-semibold">{t('employee')}
           <select required value={form.stylistId} onChange={(event) => updateField('stylistId', Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="select-edit-stylist">
             <option value="">{t('choosePerson')}</option>
             {stylists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
           </select>
        </label>
         <label className="text-xs font-semibold">{t('status')}
           <select required value={form.status} onChange={(event) => updateField('status', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="select-edit-status">
             <option value="pending">{t('pending')}</option>
             <option value="confirmed">{t('confirmed')}</option>
             <option value="completed">{t('completed')}</option>
             <option value="cancelled">{t('cancelled')}</option>
           </select>
        </label>
         <label className="text-xs font-semibold">{t('dateTime')}
            <div className="mt-1.5 flex gap-2">
              <input required type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-edit-date" />
               <input required type="time" value={timeInputValue(form.time)} onChange={(event) => updateField('time', appointmentTimeValue(event.target.value))} className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-edit-time" />
            </div>
         </label>
         <label className="text-xs font-semibold sm:col-span-2">{t('service')}
           <div className="mt-1.5 grid gap-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-3">
             {services.map(s => (
               <label key={s.id} className="flex items-center gap-2 text-sm font-normal">
                 <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid={`checkbox-edit-service-${s.id}`} />
                 {s.name}
               </label>
             ))}
           </div>
         </label>
         <label className="text-xs font-semibold sm:col-span-2">{t('notes')}
           <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} className="mt-1.5 min-h-[76px] w-full resize-y rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-3 text-sm font-normal" data-testid="input-edit-notes" />
        </label>
      </div>
      <div className="mt-4 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[hsl(var(--border))] pt-4 sm:flex-row sm:items-center">
         {feedback && <p className="text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-edit-error">{feedback}</p>}
        <button type="submit" disabled={updateAppointment.isPending} className="ml-auto inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" data-testid="button-save-appointment">
           {updateAppointment.isPending ? t('saving') : t('saveBooking')} <Check size={14} />
        </button>
      </div>
    </form>
  );
}

function ManagerAppointments() {
  const { t, formatDate, formatPrice, statusLabel, translateServiceName } = useLocale();
  const appointmentsQuery = useListManagerAppointments({ query: { queryKey: getListManagerAppointmentsQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const appointments = appointmentsQuery.data ?? [];

  const updateAppointment = useUpdateManagerAppointment();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string }>();

  const currentAppointments = useMemo(
    () => appointments
      .filter((appointment) => !appointmentIsArchived(appointment))
      .sort((left, right) => appointmentStart(left) - appointmentStart(right)),
    [appointments],
  );

  const managerStatusLabel = (status: string) => status.toLowerCase() === 'pending' ? t('scheduled') : statusLabel(status);
  const statusClass = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'confirmed') return 'manager-status-confirmed';
    if (normalized === 'cancelled') return 'manager-status-cancelled';
    if (normalized === 'completed') return 'manager-status-confirmed';
    return 'manager-status-scheduled';
  };

  const markDone = (appointment: Appointment) => {
    updateAppointment.mutate({ appointmentId: appointment.id, data: { status: 'completed' } }, {
      onSuccess: () => {
        setFeedback({ tone: 'success', message: t('bookingCompleted') });
        queryClient.invalidateQueries({ queryKey: getListManagerAppointmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListManagerCustomersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
      }
      ,
      onError: () => setFeedback({ tone: 'error', message: t('bookingUpdateError') }),
    });
  };

  const cancelBooking = (appointment: Appointment) => {
    updateAppointment.mutate({ appointmentId: appointment.id, data: { status: 'cancelled' } }, {
      onSuccess: () => {
        setConfirmingCancel(null);
        setFeedback({ tone: 'success', message: t('appointmentCancelled') });
        queryClient.invalidateQueries({ queryKey: getListManagerAppointmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListManagerCustomersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
      }
      ,
      onError: () => setFeedback({ tone: 'error', message: t('appointmentCancelError') }),
    });
  };

  const getWhatsAppLink = (phone: string, appointment: Appointment) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '971' + cleaned.slice(1);
    }
    if (cleaned.length < 8 || cleaned.length > 15) return null;
    const msgTemplate = t('whatsappMessage');
    const text = msgTemplate
      .replace('{name}', appointment.customerName)
      .replace('{date}', formatDate(appointment.date, { month: 'short', day: 'numeric' }))
      .replace('{time}', appointment.time);
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
  };

  return (
    <>
      <section id="appointment-management" className="manager-section mt-0 space-y-4 rounded-2xl border p-4 sm:p-5" data-testid="appointment-management">
        <div className="border-b border-[hsl(var(--border))] pb-4">
           <div className="manager-section-header ps-3">
             <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{t('appointmentList')}</p>
          <h2 className="mt-1 font-display text-3xl">{t('appointments')}</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('appointmentIntro')}</p>
           </div>
        </div>
        {feedback && <p className={`text-sm ${feedback.tone === 'error' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--secondary))]'}`} role="status">{feedback.message}</p>}
        <div className="space-y-3">
          {appointmentsQuery.isLoading ? <LoadingCards count={2} /> : appointmentsQuery.isError ? <ErrorMessage retry={() => appointmentsQuery.refetch()} /> : currentAppointments.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noAppointments')}</div> : currentAppointments.map((appointment) => {
            const waLink = getWhatsAppLink(appointment.phone, appointment);

            return (
              <div key={appointment.id}>
                <article className={`manager-list-row rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 ${editingId === appointment.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary)/.25)]' : ''}`} data-testid={`appointment-manager-card-${appointment.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{appointment.customerName}</h3>
                      <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{appointment.email} · {appointment.phone}</p>
                    </div>
                    <span className={`manager-status-badge ${statusClass(appointment.status)}`}>{managerStatusLabel(appointment.status)}</span>
                  </div>
                  <p className="mt-4 font-display text-xl">{appointment.serviceNames.map(translateServiceName).join(' · ')}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                    <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-[hsl(var(--primary))]" />{formatDate(appointment.date, { month: 'short', day: 'numeric' })}</span>
                    <span className="flex items-center gap-1.5"><Clock3 size={14} className="text-[hsl(var(--primary))]" />{appointment.time}</span>
                    <span>{appointment.stylistName}</span>
                    <span>{formatPrice(appointment.totalPrice)}</span>
                  </div>

                  {confirmingCancel === appointment.id ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--destructive)/.28)] bg-[hsl(var(--destructive)/.05)] p-3 text-sm">
                      <span className="text-[hsl(var(--destructive))]">{t('confirmCancellation')} <span className="opacity-70">{t('cancelBookingWarning')}</span></span>
                      <div className="ml-auto flex gap-2">
                        <button type="button" onClick={() => setConfirmingCancel(null)} className="rounded-full border border-[hsl(var(--border))] px-3 py-2 text-[10px] font-bold bg-[hsl(var(--card))]">{t('cancel')}</button>
                        <button type="button" disabled={updateAppointment.isPending} onClick={() => cancelBooking(appointment)} className="rounded-full bg-[hsl(var(--destructive))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--destructive-foreground))] disabled:opacity-60">{updateAppointment.isPending ? t('saving') : t('confirmCancellation')}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-3">
                      <button type="button" onClick={() => { setEditingId(appointment.id); setConfirmingCancel(null); }} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-2 text-[10px] font-bold hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"><Pencil size={12} /> {t('editBooking')}</button>
                      {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[hsl(142_71%_45%/.25)] bg-[hsl(142_71%_45%/.06)] text-[hsl(142_71%_45%)] px-3 py-2 text-[10px] font-bold hover:bg-[hsl(142_71%_45%/.12)]" aria-label={t('whatsapp')}><Phone size={12} /> {t('whatsapp')}</a>}
                      <div className="ml-auto flex gap-2">
                        <button type="button" onClick={() => setConfirmingCancel(appointment.id)} className="inline-flex items-center justify-center rounded-full border border-[hsl(var(--border))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]">{t('cancelBooking')}</button>
                        <button type="button" disabled={updateAppointment.isPending} onClick={() => markDone(appointment)} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/.9)] disabled:opacity-60"><Check size={12} /> {t('markDone')}</button>
                      </div>
                    </div>
                  )}
                </article>
                {editingId === appointment.id && (
                  <ManagerAppointmentEditor
                    appointment={appointment}
                    onCancel={() => setEditingId(null)}
                    onSaved={(msg) => {
                      setEditingId(null);
                      setFeedback({ tone: 'success', message: msg });
                      queryClient.invalidateQueries({ queryKey: getListManagerAppointmentsQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getListManagerCustomersQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

    </>
  );
}

function ManagerArchive({ archivedAppointments }: { archivedAppointments: Appointment[] }) {
  const { t, formatDate, formatPrice, statusLabel } = useLocale();
  const [expanded, setExpanded] = useState(false);

  return (
    <section id="archive-management" className="manager-section mt-6 rounded-2xl border p-4 sm:p-5">
      <div className={`flex flex-col justify-between gap-3 sm:flex-row sm:items-center ${expanded ? 'border-b border-[hsl(var(--border))] pb-4' : ''}`}>
        <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} className="min-w-0 text-left">
          <span className="manager-section-header block ps-3">
            <span className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{t('archive')}</span>
            <span className="mt-1 flex items-center gap-2"><h2 className="font-display text-2xl">{t('archivedAppointments')}</h2><ChevronDown size={17} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /></span>
            <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{archivedAppointments.length} {t('appointments')}</span>
          </span>
        </button>
        <div className="flex flex-wrap gap-2">
          {archivedAppointments.length > 0 && (
            <button type="button" onClick={() => downloadAppointmentsCsv(archivedAppointments, 'appointments-archive.csv')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.05)] text-[hsl(var(--primary))] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] hover:bg-[hsl(var(--primary)/.1)]"><ArrowRight size={14} className="rotate-90" /> {t('exportCsv')}</button>
          )}
          <button type="button" onClick={() => setExpanded((current) => !current)} className="inline-flex min-h-10 items-center justify-center rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] hover:border-[hsl(var(--primary))]">{expanded ? t('closeSection') : t('viewAll')}</button>
        </div>
      </div>

      <div hidden={!expanded} className="mt-4">
        {archivedAppointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noAppointments')}</div>
        ) : (
          <div className="group relative">
            <div className="mb-2 text-right text-[10px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))] sm:hidden">{t('swipeToScroll')}</div>
            <div className="relative w-full overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
              <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[hsl(var(--muted)/.5)] text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t('dateTime')}</th>
                  <th className="px-4 py-3 font-semibold">{t('name')}</th>
                  <th className="px-4 py-3 font-semibold">{t('service')}</th>
                  <th className="px-4 py-3 font-semibold">{t('employee')}</th>
                  <th className="px-4 py-3 font-semibold">{t('price')}</th>
                  <th className="px-4 py-3 font-semibold">{t('emailAddress')}</th>
                  <th className="px-4 py-3 font-semibold">{t('duration')}</th>
                  <th className="px-4 py-3 font-semibold">{t('notes')}</th>
                  <th className="px-4 py-3 font-semibold">{t('created')}</th>
                  <th className="px-4 py-3 font-semibold">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border)/.6)]">
                {archivedAppointments.map(appointment => (
                  <tr key={appointment.id} className="hover:bg-[hsl(var(--muted)/.25)]">
                    <td className="px-4 py-3"><div className="font-semibold">{formatDate(appointment.date, { month: 'short', day: 'numeric' })}</div><div className="text-[hsl(var(--muted-foreground))]">{appointment.time}</div></td>
                    <td className="px-4 py-3"><div className="font-semibold">{appointment.customerName}</div><div className="text-[hsl(var(--muted-foreground))]">{appointment.phone}</div></td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{appointment.serviceNames.join(', ')}</td>
                    <td className="px-4 py-3">{appointment.stylistName}</td>
                    <td className="px-4 py-3">{formatPrice(appointment.totalPrice)}</td>
                    <td className="px-4 py-3">{appointment.email}</td>
                    <td className="px-4 py-3">{appointment.totalDurationMinutes} {t('minutes')}</td>
                    <td className="max-w-[260px] whitespace-normal px-4 py-3">{appointment.notes || '—'}</td>
                    <td className="px-4 py-3">{formatDate(appointment.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="px-4 py-3"><span className={`manager-status-badge ${appointment.status === 'completed' || appointment.status === 'confirmed' ? 'manager-status-confirmed' : appointment.status === 'cancelled' ? 'manager-status-cancelled' : 'manager-status-scheduled'}`}>{statusLabel(appointment.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ManagerOverview({ onOpenTeam }: { onOpenTeam?: () => void }) {
  const { t, formatDate, statusLabel, translateServiceName } = useLocale();
  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });
  const customersQuery = useListManagerCustomers({ query: { queryKey: getListManagerCustomersQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const appointmentsQuery = useListManagerAppointments({ query: { queryKey: getListManagerAppointmentsQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const services = servicesQuery.data ?? [];
  const stylists = stylistsQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const appointments = appointmentsQuery.data ?? [];
  const nowTick = useUaeClockTick();
  const today = uaeIsoDate(new Date(nowTick));

  const currentAppointments = appointments.filter((appointment) => !appointmentIsArchived(appointment));
  const upcomingAppointments = [...currentAppointments].sort((left, right) => appointmentStart(left) - appointmentStart(right));

  const todayAppointments = appointments.filter((appointment) => localIsoDate(appointment.date) === today);
  const completedAppointmentsToday = todayAppointments.filter((appointment) => appointment.status.trim().toLowerCase() === 'completed').length;
  const totalAppointmentsForDate = todayAppointments.filter(a => a.status !== 'cancelled').length;
  const cancelledAppointmentsForDate = todayAppointments.filter(a => a.status === 'cancelled').length;
  const nextVisit = upcomingAppointments[0];
  const nextVisitAppointments = nextVisit
    ? upcomingAppointments.filter((appointment) =>
      appointment.date === nextVisit.date && appointment.time === nextVisit.time)
    : [];
  const availableStylistsNextTwoHours = stylists
    .filter((stylist) => stylist.active !== false && stylistHasAvailabilityWithinTwoHours(stylist, appointments, new Date(nowTick)))
    .slice(0, 4);
  const todayLabel = formatDate(new Date(`${today}T12:00:00.000Z`), { weekday: 'short', month: 'short', day: 'numeric' });

  const hasError = servicesQuery.isError || stylistsQuery.isError || customersQuery.isError || appointmentsQuery.isError;
  const isLoading = servicesQuery.isLoading || stylistsQuery.isLoading || customersQuery.isLoading || appointmentsQuery.isLoading;
  const managerStatusLabel = (status: string) => status.toLowerCase() === 'pending' ? t('scheduled') : statusLabel(status);
  const statusClass = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'confirmed') return 'manager-status-confirmed';
    if (normalized === 'cancelled') return 'manager-status-cancelled';
    return 'manager-status-scheduled';
  };
  const retryAll = () => {
    void servicesQuery.refetch();
    void stylistsQuery.refetch();
    void customersQuery.refetch();
    void appointmentsQuery.refetch();
  };

  return (
    <section className="mb-8 min-w-0" aria-labelledby="manager-overview-title" data-testid="manager-overview">
      <div className="manager-hero relative overflow-hidden rounded-[1.35rem] bg-[hsl(var(--secondary))] p-5 text-[hsl(var(--card))] shadow-[0_20px_50px_hsl(var(--secondary)/.13)] sm:p-7 md:p-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border border-[hsl(var(--accent)/.25)] md:h-96 md:w-96" />
        <div className="pointer-events-none absolute -right-2 -top-10 h-56 w-56 rounded-full border border-[hsl(var(--accent)/.13)] md:h-72 md:w-72" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl reveal">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">
              <span className="h-px w-7 bg-[hsl(var(--accent))]" />
              <span>{t('managerWorkspace')}</span>
              <span className="text-[hsl(var(--card)/.38)]">/</span>
              <span className="text-[hsl(var(--card)/.55)]">{formatDate(new Date(), { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
            <h1 id="manager-overview-title" className="mt-5 max-w-xl font-display text-[clamp(3.8rem,9vw,6.7rem)] leading-[.8] tracking-[-.035em]">{t('workspaceTitle')}</h1>
            <p className="mt-7 max-w-lg text-sm leading-6 text-[hsl(var(--card)/.68)] sm:text-base">{t('workspaceIntro')}</p>
          </div>
          <div className="relative grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[hsl(var(--card)/.16)] pt-5 text-right lg:min-w-[210px] lg:border-l lg:border-t-0 lg:ps-7 lg:pt-0">
            <div><p className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--card)/.48)]">{t('openingHours')}</p><p className="mt-1 text-sm font-semibold">{t('dailyHours')}</p></div>
            <div><p className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--card)/.48)]">{t('active')}</p><p className="mt-1 text-sm font-semibold">{stylists.filter((stylist) => stylist.active !== false).length} {t('activeTeam')}</p></div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-[106px] rounded-xl" />)
        ) : (
          <>
            <div className="manager-stat rounded-xl border border-[hsl(var(--border))] p-4" data-testid="manager-stat-workload"><div className="flex items-center justify-between"><Scissors size={16} className="text-[hsl(var(--primary))]" /><span className="font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]">01</span></div><p className="mt-5 font-display text-3xl leading-none">{completedAppointmentsToday}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{t('completedAppointmentsToday')}</p><p className="mt-2 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{todayLabel}</p></div>
            <div className="manager-stat rounded-xl border border-[hsl(var(--border))] p-4" data-testid="manager-stat-total-today"><div className="flex items-center justify-between"><CalendarDays size={16} className="text-[hsl(var(--primary))]" /><span className="font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]">02</span></div><div className="mt-5 flex items-end justify-between gap-2"><p className="font-display text-3xl leading-none">{totalAppointmentsForDate}</p><span className="rounded-full bg-[hsl(var(--destructive)/.09)] px-2 py-1 text-[9px] font-semibold text-[hsl(var(--destructive))]" data-testid="manager-stat-cancelled-today">{t('cancelledCount').replace('{count}', String(cancelledAppointmentsForDate))}</span></div><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{t('totalAppointmentsForDate')}</p><p className="mt-2 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{todayLabel}</p></div>
            <div className="manager-stat manager-stat-accent rounded-xl border border-[hsl(var(--secondary))] p-4" data-testid="manager-stat-availability"><div className="flex items-center justify-between"><CalendarDays size={16} className="text-[hsl(var(--accent))]" /><span className="font-mono-ui text-[9px] text-[hsl(var(--card)/.5)]">03</span></div><p className="mt-5 text-[10px] font-semibold uppercase tracking-[.1em] text-[hsl(var(--card)/.58)]">{t('availableNextTwoHours')}</p><div className="mt-3 border-t border-[hsl(var(--card)/.16)] pt-3" data-testid="manager-available-stylists">{availableStylistsNextTwoHours.length > 0 ? <div className="space-y-1">{availableStylistsNextTwoHours.map((stylist) => <Link key={stylist.id} href={`/book?stylistId=${stylist.id}`} className="flex items-center justify-between gap-2 rounded-md py-1 text-[11px] font-semibold text-[hsl(var(--card)/.82)] transition-colors hover:bg-[hsl(var(--card)/.08)] hover:text-[hsl(var(--accent))]" aria-label={`${t('bookAppointment')}: ${stylist.name}`} data-testid={`link-book-employee-${stylist.id}`}><span className="truncate">{stylist.name}</span><CalendarPlus size={13} className="shrink-0 text-[hsl(var(--accent))]" /></Link>)}</div> : <p className="text-[10px] leading-4 text-[hsl(var(--card)/.55)]">{t('noEmployeesAvailableSoon')}</p>}</div></div>
            <div className="manager-stat rounded-xl border border-[hsl(var(--border))] p-4" data-testid="manager-stat-next"><div className="flex items-center justify-between"><Clock3 size={16} className="text-[hsl(var(--primary))]" /><span className="font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]">04</span></div><p className="mt-5 font-display text-3xl leading-none">{nextVisit ? nextVisit.time : '--:--'}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{t('nextVisit')}</p>{nextVisitAppointments.length > 0 && <div className={`mt-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] ${nextVisitAppointments.length > 1 ? 'space-y-0.5' : ''}`} data-testid="manager-next-visit-employees">{nextVisitAppointments.map((appointment) => <div key={appointment.id} className="truncate">{appointment.stylistName}</div>)}</div>}</div>
          </>
        )}
      </div>

      <div className="mt-3 grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)]">
        <div className="min-w-0 space-y-3">
        <div className="manager-section min-w-0 rounded-xl border p-4 sm:p-5" data-testid="manager-next-visits">
          <div className="flex items-end justify-between gap-4 border-b border-[hsl(var(--border))] pb-4">
            <div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">{t('atAGlance')}</p><h2 className="mt-1 font-display text-2xl">{t('nextVisits')}</h2></div>
            <span className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{today}</span>
          </div>
          {hasError ? <div className="pt-4"><ErrorMessage retry={retryAll} /></div> : upcomingAppointments.length === 0 ? <p className="py-7 text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-upcoming-appointments">{t('noUpcomingAppointments')}</p> : (
            <div className="mt-3 divide-y divide-[hsl(var(--border)/.72)]">
              {upcomingAppointments.slice(0, 4).map((appointment) => (
                <div key={appointment.id} className="manager-list-row grid gap-2 py-3 sm:grid-cols-[92px_1fr_auto] sm:items-center" data-testid={`manager-next-appointment-${appointment.id}`}>
                  <div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.08em] text-[hsl(var(--primary))]"><CalendarDays size={13} /><span>{formatDate(appointment.date, { month: 'short', day: 'numeric' })}</span><span className="text-[hsl(var(--muted-foreground))]">{appointment.time}</span></div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{appointment.customerName}</p><p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{appointment.serviceNames.map(translateServiceName).join(' · ')} <span className="text-[hsl(var(--border))]">/</span> {appointment.stylistName}</p></div>
                  <span className={`manager-status-badge ${statusClass(appointment.status)}`}>{managerStatusLabel(appointment.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <ManagerAppointments />
        </div>
        <div className="manager-section min-w-0 rounded-xl border p-4 sm:p-5" data-testid="manager-quick-access">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">{t('quickAccess')}</p>
          <div className="mt-3 divide-y divide-[hsl(var(--border)/.72)]">
            <a href="#service-management" className="group flex min-h-[52px] items-center justify-between gap-3 py-3 text-sm font-semibold" data-testid="link-manager-services"><span className="flex items-center gap-3"><Scissors size={15} className="text-[hsl(var(--primary))]" />{t('serviceMenu')}</span><ArrowRight size={15} className="text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" /></a>
            <a href="#employee-management" onClick={onOpenTeam} className="group flex min-h-[52px] items-center justify-between gap-3 py-3 text-sm font-semibold" data-testid="link-manager-team"><span className="flex items-center gap-3"><UserRound size={15} className="text-[hsl(var(--primary))]" />{t('employeeRoster')}</span><ArrowRight size={15} className="text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" /></a>
             <a href="#appointment-management" className="group flex min-h-[52px] items-center justify-between gap-3 py-3 text-sm font-semibold" data-testid="link-manager-appointments"><span className="flex items-center gap-3"><CalendarDays size={15} className="text-[hsl(var(--primary))]" />{t('appointmentList')}</span><ArrowRight size={15} className="text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" /></a>
             <a href="#archive-management" className="group flex min-h-[52px] items-center justify-between gap-3 py-3 text-sm font-semibold" data-testid="link-manager-archive"><span className="flex items-center gap-3"><Archive size={15} className="text-[hsl(var(--primary))]" />{t('archivedAppointments')}</span><ArrowRight size={15} className="text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" /></a>
          </div>
        </div>
      </div>
    </section>
  );
}

function ManagerSchedule() {
  const { t } = useLocale();
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });
  const appointmentsQuery = useListManagerAppointments({ query: { queryKey: getListManagerAppointmentsQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const stylists = stylistsQuery.data ?? [];
  const archivedAppointments = useMemo(
    () => (appointmentsQuery.data ?? [])
      .filter((appointment) => appointmentIsArchived(appointment))
      .sort((left, right) => appointmentStart(right) - appointmentStart(left)),
    [appointmentsQuery.data],
  );
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const deleteStylist = useDeleteStylist();
  const { signOut } = useClerk();

  const finishSave = (message: string) => {
    setEditing(null);
    setFeedback(message);
    queryClient.invalidateQueries({ queryKey: getListStylistsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
  };

  const removeEmployee = (stylist: Stylist) => {
    if (!window.confirm(`${t('removeEmployeeConfirm')} ${stylist.name}?`)) {
      return;
    }
    setFeedback(undefined);
    deleteStylist.mutate(
      { stylistId: stylist.id },
      {
        onSuccess: () => {
          setFeedback(`${stylist.name} ${t('employeeRemoved')}`);
          queryClient.invalidateQueries({ queryKey: getListStylistsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAvailabilityQueryKey() });
        },
        onError: (error) => {
          setFeedback(scheduleErrorMessage(error, t('employeeRemoveError'), { openingBeforeClosing: t('openingBeforeClosing'), scheduleOverlap: t('scheduleOverlap') }));
        },
      },
    );
  };

  return (
    <main className="manager-shell min-h-[calc(100dvh-76px)] min-w-0 overflow-x-clip">
      <div className="mx-auto min-w-0 max-w-[1240px] px-4 py-7 sm:px-6 sm:py-10 md:px-8 md:py-12">
       <div className="mb-4 flex justify-end">
         <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.6)] px-4 py-2.5 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid="button-manager-sign-out">
           {t('signOut')}
         </button>
       </div>
       <ManagerOverview onOpenTeam={() => setRosterExpanded(true)} />
      <div className="manager-grid grid min-w-0 gap-4 lg:grid-cols-2" data-testid="manager-masonry">
      <ServiceManagement />
        <section id="employee-management" className="manager-section mt-0 rounded-2xl border p-4 sm:p-5" data-testid="employee-management">
          <div className={`flex flex-col justify-between gap-3 sm:flex-row sm:items-center ${rosterExpanded ? 'border-b border-[hsl(var(--border))] pb-4' : ''}`}>
           <button type="button" onClick={() => setRosterExpanded((current) => !current)} aria-expanded={rosterExpanded} aria-controls="employee-roster-details" className="min-w-0 text-left">
              <span className="manager-section-header block ps-3"><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{t('employeeRoster')}</p>
             <span className="mt-1 flex items-center gap-2"><h2 className="font-display text-3xl">{t('theTeam')}</h2><ChevronDown size={17} className={`transition-transform ${rosterExpanded ? 'rotate-180' : ''}`} /></span>
             <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('employeeIntro')}</p>
              </span>
           </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRosterExpanded((current) => !current)} className="inline-flex min-h-10 items-center justify-center rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] hover:border-[hsl(var(--primary))]" data-testid="button-toggle-employees">{rosterExpanded ? t('closeSection') : t('openAndEdit')}</button>
            <button type="button" onClick={() => { setRosterExpanded(true); setEditing('new'); setFeedback(undefined); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-5 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--card))] hover:bg-[hsl(var(--secondary)/.88)]" data-testid="button-add-employee"><Plus size={15} /> {t('addEmployee')}</button>
          </div>
        </div>
         <div id="employee-roster-details" hidden={!rosterExpanded}>
        {feedback && <p className="mt-5 text-sm text-[hsl(var(--secondary))]" role="status" data-testid="status-employee-success">{feedback}</p>}
        {editing === 'new' && <EmployeeProfileEditor onCancel={() => setEditing(null)} onSaved={finishSave} />}
          <div className="mt-4 space-y-3">
          {stylistsQuery.isLoading ? <LoadingCards count={3} /> : stylistsQuery.isError ? <ErrorMessage retry={() => stylistsQuery.refetch()} /> : stylists.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noEmployees')}</div> : null}
          {stylists.map((stylist) => (
              <EmployeeCard
                key={`profile-${stylist.id}`}
                stylist={stylist}
                isEditing={editing === stylist.id}
                isRemoving={deleteStylist.isPending}
                 onEdit={() => { setRosterExpanded(true); setEditing(stylist.id); setFeedback(undefined); }}
                onRemove={() => removeEmployee(stylist)}
                onCancel={() => setEditing(null)}
                onSaved={finishSave}
              />
          ))}
        </div>
         </div>
      </section>
       <ManagerCustomers />
      </div>
      <ManagerArchive archivedAppointments={archivedAppointments} />
      </div>
    </main>
  );
}

function DateStrip({ date, currentDate, onChange }: { date: string; currentDate: string; onChange: (date: string) => void }) {
  const { weekday, formatDate } = useLocale();
  const days = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const iso = addIsoDays(currentDate, index);
    return { iso, date: new Date(`${iso}T12:00:00.000Z`) };
  }), [currentDate]);
  return <div className="flex gap-2 overflow-x-auto pb-2" data-testid="date-strip">{days.map(({ iso, date: day }) => { const selected = iso === date; return <button key={iso} onClick={() => onChange(iso)} className={`min-w-[68px] rounded-xl border px-2 py-3 text-center transition-all ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_8px_18px_hsl(var(--primary)/.18)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.55)]'}`} data-testid={`button-date-${iso}`}><span className="block font-mono-ui text-[9px] uppercase tracking-[.08em] opacity-70">{weekday(day)}</span><span className="mt-1 block text-xl font-semibold">{Number(iso.slice(8, 10))}</span><span className="block text-[9px] uppercase opacity-60">{formatDate(day, { month: 'short' })}</span></button>; })}</div>;
}

type BookingPerson = {
  id: string;
  serviceIds: number[];
  stylistId?: number;
  date: string;
  time: string;
  notes: string;
};

function Book() {
  const { t, formatPrice, formatDate, serviceCopy, stylistCopy, translateServiceName, statusLabel } = useLocale();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const linkedStylistId = bookingLinkStylistId();
  const [step, setStep] = useState(1);
  const [persons, setPersons] = useState<BookingPerson[]>(() => [
    { id: crypto.randomUUID(), serviceIds: [], stylistId: linkedStylistId, date: uaeIsoDate(), time: '', notes: '' }
  ]);
  const [activePersonId, setActivePersonId] = useState(persons[0].id);
  const [form, setForm] = useState({ customerName: '', email: '', phone: '' });
  const [confirmedGroup, setConfirmedGroup] = useState<GroupBooking>();

  const nowTick = useUaeClockTick();
  const currentUaeDate = uaeIsoDate(new Date(nowTick));

  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });

  const services = servicesQuery.data ?? [];
  const stylists = stylistsQuery.data ?? [];

  const activePerson = persons.find((p) => p.id === activePersonId)!;

  const availabilityParams = useMemo(() => ({
    date: activePerson.date,
    stylistId: activePerson.stylistId ?? 0,
    serviceIds: activePerson.serviceIds,
  }), [activePerson.date, activePerson.stylistId, activePerson.serviceIds]);

  const availabilityQuery = useGetAvailability(availabilityParams, {
    query: {
      enabled: Boolean(activePerson.date && activePerson.stylistId && activePerson.serviceIds.length > 0),
      queryKey: getGetAvailabilityQueryKey(availabilityParams),
      refetchOnWindowFocus: true,
    }
  });

  const createAppointmentGroup = useCreateAppointmentGroup();

  const slots = useMemo(() => {
    const apiSlots = availabilityQuery.data?.[0]?.slots ?? [];
    const taken = persons
      .filter((p) => p.id !== activePersonId && p.stylistId === activePerson.stylistId && p.date === activePerson.date && p.time)
      .map((p) => p.time);
    return apiSlots
      .filter((slot) => !taken.includes(slot))
      .filter((slot) => isFutureUaeSlot(activePerson.date, slot, new Date(nowTick)));
  }, [availabilityQuery.data, activePerson.date, nowTick, persons, activePersonId, activePerson.stylistId]);

  useEffect(() => {
    if (linkedStylistId && stylistsQuery.isSuccess && !stylists.some((stylist) => stylist.id === linkedStylistId)) {
      setPersons((current) => current.map((p) => ({ ...p, stylistId: undefined })));
    }
  }, [linkedStylistId, stylists, stylistsQuery.isSuccess]);

  useEffect(() => {
    const now = new Date(nowTick);
    setPersons((current) => {
      let changed = false;
      const next = current.map((p) => {
        const nextDate = rolloverDate(p.date, now);
        if (nextDate !== p.date) {
          changed = true;
          return { ...p, date: nextDate, time: '' };
        } else if (p.time && !isFutureUaeSlot(p.date, p.time, now)) {
          changed = true;
          return { ...p, time: '' };
        }
        return p;
      });
      return changed ? next : current;
    });
  }, [nowTick]);

  useEffect(() => {
    if (availabilityQuery.isSuccess && activePerson.time && !slots.includes(activePerson.time)) {
      updateActivePerson({ time: '' });
    }
  }, [availabilityQuery.isSuccess, slots, activePerson.time]);

  useEffect(() => {
    if (!user) return;
    const accountName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const accountEmail = user.primaryEmailAddress?.emailAddress ?? '';
    setForm((current) => ({
      ...current,
      customerName: current.customerName || accountName,
      email: current.email || accountEmail,
    }));
  }, [user?.id]);

  const updateActivePerson = (changes: Partial<typeof activePerson>) => {
    setPersons((current) => current.map((p) => p.id === activePersonId ? { ...p, ...changes } : p));
  };

  const canNext = () => {
    if (step === 1) return persons.every(p => p.serviceIds.length > 0);
    if (step === 2) return persons.every(p => p.stylistId);
    if (step === 3) return persons.every(p => p.time);
    return step === 4;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canNext()) return;
    createAppointmentGroup.mutate({
      data: {
        customerName: form.customerName,
        email: form.email,
        phone: form.phone,
        items: persons.map(p => ({
          serviceIds: p.serviceIds,
          stylistId: p.stylistId!,
          date: p.date,
          time: p.time,
          notes: p.notes || null,
        })),
      }
    }, {
      onSuccess: (group) => setConfirmedGroup(group)
    });
  };

  const eligibleStylists = stylists.filter(s => {
    return Boolean(s.serviceIds?.length) && activePerson.serviceIds.every(sid => s.serviceIds.includes(sid));
  });

  const PersonSelector = () => (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {persons.map((person, index) => (
          <button
            type="button"
            key={person.id}
            onClick={() => setActivePersonId(person.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-bold tracking-[.05em] transition-colors ${person.id === activePersonId ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]'}`}
            data-testid={`button-select-person-${index}`}
          >
            {t('personNumber').replace('{number}', String(index + 1))}
          </button>
        ))}
        {persons.length < 5 && (
          <button
            type="button"
            onClick={() => {
              const newPerson: BookingPerson = { id: crypto.randomUUID(), serviceIds: [], date: uaeIsoDate(), time: '', notes: '' };
              setPersons([...persons, newPerson]);
              setActivePersonId(newPerson.id);
            }}
            className="shrink-0 rounded-full border border-dashed border-[hsl(var(--border))] px-4 py-2 text-[11px] font-bold tracking-[.05em] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))]"
            data-testid="button-add-person"
          >
            + {t('addPerson')}
          </button>
        )}
      </div>
      {persons.length > 1 && (
        <button
          type="button"
          onClick={() => {
            const next = persons.filter(p => p.id !== activePersonId);
            setPersons(next);
            setActivePersonId(next[0].id);
          }}
          className="ml-4 shrink-0 flex items-center gap-1 text-[10px] uppercase font-bold text-[hsl(var(--destructive))] transition-opacity hover:opacity-70"
          data-testid="button-remove-person"
        >
          <X size={14} /> <span className="hidden sm:inline">{t('removePerson')}</span>
        </button>
      )}
    </div>
  );

  if (confirmedGroup) {
    const firstAppointment = confirmedGroup.appointments[0];
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[760px] items-center px-5 py-16 sm:px-8">
        <div className="w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 text-center shadow-[0_24px_70px_hsl(var(--secondary)/.08)] sm:p-14">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--secondary))]"><Check size={28} /></span>
          <p className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('inTheBooks')}</p>
          <h1 className="mt-4 font-display text-6xl leading-[.85] sm:text-8xl">{t('seeYouSoon')}</h1>
          <p className="mx-auto mt-7 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('confirmationInbox')} {firstAppointment.email}. {t('confirmationSent')}</p>
          <div className="mx-auto mt-10 max-w-md rounded-2xl bg-[hsl(var(--muted)/.75)] p-5 text-left">
            {confirmedGroup.appointments.map((appointment: any, idx: number) => (
              <div key={appointment.id} className={`${idx > 0 ? 'mt-6 border-t border-[hsl(var(--border))] pt-6' : ''}`}>
                <div className="flex justify-between gap-4 border-b border-[hsl(var(--border))] pb-4">
                  <div className="space-y-1">
                    {confirmedGroup.appointments.length > 1 && <p className="font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--primary))]">{t('personNumber').replace('{number}', String(idx + 1))}</p>}
                    {appointment.serviceNames.map((name: string) => <p key={name} className="font-display text-2xl">{translateServiceName(name)}</p>)}
                  </div>
                  <span className="font-mono-ui text-[10px] text-[hsl(var(--primary))] self-start mt-1">{statusLabel(appointment.status)}</span>
                </div>
                <div className="grid gap-4 pt-4 text-sm sm:grid-cols-2">
                  <span className="flex items-center gap-2"><CalendarDays size={15} className="text-[hsl(var(--primary))]" />{formatDate(appointment.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span className="flex items-center gap-2"><Clock3 size={15} className="text-[hsl(var(--primary))]" />{appointment.time}</span>
                  <span className="flex items-center gap-2"><UserRound size={15} className="text-[hsl(var(--primary))]" />{appointment.stylistName}</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/appointments" className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary))]" data-testid="link-view-appointments">{t('viewAppointments')} <ArrowRight size={15} /></Link>
        </div>
      </main>
    );
  }

  const step1IsLoading = servicesQuery.isLoading;
  const step1IsError = servicesQuery.isError;
  const step2IsLoading = stylistsQuery.isLoading;
  const step2IsError = stylistsQuery.isError;

  return (
    <main className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 md:py-20">
      <div className="mb-12 max-w-2xl reveal"><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('reserveYourChair')}</p><h1 className="mt-4 font-display text-6xl leading-[.84] sm:text-8xl">{t('goodHourStarts')}</h1><p className="mt-7 text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('bookingIntro')}</p></div>
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
           <div className="mb-10 flex items-center gap-0 overflow-hidden">{bookingSteps.map((_, index) => <div key={index} className="flex flex-1 items-center"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${step > index + 1 ? 'border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))] text-[hsl(var(--card))]' : step === index + 1 ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}>{step > index + 1 ? <Check size={14} /> : index + 1}</div><span className={`ml-2 hidden text-[10px] font-semibold uppercase tracking-[.1em] sm:block ${step === index + 1 ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>{[t('service'), t('employee'), t('dateTime'), t('details')][index]}</span>{index < bookingSteps.length - 1 && <span className="mx-2 h-px flex-1 bg-[hsl(var(--border))] sm:mx-4" />}</div>)}</div>

           {step === 1 && (
             <StepPanel eyebrow={`01 / ${t('chooseService')}`} title={t('whatDoing')}>
               <PersonSelector />
               <div className="mb-6 rounded-2xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.05)] p-4" data-testid="selected-services">
                 <p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{t('selectedServices')}</p>
                 {activePerson.serviceIds.length === 0 ? <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{t('ritualBegins')}</p> : <div className="mt-3 space-y-2">
                   {activePerson.serviceIds.map(sid => {
                     const service = services.find(s => s.id === sid);
                     if (!service) return null;
                     return (
                       <div key={sid} className="flex items-center justify-between gap-3 rounded-xl bg-[hsl(var(--card))] px-3 py-2.5 text-sm">
                         <span className="truncate">{service.name} <span className="text-[hsl(var(--muted-foreground))] whitespace-nowrap">· {service.durationMinutes} {t('minutes')} · {formatPrice(service.price)}</span></span>
                         <button type="button" onClick={() => {
                           const newServiceIds = activePerson.serviceIds.filter(id => id !== sid);
                           let newStylistId = activePerson.stylistId;
                           const currentStylist = stylists.find(s => s.id === newStylistId);
                           if (currentStylist && currentStylist.serviceIds && currentStylist.serviceIds.length > 0) {
                             if (!newServiceIds.every(id => currentStylist.serviceIds.includes(id))) newStylistId = undefined;
                           }
                           updateActivePerson({ serviceIds: newServiceIds, stylistId: newStylistId, time: '' });
                         }} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[hsl(var(--destructive))]" aria-label={`${t('removeService')}: ${service.name}`} data-testid={`button-remove-service-${service.id}`}><X size={14} /> <span className="hidden sm:inline">{t('removeService')}</span></button>
                       </div>
                     );
                   })}
                 </div>}
               </div>
               <div className="grid gap-3 sm:grid-cols-2">
                 {step1IsLoading ? <LoadingCards count={2} /> : step1IsError ? <ErrorMessage retry={() => servicesQuery.refetch()} /> : services.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('menuRefreshing')}</div> : services.map((rawService) => {
                   const service = serviceCopy(rawService);
                   const selected = activePerson.serviceIds.includes(service.id);
                   return (
                     <button key={service.id} type="button" aria-pressed={selected} onClick={() => {
                       const newServiceIds = selected ? activePerson.serviceIds.filter(id => id !== service.id) : [...activePerson.serviceIds, service.id];
                       let newStylistId = activePerson.stylistId;
                       const currentStylist = stylists.find(s => s.id === newStylistId);
                       if (currentStylist && currentStylist.serviceIds && currentStylist.serviceIds.length > 0) {
                         if (!newServiceIds.every(id => currentStylist.serviceIds.includes(id))) newStylistId = undefined;
                       }
                       updateActivePerson({ serviceIds: newServiceIds, stylistId: newStylistId, time: '' });
                     }} className={`group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)] ring-2 ring-[hsl(var(--primary)/.15)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.45)]'}`} data-testid={`button-service-${service.id}`}>
                       <div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Scissors size={16} /></span>{service.featured && <span className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--primary))]">{t('mostLoved')}</span>}</div>
                       <h3 className="mt-8 font-display text-3xl">{service.name}</h3>
                       <p className="mt-2 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{service.description}</p>
                       <div className="mt-5 flex gap-4 font-mono-ui text-[10px] uppercase tracking-[.09em] text-[hsl(var(--muted-foreground))]"><span>{service.durationMinutes} {t('minutes')}</span><span>{formatPrice(service.price)}</span></div>
                     </button>
                   );
                 })}
               </div>
             </StepPanel>
           )}

           {step === 2 && (
             <StepPanel eyebrow={`02 / ${t('choosePerson')}`} title={t('whoSee')}>
               <PersonSelector />
               {step2IsLoading ? <LoadingCards count={2} /> : step2IsError ? <ErrorMessage retry={() => stylistsQuery.refetch()} /> : stylists.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('teamOnWay')}</div> : <div className="grid gap-3 sm:grid-cols-2">
                {eligibleStylists.map((rawStylist) => {
                   const stylist = stylistCopy(rawStylist);
                   return (
                    <button type="button" key={stylist.id} onClick={() => {
                      updateActivePerson({ stylistId: stylist.id, time: '' });
                     }} className={`rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${activePerson.stylistId === stylist.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)] ring-2 ring-[hsl(var(--primary)/.15)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.45)]'}`} data-testid={`button-stylist-${stylist.id}`}>
                       <div className="flex items-center gap-4"><StylistAvatar stylist={stylist} className="h-12 w-12 shrink-0" /><div><h3 className="font-display text-2xl">{stylist.name}</h3><p className="font-mono-ui text-[9px] uppercase tracking-[.11em] text-[hsl(var(--primary))]">{stylist.role}</p></div></div>
                       <p className="mt-5 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{stylist.bio}</p>
                     </button>
                   );
                 })}
                 {eligibleStylists.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noEmployeesAvailableSoon')}</div>}
               </div>}
               <BackButton onClick={() => setStep(1)} />
             </StepPanel>
           )}

           {step === 3 && (
             <StepPanel eyebrow={`03 / ${t('findTime')}`} title={`${t('whenFeelsRight')} ${stylists.find(s => s.id === activePerson.stylistId)?.name ?? t('employee')}?`}>
               <PersonSelector />
               <p className="mb-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('timeIntro')}</p>
               <DateStrip date={activePerson.date} currentDate={currentUaeDate} onChange={(value) => updateActivePerson({ date: value, time: '' })} />
               <div className="mt-8">
                 {availabilityQuery.isLoading ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4"><div className="skeleton h-12 rounded-xl" /><div className="skeleton h-12 rounded-xl" /><div className="skeleton h-12 rounded-xl" /></div> : availabilityQuery.isError ? <ErrorMessage retry={() => availabilityQuery.refetch()} /> : slots.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-time-slots">{t('noOpenTimes')} {stylists.find(s => s.id === activePerson.stylistId)?.name ?? t('employee')} {t('chooseAnotherDate')}</div> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => <button type="button" key={slot} onClick={() => updateActivePerson({ time: slot })} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${activePerson.time === slot ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-time-${slot.replaceAll(':', '-')}`}>{slot}</button>)}
                 </div>}
               </div>
              <label className="mt-6 block text-xs font-semibold">
                {t('anythingKnow')}
                <textarea
                  value={activePerson.notes}
                  onChange={(event) => updateActivePerson({ notes: event.target.value })}
                  placeholder={t('notesPlaceholder')}
                  className="mt-2 min-h-[84px] w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-4 text-sm font-normal placeholder:text-[hsl(var(--muted-foreground))]"
                  data-testid={`input-person-notes-${persons.findIndex((person) => person.id === activePersonId)}`}
                />
              </label>
               <BackButton onClick={() => setStep(2)} />
             </StepPanel>
           )}

           {step === 4 && (
             <StepPanel eyebrow={`04 / ${t('yourDetails')}`} title={t('sendNote')}>
               <form onSubmit={submit} className="space-y-4">
                 <Field icon={<UserRound size={16} />} label={t('fullName')} value={form.customerName} onChange={(value) => setForm(c => ({...c, customerName: value}))} required minLength={2} testId="input-customer-name" />
                 <Field icon={<Mail size={16} />} label={t('emailAddress')} type="email" value={form.email} onChange={(value) => setForm(c => ({...c, email: value}))} required testId="input-customer-email" />
                 <Field icon={<Phone size={16} />} label={t('phoneNumber')} type="tel" value={form.phone} onChange={(value) => setForm(c => ({...c, phone: value}))} required minLength={7} testId="input-customer-phone" />
                 <div className="flex items-center justify-between gap-4 pt-4">
                   <BackButton onClick={() => setStep(3)} />
                   <button disabled={createAppointmentGroup.isPending} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-4 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" type="submit" data-testid="button-confirm-appointment">
                     {createAppointmentGroup.isPending ? t('holdingChair') : t('confirmAppointment')} <ArrowRight size={15} />
                   </button>
                 </div>
                 {createAppointmentGroup.isError && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="status-booking-error">{apiErrorMessage(createAppointmentGroup.error, t('bookingTaken'))}</p>}
               </form>
             </StepPanel>
           )}

           {step < 4 && (
             <div className="mt-7 flex justify-end">
              <button type="button" onClick={() => setStep(step + 1)} disabled={!canNext()} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-4 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-40" data-testid={`button-next-step-${step}`}>
                 {t('continue')} <ArrowRight size={15} />
               </button>
             </div>
           )}
        </div>

        <aside className="h-fit rounded-2xl bg-[hsl(var(--secondary))] p-6 text-[hsl(var(--card))] lg:sticky lg:top-28">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{t('yourVisit')}</p>
          <div className="mt-8 border-b border-[hsl(var(--card)/.15)] pb-6 space-y-6">
            {persons.map((person, idx) => {
              const selectedServices = services.filter(s => person.serviceIds.includes(s.id));
              const selectedStylist = stylists.find(s => s.id === person.stylistId);
              const totalDurationMinutes = selectedServices.reduce((t, s) => t + s.durationMinutes, 0);
              const totalPrice = selectedServices.reduce((t, s) => t + Number(s.price), 0);
              return (
                <div key={person.id} className="relative">
                  {persons.length > 1 && <p className="mb-2 font-mono-ui text-[9px] uppercase tracking-[.1em] text-[hsl(var(--primary))]">{t('personNumber').replace('{number}', String(idx + 1))}</p>}
                  {selectedServices.length > 0 ? <div className="space-y-2">{selectedServices.map((service) => <p key={service.id} className="font-display text-2xl">{serviceCopy(service).name}</p>)}</div> : <p className="font-display text-2xl opacity-50">{t('selectService')}</p>}
                  <div className="mt-4 space-y-2 text-sm text-[hsl(var(--card)/.58)]">
                    {selectedServices.length > 0 && <><p>{t('totalDuration')}: {totalDurationMinutes} {t('minutes')}</p><p>{t('totalPrice')}: {formatPrice(totalPrice)}</p></>}
                    <div className="flex gap-3 text-[hsl(var(--card))]"><UserRound size={16} className="mt-0.5 text-[hsl(var(--accent))]" /><span>{selectedStylist?.name ?? t('stylistToChoose')}</span></div>
                    <div className="flex gap-3 text-[hsl(var(--card))]"><CalendarDays size={16} className="mt-0.5 text-[hsl(var(--accent))]" /><span>{person.date ? formatDate(person.date, { weekday: 'long', month: 'long', day: 'numeric' }) : t('dateToChoose')}{person.time ? ` · ${person.time}` : ''}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 pt-5 text-[11px] leading-5 text-[hsl(var(--card)/.54)]"><ShieldCheck size={15} className="shrink-0 text-[hsl(var(--accent))]" /> {t('noPayment')}</div>
        </aside>
      </div>
    </main>
  );
}

function StepPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  const { t } = useLocale();
  const { isSignedIn } = useAuth();
  return <section className="reveal rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)] p-5 sm:p-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</p><h2 className="mt-3 mb-8 font-display text-4xl leading-none sm:text-5xl">{title}</h2>{eyebrow.startsWith('04 /') && (isSignedIn ? <p className="mb-5 rounded-xl bg-[hsl(var(--primary)/.07)] p-4 text-sm text-[hsl(var(--primary))]" data-testid="status-booking-account">{t('bookingAccountSaved')}</p> : <p className="mb-5 rounded-xl bg-[hsl(var(--muted))] p-4 text-sm text-[hsl(var(--muted-foreground))]" data-testid="status-booking-account">{t('bookingAccountPrompt')} <Link href="/sign-in" className="font-semibold text-[hsl(var(--primary))]">{t('signIn')}</Link></p>)}{children}</section>;
}
function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useLocale();
  return <button type="button" onClick={onClick} className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[.08em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-back"><ChevronLeft size={15} /> {t('back')}</button>;
}
function Field({ icon, label, value, onChange, type = 'text', required = false, minLength, testId }: { icon: React.ReactNode; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number; testId: string }) {
  return <label className="block text-xs font-semibold">{label}<span className="relative mt-2 block"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))]">{icon}</span><input type={type} required={required} minLength={minLength} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-11 pr-4 text-sm font-normal placeholder:text-[hsl(var(--muted-foreground))]" data-testid={testId} /></span></label>;
}

function Confirmation({ appointment }: { appointment: Appointment }) {
  const { t, formatDate, translateServiceName, statusLabel, formatPrice } = useLocale();
  return <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[760px] items-center px-5 py-16 sm:px-8"><div className="w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 text-center shadow-[0_24px_70px_hsl(var(--secondary)/.08)] sm:p-14"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--secondary))]"><Check size={28} /></span><p className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('inTheBooks')}</p><h1 className="mt-4 font-display text-6xl leading-[.85] sm:text-8xl">{t('seeYouSoon')}</h1><p className="mx-auto mt-7 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('confirmationInbox')} {appointment.email}. {t('confirmationSent')}</p><div className="mx-auto mt-10 max-w-md rounded-2xl bg-[hsl(var(--muted)/.75)] p-5 text-left"><div className="flex justify-between gap-4 border-b border-[hsl(var(--border))] pb-4"><div className="space-y-1">{appointment.serviceNames.map((name) => <p key={name} className="font-display text-2xl">{translateServiceName(name)}</p>)}</div><span className="font-mono-ui text-[10px] text-[hsl(var(--primary))]">{statusLabel(appointment.status)}</span></div><div className="grid gap-3 border-b border-[hsl(var(--border))] py-4 text-sm"><span>{t('totalDuration')}: {appointment.totalDurationMinutes} {t('minutes')}</span><span>{t('totalPrice')}: {formatPrice(appointment.totalPrice)}</span></div><div className="grid gap-4 pt-4 text-sm sm:grid-cols-2"><span className="flex items-center gap-2"><CalendarDays size={15} className="text-[hsl(var(--primary))]" />{formatDate(appointment.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span className="flex items-center gap-2"><Clock3 size={15} className="text-[hsl(var(--primary))]" />{appointment.time}</span><span className="flex items-center gap-2"><UserRound size={15} className="text-[hsl(var(--primary))]" />{appointment.stylistName}</span></div></div><Link href="/appointments" className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary))]" data-testid="link-view-appointments">{t('viewAppointments')} <ArrowRight size={15} /></Link></div></main>;
}

function localIsoDate(date: Date | string) {
  if (typeof date === 'string') return date.slice(0, 10);
  return uaeIsoDate(date);
}

function AccountAppointments() {
  const { t, formatDate, translateServiceName, statusLabel, formatPrice } = useLocale();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [feedback, setFeedback] = useState<string>();
  const params = useMemo(() => ({ email: undefined as string | undefined }), []);
  const appointmentsQuery = useListAppointments(params, {
    query: {
      enabled: Boolean(isLoaded && isSignedIn),
      queryKey: getListAppointmentsQueryKey(params),
    },
  });
  const appointments = appointmentsQuery.data ?? [];
  const editingAppointment = appointments.find((appointment) => appointment.id === editingId);
  const availabilityParams = useMemo(() => ({
    date: editDate,
    stylistId: editingAppointment?.stylistId ?? 0,
    serviceIds: editingAppointment?.serviceIds ?? [],
  }), [editDate, editingAppointment?.stylistId, editingAppointment?.serviceIds]);
  const availabilityQuery = useGetAvailability(availabilityParams, {
    query: {
      enabled: Boolean(editingAppointment && editDate && editingAppointment.status !== 'cancelled'),
      queryKey: getGetAvailabilityQueryKey(availabilityParams),
      refetchOnWindowFocus: true,
    },
  });
  const updateAppointment = useUpdateAppointment();
  const cancelAppointment = useCancelAppointment();
  const nowTick = useUaeClockTick();
  const { minDate, maxDate } = bookingDateBounds(new Date(nowTick));
  const rescheduleSlots = useMemo(
    () => (availabilityQuery.data?.[0]?.slots ?? [])
      .filter((slot) => isFutureUaeSlot(editDate, slot, new Date(nowTick))),
    [availabilityQuery.data, editDate, nowTick],
  );
  const accountName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || t('myAccount');
  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? '';

  useEffect(() => {
    const now = new Date(nowTick);
    if (editingId !== null && editDate && editTime && !isFutureUaeSlot(editDate, editTime, now)) {
      setEditTime('');
    }
  }, [editDate, editingId, editTime, nowTick]);

  useEffect(() => {
    if (availabilityQuery.isSuccess && editTime && !rescheduleSlots.includes(editTime)) {
      setEditTime('');
    }
  }, [availabilityQuery.isSuccess, editTime, rescheduleSlots]);

  const openEditor = (appointment: Appointment) => {
    setEditingId(appointment.id);
    setEditDate(localIsoDate(appointment.date));
    setEditTime(appointment.time);
    setFeedback(undefined);
  };
  useEffect(() => {
    if (editingId !== null && editDate < minDate) {
      setEditDate(minDate);
      setEditTime('');
    }
  }, [editDate, editingId, minDate]);
  const saveReschedule = () => {
    if (!editingAppointment || !editDate || !editTime) return;
    setFeedback(undefined);
    updateAppointment.mutate(
      { appointmentId: editingAppointment.id, data: { date: editDate, time: editTime } },
      {
        onSuccess: () => {
          setEditingId(null);
          setFeedback(t('appointmentChanged'));
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(params) });
        },
        onError: (error) => {
          setFeedback(scheduleErrorMessage(error, t('appointmentChangeError'), {}));
        },
      },
    );
  };
  const cancel = (appointment: Appointment) => {
    if (!window.confirm(`${t('cancelAppointmentConfirm')} ${formatDate(appointment.date, { month: 'short', day: 'numeric' })}?`)) return;
    setFeedback(undefined);
    cancelAppointment.mutate(
      { appointmentId: appointment.id },
      {
        onSuccess: () => {
          setEditingId(null);
          setFeedback(t('appointmentCancelled'));
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(params) });
        },
        onError: (error) => {
          setFeedback(scheduleErrorMessage(error, t('appointmentCancelError'), {}));
        },
      },
    );
  };

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-14 sm:px-8 md:py-24">
      <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
        <div className="max-w-2xl reveal">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('myAccount')}</p>
          <h1 className="mt-4 font-display text-6xl leading-[.84] sm:text-8xl">{t('yourVisits')}</h1>
          <p className="mt-7 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('accountIntro')}</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><UserRound size={17} /></span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{accountName}</p><p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{accountEmail}</p></div>
        </div>
      </div>
      {feedback && <p className="mt-8 rounded-xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.06)] p-4 text-sm text-[hsl(var(--primary))]" role="status" data-testid="status-appointment-account">{feedback}</p>}
      <section className="mt-12" data-testid="account-appointments">
        {appointmentsQuery.isLoading ? <div className="space-y-3"><div className="skeleton h-32 rounded-2xl" /><div className="skeleton h-32 rounded-2xl" /></div> : appointmentsQuery.isError ? <ErrorMessage retry={() => appointmentsQuery.refetch()} /> : appointments.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center" data-testid="empty-account-appointments"><CalendarDays className="mx-auto text-[hsl(var(--primary))]" size={25} /><p className="mt-4 font-display text-2xl">{t('nothingBooked')}</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{t('accountEmpty')}</p><Link href="/book" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-account-book">{t('bookAVisit')} <ArrowRight size={14} /></Link></div> : <div className="space-y-4">{appointments.map((appointment) => {
          const canManage = appointment.status !== 'cancelled' && appointment.date >= minDate;
          const isEditing = editingId === appointment.id;
          return <article key={appointment.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-6" data-testid={`card-account-appointment-${appointment.id}`}>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Scissors size={18} /></div><div><div className="flex flex-wrap items-center gap-3"><div className="space-y-1">{appointment.serviceNames.map((name) => <h2 key={name} className="font-display text-2xl">{translateServiceName(name)}</h2>)}</div><span className="rounded-full bg-[hsl(var(--accent)/.35)] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.08em]">{statusLabel(appointment.status)}</span></div><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{appointment.stylistName}</p><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{appointment.totalDurationMinutes} {t('minutes')} · {formatPrice(appointment.totalPrice)}</p></div></div>
              <div className="flex flex-wrap items-center gap-4 text-sm"><span className="flex items-center gap-2"><CalendarDays size={15} className="text-[hsl(var(--primary))]" />{formatDate(appointment.date, { month: 'short', day: 'numeric' })}</span><span className="flex items-center gap-2"><Clock3 size={15} className="text-[hsl(var(--primary))]" />{appointment.time}</span></div>
            </div>
            {canManage && <div className="mt-5 flex flex-wrap gap-2 border-t border-[hsl(var(--border))] pt-4"><button type="button" onClick={() => isEditing ? setEditingId(null) : openEditor(appointment)} className="rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid={`button-edit-appointment-${appointment.id}`}>{isEditing ? t('closeEditor') : t('changeAppointment')}</button><button type="button" onClick={() => cancel(appointment)} disabled={cancelAppointment.isPending} className="rounded-full border border-[hsl(var(--destructive)/.35)] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] text-[hsl(var(--destructive))] disabled:opacity-60" data-testid={`button-cancel-appointment-${appointment.id}`}>{t('cancelAppointment')}</button></div>}
            {isEditing && <div className="mt-4 rounded-2xl bg-[hsl(var(--muted)/.55)] p-4" data-testid={`appointment-editor-${appointment.id}`}><p className="text-sm font-semibold">{t('changeAppointment')}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('accountChangeHint')}</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-[10px] font-bold uppercase tracking-[.1em]">{t('dateTime')}<input type="date" min={minDate} max={maxDate} value={editDate} onChange={(event) => { setEditDate(event.target.value); setEditTime(''); }} className="mt-2 h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal normal-case tracking-normal" data-testid={`input-reschedule-date-${appointment.id}`} /></label><label className="text-[10px] font-bold uppercase tracking-[.1em]">{t('findTime')}<select value={editTime} onChange={(event) => setEditTime(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal normal-case tracking-normal" data-testid={`select-reschedule-time-${appointment.id}`}><option value="">{availabilityQuery.isLoading ? t('loadingTimes') : t('chooseTime')}</option>{rescheduleSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label><button type="button" onClick={saveReschedule} disabled={!editTime || updateAppointment.isPending} className="self-end rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-[11px] font-bold tracking-[.08em] text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid={`button-save-reschedule-${appointment.id}`}>{updateAppointment.isPending ? t('saving') : t('saveChanges')}</button></div></div>}
          </article>;
        })}</div>}
      </section>
      <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="mt-10 rounded-full border border-[hsl(var(--border))] px-4 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid="button-account-sign-out">{t('signOut')}</button>
    </main>
  );
}

function Appointments() {
  const { t, formatDate, translateServiceName, statusLabel, formatPrice } = useLocale();
  const { isSignedIn } = useAuth();
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const params = useMemo(() => ({ email: submittedEmail }), [submittedEmail]);
  const appointmentsQuery = useListAppointments(params, { query: { enabled: Boolean(submittedEmail), queryKey: getListAppointmentsQueryKey(params) } });
  const appointments = appointmentsQuery.data ?? [];
  if (isSignedIn) return <AccountAppointments />;
    return <main className="mx-auto max-w-[1000px] px-5 py-14 sm:px-8 md:py-24"><div className="max-w-2xl reveal"><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('yourVisits')}</p><h1 className="mt-4 font-display text-6xl leading-[.84] sm:text-8xl">{t('goodTimes')}</h1><p className="mt-7 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('lookupIntro')}</p></div><form onSubmit={(event) => { event.preventDefault(); setSubmittedEmail(email.trim()); }} className="mt-12 flex max-w-xl flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))]" /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('lookupPlaceholder')} className="h-14 w-full rounded-full border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-11 pr-5 text-sm" data-testid="input-lookup-email" /></div><button type="submit" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-7 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))]" data-testid="button-lookup-appointments"><Search size={15} /> {t('findVisits')}</button></form>{submittedEmail && <section className="mt-16 reveal"><div className="mb-6 flex items-center justify-between"><h2 className="font-display text-4xl">{t('appointments')}</h2><span className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{submittedEmail}</span></div>{appointmentsQuery.isLoading ? <div className="space-y-3"><div className="skeleton h-28 rounded-2xl" /><div className="skeleton h-28 rounded-2xl" /></div> : appointmentsQuery.isError ? <ErrorMessage retry={() => appointmentsQuery.refetch()} /> : appointments.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center" data-testid="empty-appointments"><CalendarDays className="mx-auto text-[hsl(var(--primary))]" size={25} /><p className="mt-4 font-display text-2xl">{t('nothingBooked')}</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{t('readyHere')}</p><Link href="/book" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-empty-book">{t('bookAVisit')} <ArrowRight size={14} /></Link></div> : <div className="space-y-3">{appointments.map((appointment) => <div key={appointment.id} className="flex flex-col justify-between gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:flex-row sm:items-center sm:p-6" data-testid={`card-appointment-${appointment.id}`}><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Scissors size={18} /></div><div><div className="flex flex-wrap items-center gap-3"><div className="space-y-1">{appointment.serviceNames.map((name) => <h3 key={name} className="font-display text-2xl">{translateServiceName(name)}</h3>)}</div><span className="rounded-full bg-[hsl(var(--accent)/.35)] px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[.08em]">{statusLabel(appointment.status)}</span></div><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{appointment.stylistName}</p><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{appointment.totalDurationMinutes} {t('minutes')} · {formatPrice(appointment.totalPrice)}</p></div></div><div className="flex items-center gap-5 border-t border-[hsl(var(--border)/.7)] pt-4 text-sm sm:border-t-0 sm:pt-0"><span className="flex items-center gap-2"><CalendarDays size={15} className="text-[hsl(var(--primary))]" />{formatDate(appointment.date, { month: 'short', day: 'numeric' })}</span><span className="flex items-center gap-2"><Clock3 size={15} className="text-[hsl(var(--primary))]" />{appointment.time}</span></div></div>)}</div>}</section>}</main>;
}

function SignInPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </main>
  );
}

function ManagerRoute() {
  const { t } = useLocale();
  const { isLoaded, isSignedIn } = useAuth();
  const managerAccessQuery = useListManagerCustomers({
    query: {
      enabled: isLoaded && Boolean(isSignedIn),
      queryKey: getListManagerCustomersQueryKey(),
      retry: false,
    },
  });

  if (!isLoaded) {
    return <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[1000px] items-center px-5 py-14 sm:px-8" data-testid="manager-auth-loading"><div className="w-full"><div className="skeleton h-10 w-48 rounded-xl" /><p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">{t('signInLoading')}</p></div></main>;
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[760px] items-center px-5 py-16 sm:px-8">
        <div className="w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 sm:p-12" data-testid="manager-sign-in-prompt">
           <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('managerWorkspace')}</p>
           <h1 className="mt-4 font-display text-5xl leading-[.88] sm:text-7xl">{t('managerSignInTitle')}</h1>
           <p className="mt-6 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('managerSignInIntro')}</p>
           <Link href="/sign-in" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-4 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))]" data-testid="link-manager-sign-in">{t('signIn')} <ArrowRight size={15} /></Link>
        </div>
      </main>
    );
  }

  if (managerAccessQuery.isLoading || managerAccessQuery.isPending) {
    return <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[1000px] items-center px-5 py-14 sm:px-8" data-testid="manager-auth-loading"><div className="w-full"><div className="skeleton h-10 w-48 rounded-xl" /><p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">{t('signInLoading')}</p></div></main>;
  }

  if (managerAccessQuery.isError && isManagerAccessDenied(managerAccessQuery.error)) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[760px] items-center px-5 py-16 sm:px-8">
        <div className="w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 sm:p-12" data-testid="manager-access-denied">
          <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('managerWorkspace')}</p>
          <h1 className="mt-4 font-display text-5xl leading-[.88] sm:text-7xl">{t('managerAccessDeniedTitle')}</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('managerAccessDeniedIntro')}</p>
        </div>
      </main>
    );
  }

  if (managerAccessQuery.isError) {
    return <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[1000px] items-center px-5 py-14 sm:px-8"><div className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><ErrorMessage retry={() => managerAccessQuery.refetch()} /></div></main>;
  }

  return <ManagerSchedule />;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/book" component={Book} /><Route path="/appointments" component={Appointments} /><Route path="/manage" component={ManagerRoute} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function ClerkQueryClientCacheInvalidator() {
  const { isSignedIn } = useAuth();
  const previousAuthState = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (previousAuthState.current !== undefined && previousAuthState.current !== isSignedIn) {
      queryClient.clear();
    }
    previousAuthState.current = isSignedIn;
  }, [isSignedIn]);

  return null;
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function ClerkApp() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={() => <Shell><Router /></Shell>} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return <LocaleProvider><WouterRouter base={basePath}><ClerkApp /></WouterRouter></LocaleProvider>;
}

export default App;

const defaultEmployeeSchedule: StylistScheduleEntry[] = [
  { dayOfWeek: 1, openTime: '10:00', closeTime: '18:00', breaks: [presetBreak()] },
  { dayOfWeek: 2, openTime: '10:00', closeTime: '18:00', breaks: [presetBreak()] },
  { dayOfWeek: 3, openTime: '10:00', closeTime: '18:00', breaks: [presetBreak()] },
  { dayOfWeek: 4, openTime: '10:00', closeTime: '18:00', breaks: [presetBreak()] },
  { dayOfWeek: 5, openTime: '10:00', closeTime: '18:00', breaks: [presetBreak()] },
];

const emptyEmployeeForm: EmployeeFormState = {
  name: '',
  role: '',
  bio: '',
  initials: '',
  accent: '#B86B45',
  photoUrl: '',
  schedule: defaultEmployeeSchedule,
  serviceIds: [],
};

function employeeToForm(stylist: Stylist): EmployeeFormState {
  return {
    name: stylist.name,
    role: stylist.role,
    bio: stylist.bio,
    initials: stylist.initials,
    accent: stylist.accent,
    photoUrl: stylist.photoUrl ?? '',
    schedule: scheduleWithPresetBreaks(stylist.schedule),
    serviceIds: stylist.serviceIds,
  };
}

function EmployeeProfileEditor({
  stylist,
  onCancel,
  onSaved,
}: {
  stylist?: Stylist;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useLocale();
  const [form, setForm] = useState<EmployeeFormState>(() => stylist ? employeeToForm(stylist) : emptyEmployeeForm);
  const [feedback, setFeedback] = useState<string>();
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(() => stylistPhotoSource(stylist?.photoUrl));
  const [photoUpload, setPhotoUpload] = useState<{ status: 'idle' | 'uploading' | 'success' | 'error'; progress: number }>({ status: 'idle', progress: 0 });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const services = servicesQuery.data ?? [];
  const previewObjectUrlRef = useRef<string | undefined>(undefined);
  const createStylist = useCreateStylist();
  const updateStylist = useUpdateStylist();
  const isPending = createStylist.isPending || updateStylist.isPending;

  useEffect(() => {
    setForm(stylist ? employeeToForm(stylist) : emptyEmployeeForm);
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = undefined;
    setPhotoPreview(stylistPhotoSource(stylist?.photoUrl));
    setPhotoUpload({ status: 'idle', progress: 0 });
    setFeedback(undefined);
  }, [stylist?.id]);

  useEffect(() => () => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
  }, []);

  const updateField = <K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) => {
    setFeedback(undefined);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    const fileType = file.type || 'unknown';
    if (!EMPLOYEE_PHOTO_TYPES.has(file.type) || file.size > MAX_EMPLOYEE_PHOTO_SIZE) {
      trackEvent('employee_photo_upload', {
        outcome: 'failure',
        file_type: fileType,
        failure_category: file.size > MAX_EMPLOYEE_PHOTO_SIZE ? 'file_too_large' : 'unsupported_type',
      });
      setFeedback(t('photoUploadError'));
      setPhotoUpload({ status: 'error', progress: 0 });
      return;
    }
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = previewUrl;
    setPhotoPreview(previewUrl);
    setFeedback(undefined);
    setPhotoUpload({ status: 'uploading', progress: 0 });
    try {
      let upload;
      try {
        upload = await requestUploadUrl({ name: file.name, size: file.size, contentType: file.type });
      } catch {
        trackEvent('employee_photo_upload', {
          outcome: 'failure',
          file_type: fileType,
          failure_category: 'upload_url_request',
        });
        throw new Error('Photo upload URL request failed.');
      }
      try {
        await uploadFileToStorage(file, upload.uploadURL, (progress) => setPhotoUpload({ status: 'uploading', progress }));
      } catch {
        trackEvent('employee_photo_upload', {
          outcome: 'failure',
          file_type: fileType,
          failure_category: 'storage_upload',
        });
        throw new Error('Photo storage upload failed.');
      }
      updateField('photoUrl', upload.objectPath);
      setPhotoUpload({ status: 'success', progress: 100 });
      trackEvent('employee_photo_upload', { outcome: 'success', file_type: fileType });
    } catch {
      setPhotoUpload({ status: 'error', progress: 0 });
      setFeedback(t('photoUploadError'));
    }
  };

  const clearPhoto = () => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = undefined;
    setPhotoPreview(undefined);
    updateField('photoUrl', '');
    setPhotoUpload({ status: 'idle', progress: 0 });
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const data = {
      name: form.name.trim(),
      role: form.role.trim(),
      bio: form.bio.trim(),
      initials: form.initials.trim().toUpperCase(),
      accent: form.accent.trim(),
      photoUrl: form.photoUrl.trim() || null,
      schedule: form.schedule,
      serviceIds: form.serviceIds,
    };
    if (!data.name || !data.role || !data.accent) {
      setFeedback(t('employeeRequired'));
      return;
    }
    if (data.initials.length > 5) {
      setFeedback(t('initialsTooLong'));
      return;
    }
    const scheduleError = validateScheduleInForm(data.schedule);
    if (scheduleError) {
      setFeedback(scheduleError === 'Each opening time must be earlier than its closing time.' ? t('openingBeforeClosing') : t('scheduleOverlap'));
      return;
    }
    const onError = (error: unknown) => {
      setFeedback(scheduleErrorMessage(error, t('employeeSaveError'), { openingBeforeClosing: t('openingBeforeClosing'), scheduleOverlap: t('scheduleOverlap') }));
    };
    if (stylist) {
      updateStylist.mutate(
        { stylistId: stylist.id, data: data as StylistUpdate },
        { onSuccess: () => onSaved(`${data.name} ${t('employeeUpdated')}`), onError },
      );
    } else {
      createStylist.mutate(
        { data: data as StylistInput },
        { onSuccess: () => onSaved(`${data.name} ${t('employeeAdded')}`), onError },
      );
    }
  };

  return (
    <form onSubmit={save} className="mt-6 rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card))] p-5 shadow-[0_14px_34px_hsl(var(--secondary)/.06)] sm:p-7" data-testid={stylist ? `employee-editor-${stylist.id}` : 'employee-editor-new'}>
      <div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{stylist ? t('editEmployee') : t('newEmployee')}</p>
          <h2 className="mt-2 font-display text-3xl">{stylist ? stylist.name : t('addEmployee')}</h2>
        </div>
        <button type="button" onClick={onCancel} className="self-start text-xs font-bold tracking-[.08em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-cancel-employee">{t('cancel')}</button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">{t('name')}
          <input required value={form.name} onChange={(event) => updateField('name', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-employee-name" />
        </label>
        <label className="text-xs font-semibold">{t('jobTitle')}
          <input required value={form.role} onChange={(event) => updateField('role', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-employee-role" />
        </label>
        <label className="text-xs font-semibold">{t('initials')} <span className="font-normal text-[hsl(var(--muted-foreground))]">({t('optional')})</span>
          <input maxLength={5} value={form.initials} onChange={(event) => updateField('initials', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal uppercase" data-testid="input-employee-initials" />
        </label>
        <label className="text-xs font-semibold">{t('accent')}
          <input required value={form.accent} onChange={(event) => updateField('accent', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-employee-accent" />
        </label>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold">{t('photoUpload')} <span className="font-normal text-[hsl(var(--muted-foreground))]">({t('optional')})</span></p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {photoPreview ? <img src={photoPreview} alt={t('profilePhoto')} className="h-16 w-16 rounded-full object-cover" onError={() => setPhotoPreview(undefined)} data-testid="employee-photo-preview" /> : <span className="grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--secondary))] font-display text-lg text-[hsl(var(--card))]" data-testid="employee-photo-fallback">{form.initials || '?'}</span>}
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = ''; }} data-testid="input-employee-photo" />
            <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUpload.status === 'uploading'} className="rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] hover:border-[hsl(var(--primary))] disabled:opacity-60" data-testid="button-choose-employee-photo">{photoPreview ? t('replacePhoto') : t('choosePhoto')}</button>
            {photoPreview && <button type="button" onClick={clearPhoto} disabled={photoUpload.status === 'uploading'} className="rounded-full border border-[hsl(var(--destructive)/.35)] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] text-[hsl(var(--destructive))] disabled:opacity-60" data-testid="button-remove-employee-photo">{t('removePhoto')}</button>}
          </div>
          <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{t('photoUploadHint')}</p>
          {photoUpload.status === 'uploading' && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]" role="progressbar" aria-label={`${t('uploading')} ${photoUpload.progress}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={photoUpload.progress} data-testid="employee-photo-upload-progress"><div className="h-full bg-[hsl(var(--primary))] transition-all" style={{ width: `${photoUpload.progress}%` }} /></div>}
          {photoUpload.status === 'success' && <p className="mt-2 text-[11px] text-[hsl(var(--secondary))]" role="status" data-testid="status-employee-photo-success">{t('photoUploadComplete')}</p>}
        </div>
        <div className="sm:col-span-2 mt-4">
          <p className="text-xs font-semibold">{t('services')}</p>
          <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('managerServicesCheckboxes')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <label key={service.id} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-3 text-sm transition-colors hover:border-[hsl(var(--primary))] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.serviceIds.includes(service.id)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateField('serviceIds', checked
                      ? [...form.serviceIds, service.id]
                      : form.serviceIds.filter((id) => id !== service.id));
                  }}
                  className="h-4 w-4 rounded-sm border border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] focus:ring-offset-2"
                  data-testid={`checkbox-employee-service-${service.id}`}
                />
                <span className="truncate">{service.name}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="text-xs font-semibold sm:col-span-2">{t('description')} <span className="font-normal text-[hsl(var(--muted-foreground))]">({t('optional')})</span>
          <textarea value={form.bio} onChange={(event) => updateField('bio', event.target.value)} rows={3} className="mt-2 w-full resize-y rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-3 text-sm font-normal" data-testid="input-employee-bio" />
        </label>
      </div>
      {feedback && <p className="mt-4 text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-employee-error">{feedback}</p>}
      <button type="submit" disabled={isPending || photoUpload.status === 'uploading'} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" data-testid="button-save-employee">
        {isPending ? t('saving') : t('saveEmployee')} <Check size={14} />
      </button>
    </form>
  );
}
