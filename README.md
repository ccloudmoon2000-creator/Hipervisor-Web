# Hipervisor Web (v86)

Máquina virtual x86 (32 bits) no browser. HTML/CSS/JS puro, sem build.

## 1. Descarregar o motor para `lib/`
| Ficheiro | Onde obter |
|---|---|
| `libv86.js`, `v86.wasm` | pasta `build/` do repositório https://github.com/copy/v86 (ou `npm i v86` → `node_modules/v86/build/`) |
| `seabios.bin`, `vgabios.bin` | pasta `bios/` do mesmo repositório |

Coloca os 4 ficheiros em `lib/`.

## 2. Abrir (precisa de servidor local, por causa do WebAssembly)
```
cd vm-iso
python -m http.server 8080     # ou: npx serve
```
Abre http://localhost:8080, arrasta uma ISO, ajusta a configuração e clica **Iniciar**.

## Notas
- Só x86 de 32 bits: Tiny Core, Alpine/Debian x86, KolibriOS, FreeDOS, Windows 95/98.
- Ctrl+Alt liberta o rato/teclado. O "FPS UI" mede a fluidez da interface, não da VM.
- Discos virtuais grandes (vários GB) ficam em RAM do browser; usa tamanhos moderados.
- Os nomes das opções do v86 podem variar entre versões; consulta a documentação do repositório se algo falhar.
