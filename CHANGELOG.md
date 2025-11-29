# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Versioning Sémantique](https://semver.org/lang/fr/).

## [0.1.0] - 2025-11-29

### 🎉 Publication initiale

Première publication du node FormatTemplate sur NPM sous le scope @rderet.

### ✨ Fonctionnalités

#### Handlers disponibles
- **TextCaseHandler** : Transformation de casse (uppercase, lowercase, capitalize)
- **PhoneHandler** : Formatage de numéros de téléphone avec patterns prédéfinis
- **CountryHandler** : Conversion de noms de pays en codes ISO2

#### Architecture
- Système modulaire avec découverte automatique des handlers
- Registry centralisé pour la gestion des transformations
- Interface utilisateur dynamique basée sur les handlers disponibles
- Support des chemins de propriétés imbriqués (ex: `client.address.country`)

#### Infrastructure
- Build TypeScript avec compilation optimisée
- Linting avec ESLint et règles n8n-nodes-base
- Support des icônes avec gulp
- Configuration pnpm pour gestion des dépendances

### 📦 Package NPM
- **Nom** : @rderet/n8n-nodes-format-template
- **Taille** : 31.4 kB (compressé) / 102.3 kB (décompressé)
- **Registry** : https://registry.npmjs.org/
- **Accès** : Public

### 📚 Documentation
- README complet avec exemples d'utilisation
- Guide d'utilisation détaillé
- Documentation technique et PRD
- Procédure de publication NPM
- Checklist de publication rapide

### 🔧 Configuration
- n8n API version 1
- Node.js >= 18.10
- pnpm >= 9.1
- License MIT

---

## Format des entrées

Les versions suivent le format : [MAJOR.MINOR.PATCH]

### Types de changements
- **Added** (Ajouté) : Nouvelles fonctionnalités
- **Changed** (Modifié) : Modifications de fonctionnalités existantes
- **Deprecated** (Déprécié) : Fonctionnalités bientôt supprimées
- **Removed** (Supprimé) : Fonctionnalités supprimées
- **Fixed** (Corrigé) : Corrections de bugs
- **Security** (Sécurité) : Corrections de vulnérabilités

---

*Maintenu par Raphael Deret (raphael.deret@mixtrio.net)*
