# AI Sel pişik maskotu (dizayn, 2026-10-21)

Sahibinin öz pişiyinə (`reference.jpg`) bənzər ağ-boz tabby pişik; ördək maskotunun yerinə təklif olunur. Boynunda indigo xalta və qalxan formalı təhlükəsizlik nişanı var. 2026-10-21-dən sınaq üçün portalın bütün maskot yerlərinə qoşulub (`portal/src/components/mascot/cat-mascot.tsx`, mühərrik `cat/engine.js` bu mənbənin əl ilə köçürülmüş nüsxəsidir); Rive robotu `mascot.tsx`-də bir sətirlə qaytarılır (OPEN-QUESTIONS 21, ADR-022). Mənbədə edilən dəyişiklik `cat/engine.js`-də də təkrarlanmalıdır.

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

## Quyruq (2026-10-21, 7-ci tur)

Quyruq yenidən yazılıb (`p2.js` `solve`, `p3.js` pozalar, `p4.js` `tailLive`; portalda eyni). Əvvəlki problem: dalğanın fazası `T * tailSpd` idi və pozalar qarışanda `tailSpd` dəyişdiyi üçün faza sıçrayırdı (yatanda, oyananda, gəzəndə quyruq saniyədə bir neçə dəfə çırpınırdı, səhifə nə qədər çox açıq qalsa, bir o qədər pis); dalğa hər seqmentə əlavə olunduğu üçün quyruq qurd kimi qıvrılırdı; oturanda yerə sıxılan hissə də yırğalanıb sürüşürdü. İndi: bir yavaş yellənmə fazası kökdən ucadək ~1,7 rad gecikmə ilə gedir (S-əyri, ardınca gəlmə), oturanda kök tərpənmir (`tailRoot`), yerdə uzanan hissə sabitdir, ucu yuxarı qalxır; arabir rahat uc çırpması (`tailFlick`); faza toplanır (heç vaxt sıçramır); quyruğun forması qısa gecikmə ilə pozaya çatır, ona görə əhval, jest və davranış dəyişəndə quyruq tullanmır, yumşaq keçir. Yoxlama: `scratchpad/e2e/cat-film.mjs` (10 kadr/s lentlər, quyruq xəttinin "soğan qabığı" şəkli və metriklər).

## Kursoru tutmaq (mascot rejimi)

Bütün pişiklər üçün bir ümumi `pointermove`/`pointerdown` dinləyicisi var. Kursor qutunun 1,5 misli sahəsinə girəndə pişik baxışı və bəbəkləri ilə izləyir, qulaqları irəli, bir az çömbəlir, quyruğunun ucu titrəyir; pəncə məsafəsinə girəndə yaxın pəncə ilə vurur (əvvəlcə pəncəni qaldırır, sonra sürətlə vurur); kursor sürətlə keçəndə cəld silkələyir; yaxında dayanan kursora əvvəl zillənir (arxası yırğalanır), sonra pəncəsini üstünə basır. Klik və toxunuş sığallamaqdır (mırıldama), bundan sonra 2,2 s vurmur. Jest saxlananda, oynananda və danışanda tutma yoxdur; `data-motion=calm` yalnız sakit vuruşlar edir; still / azaldılmış hərəkətdə yalnız gözlər yaxındakı kursoru izləyir. Pozalar (`catchZone`, `reachTarget`, `huntPose`, `swatPose`) `p3.js`-dədir; idarəetmə (ümumi dinləyici, `huntLogic`) yalnız portal mühərrikindədir (`portal/src/components/mascot/cat/engine.js`), çünki bu səhifənin `p4.js` icra hissəsi ondan köhnədir.

## Tullanma (sürüşdürmə ilə gələn pişik üçün)

`cat.jump({ dir, hang, onTakeoff, onLand, onDone })` (həmçinin `cat.do('jump', ...)`): çömbəlmə 280 ms → itələnmə 120 ms → havada `hang` ms (default 450, 150–2000; büzülür, sonra ön pəncələr eniş yerinə uzanır: `dir: 'down'` aşağı, `'up'` yuxarı-irəli) → eniş sıxılması 160 ms → yenidən oturma 600 ms. Pişik öz qutusunda qalır (azca qalxır); qutunu qövs üzrə aparan sahibdir. Qaytarır: `{ takeoff, land, end, done }` — çağırışdan ms (`takeoff = 400`, `land = 400 + hang`, `end = land + 760`) və `onDone` ilə həll olunan Promise. Geri çağırışlar həmin anı keçən kadrda gəlir, kadr yoxdursa (ekrandan kənar, gizli tab) 120 ms sonra taymerlə. Still / azaldılmış hərəkətdə və yuxuda heç nə oynamır, bütün geri çağırışlar dərhal işləyir, qaytarılan vaxtlar 0-dır (sahib qutunu qövssüz köçürsün). React-də nüsxəni `<Mascot onCat={(cat) => ...} />` verir.

```ts
const j = cat.jump({ dir: "down", hang: 500, onTakeoff: () => startArc(500), onLand: () => endArc() });
await j.done; // oturub
```

Bu səhifədə: `renderAt('jump', t, { dir })` və `cat.do('jump')`.

