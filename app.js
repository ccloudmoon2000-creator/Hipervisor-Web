// Lógica principal: estado da aplicação e ligação entre UI e VM.
import * as VM from './vm.js';
import * as UI from './ui.js';
const { $ } = UI;

const MAX_ISO = 4 * 1024 ** 3;   // limite de 4 GiB
const S = { iso: null, estado: 'parado', somOn: false, captura: false, ms: 0, ini: 0, lastI: 0 };
let serialBuf = '';

// ---------- ISO ----------
async function carregarISO(f) {
  if (!/\.iso$/i.test(f.name)) return UI.erro('O ficheiro não tem extensão .iso.');
  if (!f.size || f.size > MAX_ISO) return UI.erro('Tamanho inválido (máx. 4 GB).');
  // Validação: assinatura "CD001" do ISO 9660 no offset 0x8001
  const sig = await f.slice(0x8001, 0x8006).text();
  if (sig !== 'CD001') return UI.erro('Não parece uma ISO válida (assinatura ISO 9660 em falta).');
  desligar(true);                       // destrói a VM anterior
  S.iso = f;
  $('#isoinfo').textContent = `${f.name} · ${UI.fmt(f.size)}`;
  UI.log(`ISO carregada: ${f.name} (${UI.fmt(f.size)})`);
  guardarRecente(f);
}
function guardarRecente(f) {
  const l = lerRecentes().filter(r => r.nome !== f.name);
  l.unshift({ nome: f.name, tamanho: f.size });
  try { localStorage.setItem('vm-recentes', JSON.stringify(l.slice(0, 8))); } catch {}
  UI.recentes(lerRecentes(), () => $('#f-iso').click());
}
function lerRecentes() { try { return JSON.parse(localStorage.getItem('vm-recentes')) || []; } catch { return []; } }

// ---------- Ciclo de vida ----------
function iniciar() {
  if (!S.iso) return UI.erro('Escolhe primeiro uma ISO.');
  if (!VM.wasmOk()) return UI.erro('Este browser não suporta WebAssembly.');
  const cfg = {
    iso: S.iso, ram: +$('#ram').value, vga: +$('#vga').value, boot: $('#boot').value,
    disco: $('#usadisco').checked ? +$('#disk').value : 0, tela: $('#screen'),
  };
  UI.mostrarTela(true);
  try {
    VM.criar(cfg, {
      pronto: () => UI.log('Emulador pronto.'),
      erro: m => { UI.erro(m); UI.estado('Erro', 'err'); },
      serial: c => { if (c === '\n') { UI.log('[serial] ' + serialBuf, 'ser'); serialBuf = ''; } else serialBuf += c; },
    });
  } catch (e) {
    UI.mostrarTela(false);
    const mem = e instanceof RangeError || /memory|alloc/i.test(e.message);
    return UI.erro(mem ? 'Memória insuficiente: reduz a RAM ou o disco virtual.' : 'Erro ao iniciar: ' + e.message);
  }
  S.ms = 0; S.ini = performance.now(); S.lastI = 0; S.estado = 'run';
  VM.escala(+$('#escala').value);
  UI.estado('A executar', 'run'); UI.botoes(true);
  $('#b-iniciar').disabled = true;
  UI.log(`VM iniciada: ${cfg.ram} MB RAM, ${cfg.vga} MB vídeo, boot ${cfg.boot}${cfg.disco ? ', disco ' + cfg.disco + ' MB' : ''}`);
}
function desligar(silencio) {
  if (S.estado === 'run') S.ms += performance.now() - S.ini;
  VM.destruir(); S.estado = 'parado'; S.captura = false;
  UI.mostrarTela(false); UI.botoes(false); $('#b-iniciar').disabled = false;
  $('#b-pausa').textContent = 'Pausar'; UI.estado('Parado', 'off');
  if (silencio !== true) UI.log('VM desligada.');
}
function pausar() {
  if (S.estado === 'run') {
    VM.pausar(); S.ms += performance.now() - S.ini; S.estado = 'pausa';
    $('#b-pausa').textContent = 'Retomar'; UI.estado('Em pausa', 'pause');
  } else if (S.estado === 'pausa') {
    VM.retomar(); S.ini = performance.now(); S.estado = 'run';
    $('#b-pausa').textContent = 'Pausar'; UI.estado('A executar', 'run');
  }
}
const setCaptura = on => {
  S.captura = on; VM.capturar(on);
  $('#b-cap').textContent = on ? 'Libertar (Ctrl+Alt)' : 'Capturar';
  if (on) UI.toast('Rato e teclado capturados. Ctrl+Alt para sair.');
};

