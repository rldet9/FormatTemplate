# Procédure de Publication NPM - Nodes n8n Custom

## Table des matières
1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Checklist pré-publication](#checklist-pré-publication)
4. [Procédure de publication](#procédure-de-publication)
5. [Vérification post-publication](#vérification-post-publication)
6. [Gestion des versions](#gestion-des-versions)
7. [Dépannage](#dépannage)
8. [Bonnes pratiques](#bonnes-pratiques)

---

## Vue d'ensemble

Ce document décrit la procédure complète pour publier un node custom n8n sur NPM, que ce soit pour une première publication ou une mise à jour.

### Informations importantes
- **Compte NPM** : rderet
- **Scope** : @rderet
- **Registry** : https://registry.npmjs.org/
- **Accès** : Public (requis pour les packages scoped gratuits)

---

## Prérequis

### 1. Compte NPM configuré

Vérifiez votre connexion NPM :
```powershell
npm whoami
```

**Résultat attendu** : `rderet`

Si vous n'êtes pas connecté :
```powershell
npm login
```

> 💡 **Note** : Cette commande ouvrira votre navigateur pour l'authentification.

### 2. Structure du projet

Assurez-vous que votre projet contient :
- ✅ `package.json` correctement configuré
- ✅ `README.md` à jour
- ✅ `LICENSE.md` (MIT recommandé)
- ✅ `.npmignore` pour exclure les fichiers inutiles
- ✅ Dossier `dist/` construit et à jour
- ✅ `tsconfig.json` pour la compilation TypeScript
- ✅ Tests fonctionnels (si disponibles)

### 3. Outils installés

```powershell
# Vérifier les versions
node --version    # >= 18.10
pnpm --version    # >= 9.1
npm --version     # >= 9.0
```

---

## Checklist pré-publication

Avant chaque publication, vérifiez systématiquement :

### ✅ Configuration du package.json

```json
{
  "name": "@rderet/n8n-nodes-[nom-du-node]",
  "version": "X.Y.Z",
  "description": "Description claire et concise",
  "keywords": [
    "n8n-community-node-package",
    "n8n",
    "mots-clés-pertinents"
  ],
  "license": "MIT",
  "homepage": "https://github.com/rldet9/[nom-du-repo]",
  "author": {
    "name": "Raphael Deret",
    "email": "raphael.deret@mixtrio.net"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/rldet9/[nom-du-repo].git"
  },
  "main": "index.js",
  "files": [
    "dist"
  ],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [],
    "nodes": [
      "dist/nodes/[CheminVersNode]/[NomNode].node.js"
    ]
  }
}
```

### ✅ Fichier .npmignore

Vérifiez que ces éléments sont exclus :
```ignore
# OS files
.DS_Store
desktop.ini

# Build artifacts
*.tsbuildinfo
tsconfig.json

# Development files
.editorconfig
.eslintrc.js
.eslintrc.prepublish.js
.prettierrc.js
gulpfile.js

# Source files (only dist/ should be published)
nodes/
credentials/

# Git and GitHub
.git
.github
.gitignore

# Development folders
.vscode/

# Documentation (optional, keep main README)
docs/

# Dependencies
node_modules/
package-lock.json
pnpm-lock.yaml
```

### ✅ Scripts package.json

Assurez-vous que ces scripts fonctionnent :
```json
{
  "scripts": {
    "build": "tsc && gulp build:icons",
    "lint": "eslint nodes package.json",
    "prepublishOnly": "pnpm build && pnpm lint -c .eslintrc.prepublish.js nodes package.json"
  }
}
```

> ⚠️ **Important** : Ne pas inclure de dossiers vides (comme `credentials/`) dans les commandes lint.

### ✅ Documentation

- [ ] README.md à jour avec exemples d'utilisation
- [ ] Instructions d'installation correctes
- [ ] Exemples de configuration
- [ ] Changelog (pour les mises à jour)
- [ ] Liens GitHub valides

### ✅ Tests de construction

```powershell
# Nettoyer et reconstruire
Remove-Item -Recurse -Force .\dist
pnpm build
```

**Vérifiez** que la compilation se termine sans erreur.

### ✅ Test de lint

```powershell
pnpm lint
```

**Corrigez** toutes les erreurs avant de continuer.

---

## Procédure de publication

### Étape 1 : Mise à jour de la version

Choisissez le type de mise à jour selon les changements :

```powershell
# Patch (0.1.0 → 0.1.1) : Corrections de bugs
npm version patch

# Minor (0.1.0 → 0.2.0) : Nouvelles fonctionnalités rétrocompatibles
npm version minor

# Major (0.1.0 → 1.0.0) : Changements breaking
npm version major
```

> 💡 **Note** : Cette commande met à jour `package.json` ET crée un tag Git automatiquement.

**Ou manuellement** :
1. Éditez `package.json` et changez la version
2. Committez : `git commit -am "chore: bump version to X.Y.Z"`
3. Créez un tag : `git tag -a vX.Y.Z -m "Version X.Y.Z"`

### Étape 2 : Build final

```powershell
pnpm build
```

### Étape 3 : Simulation de publication (recommandé)

Visualisez ce qui sera publié :

```powershell
npm pack --dry-run
```

**Vérifiez** :
- ✅ Taille du package raisonnable (< 1 MB recommandé)
- ✅ Fichiers `dist/` présents
- ✅ README.md et LICENSE.md inclus
- ✅ Pas de fichiers source (`nodes/`, `credentials/`)
- ✅ Pas de fichiers de développement (`.vscode/`, `.github/`)

### Étape 4 : Publication sur NPM

```powershell
npm publish --access public
```

> ⚠️ **Important** : Le flag `--access public` est obligatoire pour les packages scoped (@rderet).

**Résultat attendu** :
```
+ @rderet/n8n-nodes-[nom]@X.Y.Z
```

### Étape 5 : Push des changements Git

```powershell
# Pousser les commits
git push origin main

# Pousser le tag
git push origin vX.Y.Z

# Ou pousser tout en une fois
git push --follow-tags
```

---

## Vérification post-publication

### 1. Vérifier sur NPM (registry)

```powershell
# Attendre 30 secondes pour la propagation
Start-Sleep -Seconds 30

# Vérifier les infos du package
npm info @rderet/n8n-nodes-[nom]
```

**Résultat attendu** : Affichage des métadonnées du package.

### 2. Recherche sur NPM

```powershell
npm search author:rderet
```

Votre package doit apparaître dans les résultats.

### 3. Vérification web

Ouvrez dans votre navigateur :
```
https://www.npmjs.com/package/@rderet/n8n-nodes-[nom]
```

**Vérifiez** :
- ✅ README s'affiche correctement
- ✅ Version publiée est correcte
- ✅ Liens fonctionnent (GitHub, homepage)
- ✅ Keywords sont présents
- ✅ License affichée

### 4. Test d'installation

Dans un répertoire temporaire :

```powershell
# Créer un dossier de test
mkdir C:\Temp\test-npm-install
cd C:\Temp\test-npm-install

# Initialiser un package simple
npm init -y

# Installer votre node
npm install @rderet/n8n-nodes-[nom]

# Vérifier l'installation
ls node_modules\@rderet\
```

### 5. Test d'intégration n8n (recommandé)

1. Installez le node dans votre instance n8n locale
2. Redémarrez n8n
3. Vérifiez que le node apparaît dans la palette
4. Testez les fonctionnalités principales
5. Vérifiez qu'il n'y a pas d'erreurs dans la console

---

## Gestion des versions

### Versioning Sémantique (SemVer)

Format : `MAJOR.MINOR.PATCH` (ex: 1.2.3)

**MAJOR** (1.0.0 → 2.0.0) :
- Changements incompatibles avec versions précédentes
- Suppression de fonctionnalités
- Modification d'API existantes

**MINOR** (1.0.0 → 1.1.0) :
- Ajout de nouvelles fonctionnalités
- Rétrocompatible avec versions précédentes
- Nouveaux handlers ou options

**PATCH** (1.0.0 → 1.0.1) :
- Corrections de bugs
- Petites améliorations
- Mises à jour de documentation

### Versions de développement

Pour les versions en développement :
```json
{
  "version": "0.1.0-beta.1"
}
```

Publier une version beta :
```powershell
npm publish --tag beta --access public
```

---

## Dépannage

### Problème : "npm error code ENEEDAUTH"

**Cause** : Non connecté à NPM

**Solution** :
```powershell
npm login
```

### Problème : "403 Forbidden - access denied"

**Cause** : Accès public non spécifié pour package scoped

**Solution** :
```powershell
npm publish --access public
```

### Problème : "You cannot publish over the previously published versions"

**Cause** : Version déjà publiée

**Solution** :
```powershell
# Incrémenter la version
npm version patch
npm publish --access public
```

### Problème : ESLint "No files matching pattern"

**Cause** : Dossier vide référencé dans scripts lint

**Solution** :
Modifiez `package.json` :
```json
{
  "scripts": {
    "lint": "eslint nodes package.json"
  }
}
```

### Problème : "404 Not Found" après publication

**Cause** : Délai de propagation NPM

**Solution** :
```powershell
# Attendre 1-2 minutes
Start-Sleep -Seconds 60

# Nettoyer le cache
npm cache clean --force

# Réessayer
npm info @rderet/n8n-nodes-[nom]
```

### Problème : Package trop volumineux

**Cause** : Fichiers inutiles inclus

**Solution** :
1. Vérifiez avec `npm pack --dry-run`
2. Ajoutez les fichiers à exclure dans `.npmignore`
3. Assurez-vous que `"files": ["dist"]` est dans `package.json`

### Problème : TypeScript version warning

**Avertissement** (non bloquant) :
```
WARNING: TypeScript version not officially supported
```

**Action** : Vous pouvez ignorer cet avertissement si le build fonctionne correctement.

---

## Bonnes pratiques

### Avant chaque publication

1. ✅ **Testez localement** : Installez et testez dans n8n local
2. ✅ **Documentation à jour** : README, CHANGELOG, exemples
3. ✅ **Version incrémentée** : Suivez SemVer strictement
4. ✅ **Git propre** : Committez tous les changements
5. ✅ **Tests passent** : Si vous avez des tests automatisés

### Naming conventions

**Nom du package** :
- Format : `@rderet/n8n-nodes-[nom-descriptif]`
- Exemple : `@rderet/n8n-nodes-format-template`
- Minuscules uniquement
- Tirets pour séparer les mots

**Tags Git** :
- Format : `v[version]`
- Exemple : `v1.2.3`
- Préfixe "v" obligatoire

### Communication

**CHANGELOG.md** (recommandé) :
```markdown
# Changelog

## [1.1.0] - 2025-11-29

### Added
- Nouveau handler Email
- Support des patterns personnalisés

### Fixed
- Correction bug formatage téléphone

### Changed
- Amélioration performance CountryHandler

## [1.0.0] - 2025-11-15

### Added
- Version initiale
- Handlers TextCase, Phone, Country
```

**Messages de commit** :
```
feat: add email handler
fix: correct phone formatting bug
docs: update README with new examples
chore: bump version to 1.1.0
```

### Sécurité

- ✅ **Ne jamais committer** de tokens ou credentials
- ✅ **Utiliser .gitignore** et .npmignore appropriés
- ✅ **Vérifier les dépendances** : `npm audit`
- ✅ **Maintenir les dépendances** à jour

### SEO et découvrabilité NPM

**Keywords importants** :
```json
{
  "keywords": [
    "n8n-community-node-package",  // OBLIGATOIRE pour n8n
    "n8n",
    "automation",
    "workflow",
    "[domaine-fonctionnel]",
    "[cas-usage]"
  ]
}
```

**Description** :
- Claire et concise (< 150 caractères)
- Mentionner "n8n"
- Décrire la fonctionnalité principale

---

## Checklist complète de publication

### Pré-publication
- [ ] Code testé et fonctionnel
- [ ] `package.json` vérifié (nom, version, URLs)
- [ ] `.npmignore` configuré
- [ ] README.md à jour
- [ ] CHANGELOG.md mis à jour (si applicable)
- [ ] Connecté à NPM (`npm whoami`)
- [ ] Build réussi (`pnpm build`)
- [ ] Lint réussi (`pnpm lint`)
- [ ] Simulation OK (`npm pack --dry-run`)

### Publication
- [ ] Version incrémentée (`npm version [patch|minor|major]`)
- [ ] Publication effectuée (`npm publish --access public`)
- [ ] Git poussé (`git push --follow-tags`)

### Post-publication
- [ ] Vérification NPM registry (`npm info @rderet/...`)
- [ ] Page NPM consultée
- [ ] Test d'installation effectué
- [ ] Test d'intégration n8n réussi
- [ ] Annonce communauté (si pertinent)

---

## Ressources utiles

### Documentation
- [Guide npm publish](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [n8n Creating Nodes](https://docs.n8n.io/integrations/creating-nodes/)

### Outils
- [npm-check-updates](https://www.npmjs.com/package/npm-check-updates) : Mise à jour des dépendances
- [np](https://www.npmjs.com/package/np) : Publication interactive
- [semantic-release](https://github.com/semantic-release/semantic-release) : Automatisation releases

### Commandes utiles

```powershell
# Voir les packages publiés
npm search author:rderet

# Dépublier une version (< 24h seulement)
npm unpublish @rderet/[nom]@X.Y.Z

# Déprécier une version
npm deprecate @rderet/[nom]@X.Y.Z "Message de dépréciation"

# Voir toutes les versions publiées
npm view @rderet/[nom] versions

# Voir les statistiques de téléchargement
npm info @rderet/[nom] downloads
```

---

## Contact et support

**Auteur** : Raphael Deret  
**Email** : raphael.deret@mixtrio.net  
**GitHub** : rldet9  
**NPM** : rderet

---

*📝 Document créé le 29 novembre 2025*  
*🔄 Dernière mise à jour : 29 novembre 2025*
