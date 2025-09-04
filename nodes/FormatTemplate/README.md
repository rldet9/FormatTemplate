# Documentation complète du nœud n8n FormatTemplate

## Table des matières
1. Introduction et vue d'ensemble
2. Statistiques du code
3. Architecture générale
4. Composants clés
5. Système de transformation modulaire
6. Types de formatage intégrés
7. Guide d'extension
8. Guide d'installation et déploiement
9. Guide de débogage
10. Bonnes pratiques

## Introduction et vue d'ensemble

Le nœud FormatTemplate est un composant d'extension pour n8n qui permet de formater et transformer des données selon des modèles prédéfinis ou personnalisés. Il a été conçu avec une architecture modulaire et extensible pour faciliter l'ajout de nouveaux types de formatage.

Ce nœud résout un problème courant dans les workflows d'automatisation : la nécessité de standardiser les formats de données (numéros de téléphone, codes pays, casse de texte, etc.) sans avoir à utiliser de multiples nœuds de fonction ou de code JavaScript complexe.

![Architecture du nœud FormatTemplate](./docs/images/FormatTemplate_architecture.png)

Le nœud utilise un système de handlers spécialisés qui peuvent être facilement étendus pour prendre en charge de nouveaux types de transformation, tout en maintenant une interface utilisateur cohérente et intuitive.

## Statistiques du code

| Métrique | Valeur |
|----------|--------|
| Nombre total de fichiers | 7 fichiers |
| Lignes de code (TypeScript) | ~500 lignes |
| Nombre de classes principales | 5 |
| Types de formatage intégrés | 3 (téléphone, casse de texte, code pays) |
| Architecture | Modulaire avec handlers extensibles |
| Interface utilisateur | Dynamiquement générée depuis les handlers |
| Support multilingue | Oui (fr-FR) |

## Architecture générale

### Structure des fichiers

```
FormatTemplate/
├── FormatTemplate.node.ts       # Point d'entrée principal du nœud
├── FormatTemplate.svg           # Icône du nœud
├── TransformHandlerRegistry.ts  # Registre des handlers de transformation
├── AutoDiscovery.ts             # Découverte automatique des handlers
├── interfaces/
│   └── TransformHandler.ts      # Interface pour les handlers de transformation
├── handlers/
│   ├── PhoneHandler.ts          # Handler pour les numéros de téléphone
│   ├── TextCaseHandler.ts       # Handler pour la casse de texte
│   └── CountryHandler.ts        # Handler pour les codes pays
└── README.md                    # Documentation du nœud
```

### Flux de données

1. **Entrée** : Le nœud reçoit des données à transformer (items)
2. **Configuration** : L'utilisateur spécifie les champs à formater et le type de formatage
3. **Traitement** : Pour chaque champ, le nœud:
   - Récupère la valeur actuelle du champ
   - Identifie le handler approprié pour le type de formatage
   - Applique la transformation via le handler
   - Met à jour la valeur dans l'objet de sortie
4. **Sortie** : Le nœud renvoie les données avec les valeurs formatées

### Hiérarchie des classes

```
FormatTemplate (INodeType)
├── TransformHandlerRegistry
│   └── Registre centralisé des handlers
├── Handlers (implémentent ITransformHandler)
│   ├── PhoneHandler
│   ├── TextCaseHandler
│   └── CountryHandler
└── AutoDiscovery
    └── Découverte dynamique des handlers
```

## Composants clés

### FormatTemplate (Nœud principal)

La classe principale qui implémente l'interface `INodeType` de n8n :
- Définit l'interface utilisateur du nœud
- Génère dynamiquement les propriétés d'UI en fonction des handlers disponibles
- Gère le cycle de vie de l'exécution
- Coordonne la validation et la transformation des données

```typescript
export class FormatTemplate implements INodeType {
  // Définition de l'interface utilisateur
  description: INodeTypeDescription = {
    // Propriétés du nœud
    // ...
    properties: [
      // Collection de champs à formater
      // ...
      // Propriétés dynamiques générées depuis les handlers
      ...this.generateDynamicProperties(),
    ],
  };

  // Exécution du nœud
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    // Pour chaque élément d'entrée
    // Traiter chaque champ à formater
    // Appliquer les transformations via les handlers appropriés
    // Retourner les données transformées
  }
}
```

### TransformHandlerRegistry

Registre central qui gère l'ensemble des handlers de transformation disponibles :
- Maintient une collection de handlers indexés par type
- Fournit des méthodes pour enregistrer et récupérer les handlers
- Génère les options UI pour le sélecteur de type
- Initialise les handlers au démarrage

