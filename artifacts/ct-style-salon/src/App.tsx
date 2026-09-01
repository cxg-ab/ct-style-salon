import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowRight,
  CalendarDays,
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
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  getGetAvailabilityQueryKey,
  getGetSalonSummaryQueryKey,
  getListAppointmentsQueryKey,
  getListServicesQueryKey,
  getListStylistsQueryKey,
  useCreateStylist,
  useCreateAppointment,
  useCreateService,
  useGetAvailability,
  useGetSalonSummary,
  useHealthCheck,
  useListAppointments,
  useListServices,
  useListStylists,
  useDeleteService,
  useDeleteStylist,
  useUpdateService,
  useUpdateStylist,
  useUpdateStylistSchedule,
  requestUploadUrl,
  type Service,
  type ServiceInput,
  type Appointment,
  type Stylist,
  type StylistInput,
  type StylistScheduleEntry,
  type StylistUpdate,
} from '@workspace/api-client-react';
import storefrontImage from '@assets/WhatsApp_Image_2026-08-31_at_11.57.17_1788163048747.jpeg';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { bookingSteps, selectEmployee } from '@/lib/booking-flow';
import { LocaleProvider, useLocale } from '@/lib/locale';
import { Route, Switch, Link, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
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
        <div className="mx-auto grid max-w-[1240px] gap-6 px-5 py-7 sm:grid-cols-3 sm:px-8">
          <div className="flex items-center gap-4 border-b border-[hsl(var(--border)/.7)] pb-5 sm:border-b-0 sm:border-r sm:pb-0">
            <Star size={22} fill="hsl(var(--accent))" className="text-[hsl(var(--accent))]" />
             <div><strong className="block font-display text-2xl">{summary?.rating ?? '—'}</strong><span className="font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">{summary?.reviewCount ? `${summary.reviewCount} ${t('guestNotes')}` : t('guestNotes')}</span></div>
          </div>
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
           <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">{displayedStylists.map((stylist) => <div key={stylist.id} className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-transform hover:-translate-y-1" data-testid={`card-stylist-${stylist.id}`}><div className="mb-12 flex items-start justify-between"><StylistAvatar stylist={stylist} className="h-14 w-14" /><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">0{stylist.id}</span></div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">{stylist.role}</p><h3 className="mt-2 font-display text-3xl">{stylist.name}</h3><p className="mt-3 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{stylist.bio}</p></div>)}</div>
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
  return <span className={`${className} grid place-items-center rounded-full text-sm font-bold`} style={{ backgroundColor: `${stylist.accent}25`, color: stylist.accent }} aria-label={alt ?? stylist.name}>{stylist.initials}</span>;
}

function stylistPhotoSource(photoUrl?: string | null): string | undefined {
  if (!photoUrl) return undefined;
  return photoUrl.startsWith('/objects/') ? `/api/storage${photoUrl}` : photoUrl;
}

const EMPLOYEE_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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
  const toggleDay = (dayOfWeek: number, enabled: boolean) => {
    if (!enabled) {
      onChange(schedule.filter((entry) => entry.dayOfWeek !== dayOfWeek));
      return;
    }
    onChange([...schedule, { dayOfWeek, openTime: '10:00', closeTime: '18:00' }].sort((left, right) => left.dayOfWeek - right.dayOfWeek));
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
  const [schedule, setSchedule] = useState<StylistScheduleEntry[]>(stylist.schedule);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string }>();
  const [expanded, setExpanded] = useState(false);
  const updateSchedule = useUpdateStylistSchedule({
  });

  useEffect(() => {
    setSchedule(stylist.schedule);
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
      return [...current, { dayOfWeek, openTime: '10:00', closeTime: '18:00', breaks: [] }].sort((left, right) => left.dayOfWeek - right.dayOfWeek);
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
    <section className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.42)] p-4 sm:p-5" data-testid="service-management">
      <div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-4 sm:flex-row sm:items-end">
         <div><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{t('serviceMenu')}</p><h2 className="mt-1 font-display text-3xl">{t('rituals')}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('serviceIntroManager')}</p></div>
         <button type="button" onClick={() => { setEditing('new'); setFeedback(undefined); setConfirmingDelete(null); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-4 py-2.5 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--card))] hover:bg-[hsl(var(--secondary)/.88)]" data-testid="button-add-service"><Plus size={15} /> {t('addService')}</button>
      </div>
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
    </section>
  );
}

