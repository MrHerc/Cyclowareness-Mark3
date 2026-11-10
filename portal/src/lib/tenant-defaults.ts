import { LOCALES, type Locale } from "../i18n/config";
import { DEFAULT_TIME_ZONE } from "./day";
import type { TemplateKind, TenantBranding, TenantSettings } from "../server/db/schema";

export const DEFAULT_BRANDING: TenantBranding = { primary: "#4f46e5", accent: "#ff7a1a" };

export const BRAND_PALETTE = ["#4F46E5", "#0F6FBF", "#0F766E", "#1E7B3C", "#B42346", "#6D28D9", "#E2B007", "#FF7A1A", "#F5A524", "#E5484D", "#12A594", "#3E63DD", "#D6409F"];

type Mail = { subject: string; body: string };

// Product-owned texts: `satisfies Record<Locale, …>` makes a missing language a type error; lookups by a stored
// locale string still fall back to en.
export const DEFAULT_ATTESTATION: Record<string, string> = {
  az: "Bu modulu özüm keçdim, qaydaları başa düşdüm və onlara əməl edəcəyəm.",
  en: "I went through this module myself, I understand the rules and I will follow them.",
  ru: "Я прошёл(а) этот модуль самостоятельно, понимаю правила и буду их соблюдать.",
  tr: "Bu modülü kendim tamamladım, kuralları anladım ve bunlara uyacağım.",
  ro: "Am parcurs personal acest modul, înțeleg regulile și le voi respecta.",
  ka: "ეს მოდული თავად გავიარე, წესები გავიგე და მათ დავიცავ.",
  uk: "Цей модуль пройдено мною особисто, я розумію правила й дотримуватимуся їх.",
  de: "Ich habe dieses Modul selbst bearbeitet, verstehe die Regeln und werde sie befolgen.",
  fr: "J’ai suivi ce module moi-même, je comprends les règles et je m’engage à les respecter.",
  ar: "أقر بأنني أتممت هذه الوحدة التدريبية بنفسي، وفهمت القواعد، وسألتزم بها.",
} satisfies Record<Locale, string>;

export const DEFAULT_CERTIFICATE_TEXT: Record<string, string> = {
  az: "{date} tarixində {name} «{module}» modulunu uğurla tamamladı və kibergigiyena qaydalarına əməl edəcəyini təsdiqlədi.",
  en: "On {date}, {name} successfully completed the module “{module}” and confirmed that they will follow the rules of cyber hygiene.",
  ru: "{date} {name} успешно завершил(а) модуль «{module}» и подтвердил(а), что будет соблюдать правила кибергигиены.",
  tr: "{name}, {date} tarihinde “{module}” modülünü başarıyla tamamladı ve siber hijyen kurallarına uyacağını onayladı.",
  ro: "La {date}, {name} a finalizat cu succes modulul „{module}” și a confirmat că va respecta regulile de igienă cibernetică.",
  ka: "თარიღი: {date}. მონაწილემ ({name}) წარმატებით გაიარა მოდული „{module}“ და დაადასტურა, რომ დაიცავს კიბერჰიგიენის წესებს.",
  uk: "{date} {name} успішно пройшов(-ла) модуль «{module}» і підтвердив(-ла), що дотримуватиметься правил кібергігієни.",
  de: "Am {date} hat {name} das Modul „{module}“ erfolgreich abgeschlossen und bestätigt, die Regeln der Cyberhygiene einzuhalten.",
  fr: "Le {date}, {name} a terminé avec succès le module « {module} » et a confirmé son engagement à respecter les règles d’hygiène informatique.",
  ar: "بتاريخ {date}، تم إتمام الوحدة التدريبية «{module}» بنجاح من قبل {name}، مع الإقرار بالالتزام بقواعد النظافة السيبرانية.",
} satisfies Record<Locale, string>;

/** Default wording of a learning-path certificate (DEFAULT_CERTIFICATE_TEXT speaks of a module). */
export const DEFAULT_PATH_CERTIFICATE_TEXT: Record<string, string> = {
  az: "{date} tarixində {name} «{module}» təlim yolunu uğurla tamamladı və kibergigiyena qaydalarına əməl edəcəyini təsdiqlədi.",
  en: "On {date}, {name} successfully completed the learning path “{module}” and confirmed that they will follow the rules of cyber hygiene.",
  ru: "{date} {name} успешно завершил(а) траекторию обучения «{module}» и подтвердил(а), что будет соблюдать правила кибергигиены.",
  tr: "{name}, {date} tarihinde “{module}” öğrenme yolunu başarıyla tamamladı ve siber hijyen kurallarına uyacağını onayladı.",
  ro: "La {date}, {name} a finalizat cu succes parcursul de învățare „{module}” și a confirmat că va respecta regulile de igienă cibernetică.",
  ka: "თარიღი: {date}. მონაწილემ ({name}) წარმატებით გაიარა სასწავლო გზა „{module}“ და დაადასტურა, რომ დაიცავს კიბერჰიგიენის წესებს.",
  uk: "{date} {name} успішно пройшов(-ла) навчальний шлях «{module}» і підтвердив(-ла), що дотримуватиметься правил кібергігієни.",
  de: "Am {date} hat {name} den Lernpfad „{module}“ erfolgreich abgeschlossen und bestätigt, die Regeln der Cyberhygiene einzuhalten.",
  fr: "Le {date}, {name} a terminé avec succès le parcours de formation « {module} » et a confirmé son engagement à respecter les règles d’hygiène informatique.",
  ar: "بتاريخ {date}، تم إتمام المسار التدريبي «{module}» بنجاح من قبل {name}، مع الإقرار بالالتزام بقواعد النظافة السيبرانية.",
} satisfies Record<Locale, string>;

