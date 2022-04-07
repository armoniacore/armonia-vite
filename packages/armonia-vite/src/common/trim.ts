export function trim(str: string, ch: string) {
  let start = 0,
    end = str.length

  while (start < end && str[start] === ch) ++start
  while (end > start && str[end - 1] === ch) --end

  return start > 0 || end < str.length ? str.substring(start, end) : str
}

export function trimAny(str: string, chars: string | string[]) {
  let start = 0,
    end = str.length

  while (start < end && chars.indexOf(str[start] as string) >= 0) ++start
  while (end > start && chars.indexOf(str[end - 1] as string) >= 0) --end

  return start > 0 || end < str.length ? str.substring(start, end) : str
}
