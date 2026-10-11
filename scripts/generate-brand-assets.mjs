// Run inside the app container: node scripts/generate-brand-assets.mjs
// SVG is the master; all bitmap exports use the same artwork and aspect ratio.
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const logo = await fs.readFile(path.join(root, "public/b2-logo.svg"), "utf8")
  const square = (inset, background = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${background ? `<path fill="${background}" d="M0 0h1024v1024H0z"/>` : ""}<svg x="${inset}" y="${inset}" width="${1024 - inset * 2}" height="${1024 - inset * 2}" viewBox="633 22 656 1035">${logo.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")}</svg></svg>\n`
  const icon = square(16)
  const png = (svg, width, height) => sharp(Buffer.from(svg), { density: 288 }).resize(width, height).png().toBuffer()
  const write = (name, buffer) => fs.writeFile(path.join(root, name), buffer)

  await write("app/icon.svg", icon)
  await write("public/b2-logo.png", await png(logo, 649, 1024))
  await write("public/icon-192.png", await png(icon, 192, 192))
  await write("public/icon-512.png", await png(icon, 512, 512))
  await write("public/icon-maskable-512.png", await png(square(192, "#0C0B0A"), 512, 512))
  await write("app/apple-icon.png", await png(square(64, "#0C0B0A"), 180, 180))

  // ICO entries contain lossless PNG images at each browser favicon size.
  const sizes = [16, 32, 48, 64]
  const images = await Promise.all(sizes.map(size => png(icon, size, size)))
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16
    header[entry] = size
    header[entry + 1] = size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(images[index].length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += images[index].length
  })
  await write("app/favicon.ico", Buffer.concat([header, ...images]))
  await write("public/favicon-16.png", images[0])
  await write("public/favicon-32.png", images[1])
  console.log("Generated logo, SVG/ICO favicons, Apple icon and PWA icons.")
}

main().catch(error => { console.error(error); process.exitCode = 1 })
