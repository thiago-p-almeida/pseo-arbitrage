# Skill: Backup Pós-Sprint

> Procedimento padrão para criar um ponto de restauração completo após validar um incremento.
> Execute este skill **antes de iniciar o próximo sprint**.

## Pré-Condições

- [ ] Código validado e funcionando em local + produção
- [ ] D1 local populado com seed data (se aplicável)
- [ ] Commit atual é o HEAD do git

## Passo 1 — Criar Git Tag

```bash
# Nomeie o tag com base no conteúdo do sprint
git tag -a backup-post-<nome-do-sprint> -m "Backup pós-sprint: <descrição curta>"

# Verificar
git show backup-post-<nome-do-sprint> --oneline -1
```

> Exemplo: `git tag -a backup-post-optional-phases -m "Backup pós-sprint: fases opcionais implementadas"`

## Passo 2 — Snapshot do D1 Local

```bash
# Garantir que o .backup/d1-state-backup/ existe
mkdir -p .backup/d1-state-backup

# Copiar estado do D1 local (schema + dados)
cp -r .wrangler/state/v3/d1/* .backup/d1-state-backup/

# Validar integridade (contagem de produtos deve ser > 0)
sqlite3 .backup/d1-state-backup/miniflare-D1DatabaseObject/*.sqlite \
  "SELECT count(*) FROM products;"
```

## Passo 3 — Snapshot do Código

```bash
# Gerar tarball excluindo artefatos de build e dependências
tar czf .backup/source-snapshot.tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.astro \
  --exclude=.wrangler \
  --exclude=.backup \
  --exclude=.git \
  src/ db/ public/ astro.config.mjs wrangler.toml package.json \
  pnpm-workspace.yaml tailwind.config.mjs tsconfig.json

# Verificar integridade
tar tzf .backup/source-snapshot.tar.gz | head -20
```

## Passo 4 — Atualizar RESTORE.md

Atualize `.backup/RESTORE.md` adicionando uma nova seção no topo com:
- Data atual
- Commit hash (`git rev-parse HEAD`)
- Git tag criado
- Instruções de restauração (código, D1, dependências, snapshot)
- Lista de itens preservados vs. rebuildáveis

Mantenha as seções anteriores para histórico cronológico.

## Passo 5 — Validação Final

```bash
# 1. Tag existe e aponta para o HEAD
git rev-parse backup-post-<nome-do-sprint>
git rev-parse HEAD
# (os hashes devem ser idênticos)

# 2. D1 backup tem dados
sqlite3 .backup/d1-state-backup/miniflare-D1DatabaseObject/*.sqlite \
  "SELECT count(*) FROM products;"

# 3. Snapshot do código é válido
tar tzf .backup/source-snapshot.tar.gz | wc -l
# (deve ser > 0)

# 4. RESTORE.md foi atualizado
grep "backup-post-<nome-do-sprint>" .backup/RESTORE.md
```

## Checklist de Conclusão

- [ ] Git tag criada e verificada
- [ ] D1 local snapshot copiado e validado
- [ ] Código snapshot gerado e validado
- [ ] RESTORE.md atualizado com novo ponto de restauração
- [ ] Todos os comandos de validação passaram
- [ ] `skills/` e `.clinerules` commitados e pushados (se houver mudanças)
