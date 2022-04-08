export function trim(str: string, ch: string) {
  let start = 0,
    end = str.length

  while (start < end && str[start] === ch) ++start
  while (end > start && str[end - 1] === ch) --end

  return start > 0 || end < str.length ? str.slice(start, end) : str
}

export function trimAny(str: string, chars: string | string[]) {
  let start = 0,
    end = str.length

  while (start < end && chars.includes(str[start] as string)) ++start
  while (end > start && chars.includes(str[end - 1] as string)) --end

  return start > 0 || end < str.length ? str.slice(start, end) : str
}
