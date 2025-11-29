# Documentation - Node FormatTemplate

Ce dossier contient toute la documentation du projet n8n-nodes-format-template.

## 📚 Structure de la documentation

### Documents utilisateur

#### [guide-utilisation.md](./guide-utilisation.md)
Guide complet pour les utilisateurs finaux du node FormatTemplate.
- **Public** : Utilisateurs n8n
- **Contenu** : 
  - Démarrage rapide
  - Configuration des transformations
  - Exemples pratiques
  - Cas d'usage courants
  - Résolution de problèmes

### Documents techniques

#### [FormatTemplate.md](./FormatTemplate.md)
Documentation technique détaillée du node.
- **Public** : Développeurs
- **Contenu** :
  - Architecture du système
  - Implémentation des handlers
  - Détails techniques
  - Schémas et diagrammes

#### [format-template-node-prd.md](./format-template-node-prd.md)
Document d'exigences produit (Product Requirements Document).
- **Public** : Product managers, développeurs
- **Contenu** :
  - Spécifications fonctionnelles
  - Cas d'usage métier
  - Exigences techniques
  - Roadmap produit

### Documents de publication NPM

#### [procedure-publication-npm.md](./procedure-publication-npm.md) ⭐
**Document principal** : Procédure complète de publication sur NPM.
- **Public** : Mainteneurs, contributeurs
- **Contenu** :
  - Prérequis et configuration
  - Checklist pré-publication détaillée
  - Procédure étape par étape
  - Vérifications post-publication
  - Gestion des versions (SemVer)
  - Dépannage et solutions
  - Bonnes pratiques
  - Ressources utiles

**📖 À lire en premier** si vous souhaitez publier un node sur NPM.

#### [checklist-publication-npm.md](./checklist-publication-npm.md)
Checklist rapide pour les publications.
- **Public** : Mainteneurs expérimentés
- **Contenu** :
  - Commandes essentielles
  - Checklist minimale
  - Dépannage rapide
  - Template package.json

**⚡ Pour les publications rapides** quand vous connaissez la procédure.

---

## 🚀 Guide de démarrage rapide

### Pour utiliser le node
→ Lisez : [guide-utilisation.md](./guide-utilisation.md)

### Pour développer des handlers
→ Lisez : [FormatTemplate.md](./FormatTemplate.md) puis le [README principal](../README.md)

### Pour publier sur NPM
→ **Première fois** : [procedure-publication-npm.md](./procedure-publication-npm.md)  
→ **Publications suivantes** : [checklist-publication-npm.md](./checklist-publication-npm.md)

---

## 🛠️ Outils d'automatisation

Le projet inclut un script PowerShell pour automatiser les publications :

```powershell
# Publication patch (bugs)
.\publish-npm.ps1 -VersionType patch

# Publication minor (features)
.\publish-npm.ps1 -VersionType minor

# Publication major (breaking changes)
.\publish-npm.ps1 -VersionType major

# Mode dry-run (simulation)
.\publish-npm.ps1 -VersionType patch -DryRun
```

---

## 📋 Checklist documentation complète

- [x] Guide utilisateur
- [x] Documentation technique
- [x] Document PRD
- [x] Procédure de publication NPM
- [x] Checklist publication rapide
- [x] Script d'automatisation publication
- [x] CHANGELOG du projet
- [x] README principal à jour

---

## �� Maintenance de la documentation

### Quand mettre à jour

| Document | À mettre à jour quand... |
|----------|-------------------------|
| guide-utilisation.md | Nouveaux handlers, nouvelles fonctionnalités |
| FormatTemplate.md | Changements d'architecture, nouveaux composants |
| format-template-node-prd.md | Évolution des specs, roadmap |
| procedure-publication-npm.md | Changements procédure NPM, nouvelles contraintes |
| checklist-publication-npm.md | Simplification ou ajout d'étapes |

### Standards de documentation

- ✅ **Clarté** : Langage simple et précis
- ✅ **Exemples** : Code et commandes fonctionnels
- ✅ **Structure** : Titres hiérarchiques clairs
- ✅ **Mise à jour** : Date de dernière modification
- ✅ **Liens** : Navigation entre documents

---

## 🔗 Liens utiles

- [README principal](../README.md)
- [CHANGELOG](../CHANGELOG.md)
- [Package NPM](https://www.npmjs.com/package/@rderet/n8n-nodes-format-template)
- [Repository GitHub](https://github.com/rldet9/FormatTemplate)
- [Documentation n8n](https://docs.n8n.io/)

---

*📝 Documentation maintenue par Raphael Deret (raphael.deret@mixtrio.net)*  
*🔄 Dernière mise à jour : 29 novembre 2025*
