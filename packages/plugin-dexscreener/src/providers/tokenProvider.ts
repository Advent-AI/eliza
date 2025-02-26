import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";

/*
interface TokenPriceData {
    baseToken: {
        name: string;
        symbol: string;
        address: string;
        decimals: number;
    };
    priceUsd: string;
    priceChange: {
        h1: number;
        h24: number;
    };
    liquidityUsd: string;
    volume: {
        h24: number;
    };
}
*/

interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    labels: string[];
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        m5: { buys: number; sells: number };
        h1: { buys: number; sells: number };
        h6: { buys: number; sells: number };
        h24: { buys: number; sells: number };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    priceChange: Record<string, unknown>;
    liquidity: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv: number;
    marketCap: number;
    pairCreatedAt: number;
}

export class TokenPriceProvider implements Provider {
    async get(
        _lengthruntime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string> {
        try {
            const content =
                typeof message.content === "string"
                    ? message.content
                    : message.content?.text;

            if (!content) {
                throw new Error("No message content provided");
            }

            // Extract token from content
            const tokenIdentifier = this.extractToken(content);
            if (!tokenIdentifier) {
                throw new Error("Could not identify token in message");
            }

            console.log(`Fetching price for token: ${tokenIdentifier}`);

            // Make API request
            const isAddress =
                /^0x[a-fA-F0-9]{40}$/.test(tokenIdentifier) ||
                /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(tokenIdentifier); // validates for ethAddress and solAddress
            const endpoint = isAddress
                ? `https://api.dexscreener.com/latest/dex/tokens/${tokenIdentifier}`
                : `https://api.dexscreener.com/latest/dex/search?q=${tokenIdentifier}`;

            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.pairs || data.pairs.length === 0) {
                throw new Error(`No pricing data found for ${tokenIdentifier}`);
            }

            console.log("[plugin-dexscreener] Data:", data);

            // Get best pair by liquidity
            const bestPair = this.getBestPair(data.pairs);

            console.log("[plugin-dexscreener] Best pair:", bestPair);

            return this.formatPriceData(bestPair);
        } catch (error) {
            console.error("TokenPriceProvider error:", error);
            return `Error: ${error.message}`;
        }
    }

