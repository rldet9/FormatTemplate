# Document d'Exigences Produit (PRD) - Node FormatTemplate pour n8n

## Vue d'ensemble du produit

### Description
Le node **FormatTemplate** est un composant n8n avancé permettant de transformer et formater dynamiquement les données dans les workflows d'automatisation. Il offre une architecture extensible basée sur des handlers spécialisés pour appliquer des transformations de données complexes sur des champs spécifiques.

### Problématique résolue
Dans les workflows n8n, il est fréquent de devoir :
- Standardiser les formats de données (téléphones, pays, dates)
- Nettoyer et transformer les données avant intégration
- Appliquer des règles métier de formatage
- Maintenir la cohérence des données entre différents systèmes

### Valeur ajoutée
- **Réutilisabilité** : Un seul node pour toutes les transformations
- **Extensibilité** : Architecture modulaire permettant d'ajouter facilement de nouveaux types de transformations
- **Configuration visuelle** : Interface utilisateur dynamique s'adaptant aux transformations choisies
- **Performance** : Traitement en lot des données avec gestion d'erreurs robuste

## Architecture technique

### Composants principaux

#### 1. Node principal (FormatTemplate.node.ts)
- **Responsabilité** : Point d'entrée n8n, orchestration des transformations
- **Fonctionnalités clés** :
  - Validation des chemins de propriétés
  - Gestion des données imbriquées via getProp/setProp
  - Traitement en lot avec gestion d'erreurs individuelles
  - Interface utilisateur dynamique basée sur les handlers disponibles

#### 2. Registre des handlers (TransformHandlerRegistry.ts)
- **Responsabilité** : Gestion centralisée des transformations disponibles
- **Fonctionnalités clés** :
  - Enregistrement automatique des handlers
  - Génération dynamique des options d'interface
  - Découplage entre le node principal et les transformations

#### 3. Découverte automatique (AutoDiscovery.ts)
- **Responsabilité** : Chargement automatique des handlers depuis le système de fichiers
- **Fonctionnalités clés** :
  - Scan automatique du dossier handlers/
  - Validation de l'interface ITransformHandler
  - Gestion des erreurs de chargement

#### 4. Interface handler (TransformHandler.ts)
- **Responsabilité** : Contrat standardisé pour tous les handlers
- **Propriétés requises** :
  - `type` : Identifiant unique
  - `displayName` : Nom d'affichage
  - `description` : Description fonctionnelle
  - `properties` : Configuration UI spécifique
  - `transform()` : Méthode de transformation

## Fonctionnalités implémentées

### 1. Transformation de casse de texte (TextCaseHandler)

**Histoire utilisateur** :
> En tant qu'utilisateur de workflow, je veux pouvoir normaliser la casse des données texte pour assurer la cohérence de mes données.

**Critères d'acceptation** :
- ✅ Support des formats : MAJUSCULES, minuscules, Capitalisation
- ✅ Gestion de la locale française (toLocaleUpperCase/LowerCase)
- ✅ Préservation des caractères non-alphabétiques
- ✅ Validation des données d'entrée

**Cas d'usage** :
- Normalisation des noms de clients
- Standardisation des codes de référence
- Harmonisation des données importées

### 2. Formatage des numéros de téléphone (PhoneHandler)

**Histoire utilisateur** :
> En tant qu'utilisateur de workflow, je veux pouvoir formater automatiquement les numéros de téléphone selon différents standards internationaux.

**Critères d'acceptation** :
- ✅ Support des formats prédéfinis (FR national, FR international, US)
- ✅ Possibilité de patterns personnalisés
- ✅ Conversion automatique entre formats nationaux/internationaux
- ✅ Nettoyage automatique des caractères non-numériques
- ✅ Gestion des préfixes internationaux

**Patterns supportés** :
- `{0:+33 (0) # ## ## ## ##}` - Format français international
- `{0:0# ## ## ## ##}` - Format français national  
- `{0:(###) ###-####}` - Format américain

**Cas d'usage** :
- Normalisation des bases de données clients
- Préparation de données pour systèmes CRM
- Validation avant envoi SMS/appels

### 3. Conversion des codes pays (CountryHandler)

**Histoire utilisateur** :
> En tant qu'utilisateur de workflow, je veux pouvoir convertir automatiquement les noms de pays en codes ISO2 standardisés.

**Critères d'acceptation** :
- ✅ Conversion nom complet → code ISO2 (ex: "France" → "FR")
- ✅ Validation des codes ISO2 existants
- ✅ Utilisation de l'API REST Countries pour la précision
- ✅ Gestion des erreurs pour pays non trouvés
- ✅ Support des noms de pays en différentes langues

**Cas d'usage** :
- Standardisation des données d'adressage
- Intégration avec des APIs nécessitant des codes pays
- Normalisation des données e-commerce

## Interface utilisateur

### Configuration par champ

L'interface utilisateur s'adapte dynamiquement selon le type de transformation choisi :

