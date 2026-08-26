-- 0001_catalogue.sql
--
-- GENERATED FILE — do not edit by hand.
-- Dumped from the live catalogue: npm run dump:seed
--
-- Idempotent. products.ref and product_variants.sku are the natural keys, so
-- every statement is an upsert and the file is safe to re-run.
--
-- Inventory is the one exception: it inserts ON CONFLICT DO NOTHING, because
-- a re-run must not silently restore stock that has since been sold.

begin;

-- ----------------------------------------------------------- categories --
insert into categories (slug, kind, position, is_derived) values
  ('indoor', 'plants', 0, false),
  ('outdoor', 'plants', 1, false),
  ('pet-safe', 'plants', 2, true),
  ('beginner', 'plants', 3, true),
  ('pots', 'pots', 4, false),
  ('care', 'care', 5, false)
on conflict (slug) do update set
  kind = excluded.kind, position = excluded.position, is_derived = excluded.is_derived;

insert into category_translations (category_id, locale, name, description)
select c.id, v.locale::locale_code, v.name, v.description
from (values
  ('indoor', 'en', 'Indoor Plants', 'Plants that thrive in Malaysian homes and apartments — chosen for our humidity, our light, and our aircon.'),
  ('indoor', 'ms', 'Pokok Dalam Rumah', 'Pokok yang subur di rumah dan pangsapuri Malaysia — dipilih untuk kelembapan kita, cahaya kita dan penghawa dingin kita.'),
  ('indoor', 'zh', '室内植物', '能在马来西亚的住家与公寓里长得好的植物——为我们的湿度、光线和冷气而选。'),
  ('outdoor', 'en', 'Garden & Balcony', 'Tropical plants for balconies, porches and gardens that can take full Malaysian sun and monsoon rain.'),
  ('outdoor', 'ms', 'Taman & Balkoni', 'Pokok tropika untuk balkoni, beranda dan taman yang tahan panas terik Malaysia serta hujan monsun.'),
  ('outdoor', 'zh', '庭院与阳台', '适合阳台、门廊与庭院的热带植物，扛得住马来西亚的烈日与季风雨。'),
  ('pet-safe', 'en', 'Pet-Safe Plants', 'Every plant here is listed as non-toxic to cats and dogs by the ASPCA. Nothing goes in this collection on a guess.'),
  ('pet-safe', 'ms', 'Selamat Untuk Haiwan', 'Setiap pokok di sini disenaraikan sebagai tidak toksik kepada kucing dan anjing oleh ASPCA. Tiada yang dimasukkan berdasarkan tekaan.'),
  ('pet-safe', 'zh', '宠物安全植物', '这里的每一株都经 ASPCA 列为对猫狗无毒。没有一株是靠猜测放进来的。'),
  ('beginner', 'en', 'Hard to Kill', 'Forgiving plants for first-time plant parents. If you have killed something before, start here.'),
  ('beginner', 'ms', 'Mudah Dijaga', 'Pokok yang memaafkan untuk penjaga pokok kali pertama. Kalau anda pernah mematikan pokok, mulakan di sini.'),
  ('beginner', 'zh', '极易存活', '给第一次养植物的人，容错率高。如果你养死过东西，从这里开始。'),
  ('pots', 'en', 'Pots & Planters', 'Handmade terracotta, glazed ceramic and lightweight fibreclay in sizes that fit our plants.'),
  ('pots', 'ms', 'Pasu & Bekas', 'Terakota buatan tangan, seramik bersalut dan fibreclay ringan dalam saiz yang sesuai dengan pokok kami.'),
  ('pots', 'zh', '花盆与容器', '手工陶土盆、上釉陶瓷盆与轻质纤维黏土盆，尺寸都与我们的植物相配。'),
  ('care', 'en', 'Soil & Care', 'Aroid mix, fertiliser, pest control and tools blended for tropical growing conditions.'),
  ('care', 'ms', 'Tanah & Penjagaan', 'Campuran aroid, baja, kawalan perosak dan alatan yang diadun untuk keadaan tanaman tropika.'),
  ('care', 'zh', '土壤与养护', '为热带栽培条件调配的天南星科介质、肥料、防虫用品与工具。')
) as v(slug, locale, name, description)
join categories c on c.slug = v.slug
on conflict (category_id, locale) do update set
  name = excluded.name, description = excluded.description;

