# illustrator-couleurs-vers-nuancier

**AimanterCouleursNuancier.jsx** — remplace chaque couleur par la nuance la plus proche d'un groupe de nuances (charte, Pantone, palette limitée) pour Adobe Illustrator (ExtendScript, FR/EN).
*Snap every colour to the closest swatch of a chosen swatch group (brand palette, Pantone set, limited palette) in Adobe Illustrator.*

> **Statut : non testé dans Illustrator.** La syntaxe ES3 a été vérifiée automatiquement (acorn), la formule ΔE 2000 a été contrôlée sur les paires de référence de Sharma et al., et la logique a été relue. Le script n'a pas encore été exécuté dans Illustrator. Travaillez sur une **copie** de votre fichier.
> *Status: not tested in Illustrator. ES3 syntax checked (acorn), ΔE 2000 checked against Sharma et al. reference pairs, logic reviewed. Work on a copy of your file.*

## Pourquoi / Why

Un logo vectorisé, une illustration importée ou un fichier client arrive avec des dizaines de couleurs « presque » justes : 3 rouges légèrement différents, des gris RVB, des CMJN arrondis. Il faut tout ramener à la charte, à 4 tons directs pour la sérigraphie ou aux fils disponibles en broderie. *Redéfinir les couleurs de l'illustration* (Recolor Artwork) le permet, mais l'attribution reste souvent à corriger à la main, couleur par couleur, et ne traite pas facilement les textes caractère par caractère.

Ce script fait l'attribution automatiquement, de façon mesurable :

- **Palette cible** : tout le nuancier du document ou un **groupe de nuances** précis (le plus pratique : un groupe « Charte » ou « Sérigraphie 4 tons »). Tons directs, nuances globales, CMJN, RVB, Lab et gris acceptés ; [Repérage] et [Sans] exclus.
- **Mesure de proximité** dans l'espace CIE Lab avec **ΔE 2000** (recommandé, proche de la perception) ou **ΔE 76**. La conversion vers Lab passe par la gestion des couleurs d'Illustrator (`app.convertSampleColor`) ; si elle n'est pas disponible, une conversion approximative est utilisée et signalée.
- **Seuil facultatif** : au-delà d'un ΔE maximal, la couleur n'est pas touchée et les objets concernés sont **sélectionnés à la fin** pour vérification.
- **Fonds, contours, textes** (chaque caractère) et, en option, **arrêts de dégradé** (attention : un dégradé modifié change partout où il est utilisé).
- Le **blanc papier** et les **tons directs déjà présents dans la palette** (avec leurs teintes) sont conservés par défaut ; le repérage n'est jamais modifié.
- Bouton **Analyser** : nombre de couleurs distinctes, combien seraient remplacées, ΔE moyen et maximal, sans rien modifier.
- Bilan final avec la correspondance de chaque couleur (par ex. `CMJN 0/95/88/2 → Rouge charte (ΔE 1,8)`).

Les objets verrouillés ou masqués, les images, symboles, maillages et objets de plug-in sont ignorés (et comptés dans le bilan).

## Installation

- **Ponctuelle** : dans Illustrator, *Fichier > Scripts > Autre script…* (Ctrl+F12 / Cmd+F12), puis choisir `AimanterCouleursNuancier.jsx`.
- **Permanente** : copier `AimanterCouleursNuancier.jsx` dans le dossier `Presets/<langue>/Scripts` d'Illustrator, puis redémarrer Illustrator :
  - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts`
  - macOS : `/Applications/Adobe Illustrator <version>/Presets.localized/fr_FR/Scripts`

  Le script apparaît alors dans *Fichier > Scripts*.

Le fichier est en UTF-8. Si les accents ou le symbole Δ s'affichent mal (surtout sous Windows), réenregistrez-le en « UTF-8 avec BOM » dans votre éditeur de texte.

## Utilisation / Usage

1. Ouvrez votre document (un message s'affiche si aucun document n'est ouvert) et faites-en une copie.
2. Mettez les couleurs autorisées dans le panneau **Nuancier**, de préférence dans un **groupe de nuances** (bibliothèque Pantone, charte, etc.).
3. Sélectionnez les objets à traiter avec l'outil Sélection (V). Si rien n'est sélectionné, le script le signale et propose de traiter tout le document (calques visibles et déverrouillés).
4. Lancez le script, choisissez la palette, ce qu'il faut traiter, la formule et un éventuel seuil (par ex. 10 pour ne remplacer que les couleurs vraiment proches).
5. Cliquez sur **Analyser** pour voir le résultat, puis sur **Appliquer**.
6. Pour revenir en arrière : Ctrl+Z / Cmd+Z, éventuellement plusieurs fois (ExtendScript ne permet pas de forcer une seule étape d'annulation dans Illustrator).

Repères pour le seuil : ΔE 2000 < 1 est imperceptible, 1–2 visible de près, 2–5 visible, > 10 couleur nettement différente.

L'interface est en français si Illustrator est en français, sinon en anglais.

## Version ciblée / Target

Illustrator CC 2018 et versions plus récentes (ExtendScript ES3, ScriptUI). Pas d'UXP nécessaire.

## Limites connues / Known limits

- Non testé dans Illustrator : signalez tout problème dans les *Issues*.
- Les couleurs à l'intérieur des symboles, maillages, motifs, images et effets (Aspect) ne sont pas traitées.
- Les teintes de tons directs hors palette sont converties d'après leur couleur affichée, puis remplacées par la nuance à 100 %.
- Sur un très long texte, le traitement caractère par caractère peut être lent.
- Pas encore d'option « garder la teinte la plus proche » (remplacer par une teinte d'un ton direct plutôt que par le ton à 100 %).

## Projets similaires / Similar projects

Code 100 % original. La formule CIEDE2000 suit la publication de Sharma, Wu & Dalal (2005). Illustrator propose *Redéfinir les couleurs de l'illustration* (manuel, intégré) ; des extensions payantes offrent un remplacement de couleurs avancé. Ce script est gratuit, bilingue FR/EN, mesure l'écart en ΔE et indique ce qu'il n'a pas pu convertir.

## Confidentialité / Privacy

Aucun appel réseau, aucune collecte de données, aucun fichier écrit.

## Licence

MIT — © 2026 Amirouche Amwanes. Voir `LICENSE`.