```typescript
export class TransformHandlerRegistry {
  private static handlers: Map<string, ITransformHandler> = new Map();
  
  // Enregistrer un nouveau handler
  static register(handler: ITransformHandler): void {
    this.handlers.set(handler.type, handler);
  }
  
  // Récupérer un handler par type
  static getHandler(type: string): ITransformHandler | undefined {
    return this.handlers.get(type);
  }
  
  // Récupérer tous les handlers
  static getAllHandlers(): ITransformHandler[] {
    return Array.from(this.handlers.values());
  }
  
  // Générer les options pour l'UI
  static getTypeOptions(): INodePropertyOptions[] {
    return Array.from(this.handlers.values()).map(handler => ({
      name: handler.displayName,
      value: handler.type,
      description: handler.description
    }));
  }
}
```

### Interface ITransformHandler

Interface commune implémentée par tous les handlers de transformation :
- Définit la structure et le comportement des handlers
- Garantit la cohérence entre les différents types de transformation
- Facilite l'extension avec de nouveaux handlers

```typescript
export interface ITransformHandler {
  // Identifiant unique du handler
  type: string;
  
  // Nom d'affichage dans l'UI
  displayName: string;
  
  // Description de la fonctionnalité
  description: string;
  
  // Propriétés spécifiques pour la configuration
  properties: INodeProperties[];
  
  // Méthode de transformation
  transform(
    executionContext: IExecuteFunctions,
    value: string,
    params: Record<string, any>
  ): Promise<string>;
}
```

### AutoDiscovery

Composant pour la découverte automatique et le chargement des handlers :
- Scanne le répertoire des handlers
- Instancie et enregistre les handlers compatibles
- Facilite l'extension sans modifier le code principal

```typescript
export class AutoDiscovery {
  static loadHandlersFromDirectory(dirPath: string): void {
    // Lire les fichiers du répertoire
    // Charger les modules potentiels
    // Vérifier si ce sont des handlers valides
    // Enregistrer les handlers trouvés
  }
}
```

## Système de transformation modulaire

Le nœud FormatTemplate utilise une architecture de plugins (handlers) pour la transformation des données. Chaque handler:

1. **Spécialisation** : Se concentre sur un type spécifique de transformation
2. **Auto-description** : Fournit ses métadonnées (nom, description, propriétés)
3. **Auto-enregistrement** : Est automatiquement découvert et ajouté au registre
4. **Isolation** : Contient sa propre logique sans affecter les autres handlers

### Cycle de vie d'une transformation

1. **Découverte** : Au démarrage, les handlers sont découverts et enregistrés
2. **Configuration** : L'UI est générée dynamiquement en fonction des handlers disponibles
3. **Exécution** : À l'exécution, le handler approprié est sélectionné selon le type
4. **Transformation** : La méthode `transform()` du handler est appelée avec la valeur
5. **Application** : Le résultat est inséré dans les données de sortie

### Mécanisme d'extension UI dynamique

Le nœud utilise un mécanisme intelligent pour montrer uniquement les propriétés pertinentes en fonction du type sélectionné :

```typescript
private generateDynamicProperties() {
  const dynamicProperties: INodeProperties[] = [];
  
  // Pour chaque handler enregistré
  for (const handler of TransformHandlerRegistry.getAllHandlers()) {
    // Pour chaque propriété du handler
    for (const prop of handler.properties) {
      // Copier la propriété et ajouter la condition d'affichage
      const dynamicProp = { ...prop };
      
      // Afficher seulement quand le type correspond
      dynamicProp.displayOptions = {
        show: {
          type: [handler.type],
        },
      };
      
      dynamicProperties.push(dynamicProp);
    }
  }
  
  return dynamicProperties;
}
```

## Types de formatage intégrés

### PhoneHandler

Formatage des numéros de téléphone selon différents modèles :

- **Fonctionnalités** :
  - Formats prédéfinis (international, national, US)
  - Support des formats personnalisés
  - Conversion automatique international → national
  - Détection intelligente des préfixes (0033, 33)

- **Exemple** :
  - Entrée : `0033252200210` 
  - Format : `0# ## ## ## ##` (FR National)
  - Sortie : `02 52 20 02 10`

```typescript
private applyPattern(raw: string, pattern: string): string {
  // Nettoyage du modèle
  const cleanPattern = pattern.replace(/^\{0:/, '').replace(/\}$/, '');
  // Extraction des chiffres
  let digits = raw.replace(/\D/g, '');
  // Conversion international → national
  if ((digits.startsWith('0033') || digits.startsWith('33'))) {
    digits = digits.startsWith('0033') ? digits.substring(4) : digits.substring(2);
  }
  // Application du format
  // ...
}
```

