import "server-only";

/**
 * Practice lab content. Answers live only on the server: the browser gets the items without
 * the answer key and the server scores the submission.
 */
type L = { az: string; en: string; ru: string };
const l = (az: string, en: string, ru: string): L => ({ az, en, ru });
export const tx = (v: L, locale: string) => v[locale as keyof L] ?? v.en;

/** `sender`: the display name in each language (people and fictional brands keep their name). */
export type InboxItem = { id: string; sender: L; address: string; subject: L; snippet: L; verdict: "phishing" | "safe"; why: L };
export type LinkItem = { id: string; url: string; context: L; verdict: "safe" | "suspicious"; why: L };
export type MfaItem = { id: string; situation: L; correct: "approve" | "deny" | "ignore"; why: L };

export const INBOX: InboxItem[] = [
  {
    id: "i1",
    sender: l("Microsoft 365", "Microsoft 365", "Microsoft 365"),
    address: "no-reply@m365-security-alerts.com",
    subject: l("Parolunuzun müddəti bu gün bitir", "Your password expires today", "Срок действия пароля истекает сегодня"),
    snippet: l("Hesabınızı saxlamaq üçün indi parolu yeniləyin.", "Update your password now to keep your account.", "Обновите пароль сейчас, чтобы сохранить учётную запись."),
    verdict: "phishing",
    why: l("Domen microsoft.com deyil; «bu gün» tələsdirir.", "The domain isn't microsoft.com, and “today” rushes you.", "Домен не microsoft.com, а «сегодня» торопит."),
  },
  {
    id: "i2",
    sender: l("Elvin Məmmədov", "Elvin Mammadov", "Эльвин Мамедов"),
    address: "elvin.mammadov@demo.cyclowareness.com",
    subject: l("Hesabatın son versiyası", "Final version of the report", "Финальная версия отчёта"),
    snippet: l("Dünən danışdığımız düzəlişləri etdim, baxarsan.", "I made the changes we discussed yesterday, have a look.", "Внёс правки, которые мы вчера обсуждали, посмотри."),
    verdict: "safe",
    why: l("Tanış həmkar, öz domenimiz və gözlənilən mövzu.", "A known colleague, our own domain and an expected topic.", "Знакомый коллега, наш домен и ожидаемая тема."),
  },
  {
    id: "i3",
    sender: l("DocuSfera", "DocuSfera", "DocuSfera"),
    address: "sign@docusfera-documents.net",
    subject: l("Sənəd imzanızı gözləyir", "A document is waiting for your signature", "Документ ждёт вашей подписи"),
    snippet: l("Muqavile_2025.pdf · İmzalamaq üçün daxil olun.", "Contract_2025.pdf · Sign in to sign.", "Договор_2025.pdf · Войдите, чтобы подписать."),
    verdict: "phishing",
    why: l("Gözləmədiyiniz sənəd, kənar domen və giriş tələbi.", "An unexpected document, an outside domain and a sign-in request.", "Неожиданный документ, внешний домен и запрос входа."),
  },
  {
    id: "i4",
    sender: l("İT Dəstək", "IT Support", "ИТ-поддержка"),
    address: "it@demo.cyclowareness.com",
    subject: l("Planlı texniki işlər: şənbə 22:00", "Planned maintenance: Saturday 22:00", "Плановые работы: суббота 22:00"),
    snippet: l("Poçt xidməti 30 dəqiqə əlçatan olmayacaq. Heç nə etməyiniz lazım deyil.", "Mail will be unavailable for 30 minutes. You don't need to do anything.", "Почта будет недоступна 30 минут. Ничего делать не нужно."),
    verdict: "safe",
    why: l("Daxili ünvan, heç bir link və ya parol tələbi yoxdur.", "An internal address with no link or password request.", "Внутренний адрес, без ссылок и запросов пароля."),
  },
  {
    id: "i5",
    sender: l("HR şöbəsi", "HR Department", "Отдел кадров"),
    address: "hr@demo-cyclowareness.co",
    subject: l("Bayram bonusu siyahısı", "Holiday bonus list", "Список праздничных бонусов"),
    snippet: l("Qoşmadakı faylı açıb adınızı yoxlayın: Bonus_list.xlsm", "Open the attachment and check your name: Bonus_list.xlsm", "Откройте вложение и найдите своё имя: Bonus_list.xlsm"),
    verdict: "phishing",
    why: l("Domen «-co» ilə saxtalaşdırılıb, makroslu .xlsm fayl.", "A look-alike “-co” domain and a macro-enabled .xlsm file.", "Поддельный домен «-co» и файл .xlsm с макросами."),
  },
];

