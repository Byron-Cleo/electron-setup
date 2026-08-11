import sharp from "sharp"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..")

const src = process.argv[2] || path.join(root, "build/icon.png")
const out = process.argv[3] || path.join(root, "build/icon.ico")
const sizes = [16, 24, 32, 48, 64, 128, 256]

const srcBuf = fs.readFileSync(src)

async function pngEntry(size) {
  return sharp(srcBuf).resize(size, size, { fit: "cover" }).png().toBuffer()
}

async function bmpEntry(size) {
  const { data, info } = await sharp(srcBuf)
    .resize(size, size, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const stride = info.width * 4
  const xor = Buffer.alloc(stride * info.height)
  for (let y = 0; y < info.height; y++) {
    const srcRow = data.subarray(y * stride, (y + 1) * stride)
    const dstRow = xor.subarray((info.height - 1 - y) * stride, (info.height - y) * stride)
    for (let x = 0; x < info.width; x++) {
      const o = x * 4
      dstRow[o] = srcRow[o + 2]
      dstRow[o + 1] = srcRow[o + 1]
      dstRow[o + 2] = srcRow[o]
      dstRow[o + 3] = srcRow[o + 3]
    }
  }
  const maskStride = Math.ceil(info.width / 32) * 4
  const mask = Buffer.alloc(maskStride * info.height)
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(info.width, 4)
  header.writeInt32LE(info.height * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16)
  header.writeUInt32LE(stride * info.height + mask.length, 20)
  return Buffer.concat([header, xor, mask])
}

const dirs = []
const images = []
for (const size of sizes) {
  const data = size >= 256 ? await pngEntry(size) : await bmpEntry(size)
  const dim = size === 256 ? 0 : size
  const dir = Buffer.alloc(16)
  dir.writeUInt8(dim, 0)
  dir.writeUInt8(dim, 1)
  dir.writeUInt16LE(1, 4)
  dir.writeUInt16LE(32, 6)
  dir.writeUInt32LE(data.length, 8)
  dirs.push(dir)
  images.push(data)
}

const header = Buffer.alloc(6)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)

let offset = 6 + sizes.length * 16
images.forEach((img, i) => {
  dirs[i].writeUInt32LE(offset, 12)
  offset += img.length
})

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, Buffer.concat([header, ...dirs, ...images]))
console.log(`Wrote ${out} (${offset} bytes, sizes ${sizes.join(",")})`)
