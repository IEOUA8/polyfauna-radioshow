import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ignored = [
  /^package-lock\.json$/,
  /^docs\//,
  /^public\/sitemap\.xml$/,
  /^supabase\/auth-email-templates\//,
  /^supabase\/functions\/_shared\/email-templates\.generated\.ts$/,
];

const allowedFiles = new Set([
  '.env.example',
  'tools/security-check.js',
  'tests/security-check.test.js',
  'README.md',
]);

const checks = [
  {
    name: 'JWT hardcodeado',
    pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  },
  {
    name: 'URL real de Supabase hardcodeada',
    pattern: /https:\/\/[a-z0-9]{20}\.supabase\.co/g,
  },
  {
    name: 'AWS/R2 access key hardcodeada',
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    name: 'Wompi key hardcodeada',
    pattern: /\b(?:pub|prv)_(?:test|prod)_[A-Za-z0-9]{12,}\b/g,
  },
  {
    name: 'JWK privada hardcodeada',
    pattern: /"d"\s*:\s*"[A-Za-z0-9_-]{20,}"/g,
  },
];

export function findSecurityIssues(files) {
  const findings = [];

  for (const { file, content } of files) {
    if (allowedFiles.has(file) || ignored.some(regex => regex.test(file))) continue;
    for (const check of checks) {
      const matches = content.match(check.pattern);
      if (matches?.length) findings.push(`${file}: ${check.name}`);
    }
  }

  const envFiles = files
    .map(({ file }) => file)
    .filter(file => /^\.env($|\.|\/)/.test(file) && file !== '.env.example');
  for (const file of envFiles) findings.push(`${file}: archivo de entorno no debe estar versionado`);

  return findings;
}

function readGitFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map(file => ({ file, content: readFileSync(file, 'utf8') }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = findSecurityIssues(readGitFiles());
  if (findings.length) {
    console.error('Security check failed:');
    for (const finding of findings) console.error(`- ${finding}`);
    process.exit(1);
  }

  console.log('Security check passed');
}