function ManagerSchedule() {
  const { t } = useLocale();
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });
  const stylists = stylistsQuery.data ?? [];
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [rosterExpanded, setRosterExpanded] = useState(true);
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
    <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 md:py-16">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
        <div className="max-w-2xl reveal">
           <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('managerWorkspace')}</p>
           <h1 className="mt-3 font-display text-5xl leading-[.86] sm:text-7xl">{t('managerWorkspaceShort')}<br /><i>{t('goodHands')}</i></h1>
           <p className="mt-5 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('serviceIntroManager')} {t('scheduleIntro')}</p>
        </div>
        <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-[hsl(var(--border))] px-4 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid="button-manager-sign-out">
           {t('signOut')}
        </button>
      </div>
      <ServiceManagement />
       <section className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.42)] p-4 sm:p-5" data-testid="employee-management">
         <div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-4 sm:flex-row sm:items-center">
           <button type="button" onClick={() => setRosterExpanded((current) => !current)} aria-expanded={rosterExpanded} aria-controls="employee-roster-details" className="min-w-0 text-left">
             <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{t('employeeRoster')}</p>
             <span className="mt-1 flex items-center gap-2"><h2 className="font-display text-3xl">{t('theTeam')}</h2><ChevronDown size={17} className={`transition-transform ${rosterExpanded ? 'rotate-180' : ''}`} /></span>
             <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('employeeIntro')}</p>
           </button>
          <button type="button" onClick={() => { setEditing('new'); setFeedback(undefined); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-5 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--card))] hover:bg-[hsl(var(--secondary)/.88)]" data-testid="button-add-employee"><Plus size={15} /> {t('addEmployee')}</button>
        </div>
         <div id="employee-roster-details" hidden={!rosterExpanded}>
        {feedback && <p className="mt-5 text-sm text-[hsl(var(--secondary))]" role="status" data-testid="status-employee-success">{feedback}</p>}
        {editing === 'new' && <EmployeeProfileEditor onCancel={() => setEditing(null)} onSaved={finishSave} />}
         <div className="mt-4 space-y-3">
          {stylistsQuery.isLoading ? <LoadingCards count={3} /> : stylistsQuery.isError ? <ErrorMessage retry={() => stylistsQuery.refetch()} /> : stylists.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noEmployees')}</div> : null}
          {stylists.map((stylist) => (
             <div key={`profile-${stylist.id}`} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid={`employee-card-${stylist.id}`}>
               <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-start gap-4">
                   <StylistAvatar stylist={stylist} className="h-12 w-12 shrink-0" alt={`${stylist.name} ${t('profilePhoto')}`} />
                   <div className="min-w-0"><h3 className="font-display text-2xl">{stylist.name}</h3><p className="mt-0.5 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--primary))]">{stylist.role}</p><p className="mt-2 max-w-xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">{stylist.bio}</p></div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => { setEditing(stylist.id); setFeedback(undefined); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-[hsl(var(--border))] px-4 py-3 text-[11px] font-bold tracking-[.1em] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" data-testid={`button-edit-employee-${stylist.id}`}><Pencil size={14} /> {t('editEmployee')}</button>
                  <button type="button" onClick={() => removeEmployee(stylist)} disabled={deleteStylist.isPending} className="inline-flex items-center justify-center gap-2 rounded-full border border-[hsl(var(--destructive)/.35)] px-4 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.06)] disabled:opacity-60" data-testid={`button-remove-employee-${stylist.id}`}><Trash2 size={14} /> {t('removeEmployee')}</button>
                </div>
              </div>
              {editing === stylist.id && <EmployeeProfileEditor stylist={stylist} onCancel={() => setEditing(null)} onSaved={finishSave} />}
              {editing !== stylist.id && <ScheduleEditor stylist={stylist} embedded />}
            </div>
          ))}
        </div>
         </div>
      </section>
    </main>
  );
}

