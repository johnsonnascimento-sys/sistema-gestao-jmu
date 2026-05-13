export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string) {
  const digits = normalizeCpf(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);

  if (digits.length <= 3) return part1;
  if (digits.length <= 6) return `${part1}.${part2}`;
  if (digits.length <= 9) return `${part1}.${part2}.${part3}`;
  return `${part1}.${part2}.${part3}-${part4}`;
}

export function isValidCpf(value: string) {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const nums = digits.split("").map((item) => Number(item));
  if (nums.some((item) => Number.isNaN(item))) return false;

  const calc = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += (nums[index] ?? 0) * (length + 1 - index);
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(9);
  const d2 = calc(10);
  return d1 === nums[9] && d2 === nums[10];
}

