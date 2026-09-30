package category

import "strings"

// Allowed adalah satu-satunya nilai category yang boleh tersimpan.
// Daftar kecil dan tertutup: rekap per kategori tidak berantakan lagi
// karena "Makanan", "makanan", dan "Makanan & Minuman" dipaksa jadi satu.
var Allowed = []string{
	"Gaji",
	"Bonus",
	"Usaha",
	"Hadiah",
	"Makanan & Minuman",
	"Transportasi",
	"Belanja",
	"Tempat Tinggal",
	"Kesehatan",
	"Hiburan",
	"Pendidikan",
	"Lainnya",
}

// aliases memetakan ejaan bebas LLM ke bentuk kanonis.
// Kunci selalu lowercase, nilai selalu salah satu Allowed.
var aliases = map[string]string{
	// Income
	"gaji": "Gaji", "salary": "Gaji", "upah": "Gaji", "gajian": "Gaji",
	"bonus": "Bonus", "thr": "Bonus",
	"usaha": "Usaha", "bisnis": "Usaha", "jualan": "Usaha", "dagang": "Usaha",
	"hadiah": "Hadiah", "kado": "Hadiah",

	// Expense
	"makanan": "Makanan & Minuman",
	"makanan & minuman": "Makanan & Minuman",
	"makanan dan minuman": "Makanan & Minuman",
	"makan": "Makanan & Minuman",
	"minuman": "Makanan & Minuman",
	"kuliner": "Makanan & Minuman",
	"jajan": "Makanan & Minuman",
	"kopi": "Makanan & Minuman",
	"kafe": "Makanan & Minuman",
	"cafe": "Makanan & Minuman",
	"restoran": "Makanan & Minuman",
	"resto": "Makanan & Minuman",
	"snack": "Makanan & Minuman",
	"warteg": "Makanan & Minuman",
	"warung": "Makanan & Minuman",

	"transportasi": "Transportasi",
	"transport": "Transportasi",
	"bensin": "Transportasi",
	"parkir": "Transportasi",
	"ojek": "Transportasi",
	"grab": "Transportasi",
	"gojek": "Transportasi",
	"bus": "Transportasi",
	"kereta": "Transportasi",
	"tol": "Transportasi",
	"servis motor": "Transportasi",
	"servis mobil": "Transportasi",

	"belanja": "Belanja",
	"shopping": "Belanja",
	"baju": "Belanja",
	"celana": "Belanja",
	"sepatu": "Belanja",
	"shopee": "Belanja",
	"tokopedia": "Belanja",

	"tempat tinggal": "Tempat Tinggal",
	"kos": "Tempat Tinggal",
	"kost": "Tempat Tinggal",
	"kontrakan": "Tempat Tinggal",
	"sewa rumah": "Tempat Tinggal",
	"listrik": "Tempat Tinggal",
	"air": "Tempat Tinggal",
	"wifi": "Tempat Tinggal",
	"iuran": "Tempat Tinggal",

	"kesehatan": "Kesehatan",
	"obat": "Kesehatan",
	"dokter": "Kesehatan",
	"rumah sakit": "Kesehatan",
	"klinik": "Kesehatan",
	"apotek": "Kesehatan",

	"hiburan": "Hiburan",
	"nonton": "Hiburan",
	"bioskop": "Hiburan",
	"game": "Hiburan",
	"liburan": "Hiburan",
	"wisata": "Hiburan",

	"pendidikan": "Pendidikan",
	"sekolah": "Pendidikan",
	"kuliah": "Pendidikan",
	"kursus": "Pendidikan",
	"buku": "Pendidikan",
	"les": "Pendidikan",

	"lainnya": "Lainnya",
	"lain-lain": "Lainnya",
	"misc": "Lainnya",
}

// Normalize memaksa string bebas dari LLM menjadi salah satu Allowed.
// Tidak dikenal = "Lainnya", bukan teks mentah.
// Ini satu-satunya pintu masuk kategori baru ke database.
func Normalize(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "Lainnya"
	}
	lower := strings.ToLower(trimmed)

	if canon, ok := aliases[lower]; ok {
		return canon
	}
	for _, c := range Allowed {
		if strings.ToLower(c) == lower {
			return c
		}
	}

	// Fallback kata kunci untuk varian yang belum terdaftar,
	// misal "kopi susu tetangga" tetap jatuh ke Makanan & Minuman.
	switch {
	case containsAny(lower, "makan", "minum", "kopi", "jajan", "kafe", "cafe", "resto", "restoran", "snack", "kuliner", "warteg", "warung", "sembako"):
		return "Makanan & Minuman"
	case containsAny(lower, "transport", "bensin", "parkir", "ojek", "grab", "gojek", "bus", "kereta", "tol", "servis", "bengkel"):
		return "Transportasi"
	case containsAny(lower, "belanja", "shopee", "tokopedia", "baju", "celana", "sepatu", "mall"):
		return "Belanja"
	case containsAny(lower, "kos", "kontrakan", "listrik", "sewa rumah", "wifi", "iuran"):
		return "Tempat Tinggal"
	case containsAny(lower, "obat", "dokter", "sakit", "klinik", "apotek", "kesehatan"):
		return "Kesehatan"
	case containsAny(lower, "nonton", "bioskop", "game", "liburan", "wisata", "hiburan"):
		return "Hiburan"
	case containsAny(lower, "sekolah", "kuliah", "kursus", "buku", "les", "pendidikan"):
		return "Pendidikan"
	case containsAny(lower, "gaji", "salary", "upah"):
		return "Gaji"
	case containsAny(lower, "bonus", "thr"):
		return "Bonus"
	case containsAny(lower, "usaha", "bisnis", "jualan", "dagang"):
		return "Usaha"
	case containsAny(lower, "hadiah", "kado"):
		return "Hadiah"
	}

	return "Lainnya"
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
