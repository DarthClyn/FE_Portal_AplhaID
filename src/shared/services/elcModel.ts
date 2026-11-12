// eLC data model for the portal: the MT700 fields the TOTM Trust API signs (see totm-trust-api src/elc.js ELC_FIELDS),
// grouped into the form sections of the design, with labels, MT700 tags, required flags and validation.
import { PORTAL, bankLabel, homeBankLabel, partnerByBic, partnerByLabel, partnerInText, partnerLabels } from '@/config/portal';
import { fmtAmount, fmtDate } from './format';

export type FieldKind = 'text' | 'textarea' | 'select' | 'date' | 'segmented' | 'readonly' | 'partner';

export interface Option { value: string; label: string }

export interface FieldDef {
  key: string;
  label: string;
  tag: string;
  kind: FieldKind;
  required?: boolean;
  options?: Option[];
  wide?: boolean;
}

export type SectionId = 'credit' | 'parties' | 'amount' | 'availability' | 'shipment' | 'documents' | 'banks' | 'attachments';

export interface SectionDef {
  id: SectionId;
  title: string;
  fields: FieldDef[];
  optional?: boolean;
}

export interface DocItem { title: string; detail: string }

export interface ElcForm {
  fields: Record<string, string>;
  docs: DocItem[];
}

const opts = (...pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

export const SECTIONS: SectionDef[] = [
  {
    id: 'credit', title: 'Credit', fields: [
      { key: 'lcNumber', label: 'Documentary credit number', tag: '20', kind: 'text', required: true },
      { key: 'formOfCredit', label: 'Form of credit', tag: '40A', kind: 'select', required: true,
        options: opts(['IRREVOCABLE', 'Irrevocable'], ['IRREVOCABLE TRANSFERABLE', 'Irrevocable transferable']) },
      { key: 'dateOfIssue', label: 'Date of issue', tag: '31C', kind: 'date', required: true },
      { key: 'applicableRules', label: 'Applicable rules', tag: '40E', kind: 'select', required: true,
        options: opts(['UCP LATEST VERSION', 'UCP latest version'], ['EUCP LATEST VERSION', 'eUCP latest version'],
          ['UCPURR LATEST VERSION', 'UCP + URR latest version'], ['ISP LATEST VERSION', 'ISP latest version']) },
      { key: 'expiryDate', label: 'Expiry date', tag: '31D', kind: 'date', required: true },
      { key: 'expiryPlace', label: 'Place of expiry', tag: '31D', kind: 'text', required: true },
      { key: 'sequenceOfTotal', label: 'Sequence of total', tag: '27', kind: 'readonly', required: true },
      { key: 'referenceToPreAdvice', label: 'Reference to pre-advice', tag: '23', kind: 'text' },
    ],
  },
  {
    id: 'parties', title: 'Parties', fields: [
      { key: 'applicantName', label: 'Applicant', tag: '50', kind: 'text', required: true },
      { key: 'beneficiaryName', label: 'Beneficiary', tag: '59', kind: 'text', required: true },
      { key: 'applicantAddress', label: 'Applicant address', tag: '50', kind: 'text', required: true },
      { key: 'beneficiaryAddress', label: 'Beneficiary address', tag: '59', kind: 'text', required: true },
      { key: 'issuingBankName', label: 'Issuing bank', tag: '', kind: 'readonly', required: true },
      { key: 'applicantBank', label: 'Applicant bank', tag: '51a', kind: 'text' },
    ],
  },
  {
    id: 'amount', title: 'Amount', fields: [
      { key: 'amount', label: 'Currency & amount', tag: '32B', kind: 'text', required: true, wide: true },
      { key: 'amountTolerance', label: 'Amount tolerance (%)', tag: '39A', kind: 'text', required: true },
      { key: 'additionalAmountsCovered', label: 'Additional amounts covered', tag: '39C', kind: 'text' },
    ],
  },
  {
    id: 'availability', title: 'Availability & payment', fields: [
      { key: 'availableWith', label: 'Available with', tag: '41a', kind: 'partner', required: true },
      { key: 'draftsAt', label: 'Drafts at', tag: '42C', kind: 'select', required: true,
        options: opts(['Sight', 'Sight'], ['30 days after sight', '30 days after sight'], ['60 days after sight', '60 days after sight'], ['90 days after sight', '90 days after sight']) },
      { key: 'availableBy', label: 'Available by', tag: '41a', kind: 'segmented', required: true, wide: true,
        options: opts(['BY PAYMENT', 'Payment'], ['BY ACCEPTANCE', 'Acceptance'], ['BY NEGOTIATION', 'Negotiation'], ['BY DEF PAYMENT', 'Deferred payment']) },
      { key: 'drawee', label: 'Drawee', tag: '42a', kind: 'partner', required: true },
      { key: 'negotiationDeferredPaymentDetails', label: 'Deferred payment details', tag: '42P', kind: 'text' },
    ],
  },
  {
    id: 'shipment', title: 'Shipment', optional: true, fields: [
      { key: 'partialShipments', label: 'Partial shipments', tag: '43P', kind: 'segmented', options: opts(['ALLOWED', 'Allowed'], ['NOT ALLOWED', 'Not allowed']) },
      { key: 'transhipment', label: 'Transhipment', tag: '43T', kind: 'segmented', options: opts(['ALLOWED', 'Allowed'], ['NOT ALLOWED', 'Not allowed']) },
      { key: 'portOfLoading', label: 'Port of loading', tag: '44E', kind: 'text' },
      { key: 'portOfDischarge', label: 'Port of discharge', tag: '44F', kind: 'text' },
      { key: 'latestShipmentDate', label: 'Latest date of shipment', tag: '44C', kind: 'date' },
      { key: 'shipmentPeriod', label: 'Shipment period', tag: '44D', kind: 'text' },
      { key: 'goodsDescription', label: 'Description of goods', tag: '45A', kind: 'textarea', wide: true },
    ],
  },
  {
    id: 'documents', title: 'Documents & conditions', fields: [
      { key: 'additionalConditions', label: 'Additional conditions', tag: '47A', kind: 'textarea', wide: true },
      { key: 'chargesClause', label: 'Charges', tag: '71D', kind: 'select', required: true,
        options: opts(['All charges outside the issuing bank are for the beneficiary', 'Outside the issuing bank, for beneficiary'],
          ['All charges are for the applicant', 'All charges for applicant'], ['All charges are for the beneficiary', 'All charges for beneficiary']) },
      { key: 'presentationPeriod', label: 'Period for presentation', tag: '48', kind: 'text', required: true },
      { key: 'confirmationInstructions', label: 'Confirmation instructions', tag: '49', kind: 'segmented', required: true, wide: true,
        options: opts(['WITHOUT', 'Without'], ['CONFIRM', 'Confirm'], ['MAY ADD', 'May add']) },
    ],
  },
  {
    id: 'banks', title: 'Banks & instructions', optional: true, fields: [
      { key: 'reimbursingBank', label: 'Reimbursing bank', tag: '53a', kind: 'text' },
      { key: 'advisingBankName', label: 'Advise through bank', tag: '57a', kind: 'text' },
      { key: 'instructionsToBank', label: 'Instructions to the paying bank', tag: '78', kind: 'textarea', wide: true },
      { key: 'senderToReceiverInfo', label: 'Sender to receiver information', tag: '72Z', kind: 'textarea', wide: true },
    ],
  },
  { id: 'attachments', title: 'Attachments', optional: true, fields: [] },
];

export const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
export const fieldDef = (key: string) => ALL_FIELDS.find((f) => f.key === key);

/** Required items counted in "22 / 22 required": the required fields + the documents list. */
export const REQUIRED_KEYS = [...ALL_FIELDS.filter((f) => f.required).map((f) => f.key), 'documentsRequired'];

export const CURRENCIES = ['USD', 'EUR', 'SGD', 'IDR', 'VND', 'JPY', 'CNY'];

export function emptyForm(): ElcForm {
  return {
    fields: {
      sequenceOfTotal: '1/1',
      issuingBankName: homeBankLabel(),
      formOfCredit: 'IRREVOCABLE',
      applicableRules: 'UCP LATEST VERSION',
      dateOfIssue: new Date().toISOString().slice(0, 10),
      currency: 'USD',
      draftsAt: 'Sight',
      availableBy: 'BY NEGOTIATION',
      availableWith: partnerLabels()[0] ?? '',
      drawee: partnerLabels()[0] ?? '',
      partialShipments: 'ALLOWED',
      transhipment: 'NOT ALLOWED',
      confirmationInstructions: 'WITHOUT',
      amountTolerance: '5/5',
    },
    docs: [],
  };
}

const filled = (v?: string) => !!v && v.trim() !== '';

export type Errors = Record<string, string>;

export function validate(form: ElcForm): Errors {
  const f = form.fields;
  const e: Errors = {};
  for (const k of REQUIRED_KEYS) {
    if (k === 'documentsRequired') {
      if (!form.docs.some((d) => filled(d.title))) e.documentsRequired = 'Add at least one document';
    } else if (!filled(f[k])) e[k] = 'Required';
  }
  if (!filled(f.currency)) e.amount = 'Required';
  if (filled(f.amount) && !(Number(f.amount.replace(/,/g, '')) > 0)) e.amount = 'Enter an amount above 0';
  if (filled(f.dateOfIssue) && filled(f.expiryDate) && f.expiryDate <= f.dateOfIssue) e.expiryDate = 'Must be after the date of issue';
  if (filled(f.latestShipmentDate) && filled(f.expiryDate) && f.latestShipmentDate > f.expiryDate) e.latestShipmentDate = 'Must be on or before the expiry date';
  if (filled(f.amountTolerance) && !/^\d{1,2}\/\d{1,2}$/.test(f.amountTolerance.trim())) e.amountTolerance = 'Use plus/minus, e.g. 5/5';
  return e;
}

export const requiredDone = (errors: Errors) => REQUIRED_KEYS.filter((k) => !errors[k]).length;

export const sectionErrors = (s: SectionDef, errors: Errors) =>
  [...s.fields.map((f) => f.key), ...(s.id === 'documents' ? ['documentsRequired'] : [])].filter((k) => errors[k]);

export const optionLabel = (key: string, value?: string) => fieldDef(key)?.options?.find((o) => o.value === value)?.label ?? value ?? '';

export function shortGoods(g?: string, max = 48) {
  const first = (g ?? '').split(/[.\n]/)[0].trim();
  if (first.length <= max) return first;
  return `${first.slice(0, first.lastIndexOf(' ', max) > 20 ? first.lastIndexOf(' ', max) : max).replace(/[,;:]$/, '')}…`;
}

/** One-line summary of a section, shown when it is collapsed (as in the design). */
export function sectionSummary(id: SectionId, form: ElcForm, attachmentCount = 0): string {
  const f = form.fields;
  const parts = (...xs: (string | undefined | false)[]) => xs.filter(Boolean).join(' · ');
  switch (id) {
    case 'credit': return parts(optionLabel('formOfCredit', f.formOfCredit), f.expiryDate && `expires ${fmtDate(f.expiryDate)}`);
    case 'parties': return f.applicantName || f.beneficiaryName ? `${f.applicantName || '—'} → ${f.beneficiaryName || '—'}` : '';
    case 'amount': return parts(f.amount && fmtAmount(f.currency, f.amount), f.amountTolerance && `tolerance ±${f.amountTolerance.split('/')[0]}%`);
    case 'availability': return f.availableWith ? `${f.availableWith}, by ${optionLabel('availableBy', f.availableBy).toLowerCase()}` : '';
    case 'shipment': return shortGoods(f.goodsDescription);
    case 'documents': return form.docs.length ? `${form.docs.length} document${form.docs.length === 1 ? '' : 's'}` : '';
    case 'banks': return parts(f.reimbursingBank, f.advisingBankName);
    case 'attachments': return attachmentCount ? `${attachmentCount} file${attachmentCount === 1 ? '' : 's'}` : '';
  }
}

const ALIASES: Record<string, string> = {
  applicantBankName: 'applicantBank', preAdviceReference: 'referenceToPreAdvice',
  reimbursingBankName: 'reimbursingBank', instructionsToPayingBank: 'instructionsToBank',
};
const API_KEYS = new Set([...ALL_FIELDS.map((f) => f.key), 'currency', 'documentsRequired',
  'mixedPaymentDetails', 'placeOfTakingInCharge', 'placeOfFinalDestination', 'specialPaymentConditionsBeneficiary',
  'specialPaymentConditionsReceivingBank', 'requestedConfirmationParty']);

const splitDoc = (s: string): DocItem => {
  const [title, ...rest] = s.split(' — ');
  return { title: title.trim(), detail: rest.join(' — ').trim() };
};

/** Reads eLC data from JSON: a signed eLC (credentialSubject), { data: {...} } or flat MT700 fields. */
export function formFromJson(input: unknown, base: ElcForm = emptyForm()): { form: ElcForm; ignored: string[]; count: number } {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const src = (o.credentialSubject ?? o.data ?? o) as Record<string, unknown>;
  const form: ElcForm = { fields: { ...base.fields }, docs: [...base.docs] };
  const ignored: string[] = [];
  let count = 0;
  for (const [raw, v] of Object.entries(src)) {
    const k = ALIASES[raw] ?? raw;
    if (k === 'type' || k === 'id') continue;
    if (k === 'documentsRequired') {
      const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : [];
      form.docs = list.map((x) => splitDoc(String(x))).filter((d) => d.title);
      count += form.docs.length;
    } else if (API_KEYS.has(k) && v != null && typeof v !== 'object') {
      form.fields[k] = String(v).trim();
      count += 1;
    } else if (k === 'advisingBankBic' || k === 'issuingBankBic') {
      count += 1; // set from the partner / home bank when issuing
    } else ignored.push(raw);
  }
  // Available with (the advising bank) must be one of the partner banks: match it by BIC, then by name.
  for (const key of ['availableWith', 'drawee'] as const) {
    if (partnerLabels().includes(form.fields[key] ?? '')) continue;
    const p = (key === 'availableWith' ? partnerByBic(src.advisingBankBic as string) : null) ?? partnerInText(form.fields[key]);
    if (p) form.fields[key] = bankLabel(p.name, p.jurisdiction);
  }
  return { form, ignored, count };
}

/** Body "data" for POST /admin/elc/issue. */
export function apiData(form: ElcForm): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(form.fields)) if (filled(v) && API_KEYS.has(k)) data[k] = v.trim();
  if (typeof data.amount === 'string') data.amount = data.amount.replace(/,/g, '');
  const docs = form.docs.filter((d) => filled(d.title)).map((d) => (filled(d.detail) ? `${d.title.trim()} — ${d.detail.trim()}` : d.title.trim()));
  if (docs.length) data.documentsRequired = docs;
  // BICs, as in PILA's eLCs: the advising bank's inbox checks advisingBankBic.
  data.issuingBankBic = PORTAL.bank.bic;
  const advising = partnerByLabel(form.fields.availableWith);
  if (advising) data.advisingBankBic = advising.bic;
  return data;
}

/** Display value of a field for read-only views. */
export function displayValue(key: string, form: ElcForm): string {
  const v = form.fields[key];
  if (key === 'amount') return fmtAmount(form.fields.currency, v);
  if (fieldDef(key)?.kind === 'date') return v ? fmtDate(v) : '—';
  return optionLabel(key, v) || '—';
}

/** eLC fields of a signed credential, as a form (for read-only views). */
export const formFromVc = (vc: unknown) => formFromJson(vc, { fields: {}, docs: [] }).form;
