# Experiencia Android y audio

Implementación local del 19 de octubre de 2026. Se mantienen `com.carlo.escuadron`, `versionName 1.3`, `versionCode 4` y las versiones de todas las dependencias. No se generó ni firmó un paquete de producción, no se publicó en Play Console y no se hicieron commits, pushes ni merges.

[Resultados de Chrome](browser-results.json) · [Resumen verificable](validation-summary.json) · [Registro Android](android-build.log) · [Ajustes de audio](after/audio-settings.png) · [Respaldo de orientación](after/orientation-fallback.png)

## Diagnóstico previo

- El juego usa HTML/CSS/JavaScript puro, Canvas 2D y Capacitor 8; la actividad Java `MainActivity` solo extendía `BridgeActivity`.
- `AndroidManifest.xml` no fijaba orientación ni ocultaba barras. `manifest.json` ya declaraba `portrait`, pero esa declaración web no configura la orientación de la actividad Android.
- Los carriles se calculan con `(lane + 0.5) * canvas.clientWidth / 3`. La altura y resolución se adaptan con `ResizeObserver` y `devicePixelRatio`. Estas fórmulas y la distribución existente no se modificaron.
- No existía un sistema de audio. El disparo es automático por descargas; cada descarga puede contener múltiples balas. El máximo es de 18 soldados y se alcanza tanto recogiendo refuerzos como activando al aliado.
- Los recursos se sincronizan desde la raíz a `www/` y después a los assets Android con `npm run sync:android`.

## Archivos modificados

| Archivo | Cambio mínimo |
| --- | --- |
| `android/app/src/main/java/com/carlo/escuadron/MainActivity.java` | Modo inmersivo al crear, reanudar y recuperar el foco de la actividad. |
| `android/app/src/main/AndroidManifest.xml` | Actividad principal `portrait` y categoría de aplicación `game`. |
| `game.js` | Conexiones de audio en eventos reales, preferencias, ciclo de vida y respaldo de orientación. Sin cambios en fórmulas ni renderer. |
| `index.html` | Tres filas nuevas dentro de Ajustes, carga del módulo de audio y aviso de orientación usando el diálogo existente. |
| `styles.css` | Solo reglas añadidas para el deslizador y el posicionamiento del aviso. Las reglas anteriores están intactas. |
| `package.json` | Inclusión de `audio-manager.js` en `copy:web`. Sin modificar versiones ni dependencias. |
| `tests/browser-check.mjs` | Opción `--mobile-audio` y salida separada de evidencias para conservar las del rediseño. |
| `README.md` | Enlace a este informe. |

Archivos nuevos: `audio-manager.js`, `tests/mobile-audio-cases.mjs`, `tests/mechanics-regression.cjs` y las evidencias de esta carpeta. Se regeneraron las copias web de `www/` y `android/app/src/main/assets/public/`, incluida la nueva copia del módulo de audio.

## Configuración Android

