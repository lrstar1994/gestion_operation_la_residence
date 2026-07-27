# Gestion energetique / Chauffe-eau

## Principe

Le module controle les chauffe-eau par equipement, chaque chauffe-eau pouvant alimenter plusieurs chambres.

- Etat attendu `ON` si au moins une chambre liee est occupee ou en arrivee le jour controle.
- Etat attendu `OFF` si toutes les chambres liees sont vides.
- Aucun point n'est attribue aux controles chauffe-eau.
- Le module releve du domaine `maintenance`.

## Tables

- `chauffe_eau` : referentiel des equipements.
- `chauffe_eau_lieu` : liaison chauffe-eau / chambres.
- `chauffe_eau_releve` : releves journaliers avec temperatures et etat constate.
- `chauffe_eau_anomalie` : anomalies generees en cas de non-conformite.
- `history_events` : trace generique des releves/anomalies.

## Anomalies

- `CRITIQUE_OFF_OCCUPE` : chauffe-eau OFF alors qu'il doit etre ON.
- `ENERGETIQUE_ON_VIDE` : chauffe-eau ON alors qu'il doit etre OFF.
- `CONTROLE_MANQUANT` : absence de releve du jour, calcule dans l'interface et le dashboard.

## Scenarios de test

1. Chambre 301 occupee, 311 vide : `Bat1_301_311` doit etre `ON`.
2. Chambres 301 et 311 vides : `Bat1_301_311` doit etre `OFF`.
3. Chambre 302 en arrivee aujourd'hui : `Bat1_302` doit etre `ON`.
4. Toutes les chambres BAT 6 vides : `Bat6_global` doit etre `OFF`.
5. Une chambre BAT 6 occupee : `Bat6_global` doit etre `ON`.
6. Etat constate `OFF` alors que l'etat attendu est `ON` : anomalie critique.
7. Etat constate `ON` alors que l'etat attendu est `OFF` : anomalie energetique.
8. Absence de releve du jour : controle manquant dans la page et le dashboard.

## Seed inclus

Le fichier `chauffe_eau.sql` cree les chauffe-eau suivants :

- `Bat1_101_104`
- `Bat1_301_311`
- `Bat1_302`
- `Bat1_401_411`
- `Bat1_402`
- `Bat1_421`
- `Bat1_423`
- `Bat1_406_416`
- `Bat6_global`

`Bat1_421` et `Bat1_423` sont crees sans chambres pour etre completes depuis l'interface admin.
