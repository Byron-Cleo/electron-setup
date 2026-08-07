import sharp from "sharp"
import toIco from "to-ico"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..")

const src = process.argv[2] || path.join(root, "public/images/logo/eraeva-logo.png")
const out = process.argv[3] || path.join(root, "build/icon.ico")
const sizes = [16, 24, 32, 48, 64, 128, 256]

const srcBuf = fs.readFileSync(src)
const pngs = await Promise.all(
  sizes.map((size) =>
    sharp(srcBuf).resize(size, size, { fit: "cover" }).png().toBuffer(),
  ),
)
const ico = await toIco(pngs)

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, ico)
console.log(`Wrote ${out} (${ico.length} bytes, sizes ${sizes.join(",")})`)
