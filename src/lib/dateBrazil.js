export const BRAZIL_TIMEZONE = "America/Sao_Paulo";

function getDatePartsInBrazil(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return { year, month, day };
}

function parseDateOnlyAsUTCNoon(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function normalizeDateInput(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const onlyDate = parseDateOnlyAsUTCNoon(value);
  if (onlyDate) return onlyDate;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getBrazilTodayISO() {
  const { year, month, day } = getDatePartsInBrazil(new Date());
  return `${year}-${month}-${day}`;
}

export function formatBrazilDate(value) {
  const date = normalizeDateInput(value);
  if (!date) return "-";
  return date.toLocaleDateString("pt-BR", { timeZone: BRAZIL_TIMEZONE });
}

export function formatBrazilDateTime(value) {
  const date = normalizeDateInput(value);
  if (!date) return "-";
  return date.toLocaleString("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
