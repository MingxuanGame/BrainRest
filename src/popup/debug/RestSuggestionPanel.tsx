import { useCallback, useState } from "react";
import { buildRestSuggestion } from "../../background/engine/RestSuggestion";
import type { BRIResult } from "../../background/engine/types";
import type { RestSuggestion } from "../../models/RestSuggestion";
import { sampleBriResults } from "../../data/bri-samples";

/* ------------------------------------------------------------------ */
/* 输出状态                                                            */
/* ------------------------------------------------------------------ */

type Output =
    | { kind: "suggestion"; value: RestSuggestion }
    | { kind: "null" }
    | { kind: "error"; message: string };

/* ------------------------------------------------------------------ */
/* 休息建议生成面板                                                    */
/* ------------------------------------------------------------------ */

/**
 * 载入样例或手动编辑 BRIResult(JSON)，走 buildRestSuggestion 真实生成路径，
 * 展示 RestSuggestion 输出。
 */
export default function RestSuggestionPanel() {
    const [expanded, setExpanded] = useState(false);
    const [json, setJson] = useState("");
    const [output, setOutput] = useState<Output | null>(null);

    const loadSample = useCallback((result: BRIResult) => {
        setJson(JSON.stringify(result, null, 2));
        setOutput(null);
    }, []);

    const generate = useCallback(() => {
        let parsed: BRIResult;
        try {
            parsed = JSON.parse(json) as BRIResult;
        } catch (e: unknown) {
            setOutput({ kind: "error", message: `JSON 解析失败：${(e as Error).message}` });
            return;
        }
        try {
            const value = buildRestSuggestion(parsed);
            setOutput(value === null ? { kind: "null" } : { kind: "suggestion", value });
        } catch (e: unknown) {
            setOutput({ kind: "error", message: (e as Error).message });
        }
    }, [json]);

    return (
        <div className="debug-group">
            <div className="debug-group-header" onClick={() => setExpanded((v) => !v)}>
                <span className="debug-caret">{expanded ? "▼" : "▶"}</span>
                <strong>休息建议生成</strong>
                <span className="debug-scope">[buildRestSuggestion]</span>
            </div>

            {expanded && (
                <div style={{ marginTop: 8 }}>
                    {/* 样例载入 */}
                    <div style={{ marginBottom: 6 }}>
                        <div className="debug-scope" style={{ marginBottom: 4 }}>
                            载入样例 BRIResult：
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {sampleBriResults.map((s) => (
                                <button
                                    key={s.scenario}
                                    className="button compact"
                                    onClick={() => loadSample(s.result)}
                                >
                                    {s.scenario}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 手动编辑 */}
                    <textarea
                        className="debug-textarea"
                        value={json}
                        onChange={(e) => setJson(e.target.value)}
                        placeholder="在此粘贴/编辑 BRIResult(JSON)，或点击上方样例载入"
                        spellCheck={false}
                    />

                    <div className="button-row" style={{ margin: "6px 0" }}>
                        <button
                            className="button compact primary"
                            onClick={generate}
                            disabled={json.trim() === ""}
                        >
                            生成 RestSuggestion
                        </button>
                        <button
                            className="button compact"
                            onClick={() => {
                                setJson("");
                                setOutput(null);
                            }}
                        >
                            清空
                        </button>
                    </div>

                    {/* 输出 */}
                    {output && <OutputView output={output} />}
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* 输出展示                                                            */
/* ------------------------------------------------------------------ */

function OutputView({ output }: { output: Output }) {
    if (output.kind === "error") {
        return <pre className="debug-pre is-fail">{output.message}</pre>;
    }

    if (output.kind === "null") {
        return <div className="debug-scope">输出：null（未触发，不提醒）</div>;
    }

    const s = output.value;
    return (
        <div className="debug-output-card">
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{s.title}</div>
            <div className="debug-duration">建议时长：{s.duration}</div>
            <div style={{ marginBottom: 4 }}>{s.body}</div>
            <pre className="debug-pre" style={{ margin: 0 }}>
                {s.actions}
            </pre>
        </div>
    );
}
