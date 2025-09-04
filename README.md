# Documentation complète du connecteur n8n pour Evoliz API

## Table des matières
1. Introduction et vue d'ensemble
2. Statistiques du code
3. Architecture générale
4. Composants clés
5. Système de génération d'interface
6. Outils et utilitaires
7. Guide d'extension
8. Guide d'installation et déploiement
9. Guide de débogage
10. Bonnes pratiques

## Introduction et vue d'ensemble

Le connecteur n8n pour Evoliz API est une implémentation avancée permettant d'intégrer les fonctionnalités de gestion commerciale et comptable d'Evoliz dans les workflows d'automatisation n8n. Ce connecteur est construit sur une architecture extensible permettant de supporter de multiples points d'entrée de l'API Evoliz tout en maintenant une cohérence dans l'interface utilisateur et le traitement des données.

L'architecture adopte une approche orientée objet avec plusieurs niveaux d'abstraction, combinée à un système de génération dynamique d'interface utilisateur basé sur des schémas JSON. Cette approche permet de maintenir un code DRY (Don't Repeat Yourself) tout en facilitant l'ajout de nouvelles fonctionnalités.

![Architecture du connecteur Evoliz](./docs/images/n8n_EvolizApi_node_schem_1.png)

## Statistiques du code

| Métrique | Valeur |
|----------|--------|
| Nombre total de fichiers | ~30 fichiers |
| Lignes de code (TypeScript) | ~5000 lignes |
| Nombre de classes principales | 15+ |
| Ressources API implémentées | 15+ (clients, invoices, etc.) |
| Opérations supportées | create, get, update, list, + opérations spécifiques |
| Schémas JSON (ressources) | 15+ fichiers définissant la structure des données |
| Lignes de code Python (outils) | ~300 lignes |
| Workflows de test | 5+ workflows (clients, articles, factures, etc.) |

## Exemple d'utilisation : Modification d'une facture brouillon

### Modifier une facture brouillon (PUT)

Pour modifier une facture en état brouillon, sélectionnez l'opération « update » dans le node EvolizApi, renseignez l'identifiant de la facture et les champs à modifier.

**Exemple de payload :**

```json
{
  "documentdate": "2025-07-17",
  "clientid": 12345,
  "items": [
    { "designation": "Service modifié", "quantity": 2, "unit_price_vat_exclude": 100 }
  ],
  "term": { "paytermid": 3 }
}
```

L'opération PUT sur `/invoices/{id}` ne fonctionne que pour les factures en état brouillon. En cas d'erreur (facture non trouvée, état non brouillon, etc.), un message explicite est retourné.

Voir le schéma JSON `invoices.schema.json` pour la liste complète des champs modifiables.

### Structure des fichiers

```
EvolizApi/
├── credentials/
│   └── EvolizApi.credentials.ts    # Définition des credentials (authentification)
├── nodes/
│   └── EvolizApi/
│       ├── EvolizApi.node.ts       # Point d'entrée principal du nœud
│       ├── EvolizApiService.ts     # Service de communication avec l'API
│       ├── AbstractResourceHandler.ts # Classe abstraite pour gérer les ressources
│       ├── CommonProperties.ts     # Propriétés communes à toutes les ressources
│       ├── GenericFunctions.ts     # Fonctions utilitaires partagées
│       ├── NodeParameterHelper.ts  # Aide à la manipulation des paramètres
│       ├── Schemas.ts              # Gestionnaire de schémas JSON
│       ├── Types.ts                # Définitions des types et interfaces
│       ├── ressources/             # Implémentations spécifiques des ressources
│       │   ├── clients.ts          # Gestionnaire pour la ressource "clients"
│       │   ├── articles.ts         # Gestionnaire pour la ressource "articles"
│       │   ├── invoices.ts         # Gestionnaire pour la ressource "invoices"
│       │   ├── sale-orders.ts      # Gestionnaire pour la ressource "sale-orders"
│       │   ├── settings.ts         # Gestionnaires pour les ressources de configuration
│       │   ├── ...
│       │   └── *.schema.json       # Schémas JSON des ressources
├── tools/
│   ├── generate_schema.py          # Script Python pour générer les schémas
│   ├── api-docs.yml                # Documentation OpenAPI source
│   └── *.schema.json               # Schémas JSON générés depuis l'API
└── wokflows_tests/
    ├── EvolizApi_test_client.json  # Workflow de test pour clients
    ├── EvolizApi_test_article.json # Workflow de test pour articles
    └── ...
```

