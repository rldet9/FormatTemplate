# Module FormatTemplate – Documentation technique

## Rôle du module

Le module `FormatTemplate` permet de transformer, formater ou nettoyer dynamiquement des champs de données dans les workflows n8n. Il s’appuie sur des handlers spécialisés pour appliquer des règles de transformation (ex : formatage de téléphone, pays, casse de texte, etc.).

## Structure du dossier

- `FormatTemplate.node.ts` : Point d’entrée du node n8n (logique principale)
- `TransformHandlerRegistry.ts` : Registre des handlers de transformation disponibles
- `handlers/` : Un fichier par handler (ex : `PhoneHandler.ts`, `CountryHandler.ts`, `TextCaseHandler.ts`)
- `interfaces/TransformHandler.ts` : Interface commune à tous les handlers
- `FormatTemplate.node.json` : Définition du node pour n8n

## Ajout d’un handler personnalisé

1. Créer un fichier dans `handlers/` en implémentant l’interface `TransformHandler`
2. Enregistrer le handler dans `TransformHandlerRegistry.ts`
3. Documenter le handler dans ce fichier

## Exemples de handlers fournis
- `PhoneHandler` : Formatage et validation de numéros de téléphone
- `CountryHandler` : Normalisation des noms de pays
- `TextCaseHandler` : Transformation de la casse (majuscules, minuscules, capitalisation)

## Bonnes pratiques
- Garder chaque handler simple et spécialisé
- Documenter les cas d’usage dans le code et dans ce fichier
- Ajouter des tests unitaires pour chaque handler

## Pour aller plus loin
- Voir la documentation de contribution dans `DEVELOPMENT.md`
- Consulter les exemples d’utilisation dans les workflows de test