export const DEFAULT_TEMPLATES: Record<TemplateKind, Record<string, Mail>> = {
  assignment: {
    az: { subject: "Yeni təlim: {{module}}", body: "Salam, {{name}}!\n\nSizə «{{module}}» təlimi təyin edilib. Son tarix: {{dueDate}}.\n\n{{link}}" },
    en: { subject: "New training: {{module}}", body: "Hello {{name}},\n\nYou have been assigned “{{module}}”. Due date: {{dueDate}}.\n\n{{link}}" },
    ru: { subject: "Новое обучение: {{module}}", body: "Здравствуйте, {{name}}!\n\nВам назначено обучение «{{module}}». Срок выполнения: {{dueDate}}.\n\n{{link}}" },
    tr: { subject: "Yeni eğitim: {{module}}", body: "Merhaba {{name}},\n\nSize “{{module}}” eğitimi atandı. Son tarih: {{dueDate}}.\n\n{{link}}" },
    ro: { subject: "Instruire nouă: {{module}}", body: "Bună ziua, {{name}},\n\nV-a fost atribuită instruirea „{{module}}”. Termen: {{dueDate}}.\n\n{{link}}" },
    ka: { subject: "ახალი ტრენინგი: {{module}}", body: "გამარჯობა, {{name}}!\n\nთქვენ დაგენიშნათ ტრენინგი „{{module}}“. ვადა: {{dueDate}}.\n\n{{link}}" },
    uk: { subject: "Нове навчання: {{module}}", body: "Вітаємо, {{name}}!\n\nВам призначено навчання «{{module}}». Термін: {{dueDate}}.\n\n{{link}}" },
    de: { subject: "Neue Schulung: {{module}}", body: "Hallo {{name}},\n\nIhnen wurde die Schulung „{{module}}“ zugewiesen. Frist: {{dueDate}}.\n\n{{link}}" },
    fr: { subject: "Nouvelle formation : {{module}}", body: "Bonjour {{name}},\n\nLa formation « {{module}} » vous a été assignée. Échéance : {{dueDate}}.\n\n{{link}}" },
    ar: { subject: "تدريب جديد: {{module}}", body: "مرحبًا {{name}}،\n\nتم إسناد التدريب «{{module}}» إليك. تاريخ الاستحقاق: {{dueDate}}.\n\n{{link}}" },
  },
  reminder: {
    az: { subject: "Xatırlatma: {{module}}", body: "Salam, {{name}}!\n\n«{{module}}» təlimini {{dueDate}} tarixinədək tamamlamağı unutmayın. Bir neçə dəqiqə kifayətdir.\n\n{{link}}" },
    en: { subject: "Reminder: {{module}}", body: "Hello {{name}},\n\nPlease finish “{{module}}” by {{dueDate}}. It only takes a few minutes.\n\n{{link}}" },
    ru: { subject: "Напоминание: {{module}}", body: "Здравствуйте, {{name}}!\n\nПожалуйста, завершите «{{module}}» до {{dueDate}}. Это займёт несколько минут.\n\n{{link}}" },
    tr: { subject: "Hatırlatma: {{module}}", body: "Merhaba {{name}},\n\nLütfen “{{module}}” eğitimini {{dueDate}} tarihine kadar tamamlayın. Yalnızca birkaç dakika sürer.\n\n{{link}}" },
    ro: { subject: "Memento: {{module}}", body: "Bună ziua, {{name}},\n\nVă rugăm să finalizați „{{module}}” până la {{dueDate}}. Durează doar câteva minute.\n\n{{link}}" },
    ka: { subject: "შეხსენება: {{module}}", body: "გამარჯობა, {{name}}!\n\nგთხოვთ, დაასრულოთ „{{module}}“ ვადის ამოწურვამდე ({{dueDate}}). ამას მხოლოდ რამდენიმე წუთი სჭირდება.\n\n{{link}}" },
    uk: { subject: "Нагадування: {{module}}", body: "Вітаємо, {{name}}!\n\nБудь ласка, завершіть «{{module}}» до {{dueDate}}. Це займе лише кілька хвилин.\n\n{{link}}" },
    de: { subject: "Erinnerung: {{module}}", body: "Hallo {{name}},\n\nbitte schließen Sie „{{module}}“ bis {{dueDate}} ab. Es dauert nur wenige Minuten.\n\n{{link}}" },
    fr: { subject: "Rappel : {{module}}", body: "Bonjour {{name}},\n\nMerci de terminer « {{module}} » avant le {{dueDate}}. Cela ne prend que quelques minutes.\n\n{{link}}" },
    ar: { subject: "تذكير: {{module}}", body: "مرحبًا {{name}}،\n\nيرجى إكمال «{{module}}» قبل {{dueDate}}. لن يستغرق ذلك سوى بضع دقائق.\n\n{{link}}" },
  },
  overdue: {
    az: { subject: "Son tarix keçib: {{module}}", body: "Salam, {{name}}!\n\n«{{module}}» təliminin son tarixi ({{dueDate}}) keçib. Zəhmət olmasa bu gün tamamlayın.\n\n{{link}}" },
    en: { subject: "Overdue: {{module}}", body: "Hello {{name}},\n\nThe due date for “{{module}}” ({{dueDate}}) has passed. Please complete it today.\n\n{{link}}" },
    ru: { subject: "Срок истёк: {{module}}", body: "Здравствуйте, {{name}}!\n\nСрок обучения «{{module}}» ({{dueDate}}) истёк. Пожалуйста, завершите его сегодня.\n\n{{link}}" },
    tr: { subject: "Süresi geçti: {{module}}", body: "Merhaba {{name}},\n\n“{{module}}” eğitiminin son tarihi ({{dueDate}}) geçti. Lütfen eğitimi bugün tamamlayın.\n\n{{link}}" },
    ro: { subject: "Termen depășit: {{module}}", body: "Bună ziua, {{name}},\n\nTermenul pentru „{{module}}” ({{dueDate}}) a expirat. Vă rugăm să finalizați instruirea astăzi.\n\n{{link}}" },
    ka: { subject: "ვადა ამოიწურა: {{module}}", body: "გამარჯობა, {{name}}!\n\nტრენინგის „{{module}}“ ვადა ({{dueDate}}) ამოიწურა. გთხოვთ, დაასრულოთ ის დღესვე.\n\n{{link}}" },
    uk: { subject: "Термін минув: {{module}}", body: "Вітаємо, {{name}}!\n\nТермін навчання «{{module}}» ({{dueDate}}) минув. Будь ласка, завершіть його сьогодні.\n\n{{link}}" },
    de: { subject: "Frist überschritten: {{module}}", body: "Hallo {{name}},\n\ndie Frist für „{{module}}“ ({{dueDate}}) ist abgelaufen. Bitte schließen Sie die Schulung heute ab.\n\n{{link}}" },
    fr: { subject: "En retard : {{module}}", body: "Bonjour {{name}},\n\nL’échéance de « {{module}} » ({{dueDate}}) est dépassée. Merci de terminer la formation aujourd’hui.\n\n{{link}}" },
    ar: { subject: "انتهت المهلة: {{module}}", body: "مرحبًا {{name}}،\n\nانتهت مهلة التدريب «{{module}}» ({{dueDate}}). يرجى إكماله اليوم.\n\n{{link}}" },
  },
  manager: {
    az: { subject: "Komandanızda diqqət tələb edən hal", body: "Salam, {{name}}!\n\nKomandanızdakı {{person}} ilə bağlı diqqət tələb edən hal var: {{reason}}.\n\n{{link}}" },
    en: { subject: "Someone in your team needs attention", body: "Hello {{name}},\n\n{{person}} in your team needs attention: {{reason}}.\n\n{{link}}" },
    ru: { subject: "Сотрудник вашей команды требует внимания", body: "Здравствуйте, {{name}}!\n\nСотрудник вашей команды {{person}} требует внимания: {{reason}}.\n\n{{link}}" },
    tr: { subject: "Ekibinizde dikkat gerektiren bir durum var", body: "Merhaba {{name}},\n\nEkibinizdeki {{person}} ile ilgili dikkat gerektiren bir durum var: {{reason}}.\n\n{{link}}" },
    ro: { subject: "O persoană din echipa dumneavoastră necesită atenție", body: "Bună ziua, {{name}},\n\n{{person}} din echipa dumneavoastră necesită atenție: {{reason}}.\n\n{{link}}" },
    ka: { subject: "თქვენი გუნდის წევრს ყურადღება სჭირდება", body: "გამარჯობა, {{name}}!\n\nთქვენი გუნდის წევრს ({{person}}) ყურადღება სჭირდება: {{reason}}.\n\n{{link}}" },
    uk: { subject: "Працівник вашої команди потребує уваги", body: "Вітаємо, {{name}}!\n\nПрацівник вашої команди {{person}} потребує уваги: {{reason}}.\n\n{{link}}" },
    de: { subject: "Eine Person in Ihrem Team braucht Aufmerksamkeit", body: "Hallo {{name}},\n\n{{person}} aus Ihrem Team braucht Aufmerksamkeit: {{reason}}.\n\n{{link}}" },
    fr: { subject: "Une personne de votre équipe demande votre attention", body: "Bonjour {{name}},\n\n{{person}}, de votre équipe, demande votre attention : {{reason}}.\n\n{{link}}" },
    ar: { subject: "أحد أعضاء فريقك يحتاج إلى متابعة", body: "مرحبًا {{name}}،\n\nيحتاج {{person}} من فريقك إلى متابعة: {{reason}}.\n\n{{link}}" },
  },
  welcome: {
    az: { subject: "{{organisation}}: kibergigiyena təliminə xoş gəlmisiniz", body: "Salam, {{name}}!\n\n{{organisation}} sizi qısa kibergigiyena dərslərinə dəvət edir. Hesabınızı aktivləşdirmək üçün linkə keçin. Link 14 gün etibarlıdır.\n\n{{link}}" },
    en: { subject: "Welcome to {{organisation}}'s security awareness training", body: "Hello {{name}},\n\n{{organisation}} invites you to short cyber hygiene lessons. Use the link to set up your account. The link is valid for 14 days.\n\n{{link}}" },
    ru: { subject: "{{organisation}}: добро пожаловать на обучение кибергигиене", body: "Здравствуйте, {{name}}!\n\n{{organisation}} приглашает вас на короткие уроки по кибергигиене. Перейдите по ссылке, чтобы активировать учётную запись. Ссылка действует 14 дней.\n\n{{link}}" },
    tr: { subject: "{{organisation}}: siber hijyen eğitimine hoş geldiniz", body: "Merhaba {{name}},\n\n{{organisation}} sizi kısa siber hijyen derslerine davet ediyor. Hesabınızı etkinleştirmek için bağlantıyı kullanın. Bağlantı 14 gün geçerlidir.\n\n{{link}}" },
    ro: { subject: "{{organisation}}: bun venit la instruirea de igienă cibernetică", body: "Bună ziua, {{name}},\n\n{{organisation}} vă invită la lecții scurte de igienă cibernetică. Folosiți linkul pentru a vă activa contul. Linkul este valabil 14 zile.\n\n{{link}}" },
    ka: { subject: "{{organisation}}: კეთილი იყოს თქვენი მობრძანება კიბერჰიგიენის ტრენინგზე", body: "გამარჯობა, {{name}}!\n\n{{organisation}} გიწვევთ კიბერჰიგიენის მოკლე გაკვეთილებზე. ანგარიშის გასააქტიურებლად გადადით ბმულზე. ბმული 14 დღის განმავლობაში მოქმედებს.\n\n{{link}}" },
    uk: { subject: "{{organisation}}: вітаємо на навчанні з кібергігієни", body: "Вітаємо, {{name}}!\n\n{{organisation}} запрошує вас на короткі уроки з кібергігієни. Перейдіть за посиланням, щоб активувати обліковий запис. Посилання дійсне 14 днів.\n\n{{link}}" },
    de: { subject: "{{organisation}}: Willkommen zum Training für Cyberhygiene", body: "Hallo {{name}},\n\n{{organisation}} lädt Sie zu kurzen Lektionen über Cyberhygiene ein. Richten Sie über den Link Ihr Konto ein. Der Link ist 14 Tage gültig.\n\n{{link}}" },
    fr: { subject: "{{organisation}} : bienvenue dans votre formation à l’hygiène informatique", body: "Bonjour {{name}},\n\n{{organisation}} vous invite à suivre de courtes leçons d’hygiène informatique. Utilisez le lien pour activer votre compte. Le lien est valable 14 jours.\n\n{{link}}" },
    ar: { subject: "{{organisation}}: مرحبًا بك في التدريب على النظافة السيبرانية", body: "مرحبًا {{name}}،\n\nتدعوك {{organisation}} إلى دروس قصيرة في النظافة السيبرانية. استخدم الرابط لتفعيل حسابك. الرابط صالح لمدة 14 يومًا.\n\n{{link}}" },
  },
} satisfies Record<TemplateKind, Record<Locale, Mail>>;