### Flux de données

1. **Entrée** : L'utilisateur configure le nœud via l'interface de n8n
2. **Exécution** : La méthode `execute()` de `EvolizApi` est appelée
3. **Authentification** : L'authentification est gérée par `EvolizAuth`
4. **Routage** : Les requêtes sont acheminées vers le gestionnaire de ressource approprié
5. **Traitement** : Le gestionnaire prépare les données, reconstruit les objets complexes et valide selon les schémas
6. **Communication API** : `EvolizApiService` envoie les requêtes à l'API Evoliz
7. **Réponse** : Les données reçues sont formatées et renvoyées à n8n

![Flux de données](./docs/images/n8n_EvolizApi_node_schem_2.png)

### Hiérarchie des classes

```
EvolizApi (INodeType)
├── ResourceHandlers (implémentent ISchemaResourceHandler)
│   ├── ClientsHandler
│   ├── InvoicesHandler
│   ├── ArticleHandler
│   ├── ...
│   └── Tous héritent de AbstractResourceHandler
└── EvolizApiService
```

## Composants clés

### AbstractResourceHandler

La classe `AbstractResourceHandler` est la pierre angulaire du connecteur. Elle fournit :

1. **Gestion générique des ressources API** : Implémente les opérations de base (create, update, get, list)
2. **Reconstruction d'objets complexes** : Convertit les données de formulaire en structures JSON appropriées
3. **Validation des entrées** : Utilise les schémas JSON pour valider les données avant envoi
4. **Génération d'interfaces** : Méthodes statiques pour générer dynamiquement l'UI basée sur les schémas

```typescript
export abstract class AbstractResourceHandler implements ISchemaResourceHandler {
    // Méthode principale appelée par n8n
    async execute(operation: string, client: EvolizApiService, ...): Promise<any> {
        // Prépare et valide les données
        return this.executeOperation(operation, client, ...);
    }
    
    // À implémenter par les sous-classes
    protected abstract executeOperation(...): Promise<any>;
    
    // Reconstruction des objets complexes à partir des paramètres du formulaire
    protected reconstructComplexObjects(parameters: Record<string, any>): IDataObject {
        // Logique pour transformer les données de formulaire en structures complexes
    }
    
    // Méthodes de validation via schéma JSON
    validateInput(operation: string, data: Record<string, any>): { valid: boolean; errors?: string[] } {
        // Validation avec Ajv (Another JSON Validator)
    }
    
    // Méthodes statiques de génération UI
    static buildResourceProperties(...): INodeProperties[] { ... }
    static generateFormProperties(...): INodeProperties[] { ... }
    static generateNestedFormProperties(...): INodeProperties[] { ... }
    static generateListProperties(...): INodeProperties[] { ... }
}
```

### EvolizApiService

Cette classe encapsule toutes les communications HTTP avec l'API Evoliz :

1. **Gestion des requêtes** : Envoie des requêtes HTTP à l'API
2. **Pagination automatique** : Gère la récupération de toutes les pages pour les listes
3. **Rate limiting** : Implémente un délai adaptatif pour respecter les limites de l'API
4. **Gestion d'erreurs** : Traite et formate les erreurs de manière cohérente

```typescript
export class EvolizApiService {
    constructor(private accessToken: string, private companyId: string, ...) { ... }
    
    // Méthode publique utilisée par les ResourceHandlers
    public async generateAndSendRequest(
        method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
        endpoint: string, 
        params?: Record<string, any>,
        data?: Record<string, any>
    ): Promise<any> {
        // Gestion des requêtes avec pagination intelligente
    }
    
    // Méthode interne pour les requêtes simples
    private async doSingleRequest(...): Promise<any> {
        // Gestion du rate limiting, requêtes HTTP et erreurs
    }
}
```

### SchemaHelper

Classe utilitaire pour manipuler les schémas JSON :

1. **Chargement des schémas** : Charge les schémas depuis les fichiers JSON
2. **Extraction d'exemples** : Fournit des exemples basés sur les schémas
3. **Création de descriptions** : Génère des descriptions pour les champs

