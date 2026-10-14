// Who may edit tournaments. This list only decides what the UI shows — the real gate is in
// firestore.rules and storage.rules, which carry their own copy of it (rules can't import
// from here). Keep all three in sync when adding or removing an admin.
export const ADMIN_EMAILS = ['fabriciocpacheco@gmail.com', 'oreiastreamer@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
