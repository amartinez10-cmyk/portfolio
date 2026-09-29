# Modelo 3D propio

Si quieres cambiar la torre de PC por tu propio modelo:

1. Copia aquí tu archivo `.glb` (por ejemplo `models/mi-pc.glb`). Mejor si va comprimido con Draco.
2. Abre `js/hero-model.js` y cambia la primera constante:

   ```js
   export const MODEL_URL = "models/mi-pc.glb";
   ```

El modelo se centra y se escala solo a la altura del hueco. Si el archivo no se puede
cargar, la web usa la torre de PC procedural y lo avisa en la consola.

Los colores del neón (del 3D y de toda la web) están en `css/theme3d.css`: `--accent`,
`--accent-2` y `--accent-3`.