    private extractToken(content: string): string | null {
        // Try different patterns in order of specificity
        const patterns = [
            /0x[a-fA-F0-9]{40}/, // ETH address
            /[$#]([a-zA-Z0-9]+)/, // $TOKEN or #TOKEN
            /(?:price|value|worth|cost)\s+(?:of|for)\s+([a-zA-Z0-9]+)/i, // "price of TOKEN"
            /\b(?:of|for)\s+([a-zA-Z0-9]+)\b/i, // "of TOKEN"
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                // Use captured group if it exists, otherwise use full match
                const token = match[1] || match[0];
                // Clean up the token identifier
                return token.replace(/[$#]/g, "").toLowerCase().trim();
            }
        }

        return null;
    }

    private getBestPair(pairs: DexScreenerPair[]): DexScreenerPair {
        return pairs.reduce((best, current) => {
            const bestLiquidity = best.liquidity?.usd || 0;
            const currentLiquidity = current.liquidity?.usd || 0;
            return currentLiquidity > bestLiquidity ? current : best;
        }, pairs[0]);
    }

    private formatPriceData(pair: DexScreenerPair): string {
        try {
            // Smart number formatting utilities
            const formatNumber = {
                // Format price with adaptive precision
                price: (val: number | string | undefined | null): string => {
                    if (!val) return "$0.00";
                    const num = Number(val);
                    if (isNaN(num)) return "$0.00";

                    if (num < 0.00001) return "<$0.00001";
                    if (num < 1) return "$" + num.toFixed(6);
                    if (num < 100) return "$" + num.toFixed(2);
                    return "$" + num.toFixed(2);
                },

                // Format large numbers with K, M, B, T
                compact: (val: number | undefined | null): string => {
                    if (!val) return "0";
                    const num = Number(val);
                    if (isNaN(num)) return "0";

                    const absNum = Math.abs(num);
                    if (absNum >= 1e12) return (num / 1e12).toFixed(2) + "T";
                    if (absNum >= 1e9) return (num / 1e9).toFixed(2) + "B";
                    if (absNum >= 1e6) return (num / 1e6).toFixed(2) + "M";
                    if (absNum >= 1e3) return (num / 1e3).toFixed(2) + "K";
                    return num.toLocaleString();
                },

                // Format percentages
                percent: (val: number | undefined | null): string => {
                    if (!val) return "0%";
                    const num = Number(val);
                    if (isNaN(num)) return "0%";

                    if (Math.abs(num) < 0.01) return "<0.01%";
                    return num.toFixed(2) + "%";
                },
            };

            // Safe getters with fallbacks
            const safeGet = {
                string: (val: string | undefined | null) => val || "N/A",
                date: (timestamp: number | undefined | null) => {
                    try {
                        return timestamp
                            ? new Date(timestamp).toLocaleDateString()
                            : "N/A";
                    } catch {
                        return "N/A";
                    }
                },
                array: (arr: any[] | undefined | null) =>
                    arr && Array.isArray(arr) && arr.length > 0
                        ? arr.join(", ")
                        : "None",
                token: (
                    token:
                        | { name?: string; symbol?: string; address?: string }
                        | undefined
                        | null
                ) => ({
                    name: token?.name || "Unknown",
                    symbol: token?.symbol || "N/A",
                    address: token?.address || "N/A",
                }),
                txns: (
                    txns: { buys?: number; sells?: number } | undefined | null
                ) => ({
                    buys: txns?.buys || 0,
                    sells: txns?.sells || 0,
                }),
            };

            const baseToken = safeGet.token(pair?.baseToken);
            const quoteToken = safeGet.token(pair?.quoteToken);
            const h24Txns = safeGet.txns(pair?.txns?.h24);

            const totalTxns = h24Txns.buys + h24Txns.sells;
            const buyRatio =
                totalTxns > 0 ? (h24Txns.buys / totalTxns) * 100 : 0;

            return `${baseToken.symbol}/${
                quoteToken.symbol
            } on ${safeGet.string(pair?.dexId)} (${safeGet.string(
                pair?.chainId
            )})
📍 Pair: ${safeGet.string(pair?.pairAddress)}
💰 Price: ${formatNumber.price(pair?.priceUsd)}
💧 Liquidity: ${formatNumber.price(
                pair?.liquidity?.usd
            )} (${formatNumber.compact(pair?.liquidity?.usd)})
📊 24h Volume: ${formatNumber.price(pair?.volume?.h24)} (${formatNumber.compact(
                pair?.volume?.h24
            )})
📈 Market Cap: ${formatNumber.price(pair?.marketCap)} (${formatNumber.compact(
                pair?.marketCap
            )})
🌐 FDV: ${formatNumber.price(pair?.fdv)} (${formatNumber.compact(pair?.fdv)})

24h Transactions:
🟢 Buys: ${formatNumber.compact(h24Txns.buys)}
🔴 Sells: ${formatNumber.compact(h24Txns.sells)}
📊 Buy Ratio: ${formatNumber.percent(buyRatio)}

Additional Info:
🏷️ Labels: ${safeGet.array(pair?.labels)}
📅 Pair Created: ${safeGet.date(pair?.pairCreatedAt)}
🔗 More Info: ${safeGet.string(pair?.url)}

Token Details:
${baseToken.name} (${baseToken.symbol}): ${baseToken.address}
${quoteToken.name} (${quoteToken.symbol}): ${quoteToken.address}`;
        } catch (error) {
            console.error("Error formatting price data:", error);
            return "Error: Unable to format price data. Please try again later.";
        }
    }
}

export const tokenPriceProvider = new TokenPriceProvider();
