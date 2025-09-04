# Guide d'utilisation - Node FormatTemplate

## Introduction

Le node **FormatTemplate** vous permet de transformer et formater automatiquement vos données dans n8n. Ce guide vous accompagne pas à pas pour utiliser efficacement toutes ses fonctionnalités.

## Démarrage rapide

### 1. Ajout du node

1. Dans votre workflow n8n, cliquez sur le bouton **+** pour ajouter un nouveau node
2. Recherchez **"Format Template"** dans la catégorie **Transform**
3. Glissez-déposez le node dans votre workflow

### 2. Configuration de base

Le node apparaît avec une section **"Fields to Format"**. Cliquez sur **"Add Field"** pour configurer votre première transformation.

#### Configuration d'un champ

Pour chaque champ à transformer, vous devez configurer :

**Field Path** : Le nom de la propriété à transformer
- ✅ `name` - Propriété simple
- ✅ `client.name` - Propriété imbriquée  
- ✅ `contact.address.country` - Propriété profondément imbriquée
- ❌ `"Jean Dupont"` - ⚠️ Il faut indiquer le nom de la propriété, pas sa valeur

**Type** : Le type de transformation à appliquer
- Les options changent automatiquement selon votre choix

**Options spécifiques** : Configuration selon le type choisi

## Types de transformations disponibles

### 🔤 Text Case - Transformation de casse

**Utilisation** : Normaliser la casse des textes (noms, codes, etc.)

**Options** :
- **UPPERCASE** : Convertit tout en majuscules
- **lowercase** : Convertit tout en minuscules  
- **Capitalize** : Met la première lettre en majuscule

**Exemple** :
```
Données d'entrée : "jean DUPONT"
Type : Text Case
Case : Capitalize
Résultat : "Jean Dupont"
```

**Cas d'usage courants** :
- Normalisation des noms de clients
- Standardisation des codes de référence
- Harmonisation des données importées

### 📱 Phone - Formatage des téléphones

**Utilisation** : Formater les numéros de téléphone selon des standards

