# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is CPython, the reference implementation of the Python programming language (currently 3.15.0 alpha, under active development on `main`). It is a large C/Python hybrid codebase: a C runtime and bytecode interpreter, a pure-Python standard library, a PEG-based parser/compiler pipeline, and a JIT compiler.

Full contributor documentation lives outside this tree in the [Developer's Guide](https://devguide.python.org/) — treat it as authoritative for anything not covered here or in `InternalDocs/`.

## Build

```
./configure
make -j$(nproc)
```

- Debug build (recommended for development — enables extra assertions): `../configure --with-pydebug` from a separate build subdirectory (don't mix debug/release builds in the same tree; `make clean` first if switching in-place).
- Optimized/release build: `./configure --enable-optimizations` (enables PGO, and LTO on supported platforms).
- `./configure --help` lists all options.
- Platform-specific build docs: `Mac/README.rst` (macOS), `PCbuild/readme.txt` (Windows), `Android/README.md`, `iOS/README.rst`.
- The resulting interpreter is `./python` (built in the repo root) — use it directly, e.g. `./python -c '...'`, rather than assuming a `python3` on PATH.

### Windows (PowerShell)

There is no `configure`/`make` on Windows; the build is driven by `.bat` scripts under `PCbuild/` (built on MSVC — Visual Studio 2017+ with the Python workload). From a PowerShell prompt, invoke them with a `.\` prefix:
```
.\PCbuild\build.bat          # Release, 32-bit Win32 by default
.\PCbuild\build.bat -d       # Debug build (adds "_d" to binary names, e.g. python_d.exe)
.\PCbuild\build.bat -p x64   # 64-bit
.\PCbuild\rt.bat -q          # run the test suite against the build just produced
```
`build.bat -h` lists all options, including `--pgo` for a PGO build and `-E` to skip re-fetching external dependencies (`get_externals.bat`).
- Setting an optimization flag as an env var uses PowerShell's `$env:` syntax rather than cmd's `set`, e.g. `$env:WITH_COMPUTED_GOTOS="true"` before running `build.bat` — or pass it directly as an MSBuild property: `.\PCbuild\build.bat "/p:WITH_COMPUTED_GOTOS=true"`.
- The debug interpreter built this way is `PCbuild\<platform>\python_d.exe` (not `.\python`).
- External libraries CPython doesn't control (OpenSSL, Tcl/Tk, libffi, etc.) aren't in this tree: `build.bat` fetches them automatically into `..\externals` via `get_externals.bat` (override the location with the `EXTERNALS_DIR` env var). OpenSSL and Tcl/Tk specifically can be rebuilt from source with `.\PCbuild\prepare_ssl.bat` / `.\PCbuild\prepare_tcltk.bat`.
- `clang-cl` is supported as an alternative to MSVC: `.\PCbuild\build.bat "/p:PlatformToolset=ClangCL"`. It can also be combined with `--pgo`, optionally pointing at a specific LLVM install (`"/p:LLVMInstallDir=<dir>" "/p:LLVMToolsVersion=<major>"`); if the PGO instrumented build is run on a different host than where it's compiled, pass `"/p:CLANG_PROFILE_PATH=<path-to-instrumented-dir>"` in the `PGInstrument` step so profile data lands where the later `PGUpdate` step expects it.
- Adding a new C extension module needs a matching `.vcxproj`/`.vcxproj.filters` pair under `PCbuild/` in addition to the `Modules/*.c` source — there's a step-by-step checklist at the bottom of `PCbuild/readme.txt` ("Add a new project").

## Testing

Run the whole suite:
```
make test
```
(`make buildbottest` additionally enables resource-intensive tests that `make test` skips by default.)

Run specific test modules directly with the freshly built interpreter — this is the fast path for iterating on one test:
```
./python -m test test_os test_gdb
./python -m test -v test_os                    # verbose
./python -m test test_os -m test_specific_case  # single test method/class
```
Equivalently via make: `make test TESTOPTS="-v test_os test_gdb"`.

Test modules live in `Lib/test/test_*.py` (~435 of them); support infrastructure is in `Lib/test/support/`. See `devguide` → "Running & Writing Tests" for the full `regrtest` option set (`-j`, `-R` for refleak hunting, `-W` for verbose-on-failure, etc.).

C-level regression/embedding tests live in `Programs/_testembed.c` and are run via `make test` as well.

## Linting / formatting

Pre-commit (`.pre-commit-config.yaml`) drives all linting; install with `pre-commit install` or run ad hoc with `pre-commit run --files <path>`. Key hooks:
- **ruff** (lint + format) on `Doc/`, `Lib/test/`, `Tools/build/`, and Argument Clinic (`Tools/clinic/`, `Lib/test/test_clinic.py`) — each area has its own ruff config (root `.ruff.toml`, `Tools/build/.ruff.toml`, `Tools/clinic/.ruff.toml`). Root config targets Python 3.10 syntax and enforces PEP 8's 79-column line length.
- **black** on `Tools/jit/` only.
- No-tabs, trailing-whitespace, and end-of-file hooks apply repo-wide to C/`.inc`/Python/rst/yaml files.
- `sphinx-lint` on `Doc/` and `Misc/NEWS.d/`.
- `actionlint` / `zizmor` / `check-jsonschema` for GitHub Actions workflow files.

Note: most of the C and Python source outside these specific directories (`Lib/*.py`, `Objects/`, `Python/`, `Modules/`) is **not** ruff/black-formatted — follow the surrounding code's existing style there.

## Documentation

Docs source is reStructuredText under `Doc/`, built with Sphinx:
```
cd Doc
make venv    # one-time: creates a venv with sphinx-build, blurb, python-docs-theme
make html
```
Other useful targets: `htmllive` (live-reloading local server), `check` (markup errors), `linkcheck`. See `Doc/README.rst`.

## Changelog entries

Every user-facing change needs a news entry under `Misc/NEWS.d/next/<Category>/<issue>.<rev>.rst`, added via the `blurb` tool (`blurb add`). Categories: `Build`, `C_API`, `Core_and_Builtins`, `Documentation`, `IDLE`, `Library`, `Security`, `Tests`, `Tools-Demos`, `Windows`, `macOS`. Category directory names use underscores, not spaces (a pre-commit hook rejects space-containing paths).

## Regenerating generated files

Many files (opcodes, AST, keywords, frozen modules, the PEG parser, etc.) are generated from source-of-truth definitions and must be regenerated after touching those definitions:
```
make regen-all
```
A few generators aren't included in `regen-all` and must be run manually when relevant: `make regen-stdlib-module-names`, `make regen-limited-abi`, `make regen-configure`, `make regen-sbom`, `make regen-unicodedata`.

## Architecture

The pipeline from source text to execution, and where each stage lives:

1. **Tokenizing & parsing** (`Parser/`): `Parser/lexer/` and `Parser/tokenizer/` tokenize source; `Parser/parser.c` runs a PEG parser (generated from `Grammar/python.gram` by `Tools/peg_generator/`) to produce an AST. Regenerate with `make regen-pegen` / `make regen-ast` after grammar changes — see `InternalDocs/changing_grammar.md`.
2. **Compilation** (`Python/compile.c` → `Python/flowgraph.c` → `Python/assemble.c`): AST → pseudo-instruction sequence → CFG (with optimization passes) → final bytecode, packaged into a `CodeObject`. Details in `InternalDocs/compiler.md`.
3. **Interpretation** (`Python/ceval.c`, `Python/bytecodes.c`): the bytecode interpreter's core loop and per-opcode logic are defined in a DSL in `Python/bytecodes.c`; `Tools/cases_generator/` compiles that DSL into `Python/generated_cases.c.h` (and other generated files) via `make regen-cases`. This also drives the specializing adaptive interpreter. See `InternalDocs/interpreter.md`.
4. **Tier 2 JIT** (`Tools/jit/`, generated into `Python/jit.c`-family files): optional, experimental. Building it requires LLVM 19 (`clang` + `llvm-readobj`, ideally `llvm-objdump`) and `configure --enable-experimental-jit`. See `Tools/jit/README.md` and `InternalDocs/jit.md`.
5. **Runtime objects**: `Objects/` implements all builtin types (see `InternalDocs/code_objects.md`, `frames.md`, `generators.md`, `string_interning.md`). `Python/` holds the rest of the core runtime (import system, `sysmodule.c`, GC, threading, etc. — see `InternalDocs/garbage_collector.md`, `exception_handling.md`, `qsbr.md`).
6. **C extension modules**: `Modules/` contains stdlib extension modules written in C. Many use **Argument Clinic** (`Tools/clinic/`, invoked via `make clinic`) to generate argument-parsing boilerplate from `/*[clinic input]*/` blocks in the `.c` source — edit the clinic block, not the generated code below it, and re-run `make clinic`.
7. **Standard library**: `Lib/` is pure-Python stdlib; `Lib/test/` is the test suite.
8. **C API layering** (`Include/`): `Include/*.h` is the stable Limited API; `Include/cpython/*.h` exposes CPython implementation details (names prefixed `PyUnstable_` may change between minor releases); `Include/internal/*.h` and any `_`-prefixed name is the internal-only API with no compatibility guarantees. See `Include/README.rst`.
9. **Platform build glue**: `PC/` and `PCbuild/` (Windows/MSVC project files), `Mac/` (macOS framework/universal build extras), `Android/`, `iOS/` (mobile cross-builds — most app developers should use higher-level tools like Briefcase/Buildozer instead of building directly).

`InternalDocs/README.md` is the index for all of the above design docs — consult it before making non-trivial changes to the parser, compiler, interpreter, JIT, or object model.

## Contribution workflow notes

- The devguide, not this file, is authoritative on the PR process; it deviates from a typical GitHub flow (bots and required status checks gate merging — follow their comments and "Details" links).
- Non-code discussion belongs on GitHub Issues, not scattered across a PR's comments.
- On your first non-trivial PR (including doc changes), add yourself to `Misc/ACKS`.
- All interactions are covered by the PSF Code of Conduct.
