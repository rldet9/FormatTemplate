# Guide de démarrage rapide - Contribution & Publication

Ce guide vous permet de démarrer rapidement avec le développement et la publication de nodes n8n custom.

## 🎯 Objectifs de ce guide

- ✅ Configurer votre environnement de développement
- ✅ Comprendre le workflow de contribution
- ✅ Publier votre premier node sur NPM
- ✅ Maintenir et mettre à jour vos publications

---

## 🚀 Démarrage rapide (5 minutes)

### 1. Installation

```powershell
# Cloner le repository
git clone https://github.com/rldet9/FormatTemplate.git
cd FormatTemplate

# Installer les dépendances
pnpm install

# Construire le projet
pnpm build
```

### 2. Développement

```powershell
# Mode watch pour développement
pnpm dev

# Linting
pnpm lint

# Format du code
pnpm format
```

### 3. Test local dans n8n

```powershell
# Lier le package localement
pnpm link --global

# Dans votre dossier n8n
cd C:\Users\[votre-user]\.n8n
npm link @rderet/n8n-nodes-format-template

# Redémarrer n8n
n8n
```

---

## 📝 Workflow de contribution

### Étapes standards

1. **Créer une branche**
   ```powershell
   git checkout -b feature/ma-nouvelle-fonctionnalite
   ```

2. **Développer**
   - Ajouter votre code
   - Tester localement
   - Documenter les changements

3. **Committer**
   ```powershell
   git add .
   git commit -m "feat: description de la fonctionnalité"
   ```

4. **Pousser**
   ```powershell
   git push origin feature/ma-nouvelle-fonctionnalite
   ```

### Convention de commits

| Préfixe | Utilisation | Exemple |
|---------|-------------|---------|
| feat: | Nouvelle fonctionnalité | feat: add email handler |
| fix: | Correction de bug | fix: phone formatting issue |
| docs: | Documentation | docs: update README |
| style: | Formatage | style: fix indentation |
| refactor: | Refactoring | refactor: improve handler registry |
| test: | Tests | test: add unit tests |
| chore: | Maintenance | chore: bump version |

---

## 📦 Publication sur NPM

### Première publication

**Option 1 : Automatique (recommandé)**

```powershell
# Script interactif
.\publish-npm.ps1 -VersionType patch
```

**Option 2 : Manuel**

```powershell
# 1. Vérifier connexion NPM
npm whoami  # doit afficher: rderet

# 2. Mettre à jour version
npm version patch

# 3. Build
pnpm build

# 4. Publier
npm publish --access public

# 5. Push Git
git push --follow-tags
```

### Publications suivantes

```powershell
# Correction de bugs (0.1.0 → 0.1.1)
.\publish-npm.ps1 -VersionType patch

# Nouvelle fonctionnalité (0.1.0 → 0.2.0)
.\publish-npm.ps1 -VersionType minor

# Changement majeur (0.1.0 → 1.0.0)
.\publish-npm.ps1 -VersionType major
```

---

## 🔧 Créer un nouveau node

### 1. Dupliquer le template

```powershell
# Créer un nouveau dossier
cd C:\Users\rldet9\Repositories\n8n_nodes
mkdir MonNouveauNode
cd MonNouveauNode

# Copier la structure
Copy-Item -Recurse C:\Users\rldet9\Repositories\n8n_nodes\FormatTemplate\* .
```

### 2. Configurer le package.json

```json
{
  "name": "@rderet/n8n-nodes-mon-nouveau-node",
  "version": "0.1.0",
  "description": "Description de mon node",
  "keywords": [
    "n8n-community-node-package",
    "n8n",
    "mon-domaine"
  ],
  "homepage": "https://github.com/rldet9/MonNouveauNode",
  "repository": {
    "type": "git",
    "url": "https://github.com/rldet9/MonNouveauNode.git"
  },
  "n8n": {
    "nodes": [
      "dist/nodes/MonNouveauNode/MonNouveauNode.node.js"
    ]
  }
}
```

### 3. Renommer les fichiers

- Renommer le dossier 
odes/FormatTemplate → 
odes/MonNouveauNode
- Renommer FormatTemplate.node.ts → MonNouveauNode.node.ts
- Mettre à jour les imports

