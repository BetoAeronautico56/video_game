# Rediseño UX/UI de Escuadrón de Tres Carriles

Implementado y validado localmente el 18 de octubre de 2026. No se hicieron commits, pushes, merges ni despliegues.

[Abrir comparación visual de las siete interfaces](index.html) · [Resultados de Chrome](browser-results.json) · [Registro de compilación Android](android-build.log) · [Intento de pruebas en dispositivo](android-device-tests.log)

## Análisis y fuentes

El proyecto utiliza HTML5, CSS3 y JavaScript sin framework, Canvas 2D para el juego, `requestAnimationFrame` para la animación y `localStorage` para las ocho mejores puntuaciones. Node.js/npm preparan los archivos y Capacitor 8.3.4, con App 8.1.0, los integra en Android. El contenedor nativo está escrito en Java y utiliza Gradle 8.14.3 y Android Gradle Plugin 8.13.0; SDK mínimo 24 y SDK de compilación y destino 36.

Antes de editar el código se revisaron la estructura, dependencias, configuración Android, controles, funciones de combate, persistencia y navegación. No había pruebas web ni scripts de compilación web: el juego se ejecuta directamente y los cuatro archivos web se copian a `www/` y después a los assets de Android.

Se leyó el texto completo extraído del DOCX, incluida su tabla, y se inspeccionaron visualmente sus **14 imágenes incrustadas**. Estas incluyen las imágenes correspondientes a las páginas solicitadas por el usuario. Se identifican por figura y orden de imagen, sin atribuir a la extracción XML una paginación exacta de Word:

| Imágenes del documento | Contenido |
| --- | --- |
| `reference/image1.png` a `image5.png` | Cinco estados originales: menú, puntuaciones, partida, pausa y fin de partida. |
| `reference/image6.png` y `image7.png` | Arquitectura y flujo de navegación. |
| `reference/image8.png` | Wireframe 1: menú principal. |
| `reference/image9.png` | Wireframe 2: tutorial. |
| `reference/image10.png` | Wireframe 3: puntuaciones. |
| `reference/image11.png` | Wireframe 4: partida. |
| `reference/image12.png` | Wireframe 5: pausa. |
| `reference/image13.png` | Wireframe 6: resultados. |
| `reference/image14.png` | Wireframe 7: confirmación de reinicio. |

`reference/document-extracted.txt` conserva el texto y la correspondencia de imágenes. Los indicadores `page~` proceden de saltos de página guardados en el XML y son aproximados; no son una nueva renderización paginada del Word. El documento se utilizó como especificación y referencia visual, no como instrucciones independientes de la solicitud del usuario. Las frases del documento que hablan de mejoras «implementadas» se trataron como propuestas y se comprobaron contra el código real.

## Componentes y arquitectura

- **`index.html`:** pantallas semánticas, HUD, barras de progreso, tarjetas de mejora, tabla de puntuaciones, tutorial ilustrado, ajustes y diálogos. Iconos SVG reutilizables y una ilustración vectorial del menú están incorporados en el mismo archivo.
- **`styles.css`:** paleta y componentes compartidos (`screen`, `overlay`, `dialog-panel`, botones, tarjetas e indicadores), foco visible, áreas seguras, movimiento reducido y adaptación a pantallas estrechas y horizontales.
- **`game.js`:** mantiene las funciones existentes del motor y añade una capa de estado de interfaz mediante `activeScreen`, contexto de tutorial, preferencias, filtros y presentación de resultados. La lógica de navegación pasa por `showScreen`; las pantallas inactivas se ocultan y el campo queda `inert` al abrirlas.
- **`tests/browser-check.mjs`:** servidor local temporal y pruebas con Chrome por CDP, sin instalar librerías. El perfil de navegador es temporal y los datos son exclusivos de la prueba. El script cierra su navegador y servidor al terminar.
- **Prueba instrumentada Android:** se corrigió la expectativa de paquete del ejemplo generado, de `com.getcapacitor.app` a `com.carlo.escuadron`, para que coincida con el identificador real. No se modificó la configuración de la aplicación.

No se agregaron dependencias, frameworks, servicios ni recursos de red. Se conservaron `package.json`, `package-lock.json`, `manifest.json`, versiones y configuración del proyecto. Los assets de `www/` y Android se regeneraron con el script existente; se verificó que sus cuatro archivos coinciden byte a byte con los de la raíz.

## Matriz de implementación