/**
 * The default assignment and reminder text when there is no due date (an assignment without one, or a reminder
 * sent by hand for a module that has none): the dated wording would otherwise read "by —".
 */
const undated = (kind: "assignment" | "reminder", body: Record<Locale, string>): Record<string, Mail> =>
  Object.fromEntries(Object.entries(body).map(([l, b]) => [l, { subject: DEFAULT_TEMPLATES[kind][l].subject, body: b }]));

export const DEFAULT_TEMPLATES_NO_DUE: Record<"assignment" | "reminder", Record<string, Mail>> = {
  assignment: undated("assignment", {
    az: "Salam, {{name}}!\n\nSizə «{{module}}» təlimi təyin edilib.\n\n{{link}}",
    en: "Hello {{name}},\n\nYou have been assigned “{{module}}”.\n\n{{link}}",
    ru: "Здравствуйте, {{name}}!\n\nВам назначено обучение «{{module}}».\n\n{{link}}",
    tr: "Merhaba {{name}},\n\nSize “{{module}}” eğitimi atandı.\n\n{{link}}",
    ro: "Bună ziua, {{name}},\n\nV-a fost atribuită instruirea „{{module}}”.\n\n{{link}}",
    ka: "გამარჯობა, {{name}}!\n\nთქვენ დაგენიშნათ ტრენინგი „{{module}}“.\n\n{{link}}",
    uk: "Вітаємо, {{name}}!\n\nВам призначено навчання «{{module}}».\n\n{{link}}",
    de: "Hallo {{name}},\n\nIhnen wurde die Schulung „{{module}}“ zugewiesen.\n\n{{link}}",
    fr: "Bonjour {{name}},\n\nLa formation « {{module}} » vous a été assignée.\n\n{{link}}",
    ar: "مرحبًا {{name}}،\n\nتم إسناد التدريب «{{module}}» إليك.\n\n{{link}}",
  }),
  reminder: undated("reminder", {
    az: "Salam, {{name}}!\n\n«{{module}}» təlimini tamamlamağı unutmayın. Bir neçə dəqiqə kifayətdir.\n\n{{link}}",
    en: "Hello {{name}},\n\nPlease finish “{{module}}”. It only takes a few minutes.\n\n{{link}}",
    ru: "Здравствуйте, {{name}}!\n\nПожалуйста, завершите обучение «{{module}}». Это займёт несколько минут.\n\n{{link}}",
    tr: "Merhaba {{name}},\n\nLütfen “{{module}}” eğitimini tamamlayın. Yalnızca birkaç dakika sürer.\n\n{{link}}",
    ro: "Bună ziua, {{name}},\n\nVă rugăm să finalizați „{{module}}”. Durează doar câteva minute.\n\n{{link}}",
    ka: "გამარჯობა, {{name}}!\n\nგთხოვთ, დაასრულოთ „{{module}}“. ამას მხოლოდ რამდენიმე წუთი სჭირდება.\n\n{{link}}",
    uk: "Вітаємо, {{name}}!\n\nБудь ласка, завершіть навчання «{{module}}». Це займе лише кілька хвилин.\n\n{{link}}",
    de: "Hallo {{name}},\n\nbitte schließen Sie „{{module}}“ ab. Es dauert nur wenige Minuten.\n\n{{link}}",
    fr: "Bonjour {{name}},\n\nMerci de terminer « {{module}} ». Cela ne prend que quelques minutes.\n\n{{link}}",
    ar: "مرحبًا {{name}}،\n\nيرجى إكمال «{{module}}». لن يستغرق ذلك سوى بضع دقائق.\n\n{{link}}",
  }),
};