-- ------------------------------------------------------------- products --
insert into products (ref, name_botanical, category_id, badges, rating, review_count, peninsular_only, is_active)
select v.ref, v.name_botanical, c.id, v.badges, v.rating, v.review_count, v.peninsular_only, v.is_active
from (values
  ('p-aglaonema', 'Aglaonema commutatum', 'indoor', ARRAY['lowLight', 'bestSeller'], 4.8::numeric(2,1), 145, false, true),
  ('p-birdsnest', 'Asplenium nidus', 'pet-safe', ARRAY['native'], 4.7::numeric(2,1), 91, false, true),
  ('p-boston', 'Nephrolepis exaltata', 'pet-safe', ARRAY['hanging'], 4.3::numeric(2,1), 44, false, true),
  ('p-bougainvillea', 'Bougainvillea glabra', 'outdoor', ARRAY['fullSun', 'flowering'], 4.5::numeric(2,1), 52, false, true),
  ('p-calathea', 'Goeppertia orbifolia', 'pet-safe', ARRAY['statement'], 4.4::numeric(2,1), 58, true, true),
  ('p-fiddle', 'Ficus lyrata', 'indoor', ARRAY['statement'], 4.2::numeric(2,1), 87, true, true),
  ('p-frangipani', 'Plumeria rubra', 'outdoor', ARRAY['fullSun', 'fragrant'], 4.7::numeric(2,1), 38, true, true),
  ('p-monstera', 'Monstera deliciosa', 'indoor', ARRAY['bestSeller', 'fastGrower'], 4.8::numeric(2,1), 214, true, true),
  ('p-parlour', 'Chamaedorea elegans', 'pet-safe', ARRAY['lowLight'], 4.6::numeric(2,1), 74, true, true),
  ('p-peperomia', 'Peperomia obtusifolia', 'pet-safe', ARRAY['deskSize'], 4.6::numeric(2,1), 63, false, true),
  ('p-pothos', 'Epipremnum aureum', 'beginner', ARRAY['hardToKill', 'fastGrower'], 4.8::numeric(2,1), 262, false, true),
  ('p-snake', 'Dracaena trifasciata', 'beginner', ARRAY['hardToKill', 'lowLight'], 4.9::numeric(2,1), 341, false, true),
  ('p-spider', 'Chlorophytum comosum', 'pet-safe', ARRAY['easy'], 4.7::numeric(2,1), 128, false, true),
  ('p-zz', 'Zamioculcas zamiifolia', 'beginner', ARRAY['hardToKill', 'lowLight'], 4.9::numeric(2,1), 176, false, true)
) as v(ref, name_botanical, category_slug, badges, rating, review_count, peninsular_only, is_active)
join categories c on c.slug = v.category_slug
on conflict (ref) do update set
  name_botanical = excluded.name_botanical, category_id = excluded.category_id,
  badges = excluded.badges, rating = excluded.rating, review_count = excluded.review_count,
  peninsular_only = excluded.peninsular_only, is_active = excluded.is_active;

-- ----------------------------------------------------------- attributes --
-- pet_safe NULL means unverified against the ASPCA database. Never render
-- that as safe.
insert into plant_attributes (product_id, light, water, pet_safe, difficulty, mature_height_cm, placement, air_purifying)
select p.id, v.light::light_level, v.water::water_frequency, v.pet_safe,
       v.difficulty::care_difficulty, v.mature_height_cm, v.placement::plant_placement, v.air_purifying
from (values
  ('p-aglaonema', 'low', 'weekly', false::boolean, 'beginner', 70, 'indoor', true),
  ('p-birdsnest', 'medium', 'keep-moist', true::boolean, 'easy', 80, 'both', false),
  ('p-boston', 'bright-indirect', 'keep-moist', true::boolean, 'moderate', 60, 'both', true),
  ('p-bougainvillea', 'direct-sun', 'when-dry', false::boolean, 'easy', 300, 'outdoor', false),
  ('p-calathea', 'medium', 'keep-moist', true::boolean, 'moderate', 80, 'indoor', false),
  ('p-fiddle', 'bright-indirect', 'weekly', false::boolean, 'expert', 200, 'indoor', false),
  ('p-frangipani', 'direct-sun', 'when-dry', false::boolean, 'easy', 400, 'outdoor', false),
  ('p-monstera', 'bright-indirect', 'weekly', false::boolean, 'easy', 250, 'indoor', true),
  ('p-parlour', 'medium', 'weekly', true::boolean, 'easy', 150, 'indoor', true),
  ('p-peperomia', 'bright-indirect', 'when-dry', true::boolean, 'beginner', 30, 'indoor', false),
  ('p-pothos', 'medium', 'weekly', false::boolean, 'beginner', 180, 'both', true),
  ('p-snake', 'low', 'when-dry', false::boolean, 'beginner', 100, 'indoor', true),
  ('p-spider', 'bright-indirect', 'weekly', true::boolean, 'beginner', 45, 'indoor', true),
  ('p-zz', 'low', 'when-dry', false::boolean, 'beginner', 90, 'indoor', false)
) as v(ref, light, water, pet_safe, difficulty, mature_height_cm, placement, air_purifying)
join products p on p.ref = v.ref
on conflict (product_id) do update set
  light = excluded.light, water = excluded.water, pet_safe = excluded.pet_safe,
  difficulty = excluded.difficulty, mature_height_cm = excluded.mature_height_cm,
  placement = excluded.placement, air_purifying = excluded.air_purifying;

