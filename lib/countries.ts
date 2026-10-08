// Selectable countries; each needs a flag in public/flags (SVGs from the flag-icons project, MIT)
const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "de", name: "Deutschland" },
  { code: "at", name: "Österreich" },
]

export function isCountryCode(code: string): boolean {
  return COUNTRIES.some((c) => c.code === code)
}

export function countryOptions(): Array<{ code: string; name: string }> {
  return COUNTRIES
}