| Pantalla | Problema original | Mejora solicitada | Cambio realizado | Archivos | Estado |
| --- | --- | --- | --- | --- | --- |
| Menú | Acciones limitadas y poca explicación de las mecánicas. | Priorizar Jugar, añadir ayuda, ajustes y referencias visuales. | Cinco acciones funcionales; título y descripción solicitados; panel de objetivos y escena de ciencia ficción. | `index.html`, `styles.css`, `game.js` | Implementada y probada. |
| Tutorial | No existía una pantalla de aprendizaje. | Cinco apartados ilustrados, Entendido y preferencia persistente. | Cinco pasos con ejemplos; introducción en la primera partida; acceso manual desde menú y pausa; retorno según el origen. | `index.html`, `styles.css`, `game.js` | Implementada y probada. |
| Puntuaciones | Lista de texto densa y duración en segundos. | Columnas, clasificación por cuatro métricas y tiempo legible. | Tabla de posición, puntos, bajas, soldados y tiempo; filtros de orden descendente; medallas; `mm:ss`/`hh:mm:ss`; campos ausentes como `—`. | `index.html`, `styles.css`, `game.js` | Implementada y probada. |
| Partida | Costos ambiguos, controles simbólicos y reinicio expuesto. | HUD claro, mejoras con nivel/costo, carriles y movimiento identificados. | Barras de vida y carga; tarjetas; costos y límites originales; controles escritos; reinicio retirado del juego activo; mensajes de recogida, bajas, daño, mejoras y aliado. | `index.html`, `styles.css`, `game.js` | Implementada y probada. |
| Pausa | Solo permitía continuar o volver al menú. | Continuar, reiniciar, ayuda y menú, conservando el estado. | Cuatro acciones; fondo oscurecido; animación detenida; tutorial contextual; reanudación sin reinicio. | `index.html`, `styles.css`, `game.js` | Implementada y probada. |
| Resultados | Resumen muy breve. | Puntos, bajas, soldados, duración, récord y comparación. | Panel completo; récord anterior leído antes de guardar; mensajes de primera marca, récord superado, empate y diferencia pendiente. | `index.html`, `styles.css`, `game.js` | Implementada y probada. |
| Reinicio | Reinicio inmediato, sin protección. | Confirmar o cancelar sin perder el estado accidentalmente. | Diálogo específico; Cancelar recibe el foco inicial; Escape cancela; foco confinado; estado/origen verificados y eventos sin propagación. | `index.html`, `styles.css`, `game.js` | Implementada y probada. |
| Ajustes | El menú propuesto incluía una opción sin pantalla existente. | Dar una acción real al botón. | Preferencias persistentes de efectos reducidos y omisión del tutorial; explicación de controles y retorno al menú. | `index.html`, `styles.css`, `game.js` | Implementada y probada. |

## Comportamientos conservados y decisiones

- Izquierda: refuerzos hasta 18 soldados; después, suministros. El rótulo cambia a **SUMINISTROS** sin cambiar la generación de objetos.
- Centro: los enemigos que llegan a la posición vertical del jugador quitan vida, independientemente del carril ocupado. El tutorial explica que hay que defender el centro y no sugiere que esquivar anule ese daño.
- Derecha: se carga al aliado disparándole hasta el umbral original de 720. Se conserva su premio de 250 puntos, hasta cuatro soldados y aumento del daño. Se corrigió la ambigüedad de un texto del wireframe que decía «elimina al aliado».
- Mejoras: costos iniciales **810, 1080 y 1350**, fórmulas y máximos de nivel **5, 4 y 4** sin cambios. Los niveles se muestran desde cero, como en el estado real, aunque el wireframe ilustra nivel uno y otros costos.
- Continúan funcionando el disparo automático, los cuatro enemigos, la dificultad progresiva y los tres poderes temporales. Los mensajes respetan la pausa y las partículas se reducen al activar movimiento reducido.
- `mechanics-comparison.json` registra la comparación exacta con el código anterior de **14 funciones**: estado inicial, posiciones, límites, costos, oleadas, selección y generación de enemigos y objetos, disparo y actualización temporal del poder. Las funciones que incorporan retroalimentación visual se probaron con escenarios de combate en Chrome.
- Se conserva la clave de puntuaciones **`escuadron-scores-v3`**, el máximo de ocho mejores registros y sus campos originales. Ordenar la tabla no modifica el almacenamiento. No se inventan campos históricos ni se borran puntuaciones del navegador del usuario.
- Las preferencias usan una clave independiente, **`escuadron-ui-v1`**. El tutorial inicial se presenta una sola vez tras completarlo; siempre puede abrirse manualmente. Si falla una escritura de almacenamiento, se informa y se conservan resultados nuevos en memoria durante la sesión.
- La comparación de récord distingue **igualar** y **superar**: con 56 puntos frente a 183, hacen falta 127 para igualar y **128 para superar**. Por eso no se reproduce literalmente el ejemplo aritméticamente ambiguo del wireframe.

## Comparación visual y adaptación

La [galería](index.html) presenta, para cada interfaz, el estado anterior, el wireframe original y la captura real del resultado. Las capturas del Word se enlazan por separado. Tutorial y confirmación se identifican como pantallas nuevas, sin inventar un estado anterior.