-- ---------------------------------------------------------- translations --
-- Slugs are localised: /en/plants/snake-plant, /ms/plants/pokok-lidah-jin,
-- /zh/plants/huweilan. The (locale, slug) unique index is what makes each a
-- single indexed lookup.
insert into product_translations (product_id, locale, name, slug, tagline, description, care_summary, climate_note, toxicity_note)
select p.id, v.locale::locale_code, v.name, v.slug, v.tagline, v.description, v.care_summary, v.climate_note, v.toxicity_note
from (values
  ('p-aglaonema', 'en', 'Aglaonema Red', 'aglaonema-red', 'Colour without a bright window',
   'Pink and red variegation on broad green leaves — rare in a plant that will genuinely tolerate a dim room. A long-standing favourite in Malaysian homes and one of the most reliable indoor performers we stock.',
   'Low to medium indirect light. Water when the top 3cm is dry. The deeper the shade, the less it drinks.',
   NULL, 'Calcium oxalate crystals cause oral irritation and vomiting in cats and dogs.'),
  ('p-aglaonema', 'ms', 'Aglaonema Merah', 'aglaonema-merah', 'Warna tanpa perlukan tingkap cerah',
   'Corak merah jambu dan merah pada daun hijau yang lebar — jarang ditemui pada pokok yang benar-benar tahan bilik malap. Kegemaran lama di rumah Malaysia dan antara pokok dalam rumah paling boleh diharap yang kami simpan.',
   'Cahaya malap hingga sederhana, tidak terus. Siram apabila 3cm tanah di atas kering. Semakin teduh, semakin kurang ia minum.',
   NULL, 'Hablur kalsium oksalat menyebabkan kerengsaan mulut dan muntah pada kucing dan anjing.'),
  ('p-aglaonema', 'zh', '红粗肋草', 'hong-culecao', '不用明亮窗户也有颜色',
   '宽阔绿叶上带着粉色与红色斑纹——在一株真能耐受昏暗房间的植物身上很少见。马来西亚家庭长年的心头好，也是我们库存中最可靠的室内植物之一。',
   '弱光到中等散射光。表层 3cm 干了就浇水。越暗的位置，它喝得越少。',
   NULL, '草酸钙结晶会造成猫狗口腔刺激和呕吐。'),
  ('p-birdsnest', 'en', 'Bird’s Nest Fern', 'birds-nest-fern', 'A native that loves our weather',
   'Ripple-edged fronds unfurling from a central rosette. It grows wild on tree trunks across Malaysia, so our humidity is exactly what it wants — no misting routine required. Non-toxic to pets.',
   'Bright indirect to medium light. Keep the soil consistently moist and water around the rosette, not into it.',
   'Epiphytic and native to Malaysian rainforest — thrives on a shaded, humid balcony.', NULL),
  ('p-birdsnest', 'ms', 'Paku Langsuir', 'paku-langsuir', 'Spesies tempatan yang sukakan cuaca kita',
   'Pelepah bertepi beralun yang membuka daripada roset tengah. Ia tumbuh liar pada batang pokok di seluruh Malaysia, jadi kelembapan kita memang yang ia mahukan — tiada rutin menyembur diperlukan. Tidak toksik kepada haiwan peliharaan.',
   'Cahaya cerah tidak terus hingga sederhana. Kekalkan tanah lembap dan siram di sekeliling roset, bukan ke dalamnya.',
   'Epifit dan asli hutan hujan Malaysia — subur di balkoni yang teduh dan lembap.', NULL),
  ('p-birdsnest', 'zh', '鸟巢蕨', 'niaochaojue', '本地物种，正合我们的天气',
   '波浪状边缘的叶片从中心莲座层层展开。它在马来西亚各地的树干上野生生长，所以我们的湿度正是它想要的——完全不需要喷雾的例行公事。对宠物无毒。',
   '明亮散射光到中等光线。保持土壤持续湿润，浇在莲座周围，不要浇进中心。',
   '附生植物，原产马来西亚雨林——在有遮荫、湿润的阳台上长得最好。', NULL),
  ('p-boston', 'en', 'Boston Fern', 'boston-fern', 'Pet-safe and made for humidity',
   'Dense arching fronds that spill over the edge of a hanging pot. It is the classic verandah fern for a reason — it wants exactly the humidity we already have.',
   'Bright indirect light, out of direct sun. Keep the soil damp at all times; a dried-out Boston fern rarely comes back.',
   'A shaded, sheltered verandah is ideal. Indoors it needs to be away from aircon vents.', NULL),
  ('p-boston', 'ms', 'Paku Boston', 'paku-boston', 'Selamat untuk haiwan dan dicipta untuk kelembapan',
   'Pelepah melengkung yang padat, melimpah keluar dari tepi pasu gantung. Ia paku beranda klasik atas sebab yang jelas — ia mahukan tepat kelembapan yang kita sudah ada.',
   'Cahaya cerah tidak terus, jauh daripada panas terik. Kekalkan tanah lembap sepanjang masa; paku Boston yang kering jarang pulih.',
   'Beranda yang teduh dan terlindung adalah ideal. Di dalam rumah ia perlu dijauhkan daripada bukaan penghawa dingin.', NULL),
  ('p-boston', 'zh', '波士顿蕨', 'boshidun-jue', '宠物安全，为湿度而生',
   '浓密的弧形叶片从吊盆边缘垂泻而下。它成为经典的走廊蕨类是有原因的——它想要的湿度，正是我们本来就有的。',
   '明亮散射光，避开直射阳光。任何时候都保持土壤湿润；一旦彻底干透，波士顿蕨很少能救回来。',
   '有遮荫、避风的走廊最理想。放室内则必须远离冷气出风口。', NULL),
  ('p-bougainvillea', 'en', 'Bougainvillea', 'bougainvillea', 'Full sun, full colour',
   'Paper-thin magenta bracts over a woody climber that flowers hardest when you treat it badly — hot, bright and slightly dry. The classic Malaysian gate and fence plant.',
   'Full direct sun, minimum six hours. Water deeply but let it dry between waterings; constant moisture gives you leaves instead of flowers.',
   'Perfectly suited to Malaysian lowland heat. Flowers best in the drier spells between monsoons.', 'The sap can irritate skin and the thorns cause painful scratches. Not listed as seriously toxic, but site it away from where pets and children play.'),
  ('p-bougainvillea', 'ms', 'Pokok Bunga Kertas', 'pokok-bunga-kertas', 'Panas terik, warna penuh',
   'Kelopak magenta setipis kertas pada pemanjat berkayu yang berbunga paling lebat apabila dilayan dengan kasar — panas, cerah dan sedikit kering. Pokok pagar dan pintu gerbang klasik Malaysia.',
   'Panas terik penuh, sekurang-kurangnya enam jam. Siram dengan banyak tetapi biarkan kering antara siraman; kelembapan berterusan memberi anda daun, bukan bunga.',
   'Amat sesuai dengan panas tanah rendah Malaysia. Berbunga paling lebat ketika musim kering antara monsun.', 'Getahnya boleh merengsakan kulit dan durinya menyebabkan calar yang perit. Tidak disenaraikan sebagai sangat toksik, tetapi letakkannya jauh daripada tempat haiwan dan kanak-kanak bermain.'),
  ('p-bougainvillea', 'zh', '九重葛', 'jiuchongge', '全日照，全彩',
   '薄如纸的洋红色苞片长在木质藤蔓上，你对它越「不好」——热、晒、略干——它开得越凶。马来西亚经典的门口与围篱植物。',
   '全日照，每天至少六小时。浇就浇透，但要等干了再浇；持续潮湿只会长叶不开花。',
   '非常适合马来西亚低地的高温。在季风之间较干燥的时段开得最好。', '汁液可能刺激皮肤，尖刺会造成疼痛的刮伤。虽未被列为剧毒，但请种在宠物与孩童活动范围之外。'),
  ('p-calathea', 'en', 'Calathea Orbifolia', 'calathea-orbifolia', 'Silver-striped and pet-safe',
   'Wide, round leaves banded in silver-green that fold up at night. It is fussier than most — it wants humidity and dislikes hard tap water — but nothing else in the catalogue has this presence.',
   'Medium indirect light, never direct sun. Keep evenly moist with filtered or rain water. Brown crispy edges mean the air or the water is too harsh.',
   'Our natural humidity does most of the work — the risk here is aircon, not climate.', NULL),
  ('p-calathea', 'ms', 'Calathea Orbifolia', 'calathea-orbifolia', 'Berjalur perak dan selamat untuk haiwan',
   'Daun lebar dan bulat berjalur hijau keperakan yang melipat pada waktu malam. Ia lebih cerewet daripada kebanyakan pokok — ia mahukan kelembapan dan tidak menyukai air paip yang keras — tetapi tiada apa lagi dalam katalog ini yang setanding kehadirannya.',
   'Cahaya sederhana tidak terus, jangan sekali-kali panas terik. Kekalkan lembap sekata dengan air tapisan atau air hujan. Hujung perang dan rapuh bermakna udara atau air terlalu keras.',
   'Kelembapan semula jadi kita melakukan sebahagian besar kerja — risikonya di sini ialah penghawa dingin, bukan iklim.', NULL),
  ('p-calathea', 'zh', '圆叶竹芋', 'yuanye-zhuyu', '银纹叶片，宠物安全',
   '宽阔的圆形叶片带着银绿相间的条纹，入夜会合拢起来。它比大多数植物娇气——需要湿度，也不喜欢硬质自来水——但目录里没有第二株有这样的气场。',
   '中等散射光，绝不要直射阳光。用过滤水或雨水保持均匀湿润。叶缘干褐发脆，代表空气或水质太糟。',
   '我们天然的湿度已经完成了大部分工作——这里的风险是冷气，不是气候。', NULL),
  ('p-fiddle', 'en', 'Fiddle Leaf Fig', 'fiddle-leaf-fig', 'The one worth the effort',
   'Enormous violin-shaped leaves on a single sculptural trunk. It is the most photographed houseplant in the world and the most temperamental one we sell — it hates being moved and will drop leaves to tell you so.',
   'The brightest indirect spot you have. Water thoroughly when the top 5cm dries, then leave it alone. Pick a location and do not move it.',
   'Give it morning sun near an east window. Full Malaysian afternoon sun through glass will burn it.', 'The milky sap contains irritants that cause mouth and stomach upset in cats and dogs.'),
  ('p-fiddle', 'ms', 'Pokok Ara Biola', 'pokok-ara-biola', 'Yang berbaloi dengan usahanya',
   'Daun besar berbentuk biola pada satu batang bergaya. Ia pokok hiasan paling banyak difoto di dunia dan paling mudah merajuk antara yang kami jual — ia benci dipindahkan dan akan menggugurkan daun untuk memberitahu anda.',
   'Tempat paling cerah tanpa cahaya terus yang anda ada. Siram sepenuhnya apabila 5cm di atas kering, kemudian biarkan. Pilih satu tempat dan jangan alihkan.',
   'Berikan cahaya pagi berhampiran tingkap menghadap timur. Panas petang Malaysia melalui cermin akan membakarnya.', 'Getah putihnya mengandungi bahan merengsa yang menyebabkan gangguan mulut dan perut pada kucing dan anjing.'),
  ('p-fiddle', 'zh', '琴叶榕', 'qinye-rong', '值得为它费心的那一株',
   '巨大的提琴状叶片长在一根有雕塑感的主干上。它是世界上被拍得最多的室内植物，也是我们卖的植物里脾气最大的一株——它讨厌被移动，而且会用掉叶来抗议。',
   '放在你家最明亮但不直射的位置。表层 5cm 干了就浇透，然后别再打扰它。选定位置就不要再挪。',
   '让它在朝东窗边接受晨光。透过玻璃的马来西亚午后烈日会把它灼伤。', '乳白色汁液含刺激性物质，会造成猫狗口腔和肠胃不适。'),
  ('p-frangipani', 'en', 'Frangipani', 'frangipani', 'Scented, sculptural, unmistakably tropical',
   'Thick grey branches carrying clusters of fragrant white-and-yellow flowers. Slow, sculptural and long-lived — a plant you buy once and keep for decades in a courtyard or by a driveway.',
   'Full sun and free-draining soil. Water when the soil dries; it stores water in its stems and rots if kept wet.',
   'Thrives in our heat. Needs a spot that drains — it will not tolerate waterlogged monsoon soil.', 'The milky sap is an irritant to skin, eyes and mouth for both people and pets.'),
  ('p-frangipani', 'ms', 'Pokok Kemboja', 'pokok-kemboja', 'Wangi, bergaya, jelas tropika',
   'Dahan kelabu tebal membawa gugusan bunga putih dan kuning yang wangi. Perlahan, bergaya dan panjang umur — pokok yang dibeli sekali dan disimpan berdekad-dekad di laman atau tepi pemandu masuk.',
   'Panas terik penuh dan tanah yang mudah mengalirkan air. Siram apabila tanah kering; ia menyimpan air dalam batangnya dan reput jika sentiasa basah.',
   'Subur dalam panas kita. Perlukan tempat yang mengalirkan air — ia tidak tahan tanah monsun yang bertakung.', 'Getah putihnya merengsakan kulit, mata dan mulut, untuk manusia dan haiwan peliharaan.'),
  ('p-frangipani', 'zh', '鸡蛋花', 'jidanhua', '芬芳、有型、道地的热带气息',
   '灰白粗壮的枝干托着一簇簇白黄相间的香花。生长缓慢、姿态如雕塑、寿命极长——买一次就能在庭院或车道旁留上几十年。',
   '全日照，土壤要排水良好。土干了再浇；它把水储存在枝干里，长期潮湿会烂根。',
   '在我们的高温下长得极好。需要排水的位置——它受不了季风季节积水的土壤。', '乳白色汁液对人和宠物的皮肤、眼睛和口腔都有刺激性。'),
  ('p-monstera', 'en', 'Monstera Deliciosa', 'monstera-deliciosa', 'The one with the famous holes',
   'The plant that turned a generation into plant people. Big, glossy, deeply split leaves that get more dramatic as it matures. It grows fast in Malaysian humidity — expect a new leaf every few weeks through the year, and give it something to climb.',
   'Bright indirect light, water when the top 5cm of soil is dry. Wipe the leaves monthly so they can breathe and keep their shine.',
   'Loves our humidity. Keep it out of the direct afternoon sun through a west-facing window, which will scorch the leaves.', 'Contains insoluble calcium oxalates. Chewing the leaves causes mouth irritation and drooling in cats and dogs. Keep out of reach.'),
  ('p-monstera', 'ms', 'Pokok Monstera', 'pokok-monstera', 'Yang terkenal dengan daun berlubang',
   'Pokok yang menjadikan satu generasi peminat tanaman. Daun besar, berkilat dan berbelah dalam, semakin dramatik apabila ia matang. Ia membesar cepat dalam kelembapan Malaysia — jangkakan daun baharu setiap beberapa minggu sepanjang tahun, dan berikan sesuatu untuknya memanjat.',
   'Cahaya cerah tidak terus, siram apabila 5cm tanah di atas kering. Lap daunnya setiap bulan supaya ia boleh bernafas dan kekal berkilat.',
   'Sukakan kelembapan kita. Jauhkan daripada panas petang terus melalui tingkap menghadap barat, yang akan membakar daunnya.', 'Mengandungi kalsium oksalat tidak larut. Menggigit daunnya menyebabkan kerengsaan mulut dan berliur pada kucing dan anjing. Letak di luar jangkauan.'),
  ('p-monstera', 'zh', '龟背竹', 'guibeizhu', '叶子上有名的那些孔洞',
   '让整整一代人变成植物爱好者的那株植物。叶片宽大厚实、深裂有光泽，越成熟越有戏剧性。在马来西亚的湿度里它长得很快——一年里每隔几周就会抽新叶，记得给它一根可以攀爬的支柱。',
   '明亮的散射光，表层 5cm 土壤干了就浇水。每月擦一次叶片，让它能呼吸并保持光泽。',
   '喜欢我们的湿度。避开西晒窗口的午后直射阳光，那会把叶片灼伤。', '含有不溶性草酸钙。猫狗啃咬叶片会造成口腔刺激和流涎。请放在它们够不到的地方。'),
  ('p-parlour', 'en', 'Parlour Palm', 'parlour-palm', 'Soft, tropical, cat-proof',
   'A slow-growing indoor palm with fine feathery fronds that softens a room without demanding a bright window. Non-toxic to cats and dogs, which makes it one of the safest ways to get real height into a pet household.',
   'Medium to low indirect light. Keep the soil lightly moist, never soggy. Mist during dry aircon spells.',
   'Naturally an understorey palm — our indirect tropical light suits it perfectly.', NULL),
  ('p-parlour', 'ms', 'Palma Parlour', 'palma-parlour', 'Lembut, tropika, selamat untuk kucing',
   'Palma dalam rumah yang tumbuh perlahan dengan pelepah halus, melembutkan sesebuah bilik tanpa memerlukan tingkap yang cerah. Tidak toksik kepada kucing dan anjing, menjadikannya salah satu cara paling selamat untuk mendapatkan ketinggian sebenar dalam rumah berhaiwan.',
   'Cahaya sederhana hingga malap, tidak terus. Kekalkan tanah lembap sedikit, jangan sampai bertakung. Semburkan air ketika penghawa dingin mengeringkan udara.',
   'Secara semula jadi palma lantai hutan — cahaya tropika tidak terus kita amat sesuai untuknya.', NULL),
  ('p-parlour', 'zh', '袖珍椰子', 'xiuzhen-yezi', '柔和、热带，猫也不怕',
   '生长缓慢的室内棕榈，羽状细叶能柔化整个空间，而且不需要明亮的窗户。对猫狗无毒，是在养宠物的家里营造高度感最安全的选择之一。',
   '中等到偏弱的散射光。保持土壤微湿，但绝不积水。冷气房干燥时可喷雾。',
   '它本来就是林下棕榈——我们的热带散射光正合它意。', NULL),
  ('p-peperomia', 'en', 'Baby Rubber Plant', 'baby-rubber-plant', 'Small, sturdy, pet-safe',
   'Thick, cupped, glossy leaves on a compact plant that stays desk-sized forever. Semi-succulent, so it copes with a missed watering, and non-toxic to cats and dogs.',
   'Bright indirect light. Let the top half of the pot dry out before watering again.',
   NULL, NULL),
  ('p-peperomia', 'ms', 'Peperomia Daun Tebal', 'peperomia-daun-tebal', 'Kecil, kukuh, selamat untuk haiwan',
   'Daun tebal, cekung dan berkilat pada pokok padat yang kekal bersaiz meja selamanya. Separa sukulen, jadi ia tahan jika terlepas satu siraman, dan tidak toksik kepada kucing dan anjing.',
   'Cahaya cerah tidak terus. Biarkan separuh atas pasu kering sebelum menyiram semula.',
   NULL, NULL),
  ('p-peperomia', 'zh', '圆叶椒草', 'yuanye-jiaocao', '小巧、结实、宠物安全',
   '厚实微凹的光亮叶片，株型紧凑，永远维持在桌面大小。半肉质，所以偶尔忘记浇水也撑得住，而且对猫狗无毒。',
   '明亮散射光。等盆土上半部干透再浇下一次水。',
   NULL, NULL),
  ('p-pothos', 'en', 'Golden Pothos', 'golden-pothos', 'Trails, climbs, forgives',
   'The money plant. Heart-shaped leaves marbled with gold that will trail off a shelf or climb a pole, growing metres a year in our climate. Cuttings root in a glass of water within a fortnight.',
   'Any light except harsh direct sun. Water when the top 3cm is dry. Trim it back whenever it gets leggy.',
   'Grows aggressively outdoors in shade. Keep it contained — it will take over a balcony.', 'Insoluble calcium oxalates — irritating to cats and dogs if chewed.'),
  ('p-pothos', 'ms', 'Pokok Duit', 'pokok-duit', 'Menjalar, memanjat, memaafkan',
   'Pokok duit. Daun berbentuk hati bercorak keemasan yang akan menjalar dari rak atau memanjat tiang, membesar beberapa meter setahun dalam iklim kita. Keratannya berakar dalam segelas air dalam masa dua minggu.',
   'Sebarang cahaya kecuali panas terik. Siram apabila 3cm tanah di atas kering. Pangkas apabila ia mula memanjang.',
   'Membesar dengan agresif di luar rumah dalam teduhan. Kawal pertumbuhannya — ia akan memenuhi balkoni.', 'Kalsium oksalat tidak larut — merengsakan kucing dan anjing jika digigit.'),
  ('p-pothos', 'zh', '黄金葛', 'huangjinge', '会垂、会爬、也很宽容',
   '俗称发财藤。心形叶片带着金黄斑纹，可以从层架上垂下来，也可以顺着柱子往上爬，在我们的气候里一年能长好几米。剪下来的枝条泡在水杯里，两周内就会生根。',
   '除了强烈直射阳光，什么光线都行。表层 3cm 土干了就浇水。徒长了就随时修剪。',
   '在户外遮荫处会长得非常猛。要控制范围——否则它会占满整个阳台。', '含不溶性草酸钙——猫狗啃咬会受到刺激。'),
  ('p-snake', 'en', 'Snake Plant', 'snake-plant', 'Survives almost anything',
   'Architectural, upright and famously difficult to kill. It stores water in its leaves, so the most common way to lose one is overwatering, not neglect. Perfect for a dim corner, an office, or a home you leave for weeks at a time.',
   'Low to bright light — it tolerates both. Water only when the soil is completely dry, roughly every 2–3 weeks indoors.',
   'Handles aircon and low humidity better than almost anything else we sell.', 'Contains saponins, which cause nausea, vomiting and diarrhoea in cats and dogs if eaten.'),
  ('p-snake', 'ms', 'Pokok Lidah Jin', 'pokok-lidah-jin', 'Tahan hampir apa sahaja',
   'Tegak, berbentuk seni bina dan terkenal sukar dimatikan. Ia menyimpan air dalam daunnya, jadi punca paling biasa kehilangannya ialah terlebih siram, bukan terbiar. Sesuai untuk sudut malap, pejabat, atau rumah yang ditinggalkan berminggu-minggu.',
   'Cahaya malap hingga cerah — ia tahan kedua-duanya. Siram hanya apabila tanah kering sepenuhnya, lebih kurang setiap 2–3 minggu di dalam rumah.',
   'Menangani penghawa dingin dan kelembapan rendah lebih baik daripada hampir semua pokok lain yang kami jual.', 'Mengandungi saponin, yang menyebabkan loya, muntah dan cirit-birit pada kucing dan anjing jika dimakan.'),
  ('p-snake', 'zh', '虎尾兰', 'huweilan', '几乎什么都熬得过去',
   '线条挺拔、造型利落，出了名地难以养死。它把水分储存在叶片里，所以最常见的死因是浇太多水，而不是疏于照顾。适合昏暗的角落、办公室，或是你常常一走好几周的家。',
   '弱光到强光都能接受。只在土壤彻底干透时浇水，室内大约每 2–3 周一次。',
   '在冷气和低湿度环境下的表现，比我们卖的几乎任何植物都好。', '含有皂苷，猫狗误食会引起恶心、呕吐和腹泻。'),
  ('p-spider', 'en', 'Spider Plant', 'spider-plant', 'Pet-safe and endlessly generous',
   'Arching striped leaves and dangling baby plantlets you can snip off and root in water. One of the few genuinely pet-safe classics, and one of the easiest plants to share with friends.',
   'Bright indirect light. Water weekly. Brown tips usually mean tap water — try rainwater, or let water stand overnight before using it.',
   'Happy on a shaded balcony year-round in Peninsular Malaysia.', NULL),
  ('p-spider', 'ms', 'Pokok Lili Paris', 'pokok-lili-paris', 'Selamat untuk haiwan dan sentiasa membiak',
   'Daun berjalur melengkung dengan anak pokok yang tergantung, boleh dipotong dan diakarkan dalam air. Antara pokok klasik yang benar-benar selamat untuk haiwan peliharaan, dan antara yang paling mudah dikongsi dengan rakan.',
   'Cahaya cerah tidak terus. Siram mingguan. Hujung perang biasanya bermakna air paip — cuba air hujan, atau biarkan air semalaman sebelum digunakan.',
   'Selesa di balkoni yang teduh sepanjang tahun di Semenanjung Malaysia.', NULL),
  ('p-spider', 'zh', '吊兰', 'diaolan', '宠物安全，而且不断长出小苗',
   '带条纹的弧形叶片，加上垂下来的小侧芽——剪下来泡水就能生根。少数几种真正对宠物无毒的经典植物之一，也是最容易分送给朋友的一种。',
   '明亮的散射光。每周浇水。叶尖发褐通常是自来水造成的——换成雨水，或让水静置一晚再用。',
   '在马来西亚半岛，全年都能在有遮荫的阳台上生长良好。', NULL),
  ('p-zz', 'en', 'ZZ Plant', 'zz-plant', 'Thrives on being ignored',
   'Waxy, almost artificial-looking leaves on upright stems. It grows from underground rhizomes that store water, so it genuinely prefers being forgotten. The plant we recommend for offices, rentals and dark corridors.',
   'Low to medium light. Water every 2–3 weeks, less if it sits in a dim spot. Never let it stand in water.',
   'Very tolerant of air-conditioned offices and inconsistent watering.', 'Calcium oxalate crystals irritate the mouth and stomach of cats and dogs.'),
  ('p-zz', 'ms', 'Pokok ZZ', 'pokok-zz', 'Subur apabila diabaikan',
   'Daun berlilin yang hampir kelihatan tiruan pada batang tegak. Ia tumbuh daripada rizom bawah tanah yang menyimpan air, jadi ia memang lebih suka dilupakan. Inilah pokok yang kami syorkan untuk pejabat, rumah sewa dan koridor gelap.',
   'Cahaya malap hingga sederhana. Siram setiap 2–3 minggu, kurang lagi jika ia di tempat malap. Jangan biarkan ia berendam dalam air.',
   'Sangat tahan dengan pejabat berhawa dingin dan siraman yang tidak menentu.', 'Hablur kalsium oksalat merengsakan mulut dan perut kucing dan anjing.'),
  ('p-zz', 'zh', '金钱树', 'jinqianshu', '越是不管它，长得越好',
   '挺立茎干上的蜡质叶片，光泽强到几乎像假的。它靠地下储水的块茎生长，所以是真心喜欢被忘记。我们推荐给办公室、租屋和昏暗走廊的首选。',
   '弱光到中等光线。每 2–3 周浇一次水，光线越暗浇得越少。绝对不要让它泡在水里。',
   '非常耐得住开冷气的办公室和不规律的浇水。', '草酸钙结晶会刺激猫狗的口腔和肠胃。')
) as v(ref, locale, name, slug, tagline, description, care_summary, climate_note, toxicity_note)
join products p on p.ref = v.ref
on conflict (product_id, locale) do update set
  name = excluded.name, slug = excluded.slug, tagline = excluded.tagline,
  description = excluded.description, care_summary = excluded.care_summary,
  climate_note = excluded.climate_note, toxicity_note = excluded.toxicity_note;

