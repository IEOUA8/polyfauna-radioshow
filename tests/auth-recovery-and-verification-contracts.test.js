import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authContext = readFileSync('src/contexts/AuthContext.jsx', 'utf8');

test('el handler de onAuthStateChange nunca deja isLoading atascado en true', () => {
  // Bug: sin try/catch/finally, un error sin capturar en cualquier llamada
  // (consumePendingOAuthRole, notifyPendingRoleRequest, fetchUserProfile)
  // detenia la ejecucion antes de llegar a setIsLoading(false) — el boton
  // de login quedaba en "Ingresando..." para siempre.
  const handlerBody = authContext.slice(
    authContext.indexOf('supabase.auth.onAuthStateChange(async (event, session) => {'),
    authContext.indexOf("return () => subscription.unsubscribe();")
  );
  assert.match(handlerBody, /try \{/);
  assert.match(handlerBody, /\} catch \(err\) \{/);
  assert.match(handlerBody, /\} finally \{\s*setIsLoading\(false\);\s*\}/);
});

test('un evento posterior a PASSWORD_RECOVERY no apaga recoveryMode mientras sigue activo', () => {
  // Bug: Supabase puede emitir SIGNED_IN/TOKEN_REFRESHED justo despues de
  // PASSWORD_RECOVERY al procesar el mismo enlace — sin este guard, ese
  // segundo evento reseteaba recoveryMode y el usuario volvia al login
  // normal en vez de ver el formulario de nueva contraseña.
  assert.match(authContext, /const recoveryModeRef = useRef\(false\)/);
  assert.match(authContext, /if \(recoveryModeRef\.current && event !== 'SIGNED_OUT'\) \{\s*return;\s*\}/);
});

test('signup() redirige la confirmacion de correo a ?verified=1', () => {
  assert.match(authContext, /emailRedirectTo: typeof window !== 'undefined' \? `\$\{window\.location\.origin\}\/\?verified=1` : undefined/);
});

test('SIGNED_IN con ?verified=1 en la URL activa justVerified y limpia el parametro', () => {
  assert.match(authContext, /if \(event === 'SIGNED_IN' && typeof window !== 'undefined'\)/);
  assert.match(authContext, /params\.get\('verified'\) === '1'/);
  assert.match(authContext, /setJustVerified\(true\)/);
  assert.match(authContext, /params\.delete\('verified'\)/);
});

test('justVerified y clearJustVerified se exponen en el contexto', () => {
  assert.match(authContext, /justVerified, clearJustVerified/);
});
