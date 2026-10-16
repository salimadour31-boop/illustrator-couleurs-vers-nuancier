//@target illustrator
/*
 * AimanterCouleursNuancier.jsx  —  v1.0.0
 * ----------------------------------------------------------------------------
 * FR : Remplace chaque couleur de la sélection (ou du document) par la nuance
 *      la plus proche d'un groupe de nuances choisi : charte graphique, jeu de
 *      tons directs Pantone, palette limitée de sérigraphie ou de broderie…
 *      La proximité est mesurée dans l'espace CIE Lab (ΔE 2000 ou ΔE 76),
 *      avec un seuil facultatif : au-delà, la couleur n'est pas touchée et
 *      l'objet peut être sélectionné pour vérification. Fonds, contours,
 *      textes (caractère par caractère) et, en option, arrêts de dégradé.
 *      Le bouton « Analyser » montre le résultat sans rien modifier.
 * EN : Snaps every colour of the selection (or document) to the closest
 *      swatch of a chosen swatch group: brand palette, Pantone spot set,
 *      limited screen-printing or embroidery palette… Closeness is measured
 *      in CIE Lab (ΔE 2000 or ΔE 76) with an optional threshold: beyond it
 *      the colour is left alone and the object can be selected for review.
 *      Fills, strokes, text (per character) and, optionally, gradient stops.
 *      The "Analyze" button previews the result without changing anything.
 *
 * Cible / Target : Illustrator CC (2018+) jusqu'aux versions récentes.
 * Statut / Status : NON TESTÉ DANS ILLUSTRATOR — syntaxe ES3 vérifiée (acorn).
 *                   NOT TESTED IN ILLUSTRATOR — ES3 syntax checked (acorn).
 * Annulation / Undo : Ctrl+Z / Cmd+Z. ExtendScript ne permet pas de forcer
 *      une seule étape d'annulation : il peut en falloir plusieurs.
 *      ExtendScript cannot force a single undo step: several may be needed.
 * Conseil : travaillez sur une copie de votre fichier.
 * Tip     : work on a copy of your file.
 * Aucune connexion réseau, aucune collecte de données, aucun fichier écrit.
 * No network access, no data collection, no file written.
 *
 * Formule CIEDE2000 d'après Sharma, Wu & Dalal (2005), domaine public
 * (formule publiée). Implémentation originale.
 * CIEDE2000 per Sharma, Wu & Dalal (2005), published formula; original code.
 *
 * Licence MIT — (c) 2026 Amirouche Amwanes. Code original.
 */