/** Messages with no editable template: a policy signature request and a nudge to confirm a finished module. */
export const FIXED_MESSAGES: Record<"policy_reminder" | "confirmation_reminder" | "twoFactorReset" | "resetLinkIssued" | "roleChanged" | "phoneChanged", Record<string, Mail>> = {
  policy_reminder: {
    az: { subject: "İmza gözlənilir: {{module}}", body: "Salam, {{name}}!\n\nZəhmət olmasa «{{module}}» siyasətini oxuyub imzalayın. Bir neçə dəqiqə kifayətdir.\n\n{{link}}" },
    en: { subject: "Signature needed: {{module}}", body: "Hello {{name}},\n\nPlease read and sign “{{module}}”. It only takes a few minutes.\n\n{{link}}" },
    ru: { subject: "Нужна подпись: {{module}}", body: "Здравствуйте, {{name}}!\n\nПожалуйста, прочитайте и подпишите «{{module}}». Это займёт несколько минут.\n\n{{link}}" },
    tr: { subject: "İmzanız bekleniyor: {{module}}", body: "Merhaba {{name}},\n\nLütfen “{{module}}” politikasını okuyup imzalayın. Yalnızca birkaç dakika sürer.\n\n{{link}}" },
    ro: { subject: "Semnătură necesară: {{module}}", body: "Bună ziua, {{name}},\n\nVă rugăm să citiți și să semnați „{{module}}”. Durează doar câteva minute.\n\n{{link}}" },
    ka: { subject: "საჭიროა პოლიტიკის დადასტურება: {{module}}", body: "გამარჯობა, {{name}}!\n\nგთხოვთ, გაეცნოთ პოლიტიკას „{{module}}“ და დაადასტუროთ გაცნობა. ამას მხოლოდ რამდენიმე წუთი სჭირდება.\n\n{{link}}" },
    uk: { subject: "Потрібен підпис: {{module}}", body: "Вітаємо, {{name}}!\n\nБудь ласка, прочитайте й підпишіть «{{module}}». Це займе лише кілька хвилин.\n\n{{link}}" },
    de: { subject: "Unterschrift erforderlich: {{module}}", body: "Hallo {{name}},\n\nbitte lesen und unterzeichnen Sie „{{module}}“. Es dauert nur wenige Minuten.\n\n{{link}}" },
    fr: { subject: "Signature requise : {{module}}", body: "Bonjour {{name}},\n\nMerci de lire et de signer « {{module}} ». Cela ne prend que quelques minutes.\n\n{{link}}" },
    ar: { subject: "مطلوب توقيعك: {{module}}", body: "مرحبًا {{name}}،\n\nيرجى قراءة «{{module}}» والتوقيع عليها. لن يستغرق ذلك سوى بضع دقائق.\n\n{{link}}" },
  },
  confirmation_reminder: {
    az: { subject: "Təsdiq gözlənilir: {{module}}", body: "Salam, {{name}}!\n\n«{{module}}» təlimini bitirmisiniz, yalnız təsdiqləmək qalıb. Zəhmət olmasa təsdiqləyin: bir dəqiqə çəkir.\n\n{{link}}" },
    en: { subject: "Confirmation needed: {{module}}", body: "Hello {{name}},\n\nYou finished “{{module}}” but have not confirmed it yet. Please confirm — it takes a minute.\n\n{{link}}" },
    ru: { subject: "Нужно подтверждение: {{module}}", body: "Здравствуйте, {{name}}!\n\nВы завершили «{{module}}», осталось подтвердить. Пожалуйста, подтвердите — это займёт минуту.\n\n{{link}}" },
    tr: { subject: "Onayınız bekleniyor: {{module}}", body: "Merhaba {{name}},\n\n“{{module}}” eğitimini tamamladınız, yalnızca onaylamanız kaldı. Lütfen onaylayın: bir dakika sürer.\n\n{{link}}" },
    ro: { subject: "Confirmare necesară: {{module}}", body: "Bună ziua, {{name}},\n\nAți terminat „{{module}}”, dar nu ați confirmat încă. Vă rugăm să confirmați – durează un minut.\n\n{{link}}" },
    ka: { subject: "საჭიროა მოდულის დადასტურება: {{module}}", body: "გამარჯობა, {{name}}!\n\nთქვენ დაასრულეთ „{{module}}“, დარჩა მხოლოდ დადასტურება. გთხოვთ, დაადასტუროთ – ამას ერთი წუთი სჭირდება.\n\n{{link}}" },
    uk: { subject: "Потрібне підтвердження: {{module}}", body: "Вітаємо, {{name}}!\n\nВи завершили «{{module}}», залишилося підтвердити. Будь ласка, підтвердьте — це займе хвилину.\n\n{{link}}" },
    de: { subject: "Bestätigung erforderlich: {{module}}", body: "Hallo {{name}},\n\nSie haben „{{module}}“ abgeschlossen, aber noch nicht bestätigt. Bitte bestätigen Sie jetzt – es dauert nur eine Minute.\n\n{{link}}" },
    fr: { subject: "Validation requise : {{module}}", body: "Bonjour {{name}},\n\nVous avez terminé « {{module}} », mais pas encore validé ce module. Merci de le valider, cela prend une minute.\n\n{{link}}" },
    ar: { subject: "مطلوب التأكيد: {{module}}", body: "مرحبًا {{name}}،\n\nأنهيت «{{module}}» ولم يتبق سوى تأكيد الإتمام. يرجى التأكيد، فالأمر لا يستغرق سوى دقيقة.\n\n{{link}}" },
  },
  // Account-takeover tooling always leaves the person a trace (people.ts, platform.ts).
  twoFactorReset: {
    az: { subject: "İki addımlı doğrulamanız sıfırlandı", body: "Salam, {{name}}!\n\n{{organisation}} administratoru iki addımlı doğrulamanızı sıfırladı və bütün cihazlardan çıxış etdi. Onu profilinizdə yenidən qurun. Bunu gözləmirdinizsə, dərhal təhlükəsizlik komandasına bildirin.\n\n{{link}}" },
    en: { subject: "Your two-step verification was reset", body: "Hello {{name}},\n\nAn administrator of {{organisation}} reset your two-step verification and signed you out everywhere. Set it up again in your profile. If you did not expect this, tell your security team right away.\n\n{{link}}" },
    ru: { subject: "Ваша двухэтапная проверка сброшена", body: "Здравствуйте, {{name}}!\n\nАдминистратор организации {{organisation}} сбросил вашу двухэтапную проверку и завершил сеансы на всех устройствах. Настройте её заново в профиле. Если вы этого не ожидали, сразу сообщите команде безопасности.\n\n{{link}}" },
    tr: { subject: "İki adımlı doğrulamanız sıfırlandı", body: "Merhaba {{name}},\n\n{{organisation}} sistem yöneticisi iki adımlı doğrulamanızı sıfırladı ve tüm cihazlardaki oturumlarınızı kapattı. Profilinizden yeniden kurun. Bunu beklemiyorsanız hemen güvenlik ekibine bildirin.\n\n{{link}}" },
    ro: { subject: "Verificarea dvs. în doi pași a fost resetată", body: "Bună ziua, {{name}},\n\nUn administrator al organizației {{organisation}} v-a resetat verificarea în doi pași și v-a deconectat de pe toate dispozitivele. Configurați-o din nou în profil. Dacă nu vă așteptați la aceasta, anunțați imediat echipa de securitate.\n\n{{link}}" },
    ka: { subject: "თქვენი ორსაფეხურიანი დადასტურება განულდა", body: "გამარჯობა, {{name}}!\n\n{{organisation}}-ის ადმინისტრატორმა განულა თქვენი ორსაფეხურიანი დადასტურება და დაასრულა სესია ყველა მოწყობილობაზე. ხელახლა გამართეთ ის თქვენს პროფილში. თუ ამას არ ელოდით, დაუყოვნებლივ აცნობეთ უსაფრთხოების გუნდს.\n\n{{link}}" },
    uk: { subject: "Вашу двоетапну перевірку скинуто", body: "Вітаємо, {{name}}!\n\nАдміністратор організації {{organisation}} скинув вашу двоетапну перевірку та завершив сеанси на всіх пристроях. Налаштуйте її знову у своєму профілі. Якщо ви цього не очікували, негайно повідомте команду безпеки.\n\n{{link}}" },
    de: { subject: "Ihre Zwei-Faktor-Authentisierung wurde zurückgesetzt", body: "Hallo {{name}},\n\nein Administrator von {{organisation}} hat Ihre Zwei-Faktor-Authentisierung zurückgesetzt und Sie überall abgemeldet. Richten Sie sie in Ihrem Profil neu ein. Falls Sie das nicht erwartet haben, melden Sie es sofort Ihrem Sicherheitsteam.\n\n{{link}}" },
    fr: { subject: "Votre double authentification a été réinitialisée", body: "Bonjour {{name}},\n\nUn administrateur de {{organisation}} a réinitialisé votre double authentification et vous a déconnecté de tous vos appareils. Configurez-la à nouveau dans votre profil. Si vous ne vous y attendiez pas, prévenez immédiatement votre équipe de sécurité.\n\n{{link}}" },
    ar: { subject: "تمت إعادة تعيين التحقق بخطوتين لحسابك", body: "مرحبًا {{name}}،\n\nأعاد مسؤول النظام في {{organisation}} تعيين التحقق بخطوتين لحسابك وسجّل خروجك من جميع الأجهزة. أعد إعداده من ملفك الشخصي. إذا لم تكن تتوقع ذلك، فأبلغ فريق الأمن فورًا.\n\n{{link}}" },
  },
  resetLinkIssued: {
    az: { subject: "Hesabınız üçün parol sıfırlama linki yaradıldı", body: "Salam, {{name}}!\n\n{{organisation}} administratoru hesabınız üçün birdəfəlik parol sıfırlama linki yaratdı. Link bir saat işləyir. Bunu siz istəməmisinizsə, dərhal təhlükəsizlik komandasına bildirin.\n\n{{link}}" },
    en: { subject: "A password reset link was created for your account", body: "Hello {{name}},\n\nAn administrator of {{organisation}} created a one-time password reset link for your account. It works for one hour. If you did not ask for it, tell your security team right away.\n\n{{link}}" },
    ru: { subject: "Для вашей учётной записи создана ссылка для сброса пароля", body: "Здравствуйте, {{name}}!\n\nАдминистратор организации {{organisation}} создал одноразовую ссылку для сброса пароля вашей учётной записи. Она действует один час. Если вы её не запрашивали, сразу сообщите команде безопасности.\n\n{{link}}" },
    tr: { subject: "Hesabınız için parola sıfırlama bağlantısı oluşturuldu", body: "Merhaba {{name}},\n\n{{organisation}} sistem yöneticisi hesabınız için tek kullanımlık bir parola sıfırlama bağlantısı oluşturdu. Bağlantı bir saat geçerlidir. Bunu siz istemediyseniz hemen güvenlik ekibine bildirin.\n\n{{link}}" },
    ro: { subject: "A fost creat un link de resetare a parolei pentru contul dvs.", body: "Bună ziua, {{name}},\n\nUn administrator al organizației {{organisation}} a creat un link de unică folosință pentru resetarea parolei contului dvs. Linkul este valabil o oră. Dacă nu l-ați cerut, anunțați imediat echipa de securitate.\n\n{{link}}" },
    ka: { subject: "თქვენი ანგარიშისთვის შეიქმნა პაროლის აღდგენის ბმული", body: "გამარჯობა, {{name}}!\n\n{{organisation}}-ის ადმინისტრატორმა თქვენი ანგარიშისთვის შექმნა პაროლის აღდგენის ერთჯერადი ბმული. ის ერთი საათი მოქმედებს. თუ ეს თქვენ არ მოგითხოვიათ, დაუყოვნებლივ აცნობეთ უსაფრთხოების გუნდს.\n\n{{link}}" },
    uk: { subject: "Для вашого облікового запису створено посилання для скидання пароля", body: "Вітаємо, {{name}}!\n\nАдміністратор організації {{organisation}} створив одноразове посилання для скидання пароля вашого облікового запису. Воно дійсне протягом години. Якщо ви його не просили, негайно повідомте команду безпеки.\n\n{{link}}" },
    de: { subject: "Für Ihr Konto wurde ein Link zum Zurücksetzen des Passworts erstellt", body: "Hallo {{name}},\n\nein Administrator von {{organisation}} hat einen einmaligen Link zum Zurücksetzen des Passworts für Ihr Konto erstellt. Er ist eine Stunde gültig. Falls Sie ihn nicht angefordert haben, melden Sie es sofort Ihrem Sicherheitsteam.\n\n{{link}}" },
    fr: { subject: "Un lien de réinitialisation du mot de passe a été créé pour votre compte", body: "Bonjour {{name}},\n\nUn administrateur de {{organisation}} a créé un lien à usage unique pour réinitialiser le mot de passe de votre compte. Il est valable une heure. Si vous ne l’avez pas demandé, prévenez immédiatement votre équipe de sécurité.\n\n{{link}}" },
    ar: { subject: "تم إنشاء رابط لإعادة تعيين كلمة المرور لحسابك", body: "مرحبًا {{name}}،\n\nأنشأ مسؤول النظام في {{organisation}} رابطًا يستخدم مرة واحدة لإعادة تعيين كلمة مرور حسابك. الرابط صالح لمدة ساعة واحدة. إذا لم تطلبه، فأبلغ فريق الأمن فورًا.\n\n{{link}}" },
  },
  roleChanged: {
    az: { subject: "{{organisation}} təşkilatında rolunuz dəyişdi", body: "Salam, {{name}}!\n\n{{organisation}} administratoru rolunuzu dəyişdi: {{reason}}. Dəyişiklik növbəti girişdən qüvvəyə minir. Bunu gözləmirdinizsə, təhlükəsizlik komandasına bildirin.\n\n{{link}}" },
    en: { subject: "Your role in {{organisation}} changed", body: "Hello {{name}},\n\nAn administrator of {{organisation}} changed your role to {{reason}}. It applies from your next sign-in. If you did not expect this, tell your security team.\n\n{{link}}" },
    ru: { subject: "Ваша роль в организации {{organisation}} изменена", body: "Здравствуйте, {{name}}!\n\nАдминистратор организации {{organisation}} изменил вашу роль: {{reason}}. Изменение вступает в силу при следующем входе. Если вы этого не ожидали, сообщите команде безопасности.\n\n{{link}}" },
    tr: { subject: "{{organisation}} kuruluşundaki rolünüz değişti", body: "Merhaba {{name}},\n\n{{organisation}} sistem yöneticisi rolünüzü değiştirdi: {{reason}}. Değişiklik bir sonraki oturum açışınızda geçerli olur. Bunu beklemiyorsanız güvenlik ekibine bildirin.\n\n{{link}}" },
    ro: { subject: "Rolul dvs. în organizația {{organisation}} s-a schimbat", body: "Bună ziua, {{name}},\n\nUn administrator al organizației {{organisation}} v-a schimbat rolul: {{reason}}. Schimbarea se aplică de la următoarea autentificare. Dacă nu vă așteptați la aceasta, anunțați echipa de securitate.\n\n{{link}}" },
    ka: { subject: "თქვენი როლი {{organisation}}-ში შეიცვალა", body: "გამარჯობა, {{name}}!\n\n{{organisation}}-ის ადმინისტრატორმა შეცვალა თქვენი როლი: {{reason}}. ცვლილება ძალაში შედის შემდეგი შესვლიდან. თუ ამას არ ელოდით, აცნობეთ უსაფრთხოების გუნდს.\n\n{{link}}" },
    uk: { subject: "Вашу роль в організації {{organisation}} змінено", body: "Вітаємо, {{name}}!\n\nАдміністратор організації {{organisation}} змінив вашу роль: {{reason}}. Зміна набуває чинності з наступного входу. Якщо ви цього не очікували, повідомте команду безпеки.\n\n{{link}}" },
    de: { subject: "Ihre Rolle bei {{organisation}} wurde geändert", body: "Hallo {{name}},\n\nein Administrator von {{organisation}} hat Ihre Rolle geändert: {{reason}}. Die Änderung gilt ab Ihrer nächsten Anmeldung. Falls Sie das nicht erwartet haben, melden Sie es Ihrem Sicherheitsteam.\n\n{{link}}" },
    fr: { subject: "Votre rôle dans {{organisation}} a changé", body: "Bonjour {{name}},\n\nUn administrateur de {{organisation}} a changé votre rôle : {{reason}}. Le changement s’applique dès votre prochaine connexion. Si vous ne vous y attendiez pas, prévenez votre équipe de sécurité.\n\n{{link}}" },
    ar: { subject: "تغيّر دورك في {{organisation}}", body: "مرحبًا {{name}}،\n\nغيّر مسؤول النظام في {{organisation}} دورك إلى: {{reason}}. يسري التغيير من تسجيل الدخول التالي. إذا لم تكن تتوقع ذلك، فأبلغ فريق الأمن.\n\n{{link}}" },
  },
  phoneChanged: {
    az: { subject: "Hesabınızın telefon nömrəsi dəyişdirildi", body: "Salam, {{name}}!\n\n{{organisation}} administratoru hesabınız üçün yeni telefon nömrəsi təyin etdi. SMS ilə giriş kodları indi həmin nömrəyə göndərilir. Bunu gözləmirdinizsə, dərhal təhlükəsizlik komandasına bildirin.\n\n{{link}}" },
    en: { subject: "The phone number of your account changed", body: "Hello {{name}},\n\nAn administrator of {{organisation}} set a new phone number for your account. Sign-in codes by text message now go to that number. If you did not expect this, tell your security team right away.\n\n{{link}}" },
    ru: { subject: "Номер телефона вашей учётной записи изменён", body: "Здравствуйте, {{name}}!\n\nАдминистратор организации {{organisation}} указал новый номер телефона для вашей учётной записи. Коды входа по SMS теперь приходят на этот номер. Если вы этого не ожидали, сразу сообщите команде безопасности.\n\n{{link}}" },
    tr: { subject: "Hesabınızın telefon numarası değiştirildi", body: "Merhaba {{name}},\n\n{{organisation}} sistem yöneticisi hesabınız için yeni bir telefon numarası belirledi. SMS ile giriş kodları artık bu numaraya gönderiliyor. Bunu beklemiyorsanız hemen güvenlik ekibine bildirin.\n\n{{link}}" },
    ro: { subject: "Numărul de telefon al contului dvs. a fost schimbat", body: "Bună ziua, {{name}},\n\nUn administrator al organizației {{organisation}} a setat un nou număr de telefon pentru contul dvs. Codurile de autentificare prin SMS ajung acum la acest număr. Dacă nu vă așteptați la aceasta, anunțați imediat echipa de securitate.\n\n{{link}}" },
    ka: { subject: "თქვენი ანგარიშის ტელეფონის ნომერი შეიცვალა", body: "გამარჯობა, {{name}}!\n\n{{organisation}}-ის ადმინისტრატორმა თქვენს ანგარიშს ახალი ტელეფონის ნომერი მიანიჭა. შესვლის SMS კოდები ახლა ამ ნომერზე იგზავნება. თუ ამას არ ელოდით, დაუყოვნებლივ აცნობეთ უსაფრთხოების გუნდს.\n\n{{link}}" },
    uk: { subject: "Номер телефону вашого облікового запису змінено", body: "Вітаємо, {{name}}!\n\nАдміністратор організації {{organisation}} указав новий номер телефону для вашого облікового запису. Коди входу в SMS тепер надходять на цей номер. Якщо ви цього не очікували, негайно повідомте команду безпеки.\n\n{{link}}" },
    de: { subject: "Die Telefonnummer Ihres Kontos wurde geändert", body: "Hallo {{name}},\n\nein Administrator von {{organisation}} hat für Ihr Konto eine neue Telefonnummer hinterlegt. Anmeldecodes per SMS gehen jetzt an diese Nummer. Falls Sie das nicht erwartet haben, melden Sie es sofort Ihrem Sicherheitsteam.\n\n{{link}}" },
    fr: { subject: "Le numéro de téléphone de votre compte a été modifié", body: "Bonjour {{name}},\n\nUn administrateur de {{organisation}} a défini un nouveau numéro de téléphone pour votre compte. Les codes de connexion par SMS sont désormais envoyés à ce numéro. Si vous ne vous y attendiez pas, prévenez immédiatement votre équipe de sécurité.\n\n{{link}}" },
    ar: { subject: "تم تغيير رقم هاتف حسابك", body: "مرحبًا {{name}}،\n\nحدّد مسؤول النظام في {{organisation}} رقم هاتف جديدًا لحسابك. رموز تسجيل الدخول عبر الرسائل النصية تُرسل الآن إلى هذا الرقم. إذا لم تكن تتوقع ذلك، فأبلغ فريق الأمن فورًا.\n\n{{link}}" },
  },
} satisfies Record<"policy_reminder" | "confirmation_reminder" | "twoFactorReset" | "resetLinkIssued" | "roleChanged" | "phoneChanged", Record<Locale, Mail>>;

