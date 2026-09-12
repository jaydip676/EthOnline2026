"use client";

import { useMemo, useState } from "react";
import { encodeFunctionData, maxUint256, zeroAddress } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";
import { ConnectGate } from "@/components/connect-gate";
import { DataRow } from "@/components/data-row";
import { PageHeader } from "@/components/page-header";
import { RangeBar } from "@/components/range-bar";
import { TxProgress, type ProgressStep } from "@/components/tx-progress";
import { WizardSteps } from "@/components/wizard-steps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { aquaAbi, erc20Abi, gridManagerAbi, lensAbi } from "@/lib/abi";
import {
  AQUA,
  GRID_MANAGER,
  LENS,
  ORACLE,
  ROUTER,
  TREASURY,
  USDC_TOKEN,
  WETH_TOKEN,
  isDeployed,
} from "@/lib/addresses";
import { formatToken, formatUsd } from "@/lib/format";
import {
  DEFAULT_COVERAGE_BPS,
  DEFAULT_PROTOCOL_FEE,
  DEFAULT_STALENESS,
  mulBps,
  previewGrid,
  worstCaseInventory,
  type Mode,
  type Tier,
} from "@/lib/grid";
import { runIntent, type IntentCall } from "@/lib/intent";
import { encodeOrder, nextSalt, type SwapVMOrder } from "@/lib/strategy";
import { USDC, WETH } from "@/lib/tokens";
import { toastTxErr, toastTxOk } from "@/lib/tx";

const MODE_LABEL: Record<Mode, string> = { 0: "Grid", 1: "Buy ladder", 2: "Sell ladder" };
const TIER_LABEL: Record<Tier, string> = { 0: "Flexible", 1: "Committed" };