```typescript
export class SchemaHelper {
    static getSchema(resource: string, operation: string, part: string = 'input'): any { ... }
    static getSchemaExample(resource: string, op: string = 'create', schemaPart: string = 'input') { ... }
    static getFieldDescriptions(resource: string): Record<string, string> { ... }
    // etc.
}
```

### EvolizApi (Nœud principal n8n)

La classe principale qui implémente l'interface `INodeType` de n8n :

1. **Point d'entrée** : Définit les propriétés du nœud et gère l'exécution
2. **Routage** : Dirige les requêtes vers les gestionnaires appropriés
3. **Interface utilisateur** : Combine les propriétés de tous les gestionnaires
4. **Gestion des credentials** : Utilise les credentials pour l'authentification
5. **Support IA** : Offre un support spécial pour l'agent IA de n8n

## Système de génération d'interface

Le connecteur utilise un système sophistiqué de génération dynamique d'interface utilisateur basé sur les schémas JSON :

### 1. Formulaires simples

La méthode `generateFormProperties` génère des champs basiques pour les opérations CRUD :

```typescript
static generateFormProperties(resourceName: string, operations: string[] = ['create'], overrides: {...}): INodeProperties[] {
    // Parcourt les propriétés du schéma et crée des champs de formulaire
}
```

### 2. Objets complexes

La méthode `generateNestedFormProperties` gère les structures imbriquées (adresses, conditions de paiement, etc.) :

```typescript
static generateNestedFormProperties(resourceName: string, operations: string[] = ['create', 'update'], ...): INodeProperties[] {
    // 1. Crée un sélecteur de mode (JSON ou Form)
    // 2. Crée un sélecteur de champs optionnels
    // 3. Crée un champ JSON pour l'édition directe
    // 4. Crée une collection de formulaire pour le mode formulaire
}
```

### 3. Propriétés de liste

La méthode `generateListProperties` crée des champs de filtre pour les opérations de liste :

```typescript
static generateListProperties(resourceName: string, overrides: {...}): INodeProperties[] {
    // Génère des filtres basés sur le schéma de liste
    // Gère les champs optionnels via un sélecteur multiOptions
}
```

### 4. Intégration complète

La méthode `buildResourceProperties` combine toutes ces approches :

```typescript
static buildResourceProperties(resourceName: string, operations: ('create' | 'update' | 'list')[] = [...], ...): INodeProperties[] {
    // 1. Ajoute les propriétés communes
    // 2. Ajoute les propriétés de liste si nécessaire
    // 3. Ajoute les propriétés de formulaire pour chaque opération
    // 4. Ajoute les propriétés d'objets complexes
}
```

## Transformation automatique des structures API

Pour compléter la documentation, voici une section détaillée sur la fonction `flattenApiStructure` qui a été intégrée au connecteur.

### 1. Problématique des structures API

Les API REST comme Evoliz présentent souvent une différence structurelle entre les données renvoyées par GET et celles attendues lors des opérations d'écriture (POST/PUT). Par exemple:

```javascript
// Structure reçue par GET
{
  "client": {
    "clientid": 12345,
    "name": "ACME Inc."
  },
  "term": {
    "payterm": {
      "paytermid": 3,
      "label": "15 jours"
    },
    "paytype": {
      "paytypeid": 2,
      "label": "Carte bancaire"
    }
  }
}

// Structure attendue pour POST/PUT
{
  "clientid": 12345,
  "term": {
    "paytermid": 3,
    "paytypeid": 2
  }
}
```

### 2. Solution avec `flattenApiStructure`

Le connecteur inclut une fonction générique qui transforme automatiquement les structures imbriquées en structures adaptées aux opérations d'écriture, tout en préservant la hiérarchie appropriée des objets.

```typescript
protected flattenApiStructure(data: IDataObject, operation: string): IDataObject {
    // Ignorer pour les opérations de lecture
    if (operation === 'get' || operation === 'list') {
        return data;
    }
    
    // Traitement récursif des structures d'objets
    function processStructure(obj: IDataObject): IDataObject {
        // Code de détection et transformation dynamique
        // ...
    }
    
    return processStructure({...data});
}
```

#### Fonctionnement technique

Cette fonction opère de façon entièrement générique sans nécessiter de configuration spécifique:

