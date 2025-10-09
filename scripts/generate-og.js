import { Resvg } from '@resvg/resvg-js'
import { writeFile } from 'fs/promises'

const width = 1200
const height = 630

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1f3bff" />
      <stop offset="45%" stop-color="#7a5cff" />
      <stop offset="100%" stop-color="#ff5da2" />
    </linearGradient>
    <linearGradient id="badge" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff7e8" />
      <stop offset="100%" stop-color="#ffe0f7" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#0f172acc" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <g filter="url(#shadow)" transform="translate(120, 130)">
    <rect width="960" height="400" rx="32" fill="#0f172ad9" />
    <g transform="translate(60, 70)">
      <rect width="220" height="52" rx="26" fill="url(#badge)" />
      <text x="110" y="35" text-anchor="middle" font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif" font-size="24" font-weight="600" fill="#0f172a">
        SEO &amp; AEO Deep Insight
      </text>
      <text x="0" y="120" font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif" font-size="76" font-weight="700" fill="#f8fafc">
        SEOer 的 AEO/GEO 小幫手
      </text>
      <text x="0" y="200" font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif" font-size="32" font-weight="500" fill="#cbd5f5">
        Gemini 驅動的一鍵分析：8 大 SEO 指標、可信度佐證、優化建議一次到位。
      </text>
      <g transform="translate(0, 260)">
        <circle cx="22" cy="22" r="22" fill="#38bdf8" />
        <path d="M19.1 25.4l-6-6.1 3-3 3 3 7.9-7.9 3 3-10.9 10.9z" fill="#0f172a"/>
        <text x="60" y="30" font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif" font-size="30" font-weight="600" fill="#f8fafc">
          一鍵貼上內容，就能獲得 Gemini 深度診斷
        </text>
      </g>
    </g>
  </g>
</svg>`

const resvg = new Resvg(svg, {
  fitTo: {
    mode: 'width',
    value: width,
  },
  background: '#0f172a'
})

const pngData = resvg.render().asPng()

await writeFile(new URL('../public/og-image.png', import.meta.url), pngData)

console.log('Generated public/og-image.png')
