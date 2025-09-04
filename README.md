# Node FormatTemplate pour n8n

## Table des matières
1. [Introduction et vue d'ensemble](#introduction-et-vue-densemble)
2. [Installation](#installation)
3. [Fonctionnalités](#fonctionnalités)
4. [Architecture technique](#architecture-technique)
5. [Guide d'utilisation](#guide-dutilisation)
6. [Handlers disponibles](#handlers-disponibles)
7. [Guide de développement](#guide-de-développement)
8. [Contribution](#contribution)
9. [Support et documentation](#support-et-documentation)

## Introduction et vue d'ensemble

Le **node FormatTemplate** est un composant n8n avancé conçu pour transformer et formater dynamiquement les données dans vos workflows d'automatisation. Il offre une architecture extensible basée sur des handlers spécialisés qui permettent d'appliquer des transformations complexes sur des champs spécifiques de vos données.

### Problématique résolue
- **Standardisation des données** : Uniformiser les formats de téléphones, pays, textes
- **Nettoyage de données** : Transformer et valider les données avant intégration
- **Cohérence métier** : Appliquer des règles de formatage spécifiques à votre domaine
- **Interopérabilité** : Préparer les données pour différents systèmes cibles

### Avantages clés
- ✅ **Architecture modulaire** : Ajoutez facilement de nouveaux types de transformations
- ✅ **Interface dynamique** : L'UI s'adapte automatiquement aux transformations choisies
- ✅ **Performance optimisée** : Traitement en lot avec gestion robuste des erreurs
- ✅ **Extensibilité** : Système de plugins pour les transformations personnalisées

## Installation

### Prérequis
- n8n version 1.0.0 ou supérieure
- Node.js version 18.10 ou supérieure
- pnpm version 9.1 ou supérieure

### Installation via npm
```bash
npm install n8n-nodes-format-template
```

### Installation en développement
```bash
# Cloner le repository
git clone https://github.com/your-username/n8n-nodes-format-template.git
cd n8n-nodes-format-template

# Installer les dépendances
pnpm install

# Construire le projet
pnpm build

# Lier le package localement pour les tests
pnpm link --global
```

### Configuration dans n8n
Après installation, le node "Format Template" apparaîtra automatiquement dans la catégorie "Transform" de votre palette n8n.

## Fonctionnalités

### Transformations disponibles

#### 🔤 Transformation de casse (TextCase)
- **MAJUSCULES** : Conversion complète en majuscules
- **minuscules** : Conversion complète en minuscules  
- **Capitalisation** : Première lettre en majuscule
- Support des caractères spéciaux français (accents, cédilles)

#### 📱 Formatage de téléphone (Phone)
- **Formats prédéfinis** :
  - `+33 (0) 1 23 45 67 89` (français international)
  - `01 23 45 67 89` (français national)
  - `(123) 456-7890` (américain)
- **Patterns personnalisés** : Support de formats sur mesure
- **Conversion automatique** : International ↔ National
- **Nettoyage automatique** : Suppression des caractères non-numériques

#### 🌍 Codes pays (Country)
- **Conversion nom → code ISO2** : "France" → "FR"
- **Validation codes existants** : Vérification des codes ISO2
- **API REST Countries** : Données à jour et multilingues
- **Gestion d'erreurs** : Messages explicites pour pays non trouvés

### Gestion des données imbriquées
Le node supporte les chemins de propriétés complexes :
- `client.name` - Propriété simple
- `contact.address.country` - Propriété profondément imbriquée
- `items[0].price` - Éléments de tableau (à venir)

## Architecture technique

### Vue d'ensemble
```
FormatTemplate Node
├── FormatTemplate.node.ts        # Point d'entrée principal
├── TransformHandlerRegistry.ts   # Registre des transformations
├── AutoDiscovery.ts              # Découverte automatique des handlers
├── interfaces/
│   └── TransformHandler.ts       # Interface commune
└── handlers/                     # Transformations spécialisées
    ├── TextCaseHandler.ts
    ├── PhoneHandler.ts
    └── CountryHandler.ts
```

### Composants clés

#### 1. Node principal (FormatTemplate.node.ts)
- **Orchestration** : Coordonne l'exécution des transformations
- **Validation** : Vérifie les chemins de propriétés et les configurations
- **Gestion des données** : Traitement sécurisé des objets imbriqués
- **Interface dynamique** : Génération de l'UI basée sur les handlers disponibles

#### 2. Registre des handlers (TransformHandlerRegistry.ts)
- **Centralisation** : Point unique de gestion des transformations
- **Découverte** : Chargement automatique des handlers disponibles
- **Configuration UI** : Génération des options d'interface utilisateur

#### 3. Système de handlers
Chaque handler implémente l'interface `ITransformHandler` :
```typescript
interface ITransformHandler {
  type: string;                    // Identifiant unique
  displayName: string;             // Nom d'affichage
  description: string;             // Description fonctionnelle
  properties: INodeProperties[];   // Configuration UI
  transform(context, value, params): Promise<string>;
}
```

## Guide d'utilisation

### Configuration de base

1. **Ajouter le node** : Glissez "Format Template" dans votre workflow
2. **Configurer un champ** :
   - **Field Path** : Nom de la propriété (ex: `phone`, `client.country`)
   - **Type** : Choisir la transformation désirée
   - **Options spécifiques** : Configurer selon le type choisi

### Exemples pratiques

#### Exemple 1 : Normalisation des données client
**Données d'entrée** :
```json
{
  "client": {
    "name": "jean DUPONT",
    "phone": "0123456789",
    "country": "France"
  }
}
```

**Configuration** :
- Field Path: `client.name`, Type: `textCase`, Case: `capitalize`
- Field Path: `client.phone`, Type: `phone`, Pattern: `{0:+33 (0) # ## ## ## ##}`
- Field Path: `client.country`, Type: `country`

**Résultat** :
```json
{
  "client": {
    "name": "Jean Dupont",
    "phone": "+33 (0) 1 23 45 67 89", 
    "country": "FR"
  }
}
```

#### Exemple 2 : Traitement de données e-commerce
**Données d'entrée** :
```json
{
  "order": {
    "customer_name": "MARIE martin",
    "billing_country": "united kingdom",
    "contact_phone": "+44 20 7946 0958"
  }
}
```

**Configuration** :
- `order.customer_name` → `textCase` → `capitalize`
- `order.billing_country` → `country`
- `order.contact_phone` → `phone` → `{0:+## ## #### ####}`

### Gestion des erreurs

Le node utilise une stratégie de résilience :
- **Traitement individuel** : Chaque item est traité indépendamment
- **Préservation des données** : En cas d'erreur, les données originales sont conservées
- **Messages explicites** : Erreurs détaillées pour faciliter le débogage

Types d'erreurs courantes :
- ❌ **Chemin invalide** : Format du chemin de propriété incorrect
- ❌ **Valeur non transformable** : Données incompatibles avec la transformation
- ❌ **Handler manquant** : Type de transformation non disponible
- ❌ **Erreur réseau** : Problème d'accès aux APIs externes (codes pays)

## Handlers disponibles

### TextCaseHandler
**Type** : `textCase`  
**Description** : Transformation de la casse de texte  
**Options** :
- `uppercase` : TOUT EN MAJUSCULES
- `lowercase` : tout en minuscules
- `capitalize` : Première Lettre En Majuscule

**Support** : Caractères français (accents, cédilles)

### PhoneHandler  
**Type** : `phone`  
**Description** : Formatage des numéros de téléphone  
**Patterns prédéfinis** :
- `{0:+33 (0) # ## ## ## ##}` - Français international
- `{0:0# ## ## ## ##}` - Français national
- `{0:(###) ###-####}` - Américain

**Fonctionnalités** :
- Conversion automatique international ↔ national
- Nettoyage des caractères non-numériques
- Support des patterns personnalisés

### CountryHandler
**Type** : `country`  
**Description** : Conversion en codes pays ISO2  
**Fonctionnalités** :
- Conversion nom complet → code (ex: "France" → "FR")
- Validation des codes ISO2 existants
- Support multilingue via API REST Countries
- Gestion des erreurs pour pays non reconnus

## Guide de développement

### Ajout d'un nouveau handler

#### 1. Créer la classe handler
Créez un nouveau fichier dans `nodes/FormatTemplate/handlers/` :

```typescript
// nodes/FormatTemplate/handlers/EmailHandler.ts
import { ITransformHandler } from '../interfaces/TransformHandler';
import { INodeProperties, IExecuteFunctions } from 'n8n-workflow';

export class EmailHandler implements ITransformHandler {
  type = 'email';
  displayName = 'Email';
  description = 'Validates and normalizes email addresses';

  properties: INodeProperties[] = [
    {
      displayName: 'Action',
      name: 'emailAction',
      type: 'options',
      default: 'normalize',
      options: [
        { name: 'Normalize', value: 'normalize' },
        { name: 'Validate', value: 'validate' },
        { name: 'Extract Domain', value: 'domain' },
      ],
    },
  ];

  async transform(
    executionContext: IExecuteFunctions,
    value: string,
    params: Record<string, any>
  ): Promise<string> {
    const action = params.emailAction as string;
    
    switch (action) {
      case 'normalize':
        return value.toLowerCase().trim();
      case 'validate':
        return this.isValidEmail(value) ? value : '';
      case 'domain':
        return value.split('@')[1] || '';
      default:
        return value;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
```

#### 2. Enregistrement automatique
Le système AutoDiscovery détectera automatiquement votre nouveau handler au démarrage. Aucune configuration supplémentaire n'est nécessaire.

#### 3. Test et validation
```typescript
// Tests unitaires recommandés
describe('EmailHandler', () => {
  it('should normalize email addresses', async () => {
    const handler = new EmailHandler();
    const result = await handler.transform(
      mockContext, 
      'Test@EXAMPLE.COM  ', 
      { emailAction: 'normalize' }
    );
    expect(result).toBe('test@example.com');
  });
});
```

### Structure de développement

#### Organisation des fichiers
```
nodes/FormatTemplate/
├── FormatTemplate.node.ts         # ✨ Node principal
├── TransformHandlerRegistry.ts    # 📋 Registre central
├── AutoDiscovery.ts               # 🔍 Découverte automatique
├── interfaces/
│   └── TransformHandler.ts        # 📝 Interface commune
└── handlers/                      # 🔧 Handlers spécialisés
    ├── TextCaseHandler.ts
    ├── PhoneHandler.ts
    ├── CountryHandler.ts
    └── [VotreHandler].ts           # ➕ Nouveau handler
```

#### Bonnes pratiques

**Conception des handlers** :
- ✅ **Responsabilité unique** : Un handler = une famille de transformations
- ✅ **Validation d'entrée** : Vérifiez toujours les données reçues
- ✅ **Gestion d'erreurs** : Erreurs explicites avec messages utilisateur
- ✅ **Performance** : Évitez les opérations coûteuses synchrones
- ✅ **Documentation** : Commentez les algorithmes complexes

**Interface utilisateur** :
- ✅ **Options claires** : Noms explicites et descriptions détaillées
- ✅ **Valeurs par défaut** : Configurez des défauts sensés
- ✅ **Validation UI** : Utilisez les types n8n appropriés
- ✅ **Groupement logique** : Organisez les options connexes

### Scripts de développement

```bash
# Développement avec rechargement automatique
pnpm dev

# Construction pour production  
pnpm build

# Linting et formatage
pnpm lint
pnpm format

# Tests (si configurés)
pnpm test
```

### Débogage

#### Logs de développement
Le node inclut un système de logging détaillé :

```typescript
console.log(`[FormatTemplate] Processing item ${itemIndex}`);
console.log(`[YourHandler] Transforming: ${value} with params:`, params);
```

#### Test en isolation
Testez vos handlers indépendamment :

```typescript
const handler = new YourHandler();
const result = await handler.transform(mockContext, testValue, testParams);
```

## Contribution

### Workflow de contribution

1. **Fork** du repository
2. **Créer une branche** : `git checkout -b feature/nouveau-handler`
3. **Développer** votre handler selon les guidelines
4. **Tester** thoroughly votre implémentation
5. **Documenter** dans le README et créer des exemples
6. **Pull Request** avec description détaillée

### Types de contributions recherchées

**Nouveaux handlers** :
- 📧 Email (validation, normalisation, extraction domaine)
- 📅 Date (formats, conversion timezone, calculs)
- 💰 Currency (conversion, formatage)
- 🏠 Address (normalisation, géocodage)
- 🔢 Number (formatage, arrondi, unités)

**Améliorations système** :
- 🔧 Performance des transformations existantes
- 🛡️ Validation et gestion d'erreurs améliorées
- 📊 Métriques et monitoring
- 🎨 Amélioration de l'interface utilisateur

**Documentation** :
- 📖 Guides d'utilisation avancés
- 🎬 Vidéos de démonstration
- 🌐 Traductions
- 💡 Exemples de cas d'usage réels

### Guidelines qualité

**Code** :
- TypeScript strict mode
- Couverture de tests > 80%
- Documentation JSDoc
- Respect des conventions n8n

**Documentation** :
- README à jour
- Exemples fonctionnels
- Cas d'usage détaillés
- Messages d'erreur explicites

## Support et documentation

### Ressources disponibles

📚 **Documentation** :
- [Document d'exigences produit (PRD)](./docs/format-template-node-prd.md)
- [Documentation technique](./docs/FormatTemplate.md)
- [Guide de contribution](./CONTRIBUTING.md)

🐛 **Support** :
- [Issues GitHub](https://github.com/your-username/n8n-nodes-format-template/issues)
- [Discussions communautaires](https://github.com/your-username/n8n-nodes-format-template/discussions)
- [Documentation n8n officielle](https://docs.n8n.io/)

### Foire aux questions

**Q: Comment ajouter un nouveau type de transformation ?**  
R: Créez une nouvelle classe dans `handlers/` implémentant `ITransformHandler`. Le système la détectera automatiquement.

**Q: Peut-on transformer plusieurs champs à la fois ?**  
R: Oui, configurez plusieurs entrées dans "Fields to Format" avec différents chemins et types.

**Q: Comment gérer les erreurs de transformation ?**  
R: Le node préserve les données originales en cas d'erreur et logue les détails pour le débogage.

**Q: Les transformations sont-elles réversibles ?**  
R: Non, les transformations modifient définitivement les données. Créez une copie si nécessaire.

### Statistiques du projet

| Métrique | Valeur |
|----------|--------|
| Nombre total de fichiers | ~15 fichiers |
| Lignes de code (TypeScript) | ~800 lignes |
| Handlers disponibles | 3 (TextCase, Phone, Country) |
| Architecture | Modulaire extensible |
| Support n8n | Version 1.0.0+ |
| Découverte automatique | ✅ Activée |
| Interface dynamique | ✅ Basée sur handlers |

### Licence et attribution

Ce projet est sous licence MIT. Contributions et redistribution encouragées selon les termes de la licence.

**Auteur** : Mixtrio (raphael.deret@mixtrio.net)  
**Repository** : [n8n-nodes-format-template](https://github.com/your-username/n8n-nodes-format-template)  
**Version** : 0.1.0

---

*📝 Documentation mise à jour le 4 septembre 2025 via rétro-ingénierie du code source existant*
