<p align="center">
  <img src="public/logo.svg" width="88" alt="Ariadna: un hilo rojo dentro de un laberinto">
</p>

<h1 align="center">ariadna</h1>

<p align="center"><em>El mapa es el mazo.</em></p>

Ariadna es una aplicación para escribir mapas mentales y estudiar con repaso
espaciado sin escribir una sola tarjeta a mano. Dibujas la estructura, la
aplicación deduce las preguntas.

El nombre viene del hilo que Ariadna le da a Teseo para que pueda volver a salir
del laberinto. Acá el hilo es la estructura del mapa: sirve para no perderse
cuando toca recordar.

## Cómo se generan las tarjetas

Hay dos reglas, y nada más.

1. **Cada nodo con hijos produce una pregunta.** Si el nodo dice "Revolución
   Francesa" y cuelgan "1789", "Estados generales" y "Toma de la Bastilla", la
   tarjeta pregunta *¿Qué cuelga de «Revolución Francesa»?* y la respuesta es la
   lista de hijos.
2. **Cada `{{hueco}}` en una nota produce una tarjeta de relleno.** El texto de
   la nota se muestra con el hueco tapado y la respuesta es lo que estaba
   adentro. Una nota con tres huecos da tres tarjetas, cada una tapando un hueco
   distinto.

Las hojas sin nota no generan tarjetas. Si querés una tarjeta para una hoja,
escribile una nota con un hueco. Si querés que un nodo deje de generar su
pregunta, alcanza con plegarlo o quitarle los hijos.

## Repaso

El calendario de repasos usa [FSRS](https://github.com/open-spaced-repetition/ts-fsrs)
v5. Cada tarjeta tiene su propio historial y se califica con cuatro botones:
Otra vez, Difícil, Bien, Fácil. No hay límite diario, pero cada sesión corta en
60 tarjetas para que no se vuelva una maratón.

Cuando no queda nada pendiente, el botón Repasar abre un repaso libre con las
tarjetas que ya viste. El botón Calor pinta el mapa según tu retención por rama:
rojo donde fallás, verde donde ya está firme.

## Atajos

| Tecla | Acción |
| --- | --- |
| `Tab` | agregar hijo |
| `Enter` | agregar hermano |
| `F2` o doble clic | renombrar |
| `Espacio` | plegar o desplegar la rama |
| `Alt` + flechas arriba/abajo | mover el nodo entre hermanos |
| `Alt` + flecha derecha | sangrar |
| `Alt` + flecha izquierda | desangrar |
| `Supr` | borrar el nodo y su rama |
| `Ctrl Z` / `Ctrl Shift Z` | deshacer / rehacer |
| `Ctrl N` | abrir la nota del nodo |
| `1` a `4` | calificar durante el repaso |
| `Esc` | salir del repaso |

## Los datos son tuyos

Todo vive en IndexedDB, en tu navegador. No hay servidor, no hay cuenta y no hay
telemetría. Podés exportar el mapa a JSON (con el historial de repasos) o a
Markdown (para leerlo en cualquier lado), y volver a importarlo después. El
Markdown usa una lista con guiones y dos espacios por nivel, así que también
sirve para traer apuntes escritos en otro editor.

## Correrlo

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # pruebas del dominio
npm run build    # build de producción en dist/
```

La aplicación es un cliente estático: se puede publicar `dist/` en cualquier
hosting de archivos.

## Cómo está armado

- React 19 y TypeScript, sin framework de UI.
- El editor del mapa es SVG a mano: layout con `d3-hierarchy`, zoom y paneo
  propios, edición en línea con un input superpuesto.
- Estado global con Zustand, con deshacer y rehacer de 60 pasos.
- Persistencia con Dexie sobre IndexedDB.
- Dominio puro y probado con Vitest: árbol, derivación de tarjetas, Markdown y
  programación de repasos, sin tocar el DOM.

```
src/
  domain/    tipos, árbol, tarjetas, markdown, FSRS
  db/        Dexie
  state/     store de Zustand
  ui/        Canvas, Toolbar, NotePanel, Review
  lib/       exportar e importar archivos
tests/       pruebas del dominio
```

## Lo que falta

- Arrastrar nodos para reordenar con el mouse.
- Varias selecciones y edición en lote.
- Un modo de repaso por etiquetas o colores.
- Sincronización opcional entre dispositivos.

## Licencia

MIT. Ver [LICENSE](LICENSE).
