import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authContext = readFileSync('src/contexts/AuthContext.jsx', 'utf8');
const loginPage = readFileSync('src/pages/LoginPage.jsx', 'utf8');

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
  assert.match(authContext, /const recoveryModeRef = useRef\(isRecoveryUrl\(\)\)/);
  assert.match(authContext, /if \(recoveryModeRef\.current && event !== 'SIGNED_OUT'\) \{\s*return;\s*\}/);
});

test('recoveryMode se detecta leyendo la URL en el primer render, no solo esperando el evento PASSWORD_RECOVERY', () => {
  // El cliente de Supabase procesa el token de recuperacion en su propia
  // inicializacion interna (detectSessionInUrl), que arranca al crear el
  // cliente — antes de que este provider llegue a suscribirse con
  // onAuthStateChange. Si esa inicializacion gana la carrera, el evento
  // PASSWORD_RECOVERY se pierde sin nadie escuchando: el usuario veia el
  // login normal "atascado" en Ingresando... Leer el hash/query
  // directamente evita depender de esa carrera.
  assert.match(authContext, /function isRecoveryUrl\(\)/);
  assert.match(authContext, /hashParams\.get\('type'\) === 'recovery' \|\| searchParams\.get\('type'\) === 'recovery'/);
  assert.match(authContext, /const \[recoveryMode, setRecoveryModeState\] = useState\(isRecoveryUrl\)/);
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

test('la confirmacion de correo de recuperacion enviado menciona revisar spam/correo no deseado', () => {
  // Algunos proveedores de correo marcan el envio via Resend como spam;
  // sin este aviso el usuario no sabe donde buscar el enlace.
  assert.match(loginPage, /revisa tu carpeta de spam o correo no deseado/i);
});

test('updatePassword() nunca deja isLoading atascado en true', () => {
  // Bug: sin try/catch/finally, una excepcion en updateUser/signOut
  // (ej. red inestable) dejaba isLoading en true para siempre — el boton
  // "Guardar contraseña" se quedaba en "Guardando..." y los campos,
  // deshabilitados, aunque el usuario ya hubiera llenado el formulario.
  const fnBody = authContext.slice(
    authContext.indexOf('const updatePassword = useCallback(async (newPassword) => {'),
    authContext.indexOf("const logout = useCallback")
  );
  assert.match(fnBody, /try \{/);
  assert.match(fnBody, /\} catch \(err\) \{/);
  assert.match(fnBody, /\} finally \{\s*setIsLoading\(false\);\s*\}/);
});

test('ResetPasswordView usa un estado local (submitting), no el isLoading global de AuthContext', () => {
  // isLoading global tambien lo mueven consumePendingOAuthRole,
  // notifyPendingRoleRequest y fetchUserProfile en segundo plano — sin
  // relacion con este formulario. Si esas llamadas de fondo tardaban o se
  // colgaban, este boton se quedaba en "Guardando..." aunque
  // updatePassword() ya hubiera terminado. Un estado propio evita ese
  // acoplamiento.
  const viewBody = loginPage.slice(
    loginPage.indexOf('function ResetPasswordView()'),
    loginPage.indexOf('// ── Forgot Password view')
  );
  assert.match(viewBody, /const \{ updatePassword \} = useAuth\(\);/);
  assert.doesNotMatch(viewBody, /disabled=\{isLoading/);
  assert.doesNotMatch(viewBody, /\{isLoading \?/);
  assert.match(viewBody, /const \[submitting, setSubmitting\] = useState\(false\);/);
  assert.match(viewBody, /disabled=\{submitting\}/);
  assert.match(viewBody, /disabled=\{submitting \|\| !password \|\| !confirm\}/);
});
