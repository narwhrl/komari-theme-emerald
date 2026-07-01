import dayjs from "dayjs";

/** 计费周期类型 */
export type BillingCycleType =
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual"
  | "biennial"
  | "triennial"
  | "quinquennial"
  | "once"
  | "custom";

/** 过期状态类型 */
export type ExpireStatus =
  | "expired"
  | "critical"
  | "warning"
  | "normal"
  | "long_term";

/** 支持的标签颜色 */
export type TagColor =
  | "ruby" | "gray" | "gold" | "bronze" | "brown" | "yellow" | "amber"
  | "orange" | "tomato" | "red" | "crimson" | "pink" | "plum" | "purple"
  | "violet" | "iris" | "indigo" | "blue" | "cyan" | "teal" | "jade"
  | "green" | "grass" | "lime" | "mint" | "sky";

export const TAG_COLORS = [
  "ruby", "gray", "gold", "bronze", "brown", "yellow", "amber",
  "orange", "tomato", "red", "crimson", "pink", "plum", "purple",
  "violet", "iris", "indigo", "blue", "cyan", "teal", "jade",
  "green", "grass", "lime", "mint", "sky",
] as const;

export const TAG_COLOR_HEX_MAP: Record<TagColor, string> = {
  ruby: "#E5484D", gray: "#8D8D8D", gold: "#E5C00D", bronze: "#C2853C",
  brown: "#AA6A38", yellow: "#F9D400", amber: "#F5B21A", orange: "#F97316",
  tomato: "#E54D2E", red: "#E5484D", crimson: "#E93D82", pink: "#E24D8C",
  plum: "#A855C2", purple: "#8E4EC6", violet: "#7C5DFA", iris: "#5B5BD6",
  indigo: "#6366F1", blue: "#0090FF", cyan: "#00A2C7", teal: "#12A594",
  jade: "#29A383", green: "#30A46C", grass: "#46A358", lime: "#84CC16",
  mint: "#4FD1C5", sky: "#00A6ED",
};

const BILLING_CYCLE_RANGES: Array<{ type: BillingCycleType; min: number; max: number }> = [
  { type: "monthly", min: 27, max: 32 },
  { type: "quarterly", min: 87, max: 95 },
  { type: "semi_annual", min: 175, max: 185 },
  { type: "annual", min: 360, max: 370 },
  { type: "biennial", min: 720, max: 750 },
  { type: "triennial", min: 1080, max: 1150 },
  { type: "quinquennial", min: 1800, max: 1850 },
];

const EXPIRE_THRESHOLDS = {
  critical: 7,
  warning: 15,
  long_term: 36500,
} as const;

const TAG_COLOR_SUFFIX_REGEX = /<(\w+)>$/;
const TAG_COLOR_SUFFIX_REMOVE_REGEX = /<\w+>$/;

export function parseBillingCycleType(billingCycle: number): BillingCycleType {
  if (billingCycle === -1) return "once";
  for (const range of BILLING_CYCLE_RANGES) {
    if (billingCycle >= range.min && billingCycle <= range.max) return range.type;
  }
  return "custom";
}

export function getBillingCycleText(
  billingCycle: number,
  lang: "zh-CN" | "en-US" = "zh-CN",
): string {
  const type = parseBillingCycleType(billingCycle);
  const texts: Record<BillingCycleType, Record<"zh-CN" | "en-US", string>> = {
    monthly: { "zh-CN": "月", "en-US": "Month" },
    quarterly: { "zh-CN": "季", "en-US": "Quarter" },
    semi_annual: { "zh-CN": "半年", "en-US": "Semi-Annual" },
    annual: { "zh-CN": "年", "en-US": "Year" },
    biennial: { "zh-CN": "两年", "en-US": "Biennial" },
    triennial: { "zh-CN": "三年", "en-US": "Triennial" },
    quinquennial: { "zh-CN": "五年", "en-US": "Quinquennial" },
    once: { "zh-CN": "一次性", "en-US": "Once" },
    custom: { "zh-CN": `${billingCycle} 天`, "en-US": `${billingCycle} Days` },
  };
  return texts[type][lang];
}

export function getDaysUntilExpired(expiredAt: string | number | undefined): number {
  if (!expiredAt) return 0;
  const expiredDate = dayjs(expiredAt);
  const now = dayjs();
  if (!expiredDate.isValid()) return 0;
  return Math.round(expiredDate.diff(now, "day", true));
}

