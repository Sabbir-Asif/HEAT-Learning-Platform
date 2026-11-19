const certificateNumberPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export const normaliseCertificateNumber = (raw: string): string | null => {
  const compact = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{12}$/.test(compact)) return null;
  const number = `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8)}`;
  return certificateNumberPattern.test(number) ? number : null;
};