/** Label of the button that a link on its own line becomes in an email without a label of its own. */
export const EMAIL_BUTTON_LABEL: Record<string, string> = {
  az: "Açın",
  en: "Open",
  ru: "Открыть",
  tr: "Aç",
  ro: "Deschideți",
  ka: "გახსნა",
  uk: "Відкрити",
  de: "Öffnen",
  fr: "Ouvrir",
  ar: "فتح",
} satisfies Record<Locale, string>;

/** The button of each notification email, saying what the link does. */
export const EMAIL_BUTTON_BY_KIND: Record<string, Record<string, string>> = {
  assignment: { az: "Təlimə başlayın", en: "Start the training", ru: "Начать обучение", tr: "Eğitime başla", ro: "Începeți instruirea", ka: "ტრენინგის დაწყება", uk: "Почати навчання", de: "Schulung starten", fr: "Commencer la formation", ar: "بدء التدريب" },
  reminder: { az: "Təlimi davam etdirin", en: "Continue the training", ru: "Продолжить обучение", tr: "Eğitime devam et", ro: "Continuați instruirea", ka: "ტრენინგის გაგრძელება", uk: "Продовжити навчання", de: "Schulung fortsetzen", fr: "Continuer la formation", ar: "متابعة التدريب" },
  overdue: { az: "Təlimi davam etdirin", en: "Continue the training", ru: "Продолжить обучение", tr: "Eğitime devam et", ro: "Continuați instruirea", ka: "ტრენინგის გაგრძელება", uk: "Продовжити навчання", de: "Schulung fortsetzen", fr: "Continuer la formation", ar: "متابعة التدريب" },
  welcome: { az: "Hesabı aktivləşdirin", en: "Set up your account", ru: "Активировать учётную запись", tr: "Hesabı etkinleştir", ro: "Activați contul", ka: "ანგარიშის გააქტიურება", uk: "Активувати обліковий запис", de: "Konto einrichten", fr: "Activer le compte", ar: "تفعيل الحساب" },
  policy_reminder: { az: "Siyasəti oxuyun", en: "Read the policy", ru: "Открыть политику", tr: "Politikayı oku", ro: "Citiți politica", ka: "პოლიტიკის გახსნა", uk: "Відкрити політику", de: "Richtlinie lesen", fr: "Lire la politique", ar: "قراءة السياسة" },
  confirmation_reminder: { az: "Təsdiqləyin", en: "Confirm now", ru: "Подтвердить", tr: "Onayla", ro: "Confirmați", ka: "დადასტურება", uk: "Підтвердити", de: "Jetzt bestätigen", fr: "Valider", ar: "تأكيد" },
  manager: { az: "Əməkdaşın səhifəsini açın", en: "Open their profile", ru: "Открыть профиль сотрудника", tr: "Çalışanın profilini aç", ro: "Deschideți profilul", ka: "თანამშრომლის პროფილის გახსნა", uk: "Відкрити профіль працівника", de: "Profil öffnen", fr: "Ouvrir le profil", ar: "فتح ملف الموظف" },
} satisfies Record<string, Record<Locale, string>>;

