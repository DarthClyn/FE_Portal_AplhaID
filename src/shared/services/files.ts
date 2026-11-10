// File helpers: read uploads, trigger downloads, build CSV.

export const readText = (f: File) => f.text();

export async function readJson(f: File): Promise<unknown> {
  const text = await f.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${f.name} is not valid JSON.`);
  }
}

export function readBase64(f: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadJson = (value: unknown, filename: string) =>
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), filename);

export function downloadCsv(rows: (string | number | null | undefined)[][], filename: string) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  downloadBlob(new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }), filename);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