export function GridWizard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [commit, setCommit] = useState(20);
  const [range, setRange] = useState(6);
  const [envelope, setEnvelope] = useState(10);
  const [rungs, setRungs] = useState(8);
  const [mode, setMode] = useState<Mode>(0);
  const [tier, setTier] = useState<Tier>(0);
  const [busy, setBusy] = useState(false);
  const [currentId, setCurrentId] = useState<string>();
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [batched, setBatched] = useState(false);

  const { data: wethBal } = useReadContract({
    address: WETH_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: usdcBal } = useReadContract({
    address: USDC_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: oracleTuple } = useReadContract({
    address: LENS,
    abi: lensAbi,
    functionName: "oraclePrice",
    args: [ORACLE === zeroAddress ? WETH_TOKEN : ORACLE],
    query: { enabled: isDeployed() && ORACLE !== zeroAddress },
  });

  const spot = oracleTuple?.[0] && oracleTuple[0] > 0n ? oracleTuple[0] : 2500n * 10n ** 18n;
  const preview = useMemo(
    () => previewGrid(spot, range * 100, envelope * 100, rungs),
    [spot, range, envelope, rungs],
  );
  const ethBal = wethBal ?? 0n;
  const usdBal = usdcBal ?? 0n;
  const ethCap = mulBps(ethBal, commit * 100);
  const usdcCap = mulBps(usdBal, commit * 100);
  const worst = worstCaseInventory(ethBal, usdBal, commit * 100, rungs, spot);
  const spendableEth = ethBal - (tier === 1 ? ethCap : 0n);
  const spendableUsdc = usdBal - (tier === 1 ? usdcCap : 0n);

  const steps: ProgressStep[] = [
    { id: "approve", label: "Approve Aqua", hint: "One allowance. Tokens stay in the wallet." },
    { id: "ship", label: `Ship ${rungs} rungs`, hint: "N Aqua.ship calls. Zero transfers." },
    { id: "register", label: "Register grid", hint: "Index for the lens and the resolver." },
  ];

  async function onStart() {
    if (!address || !publicClient || !walletClient) return;
    if (!isDeployed()) {
      toastTxErr(new Error("Contracts are not deployed yet. Run the Foundry script first."));
      return;
    }
    setBusy(true);
    setDoneIds([]);
    setCurrentId("approve");
    try {
      const params = {
        maker: address,
        weth: WETH_TOKEN,
        usdc: USDC_TOKEN,
        oracle: ORACLE,
        treasury: TREASURY === zeroAddress ? address : TREASURY,
        aqua: AQUA,
        spot,
        rangeBps: range * 100,
        envelopeBps: envelope * 100,
        rungCount: rungs,
        maxShareBps: commit * 100,
        minCoverageBps: DEFAULT_COVERAGE_BPS,
        protocolFeeBps: DEFAULT_PROTOCOL_FEE,
        maxStaleness: DEFAULT_STALENESS,
        wethDecimals: WETH.decimals,
        usdcDecimals: USDC.decimals,
        mode,
        tier,
        saltNonce: nextSalt(),
        ethCap,
        usdcCap,
      };

      const previewOnchain = await publicClient.readContract({
        address: GRID_MANAGER,
        abi: gridManagerAbi,
        functionName: "previewGrid",
        args: [params],
      });
      const hashes = [...previewOnchain[1]];

      const calls: IntentCall[] = [
        {
          id: "approve-weth",
          label: "Approve WETH",
          to: WETH_TOKEN,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [AQUA, maxUint256],
          }),
        },
        {
          id: "approve-usdc",
          label: "Approve USDC",
          to: USDC_TOKEN,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [AQUA, maxUint256],
          }),
        },
      ];

      for (let i = 0; i < rungs; i++) {
        const order = (await publicClient.readContract({
          address: GRID_MANAGER,
          abi: gridManagerAbi,
          functionName: "buildRungOrder",
          args: [params, BigInt(i)],
        })) as SwapVMOrder;
        calls.push({
          id: `ship-${i}`,
          label: `Ship rung ${i + 1}`,
          to: AQUA,
          data: encodeFunctionData({
            abi: aquaAbi,
            functionName: "ship",
            args: [ROUTER, encodeOrder(order), [WETH_TOKEN, USDC_TOKEN], [ethCap, usdcCap]],
          }),
        });
      }

      calls.push({
        id: "register",
        label: "Register grid",
        to: GRID_MANAGER,
        data: encodeFunctionData({
          abi: gridManagerAbi,
          functionName: "registerGrid",
          args: [WETH_TOKEN, USDC_TOKEN, hashes, params],
        }),
      });

      const result = await runIntent(publicClient, walletClient, calls, (id) => {
        setCurrentId(id.startsWith("ship") ? "ship" : id.startsWith("approve") ? "approve" : "register");
        if (id.startsWith("approve")) setDoneIds((d) => (d.includes("approve") ? d : [...d, "approve"]));
        if (id.startsWith("ship")) setDoneIds((d) => (d.includes("approve") ? d : [...d, "approve"]));
      });
      setBatched(result.batched);
      setDoneIds(["approve", "ship", "register"]);
      setCurrentId(undefined);
      toastTxOk("Grid is live", `${rungs} rungs shipped. Tokens never left the wallet.`, result.hashes.at(-1));
    } catch (error) {
      toastTxErr(error);
      setCurrentId(undefined);
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <ConnectGate
        title="Connect to start a grid"
        description="Approve Aqua once, ship N rungs, register. The coins stay in the wallet."
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <PageHeader
          eyebrow="Setup"
          title="Start a grid"
          description="Commit is a live share of the wallet, not a frozen number. Spend, and every rung halves itself."
        />

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Wallet</CardTitle>
              <CardDescription>Rungs quote only while the real balance can pay.</CardDescription>
            </CardHeader>
            <CardContent className="divide-rule">
              <DataRow label="WETH" value={<span className="num">{formatToken(ethBal, 18, 4)}</span>} />
              <DataRow label="USDC" value={<span className="num">{formatToken(usdBal, 6, 2)}</span>} />
              <DataRow
                label="Spendable now"
                hint="Committed keeps this as headroom above the grid. Flexible lets you spend anything — rungs just get smaller."
                value={
                  <span className="num">
                    {formatToken(spendableEth, 18, 4)} ETH · {formatToken(spendableUsdc, 6, 2)} USDC
                  </span>
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shape</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <SliderField
                label="Commit"
                value={commit}
                min={5}
                max={50}
                suffix={` ${commit}% of the wallet`}
                onChange={setCommit}
              />
              <SliderField
                label="Range"
                value={range}
                min={2}
                max={15}
                suffix={` ±${range}% around Chainlink`}
                onChange={setRange}
              />
              <SliderField
                label="Envelope"
                value={envelope}
                min={range + 1}
                max={25}
                suffix={` ±${envelope}% — outside this, every rung stops`}
                onChange={setEnvelope}
              />
              <SliderField label="Rungs" value={rungs} min={4} max={16} suffix={` ${rungs} levels`} onChange={setRungs} />

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Mode</Label>
                  <div className="flex flex-wrap gap-2">
                    {([0, 1, 2] as Mode[]).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={mode === value ? "default" : "outline"}
                        onClick={() => setMode(value)}
                      >
                        {MODE_LABEL[value]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Reliability tier</Label>
                  <div className="flex flex-wrap gap-2">
                    {([0, 1] as Tier[]).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={tier === value ? "default" : "outline"}
                        onClick={() => setTier(value)}
                      >
                        {TIER_LABEL[value]}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tier === 0
                      ? "Spend anytime. Takers price the uncertainty into a wider spread."
                      : "Keep reserve headroom. The lens marks the grid reserve-backed."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ladder preview</CardTitle>
              <CardDescription>
                Spot {formatUsd(spot)} · round trip {preview.roundTripBps.toFixed(1)} bps · fee 5 bps
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <RangeBar
                min={Number(preview.floor) / 1e18}
                max={Number(preview.ceiling) / 1e18}
                spot={Number(spot) / 1e18}
                unit="ETH/USD"
              />
              <ol className="grid gap-1.5">
                {preview.levels.map((level, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-[13px]">
                    <span className="text-muted-foreground">Rung {i + 1}</span>
                    <span className="num">
                      bid {formatUsd(preview.bids[i]!)} · {formatUsd(level)} · ask {formatUsd(preview.asks[i]!)}
                    </span>
                  </li>
                ))}
              </ol>
              <Alert variant="warning">
                <AlertTitle>A grid buys the dip by design</AlertTitle>
                <AlertDescription>
                  Worst-case inventory at the bottom of the range is about{" "}
                  <span className="num font-medium">{formatToken(worst.worstEth, 18, 3)} ETH</span> if every bid
                  fills. The envelope bounds this; it does not remove it.
                </AlertDescription>
              </Alert>
              <Button size="lg" className="w-full" onClick={() => void onStart()} loading={busy} disabled={busy}>
                Start
              </Button>
              {busy || doneIds.length > 0 ? (
                <TxProgress steps={steps} currentId={currentId} doneIds={doneIds} batched={batched} />
              ) : null}
              {!isDeployed() ? (
                <p className="text-xs text-muted-foreground">
                  Router address is still zero. Deploy with Foundry, then Start will ship for real.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>On-chain</CardTitle>
            <CardDescription>Same contracts, three layouts.</CardDescription>
          </CardHeader>
          <CardContent>
            <WizardSteps
              current={0}
              steps={[
                { title: "Approve Aqua", hint: "Global allowance. Revoke turns off every Aqua position." },
                { title: "Ship rungs", hint: "Maker-only. Balance unchanged." },
                { title: "Register", hint: "Lens and the resolver enumerate from here." },
              ]}
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-[13px] text-muted-foreground">{suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0] ?? value)} />
    </div>
  );
}
