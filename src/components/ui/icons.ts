import {
  Baby,
  BookOpen,
  Brain,
  Briefcase,
  Bus,
  Car,
  Coffee,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  type LucideIcon,
  MoreHorizontal,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  Popcorn,
  Receipt,
  Repeat,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  Users,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react';

/**
 * Ícones que categorias e áreas podem usar. O dado salvo guarda só a chave,
 * para o servidor não depender da biblioteca de ícones.
 */
export const ICONS = {
  briefcase: Briefcase,
  laptop: Laptop,
  house: House,
  food: UtensilsCrossed,
  bus: Bus,
  car: Car,
  popcorn: Popcorn,
  health: HeartPulse,
  education: GraduationCap,
  piggy: PiggyBank,
  wallet: Wallet,
  bank: Landmark,
  receipt: Receipt,
  cart: ShoppingCart,
  gift: Gift,
  plane: Plane,
  pet: PawPrint,
  baby: Baby,
  shirt: Shirt,
  phone: Smartphone,
  energy: Zap,
  coffee: Coffee,
  game: Gamepad2,
  music: Music,
  repeat: Repeat,
  book: BookOpen,
  brain: Brain,
  dumbbell: Dumbbell,
  target: Target,
  people: Users,
  sparkles: Sparkles,
  more: MoreHorizontal,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;

export const ICON_KEYS = Object.keys(ICONS) as IconKey[];

/** Ícone de uma chave salva; chaves desconhecidas (versão mais nova do app) caem no genérico. */
export function iconFor(key: string): LucideIcon {
  return (ICONS as Record<string, LucideIcon>)[key] ?? MoreHorizontal;
}
