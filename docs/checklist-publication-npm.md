# Checklist Publication NPM - Quick Reference

## 🚀 Publication Rapide

### Avant de commencer
```powershell
# 1. Vérifier la connexion NPM
npm whoami  # Doit afficher: rderet

# 2. Vérifier que vous êtes sur la branche main
git branch

# 3. Vérifier l'état Git (doit être propre)
git status
```

### Étapes de publication

```powershell
# 1. Mettre à jour la version (choisir une option)
npm version patch   # 0.1.0 → 0.1.1 (bugs)
npm version minor   # 0.1.0 → 0.2.0 (features)
npm version major   # 0.1.0 → 1.0.0 (breaking)

# 2. Construire le projet
pnpm build

# 3. Vérifier le contenu du package (optionnel)
npm pack --dry-run

# 4. Publier sur NPM
npm publish --access public

# 5. Pousser les changements sur Git
git push --follow-tags
```

### Vérification

```powershell
# Attendre 30 secondes
Start-Sleep -Seconds 30

# Vérifier la publication
npm info @rderet/n8n-nodes-[nom]

# Ouvrir la page NPM
start https://www.npmjs.com/package/@rderet/n8n-nodes-[nom]
```

## ✅ Checklist Minimale

### Avant publication
- [ ] Code testé et fonctionnel
- [ ] `package.json` : nom, version, URLs corrects
- [ ] README.md à jour
- [ ] Connecté à NPM (`npm whoami` = rderet)
- [ ] Git status propre
- [ ] Build OK (`pnpm build`)

### Publication
- [ ] Version incrémentée
- [ ] `npm publish --access public` réussi
- [ ] `git push --follow-tags` effectué

### Post-publication
- [ ] `npm info @rderet/...` fonctionne
- [ ] Page NPM accessible
- [ ] Installation testée (`npm install @rderet/...`)

## 🆘 Dépannage Rapide

| Erreur | Solution |
|--------|----------|
| ENEEDAUTH | `npm login` |
| 403 Forbidden | Ajouter `--access public` |
| Version exists | `npm version patch` |
| 404 after publish | Attendre 1-2 minutes, `npm cache clean --force` |

## 📝 Modèle package.json

```json
{
  "name": "@rderet/n8n-nodes-[nom]",
  "version": "0.1.0",
  "description": "Description du node",
  "keywords": [
    "n8n-community-node-package",
    "n8n"
  ],
  "license": "MIT",
  "homepage": "https://github.com/rldet9/[repo]",
  "author": {
    "name": "Raphael Deret",
    "email": "raphael.deret@mixtrio.net"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/rldet9/[repo].git"
  },
  "main": "index.js",
  "files": ["dist"],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "nodes": ["dist/nodes/[Path]/[Node].node.js"]
  }
}
```

---

*Pour la procédure complète, voir: [procedure-publication-npm.md](./procedure-publication-npm.md)*
