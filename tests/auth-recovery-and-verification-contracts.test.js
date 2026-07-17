import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authContext = readFileSync('src/contexts/AuthContext.jsx', 'utf8');
const loginPage = readFileSync('src/pages/LoginPage.jsx', 'utf8');
const signupPage = readFileSync('src/pages/SignupPage.jsx', 'utf8');

test('el handler de onAuthStateChange nunca deja isLoading atascado en true', () => {
  // Las consultas deben ejecutarse fuera del callback para no bloquear el
  // lock interno de Supabase, y sus errores deben quedar capturados.
  const handlerBody = authContext.slice(
    authContext.indexOf('supabase.auth.onAuthStateChange((event, session) => {'),
    authContext.indexOf('let reconciling = false;')
  );
  assert.doesNotMatch(handlerBody, /onAuthStateChange\(async/);
  assert.match(handlerBody, /setIsLoading\(false\)/);
  assert.match(handlerBody, /window\.setTimeout\(\(\) => \{/);
  assert.match(handlerBody, /hydrateAuthenticatedUser\(session\.user\)\.catch/);
});

test('un evento posterior a PASSWORD_RECOVERY no apaga recoveryMode mientras sigue activo', () => {
  // Bug: Supabase puede emitir SIGNED_IN/TOKEN_REFRESHED justo despues de
  // PASSWORD_RECOVERY al procesar el mismo enlace — sin este guard, ese
  // segundo evento reseteaba recoveryMode y el usuario volvia al login
  // normal en vez de ver el formulario de nueva contraseña.
  assert.match(authContext, /const recoveryModeRef = useRef\(isRecoveryUrl\(\)\)/);
  assert.match(authContext, /if \(recoveryModeRef\.current && event !== 'SIGNED_OUT'\) \{\s*setIsLoading\(false\);\s*return;\s*\}/);
});

test('la PWA persiste y reconcilia la sesión al regresar del background', () => {
  const client = readFileSync('src/lib/customSupabaseClient.js', 'utf8');
  assert.match(client, /persistSession: true/);
  assert.match(client, /autoRefreshToken: true/);
  assert.match(client, /storage: window\.localStorage/);
  assert.match(authContext, /window\.addEventListener\('pageshow', reconcileSession\)/);
  assert.match(authContext, /document\.addEventListener\('visibilitychange', handleVisibility\)/);
  assert.match(authContext, /window\.addEventListener\('online', reconcileSession\)/);
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

test('signup() tiene timeout para que el formulario nunca quede cargando indefinidamente', () => {
  const signupBody = authContext.slice(
    authContext.indexOf("const signup = useCallback"),
    authContext.indexOf("const login = useCallback")
  );
  assert.match(signupBody, /withTimeout\(\s*supabase\.auth\.signUp\(/);
  assert.match(signupBody, /El registro tardó demasiado/);
});

test('la notificacion de solicitud de rol no bloquea el resultado del registro', () => {
  const signupBody = authContext.slice(
    authContext.indexOf("const signup = useCallback"),
    authContext.indexOf("const login = useCallback")
  );
  assert.match(signupBody, /supabase\.functions\.invoke\('send-role-request'/);
  assert.doesNotMatch(signupBody, /await supabase\.functions\.invoke\('send-role-request'/);
});

test('el formulario de registro muestra de forma persistente el error devuelto', () => {
  const submitBody = signupPage.slice(
    signupPage.indexOf('const handleSubmit = async'),
    signupPage.indexOf('return (', signupPage.indexOf('const handleSubmit = async'))
  );
  assert.match(submitBody, /if \(error\) \{\s*setFormError\(getSignupErrorMessage\(error\)\);\s*return;/);
  assert.match(signupPage, /\{formError\}/);
});

test('el formulario nunca muestra respuestas vacias de Supabase como {}', () => {
  assert.match(signupPage, /message === '\{\}'/);
  assert.match(signupPage, /problema temporal/);
});

test('login muestra credenciales incorrectas dentro del formulario y de forma accesible', () => {
  const loginSubmit = loginPage.slice(
    loginPage.indexOf('const handleSubmit = async', loginPage.indexOf('const LoginPage')),
    loginPage.indexOf('return (', loginPage.indexOf('const handleSubmit = async', loginPage.indexOf('const LoginPage')))
  );
  assert.match(loginPage, /function getLoginErrorMessage\(error\)/);
  assert.match(loginPage, /invalid_credentials/);
  assert.match(loginPage, /El correo o la contraseña no son correctos/);
  assert.match(loginSubmit, /if \(error\) \{\s*setFormError\(getLoginErrorMessage\(error\)\);\s*return;/);
  assert.match(loginPage, /id="login-error"/);
  assert.match(loginPage, /role="alert"/);
  assert.match(loginPage, /aria-invalid=\{Boolean\(formError\)\}/);
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

test('updatePassword() no fuerza cierre de sesion ni apaga recoveryMode por su cuenta, y el updateUser critico tiene timeout', () => {
  // Bug (2da vuelta): con el try/catch ya puesto, el boton seguia
  // atascado en "Guardando..." porque el `await` a signOut() colgaba con
  // una red inestable (comun en movil) — ninguna promesa que nunca se
  // resuelve ni rechaza deja correr un finally.
  //
  // Bug (3ra vuelta): quitar el await no alcanzaba — apagar recoveryMode
  // aca mismo disparaba de inmediato el efecto de LoginPage que redirige
  // en cuanto currentUser existe y recoveryMode es false, saltandose la
  // confirmacion visual y cerrando la sesion de recuperacion (que ya es
  // valida) sin necesidad. Ahora updatePassword() no toca recoveryMode ni
  // cierra sesion — ResetPasswordView decide cuando salir de recoveryMode,
  // despues de mostrar el mensaje de exito.
  const fnBody = authContext.slice(
    authContext.indexOf('const updatePassword = useCallback(async (newPassword) => {'),
    authContext.indexOf("const logout = useCallback")
  );
  assert.doesNotMatch(fnBody, /signOut/);
  assert.doesNotMatch(fnBody, /setRecoveryMode/);
  assert.match(fnBody, /withTimeout\(supabase\.auth\.updateUser\(/);
  assert.match(authContext, /function withTimeout\(/);
});

test('exitRecoveryMode se expone en el contexto para que la UI decida cuando salir del modo recuperacion', () => {
  assert.match(authContext, /const exitRecoveryMode = useCallback\(\(\) => setRecoveryMode\(false\), \[setRecoveryMode\]\);/);
  assert.match(authContext, /updatePassword, exitRecoveryMode, justVerified/);
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
  assert.match(viewBody, /const \{ updatePassword, exitRecoveryMode \} = useAuth\(\);/);
  assert.doesNotMatch(viewBody, /disabled=\{isLoading/);
  assert.doesNotMatch(viewBody, /\{isLoading \?/);
  assert.match(viewBody, /const \[submitting, setSubmitting\] = useState\(false\);/);
  assert.match(viewBody, /disabled=\{submitting\}/);
  assert.match(viewBody, /disabled=\{submitting \|\| !password \|\| !confirm\}/);
});

test('tras actualizar la contraseña, el usuario queda logueado y se lo lleva a la plataforma (no de vuelta a /login)', () => {
  // La sesion de recuperacion ya prueba que es el dueño de la cuenta;
  // pedirle iniciar sesion de nuevo es friccion innecesaria. El mensaje
  // de exito y el destino deben reflejar que ya quedo dentro de la
  // plataforma, no que debe volver a loguearse.
  const viewBody = loginPage.slice(
    loginPage.indexOf('function ResetPasswordView()'),
    loginPage.indexOf('// ── Forgot Password view')
  );
  assert.match(viewBody, /exitRecoveryMode\(\); navigate\('\/', \{ replace: true \}\)/);
  assert.doesNotMatch(viewBody, /navigate\('\/login'\)/);
  assert.match(viewBody, /contraseña ha sido actualizada exitosamente/i);
});