`MainActivity` utiliza `WindowCompat.setDecorFitsSystemWindows(false)`, `WindowInsetsControllerCompat` y `WindowInsetsCompat.Type.systemBars()`. El comportamiento `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` permite revelar temporalmente los controles del sistema mediante sus gestos, sin bloquearlos. El modo se reaplica desde `onCreate`, `onResume` y `onWindowFocusChanged(true)`, únicamente en la ventana de esta aplicación. [Documentación Android de modo inmersivo](https://developer.android.com/develop/ui/views/layout/immersive).

Se fija `android:screenOrientation="portrait"` en `.MainActivity`. No se añadió un plugin ni una segunda fuente de bloqueo de orientación. Se conserva el manifiesto web existente. La categoría `android:appCategory="game"` describe correctamente la aplicación y Android documenta una excepción para juegos a las restricciones adaptativas de Android 16. Aun así, fabricantes, multiventana y pantallas grandes pueden imponer comportamientos que requieren pruebas reales. [Orientación y restricciones de Android 16](https://developer.android.com/about/versions/16/behavior-changes-16).

Si una ventana Android ignora la orientación vertical y queda horizontal con menos de 500 px CSS de altura, se muestra un aviso con el panel ya existente y la partida se pausa. El contenido inferior queda `inert`; el audio se bloquea y los atajos no pueden reiniciar ni continuar la partida. Volver a una ventana adecuada conserva el estado y devuelve el acceso a Pausa; la reanudación sigue siendo una acción del jugador. En ventanas grandes permanece el diseño responsivo existente. Este respaldo no cambia el comportamiento horizontal del navegador normal.

SDK mínimo 24, compilación y destino 36, sin cambios. Las áreas seguras y `viewport-fit=cover` ya estaban presentes y se conservaron. No se emplearon APIs que alteren otras aplicaciones ni controles que intercepten gestos esenciales del sistema.

## Arquitectura de audio

`AudioManager` es un módulo sin dependencias, cargado antes de `game.js`. Usa un único `AudioContext`, un control de ganancia general y una salida para efectos. No se crea ningún contexto ni se reproduce audio al cargar la página: se desbloquea desde una interacción real de puntero o teclado. Si Web Audio no existe o no puede inicializarse, el juego continúa y Ajustes informa de la falta de compatibilidad. [Política y reanudación de AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume).

- **Música:** composición procedural original de ocho compases a 100 BPM, 19.2 segundos. Pads, bajo y arpegio se renderizan una sola vez mediante `OfflineAudioContext`, con procesamiento asíncrono de audio. El buffer mono de 24 kHz ocupa aproximadamente 1.84 MB y se reutiliza en un bucle. No hay solicitudes de red, descargas ni decodificación de medios.
- **Efectos:** buffers cortos sintetizados de manera perezosa en su primer uso. Se reutilizan después; se crea una fuente efímera por reproducción, como requiere `AudioBufferSourceNode`. Las fuentes se desconectan y eliminan al terminar.
- **Límites:** una voz por tipo de efecto y un máximo de siete tipos activos. Se limitan clics, movimientos y disparos demasiado próximos para evitar acumulación. El logro de soldados se valida por transición y puede repetirse inmediatamente tras bajar y volver al máximo; una voz nueva reemplaza a la anterior.
- **Pausa:** se corta la música y los efectos del juego; se permiten los sonidos breves de los botones de pausa y ayuda. No continúan disparos ni movimientos sonoros mientras la partida está detenida.
- **Segundo plano:** visibilidad, foco, `pagehide` y eventos nativos de App mantienen bloqueos independientes. Mientras alguno está activo, se detienen las voces y se suspende el contexto. Recuperar un foco no cancela un bloqueo distinto. Reanudar respeta las preferencias y las restricciones del navegador.
- **Navegación:** menú, puntuaciones, ajustes y tutorial abierto desde menú comparten una única pista. Iniciar partida hace una salida breve de la música. Tutorial desde pausa conserva el silencio del juego. Resultados no mantiene música en bucle.
- **Ajustes:** Música, Efectos de sonido y Volumen general se integran con las filas existentes. Se guardan como `musicEnabled`, `effectsEnabled` y `masterVolume` en `escuadron-ui-v1`; no se modifica la clave ni el contenido de las puntuaciones. El volumen se actualiza durante el gesto y se persiste al finalizarlo.

El audio no se actualiza en cada fotograma. Los ganchos están en el clic válido de un botón, el cambio real de carril, `shoot()` una vez por descarga, la disminución efectiva de vida, las dos rutas reales de reclutamiento, la eliminación efectiva de enemigos y el incremento del porcentaje visible de carga del aliado. Se evita un segundo clic en los botones de dirección y se cubren los botones de confirmación aunque detengan la propagación del evento.

## Recursos y procedencia

No se añadieron archivos `.mp3`, `.ogg` o `.wav`. Los sonidos existen como buffers en memoria generados por el código físico `audio-manager.js`. La música y efectos son síntesis y secuencias originales escritas para este proyecto; no utilizan muestras, música comercial ni recursos descargados.

| Recurso procedural | Duración | Uso |
| --- | --- | --- |
| `renderMenuMusic()` | 19.2 s en bucle | Ambiente del menú, 100 BPM, pads, bajo y arpegio. |
| `button` | 55 ms | Botones de navegación y gestión de la partida. |
| `move` | 120 ms | Desplazamiento válido de carril. |
| `shoot` | 90 ms | Una señal arcade por descarga real. |
| `damage` | 280 ms | Daño efectivo, timbre grave diferente del disparo. |
| `maxSoldiers` | 660 ms | Confirmación ascendente de cuatro notas al alcanzar 18. |
| `enemyDefeat` | 180 ms | Señal de eliminación, una vez por enemigo y con limitación de ráfagas. |
| `allyCharge` | 70 ms de buffer | Pulso suave al subir el porcentaje visible del aliado; el tono aumenta con su carga. |

La secuencia y los sonidos procedurales nuevos se ofrecen bajo **CC0-1.0**, sin exigir atribución; no se aplica esa declaración a recursos ni código anteriores del juego. El código del proyecto conserva la licencia ISC declarada en `package.json`. [Texto de referencia de CC0](https://creativecommons.org/publicdomain/zero/1.0/).

## Validación ejecutada

| Comprobación | Resultado |
| --- | --- |
| `node --check audio-manager.js`, `game.js`, `tests/browser-check.mjs`, `tests/mobile-audio-cases.mjs` | Sintaxis válida. |
| `node tests/mechanics-regression.cjs` | **16 comparaciones deterministas aprobadas**: cuatro escenarios y cuatro semillas, contrastando el estado del motor anterior y el actual. Incluye movimiento, combate, compras, dificultad, poderes, vida y reclutamiento. |
| `node tests/browser-check.mjs --mobile-audio` | **113 comprobaciones aprobadas** en Chrome real; cero errores de consola o ejecución. Incluye las 69 comprobaciones de regresión existentes y 44 de audio, ciclo de vida y respaldo de orientación. |
| Auditoría del código previo a esta tarea | **24 funciones intactas**, incluidas todas las de dibujo, posiciones, generación y costos. Las reglas CSS previas son idénticas; solo se añadieron reglas específicas. |
| Comparación visual del menú | `after/menu-mobile.png` es idéntico byte a byte a la captura del rediseño anterior. Las nuevas filas de Ajustes y el aviso de orientación se revisaron visualmente. |
| `npm.cmd run sync:android` | Correcto. Los cinco recursos web coinciden byte a byte entre raíz, `www/` y Android. |
| `gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:assembleDebugAndroidTest --offline --console=plain` | **BUILD SUCCESSFUL**. APK debug generado, una prueba unitaria aprobada y APK de pruebas instrumentadas compilado. |
| Inspección del APK debug | Los cinco archivos web empaquetados coinciden con el código actual. Manifiesto compilado con `portrait`, `appCategory=game` y versión 1.3/4. |
| `adb.exe devices` | Sin dispositivos o emuladores conectados. Las pruebas instrumentadas se compilaron, **no se ejecutaron**. |
| Inspección del AAB de producción anterior | SHA-256 sin cambios: `dc2e231a169d15048e91428c6e47bde75a6568d399f5d3e9dd46765d774df11d`. |

Las pruebas de audio utilizaron un `AudioContext` real desbloqueado mediante clics y teclado de Chrome. Se comprobaron muestras PCM no nulas y sin saturación, buffers reutilizados, límites de voces, persistencia, ausencia de reproducción automática y eventos de juego. Cambiar a una segunda pestaña verificó la visibilidad y suspensión reales del navegador. Los callbacks de Capacitor y el fallo de orientación se simularon explícitamente en Chrome: no se presentan como ejecución nativa en Android.

Gradle conserva dos advertencias previas sobre repositorios `flatDir`, sin errores de compilación. No se instalaron dependencias ni se modificaron sus versiones. Se usó el JBR de Android Studio para Gradle y Chrome con un perfil temporal aislado para las pruebas; el script cerró su servidor y navegador al terminar.

APK de prueba: `android/app/build/outputs/apk/debug/app-debug.apk`, 4,167,989 bytes. Está destinado únicamente a validación local. El AAB de producción existente no incorpora estas mejoras y no se regeneró.

## Pasos pendientes en un dispositivo

1. Instalar el APK debug y comprobar inicio vertical con navegación por tres botones y por gestos; barras ocultas, revelado temporal y ocultación posterior.
2. Girar el teléfono, desplegar notificaciones, abrir aplicaciones recientes, bloquear la pantalla y regresar. Confirmar foco, orientación, silencio en segundo plano y conservación de Pausa.
3. Evaluar sonido con altavoz y auriculares: mezcla, latencia, volumen y comodidad auditiva, especialmente en dispositivos de gama baja/media. La señal digital fue comprobada; no se afirma una escucha humana ni una medición de latencia física.
4. Probar tableta o plegable con API 36 y ventanas pequeñas. Confirmar la orientación que permita el sistema y el respaldo sin pérdida de estado.
5. Medir FPS, carga y memoria en hardware real. El diseño limita buffers y fuentes y no añade trabajo por fotograma, pero no se presenta eso como un benchmark de rendimiento Android.

No quedan funcionalidades solicitadas sin implementar. La aceptación nativa del modo inmersivo, orientación y audio en hardware queda pendiente de esas pruebas. Cualquier nuevo paquete de producción y cambio de versión requiere una instrucción posterior del usuario.

## Ampliación de efectos

Se añadieron únicamente `enemyDefeat` y `allyCharge` al sistema existente. Una eliminación ya contabilizada no repite el sonido. La carga del aliado no suena cuando el porcentaje entero permanece igual, el proyectil aún no ha llegado o el aliado ya está activado. Los eventos demasiado próximos no acumulan voces. La señal de carga reutiliza su buffer y ajusta la velocidad de reproducción para subir de tono con el porcentaje real. No se alteraron los sonidos anteriores, la música, la interfaz, las reglas ni las versiones. Los dos recursos nuevos tienen la misma procedencia original y dedicación CC0-1.0 que los sonidos procedurales anteriores.