function DateStrip({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const { weekday, formatDate } = useLocale();
  const days = useMemo(() => Array.from({ length: 10 }, (_, index) => { const value = new Date(); value.setHours(12, 0, 0, 0); value.setDate(value.getDate() + index); return value; }), []);
  return <div className="flex gap-2 overflow-x-auto pb-2" data-testid="date-strip">{days.map((day) => { const iso = day.toISOString().slice(0, 10); const selected = iso === date; return <button key={iso} onClick={() => onChange(iso)} className={`min-w-[68px] rounded-xl border px-2 py-3 text-center transition-all ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_8px_18px_hsl(var(--primary)/.18)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.55)]'}`} data-testid={`button-date-${iso}`}><span className="block font-mono-ui text-[9px] uppercase tracking-[.08em] opacity-70">{weekday(day)}</span><span className="mt-1 block text-xl font-semibold">{day.getDate()}</span><span className="block text-[9px] uppercase opacity-60">{formatDate(day, { month: 'short' })}</span></button>; })}</div>;
}

function Book() {
  const { t, formatPrice, formatDate, serviceCopy, stylistCopy } = useLocale();
  const [step, setStep] = useState(1);
  const [stylistId, setStylistId] = useState<number>();
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('');
  const [form, setForm] = useState({ customerName: '', email: '', phone: '', notes: '' });
  const [confirmed, setConfirmed] = useState<Appointment>();
  const servicesQuery = useListServices({ query: { queryKey: getListServicesQueryKey() } });
  const stylistsQuery = useListStylists({ query: { queryKey: getListStylistsQueryKey() } });
  const availabilityParams = useMemo(() => ({ date, stylistId: stylistId ?? 0, serviceIds }), [date, stylistId, serviceIds]);
  const availabilityQuery = useGetAvailability(availabilityParams, { query: { enabled: Boolean(date && stylistId && serviceIds.length > 0), queryKey: getGetAvailabilityQueryKey(availabilityParams) } });
  const createAppointment = useCreateAppointment();
  const services = servicesQuery.data ?? [];
  const stylists = stylistsQuery.data ?? [];
  const selectedServices = services.filter((service) => serviceIds.includes(service.id));
  const selectedStylist = stylists.find((stylist) => stylist.id === stylistId);
  const displayedServices = selectedServices.map(serviceCopy);
  const displayedStylist = selectedStylist ? stylistCopy(selectedStylist) : undefined;
  const slots = availabilityQuery.data?.[0]?.slots ?? [];
  const totalDurationMinutes = selectedServices.reduce((total, service) => total + service.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((total, service) => total + Number(service.price), 0);

  const canNext = (step === 1 && Boolean(stylistId)) || (step === 2 && serviceIds.length > 0) || (step === 3 && Boolean(time)) || step === 4;
  const updateField = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (serviceIds.length === 0 || !stylistId || !time) return;
    createAppointment.mutate({ data: { serviceIds, stylistId, date, time, customerName: form.customerName, email: form.email, phone: form.phone, notes: form.notes || null } }, { onSuccess: (appointment) => setConfirmed(appointment) });
  };
  if (confirmed) return <Confirmation appointment={confirmed} />;

  return (
    <main className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 md:py-20">
       <div className="mb-12 max-w-2xl reveal"><p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('reserveYourChair')}</p><h1 className="mt-4 font-display text-6xl leading-[.84] sm:text-8xl">{t('goodHourStarts')}</h1><p className="mt-7 text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('bookingIntro')}</p></div>
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
           <div className="mb-10 flex items-center gap-0">{bookingSteps.map((_, index) => <div key={index} className="flex flex-1 items-center"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${step > index + 1 ? 'border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))] text-[hsl(var(--card))]' : step === index + 1 ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}>{step > index + 1 ? <Check size={14} /> : index + 1}</div><span className={`ml-2 hidden text-[10px] font-semibold uppercase tracking-[.1em] sm:block ${step === index + 1 ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>{[t('employee'), t('service'), t('dateTime'), t('details')][index]}</span>{index < bookingSteps.length - 1 && <span className="mx-2 h-px flex-1 bg-[hsl(var(--border))] sm:mx-4" />}</div>)}</div>
           {step === 1 && <StepPanel eyebrow={`01 / ${t('choosePerson')}`} title={t('whoSee')}>{stylistsQuery.isLoading ? <LoadingCards count={2} /> : stylistsQuery.isError ? <ErrorMessage retry={() => stylistsQuery.refetch()} /> : stylists.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('teamOnWay')}</div> : <div className="grid gap-3 sm:grid-cols-2">{stylists.map((rawStylist) => { const stylist = stylistCopy(rawStylist); return <button key={stylist.id} onClick={() => { const next = selectEmployee(stylist.id); setStylistId(next.stylistId); setServiceIds(next.serviceIds); setTime(next.time); setStep(next.step); }} className={`rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${stylistId === stylist.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)] ring-2 ring-[hsl(var(--primary)/.15)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.45)]'}`} data-testid={`button-stylist-${stylist.id}`}><div className="flex items-center gap-4"><StylistAvatar stylist={stylist} className="h-12 w-12 shrink-0" /><div><h3 className="font-display text-2xl">{stylist.name}</h3><p className="font-mono-ui text-[9px] uppercase tracking-[.11em] text-[hsl(var(--primary))]">{stylist.role}</p></div></div><p className="mt-5 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{stylist.bio}</p></button>; })}</div>}</StepPanel>}
           {step === 2 && <StepPanel eyebrow={`02 / ${t('chooseService')}`} title={t('whatDoing')}><div className="mb-6 rounded-2xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.05)] p-4" data-testid="selected-services"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{t('selectedServices')}</p>{selectedServices.length === 0 ? <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{t('ritualBegins')}</p> : <div className="mt-3 space-y-2">{displayedServices.map((service) => <div key={service.id} className="flex items-center justify-between gap-3 rounded-xl bg-[hsl(var(--card))] px-3 py-2.5 text-sm"><span>{service.name} <span className="text-[hsl(var(--muted-foreground))]">· {service.durationMinutes} {t('minutes')} · {formatPrice(service.price)}</span></span><button type="button" onClick={() => { setServiceIds((current) => current.filter((id) => id !== service.id)); setTime(''); }} className="inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--destructive))]" aria-label={`${t('removeService')}: ${service.name}`} data-testid={`button-remove-service-${service.id}`}><X size={14} /> {t('removeService')}</button></div>)}</div>}</div><div className="grid gap-3 sm:grid-cols-2">{servicesQuery.isLoading ? <LoadingCards count={2} /> : servicesQuery.isError ? <ErrorMessage retry={() => servicesQuery.refetch()} /> : services.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('menuRefreshing')}</div> : services.map((rawService) => { const service = serviceCopy(rawService); const selected = serviceIds.includes(service.id); return <button key={service.id} type="button" aria-pressed={selected} onClick={() => { setServiceIds((current) => selected ? current.filter((id) => id !== service.id) : [...current, service.id]); setTime(''); }} className={`group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)] ring-2 ring-[hsl(var(--primary)/.15)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.45)]'}`} data-testid={`button-service-${service.id}`}><div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Scissors size={16} /></span>{service.featured && <span className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--primary))]">{t('mostLoved')}</span>}</div><h3 className="mt-8 font-display text-3xl">{service.name}</h3><p className="mt-2 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{service.description}</p><div className="mt-5 flex gap-4 font-mono-ui text-[10px] uppercase tracking-[.09em] text-[hsl(var(--muted-foreground))]"><span>{service.durationMinutes} {t('minutes')}</span><span>{formatPrice(service.price)}</span></div></button>; })}</div><BackButton onClick={() => setStep(1)} /></StepPanel>}
           {step === 3 && <StepPanel eyebrow={`03 / ${t('findTime')}`} title={`${t('whenFeelsRight')} ${displayedStylist?.name ?? t('employee')}?`}><p className="mb-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('timeIntro')}</p><DateStrip date={date} onChange={(value) => { setDate(value); setTime(''); }} /><div className="mt-8">{availabilityQuery.isLoading ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4"><div className="skeleton h-12 rounded-xl" /><div className="skeleton h-12 rounded-xl" /><div className="skeleton h-12 rounded-xl" /></div> : availabilityQuery.isError ? <ErrorMessage retry={() => availabilityQuery.refetch()} /> : slots.length === 0 ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]" data-testid="empty-time-slots">{t('noOpenTimes')} {displayedStylist?.name ?? t('employee')} {t('chooseAnotherDate')}</div> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((slot) => <button key={slot} onClick={() => setTime(slot)} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-all ${time === slot ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-time-${slot.replaceAll(':', '-')}`}>{slot}</button>)}</div>}</div><BackButton onClick={() => setStep(2)} /></StepPanel>}
           {step === 4 && <StepPanel eyebrow={`04 / ${t('yourDetails')}`} title={t('sendNote')}><form onSubmit={submit} className="space-y-4"><Field icon={<UserRound size={16} />} label={t('fullName')} value={form.customerName} onChange={(value) => updateField('customerName', value)} required testId="input-customer-name" /><Field icon={<Mail size={16} />} label={t('emailAddress')} type="email" value={form.email} onChange={(value) => updateField('email', value)} required testId="input-customer-email" /><Field icon={<Phone size={16} />} label={t('phoneNumber')} type="tel" value={form.phone} onChange={(value) => updateField('phone', value)} required testId="input-customer-phone" /><label className="block text-xs font-semibold">{t('anythingKnow')} <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder={t('notesPlaceholder')} className="mt-2 min-h-[92px] w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-4 text-sm font-normal placeholder:text-[hsl(var(--muted-foreground))]" data-testid="input-notes" /></label><div className="flex items-center justify-between gap-4 pt-4"><BackButton onClick={() => setStep(3)} /><button disabled={createAppointment.isPending} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-4 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" type="submit" data-testid="button-confirm-appointment">{createAppointment.isPending ? t('holdingChair') : t('confirmAppointment')} <ArrowRight size={15} /></button></div>{createAppointment.isError && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="status-booking-error">{t('bookingTaken')}</p>}</form></StepPanel>}
           {step < 4 && <div className="mt-7 flex justify-end">{step !== 1 && <button onClick={() => setStep(step + 1)} disabled={!canNext} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-4 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-40" data-testid={`button-next-step-${step}`}>{t('continue')} <ArrowRight size={15} /></button>}</div>}
        </div>
          <aside className="h-fit rounded-2xl bg-[hsl(var(--secondary))] p-6 text-[hsl(var(--card))] lg:sticky lg:top-28"><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--accent))]">{t('yourVisit')}</p><div className="mt-8 border-b border-[hsl(var(--card)/.15)] pb-6">{displayedServices.length > 0 ? <div className="space-y-2">{displayedServices.map((service) => <p key={service.id} className="font-display text-2xl">{service.name}</p>)}</div> : <p className="font-display text-3xl">{t('selectService')}</p>}<div className="mt-4 space-y-1 text-sm text-[hsl(var(--card)/.58)]">{displayedServices.length > 0 ? <><p>{t('totalDuration')}: {totalDurationMinutes} {t('minutes')}</p><p>{t('totalPrice')}: {formatPrice(totalPrice)}</p></> : <p>{t('ritualBegins')}</p>}</div></div><div className="space-y-5 py-6 text-sm"><div className="flex gap-3"><UserRound size={16} className="mt-0.5 text-[hsl(var(--accent))]" /><span>{displayedStylist?.name ?? t('stylistToChoose')}</span></div><div className="flex gap-3"><CalendarDays size={16} className="mt-0.5 text-[hsl(var(--accent))]" /><span>{date ? formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' }) : t('dateToChoose')}{time ? ` · ${time}` : ''}</span></div></div><div className="flex gap-2 border-t border-[hsl(var(--card)/.15)] pt-5 text-[11px] leading-5 text-[hsl(var(--card)/.54)]"><ShieldCheck size={15} className="shrink-0 text-[hsl(var(--accent))]" /> {t('noPayment')}</div></aside>
      </div>
    </main>
  );
}

function StepPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="reveal rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)] p-5 sm:p-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</p><h2 className="mt-3 mb-8 font-display text-4xl leading-none sm:text-5xl">{title}</h2>{children}</section>;
}
function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useLocale();
  return <button onClick={onClick} className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[.08em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-back"><ChevronLeft size={15} /> {t('back')}</button>;
}
function Field({ icon, label, value, onChange, type = 'text', required = false, testId }: { icon: React.ReactNode; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; testId: string }) {
  return <label className="block text-xs font-semibold">{label}<span className="relative mt-2 block"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))]">{icon}</span><input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-11 pr-4 text-sm font-normal placeholder:text-[hsl(var(--muted-foreground))]" data-testid={testId} /></span></label>;
}

function Confirmation({ appointment }: { appointment: Appointment }) {
  const { t, formatDate, translateServiceName, statusLabel, formatPrice } = useLocale();
  return <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[760px] items-center px-5 py-16 sm:px-8"><div className="w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 text-center shadow-[0_24px_70px_hsl(var(--secondary)/.08)] sm:p-14"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--secondary))]"><Check size={28} /></span><p className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">{t('inTheBooks')}</p><h1 className="mt-4 font-display text-6xl leading-[.85] sm:text-8xl">{t('seeYouSoon')}</h1><p className="mx-auto mt-7 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('confirmationInbox')} {appointment.email}. {t('confirmationSent')}</p><div className="mx-auto mt-10 max-w-md rounded-2xl bg-[hsl(var(--muted)/.75)] p-5 text-left"><div className="flex justify-between gap-4 border-b border-[hsl(var(--border))] pb-4"><div className="space-y-1">{appointment.serviceNames.map((name) => <p key={name} className="font-display text-2xl">{translateServiceName(name)}</p>)}</div><span className="font-mono-ui text-[10px] text-[hsl(var(--primary))]">{statusLabel(appointment.status)}</span></div><div className="grid gap-3 border-b border-[hsl(var(--border))] py-4 text-sm"><span>{t('totalDuration')}: {appointment.totalDurationMinutes} {t('minutes')}</span><span>{t('totalPrice')}: {formatPrice(appointment.totalPrice)}</span></div><div className="grid gap-4 pt-4 text-sm sm:grid-cols-2"><span className="flex items-center gap-2"><CalendarDays size={15} className="text-[hsl(var(--primary))]" />{formatDate(appointment.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span className="flex items-center gap-2"><Clock3 size={15} className="text-[hsl(var(--primary))]" />{appointment.time}</span><span className="flex items-center gap-2"><UserRound size={15} className="text-[hsl(var(--primary))]" />{appointment.stylistName}</span></div></div><Link href="/appointments" className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary))]" data-testid="link-view-appointments">{t('viewAppointments')} <ArrowRight size={15} /></Link></div></main>;
}

