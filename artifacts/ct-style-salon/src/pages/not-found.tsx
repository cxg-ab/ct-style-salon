import { Link } from 'wouter';
import { useLocale } from '@/lib/locale';

export default function NotFound() {
  const { t } = useLocale();
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-[760px] items-center px-5 py-16 sm:px-8">
      <div className="w-full rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 sm:p-12">
        <p className="font-mono-ui text-[10px] uppercase tracking-[.24em] text-[hsl(var(--primary))]">404</p>
        <h1 className="mt-4 font-display text-5xl leading-[.88] sm:text-7xl">{t('pageNotFound')}</h1>
        <p className="mt-6 max-w-md text-base leading-7 text-[hsl(var(--muted-foreground))]">{t('pageNotFoundIntro')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex items-center rounded-full bg-[hsl(var(--primary))] px-6 py-4 text-xs font-bold tracking-[.1em] text-[hsl(var(--primary-foreground))]">{t('backToSalon')}</Link>
          <Link href="/book" className="inline-flex items-center rounded-full border border-[hsl(var(--border))] px-6 py-4 text-xs font-bold tracking-[.1em]">{t('bookAVisit')}</Link>
        </div>
      </div>
    </main>
  );
}