1. **Analyse récursive**: Parcourt tous les niveaux de l'objet JSON
2. **Détection de motifs**: Identifie automatiquement les patterns comme `object.objectid`
3. **Transformation intelligente**: Extrait les IDs tout en maintenant la hiérarchie
4. **Traitement des tableaux**: Applique la transformation à chaque élément des tableaux

#### Exemples de transformations

| Type de structure | Avant transformation | Après transformation |
|-------------------|-----------------------|----------------------|
| Auto-référence    | `client.clientid: 123` | `clientid: 123` |
| Objets imbriqués  | `term.payterm.paytermid: 3` | `term.paytermid: 3` |
| Objets composites | `obj.subobj.id: 456` | `obj.subid: 456` |

#### Avantages de cette approche

- **Zéro configuration**: Aucune liste prédéfinie de types ou de champs n'est requise
- **Adaptable**: Fonctionne avec toutes les ressources de l'API sans code spécifique
- **Transparente**: L'utilisateur n'a pas besoin de connaître les différences de structure
- **Robuste**: Gère correctement les cas particuliers et structures complexes
- **Extensible**: S'adaptera automatiquement aux nouvelles ressources API

Cette fonction résout élégamment le problème courant de la différence entre les structures de données d'entrée et de sortie dans les API REST, permettant aux utilisateurs du connecteur d'utiliser directement les données obtenues par GET dans les opérations de création ou mise à jour.

## Validation de schéma et contraintes avancées

Le connecteur Evoliz API utilise une validation rigoureuse des données basée sur les schémas JSON pour garantir l'intégrité des données envoyées à l'API.

### Système de validation

#### Architecture de validation

Le connecteur utilise une architecture de validation en plusieurs couches:

1. **Nettoyage préalable** : Avant validation, les données passent par plusieurs étapes de préparation:
   - Transformation des structures imbriquées (`flattenApiStructure`)
   - Suppression des champs hors schéma (`cleanNonSchemaFields`)
   - Élimination des valeurs nulles (`cleanNullValues`)

2. **Validation par schéma** : Utilisation d'Ajv (Another JSON Validator) pour valider contre le schéma JSON:
   ```typescript
   validateInput(operation: string, data: Record<string, any>): { valid: boolean; errors?: string[] } {
       const ajv = new Ajv({ allErrors: true, strict: false });
       const schema = this.getInputSchema(operation);
       const validate = ajv.compile(schema);
       const valid = validate(data);
       
       if (!valid && validate.errors) {
           const errors = validate.errors.map((err) => {
               // Formatage intelligible des erreurs
               return `${err.instancePath} ${err.message}`;
           });
           return { valid: false, errors };
       }
       return { valid: true };
   }
   ```

3. **Messages d'erreur améliorés** : Formatage spécifique selon le type d'erreur:
   ```typescript
   if (err.keyword === 'additionalProperties') {
       return `${path} contient une propriété non autorisée: "${err.params.additionalProperty}"`;
   }
   else if (err.keyword === 'type') {
       return `${path} doit être de type ${err.params.type}`;
   }
   ```

### Contraintes d'exclusivité mutuelle avec oneOf

Un cas particulier important est la gestion de champs mutuellement exclusifs. Le connecteur utilise la combinaison de `oneOf` et `not` pour imposer qu'exactement un parmi plusieurs champs soit présent.

#### Exemple: Référence OU ID d'article

Dans les lignes de commande Evoliz, un article peut être identifié soit par son ID, soit par une référence, mais jamais les deux à la fois:

```json
"oneOf": [
    {
        "required": ["articleid"],
        "not": {
            "properties": {
                "reference": { "type": "string" }
            },
            "required": ["reference"]
        }
    },
    {
        "required": ["reference"],
        "not": {
            "properties": {
                "articleid": { "type": "integer" }
            },
            "required": ["articleid"]
        }
    }
]
```

#### Fonctionnement détaillé

Cette structure définit deux cas mutuellement exclusifs:

1. **Cas 1** : `articleid` est requis ET `reference` ne doit pas être présent
   - `"required": ["articleid"]` - Exige la présence de articleid
   - `"not": { "required": ["reference"] }` - Interdit la présence de reference

