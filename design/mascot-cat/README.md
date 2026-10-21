# AI Sel pişik maskotu (dizayn, 2026-10-21)

Sahibinin öz pişiyinə (`reference.jpg`) bənzər ağ-boz tabby pişik; ördək maskotunun yerinə təklif olunur. Boynunda indigo xalta və qalxan formalı təhlükəsizlik nişanı var. Hələ portala qoşulmayıb (OPEN-QUESTIONS 21).

| Fayl | Nədir |
|---|---|
| `final.html` | Son versiya: A «cozy nağıl» istiqaməti əsasında, B və C-dən götürülən hissələrlə. Canvas 2D skelet, tək fayl. Brauzerdə açın. |
| `variant-a.html` | A, «cozy nağıl»: üç hakimin hamısının seçimi |
| `variant-b.html` | B, «real hərəkət» |
| `variant-c.html` | C, «premium maskot» |
| `source/` | `final.html`-in 4 hissəsi; dəyişiklikdən sonra `sh source/build.sh` ilə yenidən yığılır |
| `sheet-*.png`, `sizes-*.png`, `page-*.png` | Davranış, əhval, kiçik ölçü və səhifə görüntüləri |
| `cat-shoot.mjs` | Kadr-kadr ekran görüntüsü skripti: `node cat-shoot.mjs <html> <qovluq>` |

Davranışlar: oturmaq, gəzmək, dönmək, qaçmaq, sütuna sürtünmək, pəncəni yalamaq, balışda yatmaq və oyanmaq, gərnəşmək, əsnəmək, kursoru ovlamaq, sığallayanda mırıldamaq, yoğurmaq, ətrafa baxmaq, quyruq çırpmaq, təqdimat pozası. Avtomatik rejimdə pişik bunları özü seçir; kursor tez hərəkət edəndə ova keçir.

JS API (`window.cat`, `createCat(container, { mode: 'roam' | 'mascot', size })`): `behaviours`, `moods`, `do(name, opts)`, `setAuto`, `setMood`, `setTalking`, `play`, `lookAt`, `poke`, `setStill`, `isStill`, `setSize`, `renderAt(name, t, opts)`, `resume`. Əhvallar portalın `src/components/mascot/mapping.ts` adlarına uyğundur. AI Sel adı dəyişmir. Ördək variantları `design/mascot-duck/` qovluğundadır.