**Structure de base** :
1. **Field Path** : Chemin vers la propriété à transformer (ex: "phone", "client.country")
2. **Type** : Sélection du type de transformation (alimenté par le registre)
3. **Propriétés spécifiques** : Configuration particulière selon le handler choisi

**Validation** :
- Format du chemin de propriété : `^[a-zA-Z_][a-zA-Z0-9_.]*$`
- Messages d'erreur explicites pour les configurations invalides
- Prévisualisation des transformations en temps réel

## Gestion des données

### Structure des données

**Entrée** :
```json
{
  "client": {
    "name": "jean dupont",
    "phone": "0123456789",
    "country": "France"
  }
}
```

**Configuration** :
```json
{
  "fieldsToFormat": {
    "field": [
      {
        "fieldPath": "client.name",
        "type": "textCase",
        "textCase": "capitalize"
      },
      {
        "fieldPath": "client.phone", 
        "type": "phone",
        "pattern": "{0:+33 (0) # ## ## ## ##}"
      },
      {
        "fieldPath": "client.country",
        "type": "country"
      }
    ]
  }
}
```

**Sortie** :
```json
{
  "client": {
    "name": "Jean Dupont",
    "phone": "+33 (0) 1 23 45 67 89",
    "country": "FR"
  }
}
```

### Gestion des erreurs

**Stratégie de résilience** :
- Traitement individuel de chaque item de données
- Préservation des données originales en cas d'erreur de transformation
- Journalisation détaillée pour le débogage
- Messages d'erreur explicites pour l'utilisateur

**Types d'erreurs gérées** :
- Format de chemin invalide
- Valeur non transformable
- Handler non trouvé
- Erreur réseau (pour CountryHandler)

## Performance et scalabilité

### Optimisations implémentées

**Traitement en lot** :
- Support de datasets volumineux
- Clonage profond pour éviter les références partagées
- Traitement séquentiel pour maintenir l'ordre

**Mise en cache** :
- Registry des handlers chargé une seule fois
- Découverte automatique des handlers au démarrage
- Réutilisation des instances de handlers

**Gestion mémoire** :
- Clonage JSON sélectif des données
- Libération automatique des ressources
- Pas de stockage permanent de données utilisateur

## Extension et maintenance

### Ajout d'un nouveau handler

**Étapes requises** :

1. **Créer la classe handler** :
```typescript
export class CustomHandler implements ITransformHandler {
  type = 'custom';
  displayName = 'Custom Transform';
  description = 'Description de la transformation';
  
  properties: INodeProperties[] = [
    // Configuration UI spécifique
  ];
  
  async transform(context, value, params): Promise<string> {
    // Logique de transformation
  }
}
```

2. **Enregistrement automatique** :
   - Placer le fichier dans `/handlers/`
   - L'AutoDiscovery se charge du reste

3. **Test et validation** :
   - Tester le handler de manière isolée
   - Valider l'intégration dans le node
   - Documenter les cas d'usage

### Guidelines de développement

**Bonnes pratiques** :
- Un handler = une responsabilité
- Gestion explicite des cas d'erreur
- Validation des données d'entrée
- Documentation des patterns supportés
- Tests unitaires systématiques

**Architecture pattern** :
- Interface commune via ITransformHandler
- Découplage handlers ↔ node principal
- Configuration déclarative des propriétés UI
- Gestion asynchrone pour les appels externes

## Roadmap et évolutions futures

### Fonctionnalités à développer

**Phase 2 - Transformations avancées** :
- DateHandler : Formatage et conversion de dates
- CurrencyHandler : Conversion et formatage monétaire
- AddressHandler : Normalisation d'adresses
- EmailHandler : Validation et normalisation d'emails

**Phase 3 - Fonctionnalités avancées** :
- Validation conditionnelle (si-alors)
- Transformation en chaîne (pipeline)
- Import/export de configurations
- Prévisualisation en temps réel

**Phase 4 - Intégrations** :
- Handlers spécifiques par secteur (santé, finance, e-commerce)
- Connecteurs avec APIs de validation externes
- Support des formats de données spécialisés

### Métriques de succès

**Adoption** :
- Nombre d'installations du package
- Fréquence d'utilisation dans les workflows
- Feedback utilisateurs positif

**Performance** :
- Temps de traitement < 100ms par item
- Taux d'erreur < 1%
- Compatibilité avec n8n versions LTS

**Extensibilité** :
- Facilité d'ajout de nouveaux handlers
- Documentation complète des APIs
- Communauté de contributeurs active

## Conclusion

Le node FormatTemplate représente une solution robuste et extensible pour la transformation de données dans l'écosystème n8n. Son architecture modulaire permet une maintenance facilitée et une évolution continue selon les besoins des utilisateurs.

La conception orientée handlers garantit une séparation claire des responsabilités tout en offrant une expérience utilisateur cohérente et intuitive. Cette approche favorise la contribution communautaire et assure la pérennité du produit.
