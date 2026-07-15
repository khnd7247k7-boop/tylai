/**
 * Generates tyl-ai-landing/legal.html from src/constants/legalPolicies.ts
 * Run: node scripts/generate-legal-html.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const META = {
  LEGAL_COMPANY_NAME: 'Transform Your Life LLC',
  LEGAL_APP_NAME: 'TYL',
  LEGAL_APP_PRODUCT_NAME: 'TYLAI',
  LEGAL_CONTACT_EMAIL: 'travis@tyl-ai.com',
  LEGAL_GOVERNING_STATE: 'Utah',
  LEGAL_GOVERNING_COUNTRY: 'United States',
  LEGAL_WEBSITE: 'https://tyl-ai.com',
  LEGAL_EFFECTIVE_DATE: 'July 9, 2026',
  LEGAL_LAST_UPDATED: 'July 9, 2026',
};

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function interpolate(template) {
  return template.replace(/\$\{([^}]+)\}/g, (_, key) => META[key.trim()] ?? '');
}

function extractPolicyConst(src, name) {
  const marker = `export const ${name} =`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`Missing ${name}`);
  const chunk = src.slice(start);
  const templateStart = chunk.indexOf("intro('");
  const bodyStart = chunk.indexOf('`', chunk.indexOf("intro("));
  const bodyEnd = chunk.indexOf('`;', bodyStart + 1);
  const introCallEnd = chunk.indexOf(') +', templateStart);
  const introTitle = chunk.slice(templateStart + 7, introCallEnd - 1);
  const body = chunk.slice(bodyStart + 1, bodyEnd);
  return interpolate(intro(introTitle) + body);
}

function intro(title) {
  return `${title}\n${'='.repeat(title.length)}\n\nEffective Date: ${META.LEGAL_EFFECTIVE_DATE}\nLast Updated: ${META.LEGAL_LAST_UPDATED}\n\n`;
}

function policyToHtml(plain) {
  const lines = plain.split('\n');
  const parts = [];
  let inList = false;
  let skippedHeader = false;

  const closeList = () => {
    if (inList) {
      parts.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    if (!skippedHeader) {
      if (/^=+$/.test(trimmed) || /^-+$/.test(trimmed)) continue;
      if (trimmed === 'Privacy Policy' || trimmed === 'Terms of Service' || trimmed.startsWith('Fitness') || trimmed.startsWith('Artificial Intelligence')) continue;
      if (/^Effective Date:/.test(trimmed) || /^Last Updated:/.test(trimmed)) continue;
      if (trimmed.startsWith('This ') || trimmed.startsWith('IMPORTANT') || /^\d+\./.test(trimmed)) {
        skippedHeader = true;
      } else {
        continue;
      }
    }

    if (/^=+$/.test(trimmed) || /^-+$/.test(trimmed)) continue;

    if (/^\d+\.\s/.test(trimmed) && !trimmed.startsWith('•')) {
      closeList();
      parts.push(`<h3>${escapeHtml(trimmed)}</h3>`);
      continue;
    }

    if (/^\d+\.\d+\s/.test(trimmed)) {
      closeList();
      parts.push(`<h4>${escapeHtml(trimmed)}</h4>`);
      continue;
    }

    if (trimmed.startsWith('•')) {
      if (!inList) {
        parts.push('<ul>');
        inList = true;
      }
      parts.push(`<li>${escapeHtml(trimmed.slice(1).trim())}</li>`);
      continue;
    }

    if (trimmed.startsWith('IMPORTANT')) {
      closeList();
      parts.push(`<p><strong>${escapeHtml(trimmed)}</strong></p>`);
      continue;
    }

    closeList();
    parts.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  closeList();
  return parts.join('\n');
}

const src = readFileSync(join(root, 'src/constants/legalPolicies.ts'), 'utf8');
const policies = {
  PRIVACY_POLICY_CONTENT: extractPolicyConst(src, 'PRIVACY_POLICY_CONTENT'),
  TERMS_OF_SERVICE_CONTENT: extractPolicyConst(src, 'TERMS_OF_SERVICE_CONTENT'),
  FITNESS_DISCLAIMER_CONTENT: extractPolicyConst(src, 'FITNESS_DISCLAIMER_CONTENT'),
  AI_DISCLAIMER_CONTENT: extractPolicyConst(src, 'AI_DISCLAIMER_CONTENT'),
};

const sections = [
  { id: 'privacy-policy', title: 'Privacy Policy', content: policies.PRIVACY_POLICY_CONTENT },
  { id: 'terms-of-service', title: 'Terms of Service', content: policies.TERMS_OF_SERVICE_CONTENT },
  { id: 'fitness-disclaimer', title: 'Fitness &amp; Wellness Disclaimer', content: policies.FITNESS_DISCLAIMER_CONTENT },
  { id: 'ai-disclaimer', title: 'AI Disclaimer', content: policies.AI_DISCLAIMER_CONTENT },
];

const policyBlocks = sections
  .map((s) => `\n        <h2 id="${s.id}">${s.title}</h2>\n        ${policyToHtml(s.content)}`)
  .join('\n');

const templatePath = join(root, 'tyl-ai-landing/legal.template.html');
const outPath = join(root, 'tyl-ai-landing/legal.html');
let template = readFileSync(templatePath, 'utf8');
template = template.replace('<!-- POLICY_SECTIONS -->', policyBlocks);
writeFileSync(outPath, template);
console.log('Wrote', outPath);
