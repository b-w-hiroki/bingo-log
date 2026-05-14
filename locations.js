// locations.js — 観光地マスターデータ (静的)
// Phase 3: Supabase の locations テーブルに移管予定。
// cellTemplate.id は静的識別子 (テンプレートIDなので UUID 不要)。
// 実体の Cell.id はシート生成時に Utils.uuid() で発番する。

const LOCATIONS = [
  {
    id: 'kyoto-kiyomizu',
    name: '清水寺',
    area: '京都',
    subArea: '東山',
    tag: '王道',
    description:
      '京都・東山にそびえる古刹。舞台からの眺望、音羽の滝、清水坂の散策など、定番の体験を9マスに凝縮。修学旅行ぶりの再訪にも、初めての訪問にもおすすめ。',
    cellTemplates: [
      { id: 'kt-1', order: 0, label: '本堂で写真' },
      { id: 'kt-2', order: 1, label: '舞台からの眺め' },
      { id: 'kt-3', order: 2, label: '音羽の滝で一杯' },
      { id: 'kt-4', order: 3, label: '清水坂を歩く' },
      { id: 'kt-5', order: 4, label: '抹茶スイーツ' },
      { id: 'kt-6', order: 5, label: '地主神社で恋占い' },
      { id: 'kt-7', order: 6, label: '夕焼けの京都' },
      { id: 'kt-8', order: 7, label: '御朱印をもらう' },
      { id: 'kt-9', order: 8, label: '湯豆腐ランチ' },
    ],
  },
  {
    id: 'nara-park',
    name: '東大寺・奈良公園',
    area: '奈良',
    subArea: '奈良市中心部',
    tag: '自然・歴史',
    description:
      '東大寺の大仏、鹿たちが闊歩する奈良公園、春日大社の朱塗りの社殿。歴史と自然が同居する奈良の定番コースを9マスで巡る。',
    cellTemplates: [
      { id: 'nr-1', order: 0, label: '東大寺の大仏' },
      { id: 'nr-2', order: 1, label: '鹿に煎餅' },
      { id: 'nr-3', order: 2, label: '春日大社でお参り' },
      { id: 'nr-4', order: 3, label: '興福寺の五重塔' },
      { id: 'nr-5', order: 4, label: '奈良公園を散策' },
      { id: 'nr-6', order: 5, label: '柿の葉寿司を食べる' },
      { id: 'nr-7', order: 6, label: '若草山の眺め' },
      { id: 'nr-8', order: 7, label: 'ならまち散策' },
      { id: 'nr-9', order: 8, label: '鹿と記念撮影' },
    ],
  },
];

window.LOCATIONS = LOCATIONS;

window.findLocation = function findLocation(id) {
  return LOCATIONS.find((l) => l.id === id) || null;
};
