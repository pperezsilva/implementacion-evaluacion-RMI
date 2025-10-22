# RPC Lab

Sistema web minimal para crear y probar procedimientos remotos con un flujo de selección:
1) Llamada remota (gRPC, RMI, .NET Remoting)
2) Protocolo (TCP/UDP)
3) Método (GET/POST/PUT/DELETE)
4) Parámetros e implementación

Este prototipo ejecuta la implementación en el servidor (Node.js) usando los parámetros enviados y devuelve el resultado, simulando la invocación acorde a la selección realizada.

## Ejecutar

1) Instala dependencias

```powershell
npm install
```

2) Arranca el servidor

```powershell
npm start
```

3) Abre en el navegador

```
http://localhost:3000
```

## Uso rápido
- Completa el formulario: nombre, framework, protocolo, método.
- Añade parámetros (nombre, tipo, requerido).
- Escribe implementación que use `args`, por ejemplo:

```js
return args.a + args.b;
```

o

```js
({ suma: args.a + args.b })
```

- Guarda y luego pulsa “Probar” para invocar con valores.

## Notas
- Este es un laboratorio/simulador. No despliega servidores gRPC/RMI/.NET Remoting reales; la implementación se evalúa en Node para permitir pruebas rápidas del contrato y parámetros.
- Puedes extender `server.js` para generar plantillas de servidor/cliente por framework si lo necesitas.
