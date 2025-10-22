/* global fetch */
const api = {
  frameworks: () => fetch('/api/frameworks').then(r => r.json()),
  protocols: (fw) => fetch(`/api/protocols?framework=${encodeURIComponent(fw)}`).then(r => r.json()),
  methods: () => fetch('/api/methods').then(r => r.json()),
  list: () => fetch('/api/procedures').then(r => r.json()),
  create: (body) => fetch('/api/procedures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  remove: (id) => fetch(`/api/procedures/${id}`, { method: 'DELETE' }),
  invoke: (id, args) => fetch(`/api/procedures/${id}/invoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args }) }).then(r => r.json())
};

const state = {
  params: []
};

function el(sel, root = document) { return root.querySelector(sel); }
function els(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function option(value, text) {
  const o = document.createElement('option');
  o.value = value; o.textContent = text;
  return o;
}

async function loadSelectors() {
  const fwSel = el('#framework');
  const protocolSel = el('#protocol');
  const methodSel = el('#method');

  const frameworks = await api.frameworks();
  fwSel.innerHTML = '';
  frameworks.forEach(f => fwSel.appendChild(option(f.id, f.name)));

  async function refreshProtocols() {
    const fw = fwSel.value;
    const protocols = await api.protocols(fw);
    protocolSel.innerHTML = '';
    protocols.forEach(p => protocolSel.appendChild(option(p, p.toUpperCase())));
  }

  async function refreshMethods() {
    const methods = await api.methods();
    methodSel.innerHTML = '';
    methods.forEach(m => methodSel.appendChild(option(m, m)));
  }

  fwSel.addEventListener('change', refreshProtocols);

  await refreshProtocols();
  await refreshMethods();
}

function renderParams() {
  const list = el('#paramsList');
  list.innerHTML = '';
  if (!state.params.length) {
    const p = document.createElement('p');
    p.textContent = 'Sin parámetros definidos';
    list.appendChild(p);
  } else {
    state.params.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'param-row';
      row.innerHTML = `
        <code>${p.name}</code>
        <span class="badge">${p.type}</span>
        ${p.required ? '<span class="badge primary">requerido</span>' : ''}
        <button type="button" data-idx="${idx}" class="rm">Quitar</button>
      `;
      row.querySelector('.rm').addEventListener('click', (e) => {
        const i = Number(e.currentTarget.getAttribute('data-idx'));
        state.params.splice(i, 1);
        renderParams();
      });
      list.appendChild(row);
    });
  }
}

function hookParamAdder() {
  el('#addParam').addEventListener('click', () => {
    const name = el('#paramName').value.trim();
    const type = el('#paramType').value;
    const required = el('#paramRequired').checked;
    if (!name) return;
    if (state.params.find(p => p.name === name)) {
      alert('Ya existe un parámetro con ese nombre');
      return;
    }
    state.params.push({ name, type, required });
    el('#paramName').value = '';
    renderParams();
  });
}

function serializeForm() {
  return {
    name: el('#name').value.trim(),
    description: el('#description').value.trim(),
    framework: el('#framework').value,
    protocol: el('#protocol').value,
    method: el('#method').value,
    params: state.params.slice(),
    implementation: el('#implementation').value
  };
}

async function refreshList() {
  const container = el('#procedures');
  container.innerHTML = '';
  const list = await api.list();
  if (!list.length) {
    container.innerHTML = '<p>Aún no hay procedimientos creados.</p>';
    return;
  }
  const tpl = el('#procCardTpl');
  list.forEach(item => {
    const node = tpl.content.cloneNode(true);
    node.querySelector('.title').textContent = item.name;
    node.querySelector('.meta').textContent = `${item.framework} · ${item.protocol.toUpperCase()} · ${item.method}`;
    node.querySelector('.description').textContent = item.description || '';
    node.querySelector('.params').innerHTML = (item.params || []).map(p => `
      <span class="badge">${p.name}:${p.type}${p.required ? '!' : ''}</span>
    `).join(' ');

    node.querySelector('.delete').addEventListener('click', async () => {
      if (confirm('¿Eliminar procedimiento?')) {
        await api.remove(item.id);
        await refreshList();
      }
    });

    node.querySelector('.invoke').addEventListener('click', () => openInvoke(item));

    container.appendChild(node);
  });
}

function fieldForParam(p) {
  const wrap = document.createElement('label');
  wrap.className = 'invoke-field';
  wrap.textContent = `${p.name} (${p.type})`;
  let input;
  if (p.type === 'boolean') {
    input = document.createElement('select');
    input.appendChild(option('true', 'true'));
    input.appendChild(option('false', 'false'));
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.placeholder = p.type;
  }
  input.name = p.name;
  input.required = !!p.required;
  wrap.appendChild(input);
  return wrap;
}

function coerce(type, v) {
  if (type === 'number') return Number(v);
  if (type === 'boolean') return v === 'true' || v === true;
  return String(v);
}

function openInvoke(item) {
  const dlg = el('#invokeDialog');
  el('#invokeName').textContent = item.name;
  const fields = el('#invokeFields');
  fields.innerHTML = '';
  (item.params || []).forEach(p => fields.appendChild(fieldForParam(p)));
  el('#invokeResult').textContent = '';
  dlg.returnValue = '';
  dlg.showModal();

  const submit = async (e) => {
    e?.preventDefault?.();
    const inputs = els('input,select', fields);
    const args = {};
    for (const inp of inputs) {
      if (!inp.value && inp.required) {
        alert(`Falta ${inp.name}`);
        return;
      }
      if (inp.value) {
        const def = (item.params || []).find(p => p.name === inp.name);
        args[inp.name] = coerce(def?.type, inp.value);
      }
    }
    const out = await api.invoke(item.id, args);
    el('#invokeResult').textContent = JSON.stringify(out, null, 2);
  };

  el('#invokeBtn').onclick = submit;
}

async function main() {
  await loadSelectors();
  hookParamAdder();
  renderParams();
  await refreshList();

  el('#procForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = serializeForm();
    if (!data.name) return;
    const saved = await api.create(data);
    if (saved?.error) {
      el('#saveMsg').textContent = `Error: ${saved.error}`;
      el('#saveMsg').classList.add('error');
      return;
    }
    el('#saveMsg').textContent = 'Guardado';
    el('#saveMsg').classList.remove('error');
    // Reset parcial
    el('#name').value = '';
    el('#description').value = '';
    el('#implementation').value = '';
    state.params = [];
    renderParams();
    await refreshList();
    setTimeout(() => { el('#saveMsg').textContent = ''; }, 1200);
  });
}

window.addEventListener('DOMContentLoaded', main);