(function () {

    var VERSION = "1.0.0";
    var TITLE = "Aimanter couleurs / Snap colours " + VERSION;

    // ------------------------------------------------------------------
    // Langue / UI language (français si Illustrator est en français)
    // ------------------------------------------------------------------
    var FR = String(app.locale || "").toLowerCase().indexOf("fr") === 0;
    function L(fr, en) { return FR ? fr : en; }

    function fmt(n, d) {
        var s = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
        return FR ? s.replace(".", ",") : s;
    }
    function parseNum(s, def) {
        var v = parseFloat(String(s).replace(",", "."));
        return isNaN(v) ? def : v;
    }

    // ------------------------------------------------------------------
    // Vérifications de départ / Preconditions
    // ------------------------------------------------------------------
    if (app.documents.length === 0) {
        alert(L("Aucun document ouvert.\nOuvrez un document, sélectionnez les objets à traiter puis relancez le script.",
                "No document is open.\nOpen a document, select the objects to process and run the script again."),
              TITLE);
        return;
    }
    var doc = app.activeDocument;

    var useDocument = false;
    if (!doc.selection || doc.selection.length === 0 || doc.selection.typename === "TextRange") {
        if (!confirm(L("Rien n'est sélectionné (ou seul du texte est sélectionné à l'outil Texte).\n\nTraiter tout le document (calques visibles et déverrouillés) ?\n\nSinon, cliquez sur Non, sélectionnez des objets avec l'outil Sélection (V) et relancez le script.",
                       "Nothing is selected (or only text is selected with the Type tool).\n\nProcess the whole document (visible, unlocked layers)?\n\nOtherwise click No, select objects with the Selection tool (V) and run the script again."),
                     false, TITLE)) {
            return;
        }
        useDocument = true;
    }

    // ------------------------------------------------------------------
    // Conversion vers Lab / Conversion to Lab
    // ------------------------------------------------------------------
    var canConvert = true;   // app.convertSampleColor disponible ?

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    // sRGB (0-255) -> Lab (D65), formule standard / standard formula
    function rgbToLabMath(r, g, b) {
        function lin(c) { c = c / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
        var R = lin(r), G = lin(g), B = lin(b);
        var X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
        var Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
        var Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
        function f(t) { return t > 0.008856 ? Math.pow(t, 1 / 3) : (7.787 * t + 16 / 116); }
        var fx = f(X), fy = f(Y), fz = f(Z);
        return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    }

    // Repli naïf CMJN -> RVB / naive CMYK -> RGB fallback
    function cmykToRgbMath(c, m, y, k) {
        c /= 100; m /= 100; y /= 100; k /= 100;
        return [255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k)];
    }

    // Utilise la gestion des couleurs du document quand c'est possible.
    // Uses the document's colour management when available.
    function sampleToLab(space, comps) {
        if (canConvert) {
            try {
                var out = app.convertSampleColor(space, comps, ImageColorSpace.LAB, ColorConvertPurpose.defaultpurpose);
                if (out && out.length >= 3 && !isNaN(out[0])) {
                    return [Number(out[0]), Number(out[1]), Number(out[2])];
                }
            } catch (e) {
                canConvert = false;
            }
        }
        if (space === ImageColorSpace.CMYK) {
            var rgb = cmykToRgbMath(comps[0], comps[1], comps[2], comps[3]);
            return rgbToLabMath(rgb[0], rgb[1], rgb[2]);
        }
        if (space === ImageColorSpace.GrayScale) {
            var v = 255 * (1 - comps[0] / 100);
            return rgbToLabMath(v, v, v);
        }
        return rgbToLabMath(comps[0], comps[1], comps[2]);
    }

    // Lab d'une couleur Illustrator, avec teinte (0-100) pour les tons directs.
    // Lab of an Illustrator colour, with tint (0-100) for spot colours.
    // Retourne null si la couleur n'est pas gérée (dégradé, motif, aucune).
    function colorToLab(col, tint) {
        if (!col) { return null; }
        var t = (tint === undefined) ? 1 : clamp(tint / 100, 0, 1);
        switch (col.typename) {
            case "RGBColor":
                return sampleToLab(ImageColorSpace.RGB, [
                    255 - (255 - col.red) * t, 255 - (255 - col.green) * t, 255 - (255 - col.blue) * t]);
            case "CMYKColor":
                return sampleToLab(ImageColorSpace.CMYK, [col.cyan * t, col.magenta * t, col.yellow * t, col.black * t]);
            case "GrayColor":
                return sampleToLab(ImageColorSpace.GrayScale, [col.gray * t]);
            case "LabColor":
                return [100 - (100 - col.l) * t, col.a * t, col.b * t];
            case "SpotColor":
                try {
                    return colorToLab(col.spot.color, col.tint * t);
                } catch (e1) { return null; }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Écarts de couleur / Colour differences
    // ------------------------------------------------------------------
    function dE76(p, q) {
        var dl = p[0] - q[0], da = p[1] - q[1], db = p[2] - q[2];
        return Math.sqrt(dl * dl + da * da + db * db);
    }

    function dE2000(p, q) {
        var RAD = Math.PI / 180;
        var L1 = p[0], a1 = p[1], b1 = p[2];
        var L2 = q[0], a2 = q[1], b2 = q[2];
        var C1 = Math.sqrt(a1 * a1 + b1 * b1), C2 = Math.sqrt(a2 * a2 + b2 * b2);
        var Cm = (C1 + C2) / 2;
        var Cm7 = Math.pow(Cm, 7);
        var G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 6103515625))); // 25^7
        var a1p = (1 + G) * a1, a2p = (1 + G) * a2;
        var C1p = Math.sqrt(a1p * a1p + b1 * b1), C2p = Math.sqrt(a2p * a2p + b2 * b2);
        function hue(b, ap) {
            if (b === 0 && ap === 0) { return 0; }
            var h = Math.atan2(b, ap) / RAD;
            return h < 0 ? h + 360 : h;
        }
        var h1p = hue(b1, a1p), h2p = hue(b2, a2p);
        var dLp = L2 - L1, dCp = C2p - C1p;
        var dhp = 0;
        if (C1p * C2p !== 0) {
            dhp = h2p - h1p;
            if (dhp > 180) { dhp -= 360; } else if (dhp < -180) { dhp += 360; }
        }
        var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * RAD);
        var Lmp = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
        var hmp = h1p + h2p;
        if (C1p * C2p !== 0) {
            if (Math.abs(h1p - h2p) <= 180) { hmp = (h1p + h2p) / 2; }
            else if (h1p + h2p < 360) { hmp = (h1p + h2p + 360) / 2; }
            else { hmp = (h1p + h2p - 360) / 2; }
        }
        var T = 1 - 0.17 * Math.cos((hmp - 30) * RAD) + 0.24 * Math.cos(2 * hmp * RAD) +
                0.32 * Math.cos((3 * hmp + 6) * RAD) - 0.20 * Math.cos((4 * hmp - 63) * RAD);
        var dTheta = 30 * Math.exp(-Math.pow((hmp - 275) / 25, 2));
        var Cmp7 = Math.pow(Cmp, 7);
        var Rc = 2 * Math.sqrt(Cmp7 / (Cmp7 + 6103515625));
        var Lm50 = (Lmp - 50) * (Lmp - 50);
        var Sl = 1 + (0.015 * Lm50) / Math.sqrt(20 + Lm50);
        var Sc = 1 + 0.045 * Cmp;
        var Sh = 1 + 0.015 * Cmp * T;
        var Rt = -Math.sin(2 * dTheta * RAD) * Rc;
        var tl = dLp / Sl, tc = dCp / Sc, th = dHp / Sh;
        return Math.sqrt(tl * tl + tc * tc + th * th + Rt * tc * th);
    }

    // ------------------------------------------------------------------
    // Nuances candidates / Candidate swatches
    // ------------------------------------------------------------------
    function isUsableSwatchColor(c) {
        if (!c) { return false; }
        var t = c.typename;
        if (t === "SpotColor") {
            try { if (c.spot.colorType === ColorModel.REGISTRATION) { return false; } } catch (e) { return false; }
            return true;
        }
        return t === "RGBColor" || t === "CMYKColor" || t === "GrayColor" || t === "LabColor";
    }

    function swatchesOf(list) {
        var out = [], i, sw;
        for (i = 0; i < list.length; i++) {
            sw = list[i];
            try {
                if (sw.name === "[None]" || sw.name === "[Registration]" ||
                    sw.name === "[Sans]" || sw.name === "[Repérage]") { continue; }
                if (isUsableSwatchColor(sw.color)) { out.push(sw); }
            } catch (e) { /* nuance illisible / unreadable swatch */ }
        }
        return out;
    }

    // Choix proposés : tout le nuancier, puis chaque groupe non vide.
    // Choices: whole Swatches panel, then each non-empty group.
    var sources = [];
    var allSw = swatchesOf(doc.swatches);
    if (allSw.length === 0) {
        alert(L("Le nuancier du document ne contient aucune nuance de couleur utilisable.\nAjoutez vos couleurs cibles (charte, tons directs…) au panneau Nuancier, idéalement dans un groupe, puis relancez le script.",
                "The document's Swatches panel has no usable colour swatch.\nAdd your target colours (brand palette, spot colours…) to the Swatches panel, ideally in a group, then run the script again."),
              TITLE);
        return;
    }
    try {
        var g, gs;
        for (g = 0; g < doc.swatchGroups.length; g++) {
            gs = swatchesOf(doc.swatchGroups[g].getAllSwatches());
            if (gs.length > 0 && g > 0) {   // le groupe 0 est le groupe racine / group 0 is the root group
                sources.push({ name: L("Groupe : ", "Group: ") + doc.swatchGroups[g].name + " (" + gs.length + ")", list: gs });
            }
        }
    } catch (eg) { /* pas de groupes / no groups */ }
    sources.unshift({ name: L("Tout le nuancier du document", "Whole document Swatches panel") + " (" + allSw.length + ")", list: allSw });

    function buildCandidates(list) {
        var out = [], i, lab, spotName;
        for (i = 0; i < list.length; i++) {
            lab = colorToLab(list[i].color);
            if (!lab) { continue; }
            spotName = null;
            try { if (list[i].color.typename === "SpotColor") { spotName = list[i].color.spot.name; } } catch (e) {}
            out.push({ swatch: list[i], name: list[i].name, lab: lab, spotName: spotName });
        }
        return out;
    }

    // ------------------------------------------------------------------
    // Boîte de dialogue / Dialog
    // ------------------------------------------------------------------
    var dlg = new Window("dialog", TITLE);
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];

    var pPal = dlg.add("panel", undefined, L("Palette cible", "Target palette"));
    pPal.alignChildren = ["fill", "top"];
    var names = [], si;
    for (si = 0; si < sources.length; si++) { names.push(sources[si].name); }
    var ddPal = pPal.add("dropdownlist", undefined, names);
    ddPal.selection = sources.length > 1 ? 1 : 0;
    pPal.add("statictext", undefined, L("Astuce : rangez les couleurs autorisées dans un groupe de nuances.",
                                        "Tip: put the allowed colours in a swatch group."));

    var pScope = dlg.add("panel", undefined, L("Portée", "Scope"));
    pScope.orientation = "row";
    var rbSel = pScope.add("radiobutton", undefined, L("Sélection", "Selection"));
    var rbDoc = pScope.add("radiobutton", undefined, L("Document entier", "Whole document"));
    if (useDocument) { rbDoc.value = true; rbSel.enabled = false; } else { rbSel.value = true; }

    var pWhat = dlg.add("panel", undefined, L("Appliquer à", "Apply to"));
    pWhat.alignChildren = ["left", "top"];
    var cbFill = pWhat.add("checkbox", undefined, L("Fonds", "Fills"));
    var cbStroke = pWhat.add("checkbox", undefined, L("Contours", "Strokes"));
    var cbText = pWhat.add("checkbox", undefined, L("Textes (couleur de chaque caractère)", "Text (each character's colour)"));
    var cbGrad = pWhat.add("checkbox", undefined, L("Arrêts de dégradé (modifie le dégradé partout où il est utilisé)",
                                                    "Gradient stops (changes the gradient wherever it is used)"));
    cbFill.value = cbStroke.value = cbText.value = true;
    cbGrad.value = false;

    var pCalc = dlg.add("panel", undefined, L("Calcul", "Matching"));
    pCalc.alignChildren = ["left", "top"];
    var gM = pCalc.add("group");
    gM.add("statictext", undefined, L("Formule :", "Formula:"));
    var ddF = gM.add("dropdownlist", undefined, ["ΔE 2000 (" + L("recommandé", "recommended") + ")", "ΔE 76"]);
    ddF.selection = 0;
    var gT = pCalc.add("group");
    gT.add("statictext", undefined, L("Écart maximal ΔE (0 = sans limite) :", "Maximum ΔE (0 = no limit):"));
    var etMax = gT.add("edittext", undefined, "0");
    etMax.characters = 6;
    var cbWhite = pCalc.add("checkbox", undefined, L("Conserver le blanc (papier)", "Keep white (paper)"));
    cbWhite.value = true;
    var cbKeepSpot = pCalc.add("checkbox", undefined, L("Conserver les tons directs déjà dans la palette (et leurs teintes)",
                                                       "Keep spot colours already in the palette (and their tints)"));
    cbKeepSpot.value = true;
    var cbSelOut = pCalc.add("checkbox", undefined, L("Sélectionner à la fin les objets non convertis (hors seuil)",
                                                     "Select objects left unconverted (over threshold) at the end"));
    cbSelOut.value = true;

    var stInfo = dlg.add("statictext", undefined,
        L("Cliquez sur Analyser pour voir le résultat sans rien modifier.",
          "Click Analyze to preview the result without changing anything."), { multiline: true });
    stInfo.preferredSize = [460, 64];

    var gB = dlg.add("group");
    gB.alignment = ["right", "top"];
    var btAnalyze = gB.add("button", undefined, L("Analyser", "Analyze"));
    var btCancel = gB.add("button", undefined, L("Annuler", "Cancel"), { name: "cancel" });
    var btOk = gB.add("button", undefined, L("Appliquer", "Apply"), { name: "ok" });

    // ------------------------------------------------------------------
    // Moteur / Engine
    // ------------------------------------------------------------------
    function readOptions() {
        var mx = parseNum(etMax.text, 0);
        if (mx < 0) { mx = 0; }
        return {
            cands: buildCandidates(sources[ddPal.selection.index].list),
            whole: rbDoc.value,
            fill: cbFill.value, stroke: cbStroke.value, text: cbText.value, grad: cbGrad.value,
            de: ddF.selection.index === 0 ? dE2000 : dE76,
            max: mx, keepWhite: cbWhite.value, keepSpot: cbKeepSpot.value, selOut: cbSelOut.value
        };
    }

    // Clé unique d'une couleur / unique colour key (cache)
    function colorKey(c) {
        switch (c.typename) {
            case "RGBColor": return "R" + Math.round(c.red) + "," + Math.round(c.green) + "," + Math.round(c.blue);
            case "CMYKColor": return "C" + fmt(c.cyan, 2) + "," + fmt(c.magenta, 2) + "," + fmt(c.yellow, 2) + "," + fmt(c.black, 2);
            case "GrayColor": return "G" + fmt(c.gray, 2);
            case "LabColor": return "L" + fmt(c.l, 2) + "," + fmt(c.a, 2) + "," + fmt(c.b, 2);
            case "SpotColor": return "S" + c.spot.name + "@" + fmt(c.tint, 2);
        }
        return null;
    }

    function describe(c) {
        switch (c.typename) {
            case "RGBColor": return "RVB " + Math.round(c.red) + "/" + Math.round(c.green) + "/" + Math.round(c.blue);
            case "CMYKColor": return L("CMJN ", "CMYK ") + Math.round(c.cyan) + "/" + Math.round(c.magenta) + "/" + Math.round(c.yellow) + "/" + Math.round(c.black);
            case "GrayColor": return L("Gris ", "Gray ") + Math.round(c.gray) + " %";
            case "LabColor": return "Lab " + Math.round(c.l) + "/" + Math.round(c.a) + "/" + Math.round(c.b);
            case "SpotColor": return c.spot.name + (c.tint < 100 ? " " + Math.round(c.tint) + " %" : "");
        }
        return c.typename;
    }

    function isWhiteLab(lab) { return lab[0] > 99.5 && Math.abs(lab[1]) < 0.6 && Math.abs(lab[2]) < 0.6; }

    // Décide quoi faire d'une couleur (avec cache). Retourne :
    // { action: "map"|"keep"|"far"|"skip", target: swatch, de: number }
    // Decides what to do with a colour (cached).
    function decide(c, opt, state) {
        if (!c) { return { action: "skip" }; }
        var t = c.typename;
        if (t !== "RGBColor" && t !== "CMYKColor" && t !== "GrayColor" && t !== "LabColor" && t !== "SpotColor") {
            return { action: "skip" };
        }
        var key;
        try { key = colorKey(c); } catch (ek) { return { action: "skip" }; }
        if (state.cache.hasOwnProperty(key)) { return state.cache[key]; }

        var res, i;
        if (t === "SpotColor") {
            var isReg = false;
            try { isReg = c.spot.colorType === ColorModel.REGISTRATION; } catch (er) {}
            if (isReg) { res = { action: "keep", why: "reg" }; }
            if (!res && opt.keepSpot) {
                for (i = 0; i < opt.cands.length; i++) {
                    if (opt.cands[i].spotName !== null && opt.cands[i].spotName === c.spot.name) {
                        res = { action: "keep", why: "palette" };
                        break;
                    }
                }
            }
        }
        if (!res) {
            var lab = colorToLab(c);
            if (!lab) {
                res = { action: "skip" };
            } else if (opt.keepWhite && isWhiteLab(lab)) {
                res = { action: "keep", why: "white" };
            } else {
                var best = null, bestD = 1e9, d;
                for (i = 0; i < opt.cands.length; i++) {
                    d = opt.de(lab, opt.cands[i].lab);
                    if (d < bestD) { bestD = d; best = opt.cands[i]; }
                }
                if (!best) {
                    res = { action: "skip" };
                } else if (opt.max > 0 && bestD > opt.max) {
                    res = { action: "far", target: best, de: bestD };
                } else {
                    res = { action: "map", target: best, de: bestD };
                }
            }
        }
        res.label = describe(c);
        state.cache[key] = res;
        state.distinct++;
        if (res.action === "map") { state.mapColors++; state.sumDE += res.de; if (res.de > state.maxDE) { state.maxDE = res.de; } }
        if (res.action === "far") { state.farColors++; }
        if (res.action === "keep") { state.keepColors++; }
        return res;
    }

    // Traite une couleur ; retourne la nouvelle couleur ou null.
    // Handles one colour; returns the replacement colour or null.
    function handle(c, opt, state, item) {
        var r = decide(c, opt, state);
        if (r.action === "map") {
            state.uses++;
            return r.target.swatch.color;
        }
        if (r.action === "far" && item) { state.markFar(item); }
        return null;
    }

    function handleGradient(gc, opt, state, item) {
        var grad = gc.gradient, i, st, nc;
        if (state.gradDone.hasOwnProperty(grad.name)) { return; }
        state.gradDone[grad.name] = true;
        for (i = 0; i < grad.gradientStops.length; i++) {
            st = grad.gradientStops[i];
            nc = handle(st.color, opt, state, item);
            if (nc && state.apply) { st.color = nc; }
        }
    }

    function handlePath(p, opt, state, applyTo) {
        var nc, i;
        if (opt.fill && p.filled) {
            if (p.fillColor.typename === "GradientColor") {
                if (opt.grad) { handleGradient(p.fillColor, opt, state, p); }
            } else {
                nc = handle(p.fillColor, opt, state, applyTo);
                if (nc && state.apply) {
                    if (applyTo.typename === "CompoundPathItem") {
                        for (i = 0; i < applyTo.pathItems.length; i++) { applyTo.pathItems[i].fillColor = nc; }
                    } else { p.fillColor = nc; }
                }
            }
        }
        if (opt.stroke && p.stroked) {
            if (p.strokeColor.typename === "GradientColor") {
                if (opt.grad) { handleGradient(p.strokeColor, opt, state, p); }
            } else {
                nc = handle(p.strokeColor, opt, state, applyTo);
                if (nc && state.apply) {
                    if (applyTo.typename === "CompoundPathItem") {
                        for (i = 0; i < applyTo.pathItems.length; i++) { applyTo.pathItems[i].strokeColor = nc; }
                    } else { p.strokeColor = nc; }
                }
            }
        }
    }

    function handleText(tf, opt, state) {
        var chars = tf.textRange.characters, i, ca, nc, n = chars.length;
        for (i = 0; i < n; i++) {
            ca = chars[i].characterAttributes;
            if (opt.fill) {
                try {
                    if (ca.fillColor.typename === "GradientColor") {
                        if (opt.grad) { handleGradient(ca.fillColor, opt, state, tf); }
                    } else {
                        nc = handle(ca.fillColor, opt, state, tf);
                        if (nc && state.apply) { ca.fillColor = nc; }
                    }
                } catch (e1) {}
            }
            if (opt.stroke) {
                try {
                    if (ca.strokeColor.typename !== "GradientColor" && ca.strokeColor.typename !== "NoColor") {
                        nc = handle(ca.strokeColor, opt, state, tf);
                        if (nc && state.apply) { ca.strokeColor = nc; }
                    }
                } catch (e2) {}
            }
        }
    }

    function walk(item, opt, state) {
        try { if (item.locked || item.hidden) { state.skippedItems++; return; } } catch (e0) {}
        var i;
        switch (item.typename) {
            case "GroupItem":
                for (i = 0; i < item.pageItems.length; i++) { walk(item.pageItems[i], opt, state); }
                break;
            case "PathItem":
                state.items++;
                handlePath(item, opt, state, item);
                break;
            case "CompoundPathItem":
                state.items++;
                if (item.pathItems.length > 0) { handlePath(item.pathItems[0], opt, state, item); }
                break;
            case "TextFrame":
                state.items++;
                if (opt.text) { handleText(item, opt, state); }
                break;
            default:
                // Images, symboles, maillages, objets de plug-in : non traités.
                // Images, symbols, meshes, plug-in items: not processed.
                state.skippedItems++;
        }
    }

    function walkLayer(layer, opt, state) {
        if (layer.locked || !layer.visible) { return; }
        var i;
        for (i = 0; i < layer.pageItems.length; i++) { walk(layer.pageItems[i], opt, state); }
        for (i = 0; i < layer.layers.length; i++) { walkLayer(layer.layers[i], opt, state); }
    }

    function run(opt, apply) {
        var state = {
            apply: apply, cache: {}, gradDone: {}, distinct: 0, mapColors: 0, farColors: 0, keepColors: 0,
            uses: 0, sumDE: 0, maxDE: 0, items: 0, skippedItems: 0, far: [], farSeen: []
        };
        state.markFar = function (it) {
            var k;
            for (k = 0; k < state.farSeen.length; k++) { if (state.farSeen[k] === it) { return; } }
            state.farSeen.push(it);
            state.far.push(it);
        };
        var i;
        if (opt.whole) {
            for (i = 0; i < doc.layers.length; i++) { walkLayer(doc.layers[i], opt, state); }
        } else {
            var sel = [];
            for (i = 0; i < doc.selection.length; i++) { sel.push(doc.selection[i]); }
            for (i = 0; i < sel.length; i++) { walk(sel[i], opt, state); }
        }
        return state;
    }

    function summary(state, applied) {
        var lines = [];
        lines.push(L("Objets examinés : ", "Objects examined: ") + state.items +
                   L(" — couleurs distinctes : ", " — distinct colours: ") + state.distinct);
        lines.push((applied ? L("Couleurs remplacées : ", "Colours replaced: ") : L("Couleurs à remplacer : ", "Colours to replace: ")) +
                   state.mapColors + (state.mapColors > 0 ? L(" (ΔE moyen ", " (mean ΔE ") + fmt(state.sumDE / state.mapColors, 1) +
                   ", max " + fmt(state.maxDE, 1) + ")" : "") +
                   L(" — conservées : ", " — kept: ") + state.keepColors +
                   L(" — hors seuil : ", " — over threshold: ") + state.farColors);
        if (state.skippedItems > 0) {
            lines.push(L("Ignorés (verrouillés, masqués, images, symboles…) : ", "Skipped (locked, hidden, images, symbols…): ") + state.skippedItems);
        }
        return lines.join("\n");
    }

    function detail(state, maxLines) {
        var out = [], k, r, n = 0;
        for (k in state.cache) {
            if (!state.cache.hasOwnProperty(k)) { continue; }
            r = state.cache[k];
            if (r.action !== "map" && r.action !== "far") { continue; }
            if (n >= maxLines) { out.push("…"); break; }
            out.push((r.action === "far" ? "✗ " : "• ") + r.label + "  →  " + r.target.name + "  (ΔE " + fmt(r.de, 1) + ")");
            n++;
        }
        return out.join("\n");
    }

    btAnalyze.onClick = function () {
        if (!cbFill.value && !cbStroke.value && !cbText.value) {
            stInfo.text = L("Cochez au moins Fonds, Contours ou Textes.", "Tick at least Fills, Strokes or Text.");
            return;
        }
        var st = run(readOptions(), false);
        stInfo.text = summary(st, false);
    };

    btOk.onClick = function () {
        if (!cbFill.value && !cbStroke.value && !cbText.value) {
            stInfo.text = L("Cochez au moins Fonds, Contours ou Textes.", "Tick at least Fills, Strokes or Text.");
            return;
        }
        dlg.close(1);
    };

    if (dlg.show() !== 1) { return; }

    // ------------------------------------------------------------------
    // Application / Apply
    // ------------------------------------------------------------------
    var opt = readOptions();
    var res;
    try {
        res = run(opt, true);
    } catch (err) {
        alert(L("Erreur pendant le traitement : ", "Error while processing: ") + err +
              L("\nAnnulez avec Ctrl+Z / Cmd+Z si besoin.", "\nUndo with Ctrl+Z / Cmd+Z if needed."), TITLE);
        return;
    }
    app.redraw();

    var msg = summary(res, true);
    var det = detail(res, 14);
    if (det) { msg += "\n\n" + det; }
    if (opt.selOut && res.far.length > 0) {
        try {
            doc.selection = null;
            doc.selection = res.far;
            msg += "\n\n" + L("Les objets hors seuil sont sélectionnés (", "Objects over threshold are selected (") + res.far.length + ").";
        } catch (es) {}
    }
    if (!canConvert) {
        msg += "\n\n" + L("Note : conversion approximative (sans gestion des couleurs).", "Note: approximate conversion (no colour management).");
    }
    msg += "\n\n" + L("Annuler : Ctrl+Z / Cmd+Z.", "Undo: Ctrl+Z / Cmd+Z.");
    alert(msg, TITLE);

})();
