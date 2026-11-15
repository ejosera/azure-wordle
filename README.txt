Azure Wordle V2 - Instrucciones

1. Haz una copia de seguridad de tus archivos actuales.
2. Copia index.html, style.css y script.js sobre los archivos de tu proyecto.
3. CONSERVA tu carpeta data/ con allowed.json y solutions.json (no está incluida aquí).
4. Prueba con python3 -m http.server 8000 y abre http://localhost:8000.
5. Comprueba las dos modalidades y la restauración de la partida diaria al recargar.
6. Publica con git add index.html style.css script.js && git commit -m "Add daily and free Wordle modes" && git push.

Notas: La palabra cambia a las 06:00 Europe/Madrid. El progreso diario se guarda en el navegador actual. Cambiar el contenido/orden de solutions.json cambia la palabra del día. La validación y el secreto siguen en el navegador hasta introducir Azure Functions.