-- ------------------------------------------------------------- variants --
-- price_sen is integer sen. 1 MYR = 100 sen.
insert into product_variants (product_id, sku, size_key, pot_color_key, pot_material_key, price_sen, compare_at_sen, weight_grams, height_cm, pot_diameter_cm, position)
select p.id, v.sku, v.size_key, v.pot_color_key, v.pot_material_key,
       v.price_sen, v.compare_at_sen, v.weight_grams, v.height_cm, v.pot_diameter_cm, v.position
from (values
  ('p-aglaonema', 'AGL-COM-S-CHA', 'small', 'charcoal', 'ceramic', 5500, NULL::integer, 1600, 30, 14, 0),
  ('p-aglaonema', 'AGL-COM-M-CHA', 'medium', 'charcoal', 'ceramic', 9900, NULL::integer, 3500, 55, 20, 1),
  ('p-birdsnest', 'BNF-NID-S-TER', 'small', 'terracotta', 'terracotta', 4900, NULL::integer, 1500, 30, 14, 0),
  ('p-birdsnest', 'BNF-NID-M-TER', 'medium', 'terracotta', 'terracotta', 8900, NULL::integer, 3400, 55, 20, 1),
  ('p-boston', 'BOS-EXA-H-CRE', 'hanging', 'cream', 'ceramic', 6900, NULL::integer, 2400, 45, 18, 0),
  ('p-bougainvillea', 'BOU-GLA-M-TER', 'medium', 'terracotta', 'terracotta', 7900, NULL::integer, 5000, 60, 22, 0),
  ('p-bougainvillea', 'BOU-GLA-L-TER', 'large', 'terracotta', 'terracotta', 14900, NULL::integer, 9500, 110, 30, 1),
  ('p-calathea', 'CAL-ORB-M-CRE', 'medium', 'cream', 'ceramic', 11900, NULL::integer, 3200, 50, 18, 0),
  ('p-fiddle', 'FID-LYR-M-SAN', 'medium', 'sand', 'fibreclay', 19900, NULL::integer, 6800, 100, 24, 0),
  ('p-fiddle', 'FID-LYR-L-SAN', 'large', 'sand', 'fibreclay', 32900, NULL::integer, 13500, 160, 32, 1),
  ('p-frangipani', 'FRA-RUB-L-TER', 'large', 'terracotta', 'terracotta', 21900, NULL::integer, 12000, 140, 34, 0),
  ('p-monstera', 'MON-DEL-S-TER', 'small', 'terracotta', 'terracotta', 8900, NULL::integer, 2200, 45, 15, 0),
  ('p-monstera', 'MON-DEL-M-TER', 'medium', 'terracotta', 'terracotta', 14900, 17900::integer, 5200, 80, 21, 1),
  ('p-monstera', 'MON-DEL-L-CRE', 'large', 'cream', 'fibreclay', 28900, NULL::integer, 11000, 130, 30, 2),
  ('p-parlour', 'PAR-ELE-M-CRE', 'medium', 'cream', 'ceramic', 9900, NULL::integer, 3800, 70, 19, 0),
  ('p-parlour', 'PAR-ELE-L-SAN', 'large', 'sand', 'fibreclay', 18900, NULL::integer, 8200, 120, 28, 1),
  ('p-peperomia', 'PEP-OBT-S-CRE', 'small', 'cream', 'ceramic', 3900, NULL::integer, 1000, 20, 12, 0),
  ('p-pothos', 'POT-AUR-S-TER', 'small', 'terracotta', 'terracotta', 2900, NULL::integer, 900, 20, 11, 0),
  ('p-pothos', 'POT-AUR-H-TER', 'hanging', 'terracotta', 'terracotta', 5900, NULL::integer, 1900, 35, 16, 1),
  ('p-pothos', 'POT-AUR-P-CRE', 'mossPole', 'cream', 'fibreclay', 12900, NULL::integer, 4800, 90, 22, 2),
  ('p-snake', 'SNK-TRI-S-CHA', 'small', 'charcoal', 'ceramic', 4500, NULL::integer, 1400, 30, 12, 0),
  ('p-snake', 'SNK-TRI-M-CHA', 'medium', 'charcoal', 'ceramic', 8500, NULL::integer, 3600, 65, 18, 1),
  ('p-snake', 'SNK-TRI-L-SAN', 'large', 'sand', 'fibreclay', 15900, NULL::integer, 7400, 95, 26, 2),
  ('p-spider', 'SPD-COM-S-CRE', 'small', 'cream', 'ceramic', 3500, NULL::integer, 1100, 25, 12, 0),
  ('p-spider', 'SPD-COM-H-CRE', 'hanging', 'cream', 'ceramic', 6900, NULL::integer, 2000, 40, 16, 1),
  ('p-zz', 'ZZZ-ZAM-S-CHA', 'small', 'charcoal', 'ceramic', 5900, NULL::integer, 1700, 35, 14, 0),
  ('p-zz', 'ZZZ-ZAM-M-CHA', 'medium', 'charcoal', 'ceramic', 10900, NULL::integer, 4200, 60, 20, 1)
) as v(ref, sku, size_key, pot_color_key, pot_material_key, price_sen, compare_at_sen, weight_grams, height_cm, pot_diameter_cm, position)
join products p on p.ref = v.ref
on conflict (sku) do update set
  size_key = excluded.size_key, pot_color_key = excluded.pot_color_key,
  pot_material_key = excluded.pot_material_key, price_sen = excluded.price_sen,
  compare_at_sen = excluded.compare_at_sen, weight_grams = excluded.weight_grams,
  height_cm = excluded.height_cm, pot_diameter_cm = excluded.pot_diameter_cm,
  position = excluded.position;

