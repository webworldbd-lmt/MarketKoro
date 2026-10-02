/* Demo Data for MarketKoro Foundation Phase */

export const demoCategories = [
  { id: 'fashion', icon: '👕', name_bn: 'ফ্যাশন ও পোষাক', name_en: 'Fashion & Clothing' },
  { id: 'electronics', icon: '📱', name_bn: 'ইলেকট্রনিক্স', name_en: 'Electronics & Gadgets' },
  { id: 'groceries', icon: '🌾', name_bn: 'মুদি ও গ্রোসারী', name_en: 'Groceries & Foods' },
  { id: 'home', icon: '🏡', name_bn: 'হোম ও লিভিং', name_en: 'Home & Living' },
  { id: 'beauty', icon: '💄', name_bn: 'বিউটি ও কেয়ার', name_en: 'Beauty & Personal Care' },
  { id: 'crafts', icon: '🎨', name_bn: 'হস্তশিল্প ও দেশি পণ্য', name_en: 'Handicrafts & Heritage' },
];

export const demoFeaturedProducts = [
  {
    id: 'prod-1',
    title_bn: 'প্রিমিয়াম খাঁটি জামদানি শাড়ি - নীলগিরি ব্লু',
    title_en: 'Premium Pure Jamdani Saree - Nilgiri Blue',
    price: 4500,
    original_price: 5800,
    category_bn: 'ফ্যাশন',
    category_en: 'Fashion',
    image: 'assets/images/placeholder-product.svg',
    rating: 4.8,
    reviewsCount: 34,
    badge: 'Demo'
  },
  {
    id: 'prod-2',
    title_bn: 'হাতে বোনা খাঁটি টাঙ্গাইল কটন শাড়ি',
    title_en: 'Handloom Pure Tangail Cotton Saree',
    price: 1850,
    original_price: 2200,
    category_bn: 'ফ্যাশন',
    category_en: 'Fashion',
    image: 'assets/images/placeholder-product.svg',
    rating: 4.9,
    reviewsCount: 52,
    badge: 'Demo'
  },
  {
    id: 'prod-3',
    title_bn: 'স্মার্ট ওয়্যারলেস সাউন্ড বার উইথ সাবউফার',
    title_en: 'Smart Wireless Soundbar with Subwoofer',
    price: 3200,
    original_price: 4000,
    category_bn: 'ইলেকট্রনিক্স',
    category_en: 'Electronics',
    image: 'assets/images/placeholder-product.svg',
    rating: 4.6,
    reviewsCount: 19,
    badge: 'Demo'
  },
  {
    id: 'prod-4',
    title_bn: 'সুন্দরবনের খাঁটি প্রাকৃতিক মধু (১ কেজি)',
    title_en: 'Sundarbans Natural Honey (1 kg)',
    price: 1100,
    original_price: 1350,
    category_bn: 'গ্রোসারী',
    category_en: 'Groceries',
    image: 'assets/images/placeholder-product.svg',
    rating: 5.0,
    reviewsCount: 120,
    badge: 'Demo'
  }
];

export const demoPopularProducts = [
  {
    id: 'prod-5',
    title_bn: 'অর্গানিক খাঁটি সরিষার তেল (৫ লিটার)',
    title_en: 'Organic Pure Mustard Oil (5 Liters)',
    price: 1250,
    original_price: 1400,
    category_bn: 'গ্রোসারী',
    category_en: 'Groceries',
    image: 'assets/images/placeholder-product.svg',
    rating: 4.7,
    reviewsCount: 88,
    badge: 'Demo'
  },
  {
    id: 'prod-6',
    title_bn: 'স্মার্ট ওয়াচ প্রো - বিডি এডিশন',
    title_en: 'Smartwatch Pro - BD Edition',
    price: 2450,
    original_price: 3100,
    category_bn: 'ইলেকট্রনিক্স',
    category_en: 'Electronics',
    image: 'assets/images/placeholder-product.svg',
    rating: 4.5,
    reviewsCount: 42,
    badge: 'Demo'
  },
  {
    id: 'prod-7',
    title_bn: 'ঐতিহ্যবাহী নকশী কাঁথা (হাতে সেলাই)',
    title_en: 'Traditional Nakshi Kantha (Handcrafted)',
    price: 2800,
    original_price: 3500,
    category_bn: 'হস্তশিল্প',
    category_en: 'Crafts',
    image: 'assets/images/placeholder-product.svg',
    rating: 4.9,
    reviewsCount: 61,
    badge: 'Demo'
  },
  {
    id: 'prod-8',
    title_bn: 'অরিজিনাল জেনুইন লেদার ওয়ালেট',
    title_en: 'Original Genuine Leather Wallet',
    price: 950,
    original_price: 1200,
    category_bn: 'ফ্যাশন',
    category_en: 'Fashion',
    image: 'assets/images/placeholder-product.svg',
    rating: 4.8,
    reviewsCount: 29,
    badge: 'Demo'
  }
];

export const demoSellers = [
  {
    id: 'seller-1',
    name: 'ঢাকা তাত ঘর (Dhaka Taat Ghor)',
    location_bn: 'ঢাকা',
    location_en: 'Dhaka',
    logo: 'assets/images/placeholder-store.svg',
    productsCount: 142,
    rating: 4.9,
    verified: true
  },
  {
    id: 'seller-2',
    name: 'রংপুর অর্গানিক ফার্ম (Rangpur Organic)',
    location_bn: 'রংপুর',
    location_en: 'Rangpur',
    logo: 'assets/images/placeholder-store.svg',
    productsCount: 85,
    rating: 4.8,
    verified: true
  },
  {
    id: 'seller-3',
    name: 'চট্টগ্রাম গ্যাজেট প্লাস (CTG Gadgets)',
    location_bn: 'চট্টগ্রাম',
    location_en: 'Chattogram',
    logo: 'assets/images/placeholder-store.svg',
    productsCount: 210,
    rating: 4.7,
    verified: true
  },
  {
    id: 'seller-4',
    name: 'সিলেট ক্রাফটস এন্ড টি (Sylhet Crafts)',
    location_bn: 'সিলেট',
    location_en: 'Sylhet',
    logo: 'assets/images/placeholder-store.svg',
    productsCount: 64,
    rating: 4.9,
    verified: true
  }
];
