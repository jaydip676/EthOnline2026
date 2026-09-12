import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatToken } from "@/lib/format";
import { tokenByAddress, tokenBySymbol, USDC, WETH, type TokenMeta } from "@/lib/tokens";

export type TokenSize = "xs" | "sm" | "md" | "lg";

const SIZE: Record<TokenSize, string> = {
  xs: "size-4",
  sm: "size-5",
  md: "size-7",
  lg: "size-9",
};

export function resolveToken(token?: TokenMeta | string): TokenMeta | undefined {
  if (!token) return undefined;
  if (typeof token !== "string") return token;
  return tokenBySymbol(token) ?? tokenByAddress(token);
}

export function TokenAvatar({
  token,
  symbol,
  size = "md",
  className,
}: {
  token?: TokenMeta | string;
  /** @deprecated pass `token` */
  symbol?: string;
  accent?: string;
  size?: TokenSize;
  className?: string;
}) {
  const resolved = resolveToken(token ?? symbol);
  const label = resolved?.symbol ?? symbol ?? "token";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-full bg-muted shadow-[0_0_0_1px_rgba(2,48,71,0.08)]",
        SIZE[size],
        className,
      )}
      title={resolved ? `${resolved.name} (${resolved.symbol})` : label}
    >
      {resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolved.icon} alt="" width={36} height={36} className="size-full" />
      ) : (
        <span className="grid size-full place-items-center text-[9px] font-semibold text-muted-foreground">
          {label.slice(0, 2)}
        </span>
      )}
    </span>
  );
}

export function TokenPair({
  size = "sm",
  className,
  ringClassName = "ring-background",
}: {
  size?: TokenSize;
  className?: string;
  ringClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center", className)} title="WETH / USDC on Base">
      <TokenAvatar token={WETH} size={size} />
      <TokenAvatar token={USDC} size={size} className={cn("-ml-1.5 ring-2", ringClassName)} />
    </span>
  );
}

export function TokenLabel({
  token,
  size = "xs",
  className,
  children,
}: {
  token: TokenMeta | string;
  size?: TokenSize;
  className?: string;
  children?: ReactNode;
}) {
  const resolved = resolveToken(token);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <TokenAvatar token={resolved ?? token} size={size} />
      <span>{children ?? resolved?.symbol ?? String(token)}</span>
    </span>
  );
}

export function TokenAmount({
  token,
  amount,
  digits,
  size = "xs",
  className,
  showSymbol = true,
}: {
  token: TokenMeta | string;
  amount: bigint | undefined;
  digits?: number;
  size?: TokenSize;
  className?: string;
  showSymbol?: boolean;
}) {
  const resolved = resolveToken(token) ?? WETH;
  return (
    <span className={cn("inline-flex items-center gap-1.5 num", className)}>
      <TokenAvatar token={resolved} size={size} />
      <span>
        {formatToken(amount, resolved.decimals, digits ?? (resolved.decimals === 6 ? 2 : 4))}
        {showSymbol ? ` ${resolved.symbol}` : null}
      </span>
    </span>
  );
}

export function TokenBalanceRow({
  token,
  amount,
  digits,
}: {
  token: TokenMeta;
  amount: bigint | undefined;
  digits?: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <TokenAvatar token={token} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{token.name}</p>
        <p className="text-[11px] text-muted-foreground">{token.symbol}</p>
      </div>
      <p className="num text-[13px] font-semibold tabular-nums">
        {formatToken(amount, token.decimals, digits ?? (token.decimals === 6 ? 2 : 4))}
      </p>
    </div>
  );
}
