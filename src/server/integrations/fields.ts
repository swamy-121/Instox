import schemaFile from "../../../config/integrations.json";

export const INTEGRATION_GROUPS = ["payments", "razorpay", "cashfree", "aliceblue", "fcm", "sms", "voice"] as const;
export type IntegrationGroup = (typeof INTEGRATION_GROUPS)[number];

export type IntegrationChoice = {
  value: string;
  label: string;
};

export type IntegrationSchemaField = {
  key: string;
  group: IntegrationGroup;
  label: string;
  secret: boolean;
  when?: string;
  options?: IntegrationChoice[];
};

export type IntegrationSelectorOption = {
  value: string;
  label: string;
  test: IntegrationGroup;
  note?: string;
};

export type IntegrationTab = {
  id: string;
  title: string;
  lede: string;
  test?: IntegrationGroup;
  selector?: {
    label: string;
    options: IntegrationSelectorOption[];
  };
  fields: IntegrationSchemaField[];
};

export type IntegrationField = {
  key: string;
  group: IntegrationGroup;
  label: string;
  secret: boolean;
  options?: string[];
};

function isGroup(value: string): value is IntegrationGroup {
  return (INTEGRATION_GROUPS as readonly string[]).includes(value);
}

function parseSchema(input: unknown): IntegrationTab[] {
  if (!input || typeof input !== "object" || !Array.isArray((input as { tabs?: unknown }).tabs)) {
    throw new Error("Integration config needs a tabs list.");
  }
  const seen = new Set<string>();
  return (input as { tabs: unknown[] }).tabs.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Each integration tab needs an id.");
    const tab = entry as Record<string, unknown>;
    const id = String(tab.id ?? "");
    const title = String(tab.title ?? "");
    const lede = String(tab.lede ?? "");
    if (!id || !title || !lede) throw new Error("Each integration tab needs an id, title, and lede.");
    const test = tab.test === undefined ? undefined : String(tab.test);
    if (test !== undefined && !isGroup(test)) throw new Error(`Unknown test target ${test}.`);
    const selector = parseSelector(tab.selector);
    if (!test && !selector) throw new Error(`Tab ${id} needs a connection test.`);
    const fields = parseFields(tab.fields, selector);
    for (const field of fields) {
      if (seen.has(field.key)) throw new Error(`Duplicate integration field ${field.key}.`);
      seen.add(field.key);
    }
    return { id, title, lede, test: test as IntegrationGroup | undefined, selector, fields };
  });
}

function parseSelector(input: unknown): IntegrationTab["selector"] {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object") throw new Error("Integration selector is invalid.");
  const selector = input as Record<string, unknown>;
  const label = String(selector.label ?? "");
  if (!label || !Array.isArray(selector.options) || selector.options.length === 0) {
    throw new Error("Integration selector needs a label and options.");
  }
  const options = selector.options.map((option) => {
    if (!option || typeof option !== "object") throw new Error("Integration selector option is invalid.");
    const row = option as Record<string, unknown>;
    const value = String(row.value ?? "");
    const optionLabel = String(row.label ?? "");
    const test = String(row.test ?? "");
    if (!value || !optionLabel || !isGroup(test)) throw new Error("Integration selector option needs a value, label, and test.");
    const note = row.note === undefined ? undefined : String(row.note);
    return { value, label: optionLabel, test, note };
  });
  return { label, options };
}

function parseFields(input: unknown, selector: IntegrationTab["selector"]): IntegrationSchemaField[] {
  if (!Array.isArray(input)) throw new Error("Integration tab needs fields.");
  const allowed = new Set(selector?.options.map((option) => option.value) ?? []);
  return input.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Integration field is invalid.");
    const field = entry as Record<string, unknown>;
    const key = String(field.key ?? "");
    const group = String(field.group ?? "");
    const label = String(field.label ?? "");
    if (!key || !label || !isGroup(group) || typeof field.secret !== "boolean") {
      throw new Error("Integration field needs a key, group, label, and secret flag.");
    }
    const when = field.when === undefined ? undefined : String(field.when);
    if (when && !allowed.has(when)) throw new Error(`Field ${key} depends on an unknown choice ${when}.`);
    const options = parseChoices(field.options);
    return { key, group, label, secret: field.secret, when, options };
  });
}

function parseChoices(input: unknown): IntegrationChoice[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw new Error("Integration choices must be a list.");
  return input.map((choice) => {
    if (!choice || typeof choice !== "object") throw new Error("Integration choice is invalid.");
    const row = choice as Record<string, unknown>;
    if (typeof row.value !== "string" || typeof row.label !== "string" || !row.label) {
      throw new Error("Integration choice needs a value and a label.");
    }
    return { value: row.value, label: row.label };
  });
}

export const INTEGRATION_TABS: IntegrationTab[] = parseSchema(schemaFile);

export const INTEGRATION_FIELDS: IntegrationField[] = INTEGRATION_TABS.flatMap((tab) =>
  tab.fields.map((field) => ({
    key: field.key,
    group: field.group,
    label: field.label,
    secret: field.secret,
    options: field.options?.map((option) => option.value),
  })),
);

export const INTEGRATION_KEYS = INTEGRATION_FIELDS.map((field) => field.key);

export function integrationField(key: string): IntegrationField | undefined {
  return INTEGRATION_FIELDS.find((field) => field.key === key);
}

export function fieldsForTab(tab: IntegrationTab, selection: string): IntegrationSchemaField[] {
  return tab.fields.filter((field) => !field.when || field.when === selection);
}

export function tabSelection(tab: IntegrationTab, preferred?: string): string {
  if (!tab.selector) return "";
  if (preferred && tab.selector.options.some((option) => option.value === preferred)) return preferred;
  return tab.selector.options[0]?.value ?? "";
}

export function validFieldValue(field: IntegrationField, value: string): boolean {
  if (value.length > 500) return false;
  if (field.options) return field.options.includes(value);
  return true;
}