-- ------------------------------------------------------------ inventory --
-- DO NOTHING, not DO UPDATE: a re-run must not restore stock that has sold.
insert into inventory (variant_id, quantity_on_hand)
select pv.id, v.qty
from (values
  ('AGL-COM-S-CHA', 33),
  ('AGL-COM-M-CHA', 16),
  ('BNF-NID-S-TER', 26),
  ('BNF-NID-M-TER', 12),
  ('BOS-EXA-H-CRE', 15),
  ('BOU-GLA-M-TER', 20),
  ('BOU-GLA-L-TER', 6),
  ('CAL-ORB-M-CRE', 8),
  ('FID-LYR-M-SAN', 7),
  ('FID-LYR-L-SAN', 2),
  ('FRA-RUB-L-TER', 4),
  ('MON-DEL-S-TER', 24),
  ('MON-DEL-M-TER', 11),
  ('MON-DEL-L-CRE', 3),
  ('PAR-ELE-M-CRE', 18),
  ('PAR-ELE-L-SAN', 5),
  ('PEP-OBT-S-CRE', 41),
  ('POT-AUR-S-TER', 85),
  ('POT-AUR-H-TER', 30),
  ('POT-AUR-P-CRE', 6),
  ('SNK-TRI-S-CHA', 60),
  ('SNK-TRI-M-CHA', 32),
  ('SNK-TRI-L-SAN', 9),
  ('SPD-COM-S-CRE', 48),
  ('SPD-COM-H-CRE', 22),
  ('ZZZ-ZAM-S-CHA', 37),
  ('ZZZ-ZAM-M-CHA', 14)
) as v(sku, qty)
join product_variants pv on pv.sku = v.sku
on conflict (variant_id) do nothing;

commit;
