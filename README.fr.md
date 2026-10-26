# Format Template — node communautaire n8n

[![npm](https://img.shields.io/npm/v/@mixtrio/n8n-nodes-format-template)](https://www.npmjs.com/package/@mixtrio/n8n-nodes-format-template)
[![CI](https://github.com/rldet9/FormatTemplate/actions/workflows/ci.yml/badge.svg)](https://github.com/rldet9/FormatTemplate/actions/workflows/ci.yml)
[![Licence : MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

Normalise en place les champs des items n8n — numéros de téléphone, casse de texte, codes pays
ISO, et **adresses postales françaises vérifiées dans la Base Adresse Nationale** puis écrites
selon la norme postale.

> English version: [README.md](README.md). L'interface du node, ses messages et ses codes
> `FT_*` sont en anglais.

| Transformation | Entrée | Sortie |
|---|---|---|
| **Téléphone** | `+33 3 20 00 00 00`, `+44 20 7946 0958` | `03 20 00 00 00`, `020 7946 0958` (national), `+44 20 7946 0958` (international), `+442079460958` (E.164), ou votre propre masque — tous les pays |
| **Casse** | `jean-pierre DUPONT` | `Jean-Pierre Dupont` (titre, majuscules, minuscules, capitale initiale) |
| **Pays** | `Royaume-Uni`, `UK`, `fr` | `GB`, `GB`, `FR` (ISO 3166-1 alpha-2, hors ligne) |
| **Adresse postale (France)** | `8 bd du port amiens` | `["8 BOULEVARD DU PORT", "80000 AMIENS"]` (NF Z10-011) |

## Pourquoi ce node

- **Une décision par item.** Une valeur intransformable n'est jamais approchée : elle reste
  telle quelle et l'item est marqué — ou envoyé sur la sortie d'erreur, ou le node échoue,
  selon votre choix.
- **Chaque item dit ce qui a été fait.** Une trace `_format` liste chaque champ avec son statut
  et un code de diagnostic stable (`FT_*`) — jamais la donnée elle-même.
- **Les adresses sont vérifiées, pas devinées.** Le service de géocodage classe les candidats ;
  le node confronte ensuite le meilleur à la saisie — type et nom de voie, numéro, code postal,
  commune — et ne réécrit l'adresse que si la base nationale la confirme.
- **Les numéros de téléphone de tous les pays.** Les plans de numérotation de 245 territoires
  sont embarqués, générés depuis les métadonnées libphonenumber de Google : longueurs, préfixes
  nationaux et groupement propre à chaque pays.
- **Aucune dépendance à l'exécution.** Téléphone, casse et pays fonctionnent entièrement hors
  ligne. Seule l'adresse postale appelle un service : le service de géocodage gratuit de l'État.

## Installation

Dans n8n : **Settings → Community Nodes → Install**, puis saisir
`@mixtrio/n8n-nodes-format-template`. Voir le guide de n8n sur
[l'installation des nodes communautaires](https://docs.n8n.io/integrations/community-nodes/installation/).

Vous venez de `@rderet/n8n-nodes-format-template` (0.1.x, déprécié) ? n8n nomme un node d'après son paquet : les
deux s'installent côte à côte. Pour déplacer un workflow, remplacez `@rderet/n8n-nodes-format-template.formatTemplate`
par `@mixtrio/n8n-nodes-format-template.formatTemplate` dans son JSON. Ses nodes gardent la typeVersion 5 ; le seul
changement qu'ils voient est la résolution hors ligne des noms de pays.

Développé et testé avec n8n 2.x.

## Démarrage rapide

Ajoutez **Format Template** après le node qui produit vos données, puis une ligne par champ
sous **Fields to Format** : le **Field Path** (`customer.phone` — le *nom* de la propriété,
jamais sa valeur) et le **Type**.

Avec quatre lignes — `customer.name` en casse titre, `customer.phone` en téléphone,
`customer.country` en pays, `customer.address` en adresse postale :

```json
// entrée
{ "customer": { "name": "jean-pierre DUPONT", "phone": "+33 3 20 00 00 00",
                "country": "Royaume-Uni", "address": "8 bd du port amiens" } }

// sortie
{ "customer": { "name": "Jean-Pierre Dupont", "phone": "03 20 00 00 00",
                "country": "GB", "address": ["8 BOULEVARD DU PORT", "80000 AMIENS"] },
  "_format": { "status": "ok", "fields": [
    { "path": "customer.name", "type": "textCase", "status": "ok" },
    { "path": "customer.phone", "type": "phone", "status": "ok" },
    { "path": "customer.country", "type": "country", "status": "ok" },
    { "path": "customer.address", "type": "postalAddress", "status": "ok" } ] } }
```

Une adresse que la base ne peut pas confirmer reste intacte, et la trace dit pourquoi :

```json
{ "customer": { "address": "1 rue de la Gare" },
  "_format": { "status": "partial", "fields": [
    { "path": "customer.address", "type": "postalAddress", "status": "failed",
      "code": "FT_ADDRESS_AMBIGUOUS",
      "message": "Several different addresses match the input within 0.05 of each other: add the postcode, the municipality or the house number." } ] } }
```

Des workflows prêts à importer sont dans [examples/](examples/).

## En cas d'échec

| Politique | S'applique à | Choix |
|---|---|---|
| **On Field Error** | une valeur que la transformation refuse | marquer l'item (défaut), faire échouer l'item, garder en silence |
| **On Missing Field** | un chemin absent de l'item | marquer (défaut), ignorer, faire échouer l'item |
| **On Service Error** | le service d'adresse n'a pas répondu, malgré les reprises | faire échouer l'item (défaut — le node s'arrête, ou l'item part sur la sortie d'erreur quand n8n est réglé pour continuer), marquer l'item |

Une erreur de configuration — un chemin invalide, un masque cassé — fait échouer le node, avant
le premier item quand le réglage est écrit en dur. Avec *Continue On Fail* / la sortie d'erreur
de n8n, un item en échec sort sous la forme `{ error, details: { code, _format } }` — une adresse
que le service n'a pas pu vérifier ne part jamais sur la sortie de succès. Tous les
codes sont au [catalogue des diagnostics](nodes/FormatTemplate/docs/DIAGNOSTICS.md) (en anglais).

## Adresses postales : ce qui sort de votre instance

Seule la partie géographique de l'adresse — numéro, voie, code postal, commune — part vers le
service de géocodage de la Géoplateforme (IGN, `data.geopf.fr`), qui répond depuis la Base
Adresse Nationale (Licence Ouverte 2.0). Le destinataire, les compléments et les autres champs
de l'item ne sont jamais envoyés. Le node ne garde rien d'une exécution à l'autre. Une adresse
rattachée à une personne est une donnée personnelle : cet appel a sa place dans votre registre
des traitements. Détails : [guide de l'adresse postale](nodes/FormatTemplate/docs/fr/postal-address.md).

## Documentation

La documentation de référence est en anglais ; le guide de l'adresse postale existe aussi en
français.

| Document | Contenu |
|---|---|
| [Téléphone](nodes/FormatTemplate/docs/transforms/phone.md) · [Casse](nodes/FormatTemplate/docs/transforms/text-case.md) · [Pays](nodes/FormatTemplate/docs/transforms/country.md) · [Adresse postale](nodes/FormatTemplate/docs/fr/postal-address.md) | un guide par transformation |
| [Paramètres](nodes/FormatTemplate/docs/PARAMETERS.md) | chaque paramètre, son défaut, et le test qui prouve son effet |
| [Diagnostics](nodes/FormatTemplate/docs/DIAGNOSTICS.md) | chaque code `FT_*` : classe, sévérité, sens, conduite à tenir |
| [Migrer depuis la typeVersion 5](nodes/FormatTemplate/docs/MIGRATION-V5-V6.md) | ce qui change pour les workflows existants |
| [Architecture](nodes/FormatTemplate/docs/ARCHITECTURE.md) · [Décisions](nodes/FormatTemplate/docs/adr/README.md) | comment le node est construit, et pourquoi |

## Mise à jour depuis 0.1.x

Les workflows enregistrés gardent la **typeVersion 5** et son comportement historique, figé par
des tests de caractérisation : n8n ne migre jamais un node au chargement. Un seul changement les
atteint : les noms de pays se résolvent de nouveau. La 0.1.x les cherchait sur une API externe
qui ne répondait plus pour les noms complets ; la 1.0.0 emploie une table ISO 3166-1 embarquée,
hors ligne. Les nouveaux nodes sont en **typeVersion 6** — décision par item, trace `_format`,
adresse postale. Voir le [guide de migration](nodes/FormatTemplate/docs/MIGRATION-V5-V6.md).

## Développement

```bash
npm ci
npm test        # tests unitaires, moteur, architecture et documentation
npm run lint    # n8n-node lint, mode strict
npm run build
```

Les contributions sont bienvenues — voir [CONTRIBUTING.md](CONTRIBUTING.md). L'architecture,
et la façon d'ajouter une transformation, sont décrites dans
[ARCHITECTURE.md](nodes/FormatTemplate/docs/ARCHITECTURE.md).

## Licence et crédits

[MIT](LICENSE.md) © Mixtrio. Maintenu par Raphael Deret.

- Icône du node : `wand-sparkles` de [Lucide](https://lucide.dev) (licence ISC).
- Plans de numérotation téléphonique : dérivés des métadonnées de
  [libphonenumber](https://github.com/google/libphonenumber), Copyright (C) 2009 The
  Libphonenumber Authors, [licence Apache 2.0](LICENSES/Apache-2.0.txt) — voir [NOTICE](NOTICE).
- Données d'adresse : Base Adresse Nationale, par le service de géocodage de la Géoplateforme
  (Licence Ouverte 2.0).
- Norme postale : NF Z10-011, telle que publiée par La Poste.
