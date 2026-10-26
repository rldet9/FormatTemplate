# `postalAddress` — adresse postale française, vérifiée et mise aux normes

Vérifie une adresse postale française dans la Base Adresse Nationale (BAN), par le service
de géocodage gratuit de l'État, et la réécrit selon la norme postale NF Z10-011.
typeVersion 6 uniquement.

Une adresse n'est réécrite que si la base la **confirme**. Le score de pertinence du service
ne suffit jamais : sa réponse est confrontée à la saisie — type et nom de voie, numéro, code
postal et commune ([ADR-0013](../adr/0013-address-verdict-confronts-the-answer.md), en
anglais). Toute autre réponse laisse la valeur intacte et dit pourquoi.

> English version: [docs/transforms/postal-address.md](../transforms/postal-address.md).
> Les noms de paramètres, les valeurs et les codes `FT_*` sont ceux de l'interface, en
> anglais.

## Ce qui sort de votre instance

- **Seule la partie géographique de l'adresse** — numéro, voie, code postal, commune —
  part, comme requête de recherche, vers le service de géocodage de la Géoplateforme (IGN,
  `https://data.geopf.fr/geocodage`). Le destinataire (ligne 1), les compléments
  (lignes 2 et 3) et les autres champs de l'item ne sont jamais envoyés.
- Le service est public, gratuit et sans compte. Il répond depuis la BAN, publiée sous
  *Licence Ouverte* (Etalab 2.0).
- Une adresse rattachée à une personne est une donnée personnelle : si votre workflow
  traite des adresses de clients, cet appel a sa place dans votre registre des traitements.
- Le node ne garde rien d'une exécution à l'autre
  ([ADR-0015](../adr/0015-network-behind-one-adapter.md)). Les diagnostics ne citent jamais
  l'adresse ([ADR-0006](../adr/0006-no-personal-data-in-diagnostics.md)).

## Paramètres