2. **Cas 2** : `reference` est requis ET `articleid` ne doit pas être présent
   - `"required": ["reference"]` - Exige la présence de reference
   - `"not": { "required": ["articleid"] }` - Interdit la présence de articleid

La directive `oneOf` assure que exactement un de ces cas doit être vrai.

#### Points importants à considérer

1. **Sensibilité à la casse** - JSON Schema est sensible à la casse. Assurez-vous que les noms de propriétés dans le schéma correspondent exactement à ceux dans les données:
   ```
   "articleid" vs "articleId" - Ce sont deux propriétés différentes pour le validateur
   ```

2. **Positionnement de la contrainte** - La contrainte `oneOf` doit être appliquée au niveau approprié dans la hiérarchie du schéma:
   ```json
   "items": {
     "type": "object",
     "properties": { ... },
     "oneOf": [ ... ]  // Appliqué à chaque élément du tableau
   }
   ```

3. **Comportement avec valeurs nulles** - Une propriété avec valeur `null` est considérée comme présente. Pour considérer une propriété comme absente, elle doit être complètement omise.

### Implémentation dans les schémas personnalisés

Pour implémenter cette contrainte dans vos propres schémas:

1. Identifiez les propriétés mutuellement exclusives
2. Ajoutez la structure `oneOf` avec deux ou plusieurs cas alternatifs
3. Pour chaque cas, définissez la propriété requise et interdisez explicitement les autres

```json
"oneOf": [
    {
        "required": ["proprieteA"],
        "not": {
            "required": ["proprieteB", "proprieteC"]
        }
    },
    {
        "required": ["proprieteB"],
        "not": {
            "required": ["proprieteA", "proprieteC"]
        }
    }
]
```

Cette technique de validation avancée permet d'exprimer des contraintes métier complexes directement dans les schémas JSON, renforçant ainsi l'intégrité des données avant même qu'elles n'atteignent l'API Evoliz.

## Outils et utilitaires

### Générateur de schéma Python (generate_schema.py)

Un script Python qui convertit la documentation OpenAPI d'Evoliz en schémas JSON utilisables par le connecteur :

```python
# Utilisation
# python generate_schema.py -i api-docs.yml -e Clients -o clients.schema.json
```

Caractéristiques :
- Extraction intelligente des schémas depuis l'API
- Conversion des types OpenAPI en formats JSON Schema
- Génération d'exemples de données
- Support des opérations create, update, list et get
- Personnalisation via des labels d'énumération

### Workflows de test

Le dossier wokflows_tests contient des workflows n8n prêts à l'emploi pour tester différentes fonctionnalités :

- EvolizApi_test_client.json : Tests CRUD pour les clients
- EvolizApi_test_article.json : Tests pour les articles
- EvolizApi_test_invoice.json : Tests pour les factures
- Etc.

Ces workflows servent à la fois de tests et d'exemples d'utilisation.

## Guide d'extension

### Ajout d'une nouvelle ressource

1. **Créer le schéma** :
   ```bash
   python tools/generate_schema.py -i tools/api-docs.yml -e NouvelleRessource -o nodes/EvolizApi/ressources/nouvelle-ressource.schema.json
   ```

2. **Créer le gestionnaire de ressource** :
   ```typescript
   // nodes/EvolizApi/ressources/nouvelle-ressource.ts
   import { IDataObject } from "n8n-workflow";
   import { INodeProperties } from "n8n-workflow";
   import { EvolizApiService } from '../EvolizApiService';
   import { AbstractResourceHandler } from "../AbstractResourceHandler";

   const END_POINT = 'nouvelle-ressource';

   export class NouvelleRessourceHandler extends AbstractResourceHandler {
       constructor() {
           super(END_POINT);
       }

       static properties: INodeProperties[] = [
           ...AbstractResourceHandler.buildResourceProperties(END_POINT, ['create','update','list']),
           // Propriétés spécifiques supplémentaires si nécessaire
       ];

       protected async executeOperation(
           operation: string,
           client: EvolizApiService,
           accessToken: string | null,
           id: string,
           data: IDataObject,
           allParameters: Record<string, any>,
           properties: any[]
       ): Promise<any> {
           switch (operation) {
               case 'get':
                   return { data: await client.generateAndSendRequest('GET', `/${this.resourceName}/${id}`) };

               case 'list':
                   const queryParams = AbstractResourceHandler.extractListParameters(
                       allParameters, properties, ['per_page']
                   );
                   return await client.generateAndSendRequest('GET', `/${this.resourceName}`, queryParams);

               case 'create':
                   return await client.generateAndSendRequest('POST', `/${this.resourceName}`, {}, data);

               case 'update':
                   return await client.generateAndSendRequest('PATCH', `/${this.resourceName}/${id}`, {}, data);
               
               // Opérations spécifiques supplémentaires
               default:
                   throw new Error(`Operation "${operation}" not implemented for ${this.resourceName}`);
           }
       }
   }
   ```