// ---------- Estado / ficheiros ----------
const baixar = (blob, nome) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nome });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
async function guardarEstado() {
  try { baixar(new Blob([await VM.guardar()]), 'estado-vm.v86state'); UI.log('Snapshot guardado.'); }
  catch (e) { UI.erro('Falha ao guardar estado: ' + e.message); }
}
async function restaurarEstado(f) {
  try { await VM.restaurar(await f.arrayBuffer()); UI.log('Snapshot restaurado.'); }
  catch (e) { UI.erro('Estado inválido ou incompatível: ' + e.message); }
}
function screenshot() {
  const c = $('#screen canvas');
  if (!c || !c.width) return UI.erro('Sem imagem gráfica para capturar (modo texto).');
  c.toBlob(b => baixar(b, `screenshot-${Date.now()}.png`));
}

// ---------- Monitor de desempenho ----------
let frames = 0, tPrev = performance.now();
const raf = () => { frames++; requestAnimationFrame(raf); };
requestAnimationFrame(raf);
setInterval(() => {
  const now = performance.now(), dt = (now - tPrev) / 1000;
  $('#s-fps').textContent = Math.round(frames / dt); frames = 0; tPrev = now;
  if (S.estado === 'parado') return;
  const n = VM.instrucoes();
  $('#s-ips').textContent = S.estado === 'run' ? ((n - S.lastI) / dt / 1e6).toFixed(1) : '0';
  S.lastI = n;
  const heap = performance.memory ? ` (JS ${UI.fmt(performance.memory.usedJSHeapSize)})` : '';
  $('#s-ram').textContent = $('#ram').value + ' MB' + heap;
  const t = Math.floor((S.ms + (S.estado === 'run' ? now - S.ini : 0)) / 1000);
  $('#s-t').textContent = [t / 3600, t / 60 % 60, t % 60].map(x => String(Math.floor(x)).padStart(2, '0')).join(':');
}, 1000);

// ---------- Ligação UI ----------
UI.ligar({
  escolher: () => $('#f-iso').click(), iso: carregarISO,
  iniciar, pausar, desligar: () => desligar(), reiniciar: () => { VM.reiniciar(); UI.log('VM reiniciada.'); },
  cad: () => VM.cad(), captura: () => setCaptura(!S.captura),
  capturarOn: () => S.estado === 'run' && !S.captura && setCaptura(true),
  capturarOff: () => S.captura && setCaptura(false),
  capturaSolta: () => { if (S.captura) setCaptura(false); },
  trocar: () => $('#f-cd').click(),
  cd: f => { try { VM.trocarCD(f); UI.log('CD trocado: ' + f.name); } catch (e) { UI.erro('Falha ao montar: ' + e.message); } },
  ejetar: () => { VM.ejetar(); UI.log('CD ejetado.'); },
  som: () => {
    S.somOn = !S.somOn;
    if (!VM.som(S.somOn)) { S.somOn = false; UI.toast('Áudio não suportado nesta build.', true); }
    $('#b-som').textContent = 'Som: ' + (S.somOn ? 'on' : 'off');
  },
  guardar: guardarEstado, restaurar: () => $('#f-estado').click(), estado: restaurarEstado,
  foto: screenshot, full: () => $('#stage').requestFullscreen?.(),
  escala: s => VM.escala(s),
});

UI.botoes(false);
UI.recentes(lerRecentes(), () => $('#f-iso').click());
if (!VM.wasmOk()) UI.erro('WebAssembly não suportado neste browser.');
if (!(window.V86 || window.V86Starter)) UI.erro('lib/libv86.js em falta. Vê o README.');
UI.log('Pronto. Arrasta uma ISO para começar.');