| Paramètre | Défaut | Effet |
|---|---|---|
| `outputFormat` | `postalLines` | ce qui est réécrit : `postalLines`, `label` ou `structured` — voir [Sortie](#sortie) |
| `outputPath` | vide | où écrire le résultat ; vide, il remplace le champ lu ; un chemin laisse ce champ intact |
| `minimumPrecision` | `housenumber` | quand la saisie donne un numéro, la base doit le connaître ; `street` accepte un numéro que la base ne connaît pas encore |
| `acceptCorrections` | `true` | réécrit une adresse que la base a corrigée (code postal, commune, orthographe de la voie), avec un avertissement qui nomme les champs corrigés ; désactivé, une telle adresse est refusée |
| `onServiceError` | `throw` | le service a échoué malgré les reprises : `throw` ou `tag`, comme pour `onFieldError` — voir [Quand le service échoue](#quand-le-service-échoue) |
| `includeCountryLine` | `false` | ajoute `FRANCE` en dernière ligne, pour un pli posté à l'étranger |
| `stripAccents` | `true` | retire les accents des lignes 4 à 7, comme les référentiels postaux |

Sous **Advanced** :

| Paramètre | Défaut | Effet |
|---|---|---|
| `minScore` | `0.5` | score de pertinence minimal — un garde-fou, jamais le juge |
| `ambiguityMargin` | `0.05` | écart de score sous lequel deux lieux différents rendent la saisie ambiguë |
| `streetSimilarity` | `0.8` | similarité sous laquelle deux noms de voie désignent deux voies différentes |
| `baseUrl` | `https://data.geopf.fr/geocodage` | un autre service de même interface ; HTTPS obligatoire |
| `timeoutMs` | `10000` | délai accordé à chaque requête, de 1 000 à 60 000 ms |
| `maxRetries` | `3` | reprises après un délai dépassé, une erreur serveur ou un `429`, de 0 à 5 |
| `requestsPerSecond` | `40` | plafond de requêtes lancées par seconde, de 1 à 50 |

Les trois seuils ont été calibrés sur un corpus enregistré de 55 adresses ; leurs plages
sûres sont dans l'[ADR-0013](../adr/0013-address-verdict-confronts-the-answer.md). Matrice
complète : [PARAMETERS.md](../PARAMETERS.md).

## Entrée

Le champ peut contenir :

- **un texte**, sur une ou plusieurs lignes : `8 bd du port amiens`,
  `Appartement 12\nBâtiment B\n10 rue de la Paix\n75002 Paris` ;
- **un tableau de lignes** ;
- **un objet** aux clés usuelles, en anglais ou en français : `street` / `address` / `rue`,
  `housenumber` / `number` / `numero`, `postcode` / `zip` / `cp`, `city` / `town` /
  `ville` / `commune`, `country` / `pays`, `lines` / `lignes`, ou des lignes numérotées
  `line1`…`line6`, `ligne1`…`ligne6`.

Avant tout envoi, la saisie est **restructurée** : le destinataire et les compléments sont
mis de côté — réécrits tels quels, jamais envoyés — et ce que la base ne peut pas vérifier
est refusé :

| Saisie | Résultat |
|---|---|
| un CEDEX, une boîte postale (`BP`), un code `CS` ou `TSA`, une *poste restante* | `FT_ADDRESS_SPECIAL_DISTRIBUTION`, valeur intacte |
| un pays hors des territoires de la BAN | `FT_ADDRESS_COUNTRY_UNSUPPORTED`, valeur intacte |
| un code postal seul, ou rien qui ressemble à une adresse | `FT_ADDRESS_INPUT_UNREADABLE` |
| une valeur vide | `FT_VALUE_EMPTY`, inchangée |

La BAN couvre la France métropolitaine, la Guadeloupe, la Martinique, la Guyane, La Réunion,
Mayotte, Saint-Pierre-et-Miquelon, Saint-Barthélemy et Saint-Martin.

## Verdicts

La première réponse du service est la candidate. Elle est confrontée à la saisie et reçoit
l'un de six verdicts, dans cet ordre de priorité :

| Verdict | Quand | Réécrite | Diagnostic |
|---|---|---|---|
| `not_found` | aucune réponse, ou un score sous `minScore` | non | `FT_ADDRESS_NOT_FOUND` |
| `mismatch` | un autre type de voie (une avenue n'est pas une place), un autre nom de voie, un autre numéro ou indice de répétition, ou ni le code postal ni la commune ne concordent | non | `FT_ADDRESS_MISMATCH` — le message nomme ce qui diverge |
| `ambiguous` | une autre réponse, presque aussi pertinente, désigne un autre lieu et correspond aussi bien à la saisie — typiquement une voie sans commune | non | `FT_ADDRESS_AMBIGUOUS` |
| `imprecise` | la saisie donne un numéro que la base ne connaît pas, et `minimumPrecision` vaut `housenumber` | non | `FT_ADDRESS_IMPRECISE` |
| `corrected` | l'adresse est confirmée, mais la base a corrigé son code postal, sa commune ou l'orthographe de sa voie | oui, sauf si `acceptCorrections` est désactivé | `FT_ADDRESS_CORRECTED` (avertissement) — le message nomme les champs |
| `verified` | la base confirme l'adresse telle que saisie | oui | — |

Une adresse refusée suit `onFieldError` comme toute autre transformation : marquée par
défaut, envoyée sur la sortie d'erreur sous `throw`, silencieuse sous `keep`.

Ce qui vaut concordance :

- **nom de voie** — les mêmes mots, aux fautes de frappe près (une par mot de quatre lettres
  ou plus) et aux abréviations près (`bd` ≡ `boulevard`, `st` ≡ `saint`) ; chaque mot saisi
  doit se retrouver dans la réponse ;
- **numéro** — le même numéro et le même indice de répétition (`3 bis` ≡ `3B`) ;
- **localité** — au moins l'un du code postal et de la commune concorde ; l'autre est alors
  une correction. Un code postal donné seul ne peut être corrigé qu'à l'intérieur de son
  département.

## Sortie

`outputFormat: postalLines` (défaut) écrit un **tableau de lignes** selon la NF Z10-011 :

| Ligne | Contenu | Source |
|---|---|---|
| 1 | destinataire | la saisie, telle quelle |
| 2 | à l'intérieur du bâtiment : appartement, étage, escalier | la saisie, telle quelle |
| 3 | à l'extérieur du bâtiment : entrée, bâtiment, résidence | la saisie, telle quelle |
| 4 | numéro, indice de répétition, voie | la base nationale |
| 5 | ancienne commune, quand elle diffère de la ligne 6 | la base nationale |
| 6 | code postal et commune | la base nationale |
| 7 | `FRANCE`, avec `includeCountryLine` | — |

- Une ligne inutilisée est supprimée.
- Les lignes 4 à 7 sont en majuscules, sans ponctuation (apostrophes, traits d'union,
  points, virgules deviennent des espaces), et sans accents sauf si `stripAccents` est
  désactivé.
- Une ligne compte **38 caractères** au plus. Si la ligne 4 dépasse, le type de voie est
  abrégé selon la liste officielle de la norme (`AVENUE` → `AV`, `BOULEVARD` → `BD`…), et
  elle seule. Une ligne encore trop longue est gardée entière et signalée par
  `FT_ADDRESS_LINE_TOO_LONG` : elle n'est **jamais tronquée**
  ([ADR-0014](../adr/0014-postal-lines-to-the-standard.md)).

`outputFormat: label` écrit l'adresse comme la base l'écrit, sur une ligne :
`8 Boulevard du Port 80000 Amiens`.

`outputFormat: structured` écrit un objet, pratique avec un `outputPath` — ici pour
`12 rue de la Pais 75002 Paris` :

```json
{
  "verdict": "corrected",
  "corrections": ["street"],
  "precision": "housenumber",
  "score": 0.84,
  "label": "12 Rue de la Paix 75002 Paris",
  "postalLines": ["12 RUE DE LA PAIX", "75002 PARIS"],
  "housenumber": "12",
  "street": "Rue de la Paix",
  "postcode": "75002",
  "city": "Paris",
  "district": "Paris 2e Arrondissement",
  "citycode": "75102",
  "banId": "eb3fbab2-8154-4f2c-af66-ee299e9dfcea",
  "id": "75102_6998_00012",
  "latitude": 48.869141,
  "longitude": 2.331303
}
```

`citycode` est le code INSEE de la commune ; `banId` et `id` identifient l'adresse dans la
BAN. Un champ que la base ne donne pas est absent.

## Exemples

Avec les réglages par défaut (`postalLines`, `onFieldError: tag`) :

| Saisie | Sortie | Diagnostic |
|---|---|---|
| `8 bd du port amiens` | `["8 BOULEVARD DU PORT", "80000 AMIENS"]` | — |
| `12 rue de la Pais 75002 Paris` | `["12 RUE DE LA PAIX", "75002 PARIS"]` | `FT_ADDRESS_CORRECTED` (avertissement) |
| `Appartement 12`↵`Bâtiment B`↵`10 rue de la Paix`↵`75002 Paris` | `["Appartement 12", "Bâtiment B", "10 RUE DE LA PAIX", "75002 PARIS"]` | — |
| `3 bis avenue du Général de Gaulle 59000 Lille` | inchangée | `FT_ADDRESS_MISMATCH` — la base connaît une place, pas une avenue |
| `1 rue de la Gare` | inchangée | `FT_ADDRESS_AMBIGUOUS` — beaucoup de communes en ont une |
| `BP 18 33506 Libourne Cedex` | inchangée | `FT_ADDRESS_SPECIAL_DISTRIBUTION` |
| `''` | inchangée | `FT_VALUE_EMPTY` |

## Requêtes, cache et cadence

- Une requête par adresse distincte et par exécution : une adresse répétée est servie par un
  cache qui vit le temps de l'exécution (1 000 adresses au plus).
- Les items sont traités huit à la fois ; la sortie garde leur ordre.
- Les requêtes lancées restent sous `requestsPerSecond`. Le service public en accepte 50 par
  seconde et par adresse IP ; le défaut laisse une marge aux autres workflows de l'instance.
- Un délai dépassé, une connexion refusée, une erreur serveur ou un `429` est repris jusqu'à
  `maxRetries` fois, avec un délai croissant (0,5 s, 1 s, 2 s… jusqu'à 8 s), ou le délai
  que le service demande dans `Retry-After`, jusqu'à 30 s.

La requête passe par l'utilitaire HTTP de n8n, celui de ses nodes intégrés.

## Quand le service échoue

Après ses reprises, un échec du service est **technique** : il ne dit rien de l'adresse, et
n'est jamais traité par `onFieldError`
([ADR-0015](../adr/0015-network-behind-one-adapter.md)).

| `onServiceError` | Effet |
|---|---|
| `throw` (défaut) | l'item échoue : avec *On Error : Stop Workflow*, le node échoue, pour que *Retry On Fail* puisse le rejouer ; avec *Continue*, l'item sort comme item d'erreur |
| `tag` | la valeur est gardée, l'item est marqué de l'échec, le workflow continue |

Un item d'erreur vaut `{ error, details }` (`details.code`, `details._format`). Sous *Continue
(using error output)*, n8n y refusionne l'item d'entrée, sur la sortie d'erreur : il garde ses
champs d'entrée. Sous *Continue*, il sort sur la sortie normale avec ces deux champs seulement :
les champs d'entrée, l'adresse comprise, n'y sont pas, et `pairedItem` est son seul lien avec
l'item d'entrée ([PARAMETERS](../PARAMETERS.md#error-contract-not-a-parameter), en anglais).

Dans tous les cas, **une adresse que le service n'a pas pu vérifier ne part jamais sur la
sortie de succès comme si elle l'avait été**. C'est pourquoi, sous *Continue*, le node rattache
l'échec à l'item au lieu de lever une erreur : n8n y laisserait passer les items d'entrée du node,
intacts.

| Code | Cause |
|---|---|
| `FT_ADDRESS_SERVICE_UNAVAILABLE` | pas de réponse à temps, connexion refusée, erreur serveur, réponse illisible |
| `FT_ADDRESS_RATE_LIMITED` | toujours prié de ralentir après les reprises, ou prié d'attendre plus de 30 s |
| `FT_ADDRESS_SERVICE_REJECTED` | la requête a été refusée (`4xx` autre que `429`) — pas de reprise |

Un `baseUrl` qui n'est pas une URL HTTPS absolue fait échouer le node
(`FT_ADDRESS_ENDPOINT_INVALID`), comme un `outputPath` invalide — avant le premier item
quand la valeur est écrite en dur.

## Limites

- **La ligne 6 est la commune de la BAN.** Le libellé d'acheminement de La Poste peut en
  différer dans de rares cas — certaines communes nouvelles, des lieux-dits distribués sous
  un autre nom. Un fournisseur optionnel pour le libellé d'acheminement est prévu.
- **Les adresses d'entreprise à CEDEX sont refusées** : leur code postal n'est pas
  géographique, la BAN ne peut pas le vérifier.
- **Un numéro que la base ne connaît pas encore donne `imprecise`**, pas une erreur.
  Réglez `minimumPrecision: street` pour accepter la voie.
- **La base évolue.** Un verdict reflète la BAN au moment de l'exécution.

## Diagnostics

`FT_VALUE_EMPTY` et les codes `FT_ADDRESS_*` — voir le
[catalogue](../DIAGNOSTICS.md#postal-address) (en anglais).