**Patterns prédéfinis** :
- **+33 (0) # ## ## ## ## (Fr International)** : Format français avec indicatif
- **0# ## ## ## ## (FR National)** : Format français national
- **(###) ###-#### (US)** : Format américain

**Patterns personnalisés** :
Vous pouvez aussi saisir votre propre pattern :
- `#` = Chiffre optionnel
- `0` = Chiffre requis ou littéral 0
- Autres caractères = Ponctuation conservée

**Exemples** :
```
Données d'entrée : "0123456789"
Pattern : {0:+33 (0) # ## ## ## ##}
Résultat : "+33 (0) 1 23 45 67 89"

Données d'entrée : "+33123456789"  
Pattern : {0:0# ## ## ## ##}
Résultat : "01 23 45 67 89"
```

**Conversions automatiques** :
- Le système convertit automatiquement entre formats nationaux et internationaux
- Supprime automatiquement les caractères non-numériques

### 🌍 Country Code - Codes pays

**Utilisation** : Convertir les noms de pays en codes ISO2 standardisés

**Fonctionnement** :
- Si c'est déjà un code ISO2 valide (ex: "FR"), il est conservé
- Si c'est un nom de pays (ex: "France"), il est converti via une API
- Support multilingue : "France", "Frankrijk", "Francia" → "FR"

**Exemples** :
```
Données d'entrée : "France"
Type : Country Code  
Résultat : "FR"

Données d'entrée : "United Kingdom"
Type : Country Code
Résultat : "GB"

Données d'entrée : "DE"
Type : Country Code
Résultat : "DE" (déjà valide)
```

**Note** : Cette transformation nécessite un accès internet pour interroger l'API REST Countries.

## Exemples pratiques complets

### Exemple 1 : Normalisation d'une base de données clients

**Données d'entrée** :
```json
{
  "client": {
    "name": "jean MARTIN",
    "company": "ACME corp",
    "phone": "01.23.45.67.89",
    "country": "France"
  }
}
```

**Configuration** :
1. **Field Path** : `client.name`, **Type** : `Text Case`, **Case** : `Capitalize`
2. **Field Path** : `client.company`, **Type** : `Text Case`, **Case** : `UPPERCASE`  
3. **Field Path** : `client.phone`, **Type** : `Phone`, **Pattern** : `{0:+33 (0) # ## ## ## ##}`
4. **Field Path** : `client.country`, **Type** : `Country Code`

**Résultat** :
```json
{
  "client": {
    "name": "Jean Martin",
    "company": "ACME CORP", 
    "phone": "+33 (0) 1 23 45 67 89",
    "country": "FR"
  }
}
```

### Exemple 2 : Préparation de données e-commerce

**Données d'entrée** :
```json
{
  "order": {
    "customer_name": "MARIE dubois",
    "billing_country": "united states",
    "shipping_phone": "2125551234"
  }
}
```

**Configuration** :
1. **Field Path** : `order.customer_name`, **Type** : `Text Case`, **Case** : `Capitalize`
2. **Field Path** : `order.billing_country`, **Type** : `Country Code`
3. **Field Path** : `order.shipping_phone`, **Type** : `Phone`, **Pattern** : `{0:(###) ###-####}`

**Résultat** :
```json
{
  "order": {
    "customer_name": "Marie Dubois",
    "billing_country": "US",
    "shipping_phone": "(212) 555-1234"
  }
}
```

## Gestion des erreurs

### Types d'erreurs courantes

#### ❌ Erreur de chemin de propriété
**Message** : `Format de chemin invalide: "123field"`
**Cause** : Le chemin ne respecte pas le format attendu
**Solution** : Utilisez uniquement lettres, chiffres, underscores et points. Commencez par une lettre.

#### ❌ Propriété inexistante
**Comportement** : Le champ est ignoré, aucune erreur n'est levée
**Log** : `Field client.email is undefined/null, skipping`

#### ❌ Pays non trouvé
**Message** : `Impossible de trouver le code pays pour "Atlantide"`
**Cause** : Le nom de pays n'existe pas dans la base de données
**Solution** : Vérifiez l'orthographe ou utilisez un nom de pays standard

#### ❌ Erreur réseau (Country Code)
**Message** : `Impossible de convertir "France" en code pays ISO2: timeout`
**Cause** : Problème de connexion à l'API REST Countries
**Solution** : Vérifiez votre connexion internet et réessayez

### Stratégie de récupération

Le node utilise une **stratégie de résilience** :
- Si une transformation échoue, les données originales sont conservées
- Les autres transformations continuent normalement
- Les erreurs sont loggées pour diagnostic
- Le workflow n'est pas interrompu

## Bonnes pratiques

### Configuration efficace

1. **Testez avec un échantillon** : Commencez avec quelques items pour valider vos transformations
2. **Groupez les transformations** : Configurez tous vos champs en une seule fois plutôt que d'utiliser plusieurs nodes
3. **Utilisez des noms explicites** : Renommez votre node FormatTemplate avec un nom descriptif

### Performance

1. **Optimisez les chemins** : Utilisez des chemins directs plutôt que des structures complexes
2. **Limitez les appels externes** : Le Country Code fait des appels API, utilisez-le avec modération
3. **Préparez vos données** : Nettoyez vos données en amont pour réduire les erreurs

### Débogage

1. **Activez les logs** : Surveillez les logs n8n pour comprendre les transformations
2. **Testez individuellement** : Désactivez temporairement certaines transformations pour isoler les problèmes
3. **Utilisez des données de test** : Créez des jeux de données de test pour valider votre configuration

## Limitation actuelles

### Fonctionnalités non supportées

- **Tableaux** : Les transformations sur les éléments de tableaux ne sont pas encore supportées
- **Transformations conditionnelles** : Pas de support des conditions if-then
- **Transformations réversibles** : Les transformations sont définitives
- **Validation en temps réel** : Pas de prévisualisation avant exécution

### Contournements

**Pour les tableaux** :
Utilisez un node "Split In Batches" en amont, puis "Merge" en aval

**Pour les conditions** :
Utilisez un node "If" en amont pour router selon vos conditions

**Pour la validation** :
Testez sur un échantillon dans un workflow de développement séparé

## Ressources supplémentaires

- **Documentation technique** : [FormatTemplate.md](./FormatTemplate.md)
- **Guide de développement** : [README.md](../README.md#guide-de-développement)
- **Document d'exigences produit** : [format-template-node-prd.md](./format-template-node-prd.md)
- **Support communautaire** : [Issues GitHub](https://github.com/your-username/n8n-nodes-format-template/issues)

---

*Ce guide d'utilisation est maintenu à jour avec chaque version du node FormatTemplate.*
