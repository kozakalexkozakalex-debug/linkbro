// Настройки серверов популярных почт
export const MAIL_PRESETS = {
  gmail: { label: "Gmail", imap: "imap.gmail.com", imapPort: 993, smtp: "smtp.gmail.com", smtpPort: 465 },
  outlook: { label: "Outlook / Hotmail", imap: "outlook.office365.com", imapPort: 993, smtp: "smtp.office365.com", smtpPort: 587 },
  ukrnet: { label: "ukr.net", imap: "imap.ukr.net", imapPort: 993, smtp: "smtp.ukr.net", smtpPort: 465 },
} as const;
export type MailPreset = keyof typeof MAIL_PRESETS;
