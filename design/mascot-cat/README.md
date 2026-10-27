# AI Sel pişik maskotu (dizayn, 2026-10-21)

Sahibinin öz pişiyinə (`reference.jpg`) bənzər ağ-boz tabby pişik; ördək maskotunun yerinə təklif olunur. Boynunda indigo xalta və qalxan formalı təhlükəsizlik nişanı var. 2026-10-21-dən portalın bütün maskot yerlərinə qoşulub (`portal/src/components/mascot/cat-mascot.tsx`); Rive robotu `mascot.tsx`-də bir sətirlə qaytarılır (OPEN-QUESTIONS 21, ADR-022).

**2026-10-27-dən yeganə mənbə `portal/src/components/mascot/cat/engine.js`-dir.** `final.html`, `variant-*.html`, `source/`, `cat-shoot.mjs` və `sheet-*.png`, `sizes-*.png`, `page-*.png` 2026-10-21 dizaynının tarixi nüsxəsidir: yenilənmir, dəyişiklikləri ora köçürməyin. Pişiyin indiki görünüşü `engine-sheets.mjs` ilə çəkilir (aşağıda).

| Fayl | Nədir |
|---|---|
| `engine-sheets.mjs`, `engine-sheets.html` | Portal mühərrikinin kontakt vərəqələri (`renderAt`): hər davranış, əhvallar, jestlər, yaxın plan, skelet parametrləri, açıq və tünd fonda ölçülər. `node engine-sheets.mjs <qovluq> [engine.js] [ad-süzgəci]`; Playwright lazımdır (portalda yoxdur) |
| `final.html` | Tarixi (2026-10-21): A «cozy nağıl» istiqaməti əsasında, B və C-dən götürülən hissələrlə. Canvas 2D skelet, tək fayl |
| `variant-a.html` | A, «cozy nağıl»: üç hakimin hamısının seçimi |
| `variant-b.html` | B, «real hərəkət» |
| `variant-c.html` | C, «premium maskot» |
| `source/` | Tarixi: `final.html`-in 4 hissəsi (`sh source/build.sh`); mühərrikdən geri qalır |
| `sheet-*.png`, `sizes-*.png`, `page-*.png` | Tarixi: 2026-10-21 dizaynının davranış, əhval, kiçik ölçü və səhifə görüntüləri |
| `cat-shoot.mjs` | Tarixi: `final.html` üçün kadr skripti: `node cat-shoot.mjs <html> <qovluq>` |

Davranışlar: oturmaq, gəzmək, dönmək, qaçmaq, sütuna sürtünmək, pəncəni yalamaq, balışda yatmaq və oyanmaq, gərnəşmək, əsnəmək, kursoru ovlamaq, sığallayanda mırıldamaq, yoğurmaq, ətrafa baxmaq, quyruq çırpmaq, təqdimat pozası. Avtomatik rejimdə pişik bunları özü seçir; kursor tez hərəkət edəndə ova keçir.

JS API (`window.cat`, `createCat(container, { mode: 'roam' | 'mascot', size })`): `behaviours`, `moods`, `do(name, opts)`, `setAuto`, `setMood`, `setTalking`, `play`, `lookAt`, `poke`, `setStill`, `isStill`, `setSize`, `renderAt(name, t, opts)`, `resume`. Əhvallar portalın `src/components/mascot/mapping.ts` adlarına uyğundur. AI Sel adı dəyişmir. Ördək variantları `design/mascot-duck/` qovluğundadır.

## Nağıl görünüşü və oynaqlar (2026-10-27)

Yalnız çəkmə kodu və skelet; yeni davranış yoxdur, `<Mascot>` və mühərrik API-si dəyişməyib.

