import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import type { Service, Stylist } from '@workspace/api-client-react';

export type Locale = 'en' | 'ar';

type MessageKey =
  | 'theSalon' | 'bookVisit' | 'yourAppointments' | 'reserveChair' | 'closeMenu' | 'openMenu'
  | 'findUs' | 'stayInTouch' | 'dailyHours' | 'managerWorkspace' | 'managerWorkspaceShort'
  | 'salonDescription' | 'goodHairFeeling' | 'findYourTime' | 'exploreServices' | 'guestNotes'
  | 'khalifaCity' | 'sundayOpen' | 'theMenu' | 'littleRitual' | 'serviceIntro'
  | 'makeItYours' | 'yourChairWaiting' | 'chooseServicePerson' | 'bookAppointment'
  | 'thePeople' | 'goodHands' | 'peopleIntro' | 'studioStatus' | 'checking' | 'available'
  | 'serviceMenu' | 'rituals' | 'serviceIntroManager' | 'addService' | 'noServices'
  | 'featured' | 'editService' | 'newService' | 'addToMenu' | 'cancel' | 'name'
  | 'category' | 'description' | 'price' | 'duration' | 'minutes' | 'hairBeardSignature'
  | 'showFeatured' | 'durationControls' | 'saving' | 'saveChanges' | 'saveSchedule'
   | 'scheduleSaved' | 'scheduleError' | 'openingBeforeClosing' | 'scheduleOverlap'
   | 'breaks' | 'addBreak' | 'removeBreak' | 'breakStart' | 'breakEnd' | 'noBreaks'
   | 'breakBeforeEnd' | 'breakOutsideHours' | 'breakOverlap'
  | 'open' | 'close' | 'dayOff' | 'scheduleIntro' | 'noEmployees' | 'signOut'
  | 'reserveYourChair' | 'goodHourStarts' | 'bookingIntro' | 'employee' | 'service'
  | 'dateTime' | 'details' | 'choosePerson' | 'whoSee' | 'teamOnWay' | 'chooseService'
  | 'whatDoing' | 'menuRefreshing' | 'mostLoved' | 'findTime' | 'whenFeelsRight'
  | 'timeIntro' | 'noOpenTimes' | 'chooseAnotherDate' | 'yourDetails' | 'sendNote'
  | 'fullName' | 'emailAddress' | 'phoneNumber' | 'anythingKnow' | 'notesPlaceholder'
  | 'continue' | 'back' | 'holdingChair' | 'confirmAppointment' | 'bookingTaken'
  | 'yourVisit' | 'selectService' | 'ritualBegins' | 'stylistToChoose' | 'dateToChoose'
  | 'noPayment' | 'confirmationInbox' | 'inTheBooks' | 'seeYouSoon' | 'confirmationSent'
  | 'viewAppointments' | 'yourVisits' | 'goodTimes' | 'lookupIntro' | 'lookupPlaceholder'
  | 'findVisits' | 'appointments' | 'nothingBooked' | 'readyHere' | 'bookAVisit'
  | 'managerSignInTitle' | 'managerSignInIntro' | 'signIn' | 'notReachStudio'
  | 'tryAgain' | 'errorRequired' | 'errorDuration' | 'errorPrice' | 'serviceSaved'
  | 'serviceAdded' | 'serviceUpdated' | 'serviceSaveError' | 'noManagedServices'
  | 'signInLoading' | 'confirmed' | 'pending' | 'cancelled' | 'collapseDetails' | 'expandDetails'
  | 'language' | 'heroTitle' | 'locationLine' | 'featuredEmpty'
   | 'editName' | 'employeeName' | 'saveName' | 'nameSaved' | 'nameRequired' | 'nameError'
   | 'deleteService' | 'confirmDeleteService' | 'deleteServiceWarning' | 'confirmDelete'
   | 'serviceDeleted' | 'serviceDeleteError' | 'serviceDeleteConflict';