export function emailButtonLabel(kind: string, lang: string): string {
  const labels = EMAIL_BUTTON_BY_KIND[kind] ?? EMAIL_BUTTON_LABEL;
  return labels[lang] ?? labels.en ?? EMAIL_BUTTON_LABEL.en;
}

export const WEBHOOK_EVENTS = [
  "qr.scanned",
  "simulation.risky",
  "simulation.reported",
  "attestation.completed",
  "risk.threshold_crossed",
  "phishing.clicked",
  "issue.reported",
  "admin.audit",
  "threat.reported",
  "incident.created",
  "sandbox.malicious",
] as const;

/** The audit log is the evidence of the administrators' own actions: when it is purged at all, it is kept at least this long. */
export const MIN_AUDIT_MONTHS = 12;

/**
 * Teachable-moment loop (services/teachable.ts): the micro-lesson is due `lesson` days after the click; the
 * re-simulation follows `resim` days after it is completed, or `fallback` days after it was assigned.
 */
export const TEACHABLE_DAYS = { lesson: 7, resim: 14, fallback: 21 } as const;
/** Slug prefix of the hidden per-organisation micro-lesson module of a simulation template. */
export const TEACHABLE_PREFIX = "teachable:";

export function defaultSettings(locale = "az"): TenantSettings {
  return {
    defaultLocale: locale,
    locales: [...LOCALES],
    timeZone: DEFAULT_TIME_ZONE,
    protection: { contentProtection: true, watermark: true },
    learning: { timeLimits: true, refresher: true, riskThreshold: 67, dailyGoalXp: 50, teachable: true },
    retention: { auditMonths: 0, learningMonths: 0 },
    attestationText: { ...DEFAULT_ATTESTATION },
    certificate: { publicLink: true },
    notifications: { firstReminderDays: 3, urgentReminderHours: 24, overdueNotice: true, managerAlerts: true, failedSimulations: 2, overdueDays: 7 },
    // Secure by default: every console role sets up two-step verification before the console opens.
    identity: { requireAdmin2fa: true, maxDevices: null, ssoEnabled: false },
    email: { enabled: false },
    integrations: { webhookEnabled: false, webhookEvents: [], syslogEnabled: false },
    security: { supportAccessUntil: null },
  };
}