Se conservó la organización de los wireframes: azul eléctrico para la acción principal, turquesa para acciones secundarias, paneles azul marino, leyenda de tres carriles, iconos, tabla, pausa y resumen de resultados. La ilustración del menú es vectorial y ligera; no reproduce la imagen rasterizada de referencia ni añade una dependencia.

En escritorio y tabletas las mejoras están en una barra lateral, como en el wireframe de partida. En móvil se distribuyen en tres tarjetas compactas superiores para preservar el ancho de los carriles. Los botones táctiles comprobados tienen al menos 44 px de alto. En pantallas pequeñas el tutorial se desplaza verticalmente; el campo de juego y los controles permanecen visibles durante la partida.

El HUD se comprobó también con **35,366 puntos, 18 soldados, 7/7 de vida y aliado al 100 %**. Se ajustan las cifras largas y los iconos en pantallas estrechas. Un `ResizeObserver` adapta la resolución del canvas cuando cambia su tamaño de presentación.

Las imágenes de `before/` y `after/` son capturas reales del navegador. Los casos de combate y clasificación usan estados y puntuaciones de prueba inyectados en un perfil temporal; no son evidencia de partidas jugadas por una persona. `reference/` contiene las imágenes del documento, claramente diferenciadas de las capturas de ejecución.

## Validación ejecutada

| Comando o comprobación | Resultado |
| --- | --- |
| `npm.cmd ls --depth=0` | Dependencias existentes disponibles. No se instalaron ni actualizaron paquetes. |
| `node --check game.js` y `node --check tests/browser-check.mjs` | Sintaxis válida. |
| `node tests/browser-check.mjs` | **69 comprobaciones aprobadas** en Chrome real, sin errores de ejecución ni de consola. Resultado detallado en `browser-results.json`. |
| Comparación de funciones protegidas con `before-source/game.js` | 14 funciones idénticas; detalle en `mechanics-comparison.json`. |
| `npm.cmd run sync:android` | Copia y sincronización Capacitor correctas. Assets finales verificados contra la raíz. |
| `gradlew.bat assembleDebug testDebugUnitTest --console=plain`, con el JBR de Android Studio | **BUILD SUCCESSFUL**. APK debug generado. La prueba unitaria existente `addition_isCorrect` pasó: una prueba, cero errores y cero fallos. Es una prueba de ejemplo; la validación funcional del juego la proporciona Chrome. |
| `adb.exe devices` | Sin dispositivos o emuladores conectados. |
| `gradlew.bat connectedDebugAndroidTest --console=plain` | APK de pruebas compilado; ejecución bloqueada por **`No connected devices!`**. No se declara esta prueba como aprobada. |

Las 69 comprobaciones cubren navegación, teclado, botones, gestos táctiles, pausa congelada, ayuda contextual, foco del diálogo, cancelación y confirmación, compras y límites, colisiones de disparos, premios, daño, aliados, poderes, persistencia, resultados únicos, récords, filtros, campos históricos ausentes, datos corruptos y almacenamiento no disponible. La salida del navegador se probó sustituyendo temporalmente `window.close` para no cerrar la sesión de pruebas; el cierre nativo Android no se ejecutó.

Tamaños verificados: **320 × 568**, **390 × 844**, **768 × 1024**, **1366 × 900** y **844 × 390**. Se guardaron cinco capturas de la versión anterior y 24 del resultado, incluyendo el HUD con puntuación alta. El script utiliza Node **24.15.0** y la instalación local de Chrome. Puede configurarse otra ruta con `CHROME_PATH`; no requiere librerías adicionales.

APK final: `android/app/build/outputs/apk/debug/app-debug.apk` (desde la raíz del proyecto). Es una compilación debug para pruebas locales, no un paquete de publicación.

Los primeros intentos de Chrome y Gradle necesitaron permisos fuera del sandbox. Las ejecuciones posteriores autorizadas sí se completaron. Durante la revisión se detectó y corrigió un desbordamiento del HUD al 100 % del aliado; el resultado final de 69 comprobaciones corresponde al código corregido.

## Pendientes y límites

1. Ejecutar las pruebas instrumentadas y comprobar gestos, áreas seguras, botón Atrás y cierre nativo en un dispositivo Android o emulador. La falta de dispositivo es la única limitación de ejecución de esa suite.
2. Realizar pruebas de usabilidad con jugadores para medir las metas del documento (comprensión, navegación y satisfacción). Las pruebas automatizadas no permiten afirmar que esas metas con personas se hayan alcanzado.
3. No se generó un AAB firmado ni se publicó la aplicación; esas acciones no fueron autorizadas.

Las siete interfaces solicitadas están implementadas. Las diferencias visuales justificadas se limitan a la adaptación responsiva, los gráficos vectoriales ligeros, la semántica real del aliado, los valores originales de progresión y el cálculo estricto para superar el récord.