const messages: Record<Locale, Record<MessageKey, string>> = {
  en: {
    theSalon: 'The salon', bookVisit: 'Book a visit', yourAppointments: 'Your appointments',
    reserveChair: 'Reserve a chair', closeMenu: 'Close menu', openMenu: 'Open menu',
    findUs: 'Find us', stayInTouch: 'Stay in touch', dailyHours: 'Daily · 11:00–22:00',
    managerWorkspace: 'Manager workspace', managerWorkspaceShort: 'Manager',
    salonDescription: 'A considered cut, a warm welcome, and a little time that belongs entirely to you.',
    goodHairFeeling: 'Good hair is a feeling.', findYourTime: 'Find your time',
    exploreServices: 'Explore services', guestNotes: 'guest notes', khalifaCity: 'Khalifa City · Abu Dhabi',
    sundayOpen: 'Sunday open until 11 PM', theMenu: 'The menu', littleRitual: 'A little ritual.',
    serviceIntro: 'Every service starts with a conversation, and ends with you feeling like yourself — only more so.',
    makeItYours: 'Make it yours', yourChairWaiting: 'Your chair is waiting.',
    chooseServicePerson: 'Choose a service, choose your person, then let us take care of the rest.',
    bookAppointment: 'Book an appointment', thePeople: 'The people', goodHands: 'Good hands.',
    peopleIntro: 'Not just stylists. Observant, curious people who know the difference a good detail makes.',
    studioStatus: 'STUDIO STATUS', checking: 'CHECKING', available: 'AVAILABLE',
    serviceMenu: 'Service menu', rituals: 'The rituals.',
    serviceIntroManager: 'Update the details guests see and the time each service needs.',
    addService: 'Add service', noServices: 'No services yet. Add the first ritual to your menu.',
    featured: 'Featured', editService: 'Edit service', newService: 'New service',
    addToMenu: 'Add to the menu', cancel: 'Cancel', name: 'Name', category: 'Category',
    description: 'Description', price: 'Price', duration: 'Duration', minutes: 'minutes',
    hairBeardSignature: 'Hair, Beard, Signature…', showFeatured: 'Show in featured menu',
    durationControls: 'Duration controls the available booking times.', saving: 'Saving…',
    saveChanges: 'Save changes', saveSchedule: 'Save schedule', scheduleSaved: 'schedule is saved.',
    scheduleError: 'We could not save this schedule. Check the hours and try again.',
    openingBeforeClosing: 'Each opening time must be earlier than its closing time.',
     scheduleOverlap: 'Working hours cannot overlap on the same day.', open: 'Open', close: 'Close',
     breaks: 'Breaks', addBreak: 'Add break', removeBreak: 'Remove break', breakStart: 'Start',
     breakEnd: 'End', noBreaks: 'No recurring breaks', breakBeforeEnd: 'Each break must start before it ends.',
     breakOutsideHours: 'Breaks must fall within working hours.', breakOverlap: 'Breaks cannot overlap on the same day.',
     dayOff: 'Day off', scheduleIntro: 'Booking times are offered every 90 minutes. Services that overlap a recurring break or closing time are blocked.',
    noEmployees: 'No employees are available to schedule.', signOut: 'Sign out',
    reserveYourChair: 'Reserve your chair', goodHourStarts: 'A good hour starts here.',
    bookingIntro: 'Choose your person, then your ritual. We will show times that fit their schedule.',
    employee: 'Employee', service: 'Service', dateTime: 'Date & time', details: 'Details',
    choosePerson: 'Choose your person', whoSee: 'Who would you like to see?',
    teamOnWay: 'Our team profiles are on their way.', chooseService: 'Choose a service',
    whatDoing: 'What are we doing today?', menuRefreshing: 'Our service menu is being refreshed. Please check back shortly.',
    mostLoved: 'Most loved', findTime: 'Find your time', whenFeelsRight: 'When feels right for',
    timeIntro: 'Choose a date to see only the times this employee is scheduled to work.',
    noOpenTimes: 'No open times for', chooseAnotherDate: 'on this date. Choose another date from their schedule.',
    yourDetails: 'Your details', sendNote: 'Where should we send the note?', fullName: 'Full name',
    emailAddress: 'Email address', phoneNumber: 'Phone number', anythingKnow: 'Anything we should know?',
    notesPlaceholder: 'A preference, a question, or simply hello.', continue: 'Continue', back: 'Back',
    holdingChair: 'Holding your chair…', confirmAppointment: 'Confirm appointment',
    bookingTaken: 'That time was just taken. Please go back and choose another.',
    yourVisit: 'Your visit', selectService: 'Select a service', ritualBegins: 'Your ritual begins with a choice.',
    stylistToChoose: 'Stylist to be chosen', dateToChoose: 'Date to be chosen',
    noPayment: 'No payment required. We will send a gentle confirmation to your inbox.',
    confirmationInbox: 'A confirmation is headed to', inTheBooks: 'It is in the books',
    seeYouSoon: 'See you soon.', confirmationSent: 'We have kept a chair for you.',
    viewAppointments: 'View your appointments', yourVisits: 'Your visits', goodTimes: 'Keep the good times.',
    lookupIntro: 'Enter the email you used when booking and we will bring up your salon notes.',
    lookupPlaceholder: 'you@example.com', findVisits: 'Find my visits', appointments: 'Your appointments',
    nothingBooked: 'Nothing booked yet.', readyHere: 'When you are ready, we will be here.',
    bookAVisit: 'Book a visit', managerSignInTitle: 'Sign in to keep chairs ready.',
    managerSignInIntro: 'This workspace is reserved for the salon team. Sign in with your manager account to update services and employee schedules.',
    signIn: 'Sign in', notReachStudio: 'We could not reach the studio just now.', tryAgain: 'Try again',
    errorRequired: 'Name, description, category, price, and duration are required.',
    errorDuration: 'Duration must be a positive whole number of minutes.',
    errorPrice: 'Enter a valid price with no more than two decimal places.',
    serviceSaved: 'was saved.', serviceAdded: 'was added to the menu.', serviceUpdated: 'was updated.',
    serviceSaveError: 'We could not save this service. Check the details and try again.',
    noManagedServices: 'No services yet. Add the first ritual to your menu.',
    signInLoading: 'Loading manager workspace…',
    confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled',
    collapseDetails: 'Collapse details', expandDetails: 'Expand details',
    language: 'Language', heroTitle: 'The art of looking well.',
    locationLine: 'My City Centre Masdar · Abu Dhabi',
    featuredEmpty: 'Our service menu is being refreshed. Please check back shortly.',
    editName: 'Edit name', employeeName: 'Employee name', saveName: 'Save name',
    nameSaved: 'name is saved.', nameRequired: 'Enter an employee name.',
     nameError: 'We could not save that employee name.',
     deleteService: 'Delete', confirmDeleteService: 'Delete service?', deleteServiceWarning: 'This action cannot be undone.',
     confirmDelete: 'Confirm delete', serviceDeleted: 'was removed from the menu.',
     serviceDeleteError: 'We could not delete this service. Try again.', serviceDeleteConflict: 'This service cannot be deleted because it has existing appointments.',
  },
  ar: {
    theSalon: 'الصالون', bookVisit: 'احجز زيارة', yourAppointments: 'مواعيدك',
    reserveChair: 'احجز مقعداً', closeMenu: 'إغلاق القائمة', openMenu: 'فتح القائمة',
    findUs: 'موقعنا', stayInTouch: 'تواصل معنا', dailyHours: 'يومياً · 11:00–22:00',
    managerWorkspace: 'مساحة الإدارة', managerWorkspaceShort: 'الإدارة',
    salonDescription: 'قصة شعر متقنة، ترحيب دافئ، ووقت قصير لك وحدك.',
    goodHairFeeling: 'الشعر الجميل إحساس.', findYourTime: 'اعثر على وقتك',
    exploreServices: 'استكشف الخدمات', guestNotes: 'ملاحظة من الضيوف', khalifaCity: 'مدينة خليفة · أبوظبي',
    sundayOpen: 'مفتوح الأحد حتى 11 مساءً', theMenu: 'قائمة الخدمات', littleRitual: 'طقس صغير.',
    serviceIntro: 'كل خدمة تبدأ بحوار وتنتهي بشعور يشبهك — لكن بصورة أجمل.',
    makeItYours: 'اجعلها تجربتك', yourChairWaiting: 'مقعدك بانتظارك.',
    chooseServicePerson: 'اختر خدمتك وشخصك، ودع الباقي علينا.',
    bookAppointment: 'احجز موعداً', thePeople: 'فريقنا', goodHands: 'أيادٍ خبيرة.',
    peopleIntro: 'ليسوا مصففي شعر فحسب، بل أشخاص يلاحظون التفاصيل ويعرفون أثرها.',
    studioStatus: 'حالة الاستوديو', checking: 'جارٍ التحقق', available: 'متاح',
    serviceMenu: 'قائمة الخدمات', rituals: 'الطقوس.',
    serviceIntroManager: 'حدّث التفاصيل التي يراها الضيوف والوقت الذي تحتاجه كل خدمة.',
    addService: 'إضافة خدمة', noServices: 'لا توجد خدمات بعد. أضف أول طقس إلى قائمتك.',
    featured: 'مميزة', editService: 'تعديل الخدمة', newService: 'خدمة جديدة',
    addToMenu: 'إضافة إلى القائمة', cancel: 'إلغاء', name: 'الاسم', category: 'الفئة',
    description: 'الوصف', price: 'السعر', duration: 'المدة', minutes: 'دقيقة',
    hairBeardSignature: 'شعر، لحية، مميزة…', showFeatured: 'إظهار في القائمة المميزة',
    durationControls: 'تتحكم المدة في أوقات الحجز المتاحة.', saving: 'جارٍ الحفظ…',
    saveChanges: 'حفظ التغييرات', saveSchedule: 'حفظ الجدول', scheduleSaved: 'تم حفظ الجدول.',
    scheduleError: 'تعذر حفظ هذا الجدول. تحقق من الساعات وحاول مرة أخرى.',
    openingBeforeClosing: 'يجب أن يسبق وقت الفتح وقت الإغلاق.',
     scheduleOverlap: 'لا يمكن تداخل ساعات العمل في اليوم نفسه.', open: 'فتح', close: 'إغلاق',
     breaks: 'الاستراحات', addBreak: 'إضافة استراحة', removeBreak: 'إزالة الاستراحة', breakStart: 'البداية',
     breakEnd: 'النهاية', noBreaks: 'لا توجد استراحات متكررة', breakBeforeEnd: 'يجب أن يسبق وقت بداية الاستراحة وقت نهايتها.',
     breakOutsideHours: 'يجب أن تقع الاستراحات ضمن ساعات العمل.', breakOverlap: 'لا يمكن تداخل الاستراحات في اليوم نفسه.',
     dayOff: 'إجازة', scheduleIntro: 'تتوفر أوقات الحجز كل 90 دقيقة. تُحجب الخدمات التي تتداخل مع استراحة متكررة أو وقت الإغلاق.',
    noEmployees: 'لا يوجد موظفون متاحون للجدولة.', signOut: 'تسجيل الخروج',
    reserveYourChair: 'احجز مقعدك', goodHourStarts: 'ساعة جميلة تبدأ من هنا.',
    bookingIntro: 'اختر الشخص ثم طقسك المفضل. سنعرض الأوقات التي تناسب جدوله.',
    employee: 'الموظف', service: 'الخدمة', dateTime: 'التاريخ والوقت', details: 'التفاصيل',
    choosePerson: 'اختر شخصك', whoSee: 'من تود أن يقص شعرك؟',
    teamOnWay: 'ملفات فريقنا ستتوفر قريباً.', chooseService: 'اختر خدمة',
    whatDoing: 'ماذا سنفعل اليوم؟', menuRefreshing: 'نحدّث قائمة الخدمات حالياً. يرجى العودة قريباً.',
    mostLoved: 'الأكثر طلباً', findTime: 'اعثر على وقت', whenFeelsRight: 'ما الوقت المناسب لك مع',
    timeIntro: 'اختر تاريخاً لرؤية الأوقات التي يعمل فيها هذا الموظف فقط.',
    noOpenTimes: 'لا توجد أوقات متاحة لـ', chooseAnotherDate: 'في هذا التاريخ. اختر تاريخاً آخر من جدوله.',
    yourDetails: 'بياناتك', sendNote: 'إلى أين نرسل التأكيد؟', fullName: 'الاسم الكامل',
    emailAddress: 'البريد الإلكتروني', phoneNumber: 'رقم الهاتف', anythingKnow: 'هل هناك شيء نعرفه؟',
    notesPlaceholder: 'تفضيل، سؤال، أو مجرد تحية.', continue: 'متابعة', back: 'رجوع',
    holdingChair: 'نحجز مقعدك…', confirmAppointment: 'تأكيد الموعد',
    bookingTaken: 'تم حجز هذا الوقت للتو. ارجع واختر وقتاً آخر.',
    yourVisit: 'زيارتك', selectService: 'اختر خدمة', ritualBegins: 'تبدأ تجربتك باختيارك.',
    stylistToChoose: 'المصفف لم يُختر بعد', dateToChoose: 'التاريخ لم يُختر بعد',
    noPayment: 'لا حاجة للدفع. سنرسل تأكيداً لطيفاً إلى بريدك.',
    confirmationInbox: 'سيرسل التأكيد إلى', inTheBooks: 'تم تسجيل الموعد',
    seeYouSoon: 'نراك قريباً.', confirmationSent: 'احتفظنا بمقعد لك.',
    viewAppointments: 'عرض مواعيدك', yourVisits: 'زياراتك', goodTimes: 'احتفظ بالأوقات الجميلة.',
    lookupIntro: 'أدخل البريد الذي استخدمته للحجز وسنعرض ملاحظاتك في الصالون.',
    lookupPlaceholder: 'you@example.com', findVisits: 'اعثر على مواعيدي', appointments: 'مواعيدك',
    nothingBooked: 'لا توجد حجوزات بعد.', readyHere: 'سنكون هنا عندما تكون مستعداً.',
    bookAVisit: 'احجز زيارة', managerSignInTitle: 'سجّل الدخول لإبقاء المقاعد جاهزة.',
    managerSignInIntro: 'هذه المساحة مخصصة لفريق الصالون. سجّل الدخول بحساب الإدارة لتحديث الخدمات وجداول الموظفين.',
    signIn: 'تسجيل الدخول', notReachStudio: 'تعذر الوصول إلى الاستوديو الآن.', tryAgain: 'حاول مجدداً',
    errorRequired: 'الاسم والوصف والفئة والسعر والمدة مطلوبة.',
    errorDuration: 'يجب أن تكون المدة رقماً صحيحاً موجباً بالدقائق.',
    errorPrice: 'أدخل سعراً صحيحاً بحد أقصى منزلتين عشريتين.',
    serviceSaved: 'تم حفظها.', serviceAdded: 'تمت إضافتها إلى القائمة.', serviceUpdated: 'تم تحديثها.',
    serviceSaveError: 'تعذر حفظ الخدمة. تحقق من التفاصيل وحاول مرة أخرى.',
    noManagedServices: 'لا توجد خدمات بعد. أضف أول طقس إلى قائمتك.',
    signInLoading: 'جارٍ تحميل مساحة الإدارة…',
    confirmed: 'مؤكد', pending: 'قيد الانتظار', cancelled: 'ملغى',
    collapseDetails: 'طي التفاصيل', expandDetails: 'توسيع التفاصيل',
    language: 'اللغة', heroTitle: 'فنّ الظهور بأجمل صورة.',
    locationLine: 'ماي سيتي سنتر مصدر · أبوظبي',
    featuredEmpty: 'نحدّث قائمة الخدمات حالياً. يرجى العودة قريباً.',
    editName: 'تعديل الاسم', employeeName: 'اسم الموظف', saveName: 'حفظ الاسم',
    nameSaved: 'تم حفظ الاسم.', nameRequired: 'أدخل اسم الموظف.',
     nameError: 'تعذّر حفظ اسم الموظف.',
     deleteService: 'حذف', confirmDeleteService: 'حذف الخدمة؟', deleteServiceWarning: 'لا يمكن التراجع عن هذا الإجراء.',
     confirmDelete: 'تأكيد الحذف', serviceDeleted: 'تمت إزالتها من القائمة.',
     serviceDeleteError: 'تعذر حذف الخدمة. حاول مرة أخرى.', serviceDeleteConflict: 'لا يمكن حذف هذه الخدمة لوجود مواعيد مرتبطة بها.',
  },
};

