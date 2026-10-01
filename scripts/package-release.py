"""Build a source archive from an explicit allowlist; never include local secrets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
destination = root / '.local' / 'release' / 'predictsci-source.zip'
destination.parent.mkdir(parents=True, exist_ok=True)
files = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'next.config.ts', 'next-env.d.ts', 'tsconfig.json', 'Dockerfile', 'docker-compose.yml', '.dockerignore', '.gitignore', '.env.example', '.env.production.example', 'render.yaml', 'README.md', 'AGENTS.md', 'vitest.config.ts', 'vitest.integration.config.ts', 'playwright.config.ts', 'eslint.config.mjs']
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for name in files:
        path = root / name
        if path.is_file():
            archive.write(path, name)
    for folder in ['src', 'prisma', 'docs', 'services/leboncoin-mcp', 'tests', 'integration', 'e2e']:
        for path in (root / folder).rglob('*'):
            if path.is_file() and not path.is_symlink() and '__pycache__' not in path.parts and path.suffix != '.pyc':
                archive.write(path, path.relative_to(root))
    archive.write(root / 'scripts' / 'start-production.mjs', 'scripts/start-production.mjs')
print(f'Archive de sources créée : {destination}')
