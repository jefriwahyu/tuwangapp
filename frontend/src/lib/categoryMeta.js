// Satu-satunya peta ikon/warna kategori di frontend.
// msym = nama ikon Material Symbols Outlined (tanpa library tambahan).
// Kunci harus sama persis dengan backend category.Allowed.
const META = {
  'Gaji': { msym: 'payments', bg: '#dcfce7', fg: '#047857' },
  'Bonus': { msym: 'card_giftcard', bg: '#fef3c7', fg: '#b45309' },
  'Usaha': { msym: 'storefront', bg: '#dcfce7', fg: '#047857' },
  'Hadiah': { msym: 'redeem', bg: '#fce7f3', fg: '#be185d' },
  'Makanan & Minuman': { msym: 'restaurant', bg: '#ffedd5', fg: '#c2410c' },
  'Transportasi': { msym: 'local_gas_station', bg: '#e0f2fe', fg: '#0369a1' },
  'Belanja': { msym: 'shopping_cart', bg: '#ede9fe', fg: '#6d28d9' },
  'Tempat Tinggal': { msym: 'home', bg: '#dbeafe', fg: '#1d4ed8' },
  'Kesehatan': { msym: 'medical_services', bg: '#fee2e2', fg: '#b91c1c' },
  'Hiburan': { msym: 'movie', bg: '#ede9fe', fg: '#7c3aed' },
  'Pendidikan': { msym: 'menu_book', bg: '#dbeafe', fg: '#1d4ed8' },
  'Lainnya': { msym: 'receipt_long', bg: '#f1f5f9', fg: '#475569' },
};

const FALLBACK = { msym: 'receipt_long', bg: '#f1f5f9', fg: '#475569' };

export function getCategoryMeta(category) {
  return META[category] || FALLBACK;
}

// Warna bar kategori diurut rotasi supaya tetangga tidak kembar.
export const CAT_BAR_COLORS = ['#b45309', '#0891b2', '#059669', '#7c3aed', '#db2777', '#4d7c0f'];

export function catBarColor(index) {
  return CAT_BAR_COLORS[index % CAT_BAR_COLORS.length];
}
