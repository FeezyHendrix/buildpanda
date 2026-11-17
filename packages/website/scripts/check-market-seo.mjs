import assert from "node:assert/strict";

// Run against a production build: node scripts/check-market-seo.mjs http://localhost:3002
const base = new URL(process.argv[2] ?? "http://localhost:3002");
const canonicalOrigin = "https://buildpanda.io";
const languages = ["en", "fr", "ar", "pt"];
const bingToken = "F939A18B18E97F1FB478642AD51DF0F5";

async function read(path) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  return response.text();
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1].toLowerCase(), match[2]]));
}

const sitemap = await read("/sitemap.xml");
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(urls).size, urls.length, "Sitemap URLs must be unique");
const marketUrls = urls.filter((url) => /\/(?:fr\/|ar\/|pt\/)?africa\//.test(url));
const countrySlugs = marketUrls.filter((url) => new URL(url).pathname.startsWith("/africa/"))
  .map((url) => new URL(url).pathname.split("/")[2]).filter(Boolean);
assert.equal(new Set(countrySlugs).size, 54, "Every African UN member country has a guide");
assert.equal(marketUrls.length, languages.length * (countrySlugs.length + 1));
const factsUrls = urls.filter((url) => /\/(?:fr\/|ar\/|pt\/)?product-facts\//.test(url));
assert.equal(factsUrls.length, languages.length);
const localizedUrls = [...marketUrls, ...factsUrls];
const allAlternates = new Map();
const descriptions = new Map(languages.map((language) => [language, new Set()]));

function decode(text) {
  return text.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

const pageTitles = new Set();

function checkTitle(html, path) {
  const title = decode(html.match(/<title>(.*?)<\/title>/s)?.[1] ?? "").trim();
  assert.ok(title.length > 0, `Nonempty page title: ${path}`);
  assert.ok([...title].length < 70, `Title must be under 70 characters including the brand: ${path} (${[...title].length}: ${title})`);
  assert.ok(!pageTitles.has(title), `Unique page title: ${path} (${title})`);
  pageTitles.add(title);
}

for (const url of localizedUrls) {
  const path = new URL(url).pathname;
  const html = await read(path);
  checkTitle(html, path);
  const language = languages.includes(path.split("/")[1]) ? path.split("/")[1] : "en";
  const document = attributes(html.match(/<html\b[^>]*>/)?.[0] ?? "");
  assert.equal(document.lang, language, path);
  assert.equal(document.dir, language === "ar" ? "rtl" : "ltr", path);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, path);
  assert.match(html, /<title>[^<]*BuildPanda[^<]*<\/title>/, path);
  const metadata = [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => attributes(match[0]));
  const description = metadata.find((meta) => meta.name === "description")?.content;
  assert.ok(description && description.length > 60, `Translated description: ${path}`);
  assert.equal(metadata.find((meta) => meta.name === "msvalidate.01")?.content, bingToken, `Bing verification: ${path}`);
  assert.ok(!metadata.some((meta) => meta.name === "robots" && meta.content.includes("noindex")), path);
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((match) => attributes(match[0]));
  assert.equal(links.find((link) => link.rel === "canonical")?.href, url, path);
  const alternates = links.filter((link) => link.rel === "alternate" && link.hreflang);
  assert.equal(alternates.length, languages.length + 1, `Only equivalent translations are alternates: ${path}`);
  assert.ok(alternates.some((link) => link.href === url), `Self alternate: ${path}`);
  const englishPath = path.replace(/^\/(fr|ar|pt)\//, "/");
  assert.equal(alternates.find((link) => link.hreflang === "x-default")?.href, `${canonicalOrigin}${englishPath}`);
  for (const link of alternates) {
    assert.ok(localizedUrls.includes(link.href), `Unpublished alternate: ${link.href}`);
    assert.equal(new URL(link.href).pathname.replace(/^\/(fr|ar|pt)\//, "/"), englishPath, `Unrelated alternate: ${path}`);
  }
  allAlternates.set(url, alternates.map((link) => ({ language: link.hreflang, url: link.href })));
  const structured = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .flatMap((match) => JSON.parse(match[1]));
  assert.ok(structured.some((item) => item["@type"] === "BreadcrumbList"), path);
  if (countrySlugs.some((slug) => path.endsWith(`/${slug}/`))) {
    const page = structured.find((item) => item["@type"] === "WebPage");
    assert.ok(page && page.inLanguage === language && page.url === url, path);
    assert.equal(new URL(page.citation).protocol, "https:", `Local source: ${path}`);
    assert.ok(html.includes(page.citation.replaceAll("&", "&amp;")), `Visible local citation: ${path}`);
    assert.ok(html.includes(`${language === "en" ? "" : "/" + language}/product-facts/`), `Product facts discoverable: ${path}`);
    descriptions.get(language).add(description);
  } else if (factsUrls.includes(url)) {
    const faq = structured.find((item) => item["@type"] === "FAQPage");
    assert.ok(faq && faq.inLanguage === language && faq.dateModified, path);
    assert.equal(faq.mainEntity.length, 7);
    const visible = decode(html.match(/<main\b[^>]*>(.*?)<\/main>/s)[1].replace(/<script\b[^>]*>.*?<\/script>/gs, "").replace(/<[^>]*>/g, ""));
    for (const question of faq.mainEntity) {
      assert.ok(visible.includes(question.name), `Visible question matches schema: ${path}`);
      assert.ok(visible.includes(question.acceptedAnswer.text), `Visible answer matches schema: ${path}`);
    }
    assert.ok(structured.some((item) => item["@type"] === "SoftwareApplication" && item["@id"] === `${canonicalOrigin}/#software`), path);
  } else {
    assert.ok(html.includes('href="/' + (language === "en" ? "" : language + "/") + 'africa/nigeria/"'), path);
  }
}

for (const [url, alternates] of allAlternates) {
  for (const alternate of alternates) {
    assert.deepEqual(allAlternates.get(alternate.url), alternates, `Reciprocal alternatives: ${url}`);
  }
}
for (const [language, values] of descriptions) assert.equal(values.size, 54, `Distinct country descriptions: ${language}`);

// Moving routes into root-layout groups must preserve every existing public URL.
for (const url of urls.filter((url) => !localizedUrls.includes(url))) {
  const path = new URL(url).pathname;
  const html = await read(path);
  checkTitle(html, path);
  const canonical = [...html.matchAll(/<link\b[^>]*>/g)].map((match) => attributes(match[0])).find((link) => link.rel === "canonical");
  assert.equal(canonical?.href, url, path);
  if (path === "/") assert.match(html, new RegExp(`<meta name="msvalidate.01" content="${bingToken}"`));
}

for (const path of ["/africa/not-a-country/", "/fr/africa/not-a-country/", "/de/africa/", "/en/africa/", "/de/product-facts/"]) {
  assert.equal((await fetch(new URL(path, base))).status, 404, `Unknown route: ${path}`);
}
const robots = await read("/robots.txt");
assert.match(robots, /Allow: \/\s/);
for (const bot of ["OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"]) {
  assert.ok(robots.includes(`User-Agent: ${bot}`), bot);
  assert.equal((await fetch(new URL("/product-facts/", base), { headers: { "User-Agent": bot } })).status, 200, bot);
}
// Country options render in a client-side popover and require browser coverage.
assert.equal(pageTitles.size, urls.length, "All public page titles checked");
console.log(`Passed: ${pageTitles.size} unique page titles under 70 characters, ${marketUrls.length} market pages, ${factsUrls.length} facts pages, source links, visible answers/schema, Bing token, language links, crawler access, existing URLs and unknown routes.`);