### TextCaseHandler

Transformation de la casse des textes :

- **Fonctionnalités** :
  - MAJUSCULES
  - minuscules
  - Première Lettre En Majuscule
  - Support multilingue (accents français)

- **Exemple** :
  - Entrée : `deret` 
  - Format : `capitalize`
  - Sortie : `Deret`

```typescript
switch (caseType.toLowerCase()) {
  case 'uppercase':
    return value.toLocaleUpperCase('fr-FR');
  case 'lowercase':
    return value.toLocaleLowerCase('fr-FR');
  case 'capitalize':
    return value.charAt(0).toLocaleUpperCase('fr-FR') + 
           value.slice(1).toLocaleLowerCase('fr-FR');
}
```

### CountryHandler

Conversion et normalisation des codes pays :

- **Fonctionnalités** :
  - Validation des codes ISO2 existants
  - Conversion des noms de pays en codes ISO2
  - Recherche via l'API REST Countries
  - Gestion des erreurs avec messages explicites

- **Exemple** :
  - Entrée : `france` 
  - Sortie : `FR`

```typescript
// Vérifier si c'est déjà un code ISO2 valide
if (/^[A-Z]{2}$/i.test(value)) {
  return value.toUpperCase();
}

// Sinon, appeler l'API REST Countries
const response = await executionContext.helpers.request({
  method: 'GET',
  url: `https://restcountries.com/v3.1/name/${encodeURIComponent(value)}`,
  qs: { fields: 'cca2' },
  json: true,
});

// Récupérer et retourner le code pays
if (Array.isArray(response) && response.length > 0 && response[0].cca2) {
  return response[0].cca2;
}
```

## Guide d'extension

### Ajout d'un nouveau handler de transformation

1. **Créer un nouveau fichier handler** dans le répertoire `handlers/` :

```typescript
// handlers/MonNouveauHandler.ts
import { ITransformHandler } from '../interfaces/TransformHandler';
import { INodeProperties, IExecuteFunctions } from 'n8n-workflow';

export class MonNouveauHandler implements ITransformHandler {
  type = 'monType';  // Identifiant unique
  displayName = 'Mon Type';  // Nom affiché dans l'UI
  description = 'Description de mon handler';  // Description

  // Propriétés spécifiques à ce handler
  properties: INodeProperties[] = [
    {
      displayName: 'Ma Propriété',
      name: 'maPropriete',
      type: 'string',  // ou un autre type (number, boolean, options...)
      default: '',
      // ...autres options
    },
    // Autres propriétés si nécessaire
  ];