const serviceTranslations: Record<string, { name: string; description: string; category: string }> = {
  'Signature Cut': { name: 'قصة مميزة', description: 'قصة مصممة لك، مع منشفة دافئة وجلسة تصفيف.', category: 'شعر' },
  'Texture & Finish': { name: 'ملمس وتصفيف', description: 'تشكيل وملمس ولمسة نهائية متقنة لإطلالتك الخاصة.', category: 'شعر' },
  'Beard Ritual': { name: 'طقس اللحية', description: 'تحديد دقيق، منشفة دافئة، وعلاج ترطيب.', category: 'لحية' },
  'The CT Style': { name: 'إطلالة CT', description: 'التجربة الكاملة: قصة وطقس لحية ولمسة نهائية.', category: 'مميزة' },
};

const stylistTranslations: Record<string, { role: string; bio: string }> = {
  Marco: { role: 'حلاق أول', bio: 'معروف بالخطوط النظيفة والملمس العصري وطقس هادئ على الكرسي.' },
  Aisha: { role: 'مديرة إطلالات', bio: 'تصنع شكلاً بسيطاً مع لمسة خاصة بالتفاصيل الجريئة.' },
  Daniel: { role: 'حلاق محترف', bio: 'يهتم بأدق التفاصيل ويجعل العناية الكلاسيكية خاصة بك تماماً.' },
};

