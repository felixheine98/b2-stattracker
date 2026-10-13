import { BASE_PATH } from "@/lib/base-path"

// next dev uses the orange artwork on desktop, phones and the sign-in screen.
export function BrandLogo({ className }: { className?: string }) {
  const isDev = process.env.NODE_ENV === "development"

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${BASE_PATH}/${isDev ? "b2-logo-dev.svg?v=orange-20261013" : "b2-logo.svg?v=lion-20261011"}`}
      alt={isDev ? "B2 Stats – Dev" : ""}
      className={className}
    />
  )
}
