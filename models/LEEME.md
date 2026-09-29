# Modelo 3D propio

Si quieres cambiar la torre de PC de la sala de "Sobre mí" por tu propio modelo:

1. Copia aquí tu archivo `.glb` (por ejemplo `models/mi-pc.glb`). Mejor si va comprimido con Draco.
2. Abre `js/hero-model.js` y cambia la primera constante:

   ```js
   export const MODEL_URL = "models/mi-pc.glb";
   ```

El modelo se centra y se escala solo a la altura del PC. Si el archivo no se puede
cargar, la web usa la torre de PC procedural y lo avisa en la consola. (Con un modelo propio
no hay piezas que señalar con el cursor: eso solo lo trae el PC procedural.)

Los colores de la web y del 3D (violeta, ámbar y rosa) están en `css/styles.css`: `--accent`,
`--accent-2` y `--accent-3`. Los colores de las paredes de cada sala están en `js/levels.js`
(`LEVEL_STYLE`).
