// Controlos, eventos e utilitários de interface.
export const $ = s => document.querySelector(s);
const logEl = $('#log');
let toastT;

export const fmt = b => b >= 2 ** 30 ? (b / 2 ** 30).toFixed(2) + ' GB' : (b / 2 ** 20).toFixed(1) + ' MB';

export function log(t, cls = '') {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = `[${new Date().toLocaleTimeString()}] ${t}`;
  logEl.append(d);
  while (logEl.childElementCount > 500) logEl.firstChild.remove();
  logEl.scrollTop = logEl.scrollHeight;
}

export function toast(t, err) {
  const e = $('#toast');
  e.textContent = t;
  e.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => (e.className = ''), 5000);
}
export const erro = t => { log(t, 'err'); toast(t, true); };
export const estado = (t, s) => { $('#st').textContent = t; $('#dot').dataset.s = s; };

/** Mostra o ecrã da VM ou a zona de drop. */
export function mostrarTela(v) {
  $('#drop').hidden = v;
  $('#screen').hidden = !v;
  $('#stage').classList.toggle('run', v);
}
/** Ativa/desativa botões que só fazem sentido com a VM a correr. */
export function botoes(run) {
  document.querySelectorAll('[data-run]').forEach(b => (b.disabled = !run));
}

export function recentes(lista, aoClicar) {
  const ul = $('#recentes');
  ul.innerHTML = '';
  lista.forEach(r => {
    const li = document.createElement('li');
    li.textContent = `${r.nome} (${fmt(r.tamanho)})`;
    li.title = 'Volta a selecionar este ficheiro (só guardamos metadados)';
    li.onclick = aoClicar;
    ul.append(li);
  });
}

/** Liga eventos. acoes: mapa data-a → função; acoes.iso/cd/estado recebem File. */
export function ligar(acoes) {
  document.querySelectorAll('[data-a]').forEach(b => (b.onclick = () => acoes[b.dataset.a]?.()));
  for (const [id, u] of [['ram', 'MB'], ['vga', 'MB'], ['disk', 'MB']]) {
    const i = $('#' + id), o = $('#' + id + 'o');
    const f = () => (o.textContent = i.value + ' ' + u);
    i.oninput = f; f();
  }
  $('#escala').oninput = e => acoes.escala(+e.target.value);
  for (const [id, fn] of [['f-iso', 'iso'], ['f-cd', 'cd'], ['f-estado', 'estado']]) {
    $('#' + id).onchange = e => { const f = e.target.files[0]; e.target.value = ''; f && acoes[fn](f); };
  }
  const s = $('#stage');
  ['dragenter', 'dragover'].forEach(n => s.addEventListener(n, e => { e.preventDefault(); s.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(n => s.addEventListener(n, e => { e.preventDefault(); s.classList.remove('over'); }));
  s.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; f && acoes.iso(f); });
  $('#screen').addEventListener('click', () => acoes.capturarOn());
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.altKey && !e.shiftKey && e.key !== 'Delete') acoes.capturarOff(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) acoes.capturaSolta(); });
}
