export interface Sticker {
  key: string
  label: string
  src: string
}

export const STICKERS: Sticker[] = [
  { key: 'da-qua-hai-oi', label: 'Đã quá hai ơi', src: '/stickers/da-qua-hai-oi.png' },
  { key: 'ngoan-xinh-iu', label: 'Ngoan xinh iu', src: '/stickers/ngoan-xinh-iu.png' },
  { key: 'xi-lay', label: 'Xỉ lầy', src: '/stickers/xi-lay.png' },
  { key: 'loi-tui', label: 'Lỗi tui', src: '/stickers/loi-tui.png' },
  { key: 'thoi-lua-len', label: 'Thôi lửa lên', src: '/stickers/thoi-lua-len.png' },
  { key: 'da-he', label: 'Đã he', src: '/stickers/da-he.png' },
  { key: 'pho-chiu-vo-cung', label: 'Phó chịu vô cùng', src: '/stickers/pho-chiu-vo-cung.png' },
  { key: 'cum-diu', label: 'Cũm dịu', src: '/stickers/cum-diu.png' },
  { key: 'ua-alo', label: 'ỦA ALO', src: '/stickers/ua-alo.png' },
  { key: 'iu-cau', label: 'Iu cậu', src: '/stickers/iu-cau.png' },
  { key: 'rot-nao', label: 'Rớt não', src: '/stickers/rot-nao.png' },
  { key: 'em-chi-coi-anh', label: 'Em chỉ coi anh', src: '/stickers/em-chi-coi-anh.png' },
  { key: 'cho-na', label: 'Cho nà', src: '/stickers/cho-na.png' },
  { key: 'cuoi-ha-ha', label: 'Cười ha ha', src: '/stickers/cuoi-ha-ha.png' },
  { key: 'dau-o-day-nay', label: 'Đau ở đây này', src: '/stickers/dau-o-day-nay.png' },
  { key: 'bim', label: 'Bỉm', src: '/stickers/bim.png' },
]

export function getStickerSrc(key: string): string | null {
  const sticker = STICKERS.find((s) => s.key === key)
  return sticker ? sticker.src : null
}
