import { useCallback, useState } from 'react'
import { TEST_GROUPS, type SubTest, type TestGroup } from './tests'
import RestSuggestionPanel from './RestSuggestionPanel'

/* ------------------------------------------------------------------ */
/* 状态模型                                                            */
/* ------------------------------------------------------------------ */

type TestStatus = 'idle' | 'running' | 'pass' | 'fail'

interface TestState {
    status: TestStatus
    detail: string
}

const IDLE_STATE: TestState = { status: 'idle', detail: '' }

const STATUS_ICON: Record<TestStatus, string> = {
    idle: '·',
    running: '…',
    pass: '✔',
    fail: '✘',
}

const STATUS_COLOR: Record<TestStatus, string> = {
    idle: '#888',
    running: '#b8860b',
    pass: '#1a7f37',
    fail: '#c0392b',
}

/** 汇总一个分组内所有子测试的状态 */
function summarizeGroup(group: TestGroup, results: Record<string, TestState>): TestStatus {
    const states = group.subTests.map((t) => results[t.id]?.status ?? 'idle')
    if (states.some((s) => s === 'running')) return 'running'
    if (states.some((s) => s === 'fail')) return 'fail'
    if (states.every((s) => s === 'pass')) return 'pass'
    return 'idle'
}

/* ------------------------------------------------------------------ */
/* 子测试行                                                            */
/* ------------------------------------------------------------------ */

function SubTestRow({
    test,
    state,
    disabled,
    onRun,
}: {
    test: SubTest
    state: TestState
    disabled: boolean
    onRun: () => void
}) {
    return (
        <div style={{ borderTop: '1px solid #eee', padding: '6px 0 6px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: STATUS_COLOR[state.status], width: 14 }}>
                    {STATUS_ICON[state.status]}
                </span>
                <span>{test.name}</span>
                <button
                    onClick={onRun}
                    disabled={disabled || state.status === 'running'}
                    style={{ marginLeft: 'auto' }}
                >
                    测试
                </button>
            </div>
            {state.detail && (
                <pre
                    style={{
                        margin: '4px 0 0 20px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        color: state.status === 'fail' ? STATUS_COLOR.fail : '#444',
                    }}
                >
                    {state.detail}
                </pre>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* 分组卡片（可展开下拉）                                               */
/* ------------------------------------------------------------------ */

function GroupCard({
    group,
    results,
    expanded,
    busy,
    onToggle,
    onRunSub,
    onRunGroup,
}: {
    group: TestGroup
    results: Record<string, TestState>
    expanded: boolean
    busy: boolean
    onToggle: () => void
    onRunSub: (test: SubTest) => void
    onRunGroup: () => void
}) {
    const groupStatus = summarizeGroup(group, results)
    const passCount = group.subTests.filter((t) => results[t.id]?.status === 'pass').length

    return (
        <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 8, marginBottom: 6 }}>
            <div
                onClick={onToggle}
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
                <span style={{ width: 12, color: '#666' }}>{expanded ? '▼' : '▶'}</span>
                <span style={{ color: STATUS_COLOR[groupStatus], width: 14 }}>
                    {STATUS_ICON[groupStatus]}
                </span>
                <span style={{ fontWeight: 600 }}>{group.name}</span>
                <span style={{ color: '#999' }}>[{group.scope}]</span>
                <span style={{ color: '#999', marginLeft: 'auto' }}>
                    {passCount}/{group.subTests.length}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation() // 不触发展开/收起
                        onRunGroup()
                    }}
                    disabled={busy || groupStatus === 'running'}
                >
                    测试组
                </button>
            </div>

            {expanded && (
                <div style={{ marginTop: 6 }}>
                    {group.subTests.map((test) => (
                        <SubTestRow
                            key={test.id}
                            test={test}
                            state={results[test.id] ?? IDLE_STATE}
                            disabled={busy}
                            onRun={() => onRunSub(test)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Debug 页                                                            */
/* ------------------------------------------------------------------ */

export default function DebugPage({ onBack }: { onBack: () => void }) {
    const [results, setResults] = useState<Record<string, TestState>>({})
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [runningAll, setRunningAll] = useState(false)

    const toggleGroup = useCallback((groupId: string) => {
        setExpanded((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
    }, [])

    const runSub = useCallback(async (test: SubTest) => {
        setResults((prev) => ({ ...prev, [test.id]: { status: 'running', detail: '' } }))
        try {
            const detail = await test.run()
            setResults((prev) => ({ ...prev, [test.id]: { status: 'pass', detail } }))
        } catch (e: unknown) {
            setResults((prev) => ({
                ...prev,
                [test.id]: { status: 'fail', detail: (e as Error).message },
            }))
        }
    }, [])

    const runGroup = useCallback(
        async (group: TestGroup) => {
            setExpanded((prev) => ({ ...prev, [group.id]: true }))
            for (const test of group.subTests) {
                await runSub(test)
            }
        },
        [runSub],
    )

    const runAll = useCallback(async () => {
        setRunningAll(true)
        for (const group of TEST_GROUPS) {
            await runGroup(group)
        }
        setRunningAll(false)
    }, [runGroup])

    return (
        <div style={{ width: 440, maxHeight: 580, overflowY: 'auto', padding: 12, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <button onClick={onBack}>← 返回</button>
                <h2 style={{ margin: 0, fontSize: 16 }}>Debug</h2>
                <button
                    onClick={() => void runAll()}
                    disabled={runningAll}
                    style={{ marginLeft: 'auto' }}
                >
                    {runningAll ? '运行中…' : '运行全部'}
                </button>
            </div>

            {TEST_GROUPS.map((group) => (
                <GroupCard
                    key={group.id}
                    group={group}
                    results={results}
                    expanded={expanded[group.id] ?? false}
                    busy={runningAll}
                    onToggle={() => toggleGroup(group.id)}
                    onRunSub={(test) => void runSub(test)}
                    onRunGroup={() => void runGroup(group)}
                />
            ))}

            <RestSuggestionPanel />
        </div>
    )
}
