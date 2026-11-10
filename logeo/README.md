# Logéo

Logements à louer dans le canton de Genève : annonces relevées automatiquement, suivi des candidatures, dossier et lettre.

## Organisation

| Élément | Rôle |
|---|---|
| `logeo/` | Le site (HTML, CSS, JavaScript sans dépendance). Installable sur téléphone comme une application. |
| `logeo/data/listings.json` | Jeu d'annonces de secours, utilisé si le fichier à jour est injoignable. |
| `tools/logeo/` | La collecte : `collect.mjs` appelle un lecteur par source (`flatfox.mjs`, `immobilier.mjs`). |
| `.github/workflows/logeo-collecte.yml` | Lance la collecte toutes les 30 minutes et publie `listings.json` sur la branche `logeo-data`. |

## Mise à jour des annonces

1. GitHub Actions exécute la collecte (minutes 7 et 37 de chaque heure).
2. Le résultat est poussé sur la branche `logeo-data` (un seul commit, remplacé à chaque passage).
3. Le site recharge ce fichier toutes les 5 minutes et affiche l'heure de la dernière collecte.

La collecte ne tourne que depuis la branche par défaut du dépôt. Elle peut aussi être lancée à la main : onglet Actions, « Logéo – collecte des annonces », Run workflow.

## Sources

- **flatfox.ch** : interface publique, lecture complète du canton à chaque passage.
- **immobilier.ch** : pages de résultats publiques. Le site limite la lecture automatisée ; la collecte lit 4 pages par passage et s'arrête dès qu'il refuse. Elle ne contourne pas cette protection.

Ajouter une source : écrire un lecteur dans `tools/logeo/` qui renvoie des annonces au même format, puis l'appeler dans `collect.mjs`.

## Essai en local

```
node tools/logeo/collect.mjs --out logeo/data/listings.json
npx serve logeo
```

Si le dépôt change de nom ou de propriétaire, adapter l'adresse `DISTANT` en tête de `logeo/app.js`.