export const LINKS: LinkItem[] = [
  {
    id: "l1",
    url: "https://my.gov.az/xidmetler",
    context: l("Dövlət xidmətləri portalı", "Government services portal", "Портал госуслуг"),
    verdict: "safe",
    why: l("Rəsmi domen my.gov.az, HTTPS.", "The official domain my.gov.az over HTTPS.", "Официальный домен my.gov.az по HTTPS."),
  },
  {
    id: "l2",
    url: "http://mygov-az.info/tesdiq",
    context: l("SMS-də «şəxsiyyət vəsiqəsini təsdiqləyin»", "Text: “confirm your ID card”", "SMS: «подтвердите удостоверение»"),
    verdict: "suspicious",
    why: l("mygov-az.info rəsmi domen deyil, şifrələnməmiş HTTP.", "mygov-az.info isn't the official domain, and it's unencrypted HTTP.", "mygov-az.info — не официальный домен, к тому же HTTP без шифрования."),
  },
  {
    id: "l3",
    url: "https://login.microsoftonline.com/",
    context: l("Ofis hesabına giriş", "Office account sign-in", "Вход в рабочую учётную запись"),
    verdict: "safe",
    why: l("Microsoft-un həqiqi giriş domeni.", "Microsoft's genuine sign-in domain.", "Настоящий домен входа Microsoft."),
  },
  {
    id: "l4",
    url: "https://kapitalbank.az@185.22.14.9/login",
    context: l("Bankdan «kartınız bloklanıb» məktubu", "Bank email: “your card is blocked”", "Письмо банка: «карта заблокирована»"),
    verdict: "suspicious",
    why: l("«@»-dan əvvəlki hissə nəzərə alınmır: əsl ünvan IP-dir.", "Everything before “@” is ignored: the real address is an IP.", "Всё до «@» игнорируется: настоящий адрес — IP."),
  },
  {
    id: "l5",
    url: "https://bit.ly/3Xq9-maas",
    context: l("WhatsApp-da «maaş artımı siyahısı»", "WhatsApp: “salary increase list”", "WhatsApp: «список повышений зарплаты»"),
    verdict: "suspicious",
    why: l("Qısaldılmış link əsl ünvanı gizlədir; maaş yemi.", "A shortened link hides the destination; salary is the bait.", "Короткая ссылка скрывает адрес; зарплата — приманка."),
  },
];

export const MFA: MfaItem[] = [
  {
    id: "m1",
    situation: l("Gecə 02:14. Yatmısınız, telefona «Girişi təsdiqləyin?» bildirişi gəlir.", "02:14 at night. You're asleep and your phone shows “Approve sign-in?”", "02:14 ночи. Вы спите, а на телефоне «Подтвердить вход?»"),
    correct: "deny",
    why: l("Siz daxil olmursunuz: parolunuz başqasındadır. Rədd edin və İT-yə bildirin.", "You aren't signing in: someone has your password. Deny it and tell IT.", "Вы не входите: ваш пароль у кого-то ещё. Отклоните и сообщите в ИТ."),
  },
  {
    id: "m2",
    situation: l("İndicə noutbukda poçta daxil olursunuz və telefona eyni anda sorğu gəlir.", "You're signing in to mail on your laptop right now and a prompt arrives at the same moment.", "Вы прямо сейчас входите в почту на ноутбуке, и в тот же момент приходит запрос."),
    correct: "approve",
    why: l("Bu, öz girişinizdir: vaxt və cihaz uyğun gəlir.", "It's your own sign-in: the time and device match.", "Это ваш собственный вход: время и устройство совпадают."),
  },
  {
    id: "m3",
    situation: l("Bir dəqiqədə 9 sorğu gəlir, sonra «İT dəstək» zəng edib təsdiqləməyinizi xahiş edir.", "Nine prompts in a minute, then “IT support” calls and asks you to approve.", "Девять запросов за минуту, затем звонит «ИТ-поддержка» и просит подтвердить."),
    correct: "deny",
    why: l("Klassik MFA yorğunluğu hücumu. İT heç vaxt təsdiq istəmir.", "A classic MFA fatigue attack. IT never asks you to approve.", "Классическая атака MFA-усталостью. ИТ никогда не просит подтверждать."),
  },
];

export const GAMES = {
  "inbox-triage": { max: INBOX.length, xp: 20 },
  "link-detective": { max: LINKS.length, xp: 15 },
  "password-forge": { max: 1, xp: 15 },
  "mfa-fatigue": { max: MFA.length, xp: 15 },
} as const;
export type GameKey = keyof typeof GAMES;

export function isGame(v: string): v is GameKey {
  return Object.hasOwn(GAMES, v);
}

/** Items as the browser sees them (no answers). */
export function publicItems(game: GameKey, locale: string) {
  switch (game) {
    case "inbox-triage":
      return INBOX.map((i) => ({ id: i.id, sender: tx(i.sender, locale), address: i.address, subject: tx(i.subject, locale), snippet: tx(i.snippet, locale) }));
    case "link-detective":
      return LINKS.map((i) => ({ id: i.id, url: i.url, context: tx(i.context, locale) }));
    case "mfa-fatigue":
      return MFA.map((i) => ({ id: i.id, situation: tx(i.situation, locale) }));
    default:
      return [];
  }
}
