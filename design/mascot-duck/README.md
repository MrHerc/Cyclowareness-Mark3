# AI Sel ördək maskotu (dizayn, 2026-10-20)

Portalın hazırkı Rive maskotunu əvəz etmək üçün təklif olunan ağ ördək. Hələ portala qoşulmayıb.

| Fayl | Nədir |
|---|---|
| `final.html` | Seçilmiş son versiya: «yumru pluş» (A) əsasında, B və C-dən götürülən hissələrlə. İnteraktivdir. Brauzerdə açın. |
| `variant-a.html` | A, «yumru pluş»: hakimlərin seçimi |
| `variant-b.html` | B, «modern stiker» |
| `variant-c.html` | C, «ifadəli aktyor» |
| `sheet-*.png` | Hər variantın əhval və jestlərinin bir şəkildə toplanmış görünüşü |
| `shots-final/` | Son versiyanın ekran görüntüləri |
| `duck-shoot.mjs` | Ekran görüntülərini çəkən Playwright skripti: `node duck-shoot.mjs <html> <qovluq>` |

JS API (`window.duck` və `createDuck(container, { size })`): `setMood`, `setTalking`, `play`, `lookAt`, `poke`, `setStill`, `setSize`. Əhvallar və jestlər portalın `src/components/mascot/mapping.ts` adlarına uyğundur, ona görə React komponentinə və ya Rive-a köçürmək mümkündür. Hissələrin siyahısı və oynaqlar `final.html`-in əvvəlindəki şərhdədir.

Variantlar silinməyib. Başqa variantı seçmək istəsəniz, onun üzərində yenidən cilalamaq olar.