  // Méthode de transformation
  async transform(
    executionContext: IExecuteFunctions,
    value: string,
    params: Record<string, any>
  ): Promise<string> {
    // Récupérer les paramètres
    const monParam = params.maPropriete;
    
    // Logique de transformation
    // ...
    
    // Retourner la valeur transformée
    return valeurTransformee;
  }
}
```

2. **Le handler sera automatiquement découvert** et ajouté aux options du nœud sans autre modification requise.

### Personnalisation avancée de l'UI

Pour des propriétés plus complexes ou des comportements spécifiques :

```typescript
properties: INodeProperties[] = [
  {
    displayName: 'Mode',
    name: 'mode',
    type: 'options',
    options: [
      { name: 'Simple', value: 'simple' },
      { name: 'Avancé', value: 'advanced' },
    ],
    default: 'simple',
  },
  {
    displayName: 'Options avancées',
    name: 'advancedOptions',
    type: 'fixedCollection',
    displayOptions: {
      show: {
        mode: ['advanced'],
      },
    },
    default: {},
    options: [
      {
        name: 'options',
        displayName: 'Options',
        values: [
          // Propriétés imbriquées
        ],
      },
    ],
  },
];
```

## Guide d'installation et déploiement

### Installation locale (développement)

1. **Préparer l'environnement** :
   ```bash
   # Créer un répertoire pour les nœuds personnalisés
   mkdir -p ~/.n8n/custom
   cd ~/.n8n/custom
   
   # Cloner le dépôt
   git clone https://github.com/votre-utilisateur/n8n_nodes_FormatTemplate.git
   cd n8n_nodes_FormatTemplate
   
   # Installer les dépendances
   npm install
   
   # Compiler le code
   npm run build
   ```

2. **Démarrer n8n avec les nœuds personnalisés** :
   ```bash
   n8n start
   ```

### Installation en production

1. **Sur un serveur n8n existant** :
   ```bash
   # Accéder au répertoire des nœuds personnalisés
   cd /root/.n8n/custom
   
   # Cloner et installer
   git clone https://github.com/votre-utilisateur/n8n_nodes_FormatTemplate.git
   cd n8n_nodes_FormatTemplate
   npm install
   npm run build
   
   # Redémarrer n8n
   systemctl restart n8n
   ```

2. **Dans un conteneur Docker** :
   
   Créer un Dockerfile personnalisé :
   ```dockerfile
   FROM n8nio/n8n:latest
   
   # Installer git et outils de compilation
   USER root
   RUN apk add --update git
   
   # Cloner et installer le nœud personnalisé
   RUN mkdir -p /root/.n8n/custom
   WORKDIR /root/.n8n/custom
   RUN git clone https://github.com/votre-utilisateur/n8n_nodes_FormatTemplate.git
   WORKDIR /root/.n8n/custom/n8n_nodes_FormatTemplate
   RUN npm install
   RUN npm run build
   
   # Revenir à l'utilisateur node
   USER node
   WORKDIR /data
   ```

## Guide de débogage

### Comprendre les logs

Le nœud FormatTemplate inclut un système de logging détaillé :

```
[FormatTemplate] Processing item 0, fields to format: 1
[FormatTemplate] Current value for phone: 0033252200210
[PhoneHandler] Digits: 252200210, Pattern: 0# ## ## ## ##, Format length: 10
[PhoneHandler] Formatted result: 0033252200210 -> 02 52 20 02 10
[FormatTemplate] Setting phone to: 02 52 20 02 10
[FormatTemplate] Value after update: 02 52 20 02 10
```

Pour activer le débogage avancé, vous pouvez:

1. **Ajouter des logs supplémentaires** :
   ```typescript
   console.log(`[CustomDebug] Valeur: ${maValeur}, Paramètres:`, JSON.stringify(mesParams));
   ```

2. **Utiliser les outils de débogage de n8n** :
   ```bash
   # Démarrer n8n avec débogage
   n8n start --inspect
   ```

### Erreurs courantes et solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Format de chemin invalide` | Le chemin du champ ne suit pas le format attendu | Utiliser des chemins de propriété valides (ex: `client.phone`) |
| `Cannot read properties of undefined` | Propriété manquante dans la configuration | Vérifier les noms de paramètres dans les handlers |
| `Handler non trouvé pour le type` | Type de handler inexistant | Vérifier l'orthographe du type ou créer le handler manquant |
| `Impossible de trouver le code pays` | Le pays ne peut pas être résolu via l'API | Vérifier le nom du pays ou utiliser directement le code ISO2 |

## Bonnes pratiques

### Conception des handlers

1. **Spécialisation** : Un handler doit avoir une responsabilité unique et clairement définie
2. **Robustesse** : Gérer les cas d'erreur et les valeurs nulles ou invalides
3. **Journalisation** : Fournir des logs utiles pour le débogage
4. **Paramétrage** : Offrir des options de configuration pertinentes et utiles
5. **Internationalisation** : Utiliser les méthodes localisées pour le formatage de texte

### Performance

1. **Traitement léger** : Éviter les opérations lourdes pendant la transformation
2. **Mise en cache** : Pour les handlers utilisant des API externes, considérer la mise en cache des résultats
3. **Validation précoce** : Valider les entrées au plus tôt pour éviter les traitements inutiles

### Extensibilité

Le nœud est conçu pour être facilement étendu :
- L'auto-découverte permet d'ajouter de nouveaux handlers sans modifier le code principal
- L'interface `ITransformHandler` assure la compatibilité des nouveaux handlers
- Le registre centralise la gestion des handlers et leur utilisation

### Suggestions de nouveaux handlers

- **DateFormatHandler** : Formatage de dates selon différents standards
- **NumberFormatHandler** : Formatage de nombres (arrondi, séparateurs, devises)
- **AddressFormatHandler** : Normalisation des adresses postales
- **EmailFormatHandler** : Normalisation et validation des adresses email
- **ColorFormatHandler** : Conversion entre formats de couleur (HEX, RGB, HSL)

## Conclusion

Le nœud FormatTemplate offre une solution modulaire et extensible pour le formatage et la transformation des données dans n8n. Sa conception orientée plugin permet une grande flexibilité tout en maintenant une interface utilisateur cohérente et intuitive.

Que vous souhaitiez standardiser des numéros de téléphone, normaliser la casse de texte ou convertir des noms de pays en codes ISO, FormatTemplate simplifie ces tâches sans nécessiter de code JavaScript complexe.

Sa capacité d'extension en fait un outil évolutif qui peut s'adapter à vos besoins spécifiques en matière de transformation de données.
