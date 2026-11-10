// "Embed a PDF copy": a readable PDF of the eLC fields, attached to the signed eLC (so the signature covers it).
import { jsPDF } from 'jspdf';
import { SECTIONS, displayValue, type ElcForm } from './elcModel';

export function elcPdfBase64(form: ElcForm): string {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const valueX = 230;
  let y = 56;
  const next = (h: number) => {
    y += h;
    if (y > H - 56) { doc.addPage(); y = 56; }
  };
  const row = (label: string, value: string) => {
    const lines = doc.splitTextToSize(value, W - 48 - valueX) as string[];
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110).text(label, 48, y);
    doc.setTextColor(17).text(lines, valueX, y);
    next(Math.max(14, lines.length * 11 + 3));
  };
  doc.setFont('helvetica', 'bold').setFontSize(16).text(`Electronic Letter of Credit ${form.fields.lcNumber ?? ''}`, 48, y);
  next(18);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110)
    .text('Copy for reading. The signed credential is the authoritative version.', 48, y);
  next(24);
  for (const s of SECTIONS) {
    const keys = s.fields.map((f) => f.key).filter((k) => form.fields[k]);
    const docs = s.id === 'documents' ? form.docs : [];
    if (!keys.length && !docs.length) continue;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(17).text(s.title, 48, y);
    next(16);
    for (const f of s.fields) if (form.fields[f.key]) row(`${f.label}${f.tag ? ` (${f.tag})` : ''}`, displayValue(f.key, form));
    docs.forEach((d, i) => row(i === 0 ? 'Documents required (46A)' : '', `${d.title}${d.detail ? ` — ${d.detail}` : ''}`));
    next(8);
  }
  return doc.output('datauristring').split(',')[1];
}
