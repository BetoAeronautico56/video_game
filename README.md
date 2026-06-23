# Escuadron de Tres Carriles

Juego mobile simple hecho con HTML, CSS y JavaScript puro, empaquetado como app Android con Capacitor.

El jugador controla un escuadron en tres carriles:

- Izquierda: recoge refuerzos, poderes y suministros.
- Centro: elimina enemigos antes de que lleguen a tu posicion.
- Derecha: carga un aliado poderoso disparandole hasta desbloquearlo.

## Funciones

- Menu principal con iniciar partida, puntuaciones y salir.
- Puntuaciones guardadas en el dispositivo.
- Pausa durante la partida.
- Enemigos normales, rapidos, pesados y capitanes.
- Dificultad progresiva por tiempo y rendimiento.
- Vida del jugador.
- Puntos de mejora para comprar dano, cadencia y vida maxima.
- Poder temporal a partir de los 25 segundos.
- Al llegar a 18 soldados, el carril izquierdo cambia de refuerzos a suministros.

## Archivos principales

- `index.html`: estructura visual del juego, HUD, menu, pausa, puntuaciones y botones de mejora.
- `styles.css`: estilos responsivos para pantalla movil.
- `game.js`: logica completa del juego: movimiento, enemigos, disparos, mejoras, puntuaciones, dificultad y dibujo en canvas.
- `manifest.json`: configuracion basica PWA.
- `package.json`: dependencias y scripts de Capacitor.
- `capacitor.config.json`: configuracion de Capacitor, nombre de app, app id y carpeta web.
- `android/`: proyecto Android generado por Capacitor.
- `www/`: copia generada de los archivos web para Android. No se sube a GitHub porque se regenera con `npm run sync:android`.

## Requisitos

- Node.js instalado.
- Android Studio instalado.
- JDK 21. Android Studio normalmente incluye uno en `C:\Program Files\Android\Android Studio\jbr`.
- Para publicar en Play Store: cuenta de Google Play Console y llave de firma `.jks`.

## Probar en navegador

Abre `index.html` directamente en el navegador.

## Instalar dependencias

Despues de clonar el repositorio:

```powershell
npm install
```

## Sincronizar cambios web con Android

Cada vez que edites `index.html`, `styles.css`, `game.js` o `manifest.json`, ejecuta:

```powershell
npm run sync:android
```

Ese comando copia los archivos web a `www/` y sincroniza Capacitor con Android.

## Abrir en Android Studio

```powershell
npm run open:android
```

Tambien puedes abrir manualmente la carpeta `android/` desde Android Studio.

## Crear APK de prueba

Para crear un APK debug desde terminal en Windows:

```powershell
cd android
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat assembleDebug
```

El APK se genera normalmente en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Este APK sirve para pruebas locales, no para Play Store.

## Crear version ejecutable para Play Store

Google Play usa Android App Bundle (`.aab`) para publicar.

1. Ejecuta:

```powershell
npm run sync:android
```

2. Abre Android Studio:

```powershell
npm run open:android
```

3. En Android Studio ve a:

```text
Build > Generate Signed App Bundle / APK
```

4. Selecciona:

```text
Android App Bundle
```

5. Usa tu llave `.jks`.

6. Genera la version `release`.

El archivo suele quedar en:

```text
android/app/release/app-release.aab
```

o en:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## Subir una nueva version a Play Console

Antes de generar un nuevo `.aab`, aumenta el `versionCode` en:

```text
android/app/build.gradle
```

Ejemplo:

```gradle
versionCode 4
versionName "1.3"
```

Play Console rechaza bundles que reutilizan un `versionCode` ya subido.

## Notas importantes

- No subas tu archivo `.jks` a GitHub.
- No subas APKs ni AABs generados.
- No subas `node_modules/`.
- No subas `android/local.properties`, porque contiene rutas locales de tu maquina.
