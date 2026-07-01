"use client";

import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

interface VisitorGeoData {
  ip: string;
  isp: string;
  location: string;
  countryCode: string;
}

interface VisitorClientData {
  device: string;
  browser: string;
}

interface VisitorInfoRow {
  value: string;
  icon: string;
  expandOnly?: boolean;
}

const ANDROID_REGEX = /android/i;
const IPHONE_OR_IPOD_REGEX = /iphone|ipod/i;
const IPAD_REGEX = /ipad/i;
const TABLET_REGEX = /tablet/i;
const EDGE_VERSION_REGEX = /Edg\/(\d+)/i;
const OPERA_VERSION_REGEX = /OPR\/(\d+)/i;
const CHROME_VERSION_REGEX = /Chrome\/(\d+)/i;
const EDGE_OR_OPERA_REGEX = /Edg|OPR/i;
const FIREFOX_VERSION_REGEX = /Firefox\/(\d+)/i;
const SAFARI_REGEX = /Safari/i;
const CHROME_REGEX = /Chrome/i;
const IPV4_SEGMENT_REGEX = /^\d+$/;
const IPV6_SEGMENT_REGEX = /^[\dA-F]{1,4}$/i;
const IPV6_DOUBLE_COLON = "::";

export function VisitorInfoCard() {
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState("检测中");
  const [browser, setBrowser] = useState("检测中");
  const [ip, setIp] = useState("获取中");
  const [isp, setIsp] = useState("获取中");
  const [location, setLocation] = useState("正在定位访客来源");
  const [countryCode, setCountryCode] = useState("");
  const [visitTime, setVisitTime] = useState(() => formatVisitTime(new Date()));
  const [flagVisible, setFlagVisible] = useState(true);
  const [expand, setExpand] = useState(false);

  useEffect(() => {
    const client = detectClient();
    setDevice(client.device);
    setBrowser(client.browser);
    setVisitTime(formatVisitTime(new Date()));

    fetchVisitorGeo()
      .then((geo) => {
        if (geo) {
          setIp(geo.ip);
          setIsp(geo.isp);
          setLocation(geo.location);
          setCountryCode(geo.countryCode.toUpperCase());
        } else {
          setIp("暂无法获取");
          setIsp("网络信息不可用");
          setLocation("网络访客");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const subtitle = loading ? "检测中" : location || "网络访客";
  const flagSrc = countryCode ? `/images/flags/${countryCode}.svg` : "";
  const displayIp = expand ? ip : maskIpForCollapsedState(ip);

  const visitorRows = useMemo<VisitorInfoRow[]>(
    () => [
      { value: subtitle, icon: "tabler:world-pin" },
      { value: device, icon: "tabler:device-desktop", expandOnly: true },
      { value: displayIp, icon: "tabler:brand-socket-io" },
      { value: browser, icon: "tabler:browser" },
      { value: isp, icon: "tabler:building-skyscraper", expandOnly: true },
      { value: visitTime, icon: "tabler:clock-hour-4", expandOnly: true },
    ],
    [subtitle, device, displayIp, browser, isp, visitTime],
  );

  const visibleRows = visitorRows.filter((item) => expand || !item.expandOnly);

  function getItemTransitionStyle(index: number): React.CSSProperties {
    return { ["--visitor-pill-delay" as string]: `${index * 28}ms` } as React.CSSProperties;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2.5 z-30 flex justify-center">
      <div
        className={`pointer-events-auto cursor-default bg-background/30 p-1.5 px-3 shadow-[-1px_-1px_0_background,0_0_16px_rgba(0,0,0,0.05)] backdrop-blur-sm transition-[border-radius,transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          expand
            ? "rounded-lg -translate-y-1 bg-background/38 shadow-[-1px_-1px_0_background,0_10px_28px_rgba(0,0,0,0.08)]"
            : "rounded-xl"
        }`}
        onClick={() => setExpand((v) => !v)}
      >
        <div
          className={`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            expand
              ? "grid grid-cols-2 items-start justify-start gap-x-3 gap-y-2"
              : "flex flex-nowrap items-center justify-center gap-x-3 gap-y-1"
          }`}
        >
          {visibleRows.map((item, index) => (
            <div
              key={item.icon}
              className="flex min-w-0 items-center gap-1 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={getItemTransitionStyle(index)}
            >
              {item.icon === "tabler:world-pin" && flagSrc && flagVisible ? (
                <img
                  src={flagSrc}
                  alt={countryCode}
                  className="h-4 w-4 object-cover"
                  onError={() => setFlagVisible(false)}
                />
              ) : (
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-600">
                  <Icon icon={item.icon} width={14} height={14} />
                </div>
              )}
              <div
                className={`min-w-0 transition-[opacity,transform] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  expand || !index
                    ? "block opacity-100 translate-y-0"
                    : "hidden md:block md:opacity-100"
                }`}
              >
                {loading ? (
                  <div className="h-2 w-15 animate-pulse rounded-full bg-muted/70" />
                ) : (
                  <p className="max-w-30 truncate text-xs font-medium text-muted-foreground sm:max-w-50">
                    {item.value}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatVisitTime(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function maskIpForCollapsedState(value: string): string {
  return maskIpv4Address(value) ?? maskIpv6Address(value) ?? value;
}

function maskIpv4Address(value: string): string | null {
  const segments = value.split(".");
  if (segments.length !== 4 || segments.some((s) => !IPV4_SEGMENT_REGEX.test(s))) return null;
  const [first, second, third, fourth] = segments as [string, string, string, string];
  return [first, second, "*".repeat(third.length), fourth].join(".");
}

function maskIpv6Address(value: string): string | null {
  const percentIndex = value.indexOf("%");
  const address = percentIndex >= 0 ? value.slice(0, percentIndex) : value;
  const scope = percentIndex >= 0 ? value.slice(percentIndex + 1) : "";
  if (!address.includes(":") || address.includes(":::")) return null;

  const doubleColonCount = address.split(IPV6_DOUBLE_COLON).length - 1;
  if (doubleColonCount > 1) return null;

  const segments = address.split(":");
  if (segments.some((s, i) => !isValidIpv6Segment(s, i, segments))) return null;

  let maskedAddress = address;
  if (address.includes("::")) {
    const [prefix = ""] = address.split("::");
    const visibleSegments = prefix ? prefix.split(":").filter(Boolean).slice(0, 4) : [];
    maskedAddress = visibleSegments.length > 0 ? `${visibleSegments.join(":")}::*` : "::*";
  } else if (segments.length > 4) {
    maskedAddress = `${segments.slice(0, 4).join(":")}:*`;
  }
  return scope ? `${maskedAddress}%${scope}` : maskedAddress;
}

function isValidIpv6Segment(segment: string, index: number, segments: string[]): boolean {
  if (!segment) return true;
  if (segment.includes(".")) {
    return index === segments.length - 1 && maskIpv4Address(segment) !== null;
  }
  return IPV6_SEGMENT_REGEX.test(segment);
}

function detectClient(): VisitorClientData {
  if (typeof navigator === "undefined") return { device: "未知设备", browser: "未知浏览器" };
  const ua = navigator.userAgent;

  let detectedDevice = "桌面设备";
  if (ANDROID_REGEX.test(ua)) detectedDevice = "Android 手机";
  else if (IPHONE_OR_IPOD_REGEX.test(ua)) detectedDevice = "iPhone";
  else if (IPAD_REGEX.test(ua)) detectedDevice = "iPad";
  else if (TABLET_REGEX.test(ua)) detectedDevice = "平板电脑";

  let detectedBrowser = "未知浏览器";
  const edgeMatch = ua.match(EDGE_VERSION_REGEX);
  const operaMatch = ua.match(OPERA_VERSION_REGEX);
  const chromeMatch = ua.match(CHROME_VERSION_REGEX);
  const firefoxMatch = ua.match(FIREFOX_VERSION_REGEX);

  if (edgeMatch) detectedBrowser = "Edge";
  else if (operaMatch) detectedBrowser = "Opera";
  else if (chromeMatch && !EDGE_OR_OPERA_REGEX.test(ua)) detectedBrowser = "Chrome";
  else if (firefoxMatch) detectedBrowser = "Firefox";
  else if (SAFARI_REGEX.test(ua) && !CHROME_REGEX.test(ua)) detectedBrowser = "Safari";

  return { device: detectedDevice, browser: detectedBrowser };
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchVisitorGeo(): Promise<VisitorGeoData | null> {
  const loaders: (() => Promise<VisitorGeoData>)[] = [
    async () => {
      const data = await fetchJson<{
        ip?: string;
        isp?: string;
        organization?: string;
        asn_organization?: string;
        country?: string;
        country_code?: string;
        region?: string;
        city?: string;
      }>("https://api.ip.sb/geoip", 4000);
      if (!data.ip) throw new Error("ip.sb unavailable");
      return {
        ip: data.ip,
        isp: data.isp || data.organization || data.asn_organization || "未知运营商",
        location: [data.country, data.city || data.region].filter(Boolean).join(" · ") || "未知位置",
        countryCode: data.country_code || "",
      };
    },
    async () => {
      const data = await fetchJson<{
        success?: boolean;
        message?: string;
        ip?: string;
        country?: string;
        country_code?: string;
        region?: string;
        city?: string;
        connection?: { isp?: string; org?: string };
      }>("https://ipwho.is/", 4000);
      if (data.success === false || !data.ip) throw new Error(data.message || "ipwho.is unavailable");
      return {
        ip: data.ip,
        isp: data.connection?.isp || data.connection?.org || "未知运营商",
        location: [data.country, data.city || data.region].filter(Boolean).join(" · ") || "未知位置",
        countryCode: data.country_code || "",
      };
    },
    async () => {
      const data = await fetchJson<{
        ip?: string;
        company?: { name?: string };
        asn?: { org?: string; descr?: string; country?: string };
        datacenter?: { datacenter?: string; country?: string; region?: string; city?: string };
        location?: { country?: string; country_code?: string; state?: string; city?: string };
      }>("https://api.ipapi.is/", 4000);
      if (!data.ip) throw new Error("ipapi.is unavailable");
      return {
        ip: data.ip,
        isp:
          data.asn?.org ||
          data.company?.name ||
          data.datacenter?.datacenter ||
          data.asn?.descr ||
          "未知运营商",
        location:
          [
            data.location?.country || data.datacenter?.country,
            data.location?.city || data.location?.state || data.datacenter?.city || data.datacenter?.region,
          ]
            .filter(Boolean)
            .join(" · ") || "未知位置",
        countryCode:
          data.location?.country_code || data.asn?.country || data.datacenter?.country || "",
      };
    },
    async () => {
      const data = await fetchJson<{
        error?: boolean;
        reason?: string;
        ip?: string;
        org?: string;
        country_name?: string;
        country_code?: string;
        region?: string;
        city?: string;
      }>("https://ipapi.co/json/", 4000);
      if (data.error || !data.ip) throw new Error(data.reason || "ipapi unavailable");
      return {
        ip: data.ip,
        isp: data.org || "未知运营商",
        location: [data.country_name, data.city || data.region].filter(Boolean).join(" · ") || "未知位置",
        countryCode: data.country_code || "",
      };
    },
    async () => {
      const data = await fetchJson<{
        code: number;
        data?: {
          ip?: string;
          isp?: string;
          country?: string;
          province?: string;
          city?: string;
          countryCode?: string;
        };
      }>("https://api.vore.top/api/IPdata", 5000);
      if (data.code !== 0 || !data.data?.ip) throw new Error("vore unavailable");
      return {
        ip: data.data.ip,
        isp: data.data.isp || "未知运营商",
        location:
          [data.data.country, data.data.city || data.data.province].filter(Boolean).join(" · ") ||
          "未知位置",
        countryCode: data.data.countryCode || "",
      };
    },
  ];

  for (const load of loaders) {
    try {
      return await load();
    } catch {
      /* try next */
    }
  }
  return null;
}

export default VisitorInfoCard;