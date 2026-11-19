const SOURCE_ID_RE = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function normalizeCrawlerHosts(value: string): string[] {
  return [...new Set(value
    .split(/[\s,]+/)
    .map((host) => host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, ''))
    .filter(Boolean))];
}

export function validateCrawlerSourceInput(input: {
  id: string;
  name: string;
  allowedHosts: string[];
}): string | null {
  if (!SOURCE_ID_RE.test(input.id)) return 'ID nguồn phải 3–64 ký tự thường, số, _ hoặc -.';
  if (input.name.trim().length < 2 || input.name.trim().length > 120) {
    return 'Tên nguồn phải dài 2–120 ký tự.';
  }
  if (input.allowedHosts.length < 1 || input.allowedHosts.length > 10) {
    return 'Cần ít nhất 1 và tối đa 10 hostname được phép.';
  }
  if (input.allowedHosts.some((host) => !HOST_RE.test(host) || host.includes('..'))) {
    return 'Hostname không hợp lệ. Chỉ dùng tên miền công khai, không kèm scheme hoặc path.';
  }
  return null;
}
