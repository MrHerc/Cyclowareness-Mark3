/**
 * Phishing simulation templates (the original twelve, docs/audit/03-admin-panel.md §4).
 * All brands and senders are fictional. Text is per language; the tracking link is added at send time.
 */

export type Channel = "email" | "sms" | "voice" | "usb";
export type L10n = { az: string; en: string; ru: string };

export type CampaignTemplate = {
  key: string;
  channel: Channel;
  difficulty: "Easy" | "Medium" | "Hard";
  /** Module learners land on after the teachable moment. */
  moduleSlug: string;
  /** Asks for a password on the landing page (only a flag is recorded, never the input). */
  harvest: boolean;
  qr?: boolean;
  name: L10n;
  sender: { name: L10n; address: string };
  subject: L10n;
  body: L10n;
  cta?: L10n;
  attachment?: { name: L10n; size: L10n };
  /** What gave it away: shown on the teachable-moment page. */
  redFlags: L10n[];
};

const l = (az: string, en: string, ru: string): L10n => ({ az, en, ru });

export const TEMPLATES: CampaignTemplate[] = [
  {
    key: "payslip",
    channel: "email",
    difficulty: "Easy",
    moduleSlug: "phishing-email",
    harvest: true,
    name: l("Sentyabr maaş vərəqəsi", "September payslip", "Расчётный лист за сентябрь"),
    sender: { name: l("Mühasibatlıq", "Accounting", "Бухгалтерия"), address: "muhasibat@xidmetagentIiyi.az" },
    subject: l("Sentyabr ayı üzrə maaş vərəqəniz hazırdır", "Your September payslip is ready", "Ваш расчётный лист за сентябрь готов"),
    body: l(
      "Hörmətli əməkdaş,\n\nSentyabr ayı üzrə maaş vərəqəniz portalda yerləşdirilib. Məbləğdə dəyişiklik olduğu üçün bu gün ərzində baxıb təsdiq etməyiniz xahiş olunur.\n\nHörmətlə,\nMühasibatlıq",
      "Dear colleague,\n\nYour September payslip has been published. The amount has changed, so please review and confirm it today.\n\nKind regards,\nAccounting",
      "Уважаемый сотрудник,\n\nВаш расчётный лист за сентябрь опубликован. Сумма изменилась, поэтому просим просмотреть и подтвердить его сегодня.\n\nС уважением,\nБухгалтерия",
    ),
    cta: l("Maaş vərəqəsinə baxın", "View payslip", "Открыть расчётный лист"),
    redFlags: [
      l("Ünvanda «agentlik» sözündə kiçik «l» əvəzinə böyük latın «I» hərfi var.", "The address uses a capital Latin “I” instead of a lowercase “l”.", "В адресе вместо строчной «l» стоит заглавная латинская «I»."),
      l("Bu gün təsdiq etmək tələbi tələsdirmək üçündür.", "“Confirm today” is there to rush you.", "«Подтвердите сегодня» — попытка вас поторопить."),
      l("Maaş vərəqəsi heç vaxt parol tələb edən kənar səhifədə açılmır.", "Payslips never open on an outside page that asks for your password.", "Расчётные листы не открываются на внешних страницах с запросом пароля."),
    ],
  },
  {
    key: "fine",
    channel: "email",
    difficulty: "Easy",
    moduleSlug: "authority-scams",
    harvest: false,
    name: l("Ödənilməmiş cərimə: son xəbərdarlıq", "Unpaid fine: final notice", "Неоплаченный штраф: последнее уведомление"),
    sender: { name: l("E-Xidmət Portalı", "E-Xidmet Portal", "Портал E-Xidmet"), address: "bildiris@e-xidmet-portal.info" },
    subject: l("Son xəbərdarlıq: 40 AZN cərimə ödənilməyib", "Final notice: 40 AZN fine unpaid", "Последнее уведомление: штраф 40 AZN не оплачен"),
    body: l(
      "Hörmətli vətəndaş,\n\nAdınıza 40 AZN məbləğində ödənilməmiş cərimə var. 48 saat ərzində ödənilmədikdə məbləğ iki qat artırılacaq və iş məhkəməyə göndəriləcək.",
      "Dear citizen,\n\nThere is an unpaid fine of 40 AZN in your name. If it is not paid within 48 hours, the amount will double and the case will go to court.",
      "Уважаемый гражданин,\n\nНа ваше имя числится неоплаченный штраф 40 AZN. Если он не будет оплачен в течение 48 часов, сумма удвоится, а дело передадут в суд.",
    ),
    cta: l("Cəriməni ödəyin", "Pay the fine", "Оплатить штраф"),
    redFlags: [
      l("Dövlət xidmətləri .info domenindən yazmır.", "Government services do not write from a .info domain.", "Госуслуги не пишут с домена .info."),
      l("Məhkəmə hədəsi və 48 saat — qorxutmaq üçündür.", "Court threats and a 48-hour deadline are meant to scare you.", "Угроза судом и срок 48 часов — давление страхом."),
      l("Cərimələri yalnız rəsmi portalda özünüz yoxlayın.", "Check fines yourself, only on the official portal.", "Проверяйте штрафы сами, только на официальном портале."),
    ],
  },
  {
    key: "invoice",
    channel: "email",
    difficulty: "Medium",
    moduleSlug: "dangerous-attachments",
    harvest: false,
    name: l("Gecikmiş faktura", "Overdue invoice", "Просроченный счёт"),
    sender: { name: l("OfisTəchizat MMC", "OfisTechizat LLC", "ООО OfisTechizat"), address: "hesab@ofistechizat-az.com" },
    subject: l("Faktura №0925 — ödəniş gecikir", "Invoice #0925 is overdue", "Счёт №0925 просрочен"),
    body: l(
      "Salam,\n\nƏlavədə sentyabr ayı üzrə faktura var. Ödəniş 5 gün gecikir. Faylı açıb «Məzmunu aktivləşdirin» düyməsinə basın, məbləğ görünəcək.",
      "Hello,\n\nPlease find the September invoice attached. Payment is 5 days late. Open the file and click “Enable content” to see the amount.",
      "Здравствуйте,\n\nВо вложении счёт за сентябрь. Оплата просрочена на 5 дней. Откройте файл и нажмите «Включить содержимое», чтобы увидеть сумму.",
    ),
    attachment: { name: l("Faktura_0925.pdf.zip", "Invoice_0925.pdf.zip", "Счёт_0925.pdf.zip"), size: l("312 KB", "312 KB", "312 КБ") },
    redFlags: [
      l("«.pdf.zip» — ikiqat uzantı: içində sənəd yox, arxiv var.", "“.pdf.zip” is a double extension: it is an archive, not a document.", "«.pdf.zip» — двойное расширение: это архив, а не документ."),
      l("«Məzmunu aktivləşdirin» makrosu işə salır.", "“Enable content” runs macros.", "«Включить содержимое» запускает макросы."),
      l("Təchizatçının ünvanı adi domendən fərqlidir.", "The supplier’s address differs from its usual domain.", "Адрес поставщика отличается от обычного домена."),
    ],
  },
  {
    key: "mfa-qr",
    channel: "email",
    difficulty: "Medium",
    moduleSlug: "quishing",
    harvest: true,
    qr: true,
    name: l("İki addımlı doğrulamanın yenilənməsi (QR)", "Two-step verification renewal (QR)", "Обновление двухэтапной проверки (QR)"),
    sender: { name: l("İT Dəstək", "IT Support", "ИТ-поддержка"), address: "it-destek@rxagentlik-support.info" },
    subject: l("İki addımlı giriş bu gün bitir — QR kodu skan edin", "Two-step sign-in expires today — scan the QR code", "Двухэтапный вход истекает сегодня — отсканируйте QR-код"),
    body: l(
      "Hörmətli istifadəçi,\n\nTəhlükəsizlik siyasətinə görə iki addımlı girişinizi yeniləməlisiniz. Telefonunuzla aşağıdakı QR kodu skan edin və iş hesabınızla daxil olun.",
      "Dear user,\n\nOur security policy requires you to renew two-step sign-in. Scan the QR code below with your phone and sign in with your work account.",
      "Уважаемый пользователь,\n\nПо политике безопасности нужно обновить двухэтапный вход. Отсканируйте QR-код ниже телефоном и войдите с рабочей учётной записью.",
    ),
    redFlags: [
      l("QR kod linki gizlədir: telefonda ünvanı yoxlamaq çətindir.", "A QR code hides the link: on a phone the address is hard to check.", "QR-код скрывает ссылку: на телефоне адрес сложно проверить."),
      l("İT heç vaxt iş parolunu QR ilə açılan səhifədə istəmir.", "IT never asks for your work password on a page opened from a QR code.", "ИТ никогда не просит рабочий пароль на странице из QR-кода."),
      l("Göndərənin domeni «-support.info»-dur, təşkilatın domeni deyil.", "The sender’s domain is “-support.info”, not your organisation’s.", "Домен отправителя «-support.info», а не домен организации."),
    ],
  },
  {
    key: "bank-details",
    channel: "email",
    difficulty: "Hard",
    moduleSlug: "vendor-email-compromise",
    harvest: false,
    name: l("Bank rekvizitlərinin dəyişməsi", "Changed bank details", "Смена банковских реквизитов"),
    sender: { name: l("OfisTəchizat MMC", "OfisTechizat LLC", "ООО OfisTechizat"), address: "maliyye@ofistechizat.az.co" },
    subject: l("Yeni bank rekvizitlərimiz", "Our new bank details", "Наши новые банковские реквизиты"),
    body: l(
      "Hörmətli tərəfdaş,\n\nAudit səbəbindən hesabımızı dəyişmişik. Növbəti ödənişi yeni IBAN-a köçürün: AZ21 NABZ 0000 0000 1370 1000 1944. Köhnə hesab bu həftə bağlanır. Zəhmət olmasa telefonla zəng etməyin, xətlərimiz yenilənir.",
      "Dear partner,\n\nFollowing an audit we have changed our account. Please send the next payment to the new IBAN: AZ21 NABZ 0000 0000 1370 1000 1944. The old account closes this week. Please do not call, our phone lines are being upgraded.",
      "Уважаемый партнёр,\n\nПосле аудита мы сменили счёт. Следующий платёж направьте на новый IBAN: AZ21 NABZ 0000 0000 1370 1000 1944. Старый счёт закрывается на этой неделе. Пожалуйста, не звоните: телефонные линии обновляются.",
    ),
    redFlags: [
      l("Rekvizit dəyişikliyini həmişə məlum nömrəyə zəng edib yoxlayın.", "Always verify changed bank details by calling a number you already know.", "Всегда проверяйте смену реквизитов звонком по известному номеру."),
      l("«Zəng etməyin» xahişi yoxlamanın qarşısını almaq üçündür.", "“Please do not call” is there to stop you checking.", "Просьба «не звонить» мешает проверке."),
      l("Domen «.az.co» ilə bitir, «.az» ilə yox.", "The domain ends in “.az.co”, not “.az”.", "Домен заканчивается на «.az.co», а не «.az»."),
    ],
  },
  {
    key: "keynote",
    channel: "email",
    difficulty: "Hard",
    moduleSlug: "executive-threats",
    harvest: true,
    name: l("Konfransa məruzəçi dəvəti (rəhbərlər)", "Keynote invitation (executives)", "Приглашение выступить на конференции (руководители)"),
    sender: { name: l("Beynəlxalq Əməkdaşlıq Fondu", "International Cooperation Fund", "Фонд международного сотрудничества"), address: "events@intl-coopfund.org" },
    subject: l("Dəvət: Bakı Rəqəmsal Forumunda əsas məruzə", "Invitation: keynote at the Baku Digital Forum", "Приглашение: ключевой доклад на Бакинском цифровом форуме"),
    body: l(
      "Hörmətli cənab Həsənov,\n\nSizi forumun açılışında əsas məruzə ilə çıxış etməyə dəvət edirik. Proqram və təşkilati məlumatlar fond portalındadır. Zəhmət olmasa ofis hesabınızla daxil olub iştirakı təsdiqləyin.",
      "Dear Mr Hasanov,\n\nWe would be honoured to have you deliver the opening keynote at the forum. The programme and logistics are on the fund portal. Please sign in with your office account to confirm.",
      "Уважаемый господин Гасанов,\n\nПриглашаем вас выступить с ключевым докладом на открытии форума. Программа и организационные детали на портале фонда. Войдите с рабочей учётной записью, чтобы подтвердить участие.",
    ),
    cta: l("Proqrama baxın", "View the programme", "Открыть программу"),
    redFlags: [
      l("Şəxsi müraciət inam yaratmaq üçün açıq mənbələrdən götürülüb.", "The personal greeting was built from public sources to earn trust.", "Личное обращение собрано из открытых источников, чтобы вызвать доверие."),
      l("Kənar portal iş hesabınızın parolunu istəyir.", "An outside portal asks for your work password.", "Внешний портал просит пароль от рабочей учётной записи."),
      l("Dəvəti köməkçiniz və ya təşkilatçının rəsmi əlaqəsi ilə yoxlayın.", "Verify the invitation through your assistant or the organiser’s official contact.", "Проверьте приглашение через помощника или официальный контакт организатора."),
    ],
  },
  {
    key: "parcel-sms",
    channel: "sms",
    difficulty: "Easy",
    moduleSlug: "social-engineering",
    harvest: false,
    name: l("Bağlama çatdırılması SMS", "Parcel delivery SMS", "SMS о доставке посылки"),
    sender: { name: l("SuretKargo", "SuretKargo", "SuretKargo"), address: "SuretKargo" },
    subject: l("Bağlama", "Parcel", "Посылка"),
    body: l(
      "SuretKargo: Bağlamanız ünvan natamam olduğu üçün saxlanılıb. 1.20 AZN ödəyib çatdırılmanı yenidən planlaşdırın:",
      "SuretKargo: Your parcel is on hold because the address is incomplete. Pay 1.20 AZN to reschedule delivery:",
      "SuretKargo: Ваша посылка задержана из-за неполного адреса. Оплатите 1.20 AZN, чтобы перенести доставку:",
    ),
    redFlags: [
      l("Kiçik məbləğ kart məlumatlarını almaq üçün yemdir.", "The small fee is bait to get your card details.", "Небольшая сумма — приманка, чтобы получить данные карты."),
      l("Gözləmədiyiniz bağlama barədə SMS-ə inanmayın.", "Do not trust a text about a parcel you were not expecting.", "Не доверяйте SMS о посылке, которую вы не ждали."),
      l("Statusu kuryerin rəsmi tətbiqində özünüz yoxlayın.", "Check the status yourself in the courier’s official app.", "Проверьте статус сами в официальном приложении службы."),
    ],
  },
  {
    key: "prize-sms",
    channel: "sms",
    difficulty: "Medium",
    moduleSlug: "online-shopping-scams",
    harvest: false,
    name: l("Uduş SMS-i", "Prize winner SMS", "SMS о выигрыше"),
    sender: { name: l("BonusAz", "BonusAz", "BonusAz"), address: "BonusAz" },
    subject: l("Uduş", "Prize", "Выигрыш"),
    body: l(
      "Təbriklər! Nömrəniz smartfon uduşu qazandı. Çatdırılma üçün 4.99 AZN ödəyin, təklif bu gün bitir:",
      "Congratulations! Your number won a smartphone. Pay 4.99 AZN for delivery, the offer ends today:",
      "Поздравляем! Ваш номер выиграл смартфон. Оплатите 4.99 AZN за доставку, предложение действует сегодня:",
    ),
    redFlags: [
      l("İştirak etmədiyiniz lotereyada udmaq mümkün deyil.", "You cannot win a draw you never entered.", "Нельзя выиграть в розыгрыше, в котором вы не участвовали."),
      l("«Bu gün bitir» tələsdirmək üçündür.", "“Ends today” is there to rush you.", "«Действует сегодня» — попытка поторопить."),
      l("Uduş üçün ödəniş tələb olunmur.", "Real prizes do not ask you to pay.", "Настоящие призы не требуют оплаты."),
    ],
  },
  {
    key: "bank-sms",
    channel: "sms",
    difficulty: "Medium",
    moduleSlug: "fake-payment-links",
    harvest: true,
    name: l("Bank xəbərdarlığı SMS-i", "Bank alert SMS", "SMS-оповещение банка"),
    sender: { name: l("UlduzBank", "UlduzBank", "UlduzBank"), address: "UlduzBank" },
    subject: l("Kart bloku", "Card block", "Блокировка карты"),
    body: l(
      "UlduzBank: Kartınızda şübhəli əməliyyat aşkarlandı və kart müvəqqəti bloklandı. Bloku açmaq üçün məlumatlarınızı təsdiqləyin:",
      "UlduzBank: Suspicious activity was detected and your card is temporarily blocked. Confirm your details to unblock it:",
      "UlduzBank: Обнаружена подозрительная операция, карта временно заблокирована. Подтвердите данные, чтобы разблокировать её:",
    ),
    redFlags: [
      l("Bank SMS-də link göndərib kart məlumatı istəmir.", "Banks do not text you a link that asks for card details.", "Банк не присылает ссылку с запросом данных карты."),
      l("Kartın arxasındakı nömrəyə özünüz zəng edin.", "Call the number on the back of your card yourself.", "Сами позвоните по номеру на обратной стороне карты."),
      l("Blok qorxusu sizi tez hərəkət etməyə məcbur edir.", "Fear of a block pushes you to act fast.", "Страх блокировки заставляет действовать быстро."),
    ],
  },
  {
    key: "tech-support-call",
    channel: "voice",
    difficulty: "Medium",
    moduleSlug: "tech-support-scams",
    harvest: false,
    name: l("Texniki dəstək zəngi", "Technical support call", "Звонок техподдержки"),
    sender: { name: l("«İT Dəstək»", "“IT Support”", "«ИТ-поддержка»"), address: "+994 12 000 33 44" },
    subject: l("Zəng", "Call", "Звонок"),
    body: l(
      "Salam, İT dəstəkdən zəng edirəm. Hesabınızda xəta görünür, düzəltmək üçün telefonunuza gələn kodu mənə deyin.",
      "Hi, this is IT support. We see an error on your account. Read me the code that just arrived on your phone so I can fix it.",
      "Здравствуйте, это ИТ-поддержка. На вашей учётной записи ошибка. Продиктуйте код, который пришёл вам на телефон, и я всё исправлю.",
    ),
    redFlags: [
      l("Heç kim, İT də daxil olmaqla, sizdən kod istəməməlidir.", "Nobody, IT included, should ever ask for your code.", "Никто, включая ИТ, не должен просить ваш код."),
      l("Zəngi bitirib İT-yə rəsmi nömrə ilə özünüz zəng edin.", "Hang up and call IT back on the official number.", "Положите трубку и перезвоните в ИТ по официальному номеру."),
    ],
  },
  {
    key: "ceo-deepfake",
    channel: "voice",
    difficulty: "Hard",
    moduleSlug: "deepfake-scams",
    harvest: false,
    name: l("Rəhbərin səsi ilə zəng (deepfake)", "Call in the boss's voice (deepfake)", "Звонок голосом руководителя (дипфейк)"),
    sender: { name: l("Kamran Babayev", "Kamran Babayev", "Камран Бабаев"), address: "+994 50 000 77 12" },
    subject: l("Zəng", "Call", "Звонок"),
    body: l(
      "Salam, Kamrandır. İclasdayam, danışa bilmirəm. Tərəfdaşa təcili köçürmə lazımdır, rekvizitləri indi mesajla göndərirəm. Heç kimə demə, sürpriz layihədir.",
      "Hi, it’s Kamran. I’m in a meeting and can’t talk. We need an urgent transfer to a partner, I’m texting the details now. Keep it quiet, it’s a surprise project.",
      "Привет, это Камран. Я на совещании, говорить не могу. Нужен срочный перевод партнёру, реквизиты пришлю сообщением. Никому не говори, это секретный проект.",
    ),
    redFlags: [
      l("Tanış səs sübut deyil: səsi süni intellektlə saxtalaşdırmaq olar.", "A familiar voice is not proof: AI can clone it.", "Знакомый голос — не доказательство: ИИ умеет его подделать."),
      l("Gizlilik və təcililik — fırıldağın əsas əlamətləridir.", "Secrecy plus urgency is the classic sign of fraud.", "Секретность и срочность — классические признаки мошенничества."),
      l("Köçürməni həmişə ikinci kanalla təsdiqləyin.", "Always confirm a transfer through a second channel.", "Всегда подтверждайте перевод по второму каналу."),
    ],
  },
  {
    key: "usb-parcel",
    channel: "usb",
    difficulty: "Medium",
    moduleSlug: "usb-media",
    harvest: false,
    name: l("Kuryer bağlaması və naməlum USB", "Courier parcel and unknown USB", "Посылка курьера и неизвестная флешка"),
    sender: { name: l("Direktorun yeni köməkçisi", "The director’s new assistant", "Новый помощник директора"), address: "+994 55 000 41 90" },
    subject: l("USB", "USB", "USB"),
    body: l(
      "Salam, direktorun yeni köməkçisiyəm. Sizə bağlama göndərdim, içində iclas təqdimatı olan fleş kart var. Zəhmət olmasa açıb baxın.",
      "Hi, I’m the director’s new assistant. I sent you a parcel with a flash drive holding the meeting slides. Please open it and take a look.",
      "Здравствуйте, я новый помощник директора. Отправил вам посылку с флешкой, на ней презентация к совещанию. Откройте, пожалуйста.",
    ),
    attachment: { name: l("Iclas_teqdimati.html", "Meeting_slides.html", "Презентация_совещания.html"), size: l("8 KB", "8 KB", "8 КБ") },
    redFlags: [
      l("Naməlum fleş kartı heç vaxt iş kompüterinə taxmayın.", "Never plug an unknown flash drive into a work computer.", "Никогда не вставляйте неизвестную флешку в рабочий компьютер."),
      l("«Yeni köməkçi» kimliyini İT və ya rəhbərlə yoxlayın.", "Check the “new assistant” with IT or your manager.", "Проверьте «нового помощника» через ИТ или руководителя."),
      l("Tapılan və ya gözlənilməyən cihazı İT-yə təhvil verin.", "Hand found or unexpected devices to IT.", "Передайте найденное или неожиданное устройство в ИТ."),
    ],
  },
];

export const TEMPLATE_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));

export function templateText(value: L10n, locale: string): string {
  return value[locale as keyof L10n] ?? value.en;
}
