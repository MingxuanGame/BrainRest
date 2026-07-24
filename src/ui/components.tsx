import type { PropsWithChildren, ReactNode } from "react";

/** 通用卡片容器（eyebrow 小标题 + 标题 + 右侧操作区） */
export function Card({
    title,
    eyebrow,
    actions,
    children,
}: PropsWithChildren<{ title: string; eyebrow?: string; actions?: ReactNode }>) {
    return (
        <section className="card">
            <div className="card-heading">
                <div>
                    {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
                    <h2>{title}</h2>
                </div>
                {actions}
            </div>
            {children}
        </section>
    );
}

/** 开关行（标签 + 描述 + 滑动开关） */
export function Toggle({
    checked,
    onChange,
    label,
    description,
    disabled,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
}) {
    return (
        <label className={`toggle-row${disabled ? " is-disabled" : ""}`}>
            <span>
                <strong>{label}</strong>
                {description ? <small>{description}</small> : null}
            </span>
            <span className="switch">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.currentTarget.checked)}
                    disabled={disabled}
                />
                <span aria-hidden="true" />
            </span>
        </label>
    );
}

/** 行内提示条（success / warning / error / neutral 四种语气） */
export function InlineNotice({
    tone = "neutral",
    children,
}: PropsWithChildren<{ tone?: "neutral" | "success" | "warning" | "error" }>) {
    return (
        <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
            {children}
        </div>
    );
}

/** 时刻输入（label + <input type="time">，值为 [小时, 分钟] 元组） */
export function TimeField({
    label,
    value,
    onChange,
    description,
}: {
    label: string;
    value: [number, number];
    onChange: (value: [number, number]) => void;
    description?: string;
}) {
    const hh = String(value[0]).padStart(2, "0");
    const mm = String(value[1]).padStart(2, "0");
    return (
        <label className="field">
            <span>{label}</span>
            <input
                type="time"
                value={`${hh}:${mm}`}
                onChange={(event) => {
                    const [h, m] = event.currentTarget.value.split(":").map(Number);
                    // 清空输入框时 value 为空串，split 结果为 NaN，忽略保持原值
                    if (Number.isFinite(h) && Number.isFinite(m)) {
                        onChange([h, m]);
                    }
                }}
            />
            {description ? <small className="field-hint">{description}</small> : null}
        </label>
    );
}
