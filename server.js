const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store
const procedures = new Map();

// Static metadata
const FRAMEWORKS = [
  { id: 'grpc', name: 'gRPC' },
  { id: 'rmi', name: 'Java RMI' },
  { id: 'netremoting', name: '.NET Remoting' }
];

const PROTOCOLS_BY_FRAMEWORK = {
  grpc: ['tcp', 'udp'], // gRPC real: TCP; incluimos UDP para cumplir en prototipo
  rmi: ['tcp'],
  netremoting: ['tcp']
};

const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

app.get('/api/frameworks', (_req, res) => {
  res.json(FRAMEWORKS);
});

app.get('/api/protocols', (req, res) => {
  const { framework } = req.query;
  const list = PROTOCOLS_BY_FRAMEWORK[framework] || ['tcp'];
  res.json(list);
});

app.get('/api/methods', (_req, res) => {
  res.json(METHODS);
});

// CRUD de procedimientos
app.get('/api/procedures', (_req, res) => {
  res.json(Array.from(procedures.values()));
});

app.get('/api/procedures/:id', (req, res) => {
  const item = procedures.get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  res.json(item);
});

app.post('/api/procedures', (req, res) => {
  const { name, framework, protocol, method, params, implementation, description } = req.body;
  if (!name || !framework || !protocol || !method) {
    return res.status(400).json({ error: 'name, framework, protocol y method son obligatorios' });
  }
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const item = {
    id,
    name,
    framework,
    protocol,
    method,
    params: Array.isArray(params) ? params : [],
    implementation: implementation || 'return { ok: true };',
    description: description || '',
    createdAt
  };
  procedures.set(id, item);
  res.status(201).json(item);
});

app.put('/api/procedures/:id', (req, res) => {
  const current = procedures.get(req.params.id);
  if (!current) return res.status(404).json({ error: 'No encontrado' });
  const updated = { ...current, ...req.body, id: current.id };
  procedures.set(updated.id, updated);
  res.json(updated);
});

app.delete('/api/procedures/:id', (req, res) => {
  procedures.delete(req.params.id);
  res.status(204).end();
});

// Ejecución de procedimiento (prueba)
app.post('/api/procedures/:id/invoke', (req, res) => {
  const item = procedures.get(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });

  const args = req.body?.args || {};

  // Validación básica de parámetros
  for (const p of item.params || []) {
    if (p.required && !(p.name in args)) {
      return res.status(400).json({ error: `Falta parámetro requerido: ${p.name}` });
    }
    if (p.name in args && p.type) {
      const val = args[p.name];
      const t = typeof val;
      if (p.type === 'number' && t !== 'number') return res.status(400).json({ error: `El parámetro ${p.name} debe ser number` });
      if (p.type === 'boolean' && t !== 'boolean') return res.status(400).json({ error: `El parámetro ${p.name} debe ser boolean` });
      if (p.type === 'string' && t !== 'string') return res.status(400).json({ error: `El parámetro ${p.name} debe ser string` });
    }
  }

  // Simulación de ejecución acorde al protocolo seleccionado
  // Nota: Para seguridad, limitamos el contexto a 'args'. La implementación debe acceder via args.<param>
  let result;
  try {
    const fn = new Function('args', `"use strict"; ${wrapImplementation(item.implementation)}`);
    result = fn(args);
  } catch (e) {
    return res.status(400).json({ error: 'Error al ejecutar implementación', details: String(e?.message || e) });
  }

  res.json({
    ok: true,
    framework: item.framework,
    protocol: item.protocol,
    method: item.method,
    result
  });
});

function wrapImplementation(impl) {
  // Si el usuario escribió solo un cuerpo (con return), lo usamos tal cual.
  // Si escribió una expresión, la convertimos en return <expr>;
  const trimmed = String(impl || '').trim();
  const looksLikeFunction = /^function\s*\(|^\(.*\)\s*=>|^async\s+function/.test(trimmed);
  if (looksLikeFunction) {
    // Se espera que devuelva un valor al ser llamado con (args)
    return `return (${trimmed})(args);`;
  }
  const hasReturn = /\breturn\b/.test(trimmed);
  return hasReturn ? trimmed : `return (${trimmed});`;
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`RPC Lab escuchando en http://localhost:${PORT}`);
});