- Rəng: `reference.jpg`-dəki qəhvəyi çalarlı boz və krem ağ. Kontur vahid tünd-göy əvəzinə tünd xəz rəngindədir, işıqlı tərəfdə incə, kölgə tərəfində qalın (`ink`), kiçik ölçüdə bir az qalın (`LINE`).
- İşıq: yuxarı-soldan isti əsas işıq, kənarlarda arxa işıq zolağı (`edgeFill`), çənə altında, qoltuqda, budda və quyruq kökündə yumşaq kölgə, yerdə təmas kölgəsi. Qradiyentlər hər kətan üçün bir dəfə qurulur (`makeKit`), xəz teksturası bir dəfə offscreen kətanda bişirilir (`furTile`) və bədənə kəsilib çəkilir; `shadowBlur` artmayıb.
- Xəz kənarı: sinə yalı, yanaq tükləri, quyruq dilimləri və ucdakı tük (`tuft`); boyun yalı xaltanın ətrafında (`drawRuff`).
- Ön ayaq üç sümüklüdür: bazu, said və bilək-daraq, pəncədə 4 barmaq dilimi; caynaqlar yalnız vuruşda çıxır (`claws`). Kürək sümüyü ayağın bucağı ilə qalxıb enir. Arxa ayaqda iki dairəli bud, baldır, diz və topuq ucu var.
- Onurğa iki seqmentlidir (`chestBend`, `pelvisBend`); `bodyRoll` (0 dik, 0,5 qarın tamaşaçıya, 1 arxası üstə) və `rollTwist` arxası üstə yuvarlanmaq üçündür (`roll` davranışı, aşağıda).
- Çənə oynağı (`jawDrop`: əsnəyəndə və miyovlayanda alt çənə düşür), qulağın dönməsi və qatlanması (xarici tərəfi görünür), baş bədənə nisbətən 0,9 (`HS`).
- Kətanda mətn yoxdur: mırıltı not işarəsi, yuxu isə yuxarı qalxan kiçik aypara işarələridir (interfeys 10 dildədir, ərəb dili də daxil); `tests/mascot-cat.test.ts` bunu yoxlayır.

## Davranışlar və oyunlar (2026-10-27)

Hamısı `engine.js`-dədir; `<Mascot>` və mühərrik API-si yalnız genişlənib, köhnə çağırışlar dəyişmədən işləyir. Vərəqələr: `engine-sheets.mjs` hər hərəkət üçün `a-<ad>.png` çəkir.

| Ad (`do(ad)`, `act`) | Nə edir |
|---|---|
| `sleep` | Oturur → "çörək" pozası → C şəklində qıvrılır; yavaş, görünən nəfəs, arabir yuxuda pəncə titrəməsi və qulaq çırpması, yuxarı qalxan kiçik aypara işarələri (hərf deyil). 80 px-dən kiçikdə oturaraq mürgüləyir |
| `doze` | Sfinks "çörək" pozasında mürgü: gözlər yumulu, çənə yavaş-yavaş düşür və diksinib qalxır, aypara işarələri |
| `blink` | Yavaş "pişik öpüşü": iki yavaş göz qırpma, yumşaq təbəssüm |
| `tilt` | Maraqla başını yana əyir, qulaqlar irəli |
| `stretch` | Ayağa qalxır → ön gərnəşmə (sinə aşağı, arxa yuxarı, əsnəmə) → arxa ayaq gərnəşməsi → yerinə qayıdıb oturur |
| `yawn`, `groom`, `flick`, `look`, `pet` | Əvvəlki kimi: çənə oynağı ilə əsnəmə, pəncəni yalayıb üzünü silmə, qulaq və quyruq çırpması |
| `knead` | Kiçik yumşaq yorğanın üstünə əyilir, ön pəncələr növbə ilə qalxıb basır (barmaqlar açılır, caynaqlar çıxır, çiyin hər basışda enir), gözlər yarıyumulu, mırıldayır. 80 px-dən kiçik baş kəsiyində əvvəlki kimi |
| `roll` | Böyrü üstə uzanır, arxası üstə çevrilir (qarın yuxarı, pəncələr havada bükülü), qıvrılır, havaya pəncə atır, geri çevrilib oturur |
| `chase-tail` | Yandan oturur, quyruğu pəncələrinin önündədir: ucunun titrədiyini görür, zillənir, pəncə ilə vurur (uc qaçıb çırpınır), azca qalxıb iki pəncə ilə basır, saxlayır, buraxır və heç nə olmamış kimi başqa yerə baxır. Skelet başın arxasını çəkmədiyi üçün pişik fırlanmır |
| `pounce` | Çömbəlir, arxası yırğalanır və donur, yığılıb sıçrayır (`leapPose`: sürətli qalxış, havada büzülmə, ön pəncələr yerə uzanır, enişdə sıxılma, quyruq yellənir), pəncələri ilə basır, pəncəsinin altına baxır, başını silkələyir, yerinə qayıdıb pəncəsini yalayır |
| `mouse`, `play('mouse')` | Boz oyuncaq siçan: siçan qaçıb dayanır, pişik alçaqdan sürünərək yaxınlaşır, arxası yırğalanır, üstünə sıçrayır, pəncə ilə vurur (siçan atılıb çevrilir), ardınca sıçrayır, siçanı ağzına alıb qürurla yerinə aparır, pəncələrinin önünə qoyur (hədiyyə), sonra bir toxunuşla qutudan çıxarır |
| `yarn`, `play('yarn')` | Qırmızı yun yumağı: pişik sürünərək yaxınlaşır, pəncəsini üstündən aşırıb yumağı özünə çəkir, altından vurub havaya atır, diyirlənən yumağın üstünə sıçrayır, iki pəncə ilə növbə ilə vurur; son zərbədən yumaq sapı ilə birlikdə qutudan diyirlənib çıxır. Pişik oturub pəncəsini yalayır, quyruğunu çırpır, yavaş-yavaş yerinə qayıdır. Sap həmişə yumağa bağlıdır |
| `laser`, `laser(nöqtə)` | Lazer nöqtəsi (aşağıda) |
| `run`, `run({...})` | Çaparaq qaçış (aşağıda) |