3. **Enregistrer dans le nœud principal** :
   ```typescript
   // Dans EvolizApi.node.ts
   
   // 1. Importer le gestionnaire
   import { NouvelleRessourceHandler } from './ressources/nouvelle-ressource';
   
   // 2. Ajouter à la liste des ressources
   displayName: 'Resource',
   name: 'resource',
   type: 'options',
   options: [
       // ...autres ressources
       { name: 'Nouvelle Ressource', value: 'nouvelle-ressource', description: 'Description de la ressource' },
   ]
   
   // 3. Ajouter le sélecteur d'opération
   {
       displayName: 'Operation',
       name: 'operation',
       type: 'options',
       noDataExpression: true,
       displayOptions: {
           show: {
               resource: ['nouvelle-ressource'],
           },
       },
       options: [
           { name: 'Create', value: 'create', action: 'Create a new resource' },
           { name: 'Get', value: 'get', action: 'Get a resource by ID' },
           { name: 'List', value: 'list', action: 'List all resources' },
           { name: 'Update', value: 'update', action: 'Update a resource' },
       ],
       default: 'list',
       description: 'Opération à effectuer',
   }
   
   // 4. Ajouter les propriétés à la liste principale
   properties: [
       // ...autres propriétés
       ...NouvelleRessourceHandler.properties,
   ]
   
   // 5. Enregistrer dans le routeur
   // Dans la fonction execute() ou dans EvolizRoutes.ts si vous en avez un
   ```

### Ajout d'une opération spéciale

Pour ajouter une opération spéciale à une ressource existante :

1. **Mettre à jour le sélecteur d'opération** :
   ```typescript
   options: [
       // Opérations existantes
       { name: 'Special Operation', value: 'specialOp', action: 'Do something special' },
   ]
   ```

2. **Ajouter des propriétés spécifiques** :
   ```typescript
   static properties: INodeProperties[] = [
       // Propriétés existantes
       
       // Nouvelles propriétés spécifiques
       {
           displayName: 'Special Parameter',
           name: 'specialParam',
           type: 'string',
           default: '',
           description: 'Parameter for special operation',
           displayOptions: {
               show: {
                   resource: [END_POINT],
                   operation: ['specialOp'],
               },
           },
       },
   ];
   ```

3. **Implémenter dans executeOperation** :
   ```typescript
   case 'specialOp':
       // Extraction des paramètres spécifiques
       const specialParam = allParameters.specialParam as string;
       // Appel API
       return await client.generateAndSendRequest(
           'POST', 
           `/${this.resourceName}/${id}/special-action`, 
           {}, 
           { specialParam }
       );
   ```

## Guide d'installation et déploiement

### Installation locale (développement)

1. **Préparer l'environnement** :
   ```bash
   # Installer n8n globalement
   npm install n8n -g
   
   # Créer un répertoire pour les nœuds personnalisés
   mkdir -p ~/.n8n/custom
   cd ~/.n8n/custom
   
   # Cloner le dépôt
   git clone https://github.com/votre-utilisateur/n8n_nodes_EvolizApi.git
   cd n8n_nodes_EvolizApi
   
   # Installer les dépendances
   npm install
   
   # Compiler le code
   npm run build
   ```

2. **Configurer n8n** :
   ```bash
   # Créer un lien symbolique (si nécessaire)
   cd ~/.n8n/custom
   ln -s ./n8n_nodes_EvolizApi/dist .
   
   # Démarrer n8n avec les nœuds personnalisés
   n8n start
   ```

### Installation en production

