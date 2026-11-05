/**
 * TimeRows Post-Build Static Pre-Renderer & Sitemap / AdSense Generator
 *
 * Runs automatically at the end of `npm run build`:
 * 1. Updates `public/sitemap.xml` and `dist/sitemap.xml` for all curated SEO corridors.
 * 2. Generates static `dist/from/<cityA>/to/<cityB>/index.html` pages with exact
 *    canonical URLs, titles, descriptions, JSON-LD FAQPage schema, and a crawlable
 *    24-hour timezone conversion table inside `<div id="root">` (which React
 *    seamlessly mounts over on client hydration).
 * 3. When `VITE_ADSENSE_CLIENT` (`ca-pub-XXXXXXXXXXXXXXXX`) is set, injects the
 *    AdSense verification `<meta>` and `<script>` into every built HTML page's
 *    `<head>` and writes `dist/ads.txt`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

// Allow bare .json imports in Node ESM without requiring import attributes in shared browser/Jest modules
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import fs from 'node:fs/promises';
      export async function load(url, context, nextLoad) {
        if (url.endsWith('.json')) {
          const raw = await fs.readFile(new URL(url), 'utf8');
          return { format: 'module', shortCircuit: true, source: 'export default ' + raw };
        }
        return nextLoad(url, context);
      }
    `)
);

const {
  SEO_CORRIDORS,
  buildCorridorSeoData,
  buildSitemapXml,
} = await import('../src/engine/seoCorridors.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');

function loadDotEnv() {
  const envFiles = ['.env.production.local', '.env.local', '.env.production', '.env'];
  const loaded = {};
  for (const file of envFiles) {
    const full = path.join(rootDir, file);
    if (!fs.existsSync(full)) continue;
    const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (!(key in loaded)) {
        loaded[key] = val;
      }
    }
  }
  return loaded;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectAdSenseHead(html, adsenseClient) {
  if (!adsenseClient || !adsenseClient.startsWith('ca-pub-')) return html;
  if (html.includes('name="google-adsense-account"')) return html;

  const snippet = [
    `    <meta name="google-adsense-account" content="${escapeHtml(adsenseClient)}" />`,
    `    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      adsenseClient
    )}" crossorigin="anonymous"></script>`,
  ].join('\n');

  return html.replace('</head>', `${snippet}\n  </head>`);
}

function buildCorridorBodyHtml(data) {
  const {
    fromCity,
    toCity,
    fromDisplayTag,
    toDisplayTag,
    offsetBadge,
    offsetPhrase,
    overlapHeadline,
    quickConversions,
    hourlyRows,
    faqs,
  } = data;

  const quickListHtml = (quickConversions || [])
    .map((q) => `          <li><strong>${escapeHtml(q.text)}</strong></li>`)
    .join('\n');

  const tableRowsHtml = hourlyRows
    .map((row) => {
      const dayBadge = row.dayDelta > 0 ? ' (+1d)' : row.dayDelta < 0 ? ' (-1d)' : '';
      const status = row.isGolden
        ? 'Working overlap'
        : `${fromCity.name}: ${row.fromPhase}, ${toCity.name}: ${row.toPhase}`;
      return `            <tr><td>${escapeHtml(row.fromTime)}</td><td>${escapeHtml(
        row.toTime + dayBadge
      )}</td><td>${escapeHtml(status)}</td></tr>`;
    })
    .join('\n');

  const faqsHtml = faqs
    .map(
      (f) =>
        `          <div><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`
    )
    .join('\n');

  const relatedLinksHtml = SEO_CORRIDORS.slice(0, 16)
    .map((pair) => {
      const formatSlug = (s) =>
        s
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      return `            <li><a href="/from/${pair.from}/to/${pair.to}">${escapeHtml(
        formatSlug(pair.from)
      )} to ${escapeHtml(formatSlug(pair.to))} Time Converter</a></li>`;
    })
    .join('\n');

  return `      <main style="max-width: 960px; margin: 40px auto; padding: 0 20px; font-family: system-ui, -apple-system, sans-serif;">
        <h1>${escapeHtml(fromDisplayTag)} to ${escapeHtml(toDisplayTag)} Time Difference (${escapeHtml(
    offsetBadge
  )}) &amp; Converter</h1>
        <p>
          Convert local time between <strong>${escapeHtml(fromDisplayTag)}</strong> (<code>${escapeHtml(
    fromCity.timeZone
  )}</code>) and <strong>${escapeHtml(toDisplayTag)}</strong> (<code>${escapeHtml(
    toCity.timeZone
  )}</code>). ${escapeHtml(toDisplayTag)} is ${escapeHtml(offsetPhrase)}. ${escapeHtml(
    overlapHeadline
  )}
        </p>
        <h2>Quick Hour Reference</h2>
        <ul>
${quickListHtml}
        </ul>
        <h2>24-Hour ${escapeHtml(fromCity.name)} to ${escapeHtml(toCity.name)} Time Conversion Table</h2>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(fromCity.name)} (${escapeHtml(fromCity.timeZone)})</th>
              <th>${escapeHtml(toCity.name)} (${escapeHtml(toCity.timeZone)})</th>
              <th>Schedule Status</th>
            </tr>
          </thead>
          <tbody>
${tableRowsHtml}
          </tbody>
        </table>
        <section aria-label="Frequently asked questions">
          <h2>Frequently Asked Questions</h2>
${faqsHtml}
        </section>
        <nav aria-label="Popular timezone conversions">
          <h2>More Timezone Comparisons</h2>
          <ul>
${relatedLinksHtml}
            <li><a href="/">TimeRows Home</a></li>
            <li><a href="/about.html">About TimeRows</a></li>
            <li><a href="/privacy.html">Privacy Policy</a></li>
          </ul>
        </nav>
      </main>`;
}

function renderCorridorHtml(baseHtml, data, adsenseClient) {
  let html = baseHtml;

  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(data.title)}</title>`
  );
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(data.description)}" />`
  );
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escapeHtml(data.canonicalUrl)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeHtml(data.title)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${escapeHtml(data.description)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${escapeHtml(data.canonicalUrl)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeHtml(data.title)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeHtml(data.description)}" />`
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: data.title,
        url: data.canonicalUrl,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: data.description,
      },
      {
        '@type': 'FAQPage',
        mainEntity: data.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer,
          },
        })),
      },
    ],
  };

  html = html.replace(
    /<script type="application\/ld\+json" id="timerows-jsonld">[\s\S]*?<\/script>/,
    `<script type="application/ld+json" id="timerows-jsonld">\n${JSON.stringify(
      jsonLd,
      null,
      2
    )}\n    </script>`
  );

  const bodyHtml = buildCorridorBodyHtml(data);
  html = html.replace(
    /<noscript>[\s\S]*?<\/noscript>/,
    `<noscript>\n${bodyHtml}\n    </noscript>`
  );

  return injectAdSenseHead(html, adsenseClient);
}

function run() {
  const envFromFile = loadDotEnv();
  const adsenseClient = (
    process.env.VITE_ADSENSE_CLIENT ||
    envFromFile.VITE_ADSENSE_CLIENT ||
    ''
  ).trim();

  const todayIso = new Date().toISOString().split('T')[0];

  // 1. Generate sitemap.xml in both public/ and dist/
  const sitemapXml = buildSitemapXml(SEO_CORRIDORS, todayIso);
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
  }

  if (!fs.existsSync(distDir)) {
    console.log('Updated public/sitemap.xml (dist/ not present, skipping HTML pre-render).');
    return;
  }

  const distIndexPath = path.join(distDir, 'index.html');
  const baseHtml = fs.readFileSync(distIndexPath, 'utf8');

  // 2. Inject AdSense head tags into root dist/index.html, dist/about.html, dist/privacy.html if configured
  if (adsenseClient.startsWith('ca-pub-')) {
    fs.writeFileSync(distIndexPath, injectAdSenseHead(baseHtml, adsenseClient), 'utf8');
    for (const page of ['about.html', 'privacy.html']) {
      const p = path.join(distDir, page);
      if (fs.existsSync(p)) {
        fs.writeFileSync(p, injectAdSenseHead(fs.readFileSync(p, 'utf8'), adsenseClient), 'utf8');
      }
    }

    const pubId = adsenseClient.replace(/^ca-/, '');
    const adsTxtContent = `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`;
    fs.writeFileSync(path.join(distDir, 'ads.txt'), adsTxtContent, 'utf8');
    console.log(`Configured AdSense head tags and dist/ads.txt for ${adsenseClient}`);
  }

  // 3. Pre-render static HTML pages for all SEO_CORRIDORS
  let count = 0;
  for (const pair of SEO_CORRIDORS) {
    const data = buildCorridorSeoData(pair.from, pair.to, todayIso);
    if (!data) continue;
    const outDir = path.join(distDir, 'from', pair.from, 'to', pair.to);
    fs.mkdirSync(outDir, { recursive: true });
    const rendered = renderCorridorHtml(baseHtml, data, adsenseClient);
    fs.writeFileSync(path.join(outDir, 'index.html'), rendered, 'utf8');
    count++;
  }

  console.log(
    `Pre-rendered ${count} static corridor pages and updated sitemap.xml (${
      SEO_CORRIDORS.length + 3
    } URLs).`
  );
}

run();