**Çərçivə.** Yer tələb edən hərəkətlər (yuxu, mürgü, stretch, roll, chase-tail, pounce, oyuncaqlar, lazer, qaçış) qutuya sığdırılır (`Cat.fitAct`): hər hərəkət üçün bir miqyas (≤ 1, yerdəki nöqtə ətrafında) və bir yana sürüşmə, hərəkətin öz kadrlarından hesablanır. Eni hündürlüyünün 1,3 mislindən böyük qutu səhnədir: pişik yandan görünür və qutuda yer dəyişir; kvadrat qutuda yığcam 3/4 variant oynayır. 80 px-dən kiçik baş kəsiyində bədən hərəkətlərinin əvəzinə baxış və ya sığal göstərilir.

**Hərəkət seçimi.** Still (`still` prop, `data-motion=still`, OS reduced motion): stretch, run, mouse, yarn, laser, chase-tail, roll, pounce başlamır (`do()` false qaytarır), lazerə yalnız gözlər baxır. Calm: avtomatik rejim yalnız oturma, göz qırpma, yalama, yoğurma və yuxu seçir; yeni canlı hərəkətlərdən yalnız lazer qalır (izləyir və çömbəlir, yırğalanmır, sıçramır).

**Avtomatik rejim.** `setAuto(true)` yalnız dekorativ yerlər üçündür (Home, landing, giriş paneli, təhlükəsizlik icmalı); izah edən yerlər (pleyer, tur, tutor) onu çağırmır. Hər hərəkətdən sonra pişik bir müddət oturur, sonra `mascotAutoWeights` çəkiləri ilə növbətini seçir; 90 s heç kim yaxınlaşmasa yuxu və mürgü də əlavə olunur; oyuncaqlar yalnız səhnə qutusunda oynanır. Danışarkən və jest saxlanarkən avtomatik hərəkət başlamır.

**Sığal.** Klik və toxunuş əvvəlki kimi sığaldır. Siçan və ya qələmlə bədənin üstündən yavaş sığal (900 px/s-dən yavaş, bədən eninin yarısı qədər) da mırıltı yaradır; yatan və ya mürgüləyən pişik yerində mırıldayır. Kursor bədənin üstündədirsə pişik onu vurmur.

### Qaçış (`run`)

`cat.run({ dir: 'left' | 'right', distancePx, onStart, onStop, onDone })` → `{ start, stop, end, done, offset(ms) }` (ms çağırışdan). Pişik qutusunda yerində çapır (`GAITS.gallop`: məsafəyə bağlı addımlar, onurğa yığılıb açılır, iki havada uçuş anı); qutunu aparan sahibdir: çağırışdan `ms` sonra qutunu `offset(ms)` px sürüşdürün (sola mənfi). `start`-a qədər 0, `stop`-dan sonra bütün məsafədir; sürətlənmə və yavaşlama pişiyin addımları ilə eynidir. Still, reduced motion, calm, yuxu və ya məsafə yoxdursa qaçış olmur: bütün anlar 0, geri çağırışlar dərhal işləyir, `offset` bütün məsafədir (qutunu qaçışsız köçürün). Güzgülü (`facing: 'left'`) pişik də ekranda göstərilən tərəfə qaçır. Məsafəsiz `do('run')` yerində qısa çapışdır.