1. **Sur un serveur n8n existant** :
   ```bash
   # Se connecter au serveur
   ssh user@your-n8n-server
   
   # Accéder au répertoire des nœuds personnalisés
   cd /root/.n8n/custom
   
   # Cloner et installer
   git clone https://github.com/votre-utilisateur/n8n_nodes_EvolizApi.git
   cd n8n_nodes_EvolizApi
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
   RUN git clone https://github.com/votre-utilisateur/n8n_nodes_EvolizApi.git
   WORKDIR /root/.n8n/custom/n8n_nodes_EvolizApi
   RUN npm install
   RUN npm run build
   
   # Revenir à l'utilisateur node
   USER node
   WORKDIR /data
   ```
   
   Construire et exécuter :
   ```bash
   docker build -t n8n-with-evoliz .
   docker run -it --rm -p 5678:5678 n8n-with-evoliz
   ```

## Guide de débogage

### Configuration du débogage dans VSCode

1. **Créer une configuration de lancement** :
   
   File launch.json :
   ```json
   {
       "version": "0.2.0",
       "configurations": [
           {
               "type": "node",
               "request": "launch",
               "name": "Debug n8n with Custom Nodes",
               "program": "${workspaceFolder}/node_modules/n8n/bin/n8n",
               "args": ["start", "--tunnel"],
               "env": {
                   "N8N_CUSTOM_EXTENSIONS": "${workspaceFolder}"
               },
               "skipFiles": [
                   "<node_internals>/**"
               ],
               "outFiles": [
                   "${workspaceFolder}/dist/**/*.js"
               ],
               "sourceMaps": true,
               "resolveSourceMapLocations": [
                   "${workspaceFolder}/dist/**/*.js",
                   "!**/node_modules/**"
               ]
           }
       ]
   }
   ```

2. **Ajouter des points d'arrêt** :
   - Dans EvolizApi.node.ts dans la méthode `execute()`
   - Dans AbstractResourceHandler.ts dans la méthode `reconstructComplexObjects()`
   - Dans les gestionnaires spécifiques de ressources

### Débogage pas à pas en développement

1. **Journalisation** :
   
   Ajouter des logs stratégiques :
   ```typescript
   console.log(`[Evoliz Debug] Paramètres pour ${operation}:`, JSON.stringify(parameters, null, 2));
   ```

2. **Exécution en mode débogage** :
   ```bash
   # Démarrer n8n avec débogage
   n8n start --inspect
   
   # Puis connecter Chrome DevTools ou VSCode
   ```

3. **Surveillance des logs** :
   ```bash
   # En local
   tail -f ~/.n8n/n8n-error.log
   
   # En production
   docker logs -f n8n-container-name
   ```

4. **Utilisation des workflows de test** :
   - Importer un workflow depuis wokflows_tests
   - Mettre à jour les credentials selon votre environnement
   - Exécuter étape par étape

## Bonnes pratiques

### Maintenance des schémas

1. **Mise à jour des schémas** :
   ```bash
   # Télécharger la dernière documentation OpenAPI
   curl -o tools/api-docs.yml https://www.evoliz.io/api-docs.yml
   
   # Régénérer tous les schémas
   python tools/generate_schema.py -i tools/api-docs.yml -e Clients -o nodes/EvolizApi/ressources/clients.schema.json
   python tools/generate_schema.py -i tools/api-docs.yml -e Invoices -o nodes/EvolizApi/ressources/invoices.schema.json
   # etc.
   ```

### Performance et optimisation

1. **Pagination et mise en cache** :
   - La classe `EvolizApiService` gère automatiquement la pagination
   - Les résultats intermédiaires sont mis en cache pour éviter les appels inutiles

2. **Rate limiting adaptatif** :
   - Le système calcule dynamiquement les délais entre les requêtes
   - Respecte les limites de l'API tout en maximisant les performances

### Sécurité

1. **Validation des entrées** :
   - Toutes les entrées sont validées via les schémas JSON avant envoi
   - Les erreurs de validation sont détectées avant d'atteindre l'API

2. **Gestion des credentials** :
   - Les tokens d'accès sont stockés de manière sécurisée
   - La rotation des tokens est gérée automatiquement

### Extensibilité

Le système est conçu pour être facilement étendu :
- Les ressources sont implémentées de manière indépendante
- L'ajout de nouvelles opérations ne nécessite que des modifications localisées
- Les schémas peuvent être mis à jour sans changer le code
