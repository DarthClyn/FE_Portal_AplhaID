// Sample eLC values for the demo ("Fill sample data"). Dates are relative to today; the number is unique per run.
import { partnerLabels } from '@/config/portal';
import { emptyForm, type ElcForm } from '@/shared/services/elcModel';

const iso = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

export function sampleElc(): ElcForm {
  const base = emptyForm();
  const now = new Date();
  const partner = partnerLabels()[0] ?? '';
  const num = `LC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;
  return {
    fields: {
      ...base.fields,
      lcNumber: num,
      dateOfIssue: iso(0),
      expiryDate: iso(90),
      expiryPlace: 'Counters of the advising bank',
      applicableRules: 'UCP LATEST VERSION',
      applicantName: 'PT Banyak Dalam',
      applicantAddress: 'Jl. Gajah Mada No. 88, Taman Sari, Jakarta',
      beneficiaryName: 'Delta Export JSC',
      beneficiaryAddress: '25 Nguyen Hue Boulevard, Ho Chi Minh City',
      currency: 'USD',
      amount: '248500.00',
      amountTolerance: '5/5',
      availableWith: partner,
      availableBy: 'BY NEGOTIATION',
      draftsAt: 'Sight',
      drawee: partner,
      partialShipments: 'NOT ALLOWED',
      transhipment: 'ALLOWED',
      portOfLoading: 'Cat Lai Port, Ho Chi Minh City',
      portOfDischarge: 'Tanjung Priok Port, Jakarta',
      latestShipmentDate: iso(60),
      goodsDescription: '500 MT long grain white rice, 5% broken, packed in 50 kg PP bags. CFR Tanjung Priok, Incoterms 2020.',
      additionalConditions: `All documents must indicate the credit number ${num}.`,
      chargesClause: 'All charges outside the issuing bank are for the beneficiary',
      presentationPeriod: '21 days after the date of shipment',
      confirmationInstructions: 'WITHOUT',
    },
    docs: [
      { title: 'Electronic Bill of Lading (eBL)', detail: 'Full set, to the order of Bank Alpha' },
      { title: 'Commercial invoice', detail: 'Signed, 3 originals' },
      { title: 'Certificate of origin', detail: 'Issued by the competent authority' },
    ],
  };
}
