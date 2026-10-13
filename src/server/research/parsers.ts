export type BhavBar = {
  symbol: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OiRow = {
  underlying: string;
  tradeDate: string;
  expiry: string;
  strike: number;
  optionType: "CE" | "PE";
  openInterest: number;
  oiChange: number;
  ltp: number;
  iv: number | null;
  volume: number;
};

const MONTHS: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

export function parseTradeDay(value: string): string | null {
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = text.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{4})$/);
  if (!dmy) return null;
  const month = MONTHS[dmy[2].toUpperCase()];
  if (!month) return null;
  return `${dmy[3]}-${month}-${dmy[1].padStart(2, "0")}`;
}

/** Equity bhavcopy, either the older SYMBOL/SERIES file or the UDiFF column names. */
export function parseBhavcopyCsv(csv: string): BhavBar[] {
  const table = parseCsv(csv);
  if (!table) return [];
  const rows: BhavBar[] = [];
  for (const record of table.records) {
    const symbol = field(record, ["symbol", "tckrsymb", "ticker"]);
    const series = field(record, ["series", "sctysrs"]);
    if (!symbol || (series && series !== "EQ" && series !== "BE")) continue;
    const tradeDate = parseTradeDay(field(record, ["timestamp", "traddt", "date", "bizdt"]) ?? "");
    const open = num(field(record, ["open", "opnpric"]));
    const high = num(field(record, ["high", "hghpric"]));
    const low = num(field(record, ["low", "lwpric"]));
    const close = num(field(record, ["close", "clspric"]));
    const volume = num(field(record, ["tottrdqty", "ttltradgvol", "volume"]));
    if (!tradeDate || !open || !high || !low || !close || volume === null || volume < 0) continue;
    if (high < low || high < open || high < close || low > open || low > close) continue;
    rows.push({
      symbol: symbol.toUpperCase(),
      tradeDate,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return rows;
}

/** F&O bhavcopy rows that are calls or puts. */
export function parseOiCsv(csv: string): OiRow[] {
  const table = parseCsv(csv);
  if (!table) return [];
  const rows: OiRow[] = [];
  for (const record of table.records) {
    const optionType = (field(record, ["option_typ", "optntp", "optiontype"]) ?? "").toUpperCase();
    if (optionType !== "CE" && optionType !== "PE") continue;
    const underlying = field(record, ["symbol", "tckrsymb", "underlying"]);
    const tradeDate = parseTradeDay(field(record, ["timestamp", "traddt", "date", "bizdt"]) ?? "");
    const expiry = parseTradeDay(field(record, ["expiry_dt", "xprydt", "expiry"]) ?? "");
    const strike = num(field(record, ["strike_pr", "strkpric", "strike"]));
    const openInterest = num(field(record, ["open_int", "opnintrst", "oi"]));
    const oiChange = num(field(record, ["chg_in_oi", "chnginopnintrst", "oichange"])) ?? 0;
    const ltp = num(field(record, ["close", "clspric", "settle_pr", "ltp"])) ?? 0;
    const iv = num(field(record, ["iv", "impliedvolatility"]));
    const volume = num(field(record, ["contracts", "ttltradgvol", "volume"])) ?? 0;
    if (!underlying || !tradeDate || !expiry || !strike || openInterest === null || openInterest < 0 || ltp < 0) continue;
    rows.push({
      underlying: underlying.toUpperCase(),
      tradeDate,
      expiry,
      strike,
      optionType,
      openInterest,
      oiChange,
      ltp,
      iv,
      volume,
    });
  }
  return rows;
}

function parseCsv(csv: string): { records: Array<Record<string, string>> } | null {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("PK"));
  if (lines.length < 2) return null;
  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (!headers.some((header) => header.length > 0)) return null;
  const records = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });
  return { records };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function field(record: Record<string, string>, names: string[]): string | null {
  for (const name of names) {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const value = record[key];
    if (value) return value.trim();
  }
  return null;
}

function num(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