const context = createContext<LocaleContextValue | null>(null);

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
  formatPrice: (value: number | string) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  serviceCopy: (service: Service) => Service;
  stylistCopy: (stylist: Stylist) => Stylist;
  translateServiceName: (name: string) => string;
  statusLabel: (status: string) => string;
  weekday: (day: Date, short?: boolean) => string;
};

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'en';
    return window.localStorage.getItem('ct-style-locale') === 'ar' ? 'ar' : 'en';
  });

  useEffect(() => {
    window.localStorage.setItem('ct-style-locale', locale);
    document.documentElement.lang = locale === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const intlLocale = locale === 'ar' ? 'ar-AE' : 'en-AE';
    return {
      locale,
      setLocale,
      t: (key) => messages[locale][key],
      formatPrice: (value) => new Intl.NumberFormat(intlLocale, {
        style: 'currency', currency: 'AED', minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(Number(value)),
      formatDate: (value, options) => new Intl.DateTimeFormat(intlLocale, options).format(
        typeof value === 'string' ? new Date(`${value}T12:00:00`) : value,
      ),
      weekday: (day, short = true) => day.toLocaleDateString(intlLocale, { weekday: short ? 'short' : 'long' }),
      serviceCopy: (service) => {
        if (locale === 'en') return service;
        const translated = serviceTranslations[service.name];
        return translated ? { ...service, ...translated } : service;
      },
      stylistCopy: (stylist) => {
        if (locale === 'en') return stylist;
        const translated = stylistTranslations[stylist.name];
        return translated ? { ...stylist, ...translated } : stylist;
      },
      translateServiceName: (name) => locale === 'ar' ? (serviceTranslations[name]?.name ?? name) : name,
      statusLabel: (status) => {
        const key = status.toLowerCase() as 'confirmed' | 'pending' | 'cancelled';
        return ['confirmed', 'pending', 'cancelled'].includes(key) ? messages[locale][key] : status;
      },
    };
  }, [locale]);

  return createElement(context.Provider, { value }, children);
}

export function useLocale() {
  const value = useContext(context);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}