export function getExpireStatus(expiredAt: string | number | undefined): ExpireStatus {
  const days = getDaysUntilExpired(expiredAt);
  if (days <= 0) return "expired";
  if (days < EXPIRE_THRESHOLDS.critical) return "critical";
  if (days < EXPIRE_THRESHOLDS.warning) return "warning";
  if (days > EXPIRE_THRESHOLDS.long_term) return "long_term";
  return "normal";
}

export function getExpireTextClass(expiredAt: string | number | undefined): string {
  const status = getExpireStatus(expiredAt);
  if (status === "expired" || status === "critical") return "text-destructive";
  if (status === "warning") return "text-yellow-600 dark:text-yellow-400";
  if (status === "long_term") return "text-muted-foreground";
  return "text-emerald-600 dark:text-emerald-400";
}

export function getExpireStatusColor(status: ExpireStatus): "error" | "warning" | "success" | "default" {
  switch (status) {
    case "expired":
    case "critical":
      return "error";
    case "warning":
      return "warning";
    case "normal":
    case "long_term":
      return "success";
    default:
      return "default";
  }
}

export function getExpireStatusHexColor(status: ExpireStatus): string {
  switch (status) {
    case "expired":
    case "critical":
      return TAG_COLOR_HEX_MAP.tomato;
    case "warning":
      return TAG_COLOR_HEX_MAP.orange;
    case "normal":
      return TAG_COLOR_HEX_MAP.green;
    case "long_term":
      return TAG_COLOR_HEX_MAP.gray;
    default:
      return TAG_COLOR_HEX_MAP.gray;
  }
}

export function getExpireText(expiredAt: string | number | undefined, lang: "zh-CN" | "en-US" = "zh-CN"): string {
  const days = getDaysUntilExpired(expiredAt);
  const status = getExpireStatus(expiredAt);
  if (status === "expired") return lang === "zh-CN" ? "已过期" : "Expired";
  if (status === "long_term") return lang === "zh-CN" ? "长期" : "Long-term";
  if (lang === "zh-CN") return `${days} 天`;
  return `${days} days`;
}

export function parseTagWithColor(tag: string): { text: string; color: TagColor | null } {
  const colorMatch = tag.match(TAG_COLOR_SUFFIX_REGEX);
  if (colorMatch && colorMatch[1]) {
    const colorCandidate = colorMatch[1].toLowerCase();
    const text = tag.replace(TAG_COLOR_SUFFIX_REMOVE_REGEX, "");
    if ((TAG_COLORS as readonly string[]).includes(colorCandidate)) {
      return { text, color: colorCandidate as TagColor };
    }
  }
  return { text: tag, color: null };
}

export function getTagColorHex(color: TagColor): string {
  return TAG_COLOR_HEX_MAP[color];
}

export function parseTags(tags: string | undefined): Array<{ text: string; color: TagColor; hex: string }> {
  if (!tags || tags.trim() === "") return [];
  const tagList = tags.split(";").filter((tag) => tag.trim() !== "");
  return tagList.map((tag, index) => {
    const { text, color } = parseTagWithColor(tag);
    const defaultColor = TAG_COLORS[index % TAG_COLORS.length] ?? "blue";
    const resolvedColor = color ?? defaultColor;
    return { text, color: resolvedColor, hex: getTagColorHex(resolvedColor) };
  });
}

export function formatPrice(price: number, currency: string = "￥", lang: "zh-CN" | "en-US" = "zh-CN"): string {
  if (price === 0) return lang === "zh-CN" ? "免费" : "Free";
  if (price === -1) return lang === "zh-CN" ? "免费" : "Free";
  return `${currency}${price}`;
}

export function formatPriceWithCycle(
  price: number,
  billingCycle: number,
  currency: string = "￥",
  lang: "zh-CN" | "en-US" = "zh-CN",
): string {
  const priceText = formatPrice(price, currency, lang);
  const cycleText = getBillingCycleText(billingCycle, lang);
  return `${priceText} / ${cycleText}`;
}

export function hasIPv4(ipv4: string | undefined | null): boolean {
  return !!ipv4 && ipv4.trim() !== "";
}

export function hasIPv6(ipv6: string | undefined | null): boolean {
  return !!ipv6 && ipv6.trim() !== "";
}