/** The IANA time zones Settings → Languages offers; ICU lists Kyiv by its old name and leaves out UTC. */
export const TIME_ZONES: readonly string[] = ["UTC", ...Intl.supportedValuesOf("timeZone").map((z) => (z === "Europe/Kiev" ? "Europe/Kyiv" : z))];

/** Any named zone the runtime can format, so a saved alias never falls back to Baku when ICU renames it. Offsets such as "+03:00" are refused: Postgres reads them with the opposite sign. */
export function isTimeZone(v: unknown): v is string {
  if (typeof v !== "string" || !/^[A-Za-z]/.test(v)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

type Group = Record<string, unknown>;
const group =(v: unknown): Group => (v && typeof v === "object" && !Array.isArray(v) ? (v as Group) : {});

/** Texts per language; a single string saved by an older release belongs to the organisation's default language. */
function perLocale(v: unknown, defaultLocale: string): Record<string, string> | undefined {
  if (typeof v === "string") return v.trim() ? { [defaultLocale]: v } : undefined;
  const entries = Object.entries(group(v)).filter((e): e is [string, string] => typeof e[1] === "string" && !!e[1].trim());
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function certificateWithDefaults(d: TenantSettings["certificate"], stored: Group, defaultLocale: string): TenantSettings["certificate"] {
  const out = { ...d, ...stored } as TenantSettings["certificate"];
  const title = perLocale(stored.title, defaultLocale);
  const text = perLocale(stored.text, defaultLocale);
  delete out.title;
  delete out.text;
  return { ...out, ...(title ? { title } : {}), ...(text ? { text } : {}) };
}

/**
 * Stored settings over the current defaults, group by group. A tenant row written by an older
 * release (or with a group missing) then reads like a complete one: a key added later gets its
 * default instead of undefined. Values that are optional by design (identity.sso, identity.ldap,
 * notification templates, the integration targets) are kept exactly as stored.
 */
export function withDefaults(raw: unknown): TenantSettings {
  const r = group(raw) as Partial<TenantSettings> & Group;
  const d = defaultSettings(typeof r.defaultLocale === "string" && r.defaultLocale ? r.defaultLocale : "az");
  const integrations = group(r.integrations);
  return {
    ...r,
    defaultLocale: d.defaultLocale,
    locales: Array.isArray(r.locales) && r.locales.length ? r.locales.filter((l): l is string => typeof l === "string") : d.locales,
    timeZone: isTimeZone(r.timeZone) ? r.timeZone : d.timeZone,
    protection: { ...d.protection, ...group(r.protection) },
    learning: { ...d.learning, ...group(r.learning) },
    retention: { ...d.retention, ...group(r.retention) },
    attestationText: { ...d.attestationText, ...group(r.attestationText) } as Record<string, string>,
    certificate: certificateWithDefaults(d.certificate, group(r.certificate), d.defaultLocale),
    notifications: { ...d.notifications, ...group(r.notifications) },
    identity: { ...d.identity, ...group(r.identity) },
    email: { ...d.email, ...group(r.email) },
    integrations: {
      ...d.integrations,
      ...integrations,
      webhookEvents: Array.isArray(integrations.webhookEvents) ? integrations.webhookEvents.filter((e): e is string => typeof e === "string") : [],
    },
    security: { ...d.security, ...group(r.security) },
  } as TenantSettings;
}

/** Plans (docs/business pricing): each adds to the one before. */
export const PLAN_FEATURES = {
  essentials: ["learning", "league", "certificates", "policies", "campaigns", "reports", "lab", "paths", "support", "feedback", "live_sessions"],
  professional: ["ai_tutor", "tutor_voice", "sms_voice", "qr_trap", "sandbox", "threat_intake", "incidents", "risk_profiles", "sso", "integrations", "compliance_pack", "studio"],
  enterprise_hrm: ["closed_loops", "approvals", "threat_intel", "policy_intel", "leadership", "ops_center"],
} as const;
/**
 * Features no plan includes and the operator console cannot switch on: only the demo seed sets them, on the
 * fictional demo organisation. `live_drill` plays a time-compressed phishing attack with synthetic responses
 * from the organisation's people, so it must never reach real employees.
 */
export const SEED_ONLY_FEATURES = ["live_drill"] as const;
export type Feature =
  | (typeof PLAN_FEATURES.essentials)[number]
  | (typeof PLAN_FEATURES.professional)[number]
  | (typeof PLAN_FEATURES.enterprise_hrm)[number]
  | (typeof SEED_ONLY_FEATURES)[number];

/** Every feature an operator can override from /super: the plans' ones, never SEED_ONLY_FEATURES. */
export const ALL_FEATURES: readonly Feature[] = [...PLAN_FEATURES.essentials, ...PLAN_FEATURES.professional, ...PLAN_FEATURES.enterprise_hrm];

export function featuresFor(plan: "essentials" | "professional" | "enterprise_hrm", overrides: Record<string, boolean> = {}): Set<Feature> {
  const list: Feature[] = [...PLAN_FEATURES.essentials];
  if (plan !== "essentials") list.push(...PLAN_FEATURES.professional);
  if (plan === "enterprise_hrm") list.push(...PLAN_FEATURES.enterprise_hrm);
  const set = new Set<Feature>(list);
  for (const [k, v] of Object.entries(overrides)) {
    if (v) set.add(k as Feature);
    else set.delete(k as Feature);
  }
  return set;
}

/** The report address learners may forward suspicious mail to; none while the plan has no integrations or no secret exists (/api/inbound refuses then). */
export function reportAddress(tenant: { features: ReadonlySet<Feature>; settings: TenantSettings }): string | undefined {
  return tenant.features.has("integrations") && tenant.settings.integrations.inboundSecretHash ? tenant.settings.integrations.inboundAddress : undefined;
}
