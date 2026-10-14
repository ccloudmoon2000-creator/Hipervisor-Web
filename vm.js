// Wrapper do v86: criar, destruir, estados, periféricos. Sem globais soltas.
let emu = null;

export const wasmOk = () => typeof WebAssembly === 'object';

/** Cria a VM. cfg: {iso:File, ram, vga, boot, disco, tela:HTMLElement} */
export function criar(cfg, cb) {
  destruir();
  const V = window.V86 || window.V86Starter;
  if (!V) throw new Error('libv86.js não foi carregado. Verifica a pasta /lib.');
  const o = {
    wasm_path: 'lib/v86.wasm',
    memory_size: cfg.ram * 1048576,
    vga_memory_size: cfg.vga * 1048576,
    screen_container: cfg.tela,
    bios: { url: 'lib/seabios.bin' },
    vga_bios: { url: 'lib/vgabios.bin' },
    cdrom: { buffer: cfg.iso },            // File direto: não copia a ISO inteira para a RAM
    boot_order: cfg.boot === 'cd' ? 0x213 : 0x123, // 0x213: CD→disco; 0x123: disco→CD
    autostart: true,
  };
  if (cfg.disco) o.hda = { buffer: new ArrayBuffer(cfg.disco * 1048576) };
  emu = new V(o);
  emu.add_listener('emulator-ready', () => cb.pronto?.());
  emu.add_listener('download-error', e => cb.erro?.(`Falha ao carregar "${e.file_name}". Confirma que existe em /lib.`));
  emu.add_listener('serial0-output-byte', b => cb.serial?.(String.fromCharCode(b)));
  capturar(false);
}

/** Destrói a instância (liberta memória e listeners). */
export function destruir() {
  if (!emu) return;
  try { emu.destroy(); } catch (e) { console.warn(e); }
  emu = null;
}

export const pausar = () => emu.stop();
export const retomar = () => emu.run();
export const reiniciar = () => emu.restart();
export const instrucoes = () => emu?.get_instruction_counter?.() ?? 0;
export const cad = () => emu.keyboard_send_scancodes([0x1d, 0x38, 0x53, 0xd3, 0xb8, 0x9d]);
export const escala = s => emu?.screen_set_scale?.(s, s);

/** Captura/liberta rato e teclado. */
export function capturar(on) {
  if (!emu) return;
  emu.keyboard_set_status(on);
  emu.mouse_set_status(on);
  if (on) emu.lock_mouse?.(); else document.exitPointerLock?.();
}

export const guardar = () => emu.save_state();               // → ArrayBuffer
export const restaurar = buf => emu.restore_state(buf);
export const trocarCD = f => emu.set_cdrom({ buffer: f });   // hot swap
export const ejetar = () => emu.eject_cdrom();

/** Liga/desliga o som (volume mestre do mixer). */
export function som(on) {
  const sp = emu?.speaker_adapter;
  if (!sp) return false;
  sp.audio_context?.resume?.();
  sp.mixer?.set_volume?.(on ? 1 : 0, undefined);
  return true;
}
