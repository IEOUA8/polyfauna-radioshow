import test from 'node:test';
import assert from 'node:assert/strict';
import { findSecurityIssues } from '../tools/security-check.js';

test('detecta secretos y endpoints reales hardcodeados', () => {
  const findings = findSecurityIssues([
    {
      file: 'src/example.js',
      content: `
        const url = 'https://abcdefghijklmnopqrst.supabase.co';
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByb2QiLCJyb2xlIjoiYW5vbiJ9.signature_part_long_enough';
        const key = 'pub_prod_abcdefghijklmnopqrstuvwxyz';
        const jwk = { "d": "abcdefghijklmnopqrstuvwxyz1234567890" };
      `,
    },
  ]);

  assert.equal(findings.length, 4);
  assert.ok(findings.some(item => item.includes('URL real de Supabase')));
  assert.ok(findings.some(item => item.includes('JWT hardcodeado')));
  assert.ok(findings.some(item => item.includes('Wompi key')));
  assert.ok(findings.some(item => item.includes('JWK privada')));
});

test('detecta archivos de entorno versionados', () => {
  const findings = findSecurityIssues([
    { file: '.env.production', content: 'SUPABASE_SERVICE_ROLE_KEY=secret' },
    { file: '.env.example', content: 'SUPABASE_SERVICE_ROLE_KEY=placeholder' },
  ]);

  assert.deepEqual(findings, ['.env.production: archivo de entorno no debe estar versionado']);
});

test('permite placeholders documentados y archivos ignorados', () => {
  const findings = findSecurityIssues([
    { file: '.env.example', content: 'WOMPI_PUBLIC_KEY=pub_test_xxx\nVITE_SUPABASE_URL=https://your-project.supabase.co' },
    { file: 'README.md', content: 'No comitear keys como pub_prod_abcdefghijklmnopqrstuvwxyz' },
    { file: 'docs/security.md', content: 'https://abcdefghijklmnopqrst.supabase.co' },
    { file: 'package-lock.json', content: 'https://abcdefghijklmnopqrst.supabase.co' },
  ]);

  assert.deepEqual(findings, []);
});