function Appointments() {
  const { t, formatDate, translateServiceName, statusLabel, formatPrice } = useLocale();
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const params = useMemo(() => ({ email: submittedEmail }), [submittedEmail]);
  const appointmentsQuery = useListAppointments(params, { query: { enabled: Boolean(submittedEmail), queryKey: getListAppointmentsQueryKey(params) } });
  const appointments = appointmentsQuery.data ?? [];
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
  const { user } = useUser();

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

  if (user?.publicMetadata.role !== 'manager') {
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
  { dayOfWeek: 1, openTime: '10:00', closeTime: '18:00' },
  { dayOfWeek: 2, openTime: '10:00', closeTime: '18:00' },
  { dayOfWeek: 3, openTime: '10:00', closeTime: '18:00' },
  { dayOfWeek: 4, openTime: '10:00', closeTime: '18:00' },
  { dayOfWeek: 5, openTime: '10:00', closeTime: '18:00' },
];

const emptyEmployeeForm: EmployeeFormState = {
  name: '',
  role: '',
  bio: '',
  initials: '',
  accent: '#B86B45',
  photoUrl: '',
  schedule: defaultEmployeeSchedule,
};

function employeeToForm(stylist: Stylist): EmployeeFormState {
  return {
    name: stylist.name,
    role: stylist.role,
    bio: stylist.bio,
    initials: stylist.initials,
    accent: stylist.accent,
    photoUrl: stylist.photoUrl ?? '',
    schedule: stylist.schedule,
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
    if (!EMPLOYEE_PHOTO_TYPES.has(file.type) || file.size > 5 * 1024 * 1024) {
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
      const upload = await requestUploadUrl({ name: file.name, size: file.size, contentType: file.type });
      await uploadFileToStorage(file, upload.uploadURL, (progress) => setPhotoUpload({ status: 'uploading', progress }));
      updateField('photoUrl', upload.objectPath);
      setPhotoUpload({ status: 'success', progress: 100 });
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
    };
    if (!data.name || !data.role || !data.bio || !data.initials || !data.accent) {
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
        <label className="text-xs font-semibold">{t('initials')}
          <input required maxLength={5} value={form.initials} onChange={(event) => updateField('initials', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal uppercase" data-testid="input-employee-initials" />
        </label>
        <label className="text-xs font-semibold">{t('accent')}
          <input required value={form.accent} onChange={(event) => updateField('accent', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-normal" data-testid="input-employee-accent" />
        </label>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold">{t('photoUpload')} <span className="font-normal text-[hsl(var(--muted-foreground))]">({t('optional')})</span></p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {photoPreview ? <img src={photoPreview} alt={t('profilePhoto')} className="h-16 w-16 rounded-full object-cover" onError={() => setPhotoPreview(undefined)} /> : <span className="grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--secondary))] font-display text-lg text-[hsl(var(--card))]">{form.initials || '?'}</span>}
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = ''; }} data-testid="input-employee-photo" />
            <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUpload.status === 'uploading'} className="rounded-full border border-[hsl(var(--border))] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] hover:border-[hsl(var(--primary))] disabled:opacity-60" data-testid="button-choose-employee-photo">{photoPreview ? t('replacePhoto') : t('choosePhoto')}</button>
            {photoPreview && <button type="button" onClick={clearPhoto} disabled={photoUpload.status === 'uploading'} className="rounded-full border border-[hsl(var(--destructive)/.35)] px-4 py-2.5 text-[11px] font-bold tracking-[.08em] text-[hsl(var(--destructive))] disabled:opacity-60" data-testid="button-remove-employee-photo">{t('removePhoto')}</button>}
          </div>
          <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{t('photoUploadHint')}</p>
          {photoUpload.status === 'uploading' && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]" aria-label={`${t('uploading')} ${photoUpload.progress}%`}><div className="h-full bg-[hsl(var(--primary))] transition-all" style={{ width: `${photoUpload.progress}%` }} /></div>}
        </div>
        <label className="text-xs font-semibold sm:col-span-2">{t('description')}
          <textarea required value={form.bio} onChange={(event) => updateField('bio', event.target.value)} rows={3} className="mt-2 w-full resize-y rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-3 text-sm font-normal" data-testid="input-employee-bio" />
        </label>
      </div>
      <div className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{t('workingSchedule')}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('scheduleIntro')}</p></div>
        </div>
        <ScheduleFields schedule={form.schedule} onChange={(schedule) => updateField('schedule', schedule)} idPrefix={stylist ? String(stylist.id) : 'new'} />
      </div>
      {feedback && <p className="mt-4 text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-employee-error">{feedback}</p>}
      <button type="submit" disabled={isPending || photoUpload.status === 'uploading'} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-[11px] font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))] disabled:opacity-60" data-testid="button-save-employee">
        {isPending ? t('saving') : t('saveEmployee')} <Check size={14} />
      </button>
    </form>
  );
}