### 4. Développer vos handlers

Créez vos handlers dans 
odes/MonNouveauNode/handlers/

### 5. Publier

```powershell
.\publish-npm.ps1 -VersionType patch
```

---

## 📚 Documentation à lire

| Document | Quand le lire ? |
|----------|----------------|
| [README.md](../README.md) | Vue d'ensemble du projet |
| [docs/FormatTemplate.md](./FormatTemplate.md) | Architecture technique |
| [docs/guide-utilisation.md](./guide-utilisation.md) | Utilisation du node |
| [docs/procedure-publication-npm.md](./procedure-publication-npm.md) | Première publication |
| [docs/checklist-publication-npm.md](./checklist-publication-npm.md) | Publications régulières |

---

## �� Problèmes courants

### Erreur : "ENEEDAUTH"
```powershell
npm login
```

### Erreur : "Version already exists"
```powershell
npm version patch
npm publish --access public
```

### Erreur de build
```powershell
Remove-Item -Recurse -Force dist
pnpm build
```

### Node n'apparaît pas dans n8n
```powershell
# Vérifier l'installation
cd C:\Users\[user]\.n8n\node_modules\@rderet
ls

# Réinstaller
npm uninstall @rderet/n8n-nodes-format-template
npm install @rderet/n8n-nodes-format-template

# Redémarrer n8n
```

---

## 🎓 Ressources d'apprentissage

### Documentation officielle
- [n8n Creating Nodes](https://docs.n8n.io/integrations/creating-nodes/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [NPM Publishing](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)

### Exemples
- [FormatTemplate](https://github.com/rldet9/FormatTemplate) - Ce projet
- [n8n-nodes-base](https://github.com/n8n-io/n8n/tree/master/packages/nodes-base) - Nodes officiels n8n

---

## ✅ Checklist du contributeur

### Avant de commencer
- [ ] Fork ou clone du repository
- [ ] Installation des dépendances (`pnpm install`)
- [ ] Build réussi (`pnpm build`)
- [ ] Tests de lint OK (`pnpm lint`)

### Pendant le développement
- [ ] Code suit les conventions
- [ ] Handlers testés localement
- [ ] Documentation à jour
- [ ] Commits bien formatés

### Avant publication
- [ ] Connecté à NPM (`npm whoami`)
- [ ] Version incrémentée
- [ ] CHANGELOG.md mis à jour
- [ ] README à jour
- [ ] Build final OK

### Après publication
- [ ] Package visible sur NPM
- [ ] Installation testée
- [ ] Git poussé avec tags
- [ ] Documentation mise à jour

---

## 💡 Conseils pour réussir

### Développement
1. ✅ **Testez fréquemment** : Build et test après chaque modification
2. ✅ **Petits commits** : Commits atomiques avec messages clairs
3. ✅ **Documentation** : Documentez au fur et à mesure
4. ✅ **Conventions** : Suivez les standards n8n

### Publication
1. ✅ **Versioning strict** : Respectez SemVer
2. ✅ **Tests complets** : Testez avant de publier
3. ✅ **CHANGELOG** : Maintenez un historique clair
4. ✅ **Annonces** : Communiquez les changements importants

### Maintenance
1. ✅ **Dépendances** : Gardez-les à jour
2. ✅ **Issues** : Répondez rapidement aux problèmes
3. ✅ **Sécurité** : Surveillez les vulnérabilités
4. ✅ **Compatibilité** : Testez avec nouvelles versions n8n

---

## 🔗 Liens rapides

- 📦 [Package NPM](https://www.npmjs.com/package/@rderet/n8n-nodes-format-template)
- 🐙 [GitHub](https://github.com/rldet9/FormatTemplate)
- 📚 [Documentation complète](./README.md)
- 🚀 [Script de publication](../publish-npm.ps1)

---

## 📞 Contact & Support

**Auteur** : Raphael Deret  
**Email** : raphael.deret@mixtrio.net  
**GitHub** : [@rldet9](https://github.com/rldet9)  
**NPM** : [@rderet](https://www.npmjs.com/~rderet)

---

*🎉 Bienvenue dans la communauté des contributeurs n8n !*  
*📅 Dernière mise à jour : 29 novembre 2025*
