export interface SeedProfile {
  id: string
  name: string
  age: number
  gender: 'Nam' | 'Nữ'
  church: string
  area: string
  bio: string
  interests: string[]
  avatarUrl: string
  likesBack: boolean
}

export const SEED_PROFILES: SeedProfile[] = [
  {
    id: 'seed-thao-anh',
    name: 'Thảo Anh',
    age: 27,
    gender: 'Nữ',
    church: 'Hội Thánh Tin Lành Sài Gòn',
    area: 'TP. Hồ Chí Minh',
    bio: 'Sáng đi làm marketing, tối ôm đàn guitar tập hát thánh ca. Đang học cách chậm lại và lắng nghe Chúa mỗi sáng. Rất vui được làm quen!',
    interests: ['Thờ phượng', 'Âm nhạc', 'Cà phê'],
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    likesBack: false,
  },
  {
    id: 'seed-minh-duc',
    name: 'Minh Đức',
    age: 30,
    gender: 'Nam',
    church: 'Hội Thánh Phước Bình',
    area: 'TP. Hồ Chí Minh',
    bio: 'Kỹ sư cầu đường, mê chạy bộ buổi sáng và chụp ảnh đường phố. Tin rằng đức tin phải thể hiện qua việc làm cụ thể.',
    interests: ['Đọc Kinh Thánh', 'Thể thao', 'Nhiếp ảnh'],
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    likesBack: true,
  },
  {
    id: 'seed-lan-huong',
    name: 'Lan Hương',
    age: 25,
    gender: 'Nữ',
    church: 'Chi Hội Đà Nẵng',
    area: 'Đà Nẵng',
    bio: 'Giáo viên mầm non, yêu trẻ con và những chuyến đi biển. Nấu ăn là cách mình bày tỏ tình yêu thương.',
    interests: ['Hát thánh ca', 'Du lịch', 'Nấu ăn'],
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    likesBack: false,
  },
  {
    id: 'seed-quang-huy',
    name: 'Quang Huy',
    age: 33,
    gender: 'Nam',
    church: 'Hội Thánh Tin Lành Hà Nội',
    area: 'Hà Nội',
    bio: 'Làm nhân sự, cuối tuần hay đi thiện nguyện vùng cao. Đang đọc "Đắc Nhân Tâm" lần thứ ba và sách Rô-ma thì không nhớ nổi lần thứ mấy.',
    interests: ['Truyền giáo', 'Thiện nguyện', 'Đọc sách'],
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
    likesBack: true,
  },
  {
    id: 'seed-my-duyen',
    name: 'Mỹ Duyên',
    age: 29,
    gender: 'Nữ',
    church: 'Hội Thánh Phước Bình',
    area: 'TP. Hồ Chí Minh',
    bio: 'Designer tự do, nghiện cà phê muối và nhạc acoustic. Muốn dùng tài năng sáng tạo để phục vụ Hội Thánh.',
    interests: ['Thiện nguyện', 'Cà phê', 'Âm nhạc'],
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    likesBack: false,
  },
  {
    id: 'seed-tuan-kiet',
    name: 'Tuấn Kiệt',
    age: 35,
    gender: 'Nam',
    church: 'Chi Hội Cần Thơ',
    area: 'Cần Thơ',
    bio: 'Chủ quán cơm chay nhỏ ở Cần Thơ. Đá banh chiều thứ bảy, Chúa nhật đi nhóm. Đơn giản, chân thành, thích nấu ăn cho người mình thương.',
    interests: ['Thể thao', 'Du lịch', 'Nấu ăn'],
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80',
    likesBack: true,
  },
  {
    id: 'seed-hong-nhung',
    name: 'Hồng Nhung',
    age: 26,
    gender: 'Nữ',
    church: 'Hội Thánh Tin Lành Sài Gòn',
    area: 'TP. Hồ Chí Minh',
    bio: 'Biên tập viên sách, mê chụp film và những buổi chiều mưa đọc Thi Thiên. Đang tìm người cùng đi bộ đường dài, cả nghĩa đen lẫn nghĩa bóng.',
    interests: ['Đọc Kinh Thánh', 'Nhiếp ảnh', 'Đọc sách'],
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
    likesBack: false,
  },
  {
    id: 'seed-gia-bao',
    name: 'Gia Bảo',
    age: 38,
    gender: 'Nam',
    church: 'Hội Thánh Phước Bình',
    area: 'TP. Hồ Chí Minh',
    bio: 'Từng làm IT, giờ về quê trồng sầu riêng và sống chậm. Tin Chúa có chương trình tốt lành cho mỗi người, kể cả chuyện tình cảm.',
    interests: ['Truyền giáo', 'Thờ phượng', 'Thể thao'],
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
    likesBack: true,
  },
]
