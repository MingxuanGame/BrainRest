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