```ts
const r = cat.run({ dir: "right", distancePx: 480 });
const t0 = performance.now();
const tick = (now: number) => {
  box.style.transform = `translateX(${r.offset(now - t0)}px)`;
  if (now - t0 < r.end) requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
await r.done;
```

### Lazer nöqtəsi (`laser`)

`cat.laser({ x, y })`: pişiyin qutusunda nöqtə (yuxarı sol küncdən px; qutudan kənarda da ola bilər, onda pişik ora baxır); `cat.laser(null)`: nöqtə yox oldu. Kursorun hər hərəkətini birbaşa ötürmək olar. Nöqtə qutunun içindədirsə mühərrik onu özü çəkir: sabit, heç vaxt yanıb-sönmür. Oturan pişik nöqtəni baş və gözlə izləyir; yerdə, yaxında olan nöqtəyə çömbəlib dönür; dayanan nöqtəyə arxası yırğalanır və üstünə atılır (səhnə qutusunda qutunun içində sıçrayıb yer dəyişir). Nöqtə itəndə təəccüblə ətrafa baxır, sonra yerinə qayıdıb oturur. Calm: yırğalanma və sıçrayış yoxdur. Still: yalnız gözlər izləyir. Lazer istifadəçinin seçimi olmalıdır (defolt olaraq yox); səhifələrə qoşulması sonrakı mərhələdədir.

## Düzəlişlər, 1-ci tur (2026-10-27)

Bədii rəyçinin qeydlərinə görə; API dəyişməyib.

- Yandan görünən baş 3/4 çəkilir (`prof`, |o| > 0,45): ağız-burun siluetdən çıxır, uzaq göz burun körpüsünün arxasında daralır və ağ ağızlığın altında qalır, uzaq qulaq başın arxasına keçir, uzaq yanaq tükləri gizlənir. Yandan boynun üstündə tük dilimləri var.
- Qaçış: onurğa addımla yığılıb açılır (±17°), iki uçuş anı, sinə və omba növbə ilə qalxır, baş yırğalanır, quyruq addımla dalğalanır, kölgə hündürlüklə kiçilib solur.
- Ayaqlar: bilək incəlir, arxasında bilək yastığı çıxıntısı var; barmaqlar konturda dörd dilimdir (cızıq yoxdur); uzaq ayaqlar eyni xəz və ağ corab rəngindədir, təxminən 12% tünd.
- "Çörək" pozası: quyruq yaxın budun altından çıxır və bədənin altı boyu tək əyri ilə ön pəncələrə uzanır (tikiş xətti yoxdur).
- Rəng: tabby ləkələri tündləşib (`#3d3835`), böyürdəki burulğan genişlənib, quyruqda üç qalın halqa və tünd uc var.
- Tünd fon: pişiyin arxasındakı səth tünd olanda (`surfaceDark`: ilk qeyri-şəffaf fon rəngi, ölçü və tema dəyişəndə oxunur) kontur açıqlaşır, işıqlı tərəfdə incə açıq haşiyə görünür, yerdəki kölgə açıq bənövşəyi olur.
- 80 px-dən kiçik baş kəsiyi oval yumşaq keçidlə bitir, sərt kəsik yoxdur.
- Qutuya sığma: `fitAct` hər 0,12 s-dən bir kadr yoxlayır, quyruğun yellənməsinə yer saxlayır, budları da sayır; lazer otağının kənarlarında ehtiyat var; maskot tullanmasında quyruq belinin üstündə qıvrılır.
- Oyuncaqlar ən azı 1,5 dəfə böyükdür (kiçik qutuda daha da böyük, `toyScale`) və döşəmədə pişiyin ortasında çəkilir: yaxın pəncələrin və başın arxasında, uzaq pəncələrin önündə.

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

